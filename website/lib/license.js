const PRODUCT = process.env.LICENSE_PRODUCT || 'mediapull';
const DEFAULT_SERVER = 'http://194.105.5.6:3000';
const TIMEOUT_MS = 8000;

const DEFAULT_PRO_EMAILS = [
  'earslaner58@gmail.com',
  'earslaner66@gmail.com'
];

function licenseHeaders() {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  const key = process.env.LICENSE_API_KEY;
  if (key) {
    headers.Authorization = `Bearer ${key}`;
    headers['X-API-Key'] = key;
  }
  return headers;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function allowlistedEmails() {
  const extra = String(process.env.PRO_EMAILS || '')
    .split(/[,;\s]+/)
    .map(normalizeEmail)
    .filter(Boolean);
  return new Set(DEFAULT_PRO_EMAILS.concat(extra));
}

function asBool(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function isActiveStatus(value) {
  const status = String(value || '').toLowerCase();
  return ['active', 'valid', 'pro', 'licensed', 'ok'].includes(status);
}

function notExpired(value) {
  if (!value) return false;
  const when = new Date(value);
  return !Number.isNaN(when.getTime()) && when.getTime() > Date.now();
}

function interpretLicensePayload(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.success === false) return false;
  const nested = data.data && typeof data.data === 'object' ? data.data : {};
  const license = data.license && typeof data.license === 'object' ? data.license : nested.license || {};

  if (asBool(data.isPro) || asBool(data.pro) || asBool(data.hasLicense) || asBool(data.licensed) || asBool(data.valid)) return true;
  if (asBool(nested.isPro) || asBool(nested.pro) || asBool(nested.hasLicense) || asBool(nested.active) || asBool(nested.valid)) return true;
  if (asBool(license.isPro) || asBool(license.active) || asBool(license.valid)) return true;
  if (isActiveStatus(data.status) || isActiveStatus(nested.status) || isActiveStatus(license.status)) return true;
  if (notExpired(data.expiresAt || data.expires || nested.expiresAt || license.expiresAt)) return true;
  if (Array.isArray(data.licenses) && data.licenses.some(interpretLicensePayload)) return true;
  return false;
}

async function fetchJson(url, options) {
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  return { ok: res.ok, status: res.status, data };
}

async function queryLicenseServer(email) {
  const base = String(process.env.LICENSE_SERVER_URL || DEFAULT_SERVER).replace(/\/$/, '');
  if (!base) return false;

  const headers = licenseHeaders();
  const body = JSON.stringify({ email, product: PRODUCT });
  const paths = String(process.env.LICENSE_STATUS_PATH || '')
    .split(/[,;\s]+/)
    .filter(Boolean);
  const candidates = paths.length
    ? paths
    : [
      '/api/v1/license/status',
      '/api/v1/license/lookup',
      '/api/v1/license/check',
      '/api/v1/license/by-email'
    ];

  for (const rawPath of candidates) {
    const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
    const url = `${base}${path}`;
    try {
      const posted = await fetchJson(url, { method: 'POST', headers, body });
      if (posted.ok && posted.data && interpretLicensePayload(posted.data)) return true;

      const query = new URL(url);
      query.searchParams.set('email', email);
      query.searchParams.set('product', PRODUCT);
      const gotten = await fetchJson(query.toString(), { method: 'GET', headers });
      if (gotten.ok && gotten.data && interpretLicensePayload(gotten.data)) return true;
    } catch (err) {
      console.warn('[license] lookup failed:', path, err instanceof Error ? err.message : err);
    }
  }

  return false;
}

async function lookupProStatus(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  if (allowlistedEmails().has(normalized)) return true;
  return queryLicenseServer(normalized);
}

module.exports = { lookupProStatus };
