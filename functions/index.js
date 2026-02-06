const admin = require('firebase-admin');
const crypto = require('crypto');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');

admin.initializeApp();
const db = admin.firestore();

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

async function createInvoice({ amount, description, invoiceCode, callbackUrl, baseUrl, clientId, clientSecret }) {
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
    status: 'CREATED',
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

  const grantToken = crypto.randomUUID();
  const now = new Date().toISOString();

  await invoiceRef.set({
    status: 'PAID',
    grantToken,
    updatedAt: now,
  }, { merge: true });

  await db.collection('qpayGrants').doc(grantToken).set({
    invoice_id: invoiceId,
    remainingUses: 1,
    status: 'available',
    createdAt: now,
    updatedAt: now,
  });

  return grantToken;
}

async function reserveGrant(grantToken) {
  const grantRef = db.collection('qpayGrants').doc(grantToken);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(grantRef);
    if (!snap.exists) {
      return { ok: false, reason: 'INVALID' };
    }
    const data = snap.data();
    if ((data?.remainingUses || 0) < 1) {
      return { ok: false, reason: 'USED' };
    }

    tx.update(grantRef, {
      remainingUses: (data.remainingUses || 0) - 1,
      status: 'processing',
      updatedAt: new Date().toISOString(),
    });

    return { ok: true };
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

// Robust Manual CORS for production
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle Preflight
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  next();
});

app.use(require('express').json({ limit: '30mb' }));
app.use(require('express').urlencoded({ extended: false }));

// Health check that works on both root and /api
app.all(['/', '/health', '/qpay/health'], (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString(), note: 'API is running' });
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

app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

exports.api = onRequest({
  secrets: [
    QPAY_CLIENT_ID,
    QPAY_CLIENT_SECRET,
    QPAY_INVOICE_CODE,
    GEMINI_API_KEY,
  ],
}, app);

