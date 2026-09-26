(function(){
  const C=window.MozakraCore, D=window.MozakraData;
  const view=C.$('#view'); const nav=C.$('#nav'); const tab=C.$('#tabbar');
  function navButton([id,label,icon]){return `<button type="button" data-route="${id}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`}
  function renderNav(){
    nav.innerHTML=D.nav.map(navButton).join(''); tab.innerHTML=D.nav.slice(0,4).map(navButton).join('');
    document.querySelectorAll('[data-route]').forEach(b=>b.onclick=()=>window.MozakraApp.go(b.dataset.route));
    mark();
  }
  function mark(){document.querySelectorAll('[data-route]').forEach(b=>b.classList.toggle('active',b.dataset.route===C.state.route))}
  function shell(title,body,actions=''){return `<section><div class="section-head"><div><h2>${title}</h2></div><div>${actions}</div></div>${body}</section>`}
  function home(){
    const u=C.state.user;
    const primary=u?`<div class="hero-card primary"><h1>أهلاً يا ${C.escape(C.userName())} 👋</h1><p>خد مذاكرتك خطوة خطوة، وشوف دروسك وتقدمك وأسئلتك من مكان واحد.</p><div class="hero-actions"><button class="btn alt" onclick="MozakraApp.go('lessons')">ابدأ المذاكرة</button><button class="btn alt" onclick="MozakraApp.go('practice')">حل أسئلة</button></div></div>`:`<div class="hero-card primary"><h1>مُذاكرة — كل اللي تحتاجه للمذاكرة في مكان واحد 📚</h1><p>سجل برقم موبايلك، وتابع دروسك وتقدمك وتواصل مع الدعم بسهولة.</p><div class="hero-actions"><button class="btn alt" onclick="MozakraAuth.open('login')">تسجيل الدخول</button><button class="btn alt" onclick="MozakraAuth.open('signup')">إنشاء حساب</button></div></div>`;
    const side=`<div class="card"><div class="mini-stat"><b>${u?'✓':'+'}</b><span>${u?'الحساب متصل':'سجل حسابك وابدأ'}</span></div><div class="mini-stat"><b>${u?C.escape(C.track()):'24/7'}</b><span>${u?'مسارك الدراسي':'وصول مريح من الموبايل'}</span></div></div>`;
    view.innerHTML=`<div class="hero">${primary}${side}</div>`+shell('ابدأ من هنا',`<div class="grid"><div class="card pad icon-card"><div class="icon-bubble">📖</div><div><b>الدروس</b><div class="muted small">رتب مذاكرتك حسب المواد والدروس.</div></div></div><div class="card pad icon-card"><div class="icon-bubble">✍️</div><div><b>التدريب</b><div class="muted small">حل أسئلة وراجع أخطاءك.</div></div></div><div class="card pad icon-card"><div class="icon-bubble">🎯</div><div><b>تقدمك</b><div class="muted small">خلّي خطواتك اليومية واضحة.</div></div></div></div>`);
  }
  function lessons(){view.innerHTML=shell('دروسي',`<div class="grid"><div class="card pad"><b>الرياضيات</b><p class="muted small">ابدأ بالمراجعة والحل.</p><span class="pill">📐 تدريبات</span></div><div class="card pad"><b>اللغة العربية</b><p class="muted small">دروس ومراجعات مختصرة.</p><span class="pill">📝 مراجعة</span></div><div class="card pad"><b>اللغة الإنجليزية</b><p class="muted small">خطط مذاكرة يومية.</p><span class="pill">🔤 كلمات</span></div><div class="card pad"><b>العلوم</b><p class="muted small">مفاهيم وأسئلة تدريبية.</p><span class="pill">🔬 مراجعة</span></div></div>`,'');}
  function practice(){view.innerHTML=shell('تدريب وأسئلة',`<div class="card pad"><h3 style="margin-top:0">اختار نوع التدريب</h3><div class="grid"><button class="card pad" onclick="MozakraCore.toast('تم تجهيز تدريب سريع لك ✨')">⚡ تدريب سريع</button><button class="card pad" onclick="MozakraCore.toast('سيتم فتح بنك الأسئلة قريبًا')">📚 بنك الأسئلة</button><button class="card pad" onclick="MozakraCore.toast('راجع إجاباتك من قسم التقدم')">📊 مراجعة النتائج</button></div></div>`);}
  async function notifications(){view.innerHTML=shell('الإشعارات','<div class="empty">جارٍ تحميل الإشعارات…</div>');try{const r=await C.api('notifications');C.state.notifications=r.notifications||[];view.innerHTML=shell('الإشعارات',C.state.notifications.length?`<div class="list">${C.state.notifications.map(n=>`<div class="list-item"><div><b>${C.escape(n.title||'إشعار')}</b><div class="muted small">${C.escape(n.body||'')}</div></div><span class="small muted">${n.created_at?new Date(n.created_at).toLocaleDateString('ar-EG'):''}</span></div>`).join('')}</div>`:'<div class="empty">مفيش إشعارات حالياً.</div>');}catch(e){view.innerHTML=shell('الإشعارات',`<div class="notice">${C.escape(e.message)}</div>`)}}
  async function tickets(){
    if(!C.state.user){
      view.innerHTML=shell('الدعم','<div class="empty">سجل الدخول أولاً علشان تقدر تفتح تذكرة دعم.</div>');
      return;
    }
    view.innerHTML=shell('الدعم','<div class="empty">جارٍ تحميل تذاكرك…</div>');
    try{
      const r=await C.api('tickets');
      const ts=r.tickets||[];
      let body=`<div class="actions"><button class="btn" onclick="MozakraApp.newTicket()">فتح تذكرة جديدة</button></div>`;
      if(ts.length){
        body+=`<div class="list" style="margin-top:12px">${ts.map(t=>{
          const id=C.escape(t.id||'');
          return `<div class="list-item"><div><b>${C.escape(t.subject||'بدون عنوان')}</b><div class="muted small">${C.escape(t.status||'open')}</div></div><button class="btn ghost" onclick="MozakraApp.openTicket('${id}')">فتح</button></div>`;
        }).join('')}</div>`;
      } else {
        body+='<div class="empty" style="margin-top:12px">لسه مفيش تذاكر.</div>';
      }
      view.innerHTML=shell('الدعم',body);
    }catch(e){
      view.innerHTML=shell('الدعم',`<div class="notice">${C.escape(e.message)}</div>`);
    }
  }
  function profile(){const u=C.state.user;if(!u){view.innerHTML=shell('حسابي','<div class="empty">سجل الدخول أولاً.</div>');return}view.innerHTML=shell('حسابي',`<div class="card pad"><div class="list"><div class="list-item"><span>الاسم</span><b>${C.escape(u.name||'')}</b></div><div class="list-item"><span>رقم الموبايل</span><b>${C.escape(u.phone||'')}</b></div><div class="list-item"><span>الدور</span><b>${C.escape(C.roleName(u.role))}</b></div><div class="list-item"><span>المسار</span><b>${C.escape(C.track())}</b></div></div><div class="actions"><button class="btn danger" onclick="MozakraApp.logout()">تسجيل الخروج</button></div></div>`)}
  window.MozakraViews={renderNav,mark,render(route){C.state.route=route;mark(); if(route==='home')home(); else if(route==='lessons')lessons(); else if(route==='practice')practice(); else if(route==='notifications')notifications(); else if(route==='tickets')tickets(); else profile()}};
})();
