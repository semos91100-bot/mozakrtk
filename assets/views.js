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
  return `
  <section class="hero">
    <div class="hero-top">
      <div>
        <h1>${greet} يا ${esc(S.name||"بطل")} 👋</h1>
        <p class="muted sm">هدفك النهارده ${fmtMin(sch.goal)} — ذاكرت لحد دلوقتي ${fmtMin(m)}</p>
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
      `<p class="muted sm">شوف شرح الدرس ده عند مدرّسك من صفحته:</p>`}
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
  const links=t.links||[], lect=t.lectures||[], notes=t.notes||[];
  const list=(arr,ico)=>arr.map(l=>`<a class="item" target="_blank" rel="noopener noreferrer" href="${esc(l.url)}"><div class="ico">${ico}</div><div class="gr"><b>${esc(l.t)}</b></div></a>`).join("");
  return `<p class="sm muted"><a href="#/teachers">المدرسين</a> › ${s.emoji} ${s.name}</p>
  <div class="between" style="margin:4px 0 14px;gap:10px;flex-wrap:wrap">
    <h1>${t.ti?esc(t.ti)+" ":""}${esc(t.n)}</h1>
    <button class="btn ${mine?"primary":""}" data-act="toggleteacher" data-id="${t.id}">${mine?"✓ مدرّسك — إلغاء":"➕ اختاره كمدرّسك"}</button>
  </div>
  ${t.bio?`<div class="card" style="margin-bottom:14px"><p>${esc(t.bio)}</p></div>`:""}
  <div class="card"><h2>🔗 روابط المدرّس</h2>
    ${links.length?`<div class="row" style="margin-top:8px">${links.map(l=>`<a class="chip" target="_blank" rel="noopener noreferrer" href="${esc(l.url)}">${KIND_ICON[l.k]||"🔗"} ${esc(l.t)}</a>`).join("")}</div>
      <p class="xs muted" style="margin-top:10px">الروابط دي اتجمعت من صفحات المدرّس نفسه على الإنترنت.</p>`
    :`<div class="empty"><b>لسه مفيش روابط</b>هتتضاف أول ما نتأكد من صفحة المدرّس نفسه.</div>`}
  </div>
  ${lect.length||notes.length?`<div class="grid g2" style="margin-top:14px">
    ${lect.length?`<div class="card"><h2>🎥 المحاضرات</h2>${list(lect,"▶")}</div>`:""}
    ${notes.length?`<div class="card"><h2>📄 المذكرات</h2>${list(notes,"📄")}</div>`:""}
  </div>`:""}`;
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

function vNotFound(){ return `<div class="empty"><b>الصفحة مش موجودة</b><a class="btn" href="#/dash">رجوع للرئيسية</a></div>`; }


/* ---------- الدعم الفني ---------- */
function supportStatusLabel(status){
  return status==='waiting_user'?'في انتظار ردّك':status==='closed'?'مغلق':'محول للمشرف';
}
function supportMsgView(m){
  const who=m.sender==='admin'?'المشرف':m.sender==='user'?'أنت':'الدعم الفني';
  const cls=m.sender==='user'?'me':m.sender==='admin'?'ai':'support';
  return `<div class="msg ${cls}"><small>${esc(who)}</small>${esc(m.text)}</div>`;
}
function vSupport(){
  const t=SUPPORT.ticket;
  if(!AUTH.user) return `<div class="card"><h1>🛠️ الدعم الفني</h1><p class="muted" style="margin:10px 0 14px">سجّل دخولك الأول عشان نقدر نربط طلب الدعم بحسابك ويتابع معاك المشرف.</p><button class="btn primary" data-auth="login">تسجيل الدخول</button></div>`;
  if(!t) return `<div class="card support-intro"><div class="support-avatar">🛠️</div><div><h1>الدعم الفني</h1><p class="muted sm">أهلًا بيك. قبل ما أحوّلك للمشرف، قولّي إيه السبب أو المشكلة اللي قابلتك؟</p></div><label class="field" style="margin-top:16px"><span>سبب التواصل</span><textarea id="supportReason" rows="5" placeholder="اكتب المشكلة بالتفصيل…"></textarea></label><div class="row"><button class="btn primary" data-act="supportcreate" ${SUPPORT.busy?'disabled':''}>${SUPPORT.busy?'جاري التحويل…':'إرسال وتحويل للمشرف'}</button></div></div>`;
  return `<div class="between" style="margin-bottom:12px"><div><h1>🛠️ الدعم الفني</h1><p class="muted sm">سبب الطلب: ${esc(t.reason)}</p></div><span class="chip ${t.status==='waiting_user'?'on':''}">${supportStatusLabel(t.status)}</span></div>
  <div class="card"><div class="chat support-chat" id="supportChat">${(t.messages||[]).map(supportMsgView).join('')}</div>
  ${t.status==='closed'?`<div class="empty"><b>تم إغلاق الطلب</b>تقدر تبدأ طلب دعم جديد من خلال زر «طلب دعم جديد».</div><button class="btn" data-act="supportnew">طلب دعم جديد</button>`:`<div class="composer"><textarea id="supportInput" rows="1" placeholder="اكتب ردك أو أي تفاصيل إضافية…"></textarea><button class="btn primary" data-act="supportsend" ${SUPPORT.busy?'disabled':''}>${SUPPORT.busy?'جاري الإرسال…':'إرسال'}</button></div>`}</div>`;
}
