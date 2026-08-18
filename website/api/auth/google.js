const { OAuth2Client } = require('google-auth-library');
const { lookupProStatus } = require('../../lib/license');

const googleClient = new OAuth2Client();

function setCors(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', process.env.AUTH_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

function publicUser(payload, isPro) {
  return {
    name: String(payload.name || payload.given_name || '').trim() || 'Google kullanıcısı',
    email: String(payload.email || '').trim().toLowerCase(),
    picture: String(payload.picture || ''),
    isPro: Boolean(isPro)
  };
}

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({
      success: true,
      clientId: process.env.GOOGLE_CLIENT_ID || ''
    });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    res.status(405).json({ success: false, error: 'method_not_allowed' });
    return;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ success: false, error: 'server_misconfigured' });
    return;
  }

  const body = readBody(req);
  const credential = typeof body.credential === 'string' ? body.credential.trim() : '';
  const nonce = typeof body.nonce === 'string' ? body.nonce.trim() : '';

  if (!credential) {
    res.status(400).json({ success: false, error: 'missing_credential' });
    return;
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId
    });
    payload = ticket.getPayload();
  } catch (err) {
    console.warn('[auth/google] verify failed:', err instanceof Error ? err.message : err);
    res.status(401).json({ success: false, error: 'invalid_token' });
    return;
  }

  if (!payload || payload.email_verified !== true || !payload.email) {
    res.status(401).json({ success: false, error: 'unverified_email' });
    return;
  }

  if (nonce && payload.nonce && payload.nonce !== nonce) {
    res.status(401).json({ success: false, error: 'invalid_nonce' });
    return;
  }

  const isPro = await lookupProStatus(payload.email);
  const user = publicUser(payload, isPro);

  res.status(200).json({ success: true, user });
};
