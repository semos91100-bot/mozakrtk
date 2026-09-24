/* views.js — واجهات الصفحات (الرئيسية، الجدول، المواد، الدرس، المدرسين، الأسئلة، الامتحانات، الإحصائيات) */
/* ============================================================
   7) الواجهات
   ============================================================ */
const view=()=>$("#view");
const SUB=sid=>CUR[sid];

function subjChip(sid){ const s=SUB(sid); return `<span class="chip" style="border-color:${s.c};color:${s.c}">${s.emoji} ${s.name}</span>`; }

/* ---------- الرئيسية ---------- */
function vDash(){
  const sch=todaySchedule();
  const o=overall(), d=daysToExam(), m=minutesOn(today());
  const total=sch.tasks.reduce((t,x)=>t+x.min,0)||1;
  const hour=new Date().getHours();
  const greet=hour<12?"صباح الخير":hour<18?"مساء الخير":"مساء الخير";
  const wl=weakLessons(3);
  const contentReady=S.grade==="third"&&S.branch==="science_biology";
  return `
  ${!contentReady?`<div class="card" style="margin-bottom:14px;border-color:var(--amber)"><b>📚 مسارك الدراسي: ${esc(educationLabel())}</b><p class="sm muted" style="margin-top:5px">تمت إضافة المرحلة والشعبة للحساب. المحتوى الدراسي الموجود حاليًا في هذه النسخة هو محتوى تالتة ثانوي علمي علوم، وسيظهر لك كما هو لحد ما نضيف محتوى مسارك.</p><a class="btn sm" href="#/profile" style="margin-top:8px">تعديل المرحلة أو الشعبة</a></div>`:""}
  <section class="hero">
    <div class="hero-top">
      <div>
        <h1>${greet} يا ${esc(S.name||"بطل")} 👋</h1>
        <p class="muted sm">${esc(educationLabel())} · هدفك النهارده ${fmtMin(sch.goal)} — ذاكرت لحد دلوقتي ${fmtMin(m)}</p>
        <div class="row" style="margin-top:10px">
          <a class="btn primary" href="#/timer" data-act="startday">ابدأ جدول اليوم</a>
          <a class="btn" href="#/schedule">عدّل الجدول</a>
        </div>
      </div>
      ${d!==null&&d>=0?`<div class="countdown"><b>${d}</b><span>يوم على الامتحان</span></div>`:d!==null?`<div class="countdown"><span>بالتوفيق في الامتحانات</span></div>`:
        `<a class="btn" href="#/profile">حدّد تاريخ الامتحان</a>`}
    </div>
    <div class="ribbon">
      ${sch.tasks.length?sch.tasks.map((t,i)=>`
        <div class="blk ${t.done?"done":""}" style="--c:${SUB(t.s).c};flex:${t.min/total}" data-act="opentask" data-i="${i}">
          <span>${SUB(t.s).emoji} ${SUB(t.s).name} — ${t.min} د</span>
          <b>${esc(t.title)}${t.carry?" · مُرحّل":""}</b>
        </div>`).join(""):`<div class="blk" style="--c:var(--ok);flex:1"><span>خلصت المنهج 🎉</span><b>مفيش مهام جديدة</b></div>`}
    </div>
  </section>

  <div class="grid g4" style="margin-top:14px">
    <div class="card stat"><b>${o.pct}%</b><span>إنجاز المنهج</span><div class="bar" style="margin-top:6px"><i style="width:${o.pct}%"></i></div></div>
    <div class="card stat"><b>${S.streak} 🔥</b><span>أيام متتالية</span></div>
    <div class="card stat"><b>${S.attempts.length}</b><span>سؤال محلول</span></div>
    <div class="card stat"><b>${accuracy()??"—"}${accuracy()!==null?"%":""}</b><span>نسبة الإجابات الصحيحة</span></div>
  </div>

  <div class="grid g2" style="margin-top:14px">
    <div class="card">
      <div class="between" style="margin-bottom:10px"><h2>نقاط ضعفك</h2><a class="btn sm" href="#/testme">اختبار عليها</a></div>
      ${wl.length?wl.map(w=>{const l=lessonById(w.id);return l?`
        <a class="item" href="#/lesson/${l.id}">
          <div class="ico" style="color:${SUB(l.sid).c}">${SUB(l.sid).emoji}</div>
          <div class="gr"><b>${esc(l.title)}</b><span>${esc(l.unit)}</span></div>
          <span class="chip" style="color:var(--bad)">${w.rate}%</span></a>`:""}).join("")
        :`<div class="empty"><b>لسه مفيش بيانات كفاية</b>حلّ شوية أسئلة والموقع هيحدد نقاط ضعفك تلقائيًا.</div>`}
    </div>
    <div class="card">
      <h2 style="margin-bottom:10px">تقدّمك في المواد</h2>
      ${Object.keys(CUR).map(sid=>{const p=progress(sid);return `
        <a class="item subjcard" style="--c:${SUB(sid).c}" href="#/subject/${sid}">
          <div class="ico">${SUB(sid).emoji}</div>
          <div class="gr"><b>${SUB(sid).name}</b><div class="bar" style="margin-top:5px"><i style="width:${p.pct}%;background:${SUB(sid).c}"></i></div></div>
          <span class="sm muted">${p.done}/${p.total}</span></a>`}).join("")}
    </div>
  </div>`;
}

/* ---------- الجدول ---------- */
function vSchedule(){
  const sch=todaySchedule();
  return `
  <div class="between" style="margin-bottom:14px">
    <div><h1>جدول المذاكرة</h1><p class="muted sm">الجدول بيتبني حسب هدفك ونقاط ضعفك، وبيرحّل اللي فاتك بدل ما يتكدّس.</p></div>
    <button class="btn" data-act="rebuild">إعادة توزيع</button>
  </div>
  <div class="card">
    ${sch.tasks.map((t,i)=>`
      <div class="item subjcard" style="--c:${SUB(t.s).c}">
        <button class="state ${t.done?"done":""}" data-act="toggletask" data-i="${i}" aria-label="تم">${t.done?"✓":""}</button>
        <div class="gr"><b>${esc(t.title)}</b><span>${SUB(t.s).emoji} ${SUB(t.s).name} · ${esc(t.unit)} · ${t.min} دقيقة${t.carry?" · مُرحّل من امبارح":""}</span></div>
        <a class="btn sm" href="#/lesson/${t.lesson}">افتح الدرس</a>
      </div>`).join("")||`<div class="empty"><b>الجدول فاضي</b>اضغط إعادة توزيع.</div>`}
  </div>
  <div class="card" style="margin-top:14px">
    <h2 style="margin-bottom:10px">إعدادات الجدول</h2>
    <div class="grid g3">
      <label class="field"><span>هدف المذاكرة اليومي (دقيقة)</span><input type="number" id="f_goal" value="${S.dailyGoal}" min="30" step="15"></label>
      <label class="field"><span>ميعاد مذاكرتك</span><select id="f_win">${["صباحًا","بعد الظهر","مساءً","بالليل"].map(w=>`<option ${S.windows===w?"selected":""}>${w}</option>`).join("")}</select></label>
      <label class="field"><span>تاريخ أول امتحان</span><input type="date" id="f_exam" value="${S.examDate}"></label>
    </div>
    <div class="field"><span>المواد اللي حاسس إنك ضعيف فيها</span>
      <div class="row">${Object.keys(CUR).map(s=>`<button class="chip ${S.weak.includes(s)?"on":""}" data-act="weak" data-s="${s}">${SUB(s).emoji} ${SUB(s).name}</button>`).join("")}</div>
    </div>
    <button class="btn primary" data-act="savesched">حفظ وإعادة بناء الجدول</button>
  </div>`;
}

/* ---------- المواد ---------- */
function vSubjects(){
  return `<h1 style="margin-bottom:14px">المواد</h1>
  <div class="grid g2">${Object.keys(CUR).map(sid=>{const p=progress(sid);const acc=accuracy(a=>a.s===sid);return `
    <a class="card subjcard" style="--c:${SUB(sid).c};text-decoration:none" href="#/subject/${sid}">
      <div class="between"><h2>${SUB(sid).emoji} ${SUB(sid).name}</h2><span class="sm muted">${CUR[sid].units.length} أبواب</span></div>
      <div class="bar" style="margin:10px 0 6px"><i style="width:${p.pct}%;background:${SUB(sid).c}"></i></div>
      <div class="between sm muted"><span>${p.done} من ${p.total} درس</span><span>${acc!==null?"صحّة إجاباتك "+acc+"%":"لسه ما حلّيتش أسئلة"}</span></div>
    </a>`}).join("")}</div>`;
}
function vSubject(sid){
  const s=SUB(sid); if(!s) return vNotFound();
  const p=progress(sid);
  return `
  <div class="between" style="margin-bottom:14px">
    <div><h1>${s.emoji} ${s.name}</h1><p class="muted sm">${p.done} من ${p.total} درس · ${p.pct}%</p></div>
    <a class="btn" href="#/bank?s=${sid}">أسئلة على المادة</a>
  </div>
  ${s.units.map((u,ui)=>{
    const ls=u.l.map((t,li)=>({id:`${sid}-${ui+1}-${li+1}`,t,li}))
      .concat((S.custom.lessons||[]).filter(x=>x.sid===sid&&x.ui===ui+1).map(x=>({id:x.id,t:x.title,li:x.li})));
    const dn=ls.filter(l=>S.done[l.id]).length;
    return `<details class="lesson-sec" ${ui===0?"open":""}>
      <summary><span>${esc(u.n)}</span><span class="sm muted">${dn}/${ls.length}</span></summary>
      <div class="body">
        ${ls.map(l=>`<div class="item">
          <button class="state ${S.done[l.id]?"done":""}" data-act="togglelesson" data-id="${l.id}">${S.done[l.id]?"✓":""}</button>
          <div class="gr"><b>${esc(l.t)}</b><span>${contentOf(l.id)?"شرح وملخص وقوانين":"ملخص مختصر"}</span></div>
          <a class="btn sm" href="#/lesson/${l.id}">ادخل</a></div>`).join("")}
      </div></details>`;
  }).join("")}`;
}

/* ---------- الدرس ---------- */
function vLesson(id){
  const l=lessonById(id); if(!l) return vNotFound();
  const c=contentOf(id)||{};
  const s=SUB(l.sid);
  const qs=questions().filter(q=>q.s===l.sid&&q.u===l.ui&&q.l===l.li);
  const tchAll=teachers().filter(t=>t.s===l.sid);
  const tchMine=tchAll.filter(t=>(S.teachers||[]).includes(t.id));
  const tchs=tchMine.length?tchMine:tchAll.slice(0,4);
  return `
  <p class="sm muted"><a href="#/subject/${l.sid}">${s.emoji} ${s.name}</a> › ${esc(l.unit)}</p>
  <div class="between" style="margin:4px 0 14px">
    <h1>${esc(l.title)}</h1>
    <button class="btn ${S.done[id]?"primary":""}" data-act="togglelesson" data-id="${id}">${S.done[id]?"✓ خلصت الدرس":"علّم كمُنجز"}</button>
  </div>

  <details class="lesson-sec" open><summary>🎥 المحاضرة</summary><div class="body">
    ${(l.video||c.video)?`<a class="btn primary" target="_blank" rel="noopener" href="${esc(l.video||c.video)}">افتح المحاضرة</a>`:
      `<p class="muted sm">شوف شرح الدرس ده على منصة مدرّسك:</p>
      <div class="row" style="margin-top:8px">${tchs.filter(platformOf).map(t=>`<a class="btn primary" target="_blank" rel="noopener noreferrer" href="${esc(platformOf(t).url)}">▶ منصة ${esc(t.n)}</a>`).join("")||`<span class="muted sm">لسه مفيش منصات للمادة دي.</span>`}</div>`}
    <div class="row" style="margin-top:10px">${tchs.map(t=>`<a class="chip" href="#/teacher/${t.id}">👨‍🏫 ${esc(t.n)}</a>`).join("")}</div>
  </div></details>

  <details class="lesson-sec" open><summary>📝 الملخص</summary><div class="body">
    ${c.summary?`<p>${esc(c.summary)}</p>`:`<p class="muted sm">الملخص لسه ما اتضافش للدرس ده، بس تقدر تسأل مدرس الـAI يلخّصه لك.</p>
    <a class="btn sm" href="#/ai?q=${encodeURIComponent("لخّص لي درس "+l.title+" في مادة "+s.name)}">اطلب ملخص من الـAI</a>`}
  </div></details>

  ${c.points?`<details class="lesson-sec"><summary>📌 أهم النقاط</summary><div class="body"><ul class="clean">${c.points.map(p=>`<li>${esc(p)}</li>`).join("")}</ul></div></details>`:""}
  ${c.laws&&c.laws.length?`<details class="lesson-sec"><summary>📐 القوانين</summary><div class="body">${c.laws.map(x=>`<div class="law">${esc(x.f)}<em>${esc(x.d)}</em></div>`).join("")}</div></details>`:""}
  ${c.mistakes?`<details class="lesson-sec"><summary>⚠️ أخطاء شائعة</summary><div class="body"><ul class="clean">${c.mistakes.map(p=>`<li>${esc(p)}</li>`).join("")}</ul></div></details>`:""}
  ${c.checks?`<details class="lesson-sec"><summary>🧠 أسئلة فهم</summary><div class="body"><ul class="clean">${c.checks.map(p=>`<li>${esc(p)}</li>`).join("")}</ul></div></details>`:""}

  <details class="lesson-sec" open><summary>📝 اختبار الدرس <span class="sm muted">${qs.length} سؤال</span></summary><div class="body">
    ${qs.length?`<button class="btn primary" data-act="quiz" data-mode="lesson" data-id="${id}">ابدأ اختبار الدرس</button>`:
      `<p class="muted sm">مفيش أسئلة على الدرس ده لسه. جرّب بنك الأسئلة على الباب كله.</p>
       <a class="btn sm" href="#/bank?s=${l.sid}&u=${l.ui}">أسئلة الباب</a>`}
  </div></details>`;
}

/* ---------- المدرسين ---------- */
const KIND_ICON={site:"🌐",yt:"▶️",fb:"📘",tg:"✈️",ig:"📸",app:"📱",lt:"🔗",wa:"💬"};
function platformOf(t){
  const L=(t.links||[]); return L.find(l=>l.k==="site")||L.find(l=>l.k==="app")||L.find(l=>l.k==="yt")||null;
}
function linksLabel(n){ return n===0?"الروابط قريبًا":n===1?"رابط واحد":n===2?"رابطين":n+" روابط"; }
function vTeachers(){
  return `<h1>المدرسين</h1>
  <p class="muted sm" style="margin-bottom:14px">مفيش ترتيب من الأفضل للأسوأ — اختار اللي يناسبك وحطّه في حسابك.</p>
  ${Object.keys(CUR).map(sid=>{
    const t=teachers().filter(x=>x.s===sid);
    return `<h2 style="margin:16px 0 8px">${SUB(sid).emoji} ${SUB(sid).name}</h2>
    <div class="grid g3">${t.map(x=>`
      <a class="card subjcard" style="--c:${SUB(sid).c};text-decoration:none" href="#/teacher/${x.id}">
        <b>${x.ti?esc(x.ti)+" ":""}${esc(x.n)}</b><div class="sm muted">${(S.teachers||[]).includes(x.id)?"✓ مدرّسك · ":""}${linksLabel((x.links||[]).length)}</div>
      </a>`).join("")}</div>`;
  }).join("")}`;
}
function vTeacher(id){
  const t=teachers().find(x=>x.id===id); if(!t) return vNotFound();
  const s=SUB(t.s);
  const mine=(S.teachers||[]).includes(t.id);
  const links=t.links||[], pf=platformOf(t);
  return `<p class="sm muted"><a href="#/teachers">المدرسين</a> › ${s.emoji} ${s.name}</p>
  <div class="between" style="margin:4px 0 14px;gap:10px;flex-wrap:wrap">
    <h1>${t.ti?esc(t.ti)+" ":""}${esc(t.n)}</h1>
    <button class="btn ${mine?"primary":""}" data-act="toggleteacher" data-id="${t.id}">${mine?"✓ مدرّسك — إلغاء":"➕ اختاره كمدرّسك"}</button>
  </div>
  ${t.bio?`<div class="card" style="margin-bottom:14px"><p>${esc(t.bio)}</p></div>`:""}
  <div class="card" style="margin-bottom:14px"><h2>🎥 المحاضرات</h2>
    ${pf?`<p class="muted sm" style="margin:6px 0 10px">محاضرات ${esc(t.n)} على منصته.</p>
      <a class="btn primary" target="_blank" rel="noopener noreferrer" href="${esc(pf.url)}">${KIND_ICON[pf.k]||"🌐"} افتح ${pf.k==="site"?"منصة المدرّس":esc(pf.t)}</a>`
    :`<div class="empty"><b>لسه مفيش منصة</b>هتتضاف أول ما نتأكد من منصة المدرّس.</div>`}
  </div>
  <div class="card"><h2>🔗 روابط المدرّس</h2>
    ${links.length?`<div class="row" style="margin-top:8px">${links.map(l=>`<a class="chip" target="_blank" rel="noopener noreferrer" href="${esc(l.url)}">${KIND_ICON[l.k]||"🔗"} ${esc(l.t)}</a>`).join("")}</div>
      <p class="xs muted" style="margin-top:10px">الروابط دي اتجمعت من صفحات المدرّس نفسه على الإنترنت.</p>`
    :`<div class="empty"><b>لسه مفيش روابط</b>هتتضاف أول ما نتأكد من صفحة المدرّس نفسه.</div>`}
  </div>`;
}

/* ---------- بنك الأسئلة ---------- */
function vBank(params){
  const s=params.get("s")||"fz", u=params.get("u")||"", diff=params.get("d")||"", n=params.get("n")||"10";
  const pool=questions().filter(q=>q.s===s&&(!u||q.u==+u)&&(!diff||q.d===diff));
  return `<h1>بنك الأسئلة</h1>
  <p class="muted sm" style="margin-bottom:14px">اختار المادة والباب والصعوبة وعدد الأسئلة.</p>
  <div class="card">
    <div class="grid g4">
      <label class="field"><span>المادة</span><select id="b_s">${Object.keys(CUR).map(x=>`<option value="${x}" ${x===s?"selected":""}>${SUB(x).emoji} ${SUB(x).name}</option>`).join("")}</select></label>
      <label class="field"><span>الباب</span><select id="b_u"><option value="">كل الأبواب</option>${CUR[s].units.map((x,i)=>`<option value="${i+1}" ${u==String(i+1)?"selected":""}>${esc(x.n)}</option>`).join("")}</select></label>
      <label class="field"><span>الصعوبة</span><select id="b_d"><option value="">الكل</option><option value="easy" ${diff==="easy"?"selected":""}>سهل</option><option value="mid" ${diff==="mid"?"selected":""}>متوسط</option><option value="hard" ${diff==="hard"?"selected":""}>صعب</option></select></label>
      <label class="field"><span>عدد الأسئلة</span><input type="number" id="b_n" value="${n}" min="1" max="50"></label>
    </div>
    <div class="between">
      <span class="sm muted">المتاح دلوقتي: ${pool.length} سؤال</span>
      <div class="row">
        <button class="btn" data-act="bankfilter">تحديث</button>
        <button class="btn primary" data-act="quiz" data-mode="bank" ${pool.length?"":"disabled"}>ابدأ الحل</button>
      </div>
    </div>
  </div>`;
}

/* ---------- اختبرني ---------- */
function vTestMe(){
  const wl=weakLessons(5);
  const has=S.attempts.length>=5;
  return `<h1>اختبرني</h1>
  <p class="muted sm" style="margin-bottom:14px">الموقع هو اللي يختار لك الأسئلة حسب أخطاءك.</p>
  <div class="card">
    ${has?`<p>لاحظنا إنك بتغلط أكتر في:</p>
      ${wl.map(w=>{const l=lessonById(w.id);return l?`<div class="item subjcard" style="--c:${SUB(l.sid).c}"><div class="ico">${SUB(l.sid).emoji}</div><div class="gr"><b>${esc(l.title)}</b><span>${esc(l.unit)}</span></div><span class="chip" style="color:var(--bad)">${w.rate}%</span></div>`:""}).join("")}
      <button class="btn primary" style="margin-top:10px" data-act="quiz" data-mode="weak">اختبار نقاط ضعفك</button>`
    :`<div class="empty"><b>محتاج أشوف مستواك الأول</b>حلّ 5 أسئلة على الأقل وبعدها هختار لك أسئلة مخصّصة.</div>
      <div class="row" style="justify-content:center"><button class="btn primary" data-act="quiz" data-mode="mixed">اختبار تحديد مستوى سريع</button></div>`}
  </div>`;
}

/* ---------- الامتحانات ---------- */
function vExams(){
  return `<h1>الامتحانات الشاملة</h1>
  <p class="muted sm" style="margin-bottom:14px">امتحان على باب، أو على مادة كاملة، أو امتحان محاكاة على كل المواد.</p>
  <div class="grid g2">
    <div class="card"><h2>امتحان على مادة</h2>
      <label class="field" style="margin-top:8px"><span>المادة</span><select id="e_s">${Object.keys(CUR).map(x=>`<option value="${x}">${SUB(x).emoji} ${SUB(x).name}</option>`).join("")}</select></label>
      <label class="field"><span>عدد الأسئلة</span><input type="number" id="e_n" value="15" min="5" max="40"></label>
      <button class="btn primary" data-act="quiz" data-mode="subject">ابدأ الامتحان</button>
    </div>
    <div class="card"><h2>امتحان محاكاة</h2>
      <p class="sm muted">20 سؤال من كل المواد بتوقيت 30 دقيقة — زي جو الامتحان.</p>
      <button class="btn primary" data-act="quiz" data-mode="sim">ابدأ المحاكاة</button>
    </div>
  </div>
  <div class="card" style="margin-top:14px"><h2>نتائجك السابقة</h2>
    ${S.sessions.filter(x=>x.exam).length?`<div class="scroll-x"><table><thead><tr><th>الاختبار</th><th>التاريخ</th><th>الدرجة</th></tr></thead><tbody>
      ${S.sessions.filter(x=>x.exam).slice(-12).reverse().map(x=>`<tr><td>${esc(x.exam)}</td><td class="sm muted">${x.day}</td><td>${x.score}%</td></tr>`).join("")}
    </tbody></table></div>`:`<div class="empty"><b>لسه مفيش نتائج</b>أول امتحان هيظهر هنا بتحليل كامل.</div>`}
  </div>`;
}

/* ---------- مستواي ---------- */
function vStats(){
  const rows=Object.keys(CUR).map(sid=>{
    const p=progress(sid), a=accuracy(x=>x.s===sid), mins=S.sessions.filter(s=>s.s===sid).reduce((t,s)=>t+s.min,0);
    return {sid,p,a,mins};
  });
  const wl=weakLessons(5);
  const last7=[...Array(7)].map((_,i)=>{const d=new Date(Date.now()-(6-i)*864e5).toISOString().slice(0,10);return {d,m:minutesOn(d)};});
  const mx=Math.max(60,...last7.map(x=>x.m));
  return `<h1>مستواي</h1><p class="muted sm" style="margin-bottom:14px">من أول السنة لحد النهارده.</p>
  <div class="grid g4">
    <div class="card stat"><b>${fmtMin(totalMinutes())}</b><span>إجمالي وقت المذاكرة</span></div>
    <div class="card stat"><b>${S.attempts.length}</b><span>سؤال محلول</span></div>
    <div class="card stat"><b>${accuracy()??"—"}${accuracy()!==null?"%":""}</b><span>نسبة الصح</span></div>
    <div class="card stat"><b>${overall().pct}%</b><span>إنجاز المنهج</span></div>
  </div>
  <div class="card" style="margin-top:14px"><h2 style="margin-bottom:12px">آخر 7 أيام</h2>
    <div class="row" style="align-items:flex-end;gap:12px;height:120px">
      ${last7.map(x=>`<div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:6px;height:100%">
        <div style="width:100%;background:var(--brand);border-radius:8px 8px 0 0;height:${Math.round(x.m*100/mx)}%;min-height:3px" title="${x.m} دقيقة"></div>
        <span class="xs muted">${new Date(x.d).toLocaleDateString("ar-EG",{weekday:"short"})}</span></div>`).join("")}
    </div>
  </div>
  <div class="card" style="margin-top:14px"><h2 style="margin-bottom:10px">تحليل المواد</h2>
    <div class="scroll-x"><table><thead><tr><th>المادة</th><th>الإنجاز</th><th>مستوى الإجابات</th><th>وقت المذاكرة</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${SUB(r.sid).emoji} ${SUB(r.sid).name}</td><td>${r.p.pct}%</td><td>${r.a??"—"}${r.a!==null?"%":""}</td><td class="muted">${fmtMin(r.mins)}</td></tr>`).join("")}
    </tbody></table></div>
  </div>
  <div class="card" style="margin-top:14px"><h2 style="margin-bottom:10px">أكتر 5 دروس بتغلط فيها</h2>
    ${wl.length?wl.map(w=>{const l=lessonById(w.id);return l?`<a class="item" href="#/lesson/${l.id}"><div class="ico">${SUB(l.sid).emoji}</div><div class="gr"><b>${esc(l.title)}</b><span>${esc(l.unit)}</span></div><span class="chip">${w.rate}%</span></a>`:""}).join("")
    :`<div class="empty"><b>لسه بدري</b>حلّ أسئلة أكتر عشان التحليل يبقى دقيق.</div>`}
  </div>`;
}

/* ---------- الإنجازات ---------- */
function vAch(){
  return `<h1>الإنجازات</h1><p class="muted sm" style="margin-bottom:14px">${S.badges.length} من ${ACHIEVEMENTS.length}</p>
  <div class="grid g4">${ACHIEVEMENTS.map(a=>`
    <div class="badge ${S.badges.includes(a.id)?"":"locked"}"><span class="e">${a.e}</span><b>${a.n}</b><span class="xs muted">${a.d}</span></div>`).join("")}</div>`;
}

/* ---------- الدعم الفني ---------- */
function vSupport(){
  const u=AUTH.user;
  if(!u) return `<h1>الدعم الفني</h1><div class="empty"><b>سجّل دخولك الأول</b>لازم يكون عندك حساب عشان تستخدم نظام التذاكر.</div>`;
  const isAdmin=isManagerRole(u.role);
  const isStaff=isStaffRole(u.role);
  const canOpenTicket=!isStaff || u.role==='owner';
  const list=MozakraTicketing.forCurrentUser();
  if(!window.__activeTicket && list.length) window.__activeTicket=list[0].id;
  return `<div class="ticket-section-title">
    <div><h1>${isStaff?"لوحة الدعم الفني — كل التذاكر":"الدعم الفني"}</h1>
      <p class="muted sm">${isStaff?"تابع وردّ على التذاكر بحسب الأولوية والحالة":"افتح تذكرة جديدة وتابع الردود من فريق الدعم"}</p></div>
    ${canOpenTicket?`<button class="btn primary" data-ticket-action="new">+ تذكرة جديدة</button>`:""}
  </div>
  ${isAdmin?renderTicketStatsOld():""}
  <div class="support-wrap-old">
    <div>
      ${renderTicketFiltersOld(isStaff)}
      <div class="ticket-list-old" id="ticketListOld">${renderTicketRowsOld(list,isStaff)}</div>
    </div>
    <div id="ticketDetailWrapOld">${window.__creatingTicket?renderNewTicketFormOld():renderTicketDetailOld(window.__activeTicket,isStaff)}</div>
  </div>`;
}
function ticketBadgeOld(text,cls){ return `<span class="ticket-badge ${cls||""}">${esc(text)}</span>`; }
function priorityBadgeOld(p){ const o=TICKET_PRIORITIES.find(x=>x.id===p)||TICKET_PRIORITIES[1]; return ticketBadgeOld(o.name,"p-"+o.id); }
function statusBadgeOld(s){ const o=TICKET_STATUSES.find(x=>x.id===s)||TICKET_STATUSES[0]; return ticketBadgeOld(o.name,"s-"+o.id); }
function categoryNameOld(c){ return (TICKET_CATEGORIES.find(x=>x.id===c)||{}).name||c||"أخرى"; }
function renderTicketStatsOld(){
  const st=MozakraTicketing.stats();
  return `<div class="grid g4 ticket-stats"><div class="card stat"><b>${st.open}</b><span>مفتوحة</span></div><div class="card stat"><b>${st.progress}</b><span>قيد المعالجة</span></div><div class="card stat"><b>${st.resolved}</b><span>تم حلها</span></div><div class="card stat"><b style="color:var(--bad)">${st.urgent}</b><span>عاجلة وغير محلولة</span></div></div>`;
}
function renderTicketFiltersOld(isStaff){
  return `<div class="ticket-filters-old"><select id="ticketStatusFilter"><option value="">كل الحالات</option>${TICKET_STATUSES.map(s=>`<option value="${s.id}">${s.name}</option>`).join("")}</select><select id="ticketPriorityFilter"><option value="">كل الأولويات</option>${TICKET_PRIORITIES.map(p=>`<option value="${p.id}">${p.name}</option>`).join("")}</select>${isStaff?`<input id="ticketSearchFilter" placeholder="بحث بالاسم أو الموضوع…">`:""}</div>`;
}
function renderTicketRowsOld(list,isStaff){
  if(!list.length) return `<div class="empty ticket-empty"><b>مفيش تذاكر لسه</b>${isStaff?"لما الطلاب يبعثوا هتظهر التذاكر هنا.":"افتح تذكرة جديدة من زر «تذكرة جديدة»."}</div>`;
  return list.map(t=>{const last=t.messages[t.messages.length-1];return `<div class="ticket-row-old ${t.id===window.__activeTicket?"active":""}" data-ticket-id="${esc(t.id)}"><div class="between"><span class="xs muted">#${esc(t.id)}</span>${statusBadgeOld(t.status)}</div><b class="ticket-subject-old">${esc(t.subject)}</b>${isStaff?`<div class="xs muted">👤 ${esc(t.userName)} — ${esc(t.userEmail)}</div>`:""}<div class="ticket-meta-old">${priorityBadgeOld(t.priority)} ${ticketBadgeOld(categoryNameOld(t.category),"cat")}</div><div class="xs muted ticket-last-old">${last?esc(last.text):""}</div></div>`;}).join("");
}
function renderTicketDetailOld(id,isStaff){
  const t=MozakraTicketing.get(id);
  if(!t) return `<div class="ticket-detail-old"><div class="empty ticket-empty"><b>اختار تذكرة</b>هتشوف التفاصيل والردود هنا.</div></div>`;
  return `<div class="ticket-detail-old"><div class="ticket-head-old"><div><div class="xs muted">#${esc(t.id)}</div><h2>${esc(t.subject)}</h2><div class="xs muted">${isStaff?`${esc(t.userName)} — ${esc(t.userEmail)}`:`فتحت في ${fmtTicketTimeOld(t.createdAt)}`}</div></div><div class="ticket-controls-old">${statusBadgeOld(t.status)} ${priorityBadgeOld(t.priority)}${isStaff?`<select data-ticket-status="${esc(t.id)}">${TICKET_STATUSES.map(s=>`<option value="${s.id}" ${s.id===t.status?"selected":""}>${s.name}</option>`).join("")}</select><select data-ticket-priority="${esc(t.id)}">${TICKET_PRIORITIES.map(p=>`<option value="${p.id}" ${p.id===t.priority?"selected":""}>${p.name}</option>`).join("")}</select>`:""}</div></div><div class="ticket-thread-old">${t.messages.map(m=>`<div class="ticket-msg-old ${m.from==="admin"?"admin":"student"}"><b>${m.from!=="student"?"فريق الدعم":esc(m.authorName)}</b><div>${esc(m.text)}</div><small>${fmtTicketTimeOld(m.at)}</small></div>`).join("")}</div><form class="ticket-composer-old" data-ticket-reply="${esc(t.id)}"><textarea placeholder="اكتب ردك هنا…" required></textarea><button class="btn primary" type="submit">إرسال</button></form></div>`;
}
function fmtTicketTimeOld(iso){ const d=new Date(iso); return isNaN(d)?"":d.toLocaleString("ar-EG",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}); }
function renderNewTicketFormOld(){
  return `<div class="ticket-detail-old"><div class="ticket-head-old"><div><h2>🎫 فتح تذكرة دعم فني جديدة</h2><p class="muted sm">اكتب مشكلتك وهيوصل رد من فريق الدعم هنا.</p></div><button class="btn sm" type="button" data-ticket-action="cancel">إلغاء</button></div><form id="newTicketFormOld" class="ticket-new-form-old"><label class="field"><span>موضوع التذكرة</span><input name="subject" required placeholder="مثال: مشكلة في تسجيل الدخول"></label><div class="grid g2"><label class="field"><span>التصنيف</span><select name="category">${TICKET_CATEGORIES.map(c=>`<option value="${c.id}">${c.name}</option>`).join("")}</select></label><label class="field"><span>الأولوية</span><select name="priority">${TICKET_PRIORITIES.map(p=>`<option value="${p.id}" ${p.id==="medium"?"selected":""}>${p.name}</option>`).join("")}</select></label></div><label class="field"><span>تفاصيل المشكلة</span><textarea name="message" required placeholder="اشرح المشكلة بالتفصيل…"></textarea></label><button class="btn primary" style="width:100%" type="submit">إرسال التذكرة</button></form></div>`;
}
function refreshTicketViewOld(){ window.__creatingTicket=false; render(); }
function wireTicketPageOld(){
  const form=document.querySelector("#newTicketFormOld");
  if(form&&!form.dataset.wired){form.dataset.wired="1";form.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target);const r=await MozakraTicketing.create({subject:f.get("subject"),category:f.get("category"),priority:f.get("priority"),message:f.get("message")});if(!r.ok)return toast(r.msg||"التذكرة لم تصل للسيرفر.");window.__activeTicket=r.ticket.id;window.__creatingTicket=false;toast("تم إرسال التذكرة بنجاح ✅");await fetchSupport();render();});}
  document.querySelectorAll("[data-ticket-id]").forEach(el=>{if(el.dataset.wired)return;el.dataset.wired="1";el.addEventListener("click",()=>{window.__activeTicket=el.dataset.ticketId;window.__creatingTicket=false;render();});});
  document.querySelectorAll("[data-ticket-status]").forEach(el=>{if(el.dataset.wired)return;el.dataset.wired="1";el.addEventListener("change",()=>{MozakraTicketing.setStatus(el.dataset.ticketStatus,el.value);toast("اتحدّثت حالة التذكرة");render();});});
  document.querySelectorAll("[data-ticket-priority]").forEach(el=>{if(el.dataset.wired)return;el.dataset.wired="1";el.addEventListener("change",()=>{MozakraTicketing.setPriority(el.dataset.ticketPriority,el.value);toast("اتحدّثت أولوية التذكرة");render();});});
  document.querySelectorAll("[data-ticket-reply]").forEach(form=>{if(form.dataset.wired)return;form.dataset.wired="1";form.addEventListener("submit",async e=>{e.preventDefault();const ta=form.querySelector("textarea");const r=await MozakraTicketing.reply(form.dataset.ticketReply,ta.value);if(r.ok){toast("تم إرسال الرد");await fetchSupport();render();}else toast(r.msg||"الرسالة لم تصل للسيرفر.");});});
  document.querySelectorAll("[data-ticket-action]").forEach(el=>{if(el.dataset.wired)return;el.dataset.wired="1";el.addEventListener("click",()=>{if(el.dataset.ticketAction==="new")window.__creatingTicket=true;else window.__creatingTicket=false;render();});});
  const sf=document.querySelector("#ticketStatusFilter"),pf=document.querySelector("#ticketPriorityFilter"),qf=document.querySelector("#ticketSearchFilter");
  const filter=()=>{let list=MozakraTicketing.forCurrentUser();if(sf?.value)list=list.filter(t=>t.status===sf.value);if(pf?.value)list=list.filter(t=>t.priority===pf.value);if(qf?.value){const q=qf.value.trim().toLowerCase();list=list.filter(t=>(t.subject||"").toLowerCase().includes(q)||(t.userName||"").toLowerCase().includes(q)||(t.userEmail||"").toLowerCase().includes(q));}const box=document.querySelector("#ticketListOld");if(box)box.innerHTML=renderTicketRowsOld(list,isStaffRole(AUTH.user?.role));wireTicketPageOld();};
  sf?.addEventListener("change",filter);pf?.addEventListener("change",filter);qf?.addEventListener("input",filter);
}

/* ---------- لوحة التحكم (للمشرف فقط) ---------- */
function openTeacherEditor(id){
  const t = id ? teachers().find(x=>x.id===id) : null;
  const sOpts=Object.keys(CUR).map(x=>`<option value="${x}" ${t&&t.s===x?"selected":""}>${SUB(x).name}</option>`).join("");
  const linksTxt=(t&&t.links||[]).map(l=>`${l.k}|${l.t}|${l.url}`).join("\n");
  $("#layer").innerHTML=`<div class="modal" data-close="1"><div class="box" style="max-width:520px">
    <div class="between" style="margin-bottom:10px"><h2>${t?"تعديل":"إضافة"} مدرّس</h2><button class="btn sm" data-close="1">إغلاق</button></div>
    <input type="hidden" id="tf_id" value="${t?esc(t.id):""}">
    <label class="field"><span>المادة</span><select id="tf_s">${sOpts}</select></label>
    <label class="field"><span>اللقب (اختياري، زي د. أو أ.)</span><input id="tf_ti" value="${t?esc(t.ti||""):""}"></label>
    <label class="field"><span>الاسم</span><input id="tf_n" value="${t?esc(t.n):""}"></label>
    <label class="field"><span>نبذة قصيرة (اختياري)</span><textarea id="tf_bio" rows="2">${t?esc(t.bio||""):""}</textarea></label>
    <label class="field"><span>الروابط — سطر لكل رابط بالشكل: نوع|الاسم|الرابط</span>
      <textarea id="tf_links" rows="4" placeholder="site|الموقع|https://...">${esc(linksTxt)}</textarea></label>
    <p class="xs muted" style="margin:-4px 0 10px">الأنواع المتاحة: site, yt, fb, tg, ig, app, lt, wa — والرابط لازم يبدأ بـ https://</p>
    <button class="btn primary" data-act="saveteacher">حفظ</button>
    ${t?`<button class="btn" style="width:100%;margin-top:8px" data-act="deleteteacher" data-id="${esc(t.id)}">🗑️ حذف المدرّس ده</button>`:""}
  </div></div>`;
}
function vAdmin(){
  if(!(AUTH.user&&isManagerRole(AUTH.user.role))) return vNotFound();
  const tk=SUPPORT.tickets||[];
  const open=tk.filter(t=>!['resolved','closed'].includes(t.status)).length;
  return `<h1>🛠️ لوحة التحكم</h1><p class="muted sm" style="margin-bottom:18px">رتبتك الحالية: <b>${roleLabel(AUTH.user.role)}</b> — إدارة المحتوى والتذاكر والرتب حسب الصلاحيات.</p>

  ${AUTH.user.role==='owner'||AUTH.user.role==='admin'?`<div class="between" style="margin-bottom:10px"><h2>👨‍🏫 المدرسين (${teachers().length})</h2><button class="btn sm primary" data-act="newteacher">➕ مدرّس جديد</button></div>
  <div class="grid g3" style="margin-bottom:24px">${teachers().map(t=>`<div class="card"><b>${t.ti?esc(t.ti)+" ":""}${esc(t.n)}</b><div class="sm muted">${SUB(t.s).name} · ${linksLabel((t.links||[]).length)}</div><button class="btn sm" style="margin-top:8px" data-act="editteacher" data-id="${t.id}">✏️ تعديل</button></div>`).join('')}</div>`:''}

  ${AUTH.user.role==='owner'||AUTH.user.role==='admin'?`<h2 style="margin-bottom:10px">📣 إشعار جديد</h2>
  <div class="card" style="margin-bottom:24px">
    <label class="field"><span>العنوان</span><input id="n_title" placeholder="مثلاً: امتحان تجريبي الأسبوع الجاي"></label>
    <label class="field"><span>النص (اختياري)</span><textarea id="n_body" rows="2"></textarea></label>
    <label class="field"><span>لمين؟</span><input id="n_to" value="all" placeholder="all / staff / رقم موبايل / إيميل طالب"></label>
    <button class="btn primary" data-act="sendnotif">إرسال الإشعار</button>
  </div>`:''}

  ${AUTH.user.role==='owner'?`<h2 style="margin-bottom:10px">👑 لوحة الـ OWNER — تحكم كامل</h2>
  <div class="grid g4" style="margin-bottom:16px">
    <div class="card"><div class="xs muted">كل الحسابات</div><div style="font-size:28px;font-weight:800;margin-top:4px">${USERS.length}</div></div>
    <div class="card"><div class="xs muted">طلاب</div><div style="font-size:28px;font-weight:800;margin-top:4px">${USERS.filter(u=>u.role==='student').length}</div></div>
    <div class="card"><div class="xs muted">فريق الإدارة</div><div style="font-size:28px;font-weight:800;margin-top:4px">${USERS.filter(u=>u.role!=='student').length}</div></div>
    <a class="card" href="#/admin-chat" style="text-decoration:none"><div class="xs muted">شات الإدارة</div><div style="font-size:22px;font-weight:800;margin-top:7px">💬 فتح الشات</div></a>
  </div>
  <div class="grid g2" style="margin-bottom:24px">
    <div class="card">
      <h3 style="margin-bottom:8px">تغيير الرتبة برقم الموبايل</h3>
      <p class="muted sm" style="margin-bottom:10px">الـ OWNER فقط يقدر يضيف أو يزيل رتب الحسابات.</p>
      <label class="field"><span>رقم الموبايل</span><input id="role_phone" inputmode="tel" placeholder="01xxxxxxxxx"></label>
      <label class="field"><span>الرتبة الجديدة</span><select id="role_value">${['student','support','moderator','admin'].map(r=>`<option value="${r}">${roleLabel(r)}</option>`).join('')}</select></label>
      <button class="btn primary" data-act="setrolephone">تعيين الرتبة</button>
    </div>
    <div class="card">
      <h3 style="margin-bottom:8px">تسجيل بريد إلكتروني</h3>
      <p class="muted sm" style="margin-bottom:10px">البريد الإلكتروني لا يضيفه إلا الـ OWNER.</p>
      <label class="field"><span>رقم الموبايل</span><input id="email_phone" inputmode="tel" placeholder="01xxxxxxxxx"></label>
      <label class="field"><span>البريد الإلكتروني</span><input id="user_email" type="email" placeholder="student@example.com"></label>
      <button class="btn primary" data-act="setuseremail">حفظ البريد</button>
    </div>
  </div>
  <div class="between" style="margin-bottom:10px"><h2>👥 الحسابات المسجلة</h2><input id="ownerUserSearch" class="input" placeholder="بحث بالاسم أو الرقم أو البريد…" style="max-width:320px"></div>
  <div class="card" style="margin-bottom:24px">
    ${USERS.length?`<div class="ticket-user-table" id="ownerUsersList">${USERS.map(u=>`<div class="item owner-user-row" data-search="${esc(`${u.name||''} ${u.phone||''} ${u.email||''} ${roleLabel(u.role)}`.toLowerCase())}" style="align-items:flex-start">
      <div class="ico">${u.role==='owner'?'👑':u.role==='admin'?'🔴':u.role==='moderator'?'🟠':u.role==='support'?'🔵':'👤'}</div>
      <div class="gr" style="min-width:0">
        <b>${esc(u.name||'طالب')}</b>
        <span>${esc(u.phone||'بدون رقم')} · ${esc(roleLabel(u.role))}${u.email?` · ${esc(u.email)}`:''}${u.grade?` · ${esc(educationGradeLabel(u.grade))}`:''}${u.branch?` — ${esc(educationBranchLabel(u.grade,u.branch))}`:''}</span>
        <div class="row" style="margin-top:8px;flex-wrap:wrap;gap:7px">
          ${u.role==='owner'?`<span class="chip on">حساب OWNER محمي</span>`:`<select class="select" data-act="setrole" data-id="${esc(u.id)}" style="min-width:150px">${['student','support','moderator','admin'].map(r=>`<option value="${r}" ${u.role===r?'selected':''}>${roleLabel(r)}</option>`).join('')}</select><button class="btn sm" data-act="deleteuser" data-id="${esc(u.id)}">🗑️ حذف الحساب</button>`}
        </div>
      </div>
    </div>`).join('')}</div>`:`<div class="empty"><b>مفيش حسابات مسجلة لسه</b></div>`}
  </div>
  <div class="between" style="margin-bottom:10px"><h2>🧾 سجل النشاط</h2><span class="xs muted">آخر ${Math.min((AUDITLOGS||[]).length,100)} عملية</span></div>
  <div class="card" style="margin-bottom:24px">
    ${(AUDITLOGS||[]).length?`<div id="ownerAuditList">${AUDITLOGS.slice(0,100).map(a=>{
      const d=a.details||{};
      const labels={login_success:'دخول ناجح',logout:'تسجيل خروج',signup:'إنشاء حساب',role_changed:'تغيير رتبة',email_changed:'تغيير بريد',user_deleted:'حذف حساب',notification_sent:'إرسال إشعار',ticket_created:'فتح تذكرة',ticket_reply:'رد على تذكرة',admin_chat_message:'رسالة شات الإدارة'};
      const extra= a.action==='role_changed'?` → ${esc(roleLabel(d.to_role||'student'))}`:a.action==='notification_sent'?` · ${esc(d.target||'all')}`:a.action==='user_deleted'?` · ${esc(d.role||'student')}`:a.action==='ticket_created'?` · ${esc(d.subject||'تذكرة')}`:'';
      return `<div class="item" style="align-items:flex-start;margin-bottom:7px"><div class="ico">${a.actorRole==='owner'?'👑':a.actorRole==='admin'?'🔴':a.actorRole==='moderator'?'🟠':a.actorRole==='support'?'🔵':'👤'}</div><div class="gr"><div><b>${esc(labels[a.action]||a.action)}</b>${extra}</div><span class="sm muted">بواسطة ${esc(a.actorName||'زائر')} · ${esc(roleLabel(a.actorRole||'student'))}${a.targetName?` · الهدف: ${esc(a.targetName)}`:''} · ${fmtTicketTimeOld(a.createdAt)}</span></div></div>`;
    }).join('')}</div>`:`<div class="empty"><b>مفيش نشاط مسجل لسه</b><div class="sm muted">أول ما حد يسجل أو يدخل أو يعمل إجراء، هيظهر هنا.</div></div>`}
  </div>`:''}

  <div class="between" style="margin-bottom:10px"><h2>🆘 الدعم الفني</h2>${open?`<span class="chip on">${open} مفتوحة</span>`:""}</div>
  ${tk.length? tk.map(t=>`<div class="card" style="margin-bottom:10px"><div class="between"><b>${esc(t.name||"طالب")}</b><span class="xs muted">${esc(t.email||'بدون إيميل')} · ${esc(t.uid||'')}</span></div><p style="margin-top:6px">${esc(t.message||'')}</p>${t.reply?`<div class="card" style="margin-top:8px;background:var(--card2)"><b>ردّ الفريق</b><p style="margin-top:4px">${esc(t.reply)}</p></div>`:`<div style="margin-top:8px"><textarea data-reply-for="${t.id}" rows="2" placeholder="اكتب ردّك..." style="width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:var(--card2)"></textarea><button class="btn sm primary" style="margin-top:6px" data-act="replysupport" data-id="${t.id}">رد</button></div>`}</div>`).join(''):`<div class="empty"><b>لسه مفيش رسائل دعم فني</b></div>`}`;
}


function vAdminChat(){
  if(!(AUTH.user&&isStaffRole(AUTH.user.role))) return vNotFound();
  const msgs=ADMINCHAT.messages||[];
  return `<h1>💬 شات الإدارة</h1><p class="muted sm" style="margin-bottom:18px">شات داخلي بين الـ OWNER والإدارة والمشرفين والدعم. الطلاب لا يمكنهم الدخول إليه.</p>
  <div class="card admin-chat-box" style="margin-bottom:12px;max-height:55vh;overflow:auto">
    ${msgs.length?msgs.map(m=>`<div class="item" style="align-items:flex-start;margin-bottom:10px"><div class="ico">${m.authorRole==='owner'?'👑':m.authorRole==='admin'?'🔴':m.authorRole==='moderator'?'🟠':'🔵'}</div><div class="gr"><div><b>${esc(m.authorName||'فريق الإدارة')}</b> <span class="xs muted">${esc(roleLabel(m.authorRole))} · ${fmtTicketTimeOld(m.createdAt)}</span></div><div style="margin-top:4px;white-space:pre-wrap">${esc(m.text)}</div></div></div>`).join(''):`<div class="empty"><b>مفيش رسائل لسه</b><div class="sm muted">ابدأ أول رسالة للإدارة.</div></div>`}
  </div>
  <form id="adminChatForm" class="card"><label class="field"><span>رسالتك</span><textarea id="adminChatText" rows="3" maxlength="4000" placeholder="اكتب رسالة للإدارة…" required></textarea></label><button class="btn primary" type="submit">إرسال 💬</button></form>`;
}

function vNotFound(){ return `<div class="empty"><b>الصفحة مش موجودة</b><a class="btn" href="#/dash">رجوع للرئيسية</a></div>`; }
