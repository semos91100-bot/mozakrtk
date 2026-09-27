'use strict';
// مُذاكرة — Vercel serverless API (Supabase REST). لا تضع أي مفتاح سري في الواجهة.
const crypto = require('crypto');

const ROLES = ['student', 'support', 'moderator', 'admin', 'owner'];
const rank = r => Math.max(0, ROLES.indexOf(r));
const EDU_GRADES_SERVER = {
  first: ['general'],
  second: ['science', 'literary'],
  third: ['science_biology', 'science_math', 'literary'],
};
const SAFE = ['id', 'name', 'email', 'phone', 'username', 'role', 'state', 'created_at'];

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (s, c, m) => { throw new HttpError(s, c, m); };

/* ---------- Supabase REST ---------- */
function cfg() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  // Prefer a dedicated secret; derive a domain-separated fallback so existing
  // Vercel projects without SESSION_SECRET can still authenticate securely.
  const secret = process.env.SESSION_SECRET || (key ? crypto.createHmac('sha256', key).update('mozakra/session-signing/v1').digest('hex') : '');
  if (!url || !key) fail(500, 'CONFIG_MISSING', 'إعدادات السيرفر ناقصة: أضف SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في Vercel ثم اعمل Redeploy.');
  if (secret.length < 8) fail(500, 'CONFIG_MISSING', 'أضف SESSION_SECRET (نص عشوائي طويل) في متغيرات Vercel ثم اعمل Redeploy.');
  return { url, key, secret };
}

async function sb(table, { method = 'GET', query = '', body, ret = false } = {}) {
  const { url, key } = cfg();
  let r;
  try {
    r = await fetch(`${url}/rest/v1/${table}${query ? '?' + query : ''}`, {
      method,
      headers: {
        apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
        ...(ret ? { Prefer: 'return=representation' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    fail(502, 'DB_UNREACHABLE', 'تعذر الوصول إلى Supabase. راجع قيمة SUPABASE_URL في Vercel.');
  }
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const msg = String(j.message || j.error || j.hint || '');
    if (j.code === '23505') {
      const w = /phone/i.test(msg) ? 'رقم الموبايل' : /email/i.test(msg) ? 'البريد الإلكتروني' : 'اليوزر نيم';
      fail(409, 'DUPLICATE', `${w} مستخدم من قبل.`);
    }
    if (['42P01', 'PGRST205', '42703', 'PGRST204'].includes(j.code) || /does not exist|schema cache/i.test(msg))
      fail(500, 'SCHEMA_MISSING', 'قاعدة البيانات غير محدثة: شغّل ملف SUPABASE.sql كاملًا في Supabase SQL Editor (نفس المشروع المربوط بـ Vercel).');
    if (r.status === 401 || r.status === 403 || /invalid api key|jwt/i.test(msg))
      fail(500, 'DB_AUTH', 'مفتاح Supabase غير صحيح: تأكد أن SUPABASE_SERVICE_ROLE_KEY هو service_role وليس anon.');
    fail(500, 'DB_ERROR', 'خطأ في قاعدة البيانات: ' + (msg || r.status));
  }
  if (r.status === 204) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const eq = (k, v) => `${k}=eq.${encodeURIComponent(v)}`;
// PostgREST's ilike keeps legacy mixed-case identifiers usable; escape LIKE wildcards.
const ilike = (k, v) => `${k}=ilike.${encodeURIComponent(String(v).replace(/[\\%_*]/g, '\\$&'))}`;
const find = async (table, filters, extra = '') =>
  (await sb(table, { query: [...filters, extra].filter(Boolean).join('&') })) || [];
const one = async (table, filters) => (await find(table, filters, 'limit=1'))[0] || null;
const insert = async (table, row) => (await sb(table, { method: 'POST', body: row, ret: true }))[0];
const patch = (table, filters, body) => sb(table, { method: 'PATCH', query: filters.join('&'), body });

/* ---------- helpers ---------- */
const pub = u => {
  if (!u) return u;
  const out = Object.fromEntries(SAFE.map(k => [k, u[k] ?? null]));
  const profile = u.state?.profile || {};
  out.school = u.school ?? profile.school ?? '';
  out.governorate = u.governorate ?? profile.governorate ?? '';
  out.oauth_providers = Array.isArray(u.state?.oauth_providers) ? u.state.oauth_providers : Object.keys(u.state?.oauth || {});
  return out;
};
const clean = (s, n = 500) => String(s ?? '').trim().slice(0, n);

function phoneCore(p) {
  const d = String(p || '').replace(/\D/g, '').replace(/^00/, '').replace(/^20/, '').replace(/^0/, '');
  return /^1[0125]\d{8}$/.test(d) ? d : null;
}
const phoneVariants = p => { const c = phoneCore(p); return c ? ['0' + c, '20' + c, '+20' + c, c] : []; };
const canonPhone = p => { const c = phoneCore(p); return c ? '0' + c : null; };
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `s1$${salt}$${crypto.scryptSync(pw, salt, 32).toString('hex')}`;
}
function checkPw(pw, stored) {
  const [v, salt, h] = String(stored || '').split('$');
  if (v !== 's1' || !salt || !h) return false;
  const a = Buffer.from(crypto.scryptSync(String(pw), salt, 32).toString('hex'));
  const b = Buffer.from(h);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/* ---------- session ---------- */
const b64 = b => Buffer.from(b).toString('base64url');
function signToken(uid) {
  const p = b64(JSON.stringify({ uid, exp: Date.now() + 30 * 864e5 }));
  return `${p}.${crypto.createHmac('sha256', cfg().secret).update(p).digest('base64url')}`;
}
function readToken(tok) {
  const [p, s] = String(tok || '').split('.');
  if (!p || !s) return null;
  const good = crypto.createHmac('sha256', cfg().secret).update(p).digest('base64url');
  if (!safeEq(s, good)) return null;
  try { const o = JSON.parse(Buffer.from(p, 'base64url').toString()); return o.exp > Date.now() ? o : null; } catch { return null; }
}
function cookieOf(req, name) {
  const m = String(req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
}
const isHttps = req => String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
function setCookie(req, res, value, maxAge) {
  const attrs = [`mz_session=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (maxAge !== null) attrs.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  if (isHttps(req)) attrs.push('Secure');
  setCookieHeader(res, attrs.join('; '));
}
async function sessionUser(req) {
  const t = readToken(cookieOf(req, 'mz_session'));
  return t ? await one('users', [eq('id', t.uid)]) : null;
}
const need = (u, minRole) => {
  if (!u) fail(401, 'AUTH_REQUIRED', 'سجّل الدخول أولًا.');
  if (minRole && rank(u.role) < rank(minRole)) fail(403, 'FORBIDDEN', 'ليس لديك صلاحية لهذا الإجراء.');
  return u;
};

/* ---------- owners from env ---------- */
function owners() {
  const list = [];
  for (const [e, n, p, dn] of [
    ['OWNER_EMAIL', 'OWNER_NAME', 'OWNER_PASSWORD', 'ALTON'],
    ['OWNER_2_EMAIL', 'OWNER_2_NAME', 'OWNER_2_PASSWORD', 'OWNER 2'],
    ['OWNER_3_EMAIL', 'OWNER_3_NAME', 'OWNER_3_PASSWORD', 'OWNER 3'],
  ]) {
    const email = clean(process.env[e]).toLowerCase(), pass = process.env[p] || '';
    if (email && pass) list.push({ email, pass, name: clean(process.env[n]) || dn });
  }
  return list;
}
async function ensureOwnerRow(o) {
  let u = await one('users', [eq('email', o.email)]);
  if (!u) return insert('users', { email: o.email, name: o.name, role: 'owner', password_hash: hashPw(o.pass), state: { onboarded: true } });
  const upd = {};
  if (u.role !== 'owner') upd.role = 'owner';
  if (!checkPw(o.pass, u.password_hash)) upd.password_hash = hashPw(o.pass);
  if (Object.keys(upd).length) { await patch('users', [eq('id', u.id)], upd); u = { ...u, ...upd }; }
  return u;
}

/* ---------- audit ---------- */
async function audit(actor, action, target, details = {}) {
  try {
    await insert('audit_logs', {
      actor_user_id: actor?.id ?? null, actor_name: actor?.name || 'زائر', actor_role: actor?.role || 'guest',
      action, target_user_id: target?.id ?? null, target_name: target?.name ?? null, details,
    });
  } catch { /* السجل لا يجب أن يكسر العملية */ }
}

/* ---------- lookup ---------- */
async function findByIdentifier(idf) {
  const s = clean(idf, 120);
  if (!s) return null;
  if (s.includes('@')) return (await one('users', [eq('email', s)])) || (await one('users', [eq('email', s.toLowerCase())])) || (await one('users', [ilike('email', s)]));
  for (const v of phoneVariants(s)) { const u = await one('users', [eq('phone', v)]); if (u) return u; }
  return (await one('users', [eq('username', s)])) || (await one('users', [eq('username', s.toLowerCase())])) || (await one('users', [ilike('username', s)]));
}

/* ---------- actions ---------- */
const A = {};

A.health = async () => ({ ok: true, time: new Date().toISOString() });

/* ---------- Google / Apple OAuth ---------- */
const oauthB64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function oauthBaseUrl() {
  const raw = clean(process.env.OAUTH_BASE_URL, 300).replace(/\/$/, '');
  let u;
  try { u = new URL(raw); } catch { fail(503, 'OAUTH_NOT_CONFIGURED', 'أضف OAUTH_BASE_URL إلى إعدادات Vercel.'); }
  if (u.protocol !== 'https:' || u.pathname !== '/' || u.search || u.hash || u.username || u.password)
    fail(503, 'OAUTH_NOT_CONFIGURED', 'يجب أن يكون OAUTH_BASE_URL عنوان الموقع الأساسي عبر HTTPS.');
  return u.origin;
}
function setCookieHeader(res, line) {
  const old = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(old ? (Array.isArray(old) ? old : [old]) : []), line]);
}
function oauthStateCookie(req, res, state, nonce, provider) {
  const payload = oauthB64({ state, nonce, provider, exp: Date.now() + 10 * 60 * 1000 });
  const sig = crypto.createHmac('sha256', cfg().secret).update(payload).digest('base64url');
  setCookieHeader(res, `mz_oauth=${payload}.${sig}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=None`);
}
function clearOauthCookie(res) {
  setCookieHeader(res, 'mz_oauth=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None');
}
function oauthStateFromRequest(req) {
  const raw = String(req.headers.cookie || '').split(/;\s*/).find(x => x.startsWith('mz_oauth='))?.slice(9) || '';
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', cfg().secret).update(payload).digest('base64url');
  if (!safeEq(signature, expected)) return null;
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return value.exp > Date.now() ? value : null;
  } catch { return null; }
}
function oauthCredentials(provider) {
  if (provider === 'google') {
    const clientId = clean(process.env.GOOGLE_CLIENT_ID, 500), clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    if (!clientId || !clientSecret) fail(503, 'OAUTH_NOT_CONFIGURED', 'تسجيل Google يحتاج GOOGLE_CLIENT_ID وGOOGLE_CLIENT_SECRET في Vercel.');
    return { clientId, clientSecret };
  }
  const clientId = clean(process.env.APPLE_SERVICE_ID, 500), teamId = clean(process.env.APPLE_TEAM_ID, 100),
    keyId = clean(process.env.APPLE_KEY_ID, 100), privateKey = String(process.env.APPLE_PRIVATE_KEY || '');
  if (!clientId || !teamId || !keyId || !privateKey)
    fail(503, 'OAUTH_NOT_CONFIGURED', 'تسجيل Apple يحتاج APPLE_SERVICE_ID وAPPLE_TEAM_ID وAPPLE_KEY_ID وAPPLE_PRIVATE_KEY في Vercel.');
  return { clientId, teamId, keyId, privateKey };
}
const oauthB64Part = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function appleClientSecret(c) {
  const now = Math.floor(Date.now() / 1000), header = oauthB64Part({ alg: 'ES256', kid: c.keyId });
  const payload = oauthB64Part({ iss: c.teamId, iat: now, exp: now + 3600, aud: 'https://appleid.apple.com', sub: c.clientId });
  const input = `${header}.${payload}`;
  const key = String(c.privateKey).replace(/\\n/g, '\n');
  const signature = crypto.sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${input}.${signature}`;
}
async function oauthFetchJson(url, params) {
  const response = await fetch(url, { method: params ? 'POST' : 'GET', headers: params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
    body: params ? new URLSearchParams(params).toString() : undefined, signal: AbortSignal.timeout(15000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('OAuth provider rejected request');
  return body;
}
async function verifyIdentityToken(token, provider, clientId, expectedNonce) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Invalid identity token');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Invalid signing algorithm');
  const jwksUrl = provider === 'google' ? 'https://www.googleapis.com/oauth2/v3/certs' : 'https://appleid.apple.com/auth/keys';
  const jwks = await oauthFetchJson(jwksUrl);
  const jwk = (jwks.keys || []).find(k => k.kid === header.kid && k.kty === 'RSA');
  if (!jwk) throw new Error('Signing key unavailable');
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const validSignature = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], 'base64url'));
  const issuers = provider === 'google' ? ['accounts.google.com', 'https://accounts.google.com'] : ['https://appleid.apple.com'];
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const nonce = String(claims.nonce || '');
  const nonceOk = nonce === expectedNonce || (provider === 'apple' && nonce === crypto.createHash('sha256').update(expectedNonce).digest('hex'));
  const now = Math.floor(Date.now() / 1000);
  if (!validSignature || !issuers.includes(claims.iss) || !audiences.includes(clientId) || !claims.sub ||
      Number(claims.exp) <= now || Number(claims.iat) > now + 120 || !nonceOk) throw new Error('Identity token validation failed');
  return claims;
}
function oauthErrorHtml(res, message, status = 400) {
  const safe = String(message).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  res.statusCode = status; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
  res.end(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تعذر تسجيل الدخول</title><body style="font:16px system-ui;background:#fff;color:#182a42;display:grid;place-items:center;min-height:100vh"><main style="max-width:540px;margin:20px;padding:26px;border:1px solid #e5eaf2;border-radius:20px"><h1>تعذر تسجيل الدخول</h1><p>${safe}</p><a href="/study.html">العودة لموقع مُذاكرة</a></main></body></html>`);
}
async function oauthUser(provider, claims, suppliedName = '') {
  const subject = clean(claims.sub, 255), email = clean(claims.email, 254).toLowerCase();
  if (!subject) fail(401, 'OAUTH_INVALID_IDENTITY', 'تعذر التحقق من هوية الحساب.');
  const username = `${provider}_${crypto.createHash('sha256').update(subject).digest('hex').slice(0, 18)}`;
  const existingUser = await one('users', [eq('username', username)]);
  if (existingUser) {
    if (existingUser.state?.oauth?.[provider] !== subject) fail(409, 'OAUTH_IDENTITY_CONFLICT', 'تعذر ربط هوية الدخول بهذا الحساب.');
    return existingUser;
  }
  const emailVerified = claims.email_verified === true || claims.email_verified === 'true' || claims.email_verified === 1;
  if (email && emailVerified && await one('users', [ilike('email', email)]))
    fail(409, 'OAUTH_EMAIL_EXISTS', 'هذا البريد مرتبط بحساب موجود. سجّل الدخول بالحساب الحالي أولًا بدل إنشاء حساب مكرر.');
  const name = clean(suppliedName || claims.name || (email ? email.split('@')[0] : `طالب ${provider}`), 80) || `طالب ${provider}`;
  return await insert('users', { email: email && emailVerified ? email : null, phone: null, username, name, role: 'student',
    password_hash: hashPw(crypto.randomBytes(32).toString('hex')), state: { onboarded: false, profile: {}, oauth: { [provider]: subject }, oauth_providers: [provider] } });
}
A.oauth_start = async (req, res) => {
  const provider = clean(req.query?.provider, 20).toLowerCase();
  try {
    const mode = clean(req.query?.mode, 20).toLowerCase() || 'login';
    if (!['google', 'apple'].includes(provider) || !['login', 'signup'].includes(mode)) fail(400, 'BAD_OAUTH_REQUEST', 'طلب تسجيل الدخول غير صالح.');
    const credentials = oauthCredentials(provider), base = oauthBaseUrl();
    const state = crypto.randomBytes(32).toString('hex'), nonce = crypto.randomBytes(32).toString('hex');
    oauthStateCookie(req, res, state, nonce, provider);
    const redirectUri = `${base}/api/oauth`;
    const params = provider === 'google'
      ? { client_id: credentials.clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', state, nonce, prompt: 'select_account' }
      : { client_id: credentials.clientId, redirect_uri: redirectUri, response_type: 'code', response_mode: 'form_post', scope: 'name email', state, nonce };
    const destination = provider === 'google' ? 'https://accounts.google.com/o/oauth2/v2/auth' : 'https://appleid.apple.com/auth/authorize';
    res.statusCode = 302; res.setHeader('Location', `${destination}?${new URLSearchParams(params)}`); res.end();
  } catch (e) {
    oauthErrorHtml(res, e instanceof HttpError ? e.message : 'تعذر بدء تسجيل الدخول. تحقق من إعدادات مزود الدخول في Vercel.', e instanceof HttpError ? e.status : 503);
  }
};
A.oauth_callback = async (req, res) => {
  let flow;
  try {
    flow = oauthStateFromRequest(req);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const incomingState = String(body.state || req.query?.state || '');
    clearOauthCookie(res);
    if (!flow || flow.state !== incomingState || !['google', 'apple'].includes(flow.provider)) throw new Error('انتهت جلسة الدخول أو لم تطابق. ابدأ المحاولة من جديد.');
    const provider = flow.provider, credentials = oauthCredentials(provider), code = String(body.code || req.query?.code || '');
    if (!code) throw new Error('لم يكتمل رد مزود تسجيل الدخول.');
    if (body.error || req.query?.error) throw new Error('تم إلغاء تسجيل الدخول أو رفضه. يمكنك الرجوع وتجربة مزود آخر.');
    const redirectUri = `${oauthBaseUrl()}/api/oauth`;
    const tokenParams = provider === 'google'
      ? { code, client_id: credentials.clientId, client_secret: credentials.clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }
      : { code, client_id: credentials.clientId, client_secret: appleClientSecret(credentials), redirect_uri: redirectUri, grant_type: 'authorization_code' };
    const tokens = await oauthFetchJson(provider === 'google' ? 'https://oauth2.googleapis.com/token' : 'https://appleid.apple.com/auth/token', tokenParams);
    const claims = await verifyIdentityToken(tokens.id_token, provider, credentials.clientId, flow.nonce);
    if (provider === 'google' && !(claims.email_verified === true || claims.email_verified === 'true' || claims.email_verified === 1)) throw new Error('يجب استخدام بريد Google موثّق.');
    let suppliedName = '';
    if (provider === 'apple') {
      try { const n = typeof body.user === 'string' ? JSON.parse(body.user) : body.user; suppliedName = [n?.name?.firstName, n?.name?.lastName].filter(Boolean).join(' '); } catch {}
    }
    const user = await oauthUser(provider, claims, suppliedName);
    setCookie(req, res, signToken(user.id), 30 * 86400);
    await audit(user, `login_${provider}`);
    res.statusCode = 303; res.setHeader('Location', '/study.html'); res.end();
  } catch (e) {
    console.error('[oauth callback]', flow?.provider || 'unknown', e?.name || 'Error');
    oauthErrorHtml(res, e instanceof HttpError ? e.message : (e?.message || 'تعذر التحقق من الحساب. راجع إعدادات Google أو Apple في Vercel.'), e instanceof HttpError ? e.status : 400);
  }
};

A.me = async (req) => {
  const user = await sessionUser(req);
  return { ok: true, authenticated: !!user, user: pub(user) };
};

A.state = async (req, res, b) => {
  const user = need(await sessionUser(req));
  if (String(req.method || 'GET').toUpperCase() !== 'GET') return A.savestate(req, res, b);
  return { ok: true, state: user.state || {} };
};

A.content = async () => {
  const result = await A.sitecontent();
  return { ok: true, content: { teachers: result.teachers || [], lessons: [], questions: [], teacher_overrides: {}, disabled_teachers: [] } };
};

A.profile = async (req, res, b) => {
  const user = need(await sessionUser(req));
  const name = clean(b.name, 80), email = clean(b.email, 254).toLowerCase();
  const phone = b.phone == null || b.phone === '' ? null : canonPhone(b.phone);
  if (name && name.length < 2) fail(400, 'BAD_NAME', 'اكتب اسمًا صحيحًا.');
  if (email && !validEmail(email)) fail(400, 'BAD_EMAIL', 'البريد الإلكتروني غير صحيح.');
  if (b.phone && !phone) fail(400, 'BAD_PHONE', 'رقم الموبايل المصري غير صحيح.');
  if (email) {
    const existing = await one('users', [ilike('email', email)]);
    if (existing && String(existing.id) !== String(user.id)) fail(409, 'DUPLICATE', 'البريد الإلكتروني مستخدم من قبل.');
  }
  if (phone) {
    for (const variant of phoneVariants(phone)) {
      const existing = await one('users', [eq('phone', variant)]);
      if (existing && String(existing.id) !== String(user.id)) fail(409, 'DUPLICATE', 'رقم الموبايل مستخدم من قبل.');
    }
  }
  const currentState = user.state || {}, profile = { ...(currentState.profile || {}) };
  for (const key of ['school', 'governorate']) if (b[key] !== undefined) profile[key] = clean(b[key], 120);
  const update = { state: { ...currentState, profile }, updated_at: new Date().toISOString() };
  if (name) update.name = name;
  if (b.email !== undefined) update.email = email || null;
  if (b.phone !== undefined) update.phone = phone;
  await patch('users', [eq('id', user.id)], update);
  return { ok: true, user: pub({ ...user, ...update }) };
};

A.login = async (req, res, b) => {
  const idf = clean(b.identifier || b.login || b.phone || b.email || b.username, 120);
  const pw = String(b.password ?? '');
  if (!idf || !pw) fail(400, 'MISSING_FIELDS', 'اكتب رقم الموبايل أو البريد أو اليوزر نيم وكلمة المرور.');
  const own = owners().find(o => o.email === idf.toLowerCase());
  let user;
  if (own) {
    if (!safeEq(pw, own.pass)) fail(401, 'INVALID_CREDENTIALS', 'بيانات الدخول غير صحيحة.');
    user = await ensureOwnerRow(own);
  } else {
    user = await findByIdentifier(idf);
    if (!user || !checkPw(pw, user.password_hash)) fail(401, 'INVALID_CREDENTIALS', 'بيانات الدخول غير صحيحة.');
  }
  setCookie(req, res, signToken(user.id), b.remember === false ? null : 30 * 86400);
  await audit(user, 'login');
  return { ok: true, user: pub(user) };
};

A.signup = async (req, res, b) => {
  const name = clean(b.name, 80), requestedUsername = clean(b.username, 30).toLowerCase(), pw = String(b.password ?? '');
  const phone = canonPhone(b.phone), email = clean(b.email, 254).toLowerCase(), grade = clean(b.grade, 20), branch = clean(b.branch, 30);
  if (name.length < 2) fail(400, 'BAD_NAME', 'اكتب اسمك.');
  if (email && !validEmail(email)) fail(400, 'BAD_EMAIL', 'البريد الإلكتروني غير صحيح.');
  if (requestedUsername && !/^[a-z0-9_.]{3,20}$/.test(requestedUsername)) fail(400, 'BAD_USERNAME', 'اليوزر نيم 3–20 حرفًا إنجليزيًا أو أرقامًا أو _ أو .');
  if (!phone) fail(400, 'BAD_PHONE', 'رقم الموبايل المصري غير صحيح.');
  if (pw.length < 6) fail(400, 'BAD_PASSWORD', 'كلمة المرور 6 أحرف على الأقل.');
  if ((grade || branch) && !EDU_GRADES_SERVER[grade]?.includes(branch)) fail(400, 'BAD_TRACK', 'اختر الصف والشعبة أو اتركهما فارغين لإكمالهما لاحقًا.');
  if (email && await one('users', [ilike('email', email)])) fail(409, 'DUPLICATE', 'البريد الإلكتروني مستخدم من قبل.');
  for (const v of phoneVariants(phone)) if (await one('users', [eq('phone', v)])) fail(409, 'DUPLICATE', 'رقم الموبايل مستخدم من قبل.');
  let username = requestedUsername || null;
  if (username && await one('users', [eq('username', username)])) fail(409, 'DUPLICATE', 'اليوزر نيم مستخدم من قبل.');
  if (!username) {
    const base = `student_${phoneCore(phone)}`;
    username = base;
    let i = 1;
    while (await one('users', [eq('username', username)])) username = `${base}_${i++}`;
  }
  const profile = {};
  for (const key of ['school', 'governorate']) if (b[key] !== undefined) profile[key] = clean(b[key], 120);
  const user = await insert('users', {
    name, username, email: email || null, phone, role: 'student', password_hash: hashPw(pw),
    state: { ...(grade && branch ? { grade, branch, onboarded: true } : { onboarded: false }), profile },
  });
  setCookie(req, res, signToken(user.id), 30 * 86400);
  await audit(user, 'signup');
  return { ok: true, user: pub(user) };
};

A.logout = async (req, res) => {
  const u = await sessionUser(req).catch(() => null);
  setCookie(req, res, '', 0);
  if (u) await audit(u, 'logout');
  return { ok: true };
};

A.savestate = async (req, res, b) => {
  const u = need(await sessionUser(req));
  const st = { ...(u.state || {}), ...(typeof b.state === 'object' && b.state ? b.state : {}) };
  const g = st.grade, br = st.branch;
  if (g && !EDU_GRADES_SERVER[g]?.includes(br)) fail(400, 'BAD_TRACK', 'الصف أو الشعبة غير صحيحين.');
  await patch('users', [eq('id', u.id)], { state: st, updated_at: new Date().toISOString() });
  return { ok: true, state: st };
};

A.accounts = async (req) => {
  need(await sessionUser(req), 'owner');
  const rows = await find('users', [], 'order=created_at.desc');
  return { ok: true, accounts: rows.map(pub) };
};

async function targetUser(b) {
  const u = b.user_id != null ? await one('users', [eq('id', b.user_id)]) : await findByIdentifier(b.phone || b.email || b.username);
  if (!u) fail(404, 'NOT_FOUND', 'الحساب غير موجود.');
  return u;
}
A.setrole = async (req, res, b) => {
  const me = need(await sessionUser(req), 'owner');
  const t = await targetUser(b), role = clean(b.role, 20);
  if (t.role === 'owner') fail(403, 'OWNER_PROTECTED', 'لا يمكن تغيير رتبة OWNER.');
  if (!ROLES.includes(role) || role === 'owner') fail(400, 'BAD_ROLE', 'رتبة غير صحيحة.');
  await patch('users', [eq('id', t.id)], { role, updated_at: new Date().toISOString() });
  await insert('notifications', { title: 'تم تغيير رتبتك', body: `رتبتك الآن: ${role.toUpperCase()}`, to_user_id: t.id });
  await audit(me, 'set_role', t, { from: t.role, to: role });
  return { ok: true };
};
A.setemail = async (req, res, b) => {
  const me = need(await sessionUser(req), 'owner');
  const t = await targetUser(b), email = clean(b.email, 120).toLowerCase();
  if (t.role === 'owner') fail(403, 'OWNER_PROTECTED', 'حساب OWNER محمي.');
  if (email && !validEmail(email)) fail(400, 'BAD_EMAIL', 'البريد الإلكتروني غير صحيح.');
  if (email) { const x = await one('users', [eq('email', email)]); if (x && x.id !== t.id) fail(409, 'DUPLICATE', 'البريد مستخدم من قبل.'); }
  await patch('users', [eq('id', t.id)], { email: email || null, updated_at: new Date().toISOString() });
  await audit(me, 'set_email', t, { email });
  return { ok: true };
};
A.deleteaccount = async (req, res, b) => {
  const me = need(await sessionUser(req), 'owner');
  const t = await targetUser(b);
  if (t.role === 'owner') fail(403, 'OWNER_PROTECTED', 'لا يمكن حذف حساب OWNER.');
  await sb('users', { method: 'DELETE', query: eq('id', t.id) });
  await audit(me, 'delete_account', t);
  return { ok: true };
};

A.notify = async (req, res, b) => {
  const me = need(await sessionUser(req), 'admin');
  const title = clean(b.title, 120), body = clean(b.body, 1000), to = clean(b.target || b.to || 'all', 120);
  if (!title) fail(400, 'MISSING_FIELDS', 'اكتب عنوان الإشعار.');
  let row = { title, body };
  if (to === 'all' || to === 'staff') row.to_role = to;
  else { const t = await findByIdentifier(to); if (!t) fail(404, 'NOT_FOUND', 'لا يوجد طالب بهذا الرقم/البريد.'); row.to_user_id = t.id; }
  await insert('notifications', row);
  await audit(me, 'notify', null, { to, title });
  return { ok: true };
};
A.notifications = async (req) => {
  const u = await sessionUser(req); // الزائر (بدون تسجيل) يشوف الإشعارات العامة فقط
  const parts = [find('notifications', [eq('to_role', 'all')])];
  if (u) parts.push(find('notifications', [eq('to_user_id', u.id)]));
  if (u && rank(u.role) >= 1) parts.push(find('notifications', [eq('to_role', 'staff')]));
  const rows = (await Promise.all(parts)).flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return { ok: true, notifications: rows.slice(0, 100) };
};

const tid = () => 'T' + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString('hex').toUpperCase();
A.ticketcreate = async (req, res, b) => {
  const u = need(await sessionUser(req));
  if (u.role !== 'student' && u.role !== 'owner') fail(403, 'FORBIDDEN', 'فتح التذاكر للطلاب فقط.');
  const subject = clean(b.subject, 150), text = clean(b.text || b.message, 3000);
  if (!subject || !text) fail(400, 'MISSING_FIELDS', 'اكتب عنوان المشكلة وتفاصيلها.');
  const t = await insert('tickets', {
    id: tid(), user_id: u.id, user_name: u.name, user_email: u.email || null, subject,
    category: clean(b.category, 30) || 'other', priority: 'medium', status: 'open', assigned_role: 'support',
  });
  await insert('ticket_messages', { ticket_id: t.id, from_role: u.role, author_name: u.name, text });
  await audit(u, 'ticket_create', null, { id: t.id });
  return { ok: true, ticket: t };
};
A.tickets = async (req) => {
  const u = need(await sessionUser(req));
  const rows = await find('tickets', rank(u.role) >= 1 && u.role !== 'student' ? [] : [eq('user_id', u.id)], 'order=updated_at.desc');
  return { ok: true, tickets: rows };
};
async function legacySupportTicket(ticket) {
  if (!ticket) return null;
  const messages = await find('ticket_messages', [eq('ticket_id', ticket.id)], 'order=created_at.asc');
  return { id: ticket.id, reason: ticket.subject, status: ticket.status === 'resolved' ? 'closed' : ticket.status,
    updated_at: ticket.updated_at, messages: messages.map(m => ({ sender: m.from_role === 'student' ? 'user' : 'admin', text: m.text, created_at: m.created_at })) };
}
A.support_user = async (req) => {
  const user = need(await sessionUser(req));
  const result = await A.tickets(req);
  const active = (result.tickets || []).find(t => !['closed', 'resolved'].includes(t.status));
  return { ok: true, ticket: await legacySupportTicket(active || null) };
};
A.support_create = async (req, res, b) => {
  const created = await A.ticketcreate(req, res, { subject: 'طلب دعم فني', text: b.reason || b.text });
  return { ok: true, ticket: await legacySupportTicket(created.ticket) };
};
A.support_send = async (req, res, b) => {
  const user = need(await sessionUser(req));
  const list = await A.tickets(req), ticket = (list.tickets || []).find(t => !['closed', 'resolved'].includes(t.status));
  if (!ticket) fail(404, 'NOT_FOUND', 'لا يوجد طلب دعم مفتوح.');
  await A.ticketreply(req, res, { id: ticket.id, text: b.text });
  return { ok: true, ticket: await legacySupportTicket(await one('tickets', [eq('id', ticket.id)])) };
};
async function loadTicket(u, id) {
  const t = await one('tickets', [eq('id', clean(id, 40))]);
  if (!t) fail(404, 'NOT_FOUND', 'التذكرة غير موجودة.');
  const staff = rank(u.role) >= 1;
  if (!staff && t.user_id !== u.id) fail(403, 'FORBIDDEN', 'هذه التذكرة ليست لك.');
  return t;
}
A.ticketget = async (req, res, b) => {
  const u = need(await sessionUser(req)), t = await loadTicket(u, b.id);
  return { ok: true, ticket: t, messages: await find('ticket_messages', [eq('ticket_id', t.id)], 'order=created_at.asc') };
};
A.ticketreply = async (req, res, b) => {
  const u = need(await sessionUser(req)), t = await loadTicket(u, b.id), text = clean(b.text, 3000);
  if (!text) fail(400, 'MISSING_FIELDS', 'اكتب الرد.');
  await insert('ticket_messages', { ticket_id: t.id, from_role: u.role, author_name: u.name, text });
  await patch('tickets', [eq('id', t.id)], { updated_at: new Date().toISOString() });
  if (t.user_id !== u.id) await insert('notifications', { title: 'رد جديد على تذكرتك', body: t.subject, to_user_id: t.user_id });
  await audit(u, 'ticket_reply', null, { id: t.id });
  return { ok: true };
};
A.ticketupdate = async (req, res, b) => {
  const u = need(await sessionUser(req), 'support'), t = await loadTicket(u, b.id);
  const upd = { updated_at: new Date().toISOString() };
  if (['open', 'pending', 'resolved', 'closed'].includes(b.status)) upd.status = b.status;
  if (['low', 'medium', 'high', 'urgent'].includes(b.priority)) upd.priority = b.priority;
  await patch('tickets', [eq('id', t.id)], upd);
  await audit(u, 'ticket_update', null, { id: t.id, ...upd });
  return { ok: true };
};

A.adminchat = async (req) => {
  need(await sessionUser(req), 'support');
  const rows = await find('admin_chat_messages', [], 'order=created_at.desc&limit=200');
  return { ok: true, messages: rows.reverse() };
};
A.adminchatsend = async (req, res, b) => {
  const u = need(await sessionUser(req), 'support'), text = clean(b.text, 2000);
  if (!text) fail(400, 'MISSING_FIELDS', 'اكتب رسالة.');
  await insert('admin_chat_messages', { user_id: u.id, author_name: u.name, author_role: u.role, text });
  await audit(u, 'admin_chat_send');
  return { ok: true };
};

A.auditlogs = async (req) => {
  need(await sessionUser(req), 'owner');
  return { ok: true, logs: await find('audit_logs', [], 'order=created_at.desc&limit=300') };
};


/* ---------- exams ---------- */
function trackMatch(row, state) {
  const g = state?.grade || '', br = state?.branch || '';
  if (row.grade && row.grade !== g) return false;
  if (row.branch && row.branch !== br) return false;
  return true;
}
A.examlist = async (req) => {
  const u = need(await sessionUser(req));
  const rows = await find('exams', [eq('is_published', 'true')], 'order=created_at.desc');
  return { ok: true, exams: rows.filter(x => trackMatch(x, u.state || {})).map(({correct_index, ...rest}) => rest) };
};
A.examget = async (req, res, b) => {
  const u = need(await sessionUser(req));
  const e = await one('exams', [eq('id', b.id)]);
  if (!e) fail(404, 'NOT_FOUND', 'الاختبار غير موجود.');
  if (u.role === 'student' && (!e.is_published || !trackMatch(e, u.state || {}))) fail(403, 'FORBIDDEN', 'الاختبار غير متاح لمسارك.');
  const qs = await find('exam_questions', [eq('exam_id', e.id)], 'order=id.asc');
  return { ok: true, exam: e, questions: u.role === 'student' ? qs.map(({correct_index, ...q}) => q) : qs };
};
A.examsubmit = async (req, res, b) => {
  const u = need(await sessionUser(req));
  const e = await one('exams', [eq('id', b.id)]);
  if (!e || !e.is_published || !trackMatch(e, u.state || {})) fail(404, 'NOT_FOUND', 'الاختبار غير متاح.');
  const qs = await find('exam_questions', [eq('exam_id', e.id)], 'order=id.asc');
  const answers = (b.answers && typeof b.answers === 'object') ? b.answers : {};
  let score = 0, total_points = 0;
  for (const q of qs) {
    const pts = Number(q.points || 1); total_points += pts;
    if (Number(answers[q.id]) === Number(q.correct_index)) score += pts;
  }
  const percent = total_points ? Math.round((score / total_points) * 100) : 0;
  const attempt = await insert('exam_attempts', { exam_id: e.id, user_id: u.id, answers, score, total_points, percent, submitted_at: new Date().toISOString() });
  await audit(u, 'exam_submit', null, { exam_id: e.id, score, total_points, percent });
  return { ok: true, score, total_points, percent, attempt };
};
A.examcreate = async (req, res, b) => {
  const u = need(await sessionUser(req), 'admin');
  const title = clean(b.title, 160), subject = clean(b.subject, 100), description = clean(b.description, 1000), grade = clean(b.grade, 30), branch = clean(b.branch, 40);
  if (!title) fail(400, 'MISSING_FIELDS', 'اكتب اسم الاختبار.');
  if (grade && !EDU_GRADES_SERVER[grade]) fail(400, 'BAD_TRACK', 'الصف غير صحيح.');
  if (grade && branch && !EDU_GRADES_SERVER[grade].includes(branch)) fail(400, 'BAD_TRACK', 'الصف والشعبة غير متوافقين.');
  const row = await insert('exams', { title, subject, description, grade: grade || null, branch: branch || null, duration_minutes: Math.max(1, Number(b.duration_minutes || 30)), is_published: false, created_by: u.id });
  await audit(u, 'exam_create', null, { exam_id: row.id });
  return { ok: true, exam: row };
};
A.examquestionadd = async (req, res, b) => {
  const u = need(await sessionUser(req), 'admin');
  const e = await one('exams', [eq('id', b.exam_id)]); if (!e) fail(404, 'NOT_FOUND', 'الاختبار غير موجود.');
  const text = clean(b.text || b.question, 2000), options = Array.isArray(b.options) ? b.options.map(x => clean(x, 500)).slice(0, 8) : [];
  const correct_index = Number(b.correct_index);
  if (!text || options.length < 2 || !Number.isInteger(correct_index) || correct_index < 0 || correct_index >= options.length) fail(400, 'BAD_QUESTION', 'السؤال والاختيارات والإجابة الصحيحة مطلوبة.');
  const row = await insert('exam_questions', { exam_id: e.id, text, options, correct_index, points: Math.max(1, Number(b.points || 1)) });
  await audit(u, 'exam_question_add', null, { exam_id: e.id, question_id: row.id });
  return { ok: true, question: row };
};
A.exampublish = async (req, res, b) => {
  const u = need(await sessionUser(req), 'admin'), e = await one('exams', [eq('id', b.id)]);
  if (!e) fail(404, 'NOT_FOUND', 'الاختبار غير موجود.');
  await patch('exams', [eq('id', e.id)], { is_published: !!b.published, updated_at: new Date().toISOString() });
  await audit(u, 'exam_publish', null, { exam_id: e.id, published: !!b.published });
  return { ok: true };
};
A.examlistadmin = async (req) => { need(await sessionUser(req), 'admin'); return { ok: true, exams: await find('exams', [], 'order=created_at.desc') }; };
A.examattempts = async (req, res, b) => { need(await sessionUser(req), 'admin'); return { ok: true, attempts: await find('exam_attempts', b.exam_id ? [eq('exam_id', b.exam_id)] : [], 'order=submitted_at.desc') }; };


/* ---------- question bank ---------- */
function questionTrack(row, state) {
  const g = state?.grade || '', br = state?.branch || '';
  if (row.grade && row.grade !== g) return false;
  if (row.branch && row.branch !== br) return false;
  return true;
}
A.questionbank = async (req, res, b) => {
  const u = need(await sessionUser(req));
  const filters = [];
  if (clean(b.subject, 100)) filters.push(eq('subject', clean(b.subject, 100)));
  if (clean(b.difficulty, 30)) filters.push(eq('difficulty', clean(b.difficulty, 30)));
  let rows = await find('question_bank', filters, 'order=created_at.desc&limit=80');
  rows = rows.filter(q => questionTrack(q, u.state || {}));
  return { ok: true, questions: rows.map(({ correct_index, explanation, ...q }) => q) };
};
A.questioncheck = async (req, res, b) => {
  const u = need(await sessionUser(req));
  const q = await one('question_bank', [eq('id', b.id)]);
  if (!q || !questionTrack(q, u.state || {})) fail(404, 'NOT_FOUND', 'السؤال غير متاح لمسارك.');
  const answer = Number(b.answer_index);
  const correct = Number.isInteger(answer) && answer === Number(q.correct_index);
  return { ok: true, correct, correct_index: Number(q.correct_index), explanation: q.explanation || '', points: Number(q.points || 1) };
};
A.questionbankadd = async (req, res, b) => {
  const u = need(await sessionUser(req), 'admin');
  const text = clean(b.text || b.question, 2000);
  const options = Array.isArray(b.options) ? b.options.map(x => clean(x, 500)).slice(0, 8) : [];
  const correct_index = Number(b.correct_index);
  const subject = clean(b.subject, 100), grade = clean(b.grade, 30), branch = clean(b.branch, 40);
  const difficulty = clean(b.difficulty, 30) || 'متوسط';
  if (!text || !subject || options.length < 2 || !Number.isInteger(correct_index) || correct_index < 0 || correct_index >= options.length) fail(400, 'BAD_QUESTION', 'السؤال والمادة والاختيارات والإجابة الصحيحة مطلوبة.');
  if (grade && !EDU_GRADES_SERVER[grade]) fail(400, 'BAD_TRACK', 'الصف غير صحيح.');
  if (grade && branch && !EDU_GRADES_SERVER[grade].includes(branch)) fail(400, 'BAD_TRACK', 'الصف والشعبة غير متوافقين.');
  const row = await insert('question_bank', { text, subject, chapter: clean(b.chapter, 120), difficulty, grade: grade || null, branch: branch || null, options, correct_index, explanation: clean(b.explanation, 1000), points: Math.max(1, Number(b.points || 1)), created_by: u.id });
  await audit(u, 'question_bank_add', null, { question_id: row.id });
  return { ok: true, question: row };
};

const DEFAULT_TEACHERS = [
  { id:'t1', name:'أ/ أحمد سامح', subject:'الرياضيات', bio:'شرح مبسط وتدريب مستمر على مسائل المنهج.', grades:['first','second','third'], branches:['general','science','literary','science_biology','science_math'] },
  { id:'t2', name:'أ/ محمد ياسر', subject:'اللغة العربية', bio:'نحو وبلاغة وقراءة مع تدريبات امتحانات.', grades:['first','second','third'], branches:['general','science','literary','science_biology','science_math'] },
  { id:'t3', name:'أ/ عمر خالد', subject:'اللغة الإنجليزية', bio:'Grammar + Vocabulary + Practice بطريقة عملية.', grades:['first','second','third'], branches:['general','science','literary','science_biology','science_math'] },
  { id:'t4', name:'أ/ كريم عادل', subject:'الفيزياء', bio:'حل مسائل وخطط سريعة للمراجعة النهائية.', grades:['second','third'], branches:['science','science_math','science_biology'] },
  { id:'t5', name:'أ/ يوسف حمدي', subject:'الكيمياء', bio:'شرح المفاهيم والتدريب على أسئلة الاختيار من متعدد.', grades:['second','third'], branches:['science','science_math','science_biology'] },
  { id:'t6', name:'أ/ مصطفى نادر', subject:'الأحياء', bio:'مراجعات مركزة ورسومات توضيحية وأسئلة بنك.', grades:['second','third'], branches:['science_biology','science'] },
  { id:'t7', name:'أ/ شريف محمود', subject:'التاريخ', bio:'مراجعات منظمة وربط الأحداث بأسئلة الامتحانات.', grades:['second','third'], branches:['literary'] },
  { id:'t8', name:'أ/ حسام فتحي', subject:'الجغرافيا', bio:'خرائط ومفاهيم وتدريب على أسئلة السنوات السابقة.', grades:['second','third'], branches:['literary'] },
  { id:'t9', name:'أ/ ياسين رجب', subject:'الفلسفة والمنطق', bio:'تبسيط الأفكار وتدريب على أسئلة المقال والاختيار.', grades:['second','third'], branches:['literary'] },
  { id:'t10', name:'أ/ محمود طارق', subject:'العلوم المتكاملة', bio:'مراجعات قصيرة وأسئلة تدريبية مناسبة للمسار.', grades:['first'], branches:['general'] }
];
A.sitecontent = async () => {
  const r = await one('site_content', [eq('id', 1)]);
  return { ok: true, teachers: Array.isArray(r?.teachers) && r.teachers.length ? r.teachers : DEFAULT_TEACHERS, removed: r?.removed || [] };
};
A.teachers = async () => {
  const r = await one('site_content', [eq('id', 1)]);
  return { ok: true, teachers: Array.isArray(r?.teachers) && r.teachers.length ? r.teachers : DEFAULT_TEACHERS, removed: r?.removed || [] };
};

A.sitecontentsave = async (req, res, b) => {
  const u = need(await sessionUser(req), 'admin');
  const row = { teachers: Array.isArray(b.teachers) ? b.teachers : [], removed: Array.isArray(b.removed) ? b.removed : [], updated_at: new Date().toISOString() };
  if (await one('site_content', [eq('id', 1)])) await patch('site_content', [eq('id', 1)], row);
  else await insert('site_content', { id: 1, ...row });
  await audit(u, 'site_content_save');
  return { ok: true };
};

A.dbhealth = async (req) => {
  need(await sessionUser(req), 'owner');
  const out = {};
  for (const t of ['users', 'site_content', 'notifications', 'tickets', 'ticket_messages', 'admin_chat_messages', 'audit_logs', 'exams', 'exam_questions', 'exam_attempts', 'question_bank']) {
    try { await sb(t, { query: 'select=*&limit=1' }); out[t] = 'ok'; } catch (e) { out[t] = e.code || 'error'; }
  }
  try { await sb('users', { query: 'select=username&limit=1' }); out.users_username = 'ok'; } catch (e) { out.users_username = e.code || 'error'; }
  return { ok: Object.values(out).every(v => v === 'ok'), tables: out, env: { url: !!process.env.SUPABASE_URL, key: !!process.env.SUPABASE_SERVICE_ROLE_KEY, secret: !!(process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY), gemini: !!process.env.GEMINI_API_KEY } };
};

A.ai = async (req, res, b) => {
  need(await sessionUser(req));
  const key = process.env.GEMINI_API_KEY;
  if (!key) fail(503, 'AI_NOT_CONFIGURED', 'المدرس الذكي غير مفعّل بعد.');
  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: clean(b.prompt || b.message, 4000) }] }] }),
  }).catch(() => null);
  if (!r || !r.ok) fail(502, 'AI_ERROR', 'تعذر الاتصال بخدمة الذكاء الاصطناعي.');
  const j = await r.json();
  return { ok: true, text: j.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '' };
};

/* ---------- entry ---------- */
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = (b && typeof b === 'object') ? b : {};
    const name = String(req.query?.action || b.action || 'health').replace(/[^a-z_]/gi, '').toLowerCase();
    const fn = A[name];
    if (!fn) fail(404, 'UNKNOWN_ACTION', 'إجراء غير معروف: ' + name);
    const result = await fn(req, res, b);
    if (res.writableEnded) return;
    return res.status(200).json(result);
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ ok: false, error: e.code, message: e.message });
    console.error(e);
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: 'حدث خطأ غير متوقع في السيرفر.' });
  }
};
