import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const ADMIN_EMAIL = 'semos91100@gmail.com';
const ADMIN_PASSWORD_SHA256 = '93729294067b593cbfb3ec9ed1035c8e498481aed992d715d716c394b320ed7c';
const SESSION_SECRET = 'mozakra-vercel-session-2026-09-23-7f0d0b7d4f2a';
const COOKIE_NAME = 'mozakra_admin';
const MAX_AGE = 60 * 60 * 24 * 30;

function b64url(value) {
  return Buffer.from(value).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function sign(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', SESSION_SECRET).update(body).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return `${body}.${sig}`;
}
function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = createHmac('sha256', SESSION_SECRET).update(body).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'));
    if (!payload || payload.email !== ADMIN_EMAIL || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch { return null; }
}
function cookies(req) {
  const raw = req.headers.cookie || '';
  return Object.fromEntries(raw.split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf('=');
    return i < 0 ? [x, ''] : [x.slice(0,i), decodeURIComponent(x.slice(i+1))];
  }));
}
function setCookie(res, value, maxAge = MAX_AGE) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`);
}
function clearCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`);
}
function json(res, status, data) {
  res.status(status).setHeader('Content-Type','application/json; charset=utf-8').setHeader('Cache-Control','no-store').json(data);
}
function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

export default async function handler(req, res) {
  const action = String(req.query?.action || '');

  if (action === 'me' && req.method === 'GET') {
    const session = verify(cookies(req)[COOKIE_NAME]);
    if (!session) return json(res, 200, {ok:true, authenticated:false});
    return json(res, 200, {ok:true, authenticated:true, user:{id:-1,email:ADMIN_EMAIL,name:'Admin',role:'admin'}});
  }

  if (action === 'login' && req.method === 'POST') {
    const d = body(req);
    const email = String(d.email || '').trim().toLowerCase();
    const password = String(d.password || '');
    const hash = createHash('sha256').update(password).digest('hex');
    if (email !== ADMIN_EMAIL || hash !== ADMIN_PASSWORD_SHA256) return json(res, 401, {ok:false,error:'LOGIN_FAILED'});
    const token = sign({email:ADMIN_EMAIL, exp:Date.now()+MAX_AGE*1000});
    setCookie(res, token);
    return json(res, 200, {ok:true, authenticated:true, user:{id:-1,email:ADMIN_EMAIL,name:'Admin',role:'admin'}});
  }

  if (action === 'logout' && req.method === 'POST') {
    clearCookie(res);
    return json(res, 200, {ok:true});
  }

  if (action === 'ai' && req.method === 'POST') {
    const session = verify(cookies(req)[COOKIE_NAME]);
    const apiKey = String(process.env.GEMINI_API_KEY || '').trim();
    if (!session && !apiKey) return json(res, 503, {ok:false,error:'AI_NOT_CONFIGURED'});
    if (!apiKey) return json(res, 503, {ok:false,error:'AI_NOT_CONFIGURED'});

    const d = body(req);
    const messages = Array.isArray(d.messages) ? d.messages : [];
    const context = String(d.context || '').slice(0,3000);
    const contents = messages.slice(-12).map(m => ({
      role: m?.role === 'model' ? 'model' : 'user',
      parts: [{text: String(m?.content || '').trim()}]
    })).filter(x => x.parts[0].text);
    if (!contents.length) return json(res, 422, {ok:false,error:'EMPTY_MESSAGE'});

    const system = 'أنت مدرس خصوصي لطالب في الصف الثالث الثانوي (علمي علوم) في مصر. اتكلم بالعامية المصرية البسيطة والمحترمة.\\nشرح بإيجاز وبخطوات، استخدم مثالًا واضحًا، وفي نهاية الرد اسأل سؤال فهم قصير. إذا طلب الطالب اختبارًا أنشئ 5 أسئلة اختيار من متعدد واذكر الإجابات بعد الأسئلة. لا تخترع معلومات خارج المنهج المصري، وإذا لم تكن متأكدًا قل ذلك بوضوح.\\nسياق الطالب: ' + context;
    const model = String(process.env.GEMINI_MODEL || 'gemini-3.5-flash');
    const payload = {systemInstruction:{parts:[{text:system}]},contents,generationConfig:{temperature:0.35,maxOutputTokens:1200}};
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method:'POST', headers:{'Content-Type':'application/json','x-goog-api-key':apiKey}, body:JSON.stringify(payload)
    });
    const j = await r.json().catch(()=>({}));
    if (!r.ok) return json(res, 502, {ok:false,error:'AI_PROVIDER',status:r.status});
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) return json(res, 502, {ok:false,error:'AI_EMPTY'});
    return json(res, 200, {ok:true,text});
  }

  return json(res, 404, {ok:false,error:'NOT_FOUND'});
}
