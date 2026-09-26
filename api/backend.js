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
  const secret = process.env.SESSION_SECRET || '';
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
const pub = u => u && Object.fromEntries(SAFE.map(k => [k, u[k] ?? null]));
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
  const attrs = [`mz_session=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.max(0, Math.floor(maxAge))}`];
  if (isHttps(req)) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
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

A.me = async (req) => ({ ok: true, user: pub(await sessionUser(req)) });

A.login = async (req, res, b) => {
  const idf = clean(b.identifier || b.phone || b.email || b.username, 120);
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
  setCookie(req, res, signToken(user.id), 30 * 86400);
  await audit(user, 'login');
  return { ok: true, user: pub(user) };
};

A.signup = async (req, res, b) => {
  const name = clean(b.name, 80), requestedUsername = clean(b.username, 30).toLowerCase(), pw = String(b.password ?? '');
  const phone = canonPhone(b.phone), grade = clean(b.grade, 20), branch = clean(b.branch, 30);
  if (name.length < 2) fail(400, 'BAD_NAME', 'اكتب اسمك.');
  if (requestedUsername && !/^[a-z0-9_.]{3,20}$/.test(requestedUsername)) fail(400, 'BAD_USERNAME', 'اليوزر نيم 3–20 حرفًا إنجليزيًا أو أرقامًا أو _ أو .');
  if (!phone) fail(400, 'BAD_PHONE', 'رقم الموبايل المصري غير صحيح.');
  if (pw.length < 6) fail(400, 'BAD_PASSWORD', 'كلمة المرور 6 أحرف على الأقل.');
  if ((grade || branch) && !EDU_GRADES_SERVER[grade]?.includes(branch)) fail(400, 'BAD_TRACK', 'اختر الصف والشعبة أو اتركهما فارغين لإكمالهما لاحقًا.');
  for (const v of phoneVariants(phone)) if (await one('users', [eq('phone', v)])) fail(409, 'DUPLICATE', 'رقم الموبايل مستخدم من قبل.');
  let username = requestedUsername || null;
  if (username && await one('users', [eq('username', username)])) fail(409, 'DUPLICATE', 'اليوزر نيم مستخدم من قبل.');
  if (!username) {
    const base = `student_${phoneCore(phone)}`;
    username = base;
    let i = 1;
    while (await one('users', [eq('username', username)])) username = `${base}_${i++}`;
  }
  const user = await insert('users', {
    name, username, phone, role: 'student', password_hash: hashPw(pw),
    state: { ...(grade && branch ? { grade, branch, onboarded: true } : { onboarded: false }) },
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

A.sitecontent = async () => {
  const r = await one('site_content', [eq('id', 1)]);
  return { ok: true, teachers: r?.teachers || [], removed: r?.removed || [] };
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
  for (const t of ['users', 'site_content', 'notifications', 'tickets', 'ticket_messages', 'admin_chat_messages', 'audit_logs']) {
    try { await sb(t, { query: 'select=*&limit=1' }); out[t] = 'ok'; } catch (e) { out[t] = e.code || 'error'; }
  }
  try { await sb('users', { query: 'select=username&limit=1' }); out.users_username = 'ok'; } catch (e) { out.users_username = e.code || 'error'; }
  return { ok: Object.values(out).every(v => v === 'ok'), tables: out, env: { url: !!process.env.SUPABASE_URL, key: !!process.env.SUPABASE_SERVICE_ROLE_KEY, secret: !!process.env.SESSION_SECRET, gemini: !!process.env.GEMINI_API_KEY } };
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
    const name = String(req.query?.action || b.action || 'health').replace(/[^a-z]/gi, '').toLowerCase();
    const fn = A[name];
    if (!fn) fail(404, 'UNKNOWN_ACTION', 'إجراء غير معروف: ' + name);
    return res.status(200).json(await fn(req, res, b));
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ ok: false, error: e.code, message: e.message });
    console.error(e);
    return res.status(500).json({ ok: false, error: 'SERVER_ERROR', message: 'حدث خطأ غير متوقع في السيرفر.' });
  }
};
