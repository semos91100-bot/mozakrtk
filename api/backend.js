'use strict';

const crypto = require('crypto');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
const SESSION_SECRET = String(process.env.SESSION_SECRET || (SUPABASE_SERVICE_ROLE_KEY ? crypto.createHash('sha256').update(SUPABASE_SERVICE_ROLE_KEY).digest('hex') : ''));
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || 'semos91100@gmail.com').trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || 'alton112233');

function configured(){ return !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && SESSION_SECRET); }
function send(res, status, data, extraHeaders={}){
  Object.entries(extraHeaders).forEach(([k,v])=>res.setHeader(k,v));
  res.status(status).json(data);
}
function now(){ return new Date().toISOString(); }
function email(v){ return String(v || '').trim().toLowerCase(); }
function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 190; }
function hashPassword(text){ return crypto.createHash('sha256').update(String(text)).digest('hex'); }
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
    if(!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
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
  const token = signPayload({id:String(user.id),email:user.email,role:user.role,name:user.name,exp:Date.now()+1000*60*60*24*30});
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
function requireAdmin(req){ const u=requireUser(req); if(u.role!=='admin') throw Object.assign(new Error('FORBIDDEN'),{code:'FORBIDDEN',status:403}); return u; }
function ok(res,data={}){ send(res,200,{ok:true,...data}); }
function fail(res,status,error){ send(res,status,{ok:false,error}); }

async function getStudentById(id){
  const rows=await sb(`users?select=id,email,name,password_hash,state,created_at,updated_at&id=eq.${eq(id)}&limit=1`);
  return rows?.[0]||null;
}
async function getStudentByEmail(e){
  const rows=await sb(`users?select=id,email,name,password_hash,state,created_at,updated_at&email=eq.${eq(e)}&limit=1`);
  return rows?.[0]||null;
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
  const lastAdmin=[...msgs].reverse().find(m=>m.from==='admin');
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
      const e=email(body.email), pass=String(body.password||'');
      if(e===ADMIN_EMAIL){
        if(pass!==ADMIN_PASSWORD) return fail(res,401,'LOGIN_FAILED');
        const u={id:-1,email:ADMIN_EMAIL,name:'Admin',role:'admin'}; setSession(res,u); return ok(res,{authenticated:true,user:u});
      }
      const u=await getStudentByEmail(e);
      if(!u || u.password_hash!==hashPassword(pass)) return fail(res,401,'LOGIN_FAILED');
      const safe={id:u.id,email:u.email,name:u.name,role:'student'}; setSession(res,safe); return ok(res,{authenticated:true,user:safe});
    }
    if(action==='signup' && method==='POST'){
      const e=email(body.email), pass=String(body.password||''), name=String(body.name||'').trim().slice(0,120);
      if(!validEmail(e)) return fail(res,422,'INVALID_EMAIL');
      if(pass.length<8) return fail(res,422,'PASSWORD_SHORT');
      if(e===ADMIN_EMAIL) return fail(res,409,'EMAIL_EXISTS');
      const existing=await getStudentByEmail(e); if(existing) return fail(res,409,'EMAIL_EXISTS');
      const inserted=await sb('users',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({email:e,name:name||'طالب',password_hash:hashPassword(pass),state:{},created_at:now(),updated_at:now()})});
      const u=inserted[0], safe={id:u.id,email:u.email,name:u.name,role:'student'}; setSession(res,safe); return ok(res,{authenticated:true,user:safe});
    }
    if(action==='logout' && method==='POST'){ clearSession(res); return ok(res); }
    if(action==='state'){
      const u=requireUser(req); if(u.role==='admin') return ok(res,{state:{},updated:Date.now()});
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
      requireAdmin(req); if(method==='POST'){
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
        const extraAdmin = u.role==='admin' ? `,to_email.eq.all-admins` : '';
        const rows=await sb(`notifications?select=id,title,body,to_email,created_at&id=gt.0&or=(to_email.eq.all,to_email.eq.${eq(u.email)}${extraAdmin})&order=created_at.desc&limit=100`);
        return ok(res,{notifications:(rows||[]).map(n=>({id:n.id,title:n.title,body:n.body,to:n.to_email,created_at:Math.floor(new Date(n.created_at).getTime()/1000)}))});
      }
      requireAdmin(req);
      const title=String(body.title||'').trim().slice(0,150), text=String(body.body||'').trim().slice(0,1000), to=email(body.to||'all');
      if(!title) return fail(res,422,'EMPTY_TITLE');
      if(to!=='all' && !validEmail(to)) return fail(res,422,'INVALID_EMAIL');
      await sb('notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({title,body:text,to_email:to,created_at:now()})});
      return ok(res);
    }
    if(action==='support' && method==='GET'){
      const u=requireUser(req);
      let query='tickets?select=id,user_id,user_name,user_email,subject,category,priority,status,created_at,updated_at&order=updated_at.desc&limit=200';
      if(u.role!=='admin') query += `&user_id=eq.${eq(u.id)}`;
      const tickets=await sb(query); const out=[]; for(const t of tickets||[]){ const full=await ticketWithMessages(t.id); out.push(flattenTicket(full)); }
      return ok(res,{tickets:out,isAdmin:u.role==='admin'});
    }
    if(action==='support' && method==='POST'){
      const u=requireUser(req); const msg=String(body.message||'').trim().slice(0,5000); if(!msg) return fail(res,422,'EMPTY_MESSAGE');
      const id=`TCK-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
      const created=now();
      await sb('tickets',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({id,user_id:u.id,user_name:u.name||'طالب',user_email:u.email,subject:'طلب دعم',category:'other',priority:'medium',status:'open',created_at:created,updated_at:created})});
      await sb('ticket_messages',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({ticket_id:id,from_role:'student',author_name:u.name||'طالب',text:msg,created_at:created})});
      await sb('notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({title:'تذكرة دعم جديدة',body:`${u.name||'طالب'}: طلب دعم`,to_email:'all-admins',created_at:created})});
      return ok(res,{id});
    }
    if(action==='support_reply' && method==='POST'){
      const u=requireAdmin(req); const id=String(body.id||''); const reply=String(body.reply||'').trim().slice(0,5000); if(!id||!reply) return fail(res,422,'BAD_REQUEST');
      const t=await ticketWithMessages(id); if(!t) return fail(res,404,'NOT_FOUND');
      const at=now(); await sb('ticket_messages',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({ticket_id:id,from_role:'admin',author_name:u.name||'فريق الدعم',text:reply,created_at:at})});
      await sb(`tickets?id=eq.${eq(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'progress',updated_at:at})});
      await sb('notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({title:'رد جديد على تذكرتك',body:'فريق الدعم رد على تذكرتك.',to_email:t.user_email,created_at:at})});
      return ok(res);
    }
    if(action==='ticket_list' && method==='GET'){
      const u=requireUser(req);
      let query='tickets?select=id,user_id,user_name,user_email,subject,category,priority,status,created_at,updated_at&order=updated_at.desc&limit=200';
      if(u.role!=='admin') query += `&user_id=eq.${eq(u.id)}`;
      const rows=await sb(query); const out=[]; for(const t of rows||[]) out.push(await ticketWithMessages(t.id));
      return ok(res,{tickets:out.filter(Boolean),isAdmin:u.role==='admin'});
    }
    if(action==='ticket_create' && method==='POST'){
      const u=requireUser(req); if(u.role==='admin') return fail(res,403,'FORBIDDEN');
      const id=String(body.id||'').slice(0,80) || `TCK-${Date.now().toString(36).toUpperCase()}`;
      const subject=String(body.subject||'').trim().slice(0,180), category=String(body.category||'other'), priority=String(body.priority||'medium'), message=String(body.message||'').trim().slice(0,5000);
      if(!subject||!message) return fail(res,422,'BAD_REQUEST');
      const at=now();
      const existing=await sb(`tickets?select=id&id=eq.${eq(id)}&limit=1`); if(existing?.length) return ok(res,{ticket:await ticketWithMessages(id)});
      await sb('tickets',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({id,user_id:u.id,user_name:u.name||'طالب',user_email:u.email,subject,category,priority,status:'open',created_at:at,updated_at:at})});
      await sb('ticket_messages',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({ticket_id:id,from_role:'student',author_name:u.name||'طالب',text:message,created_at:at})});
      await sb('notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({title:'تذكرة دعم جديدة',body:`${u.name||'طالب'}: ${subject}`,to_email:'all-admins',created_at:at})});
      return ok(res,{ticket:await ticketWithMessages(id)});
    }
    if(action==='ticket_reply' && method==='POST'){
      const u=requireUser(req); const id=String(body.id||''), text=String(body.text||'').trim().slice(0,5000); if(!id||!text) return fail(res,422,'BAD_REQUEST');
      const t=await ticketWithMessages(id); if(!t) return fail(res,404,'NOT_FOUND');
      if(u.role!=='admin' && String(t.user_id)!==String(u.id)) return fail(res,403,'FORBIDDEN');
      const at=now(); await sb('ticket_messages',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({ticket_id:id,from_role:u.role==='admin'?'admin':'student',author_name:u.name||'طالب',text,created_at:at})});
      const status=u.role==='admin' ? ((t.status==='open'||t.status==='closed')?'progress':t.status) : ((t.status==='resolved'||t.status==='closed')?'open':t.status);
      await sb(`tickets?id=eq.${eq(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,updated_at:at})});
      if(u.role==='admin') await sb('notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({title:'رد جديد على تذكرتك',body:t.subject,to_email:t.user_email,created_at:at})});
      else await sb('notifications',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({title:'رد جديد من طالب',body:`${u.name||'طالب'}: ${t.subject}`,to_email:'all-admins',created_at:at})});
      return ok(res,{ticket:await ticketWithMessages(id)});
    }
    if(action==='ticket_status' && method==='POST'){
      requireAdmin(req); const id=String(body.id||''), status=String(body.status||''); if(!id) return fail(res,422,'BAD_REQUEST');
      if(!['open','progress','resolved','closed'].includes(status)) return fail(res,422,'BAD_STATUS');
      await sb(`tickets?id=eq.${eq(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status,updated_at:now()})}); return ok(res);
    }
    if(action==='ticket_priority' && method==='POST'){
      requireAdmin(req); const id=String(body.id||''), priority=String(body.priority||''); if(!id||!['low','medium','high','urgent'].includes(priority)) return fail(res,422,'BAD_PRIORITY');
      await sb(`tickets?id=eq.${eq(id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({priority,updated_at:now()})}); return ok(res);
    }
    if(action==='ticket_mark_read' && method==='POST'){
      requireUser(req); return ok(res);
    }
    return fail(res,404,'NOT_FOUND');
  }catch(e){
    const status=e.status||500; return fail(res,status,e.code||'SERVER_ERROR');
  }
}

module.exports = handler;
