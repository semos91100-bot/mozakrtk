/* app.js — محرّك الاختبارات، المؤقت، مدرس AI، الإعدادات، الراوتر والأحداث */
/* ============================================================
   8) محرّك الاختبارات
   ============================================================ */
let QZ=null;
const shuffle=a=>a.map(x=>[Math.random(),x]).sort((p,q)=>p[0]-q[0]).map(x=>x[1]);
function startQuiz(mode,arg){
  let pool=questions(), title="اختبار", limit=10, timed=0;
  if(mode==="lesson"){ const l=lessonById(arg); pool=pool.filter(q=>q.s===l.sid&&q.u===l.ui&&q.l===l.li); title="اختبار: "+l.title; limit=pool.length; }
  else if(mode==="bank"){
    const s=$("#b_s").value,u=$("#b_u").value,d=$("#b_d").value; limit=+$("#b_n").value||10;
    pool=pool.filter(q=>q.s===s&&(!u||q.u==+u)&&(!d||q.d===d)); title="بنك الأسئلة — "+SUB(s).name;
  }
  else if(mode==="weak"){
    const ids=weakLessons(5).map(w=>w.id);
    pool=pool.filter(q=>ids.includes(`${q.s}-${q.u}-${q.l}`)); if(pool.length<5) pool=questions();
    title="اختبار نقاط ضعفك"; limit=10;
  }
  else if(mode==="mixed"){ title="تحديد المستوى"; limit=8; }
  else if(mode==="subject"){ const s=$("#e_s").value; limit=+$("#e_n").value||15; pool=pool.filter(q=>q.s===s); title="امتحان "+SUB(s).name; }
  else if(mode==="sim"){ title="امتحان محاكاة"; limit=20; timed=30*60; }
  pool=shuffle(pool).slice(0,Math.max(1,limit));
  if(!pool.length){ toast("مفيش أسئلة مطابقة للاختيار"); return; }
  QZ={qs:pool,ans:{},done:false,title,mode,timed,left:timed,start:Date.now()};
  location.hash="#/quiz";
  if(timed){ clearInterval(QZ.t); QZ.t=setInterval(()=>{ QZ.left--; const e=$("#qtimer"); if(e) e.textContent=`${String(Math.floor(QZ.left/60)).padStart(2,"0")}:${String(QZ.left%60).padStart(2,"0")}`; if(QZ.left<=0){ clearInterval(QZ.t); submitQuiz(); } },1000); }
}
function vQuiz(){
  if(!QZ) return vNotFound();
  if(QZ.done) return vResult();
  return `<div class="between" style="margin-bottom:14px">
    <div><h1>${esc(QZ.title)}</h1><p class="muted sm">${QZ.qs.length} سؤال</p></div>
    ${QZ.timed?`<div class="countdown"><b id="qtimer">${String(Math.floor(QZ.left/60)).padStart(2,"0")}:${String(QZ.left%60).padStart(2,"0")}</b></div>`:""}
  </div>
  ${QZ.qs.map((q,i)=>`<div class="q">
    <div class="num">سؤال ${i+1} · ${SUB(q.s).name} · ${q.d==="easy"?"سهل":q.d==="hard"?"صعب":"متوسط"}</div>
    <div class="txt">${esc(q.q)}</div>
    ${q.o.map((o,j)=>`<label class="opt"><input type="radio" name="q${i}" value="${j}" data-act="pick" data-i="${i}"><span>${esc(o)}</span></label>`).join("")}
  </div>`).join("")}
  <button class="btn primary" data-act="submitquiz">سلّم الإجابات</button>`;
}
function submitQuiz(){
  if(!QZ||QZ.done) return;
  clearInterval(QZ.t); QZ.done=true;
  let ok=0;
  QZ.qs.forEach((q,i)=>{
    const picked=QZ.ans[i];
    const correct=picked!==undefined&&+picked===q.a;
    if(correct) ok++;
    S.attempts.push({q:q.id,s:q.s,lesson:`${q.s}-${q.u}-${q.l}`,ok:correct,ts:Date.now()});
  });
  QZ.score=Math.round(ok*100/QZ.qs.length); QZ.ok=ok;
  const mins=Math.max(1,Math.round((Date.now()-QZ.start)/60000));
  S.sessions.push({day:today(),min:mins,s:QZ.qs[0].s,exam:QZ.title,score:QZ.score});
  if(S.lastDay!==today()){ const y=new Date(Date.now()-864e5).toISOString().slice(0,10); S.streak=S.lastDay===y?S.streak+1:1; S.lastDay=today(); }
  if(QZ.score>=90&&!S.badges.includes("score90")) S.badges.push("score90");
  saveLocal(); checkBadges(); render();
}
function vResult(){
  const wrong=QZ.qs.map((q,i)=>({q,i,picked:QZ.ans[i]})).filter(x=>x.picked===undefined||+x.picked!==x.q.a);
  const bySub={}; QZ.qs.forEach((q,i)=>{ bySub[q.s]=bySub[q.s]||{t:0,ok:0}; bySub[q.s].t++; if(+QZ.ans[i]===q.a) bySub[q.s].ok++; });
  return `<div class="card score">
    <b style="color:${QZ.score>=70?"var(--ok)":QZ.score>=50?"var(--amber)":"var(--bad)"}">${QZ.score}%</b>
    <p class="muted">${QZ.ok} من ${QZ.qs.length} إجابة صحيحة · ${esc(QZ.title)}</p>
    <div class="row" style="justify-content:center;margin-top:8px">
      <a class="btn" href="#/stats">شوف تحليل مستواك</a>
      ${wrong.length?`<button class="btn primary" data-act="quiz" data-mode="weak">اختبار على أخطائك</button>`:""}
    </div>
  </div>
  <div class="card" style="margin-top:14px"><h2 style="margin-bottom:8px">تحليل سريع</h2>
    ${Object.entries(bySub).map(([s,v])=>`<div class="between sm" style="margin-bottom:6px"><span>${SUB(s).emoji} ${SUB(s).name}</span><span>${Math.round(v.ok*100/v.t)}%</span></div><div class="bar" style="margin-bottom:10px"><i style="width:${Math.round(v.ok*100/v.t)}%;background:${SUB(s).c}"></i></div>`).join("")}
  </div>
  <h2 style="margin:16px 0 10px">مراجعة الإجابات</h2>
  ${QZ.qs.map((q,i)=>{
    const p=QZ.ans[i];
    return `<div class="q"><div class="num">سؤال ${i+1} · <a href="#/lesson/${q.s}-${q.u}-${q.l}">افتح الدرس</a></div>
    <div class="txt">${esc(q.q)}</div>
    ${q.o.map((o,j)=>`<div class="opt ${j===q.a?"correct":(String(j)===String(p)?"wrong":"")}"><span>${esc(o)}</span></div>`).join("")}
    <div class="expl"><b>الشرح:</b> ${esc(q.e)}</div></div>`;
  }).join("")}`;
}

/* ============================================================
   9) مؤقت المذاكرة
   ============================================================ */
let TM={left:0,total:0,run:false,int:null,sid:null};
function vTimer(){
  const sch=todaySchedule();
  const len=S.sessionLen*60;
  if(!TM.total){ TM.total=len; TM.left=len; }
  const p=TM.total?100-Math.round(TM.left*100/TM.total):0;
  return `<h1>مؤقت المذاكرة</h1><p class="muted sm" style="margin-bottom:14px">ذاكرت النهارده ${fmtMin(minutesOn(today()))} من هدف ${fmtMin(S.dailyGoal)}.</p>
  <div class="card" style="text-align:center">
    <div class="ring" style="--p:${p}"><div class="in"><div class="clock" id="clock">${String(Math.floor(TM.left/60)).padStart(2,"0")}:${String(TM.left%60).padStart(2,"0")}</div></div></div>
    <div class="row" style="justify-content:center;margin-top:16px">
      <button class="btn primary" data-act="tm" data-v="${TM.run?"pause":"start"}">${TM.run?"وقف مؤقت":"ابدأ المذاكرة"}</button>
      <button class="btn" data-act="tm" data-v="reset">تصفير</button>
      <button class="btn" data-act="tm" data-v="done">سجّل الجلسة</button>
    </div>
    <div class="row" style="justify-content:center;margin-top:12px">
      <span class="sm muted">المادة:</span>
      ${Object.keys(CUR).map(s=>`<button class="chip ${TM.sid===s?"on":""}" data-act="tmsub" data-s="${s}">${SUB(s).emoji} ${SUB(s).name}</button>`).join("")}
    </div>
  </div>
  <div class="card" style="margin-top:14px"><h2 style="margin-bottom:10px">مهام النهارده</h2>
    ${sch.tasks.map((t,i)=>`<div class="item subjcard" style="--c:${SUB(t.s).c}">
      <button class="state ${t.done?"done":""}" data-act="toggletask" data-i="${i}">${t.done?"✓":""}</button>
      <div class="gr"><b>${esc(t.title)}</b><span>${SUB(t.s).name} · ${t.min} د</span></div>
      <a class="btn sm" href="#/lesson/${t.lesson}">الدرس</a></div>`).join("")}
  </div>`;
}
function tick(){
  TM.left--;
  const c=$("#clock"); if(c) c.textContent=`${String(Math.floor(TM.left/60)).padStart(2,"0")}:${String(TM.left%60).padStart(2,"0")}`;
  const r=$(".ring"); if(r) r.style.setProperty("--p",100-Math.round(TM.left*100/TM.total));
  if(TM.left<=0){ clearInterval(TM.int); TM.run=false; markStudied(Math.round(TM.total/60),TM.sid); toast("✅ خلصت جلسة المذاكرة"); TM.left=TM.total; render(); }
}

/* ============================================================
   10) مدرس AI
   ============================================================ */
let AI={msgs:[],busy:false};
let SUPPORT={ticket:null,ready:false,busy:false,poll:null};
function currentRoute(){ return (location.hash||"#/dash").slice(2).split("?")[0].split("/")[0]; }
function stopSupportPoll(){ if(SUPPORT.poll){clearInterval(SUPPORT.poll);SUPPORT.poll=null;} }
function startSupportPoll(){
  stopSupportPoll(); if(!AUTH.user||currentRoute()!=="support") return;
  SUPPORT.poll=setInterval(async()=>{
    const d=await apiJSON("support_user");
    if(d.ok){
      const old=SUPPORT.ticket?.updated_at||0; const next=d.ticket||null;
      SUPPORT.ticket=next; SUPPORT.ready=true;
      if((next?.updated_at||0)!==old) render();
    }
  },5000);
}
async function loadSupport(silent=false){
  if(!AUTH.user){SUPPORT.ticket=null;SUPPORT.ready=true;stopSupportPoll();if(!silent)render();return;}
  const d=await apiJSON("support_user");
  if(d.ok){SUPPORT.ticket=d.ticket||null;SUPPORT.ready=true;}
  if(!silent) render(); startSupportPoll();
}
async function supportCreate(reason){
  reason=String(reason||"").trim(); if(!reason){toast("اكتب سبب المشكلة الأول");return;}
  SUPPORT.busy=true; render();
  const d=await apiJSON("support_create",{method:"POST",body:JSON.stringify({reason})});
  SUPPORT.busy=false;
  if(!d.ok){toast("تعذّر إرسال طلب الدعم");render();return;}
  SUPPORT.ticket=d.ticket||null; toast("✅ تم تحويل طلبك للمشرف"); render(); startSupportPoll();
}
async function supportSend(text){
  text=String(text||"").trim(); if(!text||!SUPPORT.ticket) return;
  SUPPORT.busy=true; render();
  const d=await apiJSON("support_send",{method:"POST",body:JSON.stringify({text})});
  SUPPORT.busy=false;
  if(!d.ok){toast("تعذّر إرسال الرسالة");render();return;}
  SUPPORT.ticket=d.ticket||SUPPORT.ticket; render();
}
function vAI(params){
  const pre=params&&params.get("q");
  if(pre&&!AI.msgs.some(m=>m.r==="me"&&m.c===pre)) setTimeout(()=>askAI(pre),60);
  return `<div class="between" style="margin-bottom:12px">
    <div><h1>مدرس AI</h1><p class="muted sm">مدرسك الذكي شغال من السيرفر ومش محتاج claude.ai.</p></div>
    <button class="btn sm" data-act="aiclear">محادثة جديدة</button>
  </div>
  <div class="card">
    <div class="chat" id="chat">${AI.msgs.length?AI.msgs.map(m=>`<div class="msg ${m.r}">${esc(m.c)}</div>`).join("")
      :`<div class="empty"><b>ابدأ بسؤال</b>مثال: «مش فاهم الحث الكهرومغناطيسي» أو «اشرح لي الأكسدة والاختزال بمثال».</div>`}</div>
    <div class="composer">
      <textarea id="aiin" rows="1" placeholder="اكتب سؤالك…"></textarea>
      <button class="btn primary" data-act="aisend" ${AI.busy?"disabled":""}>${AI.busy?"بيفكّر…":"ابعت"}</button>
    </div>
    <div class="row" style="margin-top:8px">
      ${["اشرح لي قانون فاراداي ببساطة","اختبرني في باب الأكسدة والاختزال","إزاي أذاكر الأحياء في شهر؟"].map(x=>`<button class="chip" data-act="aiquick" data-q="${esc(x)}">${esc(x)}</button>`).join("")}
    </div>
  </div>`;
}
async function askAI(text){
  if(!text||AI.busy) return;
  AI.msgs.push({r:"me",c:text}); AI.busy=true; render();
  const turns=AI.msgs.slice(-10).map(m=>({role:m.r==="ai"?"model":"user",content:m.c}));
  const context=`نسبة إنجاز المنهج ${overall().pct}%، نسبة إجابات الطالب الصحيحة ${accuracy()??"غير معروفة"}%. اسم الطالب ${S.name||"غير معروف"}.`;
  try{
    const d=await apiJSON("ai",{method:"POST",body:JSON.stringify({messages:turns,context})});
    if(!d.ok){
      const msg=d.error==="AI_NOT_CONFIGURED"?"مدرس الـAI محتاج تفعيل مفتاح Gemini على السيرفر. باقي الموقع والحسابات شغالة طبيعي.":"حصلت مشكلة في مدرس الـAI. جرّب تاني بعد شوية.";
      AI.msgs.push({r:"ai",c:msg});
    }else AI.msgs.push({r:"ai",c:d.text});
  }catch(e){ AI.msgs.push({r:"ai",c:"حصلت مشكلة في الاتصال بمدرس الـAI. اتأكد إن السيرفر شغال وجرب تاني."}); }
  AI.busy=false; render();
}

function renderAuth(message=""){
  if(!AUTH.ready || AUTH.user){ $("#authLayer").innerHTML=""; return; }
  const mode=window.__authMode||"login";
  $("#authLayer").innerHTML=`<div class="modal auth-modal"><div class="box auth-box" style="max-width:520px">
    <a class="admin-entry" href="admin.html" title="دخول المشرف">⚙️ <span>دخول الأدمن</span></a>
    <div class="between"><div><h1>مُذاكرة</h1><p class="muted sm">سجّل دخولك للمتابعة، أو اعمل حساب جديد واحفظ بياناتك وتقدمك.</p></div><span style="font-size:42px">📚</span></div>
    <div class="row" style="margin:14px 0"><button class="chip ${mode==="login"?"on":""}" data-auth="login">تسجيل الدخول</button><button class="chip ${mode==="signup"?"on":""}" data-auth="signup">إنشاء حساب</button></div>
    ${message?`<div class="card" style="margin-bottom:10px;border-color:var(--bad);color:var(--bad)">${esc(message)}</div>`:""}
    ${mode==="signup"?`
      <div class="grid g2">
        <label class="field"><span>اسم الطالب *</span><input id="auth_name" autocomplete="name" placeholder="الاسم بالكامل"></label>
        <label class="field"><span>رقم الموبايل *</span><input id="auth_phone" inputmode="tel" autocomplete="tel" placeholder="01xxxxxxxxx"></label>
        <label class="field"><span>المحافظة</span><input id="auth_governorate" placeholder="مثال: قنا"></label>
        <label class="field"><span>المدرسة</span><input id="auth_school" placeholder="اسم المدرسة"></label>
      </div>
      <label class="field"><span>البريد الإلكتروني (اختياري)</span><input id="auth_email" type="email" autocomplete="email" placeholder="مش مطلوب للتفعيل"></label>
      <label class="field"><span>كلمة المرور *</span><input id="auth_password" type="password" autocomplete="new-password" placeholder="8 أحرف على الأقل"></label>
      <label class="field"><span>تأكيد كلمة المرور *</span><input id="auth_password2" type="password" autocomplete="new-password" placeholder="اكتب كلمة المرور مرة تانية"></label>
      <div class="card" style="margin:8px 0;border-color:var(--line)"><b>🔒 بدون تحقق بالبريد</b><div class="muted sm" style="margin-top:4px">بياناتك الأساسية تتسجل على حسابك، والإيميل اختياري فقط كبيان إضافي.</div></div>
    `:`
      <label class="field"><span>رقم الموبايل أو البريد الإلكتروني</span><input id="auth_login" autocomplete="username" placeholder="01xxxxxxxxx"></label>
      <label class="field"><span>كلمة المرور</span><input id="auth_password" type="password" autocomplete="current-password" placeholder="كلمة المرور"></label>
    `}
    <button class="btn primary" style="width:100%;margin-top:8px" data-auth-submit="${mode}">${AUTH.busy?"جاري التنفيذ…":mode==="login"?"دخول":"إنشاء الحساب"}</button>
  </div></div>`;
}


/* ============================================================
   11) حسابي / الإعدادات / البحث
   ============================================================ */
function vProfile(){
  const o=overall();
  return `<h1>حسابي</h1>
  <div class="grid g2" style="margin-top:14px">
    <div class="card">
      <h2 style="margin-bottom:10px">بيانات الطالب</h2>
      <label class="field"><span>الاسم</span><input id="p_name" value="${esc(AUTH.user?.name||S.name)}"></label>
      <label class="field"><span>رقم الموبايل</span><input id="p_phone" inputmode="tel" value="${esc(AUTH.user?.phone||"")}"></label>
      <label class="field"><span>المحافظة</span><input id="p_governorate" value="${esc(AUTH.user?.governorate||"")}"></label>
      <label class="field"><span>المدرسة</span><input id="p_school" value="${esc(AUTH.user?.school||"")}"></label>
      <label class="field"><span>البريد الإلكتروني (اختياري)</span><input id="p_email" type="email" value="${esc(AUTH.user?.email||"")}"></label>
      <label class="field"><span>الصف</span><input value="الثالث الثانوي — علمي علوم" disabled></label>
      <label class="field"><span>تاريخ أول امتحان</span><input type="date" id="p_exam" value="${S.examDate}"></label>
      <label class="field"><span>هدف المذاكرة اليومي (دقيقة)</span><input type="number" id="p_goal" value="${S.dailyGoal}"></label>
      <button class="btn primary" data-act="saveprofile">حفظ البيانات</button>
    </div>
    <div class="card">
      <h2 style="margin-bottom:10px">ملخّصك</h2>
      <div class="between sm" style="margin-bottom:6px"><span>إنجاز المنهج</span><span>${o.pct}%</span></div><div class="bar"><i style="width:${o.pct}%"></i></div>
      <div class="grid g2" style="margin-top:14px">
        <div class="stat"><b>${fmtMin(totalMinutes())}</b><span>وقت المذاكرة</span></div>
        <div class="stat"><b>${S.attempts.length}</b><span>سؤال</span></div>
        <div class="stat"><b>${S.streak}</b><span>Streak</span></div>
        <div class="stat"><b>${S.badges.length}</b><span>إنجاز</span></div>
      </div>
      <div class="row" style="margin-top:14px"><span class="chip">📧 ${esc(AUTH.user?.email||"")}</span><button class="btn sm" data-act="logout">تسجيل خروج</button></div>
      <h3 style="margin:16px 0 8px">المدرسين المختارين</h3>
      <div class="row">${(S.teachers||[]).length?(S.teachers||[]).map(id=>{const t=teachers().find(x=>x.id===id);return t?`<a class="chip" href="#/teacher/${t.id}">${esc(t.n)}</a>`:""}).join(""):`<span class="muted sm">لسه ما اخترتش مدرسين — <a href="#/teachers">اختار دلوقتي</a></span>`}</div>
    </div>
  </div>`;
}
function vSettings(){
  return `<h1>الإعدادات</h1>
  <div class="card" style="margin-top:14px">
    <div class="between" style="padding:8px 0"><div><b>الوضع الليلي</b><div class="sm muted">حاليًا: ${S.theme==="dark"?"ليلي":S.theme==="light"?"نهاري":"حسب إعدادات جهازك"}</div></div>
      <div class="row"><button class="chip ${S.theme===""?"on":""}" data-act="theme" data-v="">تلقائي</button><button class="chip ${S.theme==="light"?"on":""}" data-act="theme" data-v="light">نهاري</button><button class="chip ${S.theme==="dark"?"on":""}" data-act="theme" data-v="dark">ليلي</button></div></div>
    <hr style="border:0;border-top:1px solid var(--line);margin:10px 0">
    <label class="field"><span>مدة جلسة المذاكرة (دقيقة)</span><input type="number" id="s_len" value="${S.sessionLen}" min="10" max="120" step="5"></label>
    <label class="field"><span>ميعاد مذاكرتك</span><select id="s_win">${["صباحًا","بعد الظهر","مساءً","بالليل"].map(w=>`<option ${S.windows===w?"selected":""}>${w}</option>`).join("")}</select></label>
    <div class="between" style="padding:8px 0"><div><b>التنبيهات داخل الموقع</b><div class="sm muted">تذكير بالجدول ونقاط الضعف</div></div>
      <button class="chip ${S.notifOn?"on":""}" data-act="notif">${S.notifOn?"مفعّلة":"مقفولة"}</button></div>
    <button class="btn primary" data-act="savesettings">حفظ الإعدادات</button>
  </div>
  <div class="card" style="margin-top:14px">
    <h2>بياناتك</h2>
    <p class="sm muted">تقدّمك محفوظ على حسابك بالبريد الإلكتروني، وتقدر تدخل من أي جهاز.</p>
    <div class="row"><button class="btn" data-act="export">تنزيل نسخة من بياناتي</button><button class="btn" data-act="reset">مسح كل البيانات</button></div>
  </div>`;
}
function vSearch(params){
  const q=(params.get("q")||"").trim();
  if(!q) return `<div class="empty"><b>اكتب كلمة في خانة البحث</b>مثال: «قانون أوم» أو «المناعة».</div>`;
  const hit=s=>String(s||"").includes(q);
  const ls=allLessons().filter(l=>hit(l.title)||hit(l.unit));
  const qs=questions().filter(x=>hit(x.q)||x.o.some(hit));
  const ts=teachers().filter(t=>hit(t.n));
  const laws=Object.entries(CONTENT).flatMap(([id,c])=>(c.laws||[]).filter(l=>hit(l.d)||l.f.includes(q)).map(l=>({id,...l})));
  return `<h1>نتائج البحث عن «${esc(q)}»</h1>
  <p class="muted sm" style="margin-bottom:14px">${ls.length+qs.length+ts.length+laws.length} نتيجة</p>
  ${ls.length?`<h2 style="margin:12px 0 8px">الدروس</h2>${ls.slice(0,12).map(l=>`<a class="item" href="#/lesson/${l.id}"><div class="ico">${SUB(l.sid).emoji}</div><div class="gr"><b>${esc(l.title)}</b><span>${esc(l.unit)}</span></div></a>`).join("")}`:""}
  ${laws.length?`<h2 style="margin:12px 0 8px">القوانين</h2>${laws.slice(0,8).map(l=>`<a class="item" href="#/lesson/${l.id}"><div class="ico">📐</div><div class="gr"><b>${esc(l.f)}</b><span>${esc(l.d)}</span></div></a>`).join("")}`:""}
  ${ts.length?`<h2 style="margin:12px 0 8px">المدرسين</h2>${ts.map(t=>`<a class="item" href="#/teacher/${t.id}"><div class="ico">👨‍🏫</div><div class="gr"><b>${esc(t.n)}</b><span>${SUB(t.s).name}</span></div></a>`).join("")}`:""}
  ${qs.length?`<h2 style="margin:12px 0 8px">الأسئلة</h2>${qs.slice(0,10).map(x=>`<a class="item" href="#/lesson/${x.s}-${x.u}-${x.l}"><div class="ico">📝</div><div class="gr"><b>${esc(x.q)}</b><span>${SUB(x.s).name}</span></div></a>`).join("")}`:""}
  ${!(ls.length||qs.length||ts.length||laws.length)?`<div class="empty"><b>مفيش نتائج</b>جرّب كلمة تانية أو اسأل مدرس الـAI.</div>`:""}`;
}
/* ---------- أول دخول ---------- */
function onboarding(){
  $("#layer").innerHTML=`<div class="modal"><div class="box">
    <h1>أهلًا بيك في مُذاكرة</h1>
    <p class="muted sm">3 أسئلة بس عشان أبني لك جدولك.</p>
    <label class="field"><span>اسمك</span><input id="o_name" placeholder="اكتب اسمك"></label>
    <label class="field"><span>تقدر تذاكر كام دقيقة في اليوم؟</span><input id="o_goal" type="number" value="120" step="15"></label>
    <label class="field"><span>تاريخ أول امتحان</span><input id="o_exam" type="date"></label>
    <div class="field"><span>المواد اللي ضعيف فيها</span>
      <div class="row" id="o_weak">${Object.keys(CUR).map(s=>`<button class="chip" data-act="weak" data-s="${s}">${SUB(s).emoji} ${SUB(s).name}</button>`).join("")}</div></div>
    <button class="btn primary" data-act="finishonboard">يلا نبدأ</button>
  </div></div>`;
}

/* ============================================================
   12) الراوتر والأحداث
   ============================================================ */
function render(){
  const h=location.hash||"#/dash";
  const [path,qs]=h.slice(2).split("?");
  const p=new URLSearchParams(qs||"");
  const seg=path.split("/");
  let html="";
  switch(seg[0]){
    case "":case "dash": html=vDash(); break;
    case "schedule": html=vSchedule(); break;
    case "subjects": html=vSubjects(); break;
    case "subject": html=vSubject(seg[1]); break;
    case "lesson": html=vLesson(seg[1]); break;
    case "teachers": html=vTeachers(); break;
    case "teacher": html=vTeacher(seg[1]); break;
    case "bank": html=vBank(p); break;
    case "testme": html=vTestMe(); break;
    case "exams": html=vExams(); break;
    case "quiz": html=vQuiz(); break;
    case "ai": html=vAI(p); break;
    case "support": html=vSupport(); break;
    case "stats": html=vStats(); break;
    case "timer": html=vTimer(); break;
    case "achievements": html=vAch(); break;
    case "profile": html=vProfile(); break;
    case "settings": html=vSettings(); break;
    case "search": html=vSearch(p); break;
    default: html=vNotFound();
  }
  view().innerHTML=html;
  paintNav();
  if(seg[0]==="quiz"&&QZ&&!QZ.done) QZ.qs.forEach((q,i)=>{ if(QZ.ans[i]!==undefined){const el=$(`input[name="q${i}"][value="${QZ.ans[i]}"]`); if(el) el.checked=true;} });
  const bell=$("#bellDot"); if(bell) bell.hidden=!(S.notifOn&&notifications().length);
  if(seg[0]==="support" && AUTH.ready && AUTH.user && !SUPPORT.ready) setTimeout(()=>loadSupport(true),0);
  if(seg[0]!=="support") stopSupportPoll();
  window.scrollTo(0,0);
}
addEventListener("hashchange",()=>{ render(); if(currentRoute()==="support") loadSupport(); else stopSupportPoll(); });

function applyTheme(){ if(S.theme) document.documentElement.dataset.theme=S.theme; else delete document.documentElement.dataset.theme; }

document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-act]"); if(!b) return;
  const a=b.dataset.act;
  if(a==="pick"){ QZ.ans[+b.dataset.i]=b.value; return; }
  if(a!=="pick") e.preventDefault?.();
  switch(a){
    case "togglelesson":{ const id=b.dataset.id; S.done[id]=!S.done[id]; if(!S.done[id]) delete S.done[id]; saveLocal(); checkBadges(); render(); break; }
    case "toggletask":{ const i=+b.dataset.i; const t=S.schedule.tasks[i]; t.done=!t.done; if(t.done){ markStudied(t.min,t.s); S.done[t.lesson]=true; } saveLocal(); render(); break; }
    case "rebuild": buildSchedule(); toast("تم إعادة توزيع الجدول"); render(); break;
    case "weak":{ const s=b.dataset.s; S.weak.includes(s)?S.weak=S.weak.filter(x=>x!==s):S.weak.push(s); b.classList.toggle("on"); saveLocal0(); break; }
    case "savesched": S.dailyGoal=+$("#f_goal").value||120; S.windows=$("#f_win").value; S.examDate=$("#f_exam").value; buildSchedule(); toast("تم الحفظ"); render(); break;
    case "startday": location.hash="#/timer"; break;
    case "quiz": startQuiz(b.dataset.mode,b.dataset.id); break;
    case "submitquiz": submitQuiz(); break;
    case "bankfilter":{ const u=$("#b_u").value,d=$("#b_d").value; location.hash=`#/bank?s=${$("#b_s").value}&u=${u}&d=${d}&n=${$("#b_n").value}`; break; }
    case "tm":{
      const v=b.dataset.v;
      if(v==="start"){ if(!TM.total){TM.total=S.sessionLen*60;TM.left=TM.total;} TM.run=true; clearInterval(TM.int); TM.int=setInterval(tick,1000); }
      if(v==="pause"){ TM.run=false; clearInterval(TM.int); }
      if(v==="reset"){ TM.run=false; clearInterval(TM.int); TM.total=S.sessionLen*60; TM.left=TM.total; }
      if(v==="done"){ const m=Math.max(1,Math.round((TM.total-TM.left)/60)); TM.run=false; clearInterval(TM.int); markStudied(m,TM.sid); TM.left=TM.total; toast(`اتسجّل ${fmtMin(m)} مذاكرة`); }
      render(); break;
    }
    case "tmsub": TM.sid=b.dataset.s; render(); break;
    case "aisend": askAI($("#aiin").value.trim()); break;
    case "aiquick": askAI(b.dataset.q); break;
    case "aiclear": AI.msgs=[]; render(); break;
    case "supportcreate": supportCreate($("#supportReason")?.value||""); break;
    case "supportsend": supportSend($("#supportInput")?.value||""); break;
    case "supportnew": SUPPORT.ticket=null; render(); break;
    case "logout": logoutAccount(); break;
    case "saveprofile": {
      const profile={name:$("#p_name").value.trim(),phone:$("#p_phone").value.trim(),governorate:$("#p_governorate").value.trim(),school:$("#p_school").value.trim(),email:$("#p_email").value.trim()};
      const ok=await saveProfileAccount(profile);
      if(ok){ S.name=profile.name; S.examDate=$("#p_exam").value; S.dailyGoal=+$("#p_goal").value||120; saveLocal(); toast("تم حفظ بياناتك"); render(); }
      break;
    }
    case "theme": S.theme=b.dataset.v; applyTheme(); saveLocal(); render(); break;
    case "notif": S.notifOn=!S.notifOn; saveLocal(); render(); break;
    case "savesettings": S.sessionLen=+$("#s_len").value||40; S.windows=$("#s_win").value; TM.total=0; saveLocal(); toast("تم الحفظ"); render(); break;
    case "export":{ const blob=new Blob([JSON.stringify(S,null,2)],{type:"application/json"});
      const u=URL.createObjectURL(blob); const a2=document.createElement("a"); a2.href=u; a2.download="mozakra-data.json"; a2.click(); URL.revokeObjectURL(u); break; }
    case "reset": if(confirm("هيتمسح كل تقدّمك. متأكد؟")){ S=structuredClone(DEF); saveLocal(); location.hash="#/dash"; location.reload(); } break;
    case "opentask":{ const t=S.schedule.tasks[+b.dataset.i]; if(t) location.hash="#/lesson/"+t.lesson; break; }
    case "bell":{ break; }
    case "finishonboard":{
      S.name=$("#o_name").value.trim()||"بطل"; S.dailyGoal=+$("#o_goal").value||120; S.examDate=$("#o_exam").value;
      S.onboarded=true; $("#layer").innerHTML=""; buildSchedule(); render(); break;
    }
    /* اختيار المدرّس */
    case "toggleteacher":{
      const id=b.dataset.id; S.teachers=S.teachers||[]; const i=S.teachers.indexOf(id);
      if(i>=0) S.teachers.splice(i,1); else S.teachers.push(id);
      saveLocal(); toast(i>=0?"اتشال من مدرّسينك":"اتضاف لمدرّسينك"); render(); break;
    }
  }
});

/* فلترة المدرّس المكرر بعد الإضافة */
const _t=teachers;
window.teachers=function(){ const m=new Map(); _t().forEach(t=>m.set(t.id,t)); return [...m.values()]; };

$("#q").addEventListener("keydown",e=>{ if(e.key==="Enter"&&e.target.value.trim()) location.hash="#/search?q="+encodeURIComponent(e.target.value.trim()); });
$("#btnTheme").addEventListener("click",()=>{ S.theme = S.theme==="dark"?"light":"dark"; applyTheme(); saveLocal(); render(); });
$("#btnTimer").addEventListener("click",()=>location.hash="#/timer");
$("#btnBell").addEventListener("click",()=>{
  const n=notifications();
  $("#layer").innerHTML=`<div class="modal" data-close="1"><div class="box"><div class="between" style="margin-bottom:10px"><h2>الإشعارات</h2><button class="btn sm" data-close="1">إغلاق</button></div>
   ${n.length?n.map(x=>`<a class="item" href="${x.go}" data-close="1"><div class="ico">${x.e}</div><div class="gr"><b>${esc(x.t)}</b></div></a>`).join(""):`<div class="empty"><b>مفيش إشعارات</b>كل حاجة تمام.</div>`}</div></div>`;
});
$("#layer").addEventListener("click",e=>{ if(e.target.dataset.close||e.target.closest("[data-close]")) $("#layer").innerHTML=""; });
document.addEventListener("keydown",e=>{
  if(e.key==="Enter"&&!e.shiftKey&&e.target.id==="aiin"){ e.preventDefault(); askAI(e.target.value.trim()); }
  if(e.key==="Enter"&&!e.shiftKey&&e.target.id==="supportInput"){ e.preventDefault(); supportSend(e.target.value.trim()); }
});

applyTheme();
render();
if(AUTH.ready && AUTH.user && !S.onboarded) onboarding();

document.addEventListener("click",e=>{
  const sf=e.target.closest("[data-support-float]");
  if(sf){
    e.preventDefault();
    if(AUTH.user){ location.hash="#/support"; }
    else { window.__authMode="login"; renderAuth(); toast("سجّل دخولك الأول عشان تتواصل مع الدعم الفني"); }
    return;
  }
  const b=e.target.closest("[data-auth]"); if(b){ window.__authMode=b.dataset.auth; renderAuth(); return; }
  const submit=e.target.closest("[data-auth-submit]");
  if(submit){
    const mode=submit.dataset.authSubmit, pass=$("#auth_password")?.value||"";
    if(mode==="signup") {
      const pass2=$("#auth_password2")?.value||"";
      if(pass!==pass2){ renderAuth("تأكيد كلمة المرور غير مطابق."); return; }
      signupAccount({
        name:$("#auth_name")?.value.trim()||"",
        phone:$("#auth_phone")?.value.trim()||"",
        governorate:$("#auth_governorate")?.value.trim()||"",
        school:$("#auth_school")?.value.trim()||"",
        email:$("#auth_email")?.value.trim()||""
      },pass);
    } else {
      loginAccount($("#auth_login")?.value.trim()||"",pass);
    }
  }
});
initAuth();
