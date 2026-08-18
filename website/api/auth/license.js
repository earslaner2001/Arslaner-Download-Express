const { lookupProStatus } = require('../../lib/license');

function setCors(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', process.env.AUTH_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    res.status(405).json({ success: false, error: 'method_not_allowed' });
    return;
  }

  const body = readBody(req);
  const email = String(body.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    res.status(400).json({ success: false, error: 'missing_email' });
    return;
  }

  const isPro = await lookupProStatus(email);
  res.status(200).json({ success: true, isPro });
};
