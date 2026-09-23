/* core.js — الحالة والتخزين والمزامنة والجدول الذكي والإشعارات والتنقّل */
/* ============================================================
   2) الحالة والتخزين
   ============================================================ */
const LS="mozakra_v1";
const DEF={
  name:"", onboarded:false, dailyGoal:120, sessionLen:40, windows:"مساءً",
  weak:[], examDate:"", theme:"", notifOn:true,
  done:{}, sessions:[], attempts:[], streak:0, lastDay:"", badges:[],
  schedule:null, seen:[], custom:{teachers:[],lessons:[],questions:[],files:[]}, updated:0,
  teachers:[], notifSeen:[]
};
let S = loadLocal();
let AUTH={user:null,ready:false,busy:false};
/* محتوى الموقع اللي بيضيفه المشرف (مدرّسين إضافيين/معدّلين) — مشترك بين كل الطلاب */
let SITECONTENT={teachers:[],removed:[]};
async function fetchContent(){
  try{ const d=await apiJSON("content"); if(d.ok&&d.content){ SITECONTENT={teachers:d.content.teachers||[],removed:d.content.removed||[]}; render(); } }catch(e){}
}
/* الإشعارات اللي بعتها المشرف */
let SERVERNOTIFS=[];
async function fetchNotifications(){
  if(!AUTH.user) return;
  try{ const d=await apiJSON("notifications"); if(d.ok){ SERVERNOTIFS=d.notifications||[]; render(); } }catch(e){}
}
/* تذاكر الدعم الفني */
let SUPPORT={tickets:[],isAdmin:false};
async function fetchSupport(){
  if(!AUTH.user) return;
  try{ const d=await apiJSON("support"); if(d.ok){ SUPPORT={tickets:d.tickets||[],isAdmin:!!d.isAdmin}; render(); } }catch(e){}
}
function loadLocal(){
  try{ const r=localStorage.getItem(LS); if(r) return Object.assign(structuredClone(DEF),JSON.parse(r)); }catch(e){}
  return structuredClone(DEF);
}
function saveLocal(){
  S.updated=Date.now();
  try{ localStorage.setItem(LS,JSON.stringify(S)); }catch(e){}
  cloudPush();
}
function apiUrl(action){ return `/api/vercel?action=${encodeURIComponent(action)}`; }
const AUTH_LS="mozakra_auth_v1";
const USERS_LS="mozakra_users_v1";
const CONTENT_LS="mozakra_sitecontent_v1";
const NOTIFS_LS="mozakra_servernotifs_v1";
const SUPPORT_LS="mozakra_support_v1";
const ADMIN_EMAIL="semos91100@gmail.com";
function readJSON(key, fallback){ try{ const r=localStorage.getItem(key); return r?JSON.parse(r):fallback; }catch(e){ return fallback; } }
function writeJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){} }
function localAuth(){ return readJSON(AUTH_LS,null); }
function setLocalAuth(u){ if(u) writeJSON(AUTH_LS,u); else { try{localStorage.removeItem(AUTH_LS);}catch(e){} } }
async function sha256Text(text){ const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
function currentLocalAccount(){ const u=localAuth(); if(!u) return null; const users=readJSON(USERS_LS,[]); return users.find(x=>x.email===u.email) || (u.role==='admin'?u:null); }
function localResult(action, opts){
  const method=(opts.method||'GET').toUpperCase();
  const u=currentLocalAccount();
  let d={}; try{ d=opts.body?JSON.parse(opts.body):{}; }catch(e){}
  if(action==='state'){
    if(method==='GET') return {ok:true,state:u?.state||null,updated:u?.updated||0};
    if(method==='POST'){
      if(!u) return {ok:false,error:'AUTH_REQUIRED',httpStatus:401};
      const users=readJSON(USERS_LS,[]); const idx=users.findIndex(x=>x.email===u.email); if(idx>=0){ users[idx].state=d.state||{}; users[idx].name=String((d.state&&d.state.name)||users[idx].name||''); users[idx].updated=Date.now(); writeJSON(USERS_LS,users); }
      return {ok:true,updated:Date.now()};
    }
  }
  if(action==='content' && method==='GET') return {ok:true,content:readJSON(CONTENT_LS,{teachers:[],removed:[]})};
  if(action==='content' && method==='POST') { if(!u || u.role!=='admin') return {ok:false,error:'FORBIDDEN',httpStatus:403}; writeJSON(CONTENT_LS,{teachers:Array.isArray(d.teachers)?d.teachers:[],removed:Array.isArray(d.removed)?d.removed:[]}); return {ok:true}; }
  if(action==='notifications' && method==='GET'){
    if(!u) return {ok:false,error:'AUTH_REQUIRED',httpStatus:401};
    const all=readJSON(NOTIFS_LS,[]); const email=(u.email||'').toLowerCase(); const mine=all.filter(n=>n.to==='all'||String(n.to||'').toLowerCase()===email).sort((a,b)=>(b.created_at||0)-(a.created_at||0)).slice(0,50); return {ok:true,notifications:mine};
  }
  if(action==='notifications' && method==='POST'){ if(!u||u.role!=='admin') return {ok:false,error:'FORBIDDEN',httpStatus:403}; const all=readJSON(NOTIFS_LS,[]); all.push({id:Date.now(),title:String(d.title||''),body:String(d.body||''),to:String(d.to||'all').toLowerCase(),created_at:Date.now()}); writeJSON(NOTIFS_LS,all); return {ok:true}; }
  if(action==='support' && method==='GET'){ if(!u) return {ok:false,error:'AUTH_REQUIRED',httpStatus:401}; const all=readJSON(SUPPORT_LS,[]); const tickets=u.role==='admin'?all:all.filter(t=>t.email===u.email); return {ok:true,tickets:tickets.sort((a,b)=>(b.created_at||0)-(a.created_at||0)),isAdmin:u.role==='admin'}; }
  if(action==='support' && method==='POST'){ if(!u) return {ok:false,error:'AUTH_REQUIRED',httpStatus:401}; if(!String(d.message||'').trim()) return {ok:false,error:'EMPTY_MESSAGE',httpStatus:422}; const all=readJSON(SUPPORT_LS,[]); all.push({id:Date.now(),uid:u.id||0,email:u.email,name:u.name||'',message:String(d.message).slice(0,2000),reply:null,status:'open',created_at:Date.now(),replied_at:null}); writeJSON(SUPPORT_LS,all); return {ok:true}; }
  if(action==='support_reply' && method==='POST'){ if(!u||u.role!=='admin') return {ok:false,error:'FORBIDDEN',httpStatus:403}; const all=readJSON(SUPPORT_LS,[]); const idx=all.findIndex(t=>Number(t.id)===Number(d.id)); if(idx<0) return {ok:false,error:'NOT_FOUND',httpStatus:404}; all[idx].reply=String(d.reply||'').slice(0,2000); all[idx].status='answered'; all[idx].replied_at=Date.now(); writeJSON(SUPPORT_LS,all); return {ok:true}; }
  return null;
}
async function apiJSON(action,opts={}){
  if(['state','content','notifications','support','support_reply'].includes(action)){
    const local=localResult(action,opts); if(local) return local;
  }
  if(action==='me'){
    try{ const r=await fetch(apiUrl('me'),{credentials:'same-origin'}); const d=await r.json(); if(d.authenticated){ setLocalAuth(d.user); return d; } }catch(e){}
    const u=localAuth(); return u?{ok:true,authenticated:true,user:u}:{ok:true,authenticated:false};
  }
  if(action==='login'){
    let d={}; try{ d=opts.body?JSON.parse(opts.body):{}; }catch(e){}
    const email=String(d.email||'').trim().toLowerCase(); const password=String(d.password||'');
    if(email===ADMIN_EMAIL){
      try{ const r=await fetch(apiUrl('login'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)}); const out=await r.json(); if(out.ok){ setLocalAuth(out.user); return out; } return out; }catch(e){ return {ok:false,error:'NETWORK_ERROR'}; }
    }
    const users=readJSON(USERS_LS,[]); const h=await sha256Text(password); const found=users.find(x=>x.email===email&&x.password_hash===h);
    if(!found) return {ok:false,error:'LOGIN_FAILED',httpStatus:401}; const user={id:found.id,email:found.email,name:found.name,role:'student'}; setLocalAuth(user); return {ok:true,authenticated:true,user};
  }
  if(action==='signup'){
    let d={}; try{ d=opts.body?JSON.parse(opts.body):{}; }catch(e){}
    const email=String(d.email||'').trim().toLowerCase(), name=String(d.name||'').trim(), pass=String(d.password||'');
    if(email===ADMIN_EMAIL) return {ok:false,error:'EMAIL_EXISTS',httpStatus:409};
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return {ok:false,error:'INVALID_EMAIL',httpStatus:422};
    if(pass.length<8) return {ok:false,error:'PASSWORD_SHORT',httpStatus:422};
    const users=readJSON(USERS_LS,[]); if(users.some(x=>x.email===email)) return {ok:false,error:'EMAIL_EXISTS',httpStatus:409};
    users.push({id:Date.now(),email,name:name.slice(0,120),password_hash:await sha256Text(pass),state:{},updated:Date.now()}); writeJSON(USERS_LS,users); const user={id:users.at(-1).id,email,name:name.slice(0,120),role:'student'}; setLocalAuth(user); return {ok:true,authenticated:true,user};
  }
  if(action==='logout'){ try{ await fetch(apiUrl('logout'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'}); }catch(e){} setLocalAuth(null); return {ok:true}; }
  try{
    const r=await fetch(apiUrl(action),{credentials:'same-origin',headers:{'Content-Type':'application/json',...(opts.headers||{})},...opts});
    let d=null; try{d=await r.json();}catch(e){d={ok:false,error:'BAD_RESPONSE'};}
    if(!r.ok && !d.error) d.error='REQUEST_FAILED'; d.httpStatus=r.status; return d;
  }catch(e){ return {ok:false,error:'NETWORK_ERROR'}; }
}
async function initAuth(){
  try{
    const d=await apiJSON("me");
    if(d.authenticated){ AUTH.user=d.user; const st=await apiJSON("state"); if(st.ok&&st.state&&Object.keys(st.state).length){ S=Object.assign(structuredClone(DEF),st.state); try{localStorage.setItem(LS,JSON.stringify(S));}catch(e){} } else { await apiJSON("state",{method:"POST",body:JSON.stringify({state:S})}); } }
  }catch(e){}
  AUTH.ready=true; render(); renderAuth();
  if(AUTH.user && !S.onboarded) onboarding();
  if(AUTH.user) fetchNotifications();
}
async function loginAccount(email,password){
  email=(email||"").trim().toLowerCase(); password=password||"";
  if(!email) { renderAuth("اكتب البريد الإلكتروني."); return; }
  if(!password) { renderAuth("اكتب كلمة المرور."); return; }
  AUTH.busy=true; renderAuth();
  const d=await apiJSON("login",{method:"POST",body:JSON.stringify({email,password})});
  if(!d.ok){ AUTH.busy=false; renderAuth(authMessage(d.error)); return; }
  AUTH.user=d.user;
  const st=await apiJSON("state");
  if(st.ok&&st.state&&Object.keys(st.state).length) S=Object.assign(structuredClone(DEF),st.state);
  else await apiJSON("state",{method:"POST",body:JSON.stringify({state:S})});
  AUTH.busy=false; render(); if(!S.onboarded) onboarding(); fetchNotifications();
}
async function signupAccount(name,email,password){
  AUTH.busy=true; renderAuth();
  const d=await apiJSON("signup",{method:"POST",body:JSON.stringify({name,email,password})});
  if(!d.ok){ AUTH.busy=false; renderAuth(authMessage(d.error)); return; }
  AUTH.user=d.user; S.name=name.trim()||S.name; S.updated=Date.now();
  await apiJSON("state",{method:"POST",body:JSON.stringify({state:S})});
  AUTH.busy=false; render(); if(!S.onboarded) onboarding(); fetchNotifications();
}
async function logoutAccount(){
  await apiJSON("logout",{method:"POST",body:"{}"}); AUTH.user=null; AUTH.ready=true; SERVERNOTIFS=[]; SUPPORT={tickets:[],isAdmin:false}; renderAuth();
}
function authMessage(code){
  return ({NETWORK_ERROR:"مش قادر أوصل بالسيرفر. اتأكد إن رابط الموقع صحيح وإن دالة Vercel شغالة.",BAD_RESPONSE:"السيرفر رجّع رد غير مفهوم. اتأكد إن نسخة Vercel مرفوعة كاملة.",TOO_MANY_ATTEMPTS:"محاولات دخول كتير. استنى شوية وجرب تاني.",STORAGE_ERROR:"الموقع مش قادر يحفظ البيانات المحلية في المتصفح.",EMAIL_EXISTS:"الإيميل ده مسجل بالفعل.",LOGIN_FAILED:"الإيميل أو كلمة المرور غير صحيحة.",INVALID_EMAIL:"اكتب بريد إلكتروني صحيح.",PASSWORD_SHORT:"كلمة المرور لازم تكون 8 أحرف على الأقل.",PASSWORD_LONG:"كلمة المرور طويلة جدًا.",REQUEST_FAILED:"حصلت مشكلة في الاتصال بالسيرفر.",SERVER_ERROR:"حصل خطأ في السيرفر.",AI_NOT_CONFIGURED:"مدرس AI محتاج تفعيل مفتاح Gemini على السيرفر."}[code]||"حصل خطأ. جرّب تاني.");
}
let cloudTimer=null;
function cloudPush(){
  if(!AUTH.user) return;
  clearTimeout(cloudTimer);
  cloudTimer=setTimeout(async()=>{
    try{ await apiJSON("state",{method:"POST",body:JSON.stringify({state:S})}); }catch(e){}
  },700);
}

/* ============================================================
   3) أدوات
   ============================================================ */
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const today=()=>new Date().toISOString().slice(0,10);
const fmtMin=m=>m>=60?`${Math.floor(m/60)} س ${m%60?m%60+" د":""}`.trim():`${m} د`;
function toast(t){ const d=document.createElement("div"); d.className="toast"; d.textContent=t; document.body.appendChild(d); setTimeout(()=>d.remove(),2600); }
function sid2(id){ return id.split("-")[0]; }

function teachers(){
  const removed=new Set(SITECONTENT.removed||[]);
  const m=new Map();
  TEACHERS.filter(t=>!removed.has(t.id)).forEach(t=>m.set(t.id,t));
  (SITECONTENT.teachers||[]).forEach(t=>m.set(t.id,t));
  return [...m.values()];
}
function questions(){ return QBANK.concat((S.custom.questions||[])); }
function lessonsOf(sid){
  const out=[]; const sub=CUR[sid]; if(!sub) return out;
  sub.units.forEach((u,ui)=>u.l.forEach((t,li)=>out.push({id:`${sid}-${ui+1}-${li+1}`,title:t,unit:u.n,ui:ui+1,li:li+1,sid})));
  (S.custom.lessons||[]).filter(x=>x.sid===sid).forEach(x=>out.push(x));
  return out;
}
function allLessons(){ return Object.keys(CUR).flatMap(lessonsOf); }
function lessonById(id){ return allLessons().find(l=>l.id===id); }
function contentOf(id){
  const c=(S.custom.lessons||[]).find(l=>l.id===id&&l.summary);
  return c||CONTENT[id]||null;
}
function progress(sid){
  const ls=lessonsOf(sid), d=ls.filter(l=>S.done[l.id]).length;
  return {done:d,total:ls.length,pct:ls.length?Math.round(d*100/ls.length):0};
}
function overall(){
  const ls=allLessons(), d=ls.filter(l=>S.done[l.id]).length;
  return {done:d,total:ls.length,pct:ls.length?Math.round(d*100/ls.length):0};
}
function accuracy(filter){
  const a=S.attempts.filter(filter||(()=>true));
  return a.length?Math.round(a.filter(x=>x.ok).length*100/a.length):null;
}
function minutesOn(day){ return S.sessions.filter(s=>s.day===day).reduce((t,s)=>t+s.min,0); }
function totalMinutes(){ return S.sessions.reduce((t,s)=>t+s.min,0); }
function daysToExam(){
  if(!S.examDate) return null;
  const d=Math.ceil((new Date(S.examDate)-new Date(today()))/864e5);
  return d;
}
function weakLessons(n=5){
  const m={};
  S.attempts.forEach(a=>{ if(!a.lesson) return; m[a.lesson]=m[a.lesson]||{w:0,t:0,sid:a.s}; m[a.lesson].t++; if(!a.ok)m[a.lesson].w++; });
  return Object.entries(m).filter(([,v])=>v.t>=2&&v.w>0)
    .sort((a,b)=>(b[1].w/b[1].t)-(a[1].w/a[1].t)).slice(0,n)
    .map(([id,v])=>({id,rate:Math.round(100-v.w*100/v.t),...v}));
}
function markStudied(min,sid){
  const d=today();
  S.sessions.push({day:d,min,s:sid||null});
  if(S.lastDay!==d){
    const y=new Date(Date.now()-864e5).toISOString().slice(0,10);
    S.streak = S.lastDay===y ? S.streak+1 : 1;
    S.lastDay=d;
  }
  saveLocal(); checkBadges();
}
function checkBadges(){
  const add=id=>{ if(!S.badges.includes(id)){ S.badges.push(id); toast("🏆 إنجاز جديد: "+ACHIEVEMENTS.find(a=>a.id===id).n); } };
  if(S.attempts.length>0) add("first_test");
  if(S.streak>=7) add("streak7");
  if(S.attempts.length>=100) add("q100");
  if(totalMinutes()>=600) add("hours10");
  Object.keys(CUR).forEach(sid=>{
    CUR[sid].units.forEach((u,ui)=>{ if(u.l.every((_,li)=>S.done[`${sid}-${ui+1}-${li+1}`])) add("unit1"); });
  });
  if(overall().total&&overall().done===overall().total) add("finish");
  saveLocal0();
}
function saveLocal0(){ try{ localStorage.setItem(LS,JSON.stringify(S)); }catch(e){} }

/* ============================================================
   4) الجدول الذكي
   ============================================================ */
function buildSchedule(){
  const goal=S.dailyGoal||120;
  const subs=Object.keys(CUR);
  const w={};
  subs.forEach(s=>{
    let weight=1;
    if(S.weak.includes(s)) weight+=0.8;
    const acc=accuracy(a=>a.s===s); if(acc!==null&&acc<65) weight+=0.5;
    const p=progress(s); if(p.pct<40) weight+=0.3;
    if(p.total&&p.done===p.total) weight=0;
    w[s]=weight;
  });
  const sum=subs.reduce((t,s)=>t+w[s],0)||1;
  const tasks=[];
  subs.forEach(s=>{
    if(!w[s]) return;
    let min=Math.round(goal*w[s]/sum/5)*5;
    if(min<10) min=10;
    const next=lessonsOf(s).find(l=>!S.done[l.id]);
    if(!next) return;
    tasks.push({s,min,lesson:next.id,title:next.title,unit:next.unit,done:false});
  });
  const carry=(S.schedule&&S.schedule.day!==today())?S.schedule.tasks.filter(t=>!t.done):[];
  carry.slice(0,2).forEach(t=>{ if(!tasks.some(x=>x.lesson===t.lesson)) tasks.push({...t,min:Math.min(t.min,25),carry:true}); });
  S.schedule={day:today(),tasks,goal};
  saveLocal();
  return S.schedule;
}
function todaySchedule(){
  if(!S.schedule||S.schedule.day!==today()) return buildSchedule();
  return S.schedule;
}

/* ============================================================
   5) الإشعارات
   ============================================================ */
function notifications(){
  const out=[]; const sch=todaySchedule();
  const left=sch.tasks.filter(t=>!t.done);
  if(left.length) out.push({e:"🎯",t:`باقي ${left.length} مهمة في جدول النهارده`,go:"#/schedule"});
  const m=minutesOn(today());
  if(m<S.dailyGoal) out.push({e:"⏱️",t:`ذاكرت ${fmtMin(m)} من هدف ${fmtMin(S.dailyGoal)}`,go:"#/timer"});
  const wl=weakLessons(1);
  if(wl.length){ const l=lessonById(wl[0].id); if(l) out.push({e:"⚠️",t:`نقطة ضعف: ${l.title} — نسبة صحّتك ${wl[0].rate}%`,go:"#/testme"}); }
  if(S.streak>=3) out.push({e:"🔥",t:`حافظت على الـStreak ${S.streak} يوم`,go:"#/achievements"});
  const d=daysToExam();
  if(d!==null&&d>=0) out.push({e:"📅",t:`فاضل ${d} يوم على الامتحانات`,go:"#/profile"});
  return out;
}

/* ============================================================
   6) التنقّل
   ============================================================ */
const NAV=[
  {h:"#/dash",i:"🏠",t:"الرئيسية"},
  {h:"#/schedule",i:"📅",t:"جدول المذاكرة"},
  {h:"#/subjects",i:"📚",t:"المواد"},
  {h:"#/teachers",i:"👨‍🏫",t:"المدرسين"},
  {h:"#/bank",i:"📝",t:"بنك الأسئلة"},
  {h:"#/testme",i:"🎯",t:"اختبرني"},
  {h:"#/exams",i:"🧪",t:"الامتحانات"},
  {h:"#/ai",i:"🤖",t:"مدرس AI"},
  {sep:1},
  {h:"#/stats",i:"📊",t:"مستواي"},
  {h:"#/timer",i:"⏱️",t:"مؤقت المذاكرة"},
  {h:"#/achievements",i:"🏆",t:"الإنجازات"},
  {sep:1},
  {h:"#/profile",i:"👤",t:"حسابي"},
  {h:"#/settings",i:"⚙️",t:"الإعدادات"}
];
const TABS=[{h:"#/dash",i:"🏠",t:"الرئيسية"},{h:"#/schedule",i:"📅",t:"جدولي"},{h:"#/subjects",i:"📚",t:"المواد"},{h:"#/ai",i:"🤖",t:"مدرس AI"},{h:"#/stats",i:"📊",t:"مستواي"}];
function navItems(){
  const items=[...NAV,{sep:1},{h:"#/support",i:"🆘",t:"الدعم الفني"}];
  if(AUTH.user&&AUTH.user.role==="admin") items.push({h:"#/admin",i:"🛠️",t:"لوحة التحكم"});
  return items;
}
function paintNav(){
  const cur=location.hash||"#/dash";
  $("#nav").innerHTML=navItems().map(n=>n.sep?'<div class="sep"></div>':
    `<a href="${n.h}" class="${cur.startsWith(n.h)?"on":""}"><i>${n.i}</i>${n.t}</a>`).join("");
  $("#tabbar").innerHTML=TABS.map(n=>`<a href="${n.h}" class="${cur.startsWith(n.h)?"on":""}"><i>${n.i}</i>${n.t}</a>`).join("");
}
