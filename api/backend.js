'use strict';

const crypto = require('crypto');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const SESSION_SECRET = String(process.env.SESSION_SECRET || (SUPABASE_SERVICE_ROLE_KEY ? crypto.createHash('sha256').update(SUPABASE_SERVICE_ROLE_KEY).digest('hex') : ''));
const OWNER_EMAIL = String(process.env.OWNER_EMAIL || process.env.ADMIN_EMAIL || 'semos91100@gmail.com').trim().toLowerCase();
const OWNER_PASSWORD = String(process.env.OWNER_PASSWORD || process.env.ADMIN_PASSWORD || 'alton112233');
const OWNER_ACCOUNTS = [
  { email: OWNER_EMAIL, name: 'ALTON', password: OWNER_PASSWORD },
  // OWNER إضافي 1: اكتب البريد والاسم وكلمة المرور هنا أو استخدم OWNER_2_* في Vercel
  { email: String(process.env.OWNER_2_EMAIL || '').trim().toLowerCase(), name: String(process.env.OWNER_2_NAME || 'OWNER 2').trim(), password: String(process.env.OWNER_2_PASSWORD || '') },
  // OWNER إضافي 2: اكتب البريد والاسم وكلمة المرور هنا أو استخدم OWNER_3_* في Vercel
  { email: String(process.env.OWNER_3_EMAIL || '').trim().toLowerCase(), name: String(process.env.OWNER_3_NAME || 'OWNER 3').trim(), password: String(process.env.OWNER_3_PASSWORD || '') }
].filter(x => x.email && x.password);
const OWNER_EMAILS = new Set(OWNER_ACCOUNTS.map(x => x.email));
const ADMIN_EMAIL = OWNER_EMAIL;

const ROLE_LEVEL = Object.freeze({student:0, support:1, moderator:2, admin:3, owner:4});
const STAFF_ROLES = new Set(['support','moderator','admin','owner']);
const MANAGER_ROLES = new Set(['admin','owner']);
const ALL_ROLES = new Set(Object.keys(ROLE_LEVEL));

function configured(){ return !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SESSION_SECRET); }
function send(res, status, data, extraHeaders={}){
  Object.entries(extraHeaders).forEach(([k,v])=>res.setHeader(k,v));
  res.status(status).json(data);
}
function now(){ return new Date().toISOString(); }
function email(v){ return String(v || '').trim().toLowerCase(); }
function normalizePhone(v){
  let p=String(v||'').trim().replace(/[\s().-]/g,'');
  if(p.startsWith('00')) p='+'+p.slice(2);
  if(p.startsWith('+20')) p='+20'+p.slice(3).replace(/\D/g,'');
  else if(/^01\d{9}$/.test(p)) p='+20'+p.slice(1);
  else p=p.replace(/\D/g,'');
  return p;
}
function validPhone(v){ const p=normalizePhone(v); return /^\+?\d{10,15}$/.test(p); }
function validEmail(v){ return !v || (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 190); }
function hashPassword(text){ return crypto.createHash('sha256').update(String(text)).digest('hex'); }
function roleLevel(role){ return ROLE_LEVEL[String(role||'student')] ?? -1; }
function isStaff(role){ return STAFF_ROLES.has(String(role||'')); }
function isManager(role){ return MANAGER_ROLES.has(String(role||'')); }
function canManageUsers(role){ return String(role||'') === 'owner'; }
function canManageTicket(role){ return isStaff(role); }
function signPayload(payload){
  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(raw).digest('base64url');
  return `${raw}.${sig}`;
}
function verifySession(token){
  try{
    if(!token) return null;
    const [raw,sig] = String(token).split('.');
    if(!raw || !sig) return null;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(raw).digest('base64url');
    if(sig.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(raw,'base64url').toString('utf8'));
    if(!payload || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  }catch(_){ return null; }
}
function cookieValue(req,name){
  const c = String(req.headers.cookie || '');
  const m = c.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));
  return m ? decodeURIComponent(m.slice(name.length+1)) : '';
}
function sessionUser(req){ return verifySession(cookieValue(req,'mozakra_session')); }
function setSession(res, user){
  const token = signPayload({id:String(user.id),email:user.email||'',phone:user.phone||'',role:user.role,name:user.name,exp:Date.now()+1000*60*60*24*30});
  res.setHeader('Set-Cookie', `mozakra_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
}
function clearSession(res){ res.setHeader('Set-Cookie','mozakra_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'); }
async function readBody(req){
  if(req.body && typeof req.body === 'object') return req.body;
  return await new Promise(resolve=>{
    let raw=''; req.on('data',c=>raw+=c); req.on('end',()=>{ try{ resolve(raw?JSON.parse(raw):{}); }catch(_){ resolve({}); } });
  });
}
async function sb(path, opts={}){
  if(!configured()) throw Object.assign(new Error('BACKEND_NOT_CONFIGURED'),{code:'BACKEND_NOT_CONFIGURED'});
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers:{
      apikey:SUPABASE_SERVICE_ROLE_KEY,
      Authorization:`Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type':'application/json',
      ...(opts.headers||{})
    }
  });
  const text = await r.text();
  let data=null; try{ data=text?JSON.parse(text):null; }catch(_){ data=text; }
  if(!r.ok){
    const e=new Error(typeof data==='string'?data:(data?.message||'SUPABASE_ERROR'));
    e.status=r.status; e.data=data; throw e;
  }
  return data;
}
function eq(v){ return encodeURIComponent(String(v)); }
function requireUser(req){ const u=sessionUser(req); if(!u) throw Object.assign(new Error('AUTH_REQUIRED'),{code:'AUTH_REQUIRED',status:401}); return u; }
function requireStaff(req){ const u=requireUser(req); if(!isStaff(u.role)) throw Object.assign(new Error('FORBIDDEN'),{code:'FORBIDDEN',status:403}); return u; }
function requireManager(req){ const u=requireUser(req); if(!isManager(u.role)) throw Object.assign(new Error('FORBIDDEN'),{code:'FORBIDDEN',status:403}); return u; }
function ok(res,data={}){ send(res,200,{ok:true,...data}); }
function fail(res,status,error){ send(res,status,{ok:false,error}); }
function safeUser(u){ return u ? {id:u.id,email:u.email||'',phone:u.phone||'',name:u.name||'طالب',role:u.role||'student'} : null; }
function targetEmailOrAll(to){ return email(to||'all'); }

// سجل نشاط مركزي يراه الـ OWNER فقط. لا نضع كلمات مرور أو مفاتيح جلسات داخل السجل.
async function audit(actor, action, details={}, target=null){
  try{
    await sb('audit_logs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({
      actor_user_id: actor?.id ? actor.id : null,
      actor_name: actor?.name || 'زائر',
      actor_role: actor?.role || 'guest',
      action: String(action||'').slice(0,80),
      target_user_id: target?.id ? target.id : null,
      target_name: target?.name || null,
      details: details && typeof details==='object' ? details : {message:String(details||'')},
      created_at: now()
    })});
  }catch(_){ /* السجل لا يعطّل العملية الأساسية إذا كانت قاعدة السجل غير مهيأة */ }
}
async function auditLogin(user){ return audit(user,'login_success'); }

async function getStudentById(id){
  const rows=await sb(`users?select=id,email,phone,name,password_hash,role,state,created_at,updated_at&id=eq.${eq(id)}&limit=1`);
  return rows?.[0]||null;
}
async function getUserById(id){
  const rows=await sb(`users?select=id,email,phone,name,password_hash,role,state,created_at,updated_at&id=eq.${eq(id)}&limit=1`);
  return rows?.[0]||null;
}
async function getStudentByEmail(e){
  const rows=await sb(`users?select=id,email,phone,name,password_hash,role,state,created_at,updated_at&email=eq.${eq(e)}&limit=1`);
  return rows?.[0]||null;
}
async function getStudentByPhone(p){
  const phone=normalizePhone(p);
  const rows=await sb(`users?select=id,email,phone,name,password_hash,role,state,created_at,updated_at&phone=eq.${eq(phone)}&limit=1`);
  return rows?.[0]||null;
}

async function ensureOwnerUser(owner=OWNER_ACCOUNTS[0]){
  let u=await getStudentByEmail(owner.email);
  if(u){
    if(u.role!=='owner'){
      await sb(`users?id=eq.${eq(u.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({role:'owner',name:u.name||owner.name||'OWNER',updated_at:now()})});
      u={...u,role:'owner'};
    }
    return u;
  }
  const inserted=await sb('users',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({email:owner.email,phone:null,name:owner.name||'OWNER',role:'owner',password_hash:hashPassword(owner.password),state:{},created_at:now(),updated_at:now()})});
  return inserted?.[0]||null;
}
async function findUser(identifier){
  const raw=String(identifier||'').trim();
  if(raw.includes('@')) return getStudentByEmail(email(raw));
  return getStudentByPhone(raw);
}

async function ticketWithMessages(id){
  const rows=await sb(`tickets?select=id,user_id,user_name,user_email,subject,category,priority,status,created_at,updated_at&id=eq.${eq(id)}&limit=1`);
  const t=rows?.[0]; if(!t) return null;
  const msgs=await sb(`ticket_messages?select=id,ticket_id,from_role,author_name,text,created_at&ticket_id=eq.${eq(id)}&order=created_at.asc`);
  return {...t,messages:(msgs||[]).map(m=>({id:m.id,from:m.from_role,authorName:m.author_name,text:m.text,at:m.created_at}))};
}
function flattenTicket(t){
  const msgs=t.messages||[];
  const first=msgs.find(m=>m.from==='student')||msgs[0];
  const lastAdmin=[...msgs].reverse().find(m=>m.from!=='student');
  return {id:t.id,uid:t.user_id,email:t.user_email,name:t.user_name,message:first?.text||'',reply:lastAdmin?.text||null,status:t.status,created_at:Math.floor(new Date(t.created_at).getTime()/1000),replied_at:lastAdmin?Math.floor(new Date(lastAdmin.at).getTime()/1000):null};
}

async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  const action=String(req.query.action||'');
  const method=String(req.method||'GET').toUpperCase();
  const body=await readBody(req);
  if(!configured()) return fail(res,503,'BACKEND_NOT_CONFIGURED');

  try{
    if(action==='me'){
      const u=sessionUser(req); return ok(res,{authenticated:!!u,user:u||undefined});
    }
    if(action==='login' && method==='POST'){
      const identifier=String(body.identifier||body.phone||body.email||'').trim();
      const pass=String(body.password||'');
      const e=email(identifier);
      if(e && OWNER_EMAILS.has(e)){
        const ownerCfg=OWNER_ACCOUNTS.find(x=>x.email===e);
        if(!ownerCfg || pass!==ownerCfg.password) return fail(res,401,'LOGIN_FAILED');
        const owner=await ensureOwnerUser(ownerCfg);
        if(!owner) return fail(res,500,'SERVER_ERROR');
        const safe=safeUser({...owner,role:'owner',email:ownerCfg.email,name:ownerCfg.name||owner.name||'OWNER'});
        setSession(res,safe); await audit(safe,'login_success',{method:'owner_email'}); return ok(res,{authenticated:true,user:safe});
      }
      const u=await findUser(identifier);
      if(!u || u.password_hash!==hashPassword(pass)) return fail(res,401,'LOGIN_FAILED');
      const safe=safeUser(u); setSession(res,safe); await audit(safe,'login_success',{method:e?'email':'phone'}); return ok(res,{authenticated:true,user:safe});
    }
    if(action==='signup' && method==='POST'){
      const p=normalizePhone(body.phone), pass=String(body.password||''), name=String(body.name||'').trim().slice(0,120), e=email(body.email);
      if(!validPhone(p)) return fail(res,422,'INVALID_PHONE');
      if(pass.length<8) return fail(res,422,'PASSWORD_SHORT');
      if(pass.length>200) return fail(res,422,'PASSWORD_LONG');
      if(e) return fail(res,403,'EMAIL_OWNER_ONLY');
      if(!validEmail(e)) return fail(res,422,'INVALID_EMAIL');
      const byPhone=await getStudentByPhone(p); if(byPhone) return fail(res,409,'PHONE_EXISTS');
      if(e){ const byEmail=await getStudentByEmail(e); if(byEmail || e===OWNER_EMAIL) return fail(res,409,'EMAIL_EXISTS'); }
      const inserted=await sb('users',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({email:null,phone:p,name:name||'طالب',role:'student',password_hash:hashPassword(pass),state:{},created_at:now(),updated_at:now()})});
      const u=inserted[0], safe=safeUser(u); setSession(res,safe); await audit(safe,'signup',{role:'student'}); return ok(res,{authenticated:true,user:safe});
    }
    if(action==='logout' && method==='POST'){ const u=sessionUser(req); if(u) await audit(u,'logout'); clearSession(res); return ok(res); }
    if(action==='state'){
      const u=requireUser(req); if(isStaff(u.role)) return ok(res,{state:{},updated:Date.now()});
      const row=await getStudentById(u.id); if(!row) return fail(res,401,'AUTH_REQUIRED');
      if(method==='GET') return ok(res,{state:row.state||{},updated:row.updated_at||0});
      if(method==='POST'){
        if(!body.state || typeof body.state!=='object') return fail(res,422,'BAD_STATE');
        await sb(`users?id=eq.${eq(u.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({state:body.state,name:String(body.state.name||row.name||'طالب').slice(0,120),updated_at:now()})});
        return ok(res,{updated:Date.now()});
      }
    }
    if(action==='content'){
      if(method==='GET'){
        const rows=await sb('site_content?select=id,teachers,removed&id=eq.1&limit=1');
        const c=rows?.[0]||{teachers:[],removed:[]}; return ok(res,{content:{teachers:c.teachers||[],removed:c.removed||[]}});
      }
      requireManager(req); if(method==='POST'){
        const teachers=Array.isArray(body.teachers)?body.teachers:[], removed=Array.isArray(body.removed)?body.removed:[];
        const exists=await sb('site_content?select=id&id=eq.1&limit=1');
        if(exists?.length) await sb('site_content?id=eq.1',{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({teachers,removed,updated_at:now()})});
        else await sb('site_content',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({id:1,teachers,removed,updated_at:now()})});
        return ok(res);
      }
    }
    if(action==='notifications'){
      const u=requireUser(req);
      if(method==='GET'){
        // استخدم استعلامات منفصلة بدل OR المركب حتى لا تعتمد القراءة على صياغة PostgREST OR.
        const queries=[
          `notifications?select=id,title,body,to_email,to_user_id,to_role,created_at&to_role=eq.all&order=created_at.desc&limit=100`,
          `notifications?select=id,title,body,to_email,to_user_id,to_role,created_at&to_user_id=eq.${eq(u.id)}&order=created_at.desc&limit=100`
        ];
        if(u.email) queries.push(`notifications?select=id,title,body,to_email,to_user_id,to_role,created_at&to_email=eq.${eq(u.email)}&order=created_at.desc&limit=100`);
        if(isStaff(u.role)) queries.push(`notifications?select=id,title,body,to_email,to_user_id,to_role,created_at&to_role=eq.staff&order=created_at.desc&limit=100`);
        const groups=await Promise.all(queries.map(q=>sb(q)));
        const map=new Map(); for(const group of groups) for(const n of (group||[])) map.set(String(n.id),n);
        const rows=[...map.values()].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,100);
        return ok(res,{notifications:rows.map(n=>({id:n.id,title:n.title,body:n.body,to:n.to_role==='staff'?'all-admins':(n.to_role==='all'?'all':(n.to_email||'user')),created_at:Math.floor(new Date(n.created_at).getTime()/1000)}))});
      }
      requireManager(req);
      const title=String(body.title||'').trim().slice(0,150), text=String(body.body||'').trim().slice(0,1000);
      let target=targetEmailOrAll(body.to||'all');
      if(!title) return fail(res,422,'EMPTY_TITLE');
      let row={title,body:text,created_at:now(),to_email:null,to_user_id:null,to_role:null};
      if(target==='all') row.to_role='all';
      else if(target==='staff') row.to_role='staff';
      else if(target.includes('@')){
        const tu=await getStudentByEmail(target); if(!tu) return fail(res,404,'USER_NOT_FOUND');
        row.to_user_id=tu.id; row.to_email=tu.email||null;
      }else{
        const tu=await getStudentByPhone(target); if(!tu) return fail(res,404,'USER_NOT_FOUND');
        row.to_user_id=tu.id; row.to_email=tu.email||null;
      }
      await sb('notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(row)});
      await audit(sessionUser(req),'notification_sent',{title,body:text,target:target});
      return ok(res);
    }
    if(action==='support' && method==='GET'){
      const u=requireUser(req);
      let query='tickets?select=id,user_id,user_name,user_email,subject,category,priority,status,created_at,updated_at&order=updated_at.desc&limit=200';
      if(!isStaff(u.role)) query += `&user_id=eq.${eq(u.id)}`;
      const tickets=await sb(query); const out=[]; for(const t of tickets||[]){ const full=await ticketWithMessages(t.id); out.push(flattenTicket(full)); }
      return ok(res,{tickets:out,isAdmin:isStaff(u.role)});
    }
    if(action==='support' && method==='POST'){
      const u=requireUser(req); if(isStaff(u.role) && u.role!=='owner') return fail(res,403,'FORBIDDEN');
      const msg=String(body.message||'').trim().slice(0,5000); if(!msg) return fail(res,422,'EMPTY_MESSAGE');
      const id=`TCK-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const created=now();
      await sb('tickets',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({id,user_id:u.id,user_name:u.name||'طالب',user_email:u.email||null,subject:'طلب دعم',category:'other',priority:'medium',status:'open',assigned_role:'support',created_at:created,updated_at:created})});
      await sb('ticket_messages',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({ticket_id:id,from_role:'student',author_name:u.name||'طالب',text:msg,created_at:created})});
      await sb('notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({title:'تذكرة دعم جديدة',body:`${u.name||'طالب'}: طلب دعم`,to_role:'staff',created_at:created})});
      await audit(u,'ticket_created',{ticket_id:id,subject:'طلب دعم'});
      return ok(res,{id});
    }
    if(action==='support_reply' && method==='POST'){
      const u=requireStaff(req); const id=String(body.id||''); const reply=String(body.reply||'').trim().slice(0,5000); if(!id||!reply) return fail(res,422,'BAD_REQUEST');
      const t=await ticketWithMessages(id); if(!t) return fail(res,404,'NOT_FOUND');
      const at=now(); await sb('ticket_messages',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({ticket_id:id,from_role:u.role,author_name:u.name||'فريق الدعم',text:reply,created_at:at})});
      await sb(`tickets?id=eq.${eq(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'progress',updated_at:at})});
      await sb('notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({title:'رد جديد على تذكرتك',body:'فريق الدعم رد على تذكرتك.',to_user_id:t.user_id,to_email:t.user_email||null,created_at:at})});
      await audit(u,'ticket_reply',{ticket_id:id,subject:t.subject});
      return ok(res);
    }
    if(action==='admin_chat' && method==='GET'){
      const u=requireStaff(req);
      const rows=await sb('admin_chat_messages?select=id,user_id,author_name,author_role,text,created_at&order=created_at.asc&limit=300');
      return ok(res,{messages:(rows||[]).map(m=>({id:m.id,userId:m.user_id,authorName:m.author_name,authorRole:m.author_role,text:m.text,createdAt:m.created_at}))});
    }
    if(action==='admin_chat' && method==='POST'){
      const u=requireStaff(req);
      const text=String(body.text||'').trim().slice(0,4000);
      if(!text) return fail(res,422,'EMPTY_MESSAGE');
      const at=now();
      const inserted=await sb('admin_chat_messages',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({user_id:u.id,author_name:u.name||'فريق الإدارة',author_role:u.role,text,created_at:at})});
      await sb('notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({title:'رسالة جديدة في شات الإدارة',body:`${u.name||'فريق الإدارة'}: ${text.slice(0,120)}`,to_role:'staff',created_at:at})});
      await audit(u,'admin_chat_message',{text:text.slice(0,240)});
      return ok(res,{message:inserted?.[0]||{id:null,user_id:u.id,author_name:u.name||'فريق الإدارة',author_role:u.role,text,created_at:at}});
    }
    if(action==='ticket_list' && method==='GET'){
      const u=requireUser(req);
      let query='tickets?select=id,user_id,user_name,user_email,subject,category,priority,status,assigned_role,created_at,updated_at&order=updated_at.desc&limit=200';
      if(!isStaff(u.role)) query += `&user_id=eq.${eq(u.id)}`;
      const rows=await sb(query); const out=[]; for(const t of rows||[]) out.push(await ticketWithMessages(t.id));
      return ok(res,{tickets:out.filter(Boolean),isAdmin:isStaff(u.role)});
    }
    if(action==='ticket_create' && method==='POST'){
      const u=requireUser(req); if(isStaff(u.role) && u.role!=='owner') return fail(res,403,'FORBIDDEN');
      const id=String(body.id||'').slice(0,80) || `TCK-${Date.now().toString(36).toUpperCase()}`;
      const subject=String(body.subject||'').trim().slice(0,180), category=String(body.category||'other'), priority=String(body.priority||'medium'), message=String(body.message||'').trim().slice(0,5000);
      if(!subject||!message) return fail(res,422,'BAD_REQUEST');
      const at=now();
      const existing=await sb(`tickets?select=id&id=eq.${eq(id)}&limit=1`); if(existing?.length) return ok(res,{ticket:await ticketWithMessages(id)});
      await sb('tickets',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({id,user_id:u.id,user_name:u.name||'طالب',user_email:u.email||null,subject,category,priority,status:'open',assigned_role:'support',created_at:at,updated_at:at})});
      await sb('ticket_messages',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({ticket_id:id,from_role:'student',author_name:u.name||'طالب',text:message,created_at:at})});
      await sb('notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({title:'تذكرة دعم جديدة',body:`${u.name||'طالب'}: ${subject}`,to_role:'staff',created_at:at})});
      await audit(u,'ticket_created',{ticket_id:id,subject,category,priority});
      return ok(res,{ticket:await ticketWithMessages(id)});
    }
    if(action==='ticket_reply' && method==='POST'){
      const u=requireUser(req); const id=String(body.id||''), text=String(body.text||'').trim().slice(0,5000); if(!id||!text) return fail(res,422,'BAD_REQUEST');
      const t=await ticketWithMessages(id); if(!t) return fail(res,404,'NOT_FOUND');
      if(!isStaff(u.role) && String(t.user_id)!==String(u.id)) return fail(res,403,'FORBIDDEN');
      const at=now(); await sb('ticket_messages',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({ticket_id:id,from_role:isStaff(u.role)?u.role:'student',author_name:u.name||'طالب',text,created_at:at})});
      const status=isStaff(u.role) ? ((t.status==='open'||t.status==='closed')?'progress':t.status) : ((t.status==='resolved'||t.status==='closed')?'open':t.status);
      await sb(`tickets?id=eq.${eq(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,updated_at:at})});
      if(isStaff(u.role)) await sb('notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({title:'رد جديد على تذكرتك',body:t.subject,to_user_id:t.user_id,to_email:t.user_email||null,created_at:at})});
      else await sb('notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({title:'رد جديد من طالب',body:`${u.name||'طالب'}: ${t.subject}`,to_role:'staff',created_at:at})});
      await audit(u,'ticket_reply',{ticket_id:id,subject:t.subject,as_staff:isStaff(u.role)});
      return ok(res,{ticket:await ticketWithMessages(id)});
    }
    if(action==='ticket_status' && method==='POST'){
      requireStaff(req); const id=String(body.id||''), status=String(body.status||''); if(!id) return fail(res,422,'BAD_REQUEST');
      if(!['open','progress','resolved','closed'].includes(status)) return fail(res,422,'BAD_STATUS');
      await sb(`tickets?id=eq.${eq(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,updated_at:now()})}); return ok(res);
    }
    if(action==='ticket_priority' && method==='POST'){
      requireStaff(req); const id=String(body.id||''), priority=String(body.priority||''); if(!id||!['low','medium','high','urgent'].includes(priority)) return fail(res,422,'BAD_PRIORITY');
      await sb(`tickets?id=eq.${eq(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({priority,updated_at:now()})}); return ok(res);
    }
    if(action==='ticket_mark_read' && method==='POST'){
      requireUser(req); return ok(res);
    }
    if(action==='users' && method==='GET'){
      const actor=requireUser(req);
      if(actor.role!=='owner') return fail(res,403,'OWNER_ONLY');
      // لا نعتمد على state هنا حتى لا تتعطل لوحة الحسابات إذا كانت قاعدة البيانات قديمة.
      const rows=await sb('users?select=id,name,email,phone,role,created_at,updated_at&order=created_at.desc&limit=500');
      return ok(res,{source:'supabase',total:Array.isArray(rows)?rows.length:0,users:(rows||[]).map(u=>({
        id:u.id,name:u.name,email:u.email||'',phone:u.phone||'',role:u.role||'student',
        grade:'',branch:'',created_at:u.created_at,updated_at:u.updated_at
      }))});
    }
    if(action==='user_role' && method==='POST'){
      const actor=requireUser(req);
      if(actor.role!=='owner') return fail(res,403,'OWNER_ONLY');
      const rawPhone=String(body.phone||'').trim(), id=String(body.id||''), role=String(body.role||'student');
      if((!rawPhone&&!id)||!ALL_ROLES.has(role)||role==='owner') return fail(res,422,'ROLE_NOT_ALLOWED');
      const target=rawPhone ? await getStudentByPhone(rawPhone) : await getUserById(id);
      if(!target) return fail(res,404,'USER_NOT_FOUND');
      if(target.role==='owner') return fail(res,403,'OWNER_PROTECTED');
      await sb(`users?id=eq.${eq(target.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({role,updated_at:now()})});
      await sb('notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({title:'تم تحديث رتبتك',body:`تم تعيين رتبتك إلى ${role}.`,to_user_id:target.id,to_email:target.email||null,created_at:now()})});
      await audit(actor,'role_changed',{from_role:target.role,to_role:role,phone:target.phone||''},target);
      return ok(res,{user:{id:target.id,name:target.name,phone:target.phone,email:target.email||'',role}});
    }
    if(action==='user_email' && method==='POST'){
      const actor=requireUser(req);
      if(actor.role!=='owner') return fail(res,403,'OWNER_ONLY');
      const phone=String(body.phone||'').trim(), e=email(body.email);
      if(!validPhone(phone)) return fail(res,422,'INVALID_PHONE');
      if(!e || !validEmail(e)) return fail(res,422,'INVALID_EMAIL');
      if(OWNER_EMAILS.has(e)) return fail(res,409,'EMAIL_EXISTS');
      const target=await getStudentByPhone(phone); if(!target) return fail(res,404,'USER_NOT_FOUND');
      const existing=await getStudentByEmail(e); if(existing && String(existing.id)!==String(target.id)) return fail(res,409,'EMAIL_EXISTS');
      await sb(`users?id=eq.${eq(target.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({email:e,updated_at:now()})});
      await audit(actor,'email_changed',{email:e},target);
      return ok(res,{user:{id:target.id,name:target.name,phone:target.phone,email:e,role:target.role}});
    }
    if(action==='user_delete' && method==='POST'){
      const actor=requireUser(req);
      if(actor.role!=='owner') return fail(res,403,'OWNER_ONLY');
      const rawId=String(body.id||'').trim(), rawPhone=String(body.phone||'').trim();
      if(!rawId && !rawPhone) return fail(res,422,'USER_REQUIRED');
      const target=rawId ? await getUserById(rawId) : await getStudentByPhone(rawPhone);
      if(!target) return fail(res,404,'USER_NOT_FOUND');
      if(String(target.role||'')==='owner') return fail(res,403,'OWNER_PROTECTED');
      if(String(target.id)===String(actor.id)) return fail(res,403,'CANNOT_DELETE_SELF');
      await audit(actor,'user_deleted',{phone:target.phone||'',email:target.email||'',role:target.role||'student'},target);
      await sb(`users?id=eq.${eq(target.id)}`,{method:'DELETE',headers:{Prefer:'return=minimal'}});
      return ok(res,{deleted:{id:target.id,name:target.name,phone:target.phone||'',email:target.email||'',role:target.role||'student'}});
    }
    if(action==='audit_logs' && method==='GET'){
      const owner=requireUser(req);
      if(owner.role!=='owner') return fail(res,403,'OWNER_ONLY');
      const limit=Math.min(Math.max(Number(body.limit||req.query.limit||100)||100,1),300);
      const rows=await sb(`audit_logs?select=id,actor_user_id,actor_name,actor_role,action,target_user_id,target_name,details,created_at&order=created_at.desc&limit=${limit}`);
      return ok(res,{logs:(rows||[]).map(x=>({id:x.id,actorUserId:x.actor_user_id,actorName:x.actor_name,actorRole:x.actor_role,action:x.action,targetUserId:x.target_user_id,targetName:x.target_name,details:x.details||{},createdAt:x.created_at}))});
    }
    return fail(res,404,'NOT_FOUND');
  }catch(e){
    const status=e.status||500; return fail(res,status,e.code||'SERVER_ERROR');
  }
}

module.exports = handler;
