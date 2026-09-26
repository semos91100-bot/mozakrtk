(function(){
  const C=window.MozakraCore, D=window.MozakraData;
  const view=C.$('#view'), nav=C.$('#nav'), tab=C.$('#tabbar');
  const esc=v=>C.escape(v);
  function navButton([id,label,icon]){return `<button type="button" data-route="${id}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`}
  function renderNav(){
    nav.innerHTML=D.nav.map(navButton).join('');
    tab.innerHTML=D.nav.slice(0,4).map(navButton).join('');
    document.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>window.MozakraApp.go(b.dataset.route));
    mark();
  }
  function mark(){document.querySelectorAll('[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===C.state.route))}
  function shell(title,body,actions=''){return `<section><div class="section-head"><div><h2>${title}</h2></div><div>${actions}</div></div>${body}</section>`}
  function home(){
    const u=C.state.user;
    const primary=u
      ? `<div class="hero-card primary"><h1>أهلاً يا ${esc(C.userName())} 👋</h1><p>خد مذاكرتك خطوة خطوة، وخلّي الدروس والمدرسين والاختبارات في مكان واحد.</p><div class="hero-actions"><button class="btn alt" onclick="MozakraApp.go('lessons')">ابدأ المذاكرة</button><button class="btn alt" onclick="MozakraApp.go('exams')">ابدأ اختبار</button></div></div>`
      : `<div class="hero-card primary"><h1>مُذاكرة — منصة الطلاب 📚</h1><p>سجل برقم موبايلك، اختار مسارك، وابدأ مع الدروس والمدرسين والاختبارات.</p><div class="hero-actions"><button class="btn alt" onclick="MozakraAuth.open('login')">تسجيل الدخول</button><button class="btn alt" onclick="MozakraAuth.open('signup')">إنشاء حساب</button></div></div>`;
    const side=`<div class="card"><div class="mini-stat"><b>${u?'✓':'+'}</b><span>${u?'الحساب متصل':'سجل حسابك وابدأ'}</span></div><div class="mini-stat"><b>${u?esc(C.track()):'24/7'}</b><span>${u?'مسارك الدراسي':'وصول مريح من الموبايل'}</span></div></div>`;
    view.innerHTML=`<div class="hero">${primary}${side}</div>`+shell('ابدأ من هنا',`<div class="grid"><div class="card pad icon-card"><div class="icon-bubble">📖</div><div><b>الدروس</b><div class="muted small">رتب مذاكرتك حسب المواد والدروس.</div></div></div><div class="card pad icon-card"><div class="icon-bubble">👨‍🏫</div><div><b>المدرسين</b><div class="muted small">اعرف المدرسين والمادة والمسار.</div></div></div><div class="card pad icon-card"><div class="icon-bubble">📝</div><div><b>الاختبارات</b><div class="muted small">اختبر نفسك واعرف نتيجتك فورًا.</div></div></div><div class="card pad icon-card"><div class="icon-bubble">💬</div><div><b>الدعم</b><div class="muted small">لو عندك مشكلة ابعت للدعم.</div></div></div></div>`);
  }
  function lessons(){
    const t=esc(C.track());
    view.innerHTML=shell('دروسي',`<div class="card pad"><div class="mini-stat"><b>${t}</b><span>المسار الدراسي الحالي</span></div><div class="grid" style="margin-top:12px"><div class="card pad"><b>الرياضيات</b><p class="muted small">مراجعة + تدريبات.</p></div><div class="card pad"><b>اللغة العربية</b><p class="muted small">قراءة وقواعد ومراجعات.</p></div><div class="card pad"><b>اللغة الإنجليزية</b><p class="muted small">مفردات وقواعد وتطبيق.</p></div><div class="card pad"><b>العلوم</b><p class="muted small">مفاهيم وأسئلة تدريبية.</p></div></div></div>`,'');
  }
  async function teachers(){
    view.innerHTML=shell('المدرسين','<div class="empty">جارٍ تحميل المدرسين…</div>');
    try{
      const r=await C.api('teachers');
      let arr=Array.isArray(r.teachers)?r.teachers:[];
      const userState=C.state.user?.state||{};
      arr=arr.filter(t=>{
        const gs=Array.isArray(t.grades)&&t.grades.length?t.grades:null;
        const bs=Array.isArray(t.branches)&&t.branches.length?t.branches:null;
        return (!gs||!userState.grade||gs.includes(userState.grade)) && (!bs||!userState.branch||bs.includes(userState.branch));
      });
      const body=arr.length?`<div class="grid grid-4">${arr.map(t=>`<article class="card pad teacher-card"><div class="teacher-avatar">👨‍🏫</div><h3>${esc(t.name||'مدرس')}</h3><div class="pill">${esc(t.subject||'المادة غير محددة')}</div><p class="muted small">${esc(t.bio||t.description||'مدرس متاح ضمن المنصة')}</p>${t.contact?`<div class="small muted">📞 ${esc(t.contact)}</div>`:''}</article>`).join('')}</div>`:'<div class="empty">مفيش مدرسين مضافين لمسارك لسه.</div>';
      view.innerHTML=shell('المدرسين',body);
    }catch(e){view.innerHTML=shell('المدرسين',`<div class="notice">${esc(e.message)}</div>`)}
  }
  async function exams(){
    if(!C.state.user){view.innerHTML=shell('الاختبارات','<div class="empty">سجل الدخول أولاً علشان تشوف الاختبارات.</div>');return;}
    view.innerHTML=shell('الاختبارات','<div class="empty">جارٍ تحميل الاختبارات…</div>');
    try{
      const r=await C.api('examlist'); const items=r.exams||[];
      const body=items.length?`<div class="grid">${items.map(x=>`<article class="card pad"><span class="pill">${esc(x.subject||'اختبار')}</span><h3>${esc(x.title)}</h3><p class="muted small">${esc(x.description||'اختبار تدريبي')}</p><div class="small muted">⏱ ${Number(x.duration_minutes||0)} دقيقة</div><button class="btn" style="margin-top:12px" onclick="MozakraApp.openExam(${Number(x.id)})">ابدأ الاختبار</button></article>`).join('')}</div>`:'<div class="empty">مفيش اختبارات منشورة لمسارك حاليًا.</div>';
      view.innerHTML=shell('الاختبارات',body);
    }catch(e){view.innerHTML=shell('الاختبارات',`<div class="notice">${esc(e.message)}</div>`)}
  }
  async function openExam(id){
    view.innerHTML=shell('الاختبار','<div class="empty">جارٍ تحميل الأسئلة…</div>');
    try{
      const r=await C.api('examget',{id}); const e=r.exam, qs=r.questions||[];
      if(!e||!qs.length){view.innerHTML=shell('الاختبار','<div class="empty">الاختبار بدون أسئلة حاليًا.</div>');return;}
      const body=`<div class="card pad"><div class="section-head"><div><h3>${esc(e.title)}</h3><div class="muted small">${esc(e.subject||'')} • ${Number(e.duration_minutes||0)} دقيقة</div></div></div><form id="examForm" class="exam-form">${qs.map((q,i)=>`<div class="exam-q"><b>${i+1}. ${esc(q.text||q.question||'')}</b><div class="exam-options">${(Array.isArray(q.options)?q.options:[]).map((o,j)=>`<label><input type="radio" name="q_${Number(q.id)}" value="${j}"> <span>${esc(o)}</span></label>`).join('')}</div></div>`).join('')}<div class="actions"><button class="btn" type="submit">إرسال الإجابات</button><button class="btn ghost" type="button" onclick="MozakraApp.go('exams')">رجوع</button></div></form></div>`;
      view.innerHTML=shell('الاختبار',body);
      document.getElementById('examForm').onsubmit=async ev=>{
        ev.preventDefault();
        const answers={};
        qs.forEach(q=>{const el=document.querySelector(`input[name="q_${Number(q.id)}"]:checked`);if(el)answers[q.id]=Number(el.value)});
        try{const out=await C.api('examsubmit',{id,answers});view.innerHTML=shell('نتيجتك',`<div class="card pad result-card"><div class="result-score">${Number(out.score||0)} / ${Number(out.total_points||0)}</div><p>النسبة: ${Number(out.percent||0)}%</p><p class="muted small">تم حفظ نتيجتك ويمكنك الرجوع لقائمة الاختبارات.</p><button class="btn" onclick="MozakraApp.go('exams')">العودة للاختبارات</button></div>`)}catch(e){C.toast(e.message)}};
    }catch(e){view.innerHTML=shell('الاختبار',`<div class="notice">${esc(e.message)}</div>`)}
  }
  function practice(){view.innerHTML=shell('تدريب وأسئلة',`<div class="card pad"><h3 style="margin-top:0">اختار نوع التدريب</h3><div class="grid"><button class="card pad" onclick="MozakraApp.go('exams')">📝 الاختبارات</button><button class="card pad" onclick="C=window.MozakraCore;C.toast('بنك الأسئلة هيتم توسيعه مع المحتوى الدراسي')">📚 بنك الأسئلة</button><button class="card pad" onclick="MozakraApp.go('profile')">📊 تقدّمك وحسابك</button></div></div>`)}
  async function notifications(){view.innerHTML=shell('الإشعارات','<div class="empty">جارٍ تحميل الإشعارات…</div>');try{const r=await C.api('notifications');C.state.notifications=r.notifications||[];view.innerHTML=shell('الإشعارات',C.state.notifications.length?`<div class="list">${C.state.notifications.map(n=>`<div class="list-item"><div><b>${esc(n.title||'إشعار')}</b><div class="muted small">${esc(n.body||'')}</div></div><span class="small muted">${n.created_at?new Date(n.created_at).toLocaleDateString('ar-EG'):''}</span></div>`).join('')}</div>`:'<div class="empty">مفيش إشعارات حالياً.</div>');}catch(e){view.innerHTML=shell('الإشعارات',`<div class="notice">${esc(e.message)}</div>`)}}
  async function tickets(){if(!C.state.user){view.innerHTML=shell('الدعم','<div class="empty">سجل الدخول أولاً علشان تقدر تفتح تذكرة دعم.</div>');return;}view.innerHTML=shell('الدعم','<div class="empty">جارٍ تحميل تذاكرك…</div>');try{const r=await C.api('tickets');const ts=r.tickets||[];let body=`<div class="actions"><button class="btn" onclick="MozakraApp.newTicket()">فتح تذكرة جديدة</button></div>`;if(ts.length) body+=`<div class="list" style="margin-top:12px">${ts.map(t=>`<div class="list-item"><div><b>${esc(t.subject||'بدون عنوان')}</b><div class="muted small">${esc(t.status||'open')}</div></div><button class="btn ghost" onclick="MozakraApp.openTicket('${esc(t.id||'')}')">فتح</button></div>`).join('')}</div>`;else body+='<div class="empty" style="margin-top:12px">لسه مفيش تذاكر.</div>';view.innerHTML=shell('الدعم',body)}catch(e){view.innerHTML=shell('الدعم',`<div class="notice">${esc(e.message)}</div>`)}}
  function profile(){const u=C.state.user;if(!u){view.innerHTML=shell('حسابي','<div class="empty">سجل الدخول أولاً.</div>');return}view.innerHTML=shell('حسابي',`<div class="card pad"><div class="list"><div class="list-item"><span>الاسم</span><b>${esc(u.name||'')}</b></div><div class="list-item"><span>رقم الموبايل</span><b>${esc(u.phone||'')}</b></div><div class="list-item"><span>الدور</span><b>${esc(C.roleName(u.role))}</b></div><div class="list-item"><span>المسار</span><b>${esc(C.track())}</b></div></div><div class="actions"><button class="btn danger" onclick="MozakraApp.logout()">تسجيل الخروج</button></div></div>`)}
  window.MozakraViews={renderNav,mark,render(route){C.state.route=route;mark(); if(route==='home')home(); else if(route==='lessons')lessons(); else if(route==='teachers')teachers(); else if(route==='exams')exams(); else if(route==='practice')practice(); else if(route==='notifications')notifications(); else if(route==='tickets')tickets(); else profile()}, openExam};
})();
