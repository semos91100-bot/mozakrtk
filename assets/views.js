// ============ Views ============

function requireAuthNote(){
  return `<div class="card" style="text-align:center;padding:40px">
    <div style="font-size:34px;margin-bottom:8px">🔒</div>
    <h3>لازم تسجّل الدخول الأول</h3>
    <p style="color:var(--text-dim);font-size:13.5px">سجّل دخولك أو اعمل حساب عشان تقدر تستخدم الصفحة دي.</p>
    <button class="btn" onclick="openAuthModal('login')" style="margin-top:10px">تسجيل الدخول</button>
  </div>`;
}

// ---------- Dashboard ----------
function viewDashboard(){
  const u = Auth.current();
  const st = Tickets.stats();
  return `
  <div class="section-title"><div><h2>أهلاً ${u? esc(u.name.split(" ")[0]) : "بيك"} 👋</h2><p>نظرة سريعة على منصة مُذاكرة</p></div></div>
  <div class="grid cols-4">
    <div class="card stat"><div class="n">${SUBJECTS.length}</div><div class="l">مواد دراسية</div></div>
    <div class="card stat"><div class="n">${TEACHERS.length}</div><div class="l">مدرّسين</div></div>
    <div class="card stat"><div class="n">${st.open+st.progress}</div><div class="l">تذاكر دعم مفتوحة</div></div>
    <div class="card stat"><div class="n">${st.resolved}</div><div class="l">تذاكر تم حلها</div></div>
  </div>
  <div class="section-title" style="margin-top:22px"><h2>المواد الدراسية</h2></div>
  <div class="grid cols-3">
    ${SUBJECTS.map(s=>`
      <div class="card" style="border-inline-start:4px solid ${s.color}">
        <div style="font-size:26px">${s.icon}</div>
        <b>${esc(s.name)}</b>
        <p style="color:var(--text-dim);font-size:12.5px;margin:4px 0 0">المنهج كامل + بنك أسئلة + اختبارات</p>
      </div>`).join("")}
  </div>`;
}

// ---------- Subjects / Teachers ----------
function viewSubjects(){
  return `
  <div class="section-title"><div><h2>المواد الدراسية</h2><p>فيزياء، كيمياء، أحياء، عربي، إنجليزي</p></div></div>
  <div class="grid cols-3">
    ${SUBJECTS.map(s=>`
      <div class="card">
        <div style="font-size:30px">${s.icon}</div>
        <b style="font-size:15px">${esc(s.name)}</b>
        <p style="color:var(--text-dim);font-size:12.5px">شجرة المنهج، محاضرات، بنك أسئلة، اختبارات محاكاة.</p>
        <button class="btn sm ghost" style="margin-top:8px" disabled>فتح المادة</button>
      </div>`).join("")}
  </div>`;
}

function viewTeachers(){
  return `
  <div class="section-title"><div><h2>المدرّسون</h2><p>تعرّف على مدرّسي كل مادة</p></div></div>
  <div class="grid cols-3">
    ${TEACHERS.map(t=>{ const s = SUBJECTS.find(x=>x.id===t.subject);
      return `<div class="card">
        <div style="width:44px;height:44px;border-radius:50%;background:${s.color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800">${t.name[3]}</div>
        <b style="display:block;margin-top:8px">${esc(t.name)}</b>
        <span class="badge" style="background:${s.color}22;color:${s.color}">${s.icon} ${s.name}</span>
        <p style="color:var(--text-dim);font-size:12.5px;margin-top:8px">${esc(t.bio)}</p>
      </div>`; }).join("")}
  </div>`;
}

// ---------- الاختبارات ----------
function viewExams(){
  const u = Auth.current();
  return `
  <div class="section-title"><div><h2>الاختبارات</h2><p>اختبر نفسك في كل مادة واعرف نتيجتك فورًا</p></div></div>
  <div class="grid cols-3">
    ${SUBJECTS.map(s=>{
      const exam = EXAMS[s.id];
      const best = u ? ExamResults.bestFor(s.id) : null;
      return `<div class="card" style="border-inline-start:4px solid ${s.color}">
        <div style="font-size:26px">${s.icon}</div>
        <b>${esc(s.name)}</b>
        <p style="color:var(--text-dim);font-size:12.5px;margin:4px 0 10px">${exam.questions.length} أسئلة — اختيار من متعدد</p>
        ${best ? `<span class="badge resolved" style="margin-bottom:10px">أفضل نتيجة: ${best.score}/${best.total}</span><br>` : ""}
        <button class="btn sm" onclick="Router.go('exam?subject=${s.id}')" style="margin-top:6px">${u? 'ابدأ الاختبار' : 'سجّل دخول للبدء'}</button>
      </div>`;
    }).join("")}
  </div>`;
}

let __examAnswers = {};
function viewExamTake(){
  const u = Auth.current();
  if(!u) return requireAuthNote();
  const subjectId = Router.query().subject;
  const s = SUBJECTS.find(x=>x.id===subjectId);
  const exam = EXAMS[subjectId];
  if(!s || !exam) return `<div class="card">اختبار غير موجود. <a href="#/exams">رجوع للاختبارات</a></div>`;

  if(__examAnswers.__result && __examAnswers.__subject===subjectId){
    const r = __examAnswers.__result;
    return `
    <div class="card" style="max-width:520px;margin:0 auto;text-align:center;padding:36px">
      <div style="font-size:40px">${r.score===r.total?'🏆':r.score/r.total>=0.6?'✅':'📘'}</div>
      <h2>نتيجتك في ${esc(exam.title)}</h2>
      <div style="font-size:34px;font-weight:800;color:${s.color};margin:10px 0">${r.score} / ${r.total}</div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:14px">
        <button class="btn" onclick="retakeExam('${subjectId}')">إعادة الاختبار</button>
        <button class="btn ghost" onclick="Router.go('exams')">كل الاختبارات</button>
      </div>
    </div>`;
  }

  return `
  <div class="section-title"><div><h2>${esc(exam.title)}</h2><p>${exam.questions.length} أسئلة — اختر إجابة واحدة لكل سؤال</p></div>
    <a href="#/exams" class="btn sm ghost">رجوع</a></div>
  <form class="card" id="examForm" onsubmit="submitExam(event,'${subjectId}')" style="max-width:680px;margin:0 auto">
    ${exam.questions.map((q,i)=>`
      <div style="padding:14px 0;border-bottom:1px solid var(--border)">
        <b style="font-size:14px">${i+1}. ${esc(q.q)}</b>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px">
          ${q.options.map((op,oi)=>`
            <label style="display:flex;align-items:center;gap:8px;font-size:13.5px;background:var(--surface-2);padding:8px 10px;border-radius:9px;cursor:pointer">
              <input type="radio" name="q${i}" value="${oi}" required> ${esc(op)}
            </label>`).join("")}
        </div>
      </div>`).join("")}
    <button class="btn" style="width:100%;margin-top:14px" type="submit">تسليم الاختبار</button>
  </form>`;
}

function submitExam(e, subjectId){
  e.preventDefault();
  const exam = EXAMS[subjectId];
  const f = new FormData(e.target);
  let score = 0;
  exam.questions.forEach((q,i)=>{ if(parseInt(f.get(`q${i}`),10)===q.correct) score++; });
  ExamResults.save(subjectId, score, exam.questions.length);
  __examAnswers = { __result:{score, total:exam.questions.length}, __subject:subjectId };
  Router.render();
}
function retakeExam(subjectId){ __examAnswers = {}; Router.render(); }

function viewSettings(){
  const u = Auth.current();
  if(!u) return requireAuthNote();
  return `
  <div class="section-title"><div><h2>الإعدادات</h2><p>بيانات حسابك وتفضيلاتك</p></div></div>
  <div class="card" style="max-width:480px">
    <div class="field"><label>الاسم</label><input value="${esc(u.name)}" disabled></div>
    <div class="field"><label>البريد الإلكتروني</label><input value="${esc(u.email)}" disabled></div>
    <div class="field"><label>الدور</label><input value="${u.role==='admin'?'إدارة':'طالب'}" disabled></div>
    <button class="btn ghost" onclick="Theme.toggle()">تبديل الوضع الليلي/النهاري</button>
  </div>`;
}

// ============================================================
// ===============  نظام تذاكر الدعم الفني  ====================
// ============================================================
let __activeTicket = null;
let __creatingTicket = false;

function priorityBadge(p){ const o = TICKET_PRIORITIES.find(x=>x.id===p)||TICKET_PRIORITIES[1]; return `<span class="badge p-${p}">${o.name}</span>`; }
function statusBadge(s){ const o = TICKET_STATUSES.find(x=>x.id===s)||TICKET_STATUSES[0]; return `<span class="badge ${o.cls}">${o.name}</span>`; }
function categoryName(c){ return (TICKET_CATEGORIES.find(x=>x.id===c)||{}).name || c; }

function viewSupport(){
  const u = Auth.current();
  if(!u) return requireAuthNote();
  const isAdmin = u.role==="admin";
  const list = Tickets.forCurrentUser();
  if(!__activeTicket && list.length) __activeTicket = list[0].id;

  return `
  <div class="section-title">
    <div><h2>${isAdmin? "لوحة الدعم الفني — كل التذاكر" : "الدعم الفني"}</h2>
      <p>${isAdmin? "تابع وردّ على تذاكر الطلاب بحسب الأولوية والحالة" : "افتح تذكرة جديدة وتابع الردود من فريق الدعم"}</p></div>
    ${!isAdmin? `<button class="btn gold" onclick="startNewTicket()">+ تذكرة جديدة</button>` : ""}
  </div>

  ${isAdmin? renderTicketStats() : ""}

  <div class="support-wrap">
    <div>
      ${renderFilters(isAdmin)}
      <div class="ticket-list" id="ticketList">${renderTicketRows(list, isAdmin)}</div>
    </div>
    <div id="ticketDetailWrap">${__creatingTicket ? renderNewTicketForm() : renderTicketDetail(__activeTicket, isAdmin)}</div>
  </div>`;
}

function renderTicketStats(){
  const st = Tickets.stats();
  return `<div class="grid cols-4" style="margin-bottom:16px">
    <div class="card stat"><div class="n">${st.open}</div><div class="l">مفتوحة</div></div>
    <div class="card stat"><div class="n">${st.progress}</div><div class="l">قيد المعالجة</div></div>
    <div class="card stat"><div class="n">${st.resolved}</div><div class="l">تم حلها</div></div>
    <div class="card stat"><div class="n" style="color:var(--danger)">${st.urgent}</div><div class="l">عاجلة وغير محلولة</div></div>
  </div>`;
}

function renderFilters(isAdmin){
  return `<div class="filters">
    <select id="fStatus" onchange="applyTicketFilters()">
      <option value="">كل الحالات</option>
      ${TICKET_STATUSES.map(s=>`<option value="${s.id}">${s.name}</option>`).join("")}
    </select>
    <select id="fPriority" onchange="applyTicketFilters()">
      <option value="">كل الأولويات</option>
      ${TICKET_PRIORITIES.map(p=>`<option value="${p.id}">${p.name}</option>`).join("")}
    </select>
    ${isAdmin? `<input id="fSearch" placeholder="بحث بالاسم أو الموضوع…" oninput="applyTicketFilters()">` : ""}
  </div>`;
}

function renderTicketRows(list, isAdmin){
  if(!list.length) return `<div class="empty-state" style="height:auto;padding:30px"><div class="ico">🎫</div><p>لا توجد تذاكر بعد.</p></div>`;
  return list.map(t=>{
    const last = t.messages[t.messages.length-1];
    return `<div class="ticket-row ${t.id===__activeTicket?'active':''}" onclick="selectTicket('${t.id}')">
      <div class="top"><span class="id">#${t.id}</span>${statusBadge(t.status)}</div>
      <div class="subject">${esc(t.subject)}</div>
      ${isAdmin? `<div style="font-size:12px;color:var(--text-dim)">👤 ${esc(t.userName)}</div>`:""}
      <div class="meta">${priorityBadge(t.priority)}<span class="badge" style="background:var(--muted-bg);color:var(--text-dim)">${categoryName(t.category)}</span></div>
      <div class="last">${last? esc(last.text):""}</div>
    </div>`;
  }).join("");
}

function renderTicketDetail(id, isAdmin){
  const t = Tickets.get(id);
  if(!t) return `<div class="ticket-detail"><div class="empty-state"><div class="ico">💬</div><p>اختر تذكرة لعرض التفاصيل</p></div></div>`;
  return `<div class="ticket-detail">
    <div class="dhead">
      <div>
        <div style="font-size:11px;color:var(--text-dim);font-family:monospace">#${t.id}</div>
        <h3 style="margin:2px 0">${esc(t.subject)}</h3>
        <div style="font-size:12.5px;color:var(--text-dim)">${isAdmin? `${esc(t.userName)} — ${esc(t.userEmail)}` : `فتحت في ${fmtTime(t.createdAt)}`}</div>
      </div>
      <div class="controls">
        ${statusBadge(t.status)} ${priorityBadge(t.priority)}
        ${isAdmin? `
          <select onchange="changeTicketStatus('${t.id}', this.value)">
            ${TICKET_STATUSES.map(s=>`<option value="${s.id}" ${s.id===t.status?'selected':''}>${s.name}</option>`).join("")}
          </select>
          <select onchange="changeTicketPriority('${t.id}', this.value)">
            ${TICKET_PRIORITIES.map(p=>`<option value="${p.id}" ${p.id===t.priority?'selected':''}>${p.name}</option>`).join("")}
          </select>` : ""}
      </div>
    </div>
    <div class="thread">
      ${t.messages.map(m=>`<div class="msg ${m.from}">
        <div style="font-size:11px;font-weight:700;opacity:.8">${m.from==='admin'?'فريق الدعم':esc(m.authorName)}</div>
        ${esc(m.text)}
        <span class="time">${fmtTime(m.at)}</span>
      </div>`).join("")}
    </div>
    <form class="composer" onsubmit="submitTicketReply(event,'${t.id}')">
      <textarea placeholder="اكتب ردك هنا…" required></textarea>
      <button class="btn" type="submit">إرسال</button>
    </form>
  </div>`;
}

function selectTicket(id){ __activeTicket = id; __creatingTicket = false; Router.render(); }

function applyTicketFilters(){
  const status = $("#fStatus") ? $("#fStatus").value : "";
  const priority = $("#fPriority") ? $("#fPriority").value : "";
  const search = $("#fSearch") ? $("#fSearch").value.trim().toLowerCase() : "";
  let list = Tickets.forCurrentUser();
  if(status) list = list.filter(t=>t.status===status);
  if(priority) list = list.filter(t=>t.priority===priority);
  if(search) list = list.filter(t=> t.subject.toLowerCase().includes(search) || (t.userName||"").toLowerCase().includes(search));
  $("#ticketList").innerHTML = renderTicketRows(list, Auth.isAdmin());
}

function changeTicketStatus(id, status){ Tickets.setStatus(id, status); toast("اتحدّثت حالة التذكرة"); Router.render(); }
function changeTicketPriority(id, priority){ Tickets.setPriority(id, priority); toast("اتحدّثت الأولوية"); Router.render(); }

function submitTicketReply(e, id){
  e.preventDefault();
  const ta = e.target.querySelector("textarea");
  const r = Tickets.reply(id, ta.value.trim(), Auth.isAdmin());
  if(r.ok){ refreshAuthUI(); Router.render(); }
}

// فتح تذكرة جديدة — بقت جوه صفحة الدعم الفني نفسها مش نافذة منبثقة
function startNewTicket(){ __creatingTicket = true; Router.render(); }
function cancelNewTicket(){ __creatingTicket = false; Router.render(); }

function renderNewTicketForm(){
  return `<div class="ticket-detail">
    <div class="dhead">
      <div><h3 style="margin:2px 0">🎫 فتح تذكرة دعم فني جديدة</h3>
      <div style="font-size:12.5px;color:var(--text-dim)">اكتب مشكلتك وهيوصل رد من فريق الدعم هنا في نفس المكان</div></div>
      <button class="btn sm ghost" type="button" onclick="cancelNewTicket()">إلغاء</button>
    </div>
    <form id="newTicketForm" style="padding:16px;overflow:auto">
      <div class="field"><label>موضوع التذكرة</label><input name="subject" required placeholder="مثال: مشكلة في تسجيل الدخول"></div>
      <div class="grid cols-2">
        <div class="field"><label>التصنيف</label>
          <select name="category">${TICKET_CATEGORIES.map(c=>`<option value="${c.id}">${c.name}</option>`).join("")}</select>
        </div>
        <div class="field"><label>الأولوية</label>
          <select name="priority">${TICKET_PRIORITIES.map(p=>`<option value="${p.id}" ${p.id==='medium'?'selected':''}>${p.name}</option>`).join("")}</select>
        </div>
      </div>
      <div class="field"><label>تفاصيل المشكلة</label><textarea name="message" required placeholder="اشرح المشكلة بالتفصيل…"></textarea></div>
      <button class="btn" style="width:100%" type="submit">إرسال التذكرة</button>
    </form>
  </div>`;
}

// يتم ربط الفورم بعد كل رندر لأنه محتوى ديناميكي — انظر onRouteRendered في app.js
function wireNewTicketForm(){
  const form = $("#newTicketForm");
  if(!form || form.dataset.wired) return;
  form.dataset.wired = "1";
  form.addEventListener("submit", e=>{
    e.preventDefault();
    const f = new FormData(e.target);
    const r = Tickets.create({ subject:f.get("subject"), category:f.get("category"), priority:f.get("priority"), message:f.get("message") });
    if(!r.ok) return toast(r.msg);
    __activeTicket = r.ticket.id;
    __creatingTicket = false;
    toast("تم إرسال التذكرة بنجاح ✅");
    Router.render();
  });
}
