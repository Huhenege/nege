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

const LETTER_GENERATE_PROMPT = `Чи бол мэргэжлийн албан бичиг төлөвлөгч AI. 
Өгөгдсөн мэдээлэл дээр тулгуурлан Монгол улсын албан хэрэг хөтлөлтийн стандартын дагуу албан бичгийн агуулгыг (текстийг) боловсруулна уу.

ЗААВАЛ БАРИМТЛАХ ДҮРЭМ:
1. Зөвхөн албан бичгийн гол агуулгын текстийг буцаа.
2. Гарчиг, огноо, хаяг зэрэг мэдээллийг текст дотор давтаж бичих шаардлагагүй (эдгээр нь бланканд байгаа).
3. Найруулга нь албан ёсны, тодорхой, товч байх ёстой.
4. Хэрэв мэдээлэл дутуу бол ерөнхий загвар ашиглаж, хэрэглэгч нөхөж бичих боломжтойгоор [] хаалтанд тэмдэглэ.
5. Зөвхөн цэвэр текст буцаа, ямар нэгэн тайлбар эсвэл Markdown тэмдэглэгээ (жишээ нь: ''' эсвэл #) бүү ашигла.`;

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
