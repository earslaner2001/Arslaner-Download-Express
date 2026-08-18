const PRODUCT = process.env.LICENSE_PRODUCT || 'mediapull';
const STATUS_PATH = process.env.LICENSE_STATUS_PATH || '/api/v1/license/status';
const TIMEOUT_MS = 8000;

function licenseHeaders() {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  const key = process.env.LICENSE_API_KEY;
  if (key) {
    headers.Authorization = `Bearer ${key}`;
    headers['X-API-Key'] = key;
  }
  return headers;
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
  const nested = data.data && typeof data.data === 'object' ? data.data : {};
  const license = data.license && typeof data.license === 'object' ? data.license : nested.license || {};

  if (asBool(data.isPro) || asBool(data.pro) || asBool(data.hasLicense) || asBool(data.licensed)) return true;
  if (asBool(nested.isPro) || asBool(nested.pro) || asBool(nested.hasLicense) || asBool(nested.active)) return true;
  if (asBool(license.isPro) || asBool(license.active) || asBool(license.valid)) return true;
  if (isActiveStatus(data.status) || isActiveStatus(nested.status) || isActiveStatus(license.status)) return true;
  if (notExpired(data.expiresAt || data.expires || nested.expiresAt || license.expiresAt)) return true;
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

/**
 * POST {LICENSE_SERVER_URL}/api/v1/license/status
 * { email, product: "mediapull" } → { success: true, isPro: true|false }
 */
async function lookupProStatus(email) {
  const base = String(process.env.LICENSE_SERVER_URL || '').replace(/\/$/, '');
  if (!base || !email) return false;

  const url = `${base}${STATUS_PATH.startsWith('/') ? STATUS_PATH : `/${STATUS_PATH}`}`;
  const headers = licenseHeaders();
  const body = JSON.stringify({ email, product: PRODUCT });

  try {
    const posted = await fetchJson(url, { method: 'POST', headers, body });
    if (posted.ok && posted.data) return interpretLicensePayload(posted.data);

    const query = new URL(url);
    query.searchParams.set('email', email);
    query.searchParams.set('product', PRODUCT);
    const gotten = await fetchJson(query.toString(), { method: 'GET', headers });
    if (gotten.ok && gotten.data) return interpretLicensePayload(gotten.data);
  } catch (err) {
    console.warn('[license] lookup failed:', err instanceof Error ? err.message : err);
  }

  return false;
}

module.exports = { lookupProStatus };
