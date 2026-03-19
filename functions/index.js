const admin = require('firebase-admin');
const crypto = require('crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

admin.initializeApp();
const db = admin.firestore();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

const QPAY_CLIENT_ID = defineSecret('QPAY_CLIENT_ID');
const QPAY_CLIENT_SECRET = defineSecret('QPAY_CLIENT_SECRET');
const QPAY_INVOICE_CODE = defineSecret('QPAY_INVOICE_CODE');
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const getQpayBaseUrl = () => process.env.QPAY_BASE_URL || 'https://merchant.qpay.mn';
const getQpayCallbackUrl = () => process.env.QPAY_CALLBACK_URL || '';
const getQpayAmount = () => Number(process.env.QPAY_AMOUNT || 1000);
const getQpayAllowedOrigin = () => process.env.QPAY_ALLOWED_ORIGIN || '*';
const getGeminiModel = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const TOKEN_CACHE = {
  token: null,
  expiresAt: 0,
};

const DEFAULT_BILLING_CONFIG = {
  subscription: {
    monthlyPrice: 0,
    discountPercent: 20,
    monthlyCredits: 0,
  },
  tools: {
    official_letterhead: { payPerUsePrice: 1000, creditCost: 1, active: true },
    ndsh_holiday: { payPerUsePrice: 1000, creditCost: 1, active: true },
    account_statement: { payPerUsePrice: 1000, creditCost: 1, active: true },
    business_card: { payPerUsePrice: 1000, creditCost: 1, active: true },
    contract_generator: { payPerUsePrice: 1000, creditCost: 1, active: true },
    eisenhower_analyzer: { payPerUsePrice: 1000, creditCost: 1, active: true },
    swot_analyzer: { payPerUsePrice: 1000, creditCost: 1, active: true },
  },
  credits: {
    bundles: [],
  },
};

const DEFAULT_WORKSPACE_ID = 'default';

function toIsoString(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function serializeForClient(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map((item) => serializeForClient(item));
  if (value && typeof value === 'object') {
    return Object.keys(value).reduce((acc, key) => {
      acc[key] = serializeForClient(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function createTimestampValue(existing) {
  return existing || admin.firestore.FieldValue.serverTimestamp();
}

function sanitizeSlugPart(value, fallback) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function buildOrganizationName(authUser) {
  const base = authUser?.displayName || authUser?.email?.split('@')[0] || 'Nege workspace';
  return `${base} workspace`;
}

function buildUserProfileDefaults(authUser, existing = {}) {
  return {
    email: authUser?.email || existing.email || '',
    displayName: authUser?.displayName || existing.displayName || '',
    photoURL: authUser?.photoURL || existing.photoURL || '',
    role: existing.role || 'user',
    status: existing.status || 'active',
    authProvider: existing.authProvider || authUser?.firebase?.sign_in_provider || 'password',
    subscription: {
      status: existing.subscription?.status || 'inactive',
      startAt: existing.subscription?.startAt || null,
      endAt: existing.subscription?.endAt || null,
      updatedAt: existing.subscription?.updatedAt || null,
    },
    credits: {
      balance: Number(existing.credits?.balance || 0),
      updatedAt: existing.credits?.updatedAt || null,
    },
  };
}

async function getUserProfileByUid(uid) {
  if (!uid) return null;
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? snap.data() : null;
}

async function bootstrapUserProfile(authUser) {
  if (!authUser?.uid) {
    throw new HttpError(401, 'Нэвтэрсэн хэрэглэгч шаардлагатай');
  }

  const userId = authUser.uid;
  const userRef = db.collection('users').doc(userId);

  return db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const existingUser = userSnap.exists ? (userSnap.data() || {}) : {};
    const organizationId = existingUser.activeOrganizationId || existingUser.tenantId || `org_${userId}`;
    const workspaceId = existingUser.activeWorkspaceId || DEFAULT_WORKSPACE_ID;
    const organizationRef = db.collection('organizations').doc(organizationId);
    const membershipRef = organizationRef.collection('memberships').doc(userId);
    const workspaceRef = organizationRef.collection('workspaces').doc(workspaceId);

    const [organizationSnap, membershipSnap, workspaceSnap] = await Promise.all([
      tx.get(organizationRef),
      tx.get(membershipRef),
      tx.get(workspaceRef),
    ]);

    const defaults = buildUserProfileDefaults(authUser, existingUser);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const organizationName = organizationSnap.exists
      ? (organizationSnap.data()?.name || buildOrganizationName(authUser))
      : buildOrganizationName(authUser);

    const nextUser = {
      ...defaults,
      createdAt: createTimestampValue(existingUser.createdAt),
      updatedAt: now,
      tenantId: organizationId,
      activeOrganizationId: organizationId,
      activeWorkspaceId: workspaceId,
      lastLoginAt: now,
    };

    tx.set(userRef, nextUser, { merge: true });

    if (!organizationSnap.exists) {
      tx.set(organizationRef, {
        name: organizationName,
        slug: sanitizeSlugPart(organizationName, `org-${userId.slice(0, 8)}`),
        ownerUserId: userId,
        kind: 'personal',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    } else {
      tx.set(organizationRef, {
        updatedAt: now,
      }, { merge: true });
    }

    if (!workspaceSnap.exists) {
      tx.set(workspaceRef, {
        name: 'Main workspace',
        slug: 'main',
        organizationId,
        isDefault: true,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    }

    if (!membershipSnap.exists) {
      tx.set(membershipRef, {
        userId,
        organizationId,
        workspaceId,
        role: 'owner',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    } else {
      tx.set(membershipRef, {
        status: membershipSnap.data()?.status || 'active',
        updatedAt: now,
      }, { merge: true });
    }

    return {
      profile: {
        ...existingUser,
        ...defaults,
        tenantId: organizationId,
        activeOrganizationId: organizationId,
        activeWorkspaceId: workspaceId,
        createdAt: toIsoString(existingUser.createdAt),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      },
      organization: organizationSnap.exists
        ? { ...organizationSnap.data(), id: organizationId }
        : {
          id: organizationId,
          name: organizationName,
          slug: sanitizeSlugPart(organizationName, `org-${userId.slice(0, 8)}`),
          ownerUserId: userId,
          kind: 'personal',
          status: 'active',
        },
      workspace: workspaceSnap.exists
        ? { ...workspaceSnap.data(), id: workspaceId }
        : {
          id: workspaceId,
          name: 'Main workspace',
          slug: 'main',
          organizationId,
          isDefault: true,
          status: 'active',
        },
      membership: membershipSnap.exists
        ? { ...membershipSnap.data(), id: userId }
        : {
          id: userId,
          userId,
          organizationId,
          workspaceId,
          role: 'owner',
          status: 'active',
        },
    };
  });
}

async function getUserContextByUid(uid) {
  const profile = await getUserProfileByUid(uid);
  if (!profile) return null;
  const organizationId = profile.activeOrganizationId || profile.tenantId || null;
  const workspaceId = profile.activeWorkspaceId || DEFAULT_WORKSPACE_ID;

  let organization = null;
  let workspace = null;
  let membership = null;

  if (organizationId) {
    const organizationRef = db.collection('organizations').doc(organizationId);
    const [organizationSnap, workspaceSnap, membershipSnap] = await Promise.all([
      organizationRef.get(),
      organizationRef.collection('workspaces').doc(workspaceId).get(),
      organizationRef.collection('memberships').doc(uid).get(),
    ]);

    organization = organizationSnap.exists ? { id: organizationSnap.id, ...organizationSnap.data() } : null;
    workspace = workspaceSnap.exists ? { id: workspaceSnap.id, ...workspaceSnap.data() } : null;
    membership = membershipSnap.exists ? { id: membershipSnap.id, ...membershipSnap.data() } : null;
  }

  return { profile, organization, workspace, membership };
}

function buildAuthzPayload(profile, membership) {
  const isSystemAdmin = profile?.role === 'admin';
  const membershipRole = membership?.role || 'member';
  return {
    isAuthenticated: true,
    isSystemAdmin,
    tenantRole: membershipRole,
    canManageOrganization: isSystemAdmin || membershipRole === 'owner' || membershipRole === 'admin',
  };
}

async function requireAuthContext(req) {
  const authUser = await getAuthUser(req);
  if (!authUser?.uid) {
    throw new HttpError(401, 'Нэвтрэх шаардлагатай');
  }

  const bootstrap = await bootstrapUserProfile(authUser);
  const profile = await getUserProfileByUid(authUser.uid);

  return {
    authUser,
    profile,
    organization: bootstrap.organization,
    workspace: bootstrap.workspace,
    membership: bootstrap.membership,
    authz: buildAuthzPayload(profile, bootstrap.membership),
  };
}

async function requireAdminContext(req) {
  const context = await requireAuthContext(req);
  if (context.profile?.role !== 'admin') {
    throw new HttpError(403, 'Админ эрх шаардлагатай');
  }
  return context;
}

async function writeAuditLog({ action, details, actor }) {
  await db.collection('audit_logs').add({
    action,
    details: details || {},
    adminId: actor?.uid || null,
    adminEmail: actor?.email || null,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function getBillingConfig() {
  const snap = await db.collection('settings').doc('billing').get();
  if (!snap.exists) {
    return DEFAULT_BILLING_CONFIG;
  }
  const data = snap.data() || {};
  const mergedTools = {
    ...DEFAULT_BILLING_CONFIG.tools,
    ...(data.tools || {}),
  };
  Object.keys(DEFAULT_BILLING_CONFIG.tools).forEach((toolKey) => {
    mergedTools[toolKey] = {
      ...DEFAULT_BILLING_CONFIG.tools[toolKey],
      ...(data.tools?.[toolKey] || {}),
    };
  });
  return {
    ...DEFAULT_BILLING_CONFIG,
    ...data,
    subscription: {
      ...DEFAULT_BILLING_CONFIG.subscription,
      ...(data.subscription || {}),
    },
    tools: {
      ...mergedTools,
    },
    credits: {
      ...DEFAULT_BILLING_CONFIG.credits,
      ...(data.credits || {}),
    },
  };
}

function parseDateValue(value) {
  if (!value) return null;
  if (value && typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isSubscriptionActive(subscription) {
  if (!subscription) return false;
  const endAt = parseDateValue(subscription.endAt);
  return subscription.status === 'active' && endAt && endAt.getTime() > Date.now();
}

function applyDiscount(amount, discountPercent) {
  const percent = Number(discountPercent || 0);
  const base = Number(amount || 0);
  if (!percent || percent <= 0) return base;
  return Math.max(0, Math.round(base * (1 - percent / 100)));
}

async function getAuthUser(req) {
  const header = req.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  if (!token) return null;
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (error) {
    return null;
  }
}

async function createGrantToken({
  invoiceId = null,
  userId = null,
  toolKey = null,
  source = 'pay_per_use',
  tenantId = null,
  organizationId = null,
  workspaceId = null,
}) {
  const grantToken = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.collection('qpayGrants').doc(grantToken).set({
    invoice_id: invoiceId,
    userId,
    toolKey,
    source,
    tenantId,
    organizationId,
    workspaceId,
    remainingUses: 1,
    status: 'available',
    createdAt: now,
    updatedAt: now,
  });
  return grantToken;
}

function buildAuthHeader(clientId, clientSecret) {
  const token = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  return `Basic ${token}`;
}

async function requestAccessToken(clientId, clientSecret, baseUrl) {
  if (TOKEN_CACHE.token && TOKEN_CACHE.expiresAt > Date.now()) {
    return TOKEN_CACHE.token;
  }

  if (!clientId || !clientSecret) {
    throw new Error('QPAY_CLIENT_ID эсвэл QPAY_CLIENT_SECRET тохируулагдаагүй байна.');
  }

  const tokenUrl = `${baseUrl}/v2/auth/token`;

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: buildAuthHeader(clientId, clientSecret),
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid JSON from QPay Auth');
    }

    if (!response.ok) {
      throw new Error(data?.error_description || data?.error || data?.message || 'Token авахад алдаа гарлаа');
    }

    if (!data?.access_token) {
      throw new Error('Access token олдсонгүй.');
    }

    const expiresIn = Number(data.expires_in || 3600);
    TOKEN_CACHE.token = data.access_token;
    TOKEN_CACHE.expiresAt = Date.now() + (expiresIn - 60) * 1000;

    return TOKEN_CACHE.token;
  } catch (error) {
    throw error;
  }
}

async function createInvoice({ amount, description, invoiceCode, callbackUrl, baseUrl, clientId, clientSecret, metadata = {} }) {
  if (!invoiceCode) {
    throw new Error('QPAY_INVOICE_CODE тохируулагдаагүй байна.');
  }

  const token = await requestAccessToken(clientId, clientSecret, baseUrl);
  const invoiceUrl = `${baseUrl}/v2/invoice`;

  const senderInvoiceNo = `NDSH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const payload = {
    invoice_code: invoiceCode,
    sender_invoice_no: senderInvoiceNo,
    invoice_receiver_code: 'ND-SINGLE',
    invoice_description: description || 'NDSH AI нэг удаагийн уншилт',
    amount: Number(amount || 1000),
  };

  if (callbackUrl) {
    payload.callback_url = callbackUrl;
  }

  const response = await fetch(invoiceUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Нэхэмжлэл үүсгэхэд алдаа гарлаа');
  }

  await db.collection('qpayInvoices').doc(data.invoice_id).set({
    invoice_id: data.invoice_id,
    sender_invoice_no: senderInvoiceNo,
    amount: payload.amount,
    description: payload.invoice_description,
    status: 'CREATED',
    ...metadata,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  return {
    invoice_id: data.invoice_id,
    qr_text: data.qr_text,
    qr_image: data.qr_image,
    urls: data.urls || [],
    sender_invoice_no: senderInvoiceNo,
    amount: payload.amount,
  };
}

async function checkInvoicePayment(invoiceId, baseUrl, clientId, clientSecret) {
  const token = await requestAccessToken(clientId, clientSecret, baseUrl);
  const checkUrl = `${baseUrl}/v2/payment/check`;

  const payload = {
    object_type: 'INVOICE',
    object_id: invoiceId,
    offset: {
      page_number: 1,
      page_limit: 100,
    },
  };

  const response = await fetch(checkUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Төлбөр шалгахад алдаа гарлаа');
  }

  const paid = Array.isArray(data?.rows)
    ? data.rows.some((row) => row.payment_status === 'PAID')
    : data?.payment_status === 'PAID';

  return {
    paid,
    raw: data,
  };
}

// ... (issueGrantForInvoice, reserveGrant, releaseGrant, completeGrant functions remain the same)
async function issueGrantForInvoice(invoiceId) {
  const invoiceRef = db.collection('qpayInvoices').doc(invoiceId);
  const invoiceSnap = await invoiceRef.get();
  const invoiceData = invoiceSnap.exists ? invoiceSnap.data() : {};

  if (invoiceData?.grantToken) {
    return invoiceData.grantToken;
  }

  const now = new Date().toISOString();
  const grantToken = await createGrantToken({
    invoiceId,
    userId: invoiceData?.userId || null,
    toolKey: invoiceData?.toolKey || null,
    source: 'pay_per_use',
    tenantId: invoiceData?.tenantId || invoiceData?.organizationId || null,
    organizationId: invoiceData?.organizationId || invoiceData?.tenantId || null,
    workspaceId: invoiceData?.workspaceId || null,
  });

  await invoiceRef.set({
    status: 'PAID',
    grantToken,
    updatedAt: now,
  }, { merge: true });

  return grantToken;
}

async function reserveGrant(grantToken) {
  const grantRef = db.collection('qpayGrants').doc(grantToken);
  const now = Date.now();
  const staleWindowMs = 5 * 60 * 1000;

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(grantRef);
    if (!snap.exists) {
      return { ok: false, reason: 'INVALID' };
    }
    const data = snap.data();
    const remainingUses = Number(data?.remainingUses || 0);
    const updatedAtMs = data?.updatedAt ? new Date(data.updatedAt).getTime() : 0;
    const isStaleProcessing = data?.status === 'processing' && updatedAtMs && (now - updatedAtMs) > staleWindowMs;

    if (remainingUses < 1 && !isStaleProcessing) {
      return { ok: false, reason: 'USED' };
    }

    const restoredUses = isStaleProcessing ? Math.max(remainingUses, 1) : remainingUses;

    tx.update(grantRef, {
      remainingUses: Math.max(restoredUses - 1, 0),
      status: 'processing',
      updatedAt: new Date().toISOString(),
    });

    return { ok: true, recovered: isStaleProcessing };
  });
}

async function releaseGrant(grantToken) {
  const grantRef = db.collection('qpayGrants').doc(grantToken);
  await grantRef.set({
    remainingUses: admin.firestore.FieldValue.increment(1),
    status: 'available',
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

async function completeGrant(grantToken) {
  const grantRef = db.collection('qpayGrants').doc(grantToken);
  await grantRef.set({
    status: 'used',
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

const NDSH_SYSTEM_PROMPT = `Чи бол Монголын Нийгмийн даатгалын шимтгэл төлөлтийн лавлагааг задлан шинжлэх эксперт AI.

Энэ лавлагааны стандарт формат:
- Гарчиг: "НИЙГМИЙН ДААТГАЛЫН ЕРӨНХИЙ ГАЗАР" / "НИЙГМИЙН ДААТГАЛЫН ШИМТГЭЛ ТӨЛӨЛТИЙН ТАЛААРХ ТОДОРХОЙЛОЛТ"
- Даатгуулагчийн мэдээлэл: Овог, Нэр, Регистр
- Хүснэгт баганууд:
  # | Хэлтсийн нэр | Ажил олгогчийн код | Ажил олгогчийн нэр | Он | Сар | Даатгуулагчийн цалин | Даатгуулагчийн төлөх шимтгэл | Ажил олгогч шимтгэл төлсөн эсэх

Төлсөн эсэх баганы утгууд:
- "Төлсөн" = paid: true
- "Төлөөгүй" = paid: false`;

const NDSH_EXTRACT_PROMPT = `
Дээрх НДШ лавлагаанаас БҮХИЙ Л МӨРҮҮДИЙГ задлаж JSON болго.

ЗААВАЛ буцаах формат:
{
  "employeeInfo": {
    "lastName": "Овог",
    "firstName": "Нэр",
    "registrationNumber": "Регистрийн дугаар"
  },
  "payments": [
    { "year": 2025, "month": 10, "organization": "БАЙГУУЛЛАГЫН НЭР", "paid": true },
    { "year": 2025, "month": 9, "organization": "БАЙГУУЛЛАГЫН НЭР", "paid": true }
  ]
}

ЧУХАЛ ДҮРЭМ:
1. Хүснэгтийн БҮХ мөрийг payments массивт оруул
2. "Ажил олгогчийн нэр" баганаас organization-ийг ав
3. "Он" баганаас year-ийг ав (тоо)
4. "Сар" баганаас month-ийг ав (1-12 тоо)
5. "Ажил олгогч шимтгэл төлсөн эсэх" = "Төлсөн" бол paid: true
6. Олон хуудастай бол БҮГДИЙГ нэгтгэ
7. summary хэсэг ҮҮСГЭХ ШААРДЛАГАГҮЙ - зөвхөн payments массив

ЗӨВХӨН ЦЭВЭР JSON буцаа, тайлбар бичих ХЭРЭГГҮЙ!`;

function cleanJsonResponse(raw) {
  let str = raw.trim();
  str = str.replace(/^```(?:json)?\s*/gi, '');
  str = str.replace(/\s*```$/gi, '');
  str = str.replace(/```/g, '');

  const startIdx = str.indexOf('{');
  const endIdx = str.lastIndexOf('}');

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    str = str.substring(startIdx, endIdx + 1);
  }

  str = str.replace(/,\s*}/g, '}');
  str = str.replace(/,\s*]/g, ']');

  return str.trim();
}

function parseJsonResponse(raw) {
  const cleaned = cleanJsonResponse(raw);

  try {
    const parsed = JSON.parse(cleaned);

    let payments = [];
    if (parsed.payments && Array.isArray(parsed.payments)) {
      payments = parsed.payments
        .filter((p) => p && (p.year || p.Он) && (p.month || p.Сар))
        .map((p) => ({
          year: parseInt(p.year || p.Он) || 0,
          month: parseInt(p.month || p.Сар) || 0,
          organization: p.organization || p['Ажил олгогчийн нэр'] || 'Тодорхойгүй',
          paid: p.paid === true || p.paid === 'true' || p['Ажил олгогч шимтгэл төлсөн эсэх'] === 'Төлсөн',
        }))
        .filter((p) => p.year > 0 && p.month >= 1 && p.month <= 12);
    }

    payments.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

    const paidPayments = payments.filter((p) => p.paid);
    const years = new Set(paidPayments.map((p) => p.year));

    const orgCounts = {};
    paidPayments.forEach((p) => {
      const orgKey = p.organization.toUpperCase().replace(/\s+ХХК$/i, '').trim();
      orgCounts[orgKey] = (orgCounts[orgKey] || 0) + 1;
    });
    const sortedOrgs = Object.entries(orgCounts).sort((a, b) => b[1] - a[1]);
    const longestOrg = sortedOrgs[0];

    return {
      employeeInfo: parsed.employeeInfo,
      payments,
      summary: {
        totalYears: years.size,
        totalMonths: paidPayments.length,
        hasGaps: false,
        gapMonths: [],
        longestEmployment: longestOrg
          ? { organization: longestOrg[0], months: longestOrg[1] }
          : { organization: '', months: 0 },
      },
    };
  } catch (err) {
    return {
      payments: [],
      summary: {
        totalYears: 0,
        totalMonths: 0,
        hasGaps: false,
        gapMonths: [],
        longestEmployment: { organization: '', months: 0 },
      },
    };
  }
}

async function extractNDSHFromImage(imageDataUrl, mimeType, apiKey, modelName) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });
  const base64Data = imageDataUrl.split(',')[1] || imageDataUrl;

  const result = await model.generateContent([
    NDSH_SYSTEM_PROMPT,
    NDSH_EXTRACT_PROMPT,
    {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    },
  ]);

  const text = result.response.text();
  if (!text?.trim()) {
    throw new Error('AI хоосон хариу буцаалаа');
  }

  return parseJsonResponse(text);
}

const app = require('express')();

const defaultOrigins = [
  'https://www.nege.mn',
  'https://nege.mn',
  'http://localhost:5173',
];

const envOrigins = (process.env.QPAY_ALLOWED_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([...defaultOrigins, ...envOrigins]);
const allowAllOrigins = allowedOrigins.has('*');

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowAllOrigins || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(require('express').json({ limit: '30mb' }));
app.use(require('express').urlencoded({ extended: false }));

// Health check that works on both root and /api
app.all(['/', '/health', '/qpay/health'], (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString(), note: 'API is running' });
});

async function queryUsersForAdmin() {
  try {
    const snap = await db.collection('users').orderBy('createdAt', 'desc').limit(500).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    const snap = await db.collection('users').limit(500).get();
    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => {
        const aTime = new Date(toIsoString(a.createdAt) || 0).getTime() || 0;
        const bTime = new Date(toIsoString(b.createdAt) || 0).getTime() || 0;
        return bTime - aTime;
      });
  }
}

async function syncActiveSubscriptionCredits(nextMonthlyCredits, previousMonthlyCredits) {
  const delta = Number(nextMonthlyCredits || 0) - Number(previousMonthlyCredits || 0);
  if (!Number.isFinite(delta) || delta <= 0) {
    return { updated: 0, scanned: 0, skipped: true, delta: Number.isFinite(delta) ? delta : 0 };
  }

  const usersRef = db.collection('users');
  let lastDoc = null;
  let updated = 0;
  let scanned = 0;
  const now = Date.now();

  while (true) {
    let q = usersRef
      .where('subscription.status', '==', 'active')
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(400);

    if (lastDoc) {
      q = usersRef
        .where('subscription.status', '==', 'active')
        .orderBy(admin.firestore.FieldPath.documentId())
        .startAfter(lastDoc)
        .limit(400);
    }

    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    let batchCount = 0;

    snap.docs.forEach((docSnap) => {
      scanned += 1;
      const data = docSnap.data() || {};
      const endAt = parseDateValue(data?.subscription?.endAt);
      if (!endAt || endAt.getTime() <= now) {
        return;
      }

      batch.update(docSnap.ref, {
        'credits.balance': admin.firestore.FieldValue.increment(delta),
        'credits.updatedAt': new Date().toISOString(),
        'subscription.planMonthlyCredits': Number(nextMonthlyCredits || 0),
        'subscription.creditsSyncedAt': new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      batchCount += 1;
    });

    if (batchCount > 0) {
      await batch.commit();
      updated += batchCount;
    }

    lastDoc = snap.docs[snap.docs.length - 1];
  }

  return { updated, scanned, skipped: false, delta };
}

function normalizeBillingConfigInput(input = {}) {
  const mergedTools = {
    ...DEFAULT_BILLING_CONFIG.tools,
    ...(input.tools || {}),
  };

  Object.keys(DEFAULT_BILLING_CONFIG.tools).forEach((toolKey) => {
    const source = input.tools?.[toolKey] || {};
    mergedTools[toolKey] = {
      ...DEFAULT_BILLING_CONFIG.tools[toolKey],
      payPerUsePrice: Number(source.payPerUsePrice ?? DEFAULT_BILLING_CONFIG.tools[toolKey].payPerUsePrice),
      creditCost: Number(source.creditCost ?? DEFAULT_BILLING_CONFIG.tools[toolKey].creditCost),
      active: source.active !== false,
    };
  });

  return {
    ...DEFAULT_BILLING_CONFIG,
    ...input,
    subscription: {
      ...DEFAULT_BILLING_CONFIG.subscription,
      ...(input.subscription || {}),
      monthlyPrice: Number(input.subscription?.monthlyPrice ?? DEFAULT_BILLING_CONFIG.subscription.monthlyPrice),
      discountPercent: Number(input.subscription?.discountPercent ?? DEFAULT_BILLING_CONFIG.subscription.discountPercent),
      monthlyCredits: Number(input.subscription?.monthlyCredits ?? DEFAULT_BILLING_CONFIG.subscription.monthlyCredits),
    },
    tools: mergedTools,
    credits: {
      ...DEFAULT_BILLING_CONFIG.credits,
      ...(input.credits || {}),
      bundles: Array.isArray(input.credits?.bundles)
        ? input.credits.bundles.map((bundle) => ({
          id: bundle.id || crypto.randomUUID(),
          name: String(bundle.name || '').trim() || 'Credits bundle',
          credits: Number(bundle.credits || 0),
          price: Number(bundle.price || 0),
          active: bundle.active !== false,
        }))
        : [],
    },
  };
}

app.post('/auth/bootstrap', async (req, res) => {
  try {
    const context = await requireAuthContext(req);
    res.json({
      profile: serializeForClient(context.profile),
      organization: serializeForClient(context.organization),
      workspace: serializeForClient(context.workspace),
      membership: serializeForClient(context.membership),
      authz: context.authz,
    });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.get('/me/profile', async (req, res) => {
  try {
    const context = await requireAuthContext(req);
    res.json({
      profile: serializeForClient(context.profile),
      organization: serializeForClient(context.organization),
      workspace: serializeForClient(context.workspace),
      membership: serializeForClient(context.membership),
      authz: context.authz,
    });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.get('/me/transactions', async (req, res) => {
  try {
    const context = await requireAuthContext(req);
    let invoices = [];
    try {
      const snap = await db.collection('qpayInvoices')
        .where('userId', '==', context.authUser.uid)
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
      invoices = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      const snap = await db.collection('qpayInvoices')
        .where('userId', '==', context.authUser.uid)
        .get();
      invoices = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const aTime = new Date(toIsoString(a.createdAt) || 0).getTime() || 0;
          const bTime = new Date(toIsoString(b.createdAt) || 0).getTime() || 0;
          return bTime - aTime;
        });
    }

    res.json({ payments: serializeForClient(invoices) });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.get('/admin/users', async (req, res) => {
  try {
    await requireAdminContext(req);
    const users = await queryUsersForAdmin();
    res.json({ users: serializeForClient(users) });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.post('/admin/logs', async (req, res) => {
  try {
    const context = await requireAdminContext(req);
    const action = String(req.body?.action || '').trim();
    if (!action) {
      res.status(400).json({ error: 'action шаардлагатай' });
      return;
    }

    await writeAuditLog({
      action,
      details: req.body?.details || {},
      actor: context.authUser,
    });

    res.json({ ok: true });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.post('/admin/users/:userId/role', async (req, res) => {
  try {
    const context = await requireAdminContext(req);
    const userId = String(req.params.userId || '');
    const role = String(req.body?.role || '').trim();
    if (!userId || !role) {
      res.status(400).json({ error: 'userId болон role шаардлагатай' });
      return;
    }

    const target = await getUserProfileByUid(userId);

    await db.collection('users').doc(userId).set({
      role,
      updatedAt: new Date().toISOString(),
      updatedBy: context.authUser.email || null,
    }, { merge: true });

    await writeAuditLog({
      action: 'CHANGE_USER_ROLE',
      details: { targetUid: userId, targetEmail: target?.email || null, newRole: role },
      actor: context.authUser,
    });

    const updated = await getUserProfileByUid(userId);
    res.json({ user: serializeForClient({ id: userId, ...(updated || {}) }) });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.post('/admin/users/:userId/status', async (req, res) => {
  try {
    const context = await requireAdminContext(req);
    const userId = String(req.params.userId || '');
    const statusValue = String(req.body?.status || '').trim();
    if (!userId || !statusValue) {
      res.status(400).json({ error: 'userId болон status шаардлагатай' });
      return;
    }

    const target = await getUserProfileByUid(userId);

    await db.collection('users').doc(userId).set({
      status: statusValue,
      updatedAt: new Date().toISOString(),
      updatedBy: context.authUser.email || null,
    }, { merge: true });

    await writeAuditLog({
      action: statusValue === 'banned' ? 'BAN_USER' : 'UNBAN_USER',
      details: { targetUid: userId, targetEmail: target?.email || null, status: statusValue },
      actor: context.authUser,
    });

    const updated = await getUserProfileByUid(userId);
    res.json({ user: serializeForClient({ id: userId, ...(updated || {}) }) });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.post('/admin/users/:userId/subscription', async (req, res) => {
  try {
    const context = await requireAdminContext(req);
    const userId = String(req.params.userId || '');
    const endAt = toIsoString(req.body?.endAt);
    if (!userId || !endAt) {
      res.status(400).json({ error: 'userId болон endAt шаардлагатай' });
      return;
    }

    const target = await getUserProfileByUid(userId);
    const statusValue = new Date(endAt).getTime() > Date.now() ? 'active' : 'inactive';
    const startAt = target?.subscription?.startAt || new Date().toISOString();

    await db.collection('users').doc(userId).set({
      subscription: {
        status: statusValue,
        startAt,
        endAt,
        updatedAt: new Date().toISOString(),
        updatedBy: context.authUser.email || null,
      },
      updatedAt: new Date().toISOString(),
      updatedBy: context.authUser.email || null,
    }, { merge: true });

    await writeAuditLog({
      action: 'UPDATE_SUBSCRIPTION',
      details: { targetUid: userId, targetEmail: target?.email || null, status: statusValue, endAt },
      actor: context.authUser,
    });

    const updated = await getUserProfileByUid(userId);
    res.json({ user: serializeForClient({ id: userId, ...(updated || {}) }) });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.post('/admin/users/:userId/credits/topup', async (req, res) => {
  try {
    const context = await requireAdminContext(req);
    const userId = String(req.params.userId || '');
    const amount = Number(req.body?.amount);
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : null;

    if (!userId || !Number.isFinite(amount) || amount <= 0) {
      res.status(400).json({ error: 'userId болон эерэг amount шаардлагатай' });
      return;
    }

    const targetContext = await getUserContextByUid(userId);
    await db.collection('users').doc(userId).set({
      credits: {
        balance: admin.firestore.FieldValue.increment(amount),
        updatedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
      updatedBy: context.authUser.email || null,
    }, { merge: true });

    await db.collection('creditTransactions').add({
      userId,
      tenantId: targetContext?.profile?.tenantId || targetContext?.profile?.activeOrganizationId || null,
      organizationId: targetContext?.profile?.activeOrganizationId || targetContext?.profile?.tenantId || null,
      workspaceId: targetContext?.profile?.activeWorkspaceId || null,
      credits: amount,
      amount: 0,
      type: 'admin_topup',
      note: note || null,
      adminId: context.authUser.uid,
      adminEmail: context.authUser.email || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await writeAuditLog({
      action: 'TOPUP_CREDITS',
      details: { targetUid: userId, targetEmail: targetContext?.profile?.email || null, credits: amount, note: note || null },
      actor: context.authUser,
    });

    const updated = await getUserProfileByUid(userId);
    res.json({ user: serializeForClient({ id: userId, ...(updated || {}) }) });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.get('/admin/settings/global', async (req, res) => {
  try {
    await requireAdminContext(req);
    const snap = await db.collection('settings').doc('global').get();
    res.json({ settings: serializeForClient(snap.exists ? (snap.data() || {}) : {}) });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.post('/admin/settings/global', async (req, res) => {
  try {
    const context = await requireAdminContext(req);
    const settings = req.body?.settings && typeof req.body.settings === 'object' ? req.body.settings : req.body;
    await db.collection('settings').doc('global').set({
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: context.authUser.email || null,
    }, { merge: true });

    await writeAuditLog({
      action: 'UPDATE_SETTINGS',
      details: { changedKeys: Object.keys(settings || {}) },
      actor: context.authUser,
    });

    res.json({ ok: true });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.post('/admin/settings/billing', async (req, res) => {
  try {
    const context = await requireAdminContext(req);
    const previousConfig = await getBillingConfig();
    const incoming = req.body?.config && typeof req.body.config === 'object' ? req.body.config : req.body;
    const nextConfig = normalizeBillingConfigInput(incoming);
    const syncResult = await syncActiveSubscriptionCredits(
      nextConfig.subscription?.monthlyCredits,
      previousConfig.subscription?.monthlyCredits,
    );

    await db.collection('settings').doc('billing').set({
      ...nextConfig,
      updatedAt: new Date().toISOString(),
      updatedBy: context.authUser.email || null,
    }, { merge: true });

    await writeAuditLog({
      action: 'UPDATE_BILLING_CONFIG',
      details: {
        toolKeys: Object.keys(nextConfig.tools || {}),
        bundleCount: nextConfig.credits?.bundles?.length || 0,
        monthlyCredits: Number(nextConfig.subscription?.monthlyCredits || 0),
        previousMonthlyCredits: Number(previousConfig.subscription?.monthlyCredits || 0),
        syncedUsers: syncResult.updated || 0,
      },
      actor: context.authUser,
    });

    if (!syncResult.skipped) {
      await writeAuditLog({
        action: 'SYNC_SUBSCRIPTION_CREDITS',
        details: syncResult,
        actor: context.authUser,
      });
    }

    res.json({
      ok: true,
      config: serializeForClient(nextConfig),
      syncResult,
    });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    res.status(status).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.post('/qpay/invoice', async (req, res) => {
  try {
    const invoice = await createInvoice({
      amount: req.body.amount || getQpayAmount(),
      description: req.body.description,
      invoiceCode: QPAY_INVOICE_CODE.value(),
      callbackUrl: getQpayCallbackUrl(),
      baseUrl: getQpayBaseUrl(),
      clientId: QPAY_CLIENT_ID.value(),
      clientSecret: QPAY_CLIENT_SECRET.value(),
    });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.post('/qpay/check', async (req, res) => {
  try {
    if (!req.body.invoice_id) {
      res.status(400).json({ error: 'invoice_id шаардлагатай' });
      return;
    }

    const result = await checkInvoicePayment(
      req.body.invoice_id,
      getQpayBaseUrl(),
      QPAY_CLIENT_ID.value(),
      QPAY_CLIENT_SECRET.value(),
    );

    let grantToken = null;
    if (result.paid) {
      grantToken = await issueGrantForInvoice(req.body.invoice_id);
    }

    res.json({ paid: result.paid, grantToken });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.post('/qpay/callback', async (req, res) => {
  try {
    const invoiceId = req.body.invoice_id || req.body.object_id || req.body.invoiceId;
    if (!invoiceId) {
      res.status(400).json({ error: 'invoice_id шаардлагатай' });
      return;
    }

    const result = await checkInvoicePayment(
      invoiceId,
      getQpayBaseUrl(),
      QPAY_CLIENT_ID.value(),
      QPAY_CLIENT_SECRET.value(),
    );

    if (result.paid) {
      await issueGrantForInvoice(invoiceId);
    }

    res.json({ ok: true, paid: result.paid });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.get('/billing/config', async (req, res) => {
  try {
    const config = await getBillingConfig();
    res.json({ config });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.post('/billing/invoice', async (req, res) => {
  try {
    const { type, toolKey, bundleId, trainingId, bookingId } = req.body || {};
    const authUser = await getAuthUser(req);
    const billingConfig = await getBillingConfig();
    const authUserId = authUser?.uid || null;
    const authUserEmail = authUser?.email || null;
    const userContext = authUserId ? await getUserContextByUid(authUserId) : null;
    const tenantId = userContext?.profile?.tenantId || userContext?.profile?.activeOrganizationId || null;
    const organizationId = userContext?.profile?.activeOrganizationId || tenantId;
    const workspaceId = userContext?.profile?.activeWorkspaceId || null;

    if (!type) {
      res.status(400).json({ error: 'type шаардлагатай' });
      return;
    }

    if (type === 'tool') {
      if (!toolKey) {
        res.status(400).json({ error: 'toolKey шаардлагатай' });
        return;
      }

      const tool = billingConfig.tools?.[toolKey];
      if (!tool) {
        res.status(400).json({ error: 'Tool олдсонгүй' });
        return;
      }
      if (tool.active === false) {
        res.status(403).json({ error: 'Тус хэрэгсэл түр хаалттай байна.' });
        return;
      }

      let discountPercent = 0;
      let userId = null;
      if (authUserId) {
        userId = authUserId;
        const userSnap = await db.collection('users').doc(userId).get();
        if (userSnap.exists && isSubscriptionActive(userSnap.data()?.subscription)) {
          discountPercent = Number(billingConfig.subscription?.discountPercent || 0);
        }
      }

      const baseAmount = Number(tool.payPerUsePrice || 0);
      const amount = applyDiscount(baseAmount, discountPercent);
      const invoice = await createInvoice({
        amount,
        description: `Tool төлбөр: ${toolKey}`,
        invoiceCode: QPAY_INVOICE_CODE.value(),
        callbackUrl: getQpayCallbackUrl(),
        baseUrl: getQpayBaseUrl(),
        clientId: QPAY_CLIENT_ID.value(),
        clientSecret: QPAY_CLIENT_SECRET.value(),
        metadata: {
          type: 'tool',
          toolKey,
          userId,
          userEmail: authUserEmail,
          tenantId,
          organizationId,
          workspaceId,
          baseAmount,
          discountPercent,
        },
      });

      res.json({ ...invoice, amount, discountPercent });
      return;
    }

    if (type === 'credits') {
      if (!authUser?.uid) {
        res.status(401).json({ error: 'Нэвтэрсэн хэрэглэгч шаардлагатай' });
        return;
      }
      if (!bundleId) {
        res.status(400).json({ error: 'bundleId шаардлагатай' });
        return;
      }

      const bundle = (billingConfig.credits?.bundles || []).find((b) => b.id === bundleId && b.active !== false);
      if (!bundle) {
        res.status(404).json({ error: 'Credits багц олдсонгүй' });
        return;
      }

      const amount = Number(bundle.price || 0);
      const credits = Number(bundle.credits || 0);
      const invoice = await createInvoice({
        amount,
        description: `Credits багц: ${bundle.name || credits + ' credit'}`,
        invoiceCode: QPAY_INVOICE_CODE.value(),
        callbackUrl: getQpayCallbackUrl(),
        baseUrl: getQpayBaseUrl(),
        clientId: QPAY_CLIENT_ID.value(),
        clientSecret: QPAY_CLIENT_SECRET.value(),
        metadata: {
          type: 'credits',
          bundleId,
          credits,
          userId: authUserId,
          userEmail: authUserEmail,
          tenantId,
          organizationId,
          workspaceId,
        },
      });

      res.json({ ...invoice, amount, credits });
      return;
    }

    if (type === 'subscription') {
      if (!authUser?.uid) {
        res.status(401).json({ error: 'Нэвтэрсэн хэрэглэгч шаардлагатай' });
        return;
      }

      const monthlyPrice = Number(billingConfig.subscription?.monthlyPrice || 0);
      const monthlyCredits = Number(billingConfig.subscription?.monthlyCredits || 0);

      if (!Number.isFinite(monthlyPrice) || monthlyPrice <= 0) {
        res.status(400).json({ error: 'Subscription үнэ тохируулагдаагүй байна.' });
        return;
      }

      const invoice = await createInvoice({
        amount: monthlyPrice,
        description: `Subscription сарын төлбөр`,
        invoiceCode: QPAY_INVOICE_CODE.value(),
        callbackUrl: getQpayCallbackUrl(),
        baseUrl: getQpayBaseUrl(),
        clientId: QPAY_CLIENT_ID.value(),
        clientSecret: QPAY_CLIENT_SECRET.value(),
        metadata: {
          type: 'subscription',
          userId: authUserId,
          userEmail: authUserEmail,
          tenantId,
          organizationId,
          workspaceId,
          monthlyPrice,
          monthlyCredits,
          subscriptionMonths: 1,
        },
      });

      res.json({ ...invoice, amount: monthlyPrice, monthlyCredits });
      return;
    }

    if (type === 'training_remaining') {
      if (!authUser?.uid) {
        res.status(401).json({ error: 'Нэвтэрсэн хэрэглэгч шаардлагатай' });
        return;
      }
      if (!bookingId) {
        res.status(400).json({ error: 'bookingId шаардлагатай' });
        return;
      }

      const bookingSnap = await db.collection('bookings').doc(bookingId).get();
      if (!bookingSnap.exists) {
        res.status(404).json({ error: 'Захиалга олдсонгүй' });
        return;
      }

      const booking = bookingSnap.data() || {};
      if (booking.userId !== authUser.uid) {
        res.status(403).json({ error: 'Энэ захиалгын төлбөрийг төлөх эрхгүй байна' });
        return;
      }

      const remainingAmount = Number(booking.remainingAmount || 0);
      if (remainingAmount <= 0) {
        res.status(400).json({ error: 'Үлдэгдэл төлбөр байхгүй байна' });
        return;
      }

      const invoice = await createInvoice({
        amount: remainingAmount,
        description: `Сургалтын үлдэгдэл төлбөр: ${booking.trainingTitle || booking.trainingId || ''}`,
        invoiceCode: QPAY_INVOICE_CODE.value(),
        callbackUrl: getQpayCallbackUrl(),
        baseUrl: getQpayBaseUrl(),
        clientId: QPAY_CLIENT_ID.value(),
        clientSecret: QPAY_CLIENT_SECRET.value(),
        metadata: {
          type: 'training_remaining',
          bookingId,
          trainingId: booking.trainingId || null,
          tenantId,
          organizationId,
          workspaceId,
          totalAmount: Number(booking.totalAmount || 0),
          advanceAmount: Number(booking.amount || 0),
          remainingAmount,
          paymentStage: 'REMAINING',
          userId: authUserId,
          userEmail: authUserEmail,
        },
      });

      res.json({ ...invoice, amount: remainingAmount });
      return;
    }

    if (type === 'training') {
      if (!trainingId) {
        res.status(400).json({ error: 'trainingId шаардлагатай' });
        return;
      }
      const trainingSnap = await db.collection('trainings').doc(trainingId).get();
      if (!trainingSnap.exists) {
        res.status(404).json({ error: 'Сургалт олдсонгүй' });
        return;
      }
      const training = trainingSnap.data();
      const totalPrice = Number(training?.price || 0);
      const rawAdvance = training?.advanceAmount;
      const advanceAmount = rawAdvance === null || rawAdvance === undefined || rawAdvance === ''
        ? totalPrice
        : Math.min(Math.max(Number(rawAdvance || 0), 0), totalPrice);
      const remainingAmount = Math.max(totalPrice - advanceAmount, 0);
      const amount = advanceAmount;
      const invoice = await createInvoice({
        amount,
        description: `Сургалтын захиалга: ${training?.title || trainingId}${remainingAmount > 0 ? ' (Урьдчилгаа)' : ''}`,
        invoiceCode: QPAY_INVOICE_CODE.value(),
        callbackUrl: getQpayCallbackUrl(),
        baseUrl: getQpayBaseUrl(),
        clientId: QPAY_CLIENT_ID.value(),
        clientSecret: QPAY_CLIENT_SECRET.value(),
        metadata: {
          type: 'training',
          trainingId,
          tenantId,
          organizationId,
          workspaceId,
          totalPrice,
          advanceAmount,
          remainingAmount,
          paymentStage: remainingAmount > 0 ? 'DEPOSIT' : 'FULL',
          userId: authUserId,
          userEmail: authUserEmail,
        },
      });

      res.json({ ...invoice, amount });
      return;
    }

    res.status(400).json({ error: 'type буруу байна' });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.post('/billing/check', async (req, res) => {
  try {
    if (!req.body.invoice_id) {
      res.status(400).json({ error: 'invoice_id шаардлагатай' });
      return;
    }

    const authUser = await getAuthUser(req);
    const authUserId = authUser?.uid || null;
    const authUserEmail = authUser?.email || null;

    const invoiceId = req.body.invoice_id;
    const invoiceRef = db.collection('qpayInvoices').doc(invoiceId);
    const invoiceSnap = await invoiceRef.get();
    const invoiceData = invoiceSnap.exists ? invoiceSnap.data() : {};

    const result = await checkInvoicePayment(
      invoiceId,
      getQpayBaseUrl(),
      QPAY_CLIENT_ID.value(),
      QPAY_CLIENT_SECRET.value(),
    );

    if (!result.paid) {
      res.json({ paid: false });
      return;
    }

    const authContext = authUserId ? await getUserContextByUid(authUserId) : null;
    const authTenantId = authContext?.profile?.tenantId || authContext?.profile?.activeOrganizationId || null;
    const authOrganizationId = authContext?.profile?.activeOrganizationId || authTenantId;
    const authWorkspaceId = authContext?.profile?.activeWorkspaceId || null;

    if (authUserId && (!invoiceData?.userId || !invoiceData?.tenantId || !invoiceData?.organizationId)) {
      await invoiceRef.set({
        userId: authUserId,
        userEmail: authUserEmail || null,
        tenantId: invoiceData?.tenantId || authTenantId,
        organizationId: invoiceData?.organizationId || authOrganizationId,
        workspaceId: invoiceData?.workspaceId || authWorkspaceId,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    let grantToken = null;
    let creditsBalance = null;

    if (invoiceData?.type === 'tool') {
      grantToken = await issueGrantForInvoice(invoiceId);
    }

    if (invoiceData?.type === 'credits') {
      const userId = invoiceData?.userId;
      const credits = Number(invoiceData?.credits || 0);
      if (userId && credits > 0 && !invoiceData?.creditsApplied) {
        const userRef = db.collection('users').doc(userId);
        await db.runTransaction(async (tx) => {
          const userSnap = await tx.get(userRef);
          const current = userSnap.exists ? (userSnap.data()?.credits?.balance || 0) : 0;
          creditsBalance = current + credits;
          tx.set(userRef, {
            credits: {
              balance: creditsBalance,
              updatedAt: new Date().toISOString(),
            },
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        });

        await db.collection('creditTransactions').add({
          userId,
          tenantId: invoiceData?.tenantId || invoiceData?.organizationId || null,
          organizationId: invoiceData?.organizationId || invoiceData?.tenantId || null,
          workspaceId: invoiceData?.workspaceId || null,
          invoiceId,
          credits,
          amount: invoiceData?.amount || 0,
          type: 'purchase',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await invoiceRef.set({
          creditsApplied: true,
        }, { merge: true });
      }
    }

    if (invoiceData?.type === 'subscription') {
      const userId = invoiceData?.userId || authUserId;
      const monthlyCredits = Number(invoiceData?.monthlyCredits || 0);
      const months = Number(invoiceData?.subscriptionMonths || 1);
      if (userId && !invoiceData?.subscriptionApplied) {
        const userRef = db.collection('users').doc(userId);
        await db.runTransaction(async (tx) => {
          const userSnap = await tx.get(userRef);
          const userData = userSnap.exists ? userSnap.data() : {};
          const currentCredits = Number(userData?.credits?.balance || 0);
          const currentEnd = parseDateValue(userData?.subscription?.endAt);
          const baseDate = currentEnd && currentEnd.getTime() > Date.now() ? currentEnd : new Date();
          const nextEnd = new Date(baseDate);
          nextEnd.setMonth(nextEnd.getMonth() + Math.max(months, 1));

          const nextCredits = currentCredits + (monthlyCredits * Math.max(months, 1));

          tx.set(userRef, {
            subscription: {
              status: 'active',
              startAt: userData?.subscription?.startAt || new Date().toISOString(),
              endAt: nextEnd.toISOString(),
              updatedAt: new Date().toISOString(),
            },
            credits: {
              balance: nextCredits,
              updatedAt: new Date().toISOString(),
            },
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        });

        await db.collection('creditTransactions').add({
          userId,
          tenantId: invoiceData?.tenantId || invoiceData?.organizationId || null,
          organizationId: invoiceData?.organizationId || invoiceData?.tenantId || null,
          workspaceId: invoiceData?.workspaceId || null,
          invoiceId,
          credits: monthlyCredits * Math.max(months, 1),
          amount: invoiceData?.amount || 0,
          type: 'subscription',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await invoiceRef.set({
          subscriptionApplied: true,
          subscriptionEndAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }

    await invoiceRef.set({
      status: 'PAID',
      paidAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    res.json({
      paid: true,
      grantToken,
      amount: invoiceData?.amount || null,
      creditsBalance,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.post('/credits/consume', async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser?.uid) {
      res.status(401).json({ error: 'Нэвтэрсэн хэрэглэгч шаардлагатай' });
      return;
    }

    const { toolKey } = req.body || {};
    if (!toolKey) {
      res.status(400).json({ error: 'toolKey шаардлагатай' });
      return;
    }

    const billingConfig = await getBillingConfig();
    const tool = billingConfig.tools?.[toolKey];
    if (!tool) {
      res.status(400).json({ error: 'Tool олдсонгүй' });
      return;
    }
    if (tool.active === false) {
      res.status(403).json({ error: 'Тус хэрэгсэл түр хаалттай байна.' });
      return;
    }

    const creditCost = Number(tool.creditCost || 0);
    if (creditCost <= 0) {
      res.status(400).json({ error: 'Credits үнэ тохируулаагүй байна' });
      return;
    }

    const userRef = db.collection('users').doc(authUser.uid);
    const userContext = await getUserContextByUid(authUser.uid);
    let nextBalance = 0;
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      const current = snap.exists ? (snap.data()?.credits?.balance || 0) : 0;
      if (current < creditCost) {
        throw new Error('Credits хүрэлцэхгүй байна');
      }
      nextBalance = current - creditCost;
      tx.set(userRef, {
        credits: {
          balance: nextBalance,
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    });

    const grantToken = await createGrantToken({
      userId: authUser.uid,
      toolKey,
      source: 'credits',
      tenantId: userContext?.profile?.tenantId || userContext?.profile?.activeOrganizationId || null,
      organizationId: userContext?.profile?.activeOrganizationId || userContext?.profile?.tenantId || null,
      workspaceId: userContext?.profile?.activeWorkspaceId || null,
    });

    await db.collection('creditTransactions').add({
      userId: authUser.uid,
      tenantId: userContext?.profile?.tenantId || userContext?.profile?.activeOrganizationId || null,
      organizationId: userContext?.profile?.activeOrganizationId || userContext?.profile?.tenantId || null,
      workspaceId: userContext?.profile?.activeWorkspaceId || null,
      credits: -creditCost,
      amount: 0,
      type: 'consume',
      toolKey,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ ok: true, grantToken, creditsUsed: creditCost, balance: nextBalance });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error';
    res.status(400).json({ error: message });
  }
});

app.post('/usage/log', async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    const {
      toolKey,
      paymentMethod,
      amount,
      creditsUsed,
      invoiceId,
      grantToken,
      guestSessionId,
    } = req.body || {};

    if (!toolKey) {
      res.status(400).json({ error: 'toolKey шаардлагатай' });
      return;
    }

    if (!authUser?.uid && !guestSessionId) {
      res.status(400).json({ error: 'guestSessionId шаардлагатай' });
      return;
    }

    const userContext = authUser?.uid ? await getUserContextByUid(authUser.uid) : null;
    await db.collection('usageLogs').add({
      userId: authUser?.uid || null,
      tenantId: userContext?.profile?.tenantId || userContext?.profile?.activeOrganizationId || null,
      organizationId: userContext?.profile?.activeOrganizationId || userContext?.profile?.tenantId || null,
      workspaceId: userContext?.profile?.activeWorkspaceId || null,
      guestSessionId: authUser?.uid ? null : guestSessionId,
      toolKey,
      paymentMethod: paymentMethod || 'pay_per_use',
      amount: Number(amount || 0),
      creditsUsed: Number(creditsUsed || 0),
      invoiceId: invoiceId || null,
      grantToken: grantToken || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

app.post('/ndsh/parse', async (req, res) => {
  try {
    const { grantToken, imageDataUrl, mimeType } = req.body;
    if (!grantToken) {
      res.status(402).json({ error: 'Төлбөр шаардлагатай.' });
      return;
    }

    const reserved = await reserveGrant(grantToken);
    if (!reserved.ok) {
      res.status(403).json({ error: 'Төлбөрийн эрх ашиглагдсан эсвэл хүчингүй байна.' });
      return;
    }

    try {
      const data = await extractNDSHFromImage(
        imageDataUrl,
        mimeType,
        GEMINI_API_KEY.value(),
        getGeminiModel(),
      );

      await completeGrant(grantToken);
      res.json({ success: true, data });
    } catch (err) {
      await releaseGrant(grantToken);
      throw err;
    }
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

const LETTER_GENERATE_PROMPT = `Чи бол мэргэжлийн албан бичиг төлөвлөгч AI. 
Өгөгдсөн мэдээлэл дээр тулгуурлан Монгол улсын албан хэрэг хөтлөлтийн стандартын дагуу албан бичгийн агуулгыг (текстийг) боловсруулна уу.

ЗААВАЛ БАРИМТЛАХ ДҮРЭМ:
1. Зөвхөн албан бичгийн гол агуулгын текстийг буцаа.
2. Гарчиг, огноо, хаяг зэрэг мэдээллийг текст дотор давтаж бичих шаардлагагүй (эдгээр нь бланканд байгаа).
3. Найруулга нь албан ёсны, тодорхой, товч байх ёстой.
4. Хэрэв мэдээлэл дутуу бол ерөнхий загвар ашиглаж, хэрэглэгч нөхөж бичих боломжтойгоор [] хаалтанд тэмдэглэ.
5. Зөвхөн цэвэр текст буцаа, ямар нэгэн тайлбар эсвэл Markdown тэмдэглэгээ (жишээ нь: ''' эсвэл #) бүү ашигла.`;

const EISENHOWER_PLAN_SYSTEM_PROMPT = `Чи бол Eisenhower matrix ашигладаг бүтээмжийн зөвлөх AI.

Даалгавар:
- Оролтын task жагсаалт бүрийг urgency ба importance оноогоор (1-10) үнэл.
- Дараах quadrant-д ангил:
  - do_now: urgent + important
  - schedule: not urgent + important
  - delegate: urgent + not important
  - eliminate: not urgent + not important

ЗААВАЛ БАРИМТЛАХ ДҮРЭМ:
1) Оролт дахь task бүр JSON items дотор ЯГ НЭГ УДАА орсон байх.
2) "quadrant" зөвхөн do_now | schedule | delegate | eliminate утгатай байна.
3) urgency, importance нь зөвхөн 1-10 хооронд бүхэл тоо байна.
4) reason нь товч шалтгаан, nextAction нь яг одоо хийх next step байна.
5) Markdown, тайлбар бүү нэм. Зөвхөн JSON буцаа.

Буцаах JSON бүтэц:
{
  "items": [
    {
      "task": "string",
      "urgency": 1,
      "importance": 1,
      "quadrant": "do_now",
      "reason": "string",
      "nextAction": "string"
    }
  ],
  "summary": "string",
  "actionPlan": {
    "today": ["string"],
    "thisWeek": ["string"],
    "delegate": ["string"],
    "eliminate": ["string"]
  }
}`;

const SWOT_ANALYZE_SYSTEM_PROMPT = `Чи бол стратегийн SWOT анализын эксперт AI.

Зорилго:
- Өгөгдсөн сэдэв/бизнесийн мэдээллийг SWOT (Strengths, Weaknesses, Opportunities, Threats) болгон задлан шинжил.
- Матрицын үр дүнд тулгуурлан SO/ST/WO/WT стратегийн санал гарга.

ЗААВАЛ БАРИМТЛАХ ДҮРЭМ:
1) Зөвхөн JSON буцаа. Markdown, тайлбар бүү нэм.
2) strengths, weaknesses, opportunities, threats тус бүр 3-8 item байна.
3) Item бүр:
   - point: товч дүгнэлт
   - reason: яагаад гэж тайлбар (1 өгүүлбэр)
4) strategicActions объект заавал:
   - so: strength + opportunity-г холбосон үйлдэл
   - st: strength ашиглан threat бууруулах
   - wo: weakness сайжруулж opportunity авах
   - wt: weakness + threat давхардлыг бууруулах хамгаалалтын алхам
5) summary нь 2-4 өгүүлбэртэй стратегийн товч дүгнэлт байна.

Буцаах JSON бүтэц:
{
  "strengths": [{ "point": "string", "reason": "string" }],
  "weaknesses": [{ "point": "string", "reason": "string" }],
  "opportunities": [{ "point": "string", "reason": "string" }],
  "threats": [{ "point": "string", "reason": "string" }],
  "strategicActions": {
    "so": ["string"],
    "st": ["string"],
    "wo": ["string"],
    "wt": ["string"]
  },
  "summary": "string"
}`;

function normalizePlannerText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function clampPriorityScore(value, fallback = 5) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(1, Math.min(10, Math.round(num)));
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizePlannerText(item)).filter(Boolean);
}

function buildQuadrantFromScores(urgency, importance) {
  if (importance >= 6 && urgency >= 6) return 'do_now';
  if (importance >= 6 && urgency < 6) return 'schedule';
  if (importance < 6 && urgency >= 6) return 'delegate';
  return 'eliminate';
}

function normalizeQuadrantValue(value, urgency, importance) {
  const key = normalizePlannerText(value).toLowerCase().replace(/[\s-]+/g, '_');
  if (['do_now', 'do', 'q1', 'urgent_important', 'important_urgent', 'now'].includes(key)) return 'do_now';
  if (['schedule', 'q2', 'important_not_urgent', 'not_urgent_important', 'plan'].includes(key)) return 'schedule';
  if (['delegate', 'q3', 'urgent_not_important', 'not_important_urgent'].includes(key)) return 'delegate';
  if (['eliminate', 'drop', 'q4', 'not_urgent_not_important', 'delete'].includes(key)) return 'eliminate';
  return buildQuadrantFromScores(urgency, importance);
}

function defaultQuadrantReason(quadrant) {
  if (quadrant === 'do_now') return 'Өндөр ач холбогдолтой бөгөөд шуурхай анхаарах шаардлагатай.';
  if (quadrant === 'schedule') return 'Ач холбогдол өндөр ч яарал багатай тул төлөвлөж хийх нь зөв.';
  if (quadrant === 'delegate') return 'Цаг хугацааны дарамттай ч харьцангуй бага стратегийн нөлөөтэй.';
  return 'Шуурхай биш, ач холбогдол багатай тул бууруулах эсвэл хасах боломжтой.';
}

function defaultNextAction(quadrant, task) {
  if (quadrant === 'do_now') return `Өнөөдрийн цагийн блокт "${task}"-ийг эхлүүлж эхний хувилбарыг дуусга.`;
  if (quadrant === 'schedule') return `"${task}"-т энэ долоо хоногт тодорхой deadline-тэй цаг төлөвлө.`;
  if (quadrant === 'delegate') return `"${task}"-ийг хариуцах хүнийг томилоод үр дүнгийн шалгуур илгээ.`;
  return `"${task}"-ийг түр жагсаалтаас хасах эсвэл автомажуулж багасгах шийдвэр гарга.`;
}

function buildHeuristicFallbackItem(task) {
  const source = normalizePlannerText(task);
  const text = source.toLowerCase();

  const urgency = /(\b(asap|urgent|deadline|due)\b|яаралтай|өнөөдөр|маргааш|энэ\s*долоо\s*хоног)/i.test(text) ? 8 : 4;
  const importance = /(\b(client|customer|contract|finance|risk|tax|strategy|security)\b|чухал|санхүү|эрсдэл|гэрээ|татвар|клиент|стратеги)/i.test(text) ? 8 : 4;
  const quadrant = buildQuadrantFromScores(urgency, importance);

  return {
    task: source,
    urgency,
    importance,
    quadrant,
    reason: 'AI хариу дутуу үед heuristics ашиглан түр ангиллаа.',
    nextAction: defaultNextAction(quadrant, source),
  };
}

function normalizeEisenhowerPlan(raw, sourceTasks) {
  const normalizedSourceTasks = sourceTasks
    .map((item) => normalizePlannerText(item))
    .filter(Boolean);
  const incomingItems = Array.isArray(raw?.items) ? raw.items : [];
  const items = [];
  const seenTasks = new Set();

  incomingItems.forEach((item, index) => {
    const fallbackTask = normalizedSourceTasks[index] || '';
    const task = normalizePlannerText(item?.task || fallbackTask);
    if (!task || seenTasks.has(task)) return;

    const urgency = clampPriorityScore(item?.urgency, 5);
    const importance = clampPriorityScore(item?.importance, 5);
    const quadrant = normalizeQuadrantValue(item?.quadrant, urgency, importance);
    const reason = normalizePlannerText(item?.reason || item?.rationale || item?.why)
      || defaultQuadrantReason(quadrant);
    const nextAction = normalizePlannerText(item?.nextAction || item?.action || item?.next_step)
      || defaultNextAction(quadrant, task);

    seenTasks.add(task);
    items.push({
      task,
      urgency,
      importance,
      quadrant,
      reason,
      nextAction,
    });
  });

  normalizedSourceTasks.forEach((task) => {
    if (seenTasks.has(task)) return;
    const fallback = buildHeuristicFallbackItem(task);
    seenTasks.add(task);
    items.push(fallback);
  });

  const quadrants = {
    do_now: [],
    schedule: [],
    delegate: [],
    eliminate: [],
  };
  items.forEach((item) => {
    quadrants[item.quadrant].push(item.task);
  });

  const rawActionPlan = raw?.actionPlan || {};
  const actionPlan = {
    today: normalizeStringArray(rawActionPlan.today),
    thisWeek: normalizeStringArray(rawActionPlan.thisWeek),
    delegate: normalizeStringArray(rawActionPlan.delegate),
    eliminate: normalizeStringArray(rawActionPlan.eliminate),
  };

  if (actionPlan.today.length === 0) {
    actionPlan.today = items
      .filter((item) => item.quadrant === 'do_now')
      .slice(0, 5)
      .map((item) => item.nextAction);
  }
  if (actionPlan.thisWeek.length === 0) {
    actionPlan.thisWeek = items
      .filter((item) => item.quadrant === 'schedule')
      .slice(0, 5)
      .map((item) => item.nextAction);
  }
  if (actionPlan.delegate.length === 0) {
    actionPlan.delegate = items
      .filter((item) => item.quadrant === 'delegate')
      .slice(0, 5)
      .map((item) => item.nextAction);
  }
  if (actionPlan.eliminate.length === 0) {
    actionPlan.eliminate = items
      .filter((item) => item.quadrant === 'eliminate')
      .slice(0, 5)
      .map((item) => item.nextAction);
  }

  const summary = normalizePlannerText(raw?.summary)
    || `Нийт ${items.length} task ангиллаа: Do now ${quadrants.do_now.length}, Schedule ${quadrants.schedule.length}, Delegate ${quadrants.delegate.length}, Eliminate ${quadrants.eliminate.length}.`;

  return {
    items,
    quadrants,
    actionPlan,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

async function generateEisenhowerPlanAI(params, apiKey, modelName) {
  const tasks = Array.isArray(params?.tasks)
    ? params.tasks.map((item) => normalizePlannerText(item)).filter(Boolean).slice(0, 80)
    : [];
  if (tasks.length === 0) {
    throw new Error('tasks хоосон байна.');
  }
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY тохируулагдаагүй байна.');
  }

  const context = normalizePlannerText(params?.context || '');
  const payload = { tasks, context };
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  let text = '';
  try {
    const result = await model.generateContent([
      EISENHOWER_PLAN_SYSTEM_PROMPT,
      JSON.stringify(payload),
    ]);
    text = result?.response?.text?.() || '';
  } catch (error) {
    throw new Error(`Eisenhower AI generation алдаа: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  if (!text.trim()) {
    throw new Error('AI хоосон хариу буцаалаа.');
  }

  let parsed;
  try {
    parsed = JSON.parse(cleanJsonResponse(text));
  } catch (parseError) {
    const retryModel = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0 },
    });
    const retryResult = await retryModel.generateContent([
      EISENHOWER_PLAN_SYSTEM_PROMPT,
      'Return valid JSON only.',
      JSON.stringify(payload),
    ]);
    const retryText = retryResult?.response?.text?.() || '';
    if (!retryText.trim()) {
      throw parseError;
    }
    parsed = JSON.parse(cleanJsonResponse(retryText));
  }

  return normalizeEisenhowerPlan(parsed, tasks);
}

function normalizeSwotEntryList(rawEntries) {
  const list = [];
  const seen = new Set();
  (Array.isArray(rawEntries) ? rawEntries : []).forEach((item) => {
    const point = normalizePlannerText(
      typeof item === 'string'
        ? item
        : (item?.point || item?.title || item?.item || item?.name || '')
    );
    const reason = normalizePlannerText(
      typeof item === 'string'
        ? ''
        : (item?.reason || item?.impact || item?.note || item?.rationale || '')
    );
    if (!point) return;
    const signature = point.toLowerCase();
    if (seen.has(signature)) return;
    seen.add(signature);
    list.push({ point, reason });
  });
  return list.slice(0, 8);
}

function normalizeSwotActionList(rawActions) {
  const list = [];
  const seen = new Set();
  (Array.isArray(rawActions) ? rawActions : []).forEach((item) => {
    const text = normalizePlannerText(item);
    if (!text) return;
    const signature = text.toLowerCase();
    if (seen.has(signature)) return;
    seen.add(signature);
    list.push(text);
  });
  return list.slice(0, 8);
}

function buildSwotDefaultEntries(topic) {
  const shortTopic = normalizePlannerText(topic).slice(0, 120) || 'төсөл';
  return {
    strengths: [
      { point: 'Үндсэн асуудлыг шийдэх тодорхой үнэ цэнтэй саналтай.', reason: `${shortTopic} хэрэглэгчийн бодит хэрэгцээнд чиглэсэн.` },
      { point: 'Шийдвэр гаргалтыг хурдлуулах AI автоматжуулалтын боломжтой.', reason: 'Гарын ажиллагаа багассанаар багийн бүтээмж нэмэгдэнэ.' },
      { point: 'Бүтээгдэхүүнийг хурдан сайжруулах уян хөгжүүлэлтийн боломжтой.', reason: 'Жижиг баг давтамжтай туршилт, сайжруулалт хийхэд давуу.' },
    ],
    weaknesses: [
      { point: 'Баг, нөөц хязгаарлагдмал байж болзошгүй.', reason: 'Олон чиглэлийн ажлыг зэрэг гүйцэтгэхэд ачаалал үүсгэнэ.' },
      { point: 'Брэндийн танигдалт бага байж магадгүй.', reason: 'Шинэ хэрэглэгч татах CAC эхний үед өндөр байх эрсдэлтэй.' },
      { point: 'Процесс, өгөгдлийн стандарт бүрэн тогтоогүй байж болно.', reason: 'Үйлчилгээний чанарыг тогтвортой барихад саад болж магадгүй.' },
    ],
    opportunities: [
      { point: 'Зах зээлд дижитал автоматжуулалтын эрэлт өсөж байна.', reason: 'Зардал бууруулах, хурд нэмэх хэрэгцээ тогтмол нэмэгдэж байгаа.' },
      { point: 'Салбарын түншлэл, интеграцийн боломжууд нээлттэй.', reason: 'Existing ecosystem-т холбогдсоноор өсөлтийг хурдлуулна.' },
      { point: 'Ниш хэрэглэгчдэд төвлөрсөн санал дэвшүүлэх боломжтой.', reason: 'Тодорхой сегментэд эхлээд хүчтэй байр суурь эзлэхэд дөхөм.' },
    ],
    threats: [
      { point: 'Өрсөлдөгчдийн хурдан хуулбарлалт, үнэ буулгалт.', reason: 'Үнэ дээрх өрсөлдөөн margin-д сөргөөр нөлөөлнө.' },
      { point: 'Эдийн засаг, худалдан авалтын цикл удаашрах эрсдэл.', reason: 'B2B шийдвэр гаргалт сунжрах үед орлого хойшилно.' },
      { point: 'Өгөгдөл, зохицуулалтын шаардлага чангарах магадлал.', reason: 'Нэмэлт compliance зардал, хугацаа шаардана.' },
    ],
  };
}

function normalizeSwotAnalysis(raw, topic) {
  const fallback = buildSwotDefaultEntries(topic);
  const strengths = normalizeSwotEntryList(raw?.strengths);
  const weaknesses = normalizeSwotEntryList(raw?.weaknesses);
  const opportunities = normalizeSwotEntryList(raw?.opportunities);
  const threats = normalizeSwotEntryList(raw?.threats);

  const nextStrengths = strengths.length > 0 ? strengths : fallback.strengths;
  const nextWeaknesses = weaknesses.length > 0 ? weaknesses : fallback.weaknesses;
  const nextOpportunities = opportunities.length > 0 ? opportunities : fallback.opportunities;
  const nextThreats = threats.length > 0 ? threats : fallback.threats;

  const rawActions = raw?.strategicActions || {};
  const strategicActions = {
    so: normalizeSwotActionList(rawActions.so || raw?.soStrategies || raw?.SO),
    st: normalizeSwotActionList(rawActions.st || raw?.stStrategies || raw?.ST),
    wo: normalizeSwotActionList(rawActions.wo || raw?.woStrategies || raw?.WO),
    wt: normalizeSwotActionList(rawActions.wt || raw?.wtStrategies || raw?.WT),
  };

  if (strategicActions.so.length === 0 && nextStrengths[0] && nextOpportunities[0]) {
    strategicActions.so.push(`${nextStrengths[0].point} давууг ашиглан ${nextOpportunities[0].point.toLowerCase()} чиглэлд пилот эхлүүл.`);
  }
  if (strategicActions.st.length === 0 && nextStrengths[0] && nextThreats[0]) {
    strategicActions.st.push(`${nextStrengths[0].point} дээр тулгуурласан хамгаалалтын differentiation мессеж боловсруул.`);
  }
  if (strategicActions.wo.length === 0 && nextWeaknesses[0] && nextOpportunities[0]) {
    strategicActions.wo.push(`${nextWeaknesses[0].point} асуудлыг 30-45 хоногийн roadmap-оор засч ${nextOpportunities[0].point.toLowerCase()} боломжийг ашигла.`);
  }
  if (strategicActions.wt.length === 0 && nextWeaknesses[0] && nextThreats[0]) {
    strategicActions.wt.push(`${nextWeaknesses[0].point} болон ${nextThreats[0].point.toLowerCase()} эрсдэлийг бууруулах contingency төлөвлөгөө гарга.`);
  }

  const summary = normalizePlannerText(raw?.summary)
    || 'SWOT шинжилгээгээр дотоод чадвар дээр суурилан боломж барих (SO), эрсдэлээс хамгаалах (ST), сул талыг нөхөх (WO, WT) 4 чиглэлийн стратеги тодров.';

  return {
    strengths: nextStrengths,
    weaknesses: nextWeaknesses,
    opportunities: nextOpportunities,
    threats: nextThreats,
    strategicActions,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

async function generateSwotAnalysisAI(params, apiKey, modelName) {
  const topic = normalizePlannerText(params?.topic || '');
  const goal = normalizePlannerText(params?.goal || '');
  const context = normalizePlannerText(params?.context || '');
  if (!topic) {
    throw new Error('topic хоосон байна.');
  }
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY тохируулагдаагүй байна.');
  }

  const payload = { topic, goal, context };
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  let text = '';
  try {
    const result = await model.generateContent([
      SWOT_ANALYZE_SYSTEM_PROMPT,
      JSON.stringify(payload),
    ]);
    text = result?.response?.text?.() || '';
  } catch (error) {
    throw new Error(`SWOT AI generation алдаа: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  if (!text.trim()) {
    throw new Error('AI хоосон хариу буцаалаа.');
  }

  let parsed;
  try {
    parsed = JSON.parse(cleanJsonResponse(text));
  } catch (parseError) {
    const retryModel = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0 },
    });
    const retryResult = await retryModel.generateContent([
      SWOT_ANALYZE_SYSTEM_PROMPT,
      'Return valid JSON only.',
      JSON.stringify(payload),
    ]);
    const retryText = retryResult?.response?.text?.() || '';
    if (!retryText.trim()) {
      throw parseError;
    }
    parsed = JSON.parse(cleanJsonResponse(retryText));
  }

  return normalizeSwotAnalysis(parsed, topic);
}

async function generateLetterAI(params, apiKey, modelName) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const prompt = `${LETTER_GENERATE_PROMPT}

Өгөгдөл:
- Илгээгч байгууллага: ${params.orgName || ''}
- Хүлээн авагч: ${params.addresseeOrg || ''} ${params.addresseeName || ''}
- Гарчиг: ${params.subject || ''}
- Нэмэлт тайлбар/хүсэлт: ${params.contentHint || ''}

Албан бичгийн утгыг боловсруулж бичнэ үү:`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

app.post('/ai/generate-letter', async (req, res) => {
  try {
    const { orgName, addresseeOrg, addresseeName, subject, contentHint } = req.body;

    // Simple rate limiting or auth could be added here if needed
    // For now, let's keep it direct as it's part of the user dashboard

    const content = await generateLetterAI(
      { orgName, addresseeOrg, addresseeName, subject, contentHint },
      GEMINI_API_KEY.value(),
      getGeminiModel()
    );

    res.json({ success: true, content: content.trim() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'AI generation error' });
  }
});

app.post('/ai/eisenhower-plan', async (req, res) => {
  try {
    const tasks = Array.isArray(req.body?.tasks)
      ? req.body.tasks
      : (typeof req.body?.tasks === 'string' ? req.body.tasks.split(/\r?\n/) : []);
    if (tasks.length === 0) {
      res.status(400).json({ error: 'tasks хоосон байна.' });
      return;
    }

    const data = await generateEisenhowerPlanAI(
      { tasks, context: req.body?.context },
      GEMINI_API_KEY.value(),
      getGeminiModel(),
    );

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Eisenhower planning error' });
  }
});

app.post('/ai/swot-analyze', async (req, res) => {
  try {
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim() : '';
    if (!topic) {
      res.status(400).json({ error: 'topic хоосон байна.' });
      return;
    }

    const data = await generateSwotAnalysisAI(
      {
        topic,
        goal: req.body?.goal,
        context: req.body?.context,
      },
      GEMINI_API_KEY.value(),
      getGeminiModel(),
    );

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'SWOT analysis error' });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

exports.api = onRequest({
  timeoutSeconds: 120,
  memory: '1GiB',
  secrets: [
    QPAY_CLIENT_ID,
    QPAY_CLIENT_SECRET,
    QPAY_INVOICE_CODE,
    GEMINI_API_KEY,
  ],
}, app);
