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
  teachers:[]
};
let S = loadLocal();
let AUTH={user:null,ready:false,busy:false};
let GLOBAL_CONTENT={teachers:[],lessons:[],questions:[],teacher_overrides:{},disabled_teachers:[]};
async function loadGlobalContent(){
  try{
    const d=await apiJSON("content");
    if(d.ok&&d.content){
      GLOBAL_CONTENT=Object.assign({teachers:[],lessons:[],questions:[],teacher_overrides:{},disabled_teachers:[]},d.content);
    }
  }catch(e){}
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
function apiUrl(action){ return `api/api.php?action=${encodeURIComponent(action)}`; }
async function apiJSON(action,opts={}){
  const r=await fetch(apiUrl(action),{credentials:"same-origin",headers:{"Content-Type":"application/json",...(opts.headers||{})},...opts});
  let d=null; try{d=await r.json();}catch(e){d={ok:false,error:"BAD_RESPONSE"};}
  if(!r.ok && !d.error) d.error="REQUEST_FAILED";
  return d;
}
async function initAuth(){
  await loadGlobalContent();
  try{
    const d=await apiJSON("me");
    if(d.authenticated){ AUTH.user=d.user; const st=await apiJSON("state"); if(st.ok&&st.state&&Object.keys(st.state).length){ S=Object.assign(structuredClone(DEF),st.state); try{localStorage.setItem(LS,JSON.stringify(S));}catch(e){} } else { await apiJSON("state",{method:"POST",body:JSON.stringify({state:S})}); } }
  }catch(e){}
  AUTH.ready=true; render();
  if(AUTH.user && !S.onboarded) onboarding();
}
async function loginAccount(login,password){
  AUTH.busy=true; renderAuth();
  const d=await apiJSON("login",{method:"POST",body:JSON.stringify({login,password})});
  if(!d.ok){ AUTH.busy=false; renderAuth(authMessage(d.error)); return; }
  AUTH.user=d.user;
  const st=await apiJSON("state");
  if(st.ok&&st.state&&Object.keys(st.state).length) S=Object.assign(structuredClone(DEF),st.state);
  else await apiJSON("state",{method:"POST",body:JSON.stringify({state:S})});
  S.name=AUTH.user.name||S.name;
  AUTH.busy=false; render(); if(!S.onboarded) onboarding();
}
async function signupAccount(profile,password){
  AUTH.busy=true; renderAuth();
  const d=await apiJSON("signup",{method:"POST",body:JSON.stringify({...profile,password})});
  if(!d.ok){ AUTH.busy=false; renderAuth(authMessage(d.error)); return; }
  AUTH.user=d.user; S.name=profile.name.trim()||S.name; S.updated=Date.now();
  await apiJSON("state",{method:"POST",body:JSON.stringify({state:S})});
  AUTH.busy=false; render(); if(!S.onboarded) onboarding();
}
async function saveProfileAccount(profile){
  const d=await apiJSON("profile",{method:"POST",body:JSON.stringify(profile)});
  if(d.ok){ AUTH.user=d.user; return true; }
  toast(authMessage(d.error)); return false;
}
async function logoutAccount(){
  await apiJSON("logout",{method:"POST",body:"{}"}); AUTH.user=null; AUTH.ready=true; renderAuth();
}
function authMessage(code){
  return ({
    EMAIL_EXISTS:"الإيميل ده مسجل بالفعل.",
    PHONE_EXISTS:"رقم الموبايل ده مسجل بالفعل.",
    LOGIN_FAILED:"رقم الموبايل/الإيميل أو كلمة المرور غير صحيحة.",
    INVALID_EMAIL:"اكتب بريد إلكتروني صحيح أو سيبه فاضي.",
    INVALID_PHONE:"اكتب رقم موبايل مصري صحيح من 11 رقم.",
    NAME_REQUIRED:"اكتب اسم الطالب.",
    PASSWORD_SHORT:"كلمة المرور لازم تكون 8 أحرف على الأقل.",
    PASSWORD_LONG:"كلمة المرور طويلة جدًا.",
    ACCOUNT_DISABLED:"الحساب موقوف من المشرف حاليًا.",
    REQUEST_FAILED:"حصلت مشكلة في الاتصال بالسيرفر.",
    SERVER_ERROR:"حصل خطأ في السيرفر.",
    AI_NOT_CONFIGURED:"مدرس AI محتاج تفعيل مفتاح Gemini على السيرفر."
  }[code]||"حصل خطأ. جرّب تاني.");
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
  const disabled=new Set(GLOBAL_CONTENT.disabled_teachers||[]);
  const base=TEACHERS.map(t=>{
    const ov=(GLOBAL_CONTENT.teacher_overrides||{})[t.id];
    return ov?Object.assign({},t,ov):t;
  }).filter(t=>!disabled.has(t.id));
  const global=(GLOBAL_CONTENT.teachers||[]).filter(t=>!t.disabled);
  const local=S.custom.teachers||[];
  const m=new Map(); [...base,...global,...local].forEach(t=>m.set(t.id,t));
  return [...m.values()];
}
function questions(){ return QBANK.concat(GLOBAL_CONTENT.questions||[],S.custom.questions||[]); }
function lessonsOf(sid){
  const out=[]; const sub=CUR[sid]; if(!sub) return out;
  sub.units.forEach((u,ui)=>u.l.forEach((t,li)=>out.push({id:`${sid}-${ui+1}-${li+1}`,title:t,unit:u.n,ui:ui+1,li:li+1,sid})));
  (GLOBAL_CONTENT.lessons||[]).filter(x=>x.sid===sid).forEach(x=>out.push(x));
  (S.custom.lessons||[]).filter(x=>x.sid===sid).forEach(x=>out.push(x));
  return out;
}
function allLessons(){ return Object.keys(CUR).flatMap(lessonsOf); }
function lessonById(id){ return allLessons().find(l=>l.id===id); }
function contentOf(id){
  const g=(GLOBAL_CONTENT.lessons||[]).find(l=>l.id===id);
  const c=(S.custom.lessons||[]).find(l=>l.id===id&&l.summary);
  return g||c||CONTENT[id]||null;
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
  {h:"#/support",i:"🛠️",t:"الدعم الفني"},
  {sep:1},
  {h:"#/stats",i:"📊",t:"مستواي"},
  {h:"#/timer",i:"⏱️",t:"مؤقت المذاكرة"},
  {h:"#/achievements",i:"🏆",t:"الإنجازات"},
  {sep:1},
  {h:"#/profile",i:"👤",t:"حسابي"},
  {h:"#/settings",i:"⚙️",t:"الإعدادات"}
];
const TABS=[{h:"#/dash",i:"🏠",t:"الرئيسية"},{h:"#/schedule",i:"📅",t:"جدولي"},{h:"#/subjects",i:"📚",t:"المواد"},{h:"#/ai",i:"🤖",t:"مدرس AI"},{h:"#/stats",i:"📊",t:"مستواي"}];
function paintNav(){
  const cur=location.hash||"#/dash";
  $("#nav").innerHTML=NAV.map(n=>n.sep?'<div class="sep"></div>':
    `<a href="${n.h}" class="${cur.startsWith(n.h)?"on":""}"><i>${n.i}</i>${n.t}</a>`).join("");
  $("#tabbar").innerHTML=TABS.map(n=>`<a href="${n.h}" class="${cur.startsWith(n.h)?"on":""}"><i>${n.i}</i>${n.t}</a>`).join("");
}
