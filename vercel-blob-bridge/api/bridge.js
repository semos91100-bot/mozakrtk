import { get, put } from '@vercel/blob';
import { timingSafeEqual } from 'node:crypto';

const ALLOWED_KEYS = new Set([
  'mz-data/users.json',
  'mz-data/content.json',
  'mz-data/support.json',
]);
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function authorized(req) {
  const expected = process.env.BLOB_BRIDGE_SECRET || '';
  const received = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!expected || !received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }
  if (!authorized(req)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { operation, key } = body;
    if (!ALLOWED_KEYS.has(key)) {
      return res.status(400).json({ ok: false, error: 'INVALID_KEY' });
    }

    if (operation === 'read') {
      const result = await get(key, { access: 'private', useCache: false });
      if (!result || result.statusCode !== 200 || !result.stream) {
        return res.status(200).json({ ok: true, found: false });
      }
      const raw = await new Response(result.stream).text();
      return res.status(200).json({ ok: true, found: true, data: raw });
    }

    if (operation === 'write') {
      if (typeof body.data !== 'string' || Buffer.byteLength(body.data, 'utf8') > MAX_BODY_BYTES) {
        return res.status(413).json({ ok: false, error: 'PAYLOAD_TOO_LARGE' });
      }
      await put(key, body.data, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json; charset=utf-8',
        cacheControlMaxAge: 0,
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ ok: false, error: 'INVALID_OPERATION' });
  } catch {
    // Do not return SDK or credential details to the PHP application/client.
    return res.status(502).json({ ok: false, error: 'BLOB_OPERATION_FAILED' });
  }
}
