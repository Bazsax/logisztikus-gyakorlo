// Szinkronizálás eszközök között: Vercel szerverfüggvény + Upstash Redis (REST API, csomag nélkül).
// Az adatot a szinkronkód SHA-256 lenyomata alatt tároljuk; a kód maga nem kerül a szerverre mentésre.
const crypto = require('crypto');

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const CODE_RE = /^[A-Z0-9]{5}(-[A-Z0-9]{5}){3}$/;
const MAX = 900 * 1024;

async function redis(cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error || `Redis HTTP ${r.status}`);
  return j.result;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!URL_ || !TOKEN) return res.status(503).json({ error: 'not-configured' });
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  const code = String(body?.code || '').trim().toUpperCase();
  if (!CODE_RE.test(code)) return res.status(400).json({ error: 'bad-code' });
  const key = 'lg:sync:' + crypto.createHash('sha256').update(code).digest('hex');
  try {
    if (body.action === 'get') {
      const raw = await redis(['GET', key]);
      return res.status(200).json({ data: raw ? JSON.parse(raw) : null });
    }
    if (body.action === 'put') {
      const raw = JSON.stringify(body.data ?? null);
      if (raw.length > MAX) return res.status(413).json({ error: 'too-large' });
      await redis(['SET', key, raw]);
      return res.status(200).json({ ok: true, at: Date.now() });
    }
    return res.status(400).json({ error: 'bad-action' });
  } catch (e) {
    return res.status(502).json({ error: 'storage', detail: String(e.message || e) });
  }
};
