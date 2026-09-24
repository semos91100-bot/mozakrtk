/* core.js — الحالة والتخزين والمزامنة والجدول الذكي والإشعارات والتنقّل */
/* ============================================================
   2) الحالة والتخزين
   ============================================================ */
const LS="mozakra_v1";
const DEF={
  name:"", onboarded:false, grade:DEFAULT_EDUCATION.grade, branch:DEFAULT_EDUCATION.branch, dailyGoal:120, sessionLen:40, windows:"مساءً",
  weak:[], examDate:"", theme:"", notifOn:true,
  done:{}, sessions:[], attempts:[], streak:0, lastDay:"", badges:[],
  schedule:null, seen:[], custom:{teachers:[],lessons:[],questions:[],files:[]}, updated:0,
  teachers:[], notifSeen:[]
};
let S = loadLocal();
let AUTH={user:null,ready:false,busy:false};
// expose the same auth object to modules loaded in separate script scopes
globalThis.AUTH=AUTH;
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
let USERS=[];
let ADMINCHAT={messages:[]};
let AUDITLOGS=[];
async function fetchAuditLogs(){
  if(!AUTH.user || AUTH.user.role!=='owner') return;
  try{ const d=await apiJSON('audit_logs'); if(d.ok){ AUDITLOGS=d.logs||[]; if((location.hash||'').startsWith('#/admin')) render(); } }catch(e){}
}
const ROLE_META={owner:{name:"OWNER 👑",color:"var(--bad)"},admin:{name:"ADMIN 🔴",color:"var(--warn)"},moderator:{name:"MODERATOR 🟠",color:"var(--accent)"},support:{name:"SUPPORT 🔵",color:"var(--ok)"},student:{name:"STUDENT 👤",color:"var(--muted)"}};
const ROLE_LEVEL={student:0,support:1,moderator:2,admin:3,owner:4};
function roleLabel(role){ return ROLE_META[role]?.name||"STUDENT 👤"; }
function roleLevel(role){ return ROLE_LEVEL[role]??0; }
function isStaffRole(role){ return roleLevel(role)>=1; }
function isManagerRole(role){ return roleLevel(role)>=3; }
function canManageRolesRole(role){ return roleLevel(role)>=3; }
function isOwnerRole(role){ return role==="owner"; }
async function fetchSupport(){
  if(!AUTH.user) return;
  try{ const d=await apiJSON("support"); if(d.ok){ SUPPORT={tickets:d.tickets||[],isAdmin:!!d.isAdmin}; render(); } }catch(e){}
}
async function fetchAdminChat(){
  if(!AUTH.user || !isStaffRole(AUTH.user.role)) return;
  try{ const d=await apiJSON('admin_chat'); if(d.ok){ ADMINCHAT={messages:d.messages||[]}; if((location.hash||'').startsWith('#/admin-chat')) render(); } }catch(e){}
}
async function sendAdminChat(text){
  const d=await apiJSON('admin_chat',{method:'POST',body:JSON.stringify({text})});
  if(d.ok){ await fetchAdminChat(); return true; }
  toast(authMessage(d.error)); return false;
}
async function fetchUsers(){
  if(!AUTH.user || !isManagerRole(AUTH.user.role)) return;
  try{ const d=await apiJSON("users"); if(d.ok) USERS=d.users||[]; if((location.hash||"").startsWith("#/admin")) render(); }catch(e){}
}
function normalizeEducation(state){
  state=state&&typeof state==="object"?state:{};
  const grade=EDU.grades[state.grade]?state.grade:DEFAULT_EDUCATION.grade;
  const fallback=EDU.grades[grade]?.branches?.[0]?.id||DEFAULT_EDUCATION.branch;
  const branch=EDU.grades[grade]?.branches?.some(b=>b.id===state.branch)?state.branch:fallback;
  state.grade=grade; state.branch=branch;
  return state;
}
function loadLocal(){
  try{ const r=localStorage.getItem(LS); if(r) return normalizeEducation(Object.assign(structuredClone(DEF),JSON.parse(r))); }catch(e){}
  return structuredClone(DEF);
}
function saveLocal(){
  S.updated=Date.now();
  try{ localStorage.setItem(LS,JSON.stringify(S)); }catch(e){}
  cloudPush();
}
function apiUrl(action){ return `/api/backend?action=${encodeURIComponent(action)}`; }
async function apiJSON(action,opts={}){
  const remoteAllowed = location.protocol !== "file:";
  try{
    if(remoteAllowed){
      const r=await fetch(apiUrl(action),{credentials:"same-origin",headers:{"Content-Type":"application/json",...(opts.headers||{})},...opts});
      let d=null; try{d=await r.json();}catch(e){d={ok:false,error:"BAD_RESPONSE"};}
      if(!r.ok && !d.error) d.error="REQUEST_FAILED";
      d.httpStatus=r.status;
      // لو قاعدة البيانات المشتركة لسه مش مضافة على Vercel، استخدم الـLocal API
      // كخطة احتياطية حتى يفضل تسجيل الدخول والموقع شغالين. عند تفعيل Supabase
      // سيتم استخدام الـAPI المشترك تلقائيًا وتظهر التذاكر والإشعارات بين الأجهزة.
      if(d.error !== "BACKEND_NOT_CONFIGURED" && d.error !== "NETWORK_ERROR") return d;
    }
  }catch(e){
    if(remoteAllowed && location.hostname !== "localhost") return {ok:false,error:"NETWORK_ERROR"};
  }
  try{
    if(window.MozakraLocalAPI && typeof window.MozakraLocalAPI.handle === "function") return await window.MozakraLocalAPI.handle(action,opts);
  }catch(e){}
  return {ok:false,error:"NETWORK_ERROR"};
}
async function refreshSharedData(){
  if(!AUTH.user) return;
  try{
    if(window.MozakraTicketing && typeof MozakraTicketing.sync === "function") await MozakraTicketing.sync();
  }catch(e){}
  try{ await fetchNotifications(); }catch(e){}
  const route=(location.hash||"#/dash").slice(2).split("?")[0].split("/")[0];
  if(route==="support" || route==="admin") try{ await fetchSupport(); }catch(e){}
  if(route==="admin" && isManagerRole(AUTH.user.role)) try{ await fetchUsers(); }catch(e){}
  if(route==="admin" && AUTH.user.role==='owner') try{ await fetchAuditLogs(); }catch(e){}
  if(route==="admin-chat" && isStaffRole(AUTH.user.role)) try{ await fetchAdminChat(); }catch(e){}
}
let auditPollTimer=null;
function startAuditPolling(){
  clearInterval(auditPollTimer);
  if(!AUTH.user || AUTH.user.role!=='owner') return;
  auditPollTimer=setInterval(()=>{
    const route=(location.hash||'').slice(2).split('?')[0].split('/')[0];
    if(route==='admin') fetchAuditLogs();
  },8000);
}

async function initAuth(){
  try{
    const d=await apiJSON("me");
    if(d.authenticated){ AUTH.user=d.user; const st=await apiJSON("state"); if(st.ok&&st.state&&Object.keys(st.state).length){ S=normalizeEducation(Object.assign(structuredClone(DEF),st.state)); try{localStorage.setItem(LS,JSON.stringify(S));}catch(e){} } else { await apiJSON("state",{method:"POST",body:JSON.stringify({state:S})}); } }
  }catch(e){}
  AUTH.ready=true; render(); renderAuth();
  if(AUTH.user && !S.onboarded) onboarding();
  if(AUTH.user) {
    startAuditPolling();
    fetchNotifications();
    setTimeout(()=>refreshSharedData(),300);
    const route=(location.hash||"#/dash").slice(2).split("?")[0].split("/")[0];
    if(route==="support" || route==="admin") fetchSupport();
    if(route==="admin" && isManagerRole(AUTH.user.role)) fetchUsers();
    if(route==="admin" && AUTH.user.role==='owner') fetchAuditLogs();
    if(route==="admin-chat" && isStaffRole(AUTH.user.role)) fetchAdminChat();
  }
}
async function loginAccount(identifier,password,kind="student"){
  identifier=(identifier||"").trim(); password=password||"";
  if(!identifier){ renderAuth(kind==="staff"?"اكتب البريد الإلكتروني.":"اكتب رقم الموبايل."); return; }
  if(!password){ renderAuth("اكتب كلمة المرور."); return; }
  AUTH.busy=true; renderAuth();
  const d=await apiJSON("login",{method:"POST",body:JSON.stringify({identifier,phone:kind==="student"?identifier:"",email:kind==="staff"?identifier:"",password})});
  if(!d.ok){ AUTH.busy=false; renderAuth(authMessage(d.error)); return; }
  AUTH.user=d.user;
  const st=await apiJSON("state");
  if(st.ok&&st.state&&Object.keys(st.state).length) S=normalizeEducation(Object.assign(structuredClone(DEF),st.state));
  else if(!isStaffRole(AUTH.user.role)) await apiJSON("state",{method:"POST",body:JSON.stringify({state:S})});
  AUTH.busy=false;
  window.__authMode="login"; window.__authKind=isStaffRole(AUTH.user.role)?"staff":"student";
  $("#authLayer").innerHTML="";
  syncAuthButton();
  location.hash="#/dash";
  render();
  if(!S.onboarded && !isStaffRole(AUTH.user.role)) onboarding();
  await fetchNotifications(); await refreshSharedData();
  startAuditPolling();
}
async function signupAccount(name,phone,password,emailValue=""){
  phone=(phone||"").trim(); password=password||""; emailValue=(emailValue||"").trim().toLowerCase();
  if(!name) { renderAuth("اكتب اسمك."); return; }
  if(!phone) { renderAuth("اكتب رقم الموبايل."); return; }
  if(!password) { renderAuth("اكتب كلمة المرور."); return; }
  AUTH.busy=true; renderAuth();
  const d=await apiJSON("signup",{method:"POST",body:JSON.stringify({name,phone,password,email:emailValue})});
  if(!d.ok){ AUTH.busy=false; renderAuth(authMessage(d.error)); return; }
  AUTH.user=d.user; S.name=name.trim()||S.name; S.updated=Date.now();
  await apiJSON("state",{method:"POST",body:JSON.stringify({state:S})});
  AUTH.busy=false; window.__authMode="login"; window.__authKind="student";
  $("#authLayer").innerHTML=""; syncAuthButton(); location.hash="#/dash"; render();
  if(!S.onboarded) onboarding(); await fetchNotifications(); await refreshSharedData();
}
async function logoutAccount(){
  AUTH.busy=true;
  try{ await apiJSON("logout",{method:"POST",body:"{}"}); }
  finally{
    AUTH.user=null;
    AUTH.ready=true;
    AUTH.busy=false;
    SERVERNOTIFS=[];
    SUPPORT={tickets:[],isAdmin:false};
    AUDITLOGS=[];
    clearInterval(auditPollTimer);
    render();
    $("#authLayer").innerHTML="";
    syncAuthButton();
  }
}
function authMessage(code){
  return ({NETWORK_ERROR:"مش قادر أوصل بخدمة الموقع. اتأكد إن الموقع مرفوع على Vercel بشكل صحيح.",BAD_RESPONSE:"حصلت مشكلة في تشغيل خدمة الموقع. أعد تحميل الصفحة وجرب تاني.",TOO_MANY_ATTEMPTS:"محاولات دخول كتير. استنى شوية وجرب تاني.",STORAGE_ERROR:"الموقع مش قادر يحفظ بيانات الحسابات في المتصفح.",EMAIL_EXISTS:"الإيميل ده مسجل بالفعل." ,PHONE_EXISTS:"رقم الموبايل ده مسجل بالفعل.",INVALID_PHONE:"اكتب رقم موبايل مصري صحيح.",EMAIL_OWNER_ONLY:"إضافة البريد الإلكتروني متاحة للـ OWNER فقط.",OWNER_ONLY:"الصلاحية دي للـ OWNER فقط.",USER_NOT_FOUND:"المستخدم مش موجود.",CANNOT_CHANGE_SELF_ROLE:"مش مسموح تغيّر رتبتك بنفسك.",OWNER_PROTECTED:"رتبة OWNER محمية ومحدش يقدر يغيرها.",ROLE_NOT_ALLOWED:"الرتبة دي مش مسموح لك تعيينها.",LOGIN_FAILED:"الإيميل أو كلمة المرور غير صحيحة.",INVALID_EMAIL:"اكتب بريد إلكتروني صحيح.",PASSWORD_SHORT:"كلمة المرور لازم تكون 8 أحرف على الأقل.",PASSWORD_LONG:"كلمة المرور طويلة جدًا.",REQUEST_FAILED:"حصلت مشكلة في الاتصال بالسيرفر.",SERVER_ERROR:"حصل خطأ في السيرفر.",AI_NOT_CONFIGURED:"مدرس AI محتاج تفعيل مفتاح Gemini على السيرفر."}[code]||"حصل خطأ. جرّب تاني.");
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
  if(AUTH.user&&isManagerRole(AUTH.user.role)) items.push({h:"#/admin",i:"🛠️",t:"لوحة التحكم"});
  if(AUTH.user&&isStaffRole(AUTH.user.role)) items.push({h:"#/admin-chat",i:"💬",t:"شات الإدارة"});
  return items;
}
function paintNav(){
  const cur=location.hash||"#/dash";
  $("#nav").innerHTML=navItems().map(n=>n.sep?'<div class="sep"></div>':
    `<a href="${n.h}" class="${cur.startsWith(n.h)?"on":""}"><i>${n.i}</i>${n.t}</a>`).join("");
  $("#tabbar").innerHTML=TABS.map(n=>`<a href="${n.h}" class="${cur.startsWith(n.h)?"on":""}"><i>${n.i}</i>${n.t}</a>`).join("");
}

// مزامنة تلقائية: الإشعارات والتذاكر تظهر على جهاز الإدارة بدون إعادة تحميل الصفحة.
setInterval(async()=>{
  if(!AUTH.user) return;
  try{
    await fetchNotifications();
    if(globalThis.MozakraTicketing?.sync) await globalThis.MozakraTicketing.sync();
    const route=(location.hash||'').slice(2).split('?')[0].split('/')[0];
    if(route==='support' || route==='admin') await fetchSupport();
    if(route==='admin-chat' && isStaffRole(AUTH.user.role)) await fetchAdminChat();
  }catch(_){ }
},8000);
