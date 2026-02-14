import http from 'node:http';
import { URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function missingConfig(message) {
  return new HttpError(400, message);
}

const TOKEN_CACHE = {
  token: null,
  expiresAt: 0,
};

function loadEnvFile() {
  const envPath = path.join(process.cwd(), 'server', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    if (!line || line.trim().startsWith('#')) return;
    const index = line.indexOf('=');
    if (index === -1) return;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value.replace(/^"|"$/g, '');
    }
  });
}

loadEnvFile();

const PORT = Number(process.env.QPAY_PORT || 8787);
const BASE_URL = (process.env.QPAY_BASE_URL || 'https://merchant.qpay.mn').replace(/\/$/, '');
const CLIENT_ID = process.env.QPAY_CLIENT_ID || '';
const CLIENT_SECRET = process.env.QPAY_CLIENT_SECRET || '';
const INVOICE_CODE = process.env.QPAY_INVOICE_CODE || '';
const CALLBACK_URL = process.env.QPAY_CALLBACK_URL || '';
const DEFAULT_AMOUNT = Number(process.env.QPAY_AMOUNT || 100);
const ALLOWED_ORIGIN = process.env.QPAY_ALLOWED_ORIGIN || 'http://localhost:5173';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const QPAY_MOCK_MODE = process.env.QPAY_MOCK_MODE === 'true' || !CLIENT_ID || !CLIENT_SECRET || !INVOICE_CODE;

if (QPAY_MOCK_MODE && process.env.QPAY_MOCK_MODE !== 'true') {
  console.warn('[QPay] Credentials missing. Falling back to mock mode for local development.');
}

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const DATA_FILE = path.join(DATA_DIR, 'qpay-store.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ invoices: {}, grants: {}, credits: {} }, null, 2));
  }
}

function readStore() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      invoices: parsed.invoices || {},
      grants: parsed.grants || {},
      credits: parsed.credits || {},
    };
  } catch (err) {
    return { invoices: {}, grants: {}, credits: {} };
  }
}

function writeStore(store) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function jsonResponse(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

function notFound(res) {
  jsonResponse(res, 404, { error: 'Not found' });
}

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch (err) {
    return null;
  }
}

function resolveUserId(req, body) {
  if (body?.userId) return body.userId;
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const payload = decodeJwtPayload(authHeader.slice(7));
  return payload?.user_id || payload?.sub || payload?.uid || null;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  if (!body) return {};

  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(body);
    return Object.fromEntries(params.entries());
  }

  try {
    return JSON.parse(body);
  } catch (err) {
    return {};
  }
}

function buildAuthHeader() {
  const token = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  return `Basic ${token}`;
}

async function requestAccessToken() {
  if (QPAY_MOCK_MODE) {
    return 'mock-access-token-' + Date.now();
  }

  if (TOKEN_CACHE.token && TOKEN_CACHE.expiresAt > Date.now()) {
    return TOKEN_CACHE.token;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw missingConfig('QPAY_CLIENT_ID (Username) эсвэл QPAY_CLIENT_SECRET (Password) тохируулагдаагүй байна.');
  }

  const tokenUrl = `${BASE_URL}/v2/auth/token`;

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: buildAuthHeader(),
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
      throw new Error('Access token олдсонгүй (invalid response structure).');
    }

    const expiresIn = Number(data.expires_in || 3600);
    TOKEN_CACHE.token = data.access_token;
    TOKEN_CACHE.expiresAt = Date.now() + (expiresIn - 60) * 1000;

    return TOKEN_CACHE.token;
  } catch (error) {
    throw error;
  }
}

async function createInvoice({ amount, description }) {
  const senderInvoiceNo = `NDSH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  if (QPAY_MOCK_MODE) {
    const invoiceId = `mock-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const store = readStore();
    store.invoices[invoiceId] = {
      invoice_id: invoiceId,
      sender_invoice_no: senderInvoiceNo,
      amount: Number(amount || DEFAULT_AMOUNT),
      status: 'CREATED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeStore(store);

    const mockQrImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X9nE0AAAAASUVORK5CYII=';
    return {
      invoice_id: invoiceId,
      qr_text: `mock:${invoiceId}`,
      qr_image: mockQrImage,
      urls: [],
      sender_invoice_no: senderInvoiceNo,
      amount: Number(amount || DEFAULT_AMOUNT),
      mock: true,
    };
  }

  if (!INVOICE_CODE) {
    throw missingConfig('QPAY_INVOICE_CODE тохируулагдаагүй байна.');
  }

  const token = await requestAccessToken();
  const invoiceUrl = `${BASE_URL}/v2/invoice`;

  const payload = {
    invoice_code: INVOICE_CODE,
    sender_invoice_no: senderInvoiceNo,
    invoice_receiver_code: 'ND-SINGLE',
    invoice_description: description || 'NDSH AI нэг удаагийн уншилт',
    amount: Number(amount || DEFAULT_AMOUNT),
  };

  if (CALLBACK_URL) {
    payload.callback_url = CALLBACK_URL;
  }

  try {
    const response = await fetch(invoiceUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid JSON from QPay Invoice');
    }

    if (!response.ok) {
      throw new Error(data?.message || data?.error || 'Нэхэмжлэл үүсгэхэд алдаа гарлаа');
    }

    const store = readStore();
    store.invoices[data.invoice_id] = {
      invoice_id: data.invoice_id,
      sender_invoice_no: senderInvoiceNo,
      amount: payload.amount,
      status: 'CREATED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeStore(store);

    return {
      invoice_id: data.invoice_id,
      qr_text: data.qr_text,
      qr_image: data.qr_image,
      urls: data.urls || [],
      sender_invoice_no: senderInvoiceNo,
      amount: payload.amount,
    };
  } catch (error) {
    throw error;
  }
}

async function checkInvoicePayment(invoiceId) {
  if (QPAY_MOCK_MODE) {
    // In mock mode, simply assume it's paid if it exists in our store, 
    // or maybe we want to simulate a "click to pay" flow?
    // For simplicity, let's say: if the invoice exists, we mark it as PAID on the first check.
    const store = readStore();
    if (store.invoices[invoiceId]) {
      return {
        paid: true,
        raw: { payment_status: 'PAID' }
      };
    }
    return { paid: false, raw: {} };
  }

  const token = await requestAccessToken();
  const checkUrl = `${BASE_URL}/v2/payment/check`;

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

function issueGrantForInvoice(invoiceId) {
  const store = readStore();
  const invoice = store.invoices[invoiceId] || {
    invoice_id: invoiceId,
  };

  if (invoice.grantToken) {
    return invoice.grantToken;
  }

  const grantToken = crypto.randomUUID();
  store.invoices[invoiceId] = {
    ...invoice,
    status: 'PAID',
    grantToken,
    updatedAt: new Date().toISOString(),
  };
  store.grants[grantToken] = {
    invoice_id: invoiceId,
    remainingUses: 1,
    createdAt: new Date().toISOString(),
  };
  writeStore(store);

  return grantToken;
}

function consumeGrant(grantToken) {
  const store = readStore();
  const grant = store.grants[grantToken];
  if (!grant) {
    return { ok: false, reason: 'INVALID' };
  }
  if (grant.remainingUses < 1) {
    return { ok: false, reason: 'USED' };
  }
  store.grants[grantToken] = {
    ...grant,
    remainingUses: grant.remainingUses - 1,
    usedAt: new Date().toISOString(),
  };
  writeStore(store);
  return { ok: true };
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

const BUSINESS_CARD_MAP_SYSTEM_PROMPT = `You are a strict business-card understanding engine.
You map EVERY detected SVG text/image node into semantic editable template fields.
You understand English and Mongolian business-card semantics.
Return valid JSON only (no markdown, no extra text).`;

const BUSINESS_CARD_MAP_USER_PROMPT = `Given SVG text/image descriptors and optional reference image, infer card semantics and map nodes.

Return JSON exactly in this shape:
{
  "textFields": [
    { "index": 0, "field": "fullName", "confidence": 0.95, "reason": "..." }
  ],
  "imageFields": [
    { "index": 0, "field": "logo", "confidence": 0.95, "reason": "..." }
  ],
  "audit": {
    "missingRecommendedFields": ["email", "phone"],
    "notes": ["..."]
  }
}

Rules:
1. Every text node index MUST appear exactly once in textFields.
2. Every image node index should appear in imageFields.
3. Use camelCase field names.
4. Prefer these standard fields whenever applicable:
   fullName, firstName, lastName, company, position, department, phone, mobilePhone, email, web, address, tagline,
   socialFacebook, socialInstagram, socialLinkedin, socialX, logo.
5. For uncertain text still map to a meaningful custom field (serviceLine, branchName, sloganLine1, etc). Do NOT leave text unmapped.
6. Keep input indices unchanged.
7. confidence is 0..1.
8. No duplicate index entries.`;

const BUSINESS_CARD_UNIQUE_FIELDS = new Set([
  'fullName',
  'firstName',
  'lastName',
  'company',
  'position',
  'department',
  'phone',
  'mobilePhone',
  'email',
  'web',
  'address',
  'tagline',
  'socialFacebook',
  'socialInstagram',
  'socialLinkedin',
  'socialX',
  'logo',
]);

const BUSINESS_CARD_RECOMMENDED_FIELDS = [
  'fullName',
  'company',
  'position',
  'phone',
  'email',
  'web',
  'address',
  'tagline',
  'logo',
];

const BUSINESS_CARD_CONTACT_FIELDS = ['phone', 'mobilePhone', 'email', 'web', 'socialFacebook', 'socialInstagram', 'socialLinkedin', 'socialX'];

const BUSINESS_CARD_BENCHMARK_CASES = [
  {
    id: 'mn_basic_contact',
    name: 'MN Basic Contact',
    textNodes: [
      { index: 0, text: 'Отгонбаяр Бат' },
      { index: 1, text: 'Маркетинг менежер' },
      { index: 2, text: '+976 99112233' },
      { index: 3, text: 'otgon@example.mn' },
      { index: 4, text: 'www.example.mn' },
    ],
    imageNodes: [{ index: 0, id: 'logo' }],
    expected: {
      textByIndex: { 0: 'fullName', 1: 'position', 2: 'phone', 3: 'email', 4: 'web' },
      imageByIndex: { 0: 'logo' },
      requiredFields: ['fullName', 'position', 'phone', 'email', 'web', 'logo'],
    },
  },
  {
    id: 'mn_company_address',
    name: 'MN Company + Address',
    textNodes: [
      { index: 0, text: 'NEGE LLC' },
      { index: 1, text: 'Ганболдын Төмөр' },
      { index: 2, text: 'Гүйцэтгэх захирал' },
      { index: 3, text: 'Сүхбаатар дүүрэг, 1-р хороо, Улаанбаатар' },
    ],
    imageNodes: [{ index: 0, id: 'company-logo' }],
    expected: {
      textByIndex: { 0: 'company', 1: 'fullName', 2: 'position', 3: 'address' },
      imageByIndex: { 0: 'logo' },
      requiredFields: ['fullName', 'company', 'position', 'address', 'logo'],
    },
  },
  {
    id: 'mn_social',
    name: 'MN Social Handles',
    textNodes: [
      { index: 0, text: 'Цэрэнсодном Болор' },
      { index: 1, text: 'Менежер' },
      { index: 2, text: '@bolor' },
      { index: 3, text: 'linkedin.com/in/bolor' },
      { index: 4, text: 'instagram.com/bolor' },
    ],
    imageNodes: [],
    expected: {
      textByIndex: { 0: 'fullName', 1: 'position', 2: 'socialX', 3: 'socialLinkedin', 4: 'socialInstagram' },
      imageByIndex: {},
      requiredFields: ['fullName', 'position', 'socialX', 'socialLinkedin', 'socialInstagram'],
    },
  },
  {
    id: 'en_basic_contact',
    name: 'EN Basic Contact',
    textNodes: [
      { index: 0, text: 'John Doe' },
      { index: 1, text: 'Sales Director' },
      { index: 2, text: '+1 (415) 555-2398' },
      { index: 3, text: 'john@acme.com' },
      { index: 4, text: 'acme.com' },
    ],
    imageNodes: [{ index: 0, id: 'brand-logo' }],
    expected: {
      textByIndex: { 0: 'fullName', 1: 'position', 2: 'phone', 3: 'email', 4: 'web' },
      imageByIndex: { 0: 'logo' },
      requiredFields: ['fullName', 'position', 'phone', 'email', 'web', 'logo'],
    },
  },
  {
    id: 'first_last_split',
    name: 'Split Name Lines',
    textNodes: [
      { index: 0, text: 'John' },
      { index: 1, text: 'Doe' },
      { index: 2, text: 'Chief Technology Officer' },
      { index: 3, text: 'hello@nege.mn' },
    ],
    imageNodes: [],
    expected: {
      textByIndex: { 2: 'position', 3: 'email' },
      imageByIndex: {},
      requiredFields: ['position', 'email'],
    },
  },
  {
    id: 'mobile_vs_phone',
    name: 'Mobile + Phone',
    textNodes: [
      { index: 0, text: 'Ану Энх' },
      { index: 1, text: 'Худалдааны зөвлөх' },
      { index: 2, text: 'Утас: 70112233' },
      { index: 3, text: 'Гар утас: 99112233' },
    ],
    imageNodes: [],
    expected: {
      textByIndex: { 0: 'fullName', 1: 'position' },
      imageByIndex: {},
      requiredFields: ['fullName', 'position', 'phone'],
    },
  },
  {
    id: 'tagline_case',
    name: 'Tagline',
    textNodes: [
      { index: 0, text: 'Future belongs to builders' },
      { index: 1, text: 'Nege LLC' },
      { index: 2, text: 'Baatar D.' },
    ],
    imageNodes: [{ index: 0, id: 'logo-main' }],
    expected: {
      textByIndex: { 0: 'tagline', 1: 'company', 2: 'fullName' },
      imageByIndex: { 0: 'logo' },
      requiredFields: ['tagline', 'company', 'fullName', 'logo'],
    },
  },
  {
    id: 'gibberish_guard',
    name: 'Low-signal Text Guard',
    textNodes: [
      { index: 0, text: 'TTTTTT' },
      { index: 1, text: 'Отгонбаяр' },
      { index: 2, text: '+976 99112233' },
    ],
    imageNodes: [],
    expected: {
      textByIndex: { 1: 'fullName', 2: 'phone' },
      imageByIndex: {},
      requiredFields: ['fullName', 'phone'],
    },
  },
];

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

    const result = {
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

    return result;
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

async function extractNDSHFromImage(imageDataUrl, mimeType) {
  if (!GEMINI_API_KEY) {
    // Server-side config issue; report clearly to client.
    throw new HttpError(500, 'GEMINI_API_KEY тохируулагдаагүй байна.');
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const base64Data = imageDataUrl.split(',')[1] || imageDataUrl;
  const result = await model.generateContent([
    NDSH_SYSTEM_PROMPT,
    NDSH_EXTRACT_PROMPT,
    {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    },
  ]);

  const text = result.response.text();
  if (!text?.trim()) {
    throw new Error('AI хоосон хариу буцаалаа');
  }

  return parseJsonResponse(text);
}

function normalizeBusinessText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function toFieldKey(value) {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/);
  return parts[0].toLowerCase() + parts.slice(1).map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('');
}

function normalizeAliasToken(value) {
  return String(value || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function ensureUniqueFieldName(base, usedNames) {
  const safeBase = base || 'field';
  if (!usedNames.has(safeBase)) {
    usedNames.add(safeBase);
    return safeBase;
  }
  let index = 2;
  while (usedNames.has(`${safeBase}${index}`)) {
    index += 1;
  }
  const unique = `${safeBase}${index}`;
  usedNames.add(unique);
  return unique;
}

function clampConfidence(value, fallback = 0.5) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

function extractPlaceholderField(value) {
  const match = String(value || '').match(/\{\{\s*([^}]+)\s*\}\}/);
  return match ? match[1].trim() : '';
}

function normalizeSuggestedBusinessField(rawField, type = 'text', fallbackIndex = 1) {
  const aliasKey = normalizeAliasToken(rawField);
  const aliasMap = {
    fullname: 'fullName',
    name: 'fullName',
    personname: 'fullName',
    ovognr: 'fullName',
    овогнэр: 'fullName',
    нэровог: 'fullName',
    овог: 'lastName',
    нэр: 'firstName',
    lastname: 'lastName',
    surname: 'lastName',
    firstname: 'firstName',
    givenname: 'firstName',
    middlename: 'middleName',
    organization: 'company',
    org: 'company',
    companyname: 'company',
    компанийннэр: 'company',
    компани: 'company',
    байгууллага: 'company',
    brand: 'company',
    department: 'department',
    хэлтэс: 'department',
    jobtitle: 'position',
    title: 'position',
    role: 'position',
    position: 'position',
    албантушаал: 'position',
    тушаал: 'position',
    telephone: 'phone',
    tel: 'phone',
    phone: 'phone',
    mobile: 'mobilePhone',
    mobilephone: 'mobilePhone',
    гарутас: 'mobilePhone',
    утас: 'phone',
    email: 'email',
    eemail: 'email',
    mail: 'email',
    имэйл: 'email',
    цахимшуудан: 'email',
    website: 'web',
    site: 'web',
    url: 'web',
    web: 'web',
    вэб: 'web',
    веб: 'web',
    location: 'address',
    address: 'address',
    хаяг: 'address',
    slogan: 'tagline',
    moto: 'tagline',
    tagline: 'tagline',
    уриа: 'tagline',
    уриаүг: 'tagline',
    logo: 'logo',
    лого: 'logo',
    brandlogo: 'logo',
    icon: 'icon1',
    image: 'image1',
    avatar: 'avatar',
    photo: 'photo',
    picture: 'photo',
    facebook: 'socialFacebook',
    фэйсбүүк: 'socialFacebook',
    instagram: 'socialInstagram',
    инстаграм: 'socialInstagram',
    linkedin: 'socialLinkedin',
    линкедин: 'socialLinkedin',
    twitter: 'socialX',
    x: 'socialX',
  };

  if (aliasKey && aliasMap[aliasKey]) {
    return aliasMap[aliasKey];
  }

  const normalized = toFieldKey(rawField);
  if (normalized) return normalized;

  if (type === 'image') return `image${fallbackIndex}`;
  return `field${fallbackIndex}`;
}

function looksLikePersonName(text) {
  const words = text.split(' ').filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;
  if (/\d/.test(text)) return false;
  if (!words.every((word) => /^[\p{L}.'-]+$/u.test(word))) return false;

  const uppercaseStartCount = words.filter((word) => {
    const first = word.trim().charAt(0);
    if (!first) return false;
    return first === first.toUpperCase() && first !== first.toLowerCase();
  }).length;

  return uppercaseStartCount >= Math.max(1, words.length - 1);
}

function isLikelyGibberishText(rawText) {
  const text = normalizeBusinessText(rawText);
  if (!text) return true;

  const compact = text.replace(/\s+/g, '');
  if (compact.length <= 2) return false;

  const uniqueChars = new Set(compact.toLowerCase().split(''));
  const alphaNumChars = compact.replace(/[^\p{L}\p{N}]/gu, '');
  const repeatedRun = /(.)\1{4,}/u.test(compact);
  const mostlySingleChar = uniqueChars.size <= 2 && compact.length >= 5;
  const lowSignal = alphaNumChars.length <= 2 && compact.length >= 5;

  return repeatedRun || mostlySingleChar || lowSignal;
}

function guessBusinessCardTextField(rawText) {
  const text = normalizeBusinessText(rawText);
  if (!text) return null;
  const lower = text.toLowerCase();

  const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const phonePattern = /(\+?\d[\d\s().-]{6,}\d)/;
  const urlPattern = /(https?:\/\/|www\.)[^\s]+/i;
  const domainPattern = /\b[a-z0-9-]+\.(com|net|org|mn|io|co|me|dev|ai|app)\b/i;

  if (emailPattern.test(text)) {
    return { field: 'email', confidence: 0.99, reason: 'Email pattern', strength: 'strong' };
  }
  if (phonePattern.test(text)) {
    return { field: 'phone', confidence: 0.95, reason: 'Phone pattern', strength: 'strong' };
  }
  if (urlPattern.test(text) || domainPattern.test(text)) {
    return { field: 'web', confidence: 0.93, reason: 'Website pattern', strength: 'strong' };
  }

  if (lower.includes('facebook') || lower.includes('fb.com') || lower.startsWith('fb/') || lower.includes('фэйсб')) {
    return { field: 'socialFacebook', confidence: 0.92, reason: 'Facebook handle', strength: 'strong' };
  }
  if (lower.includes('instagram') || lower.includes('ig.com') || lower.startsWith('ig/') || lower.includes('инстаграм')) {
    return { field: 'socialInstagram', confidence: 0.92, reason: 'Instagram handle', strength: 'strong' };
  }
  if (lower.includes('linkedin') || lower.includes('lnkd.in') || lower.includes('линкедин')) {
    return { field: 'socialLinkedin', confidence: 0.92, reason: 'LinkedIn handle', strength: 'strong' };
  }
  if (lower.includes('twitter') || lower.includes('x.com') || lower.startsWith('@')) {
    return { field: 'socialX', confidence: 0.86, reason: 'X/Twitter handle', strength: 'strong' };
  }

  const companyKeywords = [
    'llc',
    'inc',
    'ltd',
    'company',
    'group',
    'corp',
    'gmbh',
    'plc',
    'agency',
    'studio',
    'labs',
    'systems',
    'solutions',
    'tech',
    'digital',
    'bank',
    'clinic',
    'xxk',
    'ххк',
    'компани',
    'групп',
    'банк',
    'эмнэлэг',
    'сургууль',
    'байгууллага',
  ];
  if (companyKeywords.some((keyword) => lower.includes(keyword))) {
    return { field: 'company', confidence: 0.82, reason: 'Company keyword', strength: 'medium' };
  }

  const positionKeywords = [
    'ceo',
    'cto',
    'cfo',
    'coo',
    'founder',
    'manager',
    'director',
    'engineer',
    'designer',
    'developer',
    'consultant',
    'specialist',
    'lead',
    'chief',
    'захирал',
    'менежер',
    'мэргэжилтэн',
    'инженер',
    'дизайнер',
    'хөгжүүлэгч',
    'дарга',
    'зөвлөх',
    'ахлах',
  ];
  if (positionKeywords.some((keyword) => lower.includes(keyword))) {
    return { field: 'position', confidence: 0.79, reason: 'Position keyword', strength: 'medium' };
  }

  const addressKeywords = [
    'street',
    'avenue',
    'road',
    'suite',
    'floor',
    'tower',
    'building',
    'district',
    'city',
    'state',
    'zip',
    'хороо',
    'дүүрэг',
    'улаанбаатар',
    'гудамж',
    'байр',
    'давхар',
    'аймаг',
    'сум',
    'хот',
    'тоот',
  ];
  if ((/\d/.test(text) && text.length >= 10) || addressKeywords.some((keyword) => lower.includes(keyword))) {
    return { field: 'address', confidence: 0.74, reason: 'Address pattern', strength: 'medium' };
  }

  if (looksLikePersonName(text)) {
    return { field: 'fullName', confidence: 0.72, reason: 'Name-like text', strength: 'medium' };
  }

  if (text.length >= 20 || text.split(' ').length >= 4) {
    return { field: 'tagline', confidence: 0.58, reason: 'Long phrase', strength: 'weak' };
  }

  return null;
}

function guessBusinessCardImageField(imageNode, index) {
  const source = normalizeBusinessText(`${imageNode.id || ''} ${imageNode.class || ''} ${imageNode.href || ''} ${imageNode.ariaLabel || ''} ${imageNode.title || ''}`);
  const lower = source.toLowerCase();

  if (lower.includes('logo') || lower.includes('brand')) return 'logo';
  if (lower.includes('avatar') || lower.includes('profile')) return 'avatar';
  if (lower.includes('photo') || lower.includes('picture')) return 'photo';
  if (lower.includes('icon')) return `icon${index + 1}`;
  return `image${index + 1}`;
}

function hasFieldLike(fieldSet, expectedField) {
  const pattern = new RegExp(`^${expectedField}\\d+$`);
  return Array.from(fieldSet).some((field) => field === expectedField || pattern.test(field));
}

function evaluateBusinessCardCoverage({ textNodes, textFields, imageFields }) {
  const allFieldNames = new Set([
    ...textFields.map((item) => String(item.field || '').trim()),
    ...imageFields.map((item) => String(item.field || '').trim()),
  ].filter(Boolean));

  const hasName = hasFieldLike(allFieldNames, 'fullName') || (hasFieldLike(allFieldNames, 'firstName') && hasFieldLike(allFieldNames, 'lastName'));
  const hasContact = BUSINESS_CARD_CONTACT_FIELDS.some((field) => hasFieldLike(allFieldNames, field));
  const textCoverage = textNodes.length > 0 ? Math.round((textFields.length / textNodes.length) * 100) : 100;

  const missingRecommendedFields = BUSINESS_CARD_RECOMMENDED_FIELDS.filter((field) => {
    if (field === 'fullName') return !hasName;
    return !hasFieldLike(allFieldNames, field);
  });

  const missingCriticalFields = [];
  if (!hasName) missingCriticalFields.push('fullName');
  if (!hasContact) missingCriticalFields.push('contact');

  const genericFieldCount = textFields.filter((item) => /^field\d+$/i.test(String(item.field || ''))).length;

  let completenessScore = 0;
  if (hasName) completenessScore += 25;
  if (hasContact) completenessScore += 25;
  if (hasFieldLike(allFieldNames, 'company')) completenessScore += 10;
  if (hasFieldLike(allFieldNames, 'position')) completenessScore += 10;
  if (hasFieldLike(allFieldNames, 'phone') || hasFieldLike(allFieldNames, 'mobilePhone')) completenessScore += 8;
  if (hasFieldLike(allFieldNames, 'email')) completenessScore += 8;
  if (hasFieldLike(allFieldNames, 'web')) completenessScore += 5;
  if (hasFieldLike(allFieldNames, 'address')) completenessScore += 4;
  if (hasFieldLike(allFieldNames, 'tagline')) completenessScore += 3;
  if (hasFieldLike(allFieldNames, 'logo')) completenessScore += 2;
  if (textCoverage === 100) completenessScore += 5;
  completenessScore = Math.min(100, Math.max(0, Math.round(completenessScore)));

  const notes = [];
  if (!hasName) notes.push('Name field not confidently detected. Usually fullName (or firstName + lastName) is expected.');
  if (!hasContact) notes.push('No direct contact field detected (phone/email/web/social).');
  if (genericFieldCount > 0) notes.push(`${genericFieldCount} generic field(s) were used (field1, field2...). Rename them in Field Mapping.`);
  if (textCoverage < 100) notes.push(`Only ${textCoverage}% of text nodes were mapped.`);

  return {
    completenessScore,
    textCoverage,
    missingRecommendedFields,
    missingCriticalFields,
    detectedFields: Array.from(allFieldNames).sort(),
    notes,
  };
}

function normalizeBenchmarkField(field) {
  return normalizeSuggestedBusinessField(field, 'text', 1);
}

function equivalentFieldCandidates(field) {
  const normalized = normalizeBenchmarkField(field);
  switch (normalized) {
    case 'phone':
      return new Set(['phone', 'mobilePhone']);
    case 'mobilePhone':
      return new Set(['mobilePhone', 'phone']);
    case 'fullName':
      return new Set(['fullName', 'firstName', 'lastName']);
    case 'firstName':
      return new Set(['firstName', 'fullName']);
    case 'lastName':
      return new Set(['lastName', 'fullName']);
    case 'logo':
      return new Set(['logo', 'brandLogo']);
    default:
      return new Set([normalized]);
  }
}

function areFieldsEquivalent(expectedField, predictedField) {
  if (!expectedField || !predictedField) return false;
  const predictedNormalized = normalizeBenchmarkField(predictedField);
  return equivalentFieldCandidates(expectedField).has(predictedNormalized);
}

function hasEquivalentField(fieldSet, expectedField) {
  return Array.from(fieldSet).some((field) => areFieldsEquivalent(expectedField, field));
}

function toIndexMap(items = []) {
  const map = new Map();
  items.forEach((item) => {
    const index = Number(item?.index);
    if (!Number.isInteger(index) || index < 0) return;
    map.set(index, String(item?.field || '').trim());
  });
  return map;
}

function toComparableExpectedMap(obj = {}) {
  return Object.entries(obj || {}).reduce((acc, [rawIndex, rawField]) => {
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 0) return acc;
    const field = String(rawField || '').trim();
    if (!field) return acc;
    acc[index] = field;
    return acc;
  }, {});
}

function roundMetric(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function summarizeBenchmarkResults(caseResults) {
  const safeCases = Array.isArray(caseResults) ? caseResults : [];
  const totalCases = safeCases.length;
  if (totalCases === 0) {
    return {
      totalCases: 0,
      passRate: 0,
      averageScore: 0,
      averageIndexAccuracy: 0,
      averageRequiredCoverage: 0,
    };
  }

  const passedCases = safeCases.filter((item) => item.status === 'pass').length;
  const sumScore = safeCases.reduce((sum, item) => sum + Number(item.score || 0), 0);
  const sumIndexAccuracy = safeCases.reduce((sum, item) => sum + Number(item.metrics?.indexAccuracy || 0), 0);
  const sumRequiredCoverage = safeCases.reduce((sum, item) => sum + Number(item.metrics?.requiredCoverage || 0), 0);

  return {
    totalCases,
    passRate: roundMetric((passedCases / totalCases) * 100),
    averageScore: roundMetric(sumScore / totalCases),
    averageIndexAccuracy: roundMetric(sumIndexAccuracy / totalCases),
    averageRequiredCoverage: roundMetric(sumRequiredCoverage / totalCases),
  };
}

async function runBusinessCardBenchmarkSuite(params = {}) {
  const requestedCases = Array.isArray(params.cases) ? params.cases : [];
  const suiteCases = requestedCases.length > 0 ? requestedCases : BUSINESS_CARD_BENCHMARK_CASES;
  const caseResults = [];

  for (const testCase of suiteCases) {
    const testId = String(testCase.id || `case_${caseResults.length + 1}`);
    const testName = String(testCase.name || testId);
    const textNodes = normalizeTextDescriptors(testCase.textNodes);
    const imageNodes = normalizeImageDescriptors(testCase.imageNodes);
    const expectedTextByIndex = toComparableExpectedMap(testCase.expected?.textByIndex);
    const expectedImageByIndex = toComparableExpectedMap(testCase.expected?.imageByIndex);
    const requiredFields = Array.isArray(testCase.expected?.requiredFields)
      ? testCase.expected.requiredFields.map((item) => String(item || '').trim()).filter(Boolean)
      : [];

    try {
      const mapped = await mapBusinessCardFieldsWithAI({
        svg: String(testCase.svg || '<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
        textNodes,
        imageNodes,
        referenceImageDataUrl: testCase.referenceImageDataUrl || '',
        referenceImageMimeType: testCase.referenceImageMimeType || 'image/jpeg',
      });

      const predictedTextByIndex = toIndexMap(mapped.textFields);
      const predictedImageByIndex = toIndexMap(mapped.imageFields);
      const expectedPairs = [
        ...Object.entries(expectedTextByIndex).map(([index, field]) => ({ type: 'text', index: Number(index), field })),
        ...Object.entries(expectedImageByIndex).map(([index, field]) => ({ type: 'image', index: Number(index), field })),
      ];

      let matchedPairs = 0;
      const mismatches = [];
      expectedPairs.forEach((pair) => {
        const predicted = pair.type === 'text'
          ? predictedTextByIndex.get(pair.index)
          : predictedImageByIndex.get(pair.index);
        if (areFieldsEquivalent(pair.field, predicted)) {
          matchedPairs += 1;
        } else {
          mismatches.push({
            type: pair.type,
            index: pair.index,
            expected: pair.field,
            predicted: predicted || '',
          });
        }
      });

      const detectedFieldSet = new Set([
        ...mapped.textFields.map((item) => String(item.field || '').trim()),
        ...mapped.imageFields.map((item) => String(item.field || '').trim()),
      ].filter(Boolean));

      const requiredMatched = requiredFields.filter((field) => hasEquivalentField(detectedFieldSet, field)).length;
      const indexAccuracy = expectedPairs.length > 0 ? (matchedPairs / expectedPairs.length) * 100 : 100;
      const requiredCoverage = requiredFields.length > 0 ? (requiredMatched / requiredFields.length) * 100 : 100;
      const auditScore = Number(mapped?.audit?.completenessScore || 0);
      const score = roundMetric((indexAccuracy * 0.6) + (requiredCoverage * 0.3) + (auditScore * 0.1));
      const status = score >= 80 ? 'pass' : (score >= 60 ? 'warn' : 'fail');

      caseResults.push({
        id: testId,
        name: testName,
        status,
        score,
        metrics: {
          indexAccuracy: roundMetric(indexAccuracy),
          requiredCoverage: roundMetric(requiredCoverage),
          auditScore: roundMetric(auditScore),
        },
        expectedCounts: {
          text: Object.keys(expectedTextByIndex).length,
          image: Object.keys(expectedImageByIndex).length,
          required: requiredFields.length,
        },
        mismatches,
        mappedSummary: {
          textFields: mapped.textFields.length,
          imageFields: mapped.imageFields.length,
          mode: mapped.mode || '',
          missingCriticalFields: Array.isArray(mapped?.audit?.missingCriticalFields)
            ? mapped.audit.missingCriticalFields
            : [],
          missingRecommendedFields: Array.isArray(mapped?.audit?.missingRecommendedFields)
            ? mapped.audit.missingRecommendedFields
            : [],
        },
      });
    } catch (error) {
      caseResults.push({
        id: testId,
        name: testName,
        status: 'error',
        score: 0,
        metrics: {
          indexAccuracy: 0,
          requiredCoverage: 0,
          auditScore: 0,
        },
        expectedCounts: {
          text: Object.keys(expectedTextByIndex).length,
          image: Object.keys(expectedImageByIndex).length,
          required: requiredFields.length,
        },
        mismatches: [],
        error: error instanceof Error ? error.message : 'Benchmark case failed',
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: summarizeBenchmarkResults(caseResults),
    cases: caseResults.sort((a, b) => Number(a.score || 0) - Number(b.score || 0)),
  };
}

function normalizeTextDescriptors(textNodes) {
  const byIndex = new Map();
  (Array.isArray(textNodes) ? textNodes : []).forEach((item) => {
    const index = Number(item?.index);
    if (!Number.isInteger(index) || index < 0) return;
    byIndex.set(index, {
      index,
      text: normalizeBusinessText(item?.text),
      fontSize: Number(item?.fontSize || 0),
      x: Number(item?.x || 0),
      y: Number(item?.y || 0),
    });
  });
  return Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
}

function normalizeImageDescriptors(imageNodes) {
  const byIndex = new Map();
  (Array.isArray(imageNodes) ? imageNodes : []).forEach((item) => {
    const index = Number(item?.index);
    if (!Number.isInteger(index) || index < 0) return;
    byIndex.set(index, {
      index,
      id: normalizeBusinessText(item?.id),
      class: normalizeBusinessText(item?.class),
      href: normalizeBusinessText(item?.href),
      ariaLabel: normalizeBusinessText(item?.ariaLabel),
      title: normalizeBusinessText(item?.title),
    });
  });
  return Array.from(byIndex.values()).sort((a, b) => a.index - b.index);
}

function normalizeBusinessCardMap(data) {
  const normalized = {
    textFields: [],
    imageFields: [],
    audit: {
      missingRecommendedFields: [],
      notes: [],
    },
  };

  if (data && Array.isArray(data.textFields)) {
    normalized.textFields = data.textFields
      .map((item) => ({
        index: Number(item?.index),
        field: String(item?.field || '').trim(),
        confidence: clampConfidence(item?.confidence, 0.5),
        reason: String(item?.reason || '').trim(),
      }))
      .filter((item) => Number.isInteger(item.index) && item.index >= 0 && item.field);
  }

  if (data && Array.isArray(data.imageFields)) {
    normalized.imageFields = data.imageFields
      .map((item) => ({
        index: Number(item?.index),
        field: String(item?.field || '').trim(),
        confidence: clampConfidence(item?.confidence, 0.7),
        reason: String(item?.reason || '').trim(),
      }))
      .filter((item) => Number.isInteger(item.index) && item.index >= 0 && item.field);
  }

  if (data && data.audit && typeof data.audit === 'object') {
    normalized.audit = {
      missingRecommendedFields: Array.isArray(data.audit.missingRecommendedFields)
        ? data.audit.missingRecommendedFields.map((item) => String(item || '').trim()).filter(Boolean)
        : [],
      notes: Array.isArray(data.audit.notes)
        ? data.audit.notes.map((item) => String(item || '').trim()).filter(Boolean)
        : [],
    };
  }

  return normalized;
}

async function mapBusinessCardFieldsWithAI(params) {
  const payload = {
    svg: String(params.svg || ''),
    textNodes: normalizeTextDescriptors(params.textNodes),
    imageNodes: normalizeImageDescriptors(params.imageNodes),
  };

  let aiMap = normalizeBusinessCardMap(null);
  let mode = 'heuristic';
  const runtimeNotes = [];

  if (GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

      const contentParts = [
        BUSINESS_CARD_MAP_SYSTEM_PROMPT,
        BUSINESS_CARD_MAP_USER_PROMPT,
        JSON.stringify(payload),
      ];

      if (params.referenceImageDataUrl) {
        const base64Data = String(params.referenceImageDataUrl).split(',')[1] || '';
        if (base64Data) {
          contentParts.push({
            inlineData: {
              data: base64Data,
              mimeType: params.referenceImageMimeType || 'image/jpeg',
            },
          });
        }
      }

      const result = await model.generateContent(contentParts);
      const text = result?.response?.text?.() || '';
      if (!text.trim()) {
        runtimeNotes.push('AI хоосон хариу буцаалаа. Heuristic mapping ашиглалаа.');
      } else {
        const parsed = JSON.parse(cleanJsonResponse(text));
        aiMap = normalizeBusinessCardMap(parsed);
      }
    } catch (error) {
      runtimeNotes.push(`AI mapping fallback ашиглав: ${error instanceof Error ? error.message : 'Unknown AI error'}`);
    }
  } else {
    runtimeNotes.push('GEMINI_API_KEY байхгүй тул heuristic mapping ашиглав.');
  }

  const aiTextByIndex = new Map(aiMap.textFields.map((item) => [item.index, item]));
  const aiImageByIndex = new Map(aiMap.imageFields.map((item) => [item.index, item]));
  if (aiMap.textFields.length > 0 || aiMap.imageFields.length > 0) {
    const aiCompleteForInputs = aiMap.textFields.length >= payload.textNodes.length && aiMap.imageFields.length >= payload.imageNodes.length;
    mode = aiCompleteForInputs ? 'ai' : 'ai_hybrid';
  }

  const usedFieldNames = new Set();
  let gibberishOverrides = 0;
  const semanticTextFields = new Set([
    'fullName',
    'firstName',
    'lastName',
    'company',
    'department',
    'position',
    'phone',
    'mobilePhone',
    'email',
    'web',
    'address',
    'tagline',
    'socialFacebook',
    'socialInstagram',
    'socialLinkedin',
    'socialX',
  ]);

  const textFields = payload.textNodes.map((node, position) => {
    const existingPlaceholderField = extractPlaceholderField(node.text);
    const aiSuggestion = aiTextByIndex.get(node.index);
    const heuristicGuess = guessBusinessCardTextField(node.text);

    const heuristicField = normalizeSuggestedBusinessField(heuristicGuess?.field || '', 'text', position + 1);
    const aiField = normalizeSuggestedBusinessField(aiSuggestion?.field || '', 'text', position + 1);
    const aiConfidence = clampConfidence(aiSuggestion?.confidence, 0.6);

    let selectedField = '';
    let selectedConfidence = 0.45;
    let selectedReason = 'Fallback generated field';

    if (existingPlaceholderField) {
      selectedField = normalizeSuggestedBusinessField(existingPlaceholderField, 'text', position + 1);
      selectedConfidence = 1;
      selectedReason = 'Existing placeholder';
    } else if (aiSuggestion && aiField) {
      const aiIsGeneric = /^field\d+$/i.test(aiField);
      const heuristicIsStrong = heuristicGuess?.strength === 'strong';
      const heuristicIsContact = BUSINESS_CARD_CONTACT_FIELDS.includes(heuristicField);
      const shouldPreferHeuristic = Boolean(
        heuristicGuess
        && (
          aiIsGeneric
          || aiConfidence < 0.55
          || (heuristicIsStrong && heuristicIsContact && aiField !== heuristicField)
        )
      );

      if (shouldPreferHeuristic) {
        selectedField = heuristicField;
        selectedConfidence = clampConfidence(heuristicGuess?.confidence, 0.8);
        selectedReason = `${heuristicGuess?.reason || 'Pattern-based mapping'} (heuristic override)`;
      } else {
        selectedField = aiField;
        selectedConfidence = aiConfidence;
        selectedReason = normalizeBusinessText(aiSuggestion.reason) || 'Vision AI mapping';
      }
    } else if (heuristicGuess) {
      selectedField = heuristicField;
      selectedConfidence = clampConfidence(heuristicGuess.confidence, 0.7);
      selectedReason = `${heuristicGuess.reason} (heuristic)`;
    } else {
      selectedField = normalizeSuggestedBusinessField('', 'text', position + 1);
      selectedConfidence = 0.35;
      selectedReason = 'Fallback generated field';
    }

    if (!existingPlaceholderField && isLikelyGibberishText(node.text)) {
      const isSemanticAssignment = semanticTextFields.has(selectedField) && !/^field\d+$/i.test(selectedField);
      if (isSemanticAssignment) {
        selectedField = normalizeSuggestedBusinessField('', 'text', position + 1);
        selectedReason = `${selectedReason}; low-signal text forced to generic field`;
      } else {
        selectedReason = `${selectedReason}; low-signal text`;
      }
      selectedConfidence = Math.min(selectedConfidence, 0.35);
      gibberishOverrides += 1;
    }

    if (BUSINESS_CARD_UNIQUE_FIELDS.has(selectedField) && usedFieldNames.has(selectedField)) {
      const uniqueField = ensureUniqueFieldName(selectedField, usedFieldNames);
      selectedReason = `${selectedReason}; duplicate renamed`;
      selectedField = uniqueField;
    } else if (!usedFieldNames.has(selectedField)) {
      usedFieldNames.add(selectedField);
    }

    return {
      index: node.index,
      field: selectedField,
      confidence: clampConfidence(selectedConfidence, 0.5),
      reason: selectedReason,
    };
  }).sort((a, b) => a.index - b.index);

  if (gibberishOverrides > 0) {
    runtimeNotes.push(`${gibberishOverrides} low-signal text node(s) were mapped to generic fields.`);
  }

  const imageFields = payload.imageNodes.map((node, position) => {
    const existingPlaceholderField = extractPlaceholderField(node.href);
    const aiSuggestion = aiImageByIndex.get(node.index);
    const guessedField = guessBusinessCardImageField(node, position);

    let selectedField = '';
    let selectedConfidence = 0.8;
    let selectedReason = 'Heuristic image mapping';

    if (existingPlaceholderField) {
      selectedField = normalizeSuggestedBusinessField(existingPlaceholderField, 'image', position + 1);
      selectedConfidence = 1;
      selectedReason = 'Existing placeholder';
    } else if (aiSuggestion?.field) {
      selectedField = normalizeSuggestedBusinessField(aiSuggestion.field, 'image', position + 1);
      selectedConfidence = clampConfidence(aiSuggestion.confidence, 0.9);
      selectedReason = normalizeBusinessText(aiSuggestion.reason) || 'Vision AI mapping';
    } else {
      selectedField = normalizeSuggestedBusinessField(guessedField, 'image', position + 1);
      selectedConfidence = 0.85;
      selectedReason = 'Heuristic image mapping';
    }

    if (usedFieldNames.has(selectedField)) {
      selectedField = ensureUniqueFieldName(selectedField, usedFieldNames);
      selectedReason = `${selectedReason}; duplicate renamed`;
    } else {
      usedFieldNames.add(selectedField);
    }

    return {
      index: node.index,
      field: selectedField,
      confidence: clampConfidence(selectedConfidence, 0.8),
      reason: selectedReason,
    };
  }).sort((a, b) => a.index - b.index);

  const localAudit = evaluateBusinessCardCoverage({
    textNodes: payload.textNodes,
    textFields,
    imageFields,
  });

  const mergedMissingRecommended = Array.from(new Set([
    ...localAudit.missingRecommendedFields,
    ...aiMap.audit.missingRecommendedFields,
  ]));
  const mergedNotes = Array.from(new Set([
    ...runtimeNotes,
    ...localAudit.notes,
    ...aiMap.audit.notes,
  ]));

  return {
    textFields,
    imageFields,
    mode,
    audit: {
      ...localAudit,
      missingRecommendedFields: mergedMissingRecommended,
      notes: mergedNotes,
    },
  };
}

const LETTER_GENERATE_PROMPT = `Чи бол мэргэжлийн албан бичиг төлөвлөгч AI. 
Өгөгдсөн мэдээлэл дээр тулгуурлан Монгол улсын албан хэрэг хөтлөлтийн стандартын дагуу албан бичгийн агуулгыг (текстийг) боловсруулна уу.

ЗААВАЛ БАРИМТЛАХ ДҮРЭМ:
1. Зөвхөн албан бичгийн гол агуулгын текстийг буцаа.
2. Гарчиг, огноо, хаяг зэрэг мэдээллийг текст дотор давтаж бичих шаардлагагүй (эдгээр нь бланканд байгаа).
3. Найруулга нь албан ёсны, тодорхой, товч байх ёстой.
4. Хэрэв мэдээлэл дутуу бол ерөнхий загвар ашиглаж, хэрэглэгч нөхөж бичих боломжтойгоор [] хаалтанд тэмдэглэ.
5. Зөвхөн цэвэр текст буцаа, ямар нэгэн тайлбар эсвэл Markdown тэмдэглэгээ (жишээ нь: ''' эсвэл #) бүү ашигла.`;

const CONTRACT_VARIABLE_MAP_SYSTEM_PROMPT = `You are a strict contract variable extraction engine.
Read Mongolian or English contract content and produce variable configuration for form generation.

OUTPUT RULES:
1) Return ONLY valid JSON.
2) Keep HTML tags and structure intact as much as possible.
3) Replace dynamic values with placeholders like {{тал_а_нэр}} inside updatedContent.
4) Use concise Mongolian keys for placeholders/variables (Cyrillic allowed), prefer underscore style (example: тал_а_нэр).
5) Variables schema:
   - key: string (Mongolian key, Cyrillic allowed, no spaces)
   - label: string (Mongolian user-facing label)
   - type: one of text|textarea|date|number|select|radio
   - options: string (comma-separated options only for select/radio, else empty)
   - format: string (number: currency|integer, date: long, else empty)
6) Do NOT output markdown or explanations outside JSON.
7) Keep variable count practical (usually 4-30).
8) Also provide replacements array:
   - sourceText: exact literal text from original content
   - key: variable key to replace that literal
9) Ensure every variable key appears at least once in updatedContent as {{key}} if mappable.
10) In approval/signature blocks (e.g., "БАТЛАВ"), organization names, person names, roles/titles (e.g., "Гүйцэтгэх захирал"), numbers and dates are dynamic and must be placeholders.`;

const CONTRACT_VARIABLE_MAP_USER_PROMPT = `Analyze contract content and infer form variables.
Prefer converting clearly dynamic entities into placeholders:
- names, organizations, registration numbers, dates, amounts, addresses, account info, roles, terms
- yes/no options for clauses can be select/radio where appropriate
- In approval/signature blocks, do not keep names/titles static text.

Return JSON shape:
{
  "updatedContent": "<html string with {{placeholders}}>",
  "variables": [
    { "key":"тал_а_нэр", "label":"Тал А нэр", "type":"text", "options":"", "format":"" }
  ],
  "replacements": [
    { "sourceText":"Тал А ХХК", "key":"тал_а_нэр" }
  ],
  "notes": ["optional short notes"]
}`;

const CONTRACT_VARIABLE_MAP_RETRY_PROMPT = `Analyze contract content and infer variables and replacements.
Return ONLY valid JSON in this shape:
{
  "variables": [
    { "key":"тал_а_нэр", "label":"Тал А нэр", "type":"text", "options":"", "format":"" }
  ],
  "replacements": [
    { "sourceText":"Тал А ХХК", "key":"тал_а_нэр" }
  ],
  "notes": ["optional short notes"]
}

IMPORTANT:
- Do not include updatedContent in this retry response.
- Keep JSON compact and valid.`;

const CONTRACT_SUPPORTED_FIELD_TYPES = new Set(['text', 'textarea', 'date', 'number', 'select', 'radio']);

function containsCyrillic(value) {
  return /[\u0400-\u04FF]/.test(String(value || ''));
}

function containsLatin(value) {
  return /[A-Za-z]/.test(String(value || ''));
}

function toContractFieldKey(value) {
  return String(value || '')
    .replace(/\{\{|\}\}/g, '')
    .trim()
    .replace(/[^\p{L}\p{N}_\s]+/gu, ' ')
    .replace(/[_\s]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeContractPlaceholdersInContent(content) {
  return String(content || '').replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, rawKey) => {
    const key = toContractFieldKey(rawKey);
    if (!key) return match;
    return `{{${key}}}`;
  });
}

function extractContractPlaceholderKeys(content) {
  const regex = /\{\{\s*([^}]+)\s*\}\}/g;
  const source = String(content || '');
  const keys = [];
  const seen = new Set();
  let match;
  while ((match = regex.exec(source)) !== null) {
    const key = toContractFieldKey(String(match[1] || '').trim());
    if (!key || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

function humanizeContractFieldKey(key) {
  return String(key || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function normalizeContractVariableType(type) {
  const raw = String(type || '').trim().toLowerCase();
  if (CONTRACT_SUPPORTED_FIELD_TYPES.has(raw)) return raw;
  if (raw === 'currency' || raw === 'money' || raw === 'amount') return 'number';
  if (raw === 'dropdown') return 'select';
  return 'text';
}

function normalizeContractVariableFormat(type, format) {
  const normalizedType = normalizeContractVariableType(type);
  const raw = String(format || '').trim().toLowerCase();
  if (normalizedType === 'number') {
    return raw === 'integer' ? 'integer' : (raw === 'currency' ? 'currency' : '');
  }
  if (normalizedType === 'date') {
    return raw === 'long' ? 'long' : '';
  }
  return '';
}

function normalizeContractVariableOptions(type, options) {
  const normalizedType = normalizeContractVariableType(type);
  if (normalizedType !== 'select' && normalizedType !== 'radio') return '';
  if (Array.isArray(options)) {
    return options.map((item) => normalizeBusinessText(item)).filter(Boolean).join(', ');
  }
  if (typeof options === 'string') {
    return options
      .split(',')
      .map((item) => normalizeBusinessText(item))
      .filter(Boolean)
      .join(', ');
  }
  return '';
}

function normalizeContractVariableList(rawVariables, existingVariables = []) {
  const existingByKey = new Map(
    (Array.isArray(existingVariables) ? existingVariables : [])
      .map((item) => {
        const key = toContractFieldKey(item?.key || '');
        if (!key) return null;
        return [key, item];
      })
      .filter(Boolean)
  );

  const usedKeys = new Set();
  const normalized = [];

  (Array.isArray(rawVariables) ? rawVariables : []).forEach((item, index) => {
    const label = normalizeBusinessText(item?.label || '');
    const rawKey = toContractFieldKey(item?.key || item?.field || item?.name || '');
    const labelKey = toContractFieldKey(label);
    const hasMixedScript = containsCyrillic(rawKey) && containsLatin(rawKey);
    const preferLabelKey = labelKey && containsCyrillic(labelKey) && (
      !containsCyrillic(rawKey) || hasMixedScript
    );
    const baseKey = preferLabelKey ? labelKey : (rawKey || labelKey || `хувьсагч_${index + 1}`);
    const key = ensureUniqueFieldName(baseKey, usedKeys);
    const existing = existingByKey.get(key) || {};
    const type = normalizeContractVariableType(item?.type || existing.type || 'text');

    normalized.push({
      key,
      label: normalizeBusinessText(label || existing.label || humanizeContractFieldKey(key)),
      type,
      options: normalizeContractVariableOptions(type, item?.options ?? existing.options ?? ''),
      format: normalizeContractVariableFormat(type, item?.format ?? existing.format ?? ''),
    });
  });

  return normalized;
}

function buildContractPlaceholderToken(key) {
  const normalized = toContractFieldKey(key);
  return normalized ? `{{${normalized}}}` : '';
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceFirstContractTextOccurrence(content, sourceText, replacement) {
  const input = String(content || '');
  const needle = String(sourceText || '');
  if (!input || !needle) return { content: input, replaced: false };

  const directIndex = input.indexOf(needle);
  if (directIndex !== -1) {
    return {
      content: input.slice(0, directIndex) + replacement + input.slice(directIndex + needle.length),
      replaced: true,
    };
  }

  const escapedNeedle = escapeRegExp(needle);
  if (!escapedNeedle) return { content: input, replaced: false };
  const regex = new RegExp(escapedNeedle, 'i');
  const match = regex.exec(input);
  if (!match) return { content: input, replaced: false };

  const start = match.index;
  const end = start + match[0].length;
  return {
    content: input.slice(0, start) + replacement + input.slice(end),
    replaced: true,
  };
}

function normalizeContractReplacementList(rawReplacements, allowedKeys = []) {
  const allowed = new Set(
    (Array.isArray(allowedKeys) ? allowedKeys : [])
      .map((item) => toContractFieldKey(item))
      .filter(Boolean)
  );

  const seen = new Set();
  const normalized = [];
  (Array.isArray(rawReplacements) ? rawReplacements : []).forEach((item) => {
    const key = toContractFieldKey(item?.key || item?.placeholder || item?.field || '');
    const sourceText = normalizeBusinessText(
      item?.sourceText || item?.source || item?.match || item?.value || ''
    );
    if (!key || !sourceText) return;
    if (allowed.size > 0 && !allowed.has(key)) return;
    const signature = `${key}::${sourceText.toLowerCase()}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    normalized.push({ key, sourceText });
  });
  return normalized;
}

function applyContractPlaceholderReplacements(contentHtml, replacements) {
  let nextContent = normalizeContractPlaceholdersInContent(contentHtml);
  const replacedKeys = new Set();

  (Array.isArray(replacements) ? replacements : []).forEach((item) => {
    const key = toContractFieldKey(item?.key || '');
    const sourceText = normalizeBusinessText(item?.sourceText || '');
    if (!key || !sourceText) return;

    const placeholder = buildContractPlaceholderToken(key);
    if (!placeholder) return;
    if (nextContent.includes(placeholder)) {
      replacedKeys.add(key);
      return;
    }

    const applied = replaceFirstContractTextOccurrence(nextContent, sourceText, placeholder);
    if (!applied.replaced) return;
    nextContent = applied.content;
    replacedKeys.add(key);
  });

  return {
    content: nextContent,
    replacedKeys: Array.from(replacedKeys),
  };
}

function buildContractReplacementsFromVariables(rawVariables) {
  const replacements = [];
  (Array.isArray(rawVariables) ? rawVariables : []).forEach((item) => {
    const key = toContractFieldKey(item?.key || item?.field || item?.name || item?.label || '');
    const sourceText = normalizeBusinessText(
      item?.sourceText || item?.source || item?.example || item?.currentValue || item?.value || ''
    );
    if (!key || !sourceText) return;
    replacements.push({ key, sourceText });
  });
  return replacements;
}

function replaceFirstContractRegex(content, regex, buildReplacement) {
  const input = String(content || '');
  let replaced = false;
  const output = input.replace(regex, (...args) => {
    if (replaced) return args[0];
    const next = buildReplacement(...args);
    if (typeof next !== 'string' || !next) return args[0];
    replaced = true;
    return next;
  });
  return { content: output, replaced };
}

function applyContractLabelBasedFallback(contentHtml, variables = []) {
  let nextContent = normalizeContractPlaceholdersInContent(contentHtml);
  const replacedKeys = new Set();

  (Array.isArray(variables) ? variables : []).forEach((item) => {
    const key = toContractFieldKey(item?.key || '');
    if (!key) return;

    const placeholder = buildContractPlaceholderToken(key);
    if (!placeholder) return;
    if (nextContent.includes(placeholder)) {
      replacedKeys.add(key);
      return;
    }

    const labelCandidates = Array.from(new Set([
      normalizeBusinessText(item?.label || ''),
      normalizeBusinessText(humanizeContractFieldKey(key)),
      normalizeBusinessText(key.replace(/_/g, ' ')),
    ].filter(Boolean)));

    let replaced = false;
    for (const label of labelCandidates) {
      if (label.length < 2) continue;
      const escapedLabel = escapeRegExp(label);
      if (!escapedLabel) continue;

      const colonPattern = new RegExp(`(${escapedLabel}\\s*[:：]\\s*)([^<\\n]{1,240})`, 'i');
      const colonApplied = replaceFirstContractRegex(nextContent, colonPattern, (match, prefix, value) => {
        const valueText = normalizeBusinessText(value);
        if (!valueText || /\{\{[^}]+\}\}/.test(valueText)) return '';
        return `${prefix}${placeholder}`;
      });
      if (colonApplied.replaced) {
        nextContent = colonApplied.content;
        replaced = true;
        break;
      }

      const tablePattern = new RegExp(
        `(<td[^>]*>\\s*${escapedLabel}\\s*<\\/td>\\s*<td[^>]*>)([^<]*)(<\\/td>)`,
        'i'
      );
      const tableApplied = replaceFirstContractRegex(nextContent, tablePattern, (match, start, value, end) => {
        const valueText = normalizeBusinessText(value);
        if (!valueText || /\{\{[^}]+\}\}/.test(valueText)) return '';
        return `${start}${placeholder}${end}`;
      });
      if (tableApplied.replaced) {
        nextContent = tableApplied.content;
        replaced = true;
        break;
      }

      const inlinePattern = new RegExp(`(${escapedLabel}\\s+)([^<\\n]{2,240})`, 'i');
      const inlineApplied = replaceFirstContractRegex(nextContent, inlinePattern, (match, prefix, value) => {
        const valueText = normalizeBusinessText(value);
        if (!valueText || /\{\{[^}]+\}\}/.test(valueText)) return '';
        if (/^[_/\-.\s]+$/u.test(valueText)) return '';
        return `${prefix}${placeholder}`;
      });
      if (inlineApplied.replaced) {
        nextContent = inlineApplied.content;
        replaced = true;
        break;
      }
    }

    if (replaced) {
      replacedKeys.add(key);
    }
  });

  return {
    content: nextContent,
    replacedKeys: Array.from(replacedKeys),
  };
}

function applyContractStructuralFallback(contentHtml, variables = []) {
  let nextContent = normalizeContractPlaceholdersInContent(contentHtml);
  const replacedKeys = new Set();

  (Array.isArray(variables) ? variables : []).forEach((item) => {
    const key = toContractFieldKey(item?.key || '');
    if (!key) return;
    const placeholder = buildContractPlaceholderToken(key);
    if (!placeholder) return;
    if (nextContent.includes(placeholder)) {
      replacedKeys.add(key);
      return;
    }

    const label = normalizeBusinessText(item?.label || '').toLowerCase();
    const keyLower = key.toLowerCase();
    const isSignature = keyLower.includes('гарын_үсэг') || label.includes('гарын үсэг');
    const isDate = item?.type === 'date' || keyLower.includes('огноо') || label.includes('огноо');
    const isNumber = keyLower.includes('дугаар') || label.includes('дугаар');

    if (isSignature) {
      const signaturePattern = /\/\s*[_-]{4,}\s*\/|[_-]{8,}/i;
      const applied = replaceFirstContractRegex(nextContent, signaturePattern, () => placeholder);
      if (applied.replaced) {
        nextContent = applied.content;
        replacedKeys.add(key);
        return;
      }
    }

    if (isNumber) {
      const numberPattern = /(№\s*)([A-Za-zА-Яа-яӨөҮүЁё0-9/. -]{2,80})/i;
      const applied = replaceFirstContractRegex(nextContent, numberPattern, (match, prefix, value) => {
        const valueText = normalizeBusinessText(value);
        if (!valueText || /\{\{[^}]+\}\}/.test(valueText)) return '';
        return `${prefix}${placeholder}`;
      });
      if (applied.replaced) {
        nextContent = applied.content;
        replacedKeys.add(key);
        return;
      }
    }

    if (isDate) {
      const datePattern = /\b\d{4}[./-]\d{1,2}[./-]\d{1,2}\b/i;
      const applied = replaceFirstContractRegex(nextContent, datePattern, () => placeholder);
      if (applied.replaced) {
        nextContent = applied.content;
        replacedKeys.add(key);
      }
    }
  });

  return {
    content: nextContent,
    replacedKeys: Array.from(replacedKeys),
  };
}

function buildContractVariableFallback(contentHtml, existingVariables = [], reason = '') {
  const normalizedContent = normalizeContractPlaceholdersInContent(contentHtml);
  const placeholderKeys = extractContractPlaceholderKeys(normalizedContent);
  const baseline = placeholderKeys.map((key) => ({ key }));
  const variables = normalizeContractVariableList(
    baseline.length > 0 ? baseline : existingVariables,
    existingVariables
  );
  const notes = [];
  if (reason) notes.push(reason);
  return {
    updatedContent: normalizedContent,
    variables,
    notes,
  };
}

function normalizeContractVariableMap(data, contentHtml, existingVariables = []) {
  const originalContent = normalizeContractPlaceholdersInContent(contentHtml);
  const aiContent = normalizeBusinessText(data?.updatedContent)
    ? normalizeContractPlaceholdersInContent(data.updatedContent)
    : originalContent;

  const aiVariables = normalizeContractVariableList(data?.variables, existingVariables);
  const aiVariableKeys = aiVariables.map((item) => toContractFieldKey(item?.key || '')).filter(Boolean);
  const variableDerivedReplacements = buildContractReplacementsFromVariables(data?.variables);
  const replacements = normalizeContractReplacementList(
    [...(Array.isArray(data?.replacements) ? data.replacements : []), ...variableDerivedReplacements],
    aiVariableKeys
  );
  const aiPlaceholderKeys = extractContractPlaceholderKeys(aiContent);

  let nextContent = aiContent;
  if (aiPlaceholderKeys.length === 0 && replacements.length > 0) {
    // If AI did not inject placeholders directly, apply deterministic replacements on original text.
    nextContent = originalContent;
  }
  if (replacements.length > 0) {
    const applied = applyContractPlaceholderReplacements(nextContent, replacements);
    nextContent = applied.content;
  }

  let placeholderSet = new Set(extractContractPlaceholderKeys(nextContent));
  let missingVariables = aiVariables.filter((item) => !placeholderSet.has(item.key));

  if (missingVariables.length > 0) {
    const labelFallback = applyContractLabelBasedFallback(nextContent, missingVariables);
    if (labelFallback.replacedKeys.length > 0) {
      nextContent = labelFallback.content;
      placeholderSet = new Set(extractContractPlaceholderKeys(nextContent));
      missingVariables = aiVariables.filter((item) => !placeholderSet.has(item.key));
    }
  }

  if (missingVariables.length > 0) {
    const structuralFallback = applyContractStructuralFallback(nextContent, missingVariables);
    if (structuralFallback.replacedKeys.length > 0) {
      nextContent = structuralFallback.content;
    }
  }

  const placeholderKeys = extractContractPlaceholderKeys(nextContent);
  const finalPlaceholderSet = new Set(placeholderKeys);

  const variablesSource = placeholderKeys.length > 0
    ? placeholderKeys.map((key) => ({ key }))
    : (aiVariables.length > 0 ? aiVariables : existingVariables);
  const variables = normalizeContractVariableList(
    variablesSource,
    [...existingVariables, ...aiVariables]
  );

  const missingAiKeys = aiVariableKeys.filter((key) => !finalPlaceholderSet.has(key));
  const notes = Array.isArray(data?.notes)
    ? data.notes.map((item) => normalizeBusinessText(item)).filter(Boolean)
    : [];
  if (missingAiKeys.length > 0 && placeholderKeys.length > 0) {
    notes.push(`Дараах хувьсагч контент дотор автоматаар ороогүй тул алгасав: ${missingAiKeys.join(', ')}`);
  }

  return {
    updatedContent: nextContent,
    variables,
    notes: Array.from(new Set(notes)),
  };
}

async function requestContractVariableMapJson(genAI, payload, retryMode = false) {
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: retryMode ? 0 : 0.1,
    },
  });

  const prompt = retryMode ? CONTRACT_VARIABLE_MAP_RETRY_PROMPT : CONTRACT_VARIABLE_MAP_USER_PROMPT;
  const result = await model.generateContent([
    CONTRACT_VARIABLE_MAP_SYSTEM_PROMPT,
    prompt,
    JSON.stringify(payload),
  ]);
  return result?.response?.text?.() || '';
}

async function mapContractVariablesWithAI(params) {
  const contentHtml = String(params?.content || '');
  const existingVariables = Array.isArray(params?.existingVariables) ? params.existingVariables : [];
  const fallback = buildContractVariableFallback(contentHtml, existingVariables);

  if (!contentHtml.trim()) {
    return {
      ...fallback,
      notes: [...fallback.notes, 'Гэрээний агуулга хоосон байна.'],
      mode: 'fallback_empty',
    };
  }

  if (!GEMINI_API_KEY) {
    return {
      ...fallback,
      notes: [...fallback.notes, 'GEMINI_API_KEY байхгүй тул AI analyze алгаслаа.'],
      mode: 'fallback_no_api_key',
    };
  }

  const payload = {
    content: contentHtml,
    existingVariables: existingVariables.map((item) => ({
      key: toContractFieldKey(item?.key || ''),
      label: normalizeBusinessText(item?.label || ''),
      type: normalizeContractVariableType(item?.type),
      options: normalizeContractVariableOptions(item?.type, item?.options),
      format: normalizeContractVariableFormat(item?.type, item?.format),
    })),
  };

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const text = await requestContractVariableMapJson(genAI, payload, false);
    if (!text.trim()) {
      return {
        ...fallback,
        notes: [...fallback.notes, 'AI хоосон хариу буцаалаа.'],
        mode: 'fallback_empty_response',
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(cleanJsonResponse(text));
    } catch (parseError) {
      const retryText = await requestContractVariableMapJson(genAI, payload, true);
      if (!retryText.trim()) {
        return {
          ...fallback,
          notes: [
            ...fallback.notes,
            `AI JSON parse алдаа гарлаа: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`,
          ],
          mode: 'fallback_parse_error',
        };
      }

      parsed = JSON.parse(cleanJsonResponse(retryText));
      parsed = {
        ...parsed,
        notes: [
          ...(Array.isArray(parsed?.notes) ? parsed.notes : []),
          'AI parse retry mode ашиглав.',
        ],
      };
    }

    const normalized = normalizeContractVariableMap(parsed, contentHtml, existingVariables);
    const notes = [...new Set([
      ...(normalized.notes || []),
      ...(normalized.variables.length === 0 ? ['AI хувьсагч илрүүлээгүй тул fallback хэрэглэв.'] : []),
    ])];

    if (normalized.variables.length === 0) {
      return {
        ...fallback,
        notes,
        mode: 'fallback_no_variables',
      };
    }

    return {
      ...normalized,
      notes,
      mode: 'ai',
    };
  } catch (error) {
    return {
      ...fallback,
      notes: [
        ...fallback.notes,
        `AI analyze fallback хэрэглэв: ${error instanceof Error ? error.message : 'Unknown AI error'}`,
      ],
      mode: 'fallback_error',
    };
  }
}

async function generateLetterAI(params) {
  if (!GEMINI_API_KEY) {
    throw new HttpError(500, 'GEMINI_API_KEY тохируулагдаагүй байна.');
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

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

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/qpay/health') {
    jsonResponse(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/qpay/invoice') {
    try {
      const body = await readJson(req);
      const invoice = await createInvoice({
        amount: body.amount,
        description: body.description,
      });
      jsonResponse(res, 200, invoice);
    } catch (err) {
      const status = err && typeof err === 'object' && 'status' in err ? Number(err.status) : 500;
      jsonResponse(res, Number.isFinite(status) ? status : 500, {
        error: err instanceof Error ? err.message : 'Server error',
      });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/qpay/check') {
    try {
      const body = await readJson(req);
      if (!body.invoice_id) {
        jsonResponse(res, 400, { error: 'invoice_id шаардлагатай' });
        return;
      }
      const result = await checkInvoicePayment(body.invoice_id);
      let grantToken = null;
      if (result.paid) {
        grantToken = issueGrantForInvoice(body.invoice_id);
      }
      jsonResponse(res, 200, { paid: result.paid, grantToken });
    } catch (err) {
      const status = err && typeof err === 'object' && 'status' in err ? Number(err.status) : 500;
      jsonResponse(res, Number.isFinite(status) ? status : 500, {
        error: err instanceof Error ? err.message : 'Server error',
      });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/qpay/callback') {
    try {
      const body = await readJson(req);
      const invoiceId = body.invoice_id || body.object_id || body.invoiceId || body.invoiceId;
      if (!invoiceId) {
        jsonResponse(res, 400, { error: 'invoice_id шаардлагатай' });
        return;
      }
      const result = await checkInvoicePayment(invoiceId);
      if (result.paid) {
        issueGrantForInvoice(invoiceId);
      }
      jsonResponse(res, 200, { ok: true, paid: result.paid });
    } catch (err) {
      jsonResponse(res, 500, { error: err instanceof Error ? err.message : 'Server error' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/credits/consume') {
    try {
      const body = await readJson(req);
      const userId = resolveUserId(req, body);
      if (!userId) {
        jsonResponse(res, 401, { error: 'Нэвтэрсэн хэрэглэгч шаардлагатай' });
        return;
      }
      if (!body.toolKey) {
        jsonResponse(res, 400, { error: 'toolKey шаардлагатай' });
        return;
      }

      const creditCost = Number(body.creditCost || 1);
      if (!Number.isFinite(creditCost) || creditCost <= 0) {
        jsonResponse(res, 400, { error: 'Credits үнэ тохируулаагүй байна' });
        return;
      }

      const store = readStore();
      const storedBalance = Number(store.credits?.[userId]?.balance || 0);
      const incomingBalance = Number(body.currentBalance);
      const currentBalance = Number.isFinite(incomingBalance) && !store.credits?.[userId]
        ? incomingBalance
        : storedBalance;

      if (currentBalance < creditCost) {
        jsonResponse(res, 400, { error: 'Credits хүрэлцэхгүй байна' });
        return;
      }

      const nextBalance = currentBalance - creditCost;
      const grantToken = crypto.randomUUID();
      store.credits[userId] = {
        balance: nextBalance,
        updatedAt: new Date().toISOString(),
      };
      store.grants[grantToken] = {
        userId,
        toolKey: body.toolKey,
        remainingUses: 1,
        source: 'credits',
        creditsUsed: creditCost,
        createdAt: new Date().toISOString(),
      };
      writeStore(store);

      jsonResponse(res, 200, { ok: true, grantToken, creditsUsed: creditCost, balance: nextBalance });
    } catch (err) {
      jsonResponse(res, 500, { error: err instanceof Error ? err.message : 'Server error' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ndsh/parse') {
    try {
      const body = await readJson(req);
      if (!body.grantToken) {
        jsonResponse(res, 402, { error: 'Төлбөр шаардлагатай.' });
        return;
      }
      const grantCheck = consumeGrant(body.grantToken);
      if (!grantCheck.ok) {
        jsonResponse(res, 403, { error: 'Төлбөрийн эрх ашиглагдсан эсвэл хүчингүй байна.' });
        return;
      }
      const data = await extractNDSHFromImage(body.imageDataUrl, body.mimeType);
      jsonResponse(res, 200, { success: true, data });
    } catch (err) {
      jsonResponse(res, 500, { error: err instanceof Error ? err.message : 'Server error' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/business-card-map') {
    try {
      const body = await readJson(req);
      if (!body || typeof body !== 'object') {
        jsonResponse(res, 400, { error: 'Invalid request body' });
        return;
      }

      const mapped = await mapBusinessCardFieldsWithAI({
        svg: body.svg,
        textNodes: body.textNodes,
        imageNodes: body.imageNodes,
        referenceImageDataUrl: body.referenceImageDataUrl,
        referenceImageMimeType: body.referenceImageMimeType,
      });

      jsonResponse(res, 200, { success: true, data: mapped });
    } catch (err) {
      const status = err && typeof err === 'object' && 'status' in err ? Number(err.status) : 500;
      jsonResponse(res, Number.isFinite(status) ? status : 500, {
        error: err instanceof Error ? err.message : 'AI mapping error',
      });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/business-card-benchmark') {
    try {
      const body = await readJson(req);
      const benchmark = await runBusinessCardBenchmarkSuite({
        cases: Array.isArray(body?.cases) ? body.cases : undefined,
      });
      jsonResponse(res, 200, { success: true, data: benchmark });
    } catch (err) {
      const status = err && typeof err === 'object' && 'status' in err ? Number(err.status) : 500;
      jsonResponse(res, Number.isFinite(status) ? status : 500, {
        error: err instanceof Error ? err.message : 'Benchmark error',
      });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/contract-variable-map') {
    try {
      const body = await readJson(req);
      if (!body || typeof body !== 'object') {
        jsonResponse(res, 400, { error: 'Invalid request body' });
        return;
      }

      const mapped = await mapContractVariablesWithAI({
        content: body.content,
        existingVariables: body.existingVariables,
      });

      jsonResponse(res, 200, { success: true, data: mapped });
    } catch (err) {
      const status = err && typeof err === 'object' && 'status' in err ? Number(err.status) : 500;
      jsonResponse(res, Number.isFinite(status) ? status : 500, {
        error: err instanceof Error ? err.message : 'AI contract mapping error',
      });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ai/generate-letter') {
    try {
      const body = await readJson(req);
      const content = await generateLetterAI(body);
      jsonResponse(res, 200, { success: true, content: content.trim() });
    } catch (err) {
      const status = err && typeof err === 'object' && 'status' in err ? Number(err.status) : 500;
      jsonResponse(res, Number.isFinite(status) ? status : 500, {
        error: err instanceof Error ? err.message : 'AI generation error',
      });
    }
    return;
  }

  notFound(res);
});

server.listen(PORT, () => {
  console.log(`QPay server listening on http://localhost:${PORT}`);
});
