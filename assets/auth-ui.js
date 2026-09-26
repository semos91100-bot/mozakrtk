(function(){
  const api = (action, body) => fetch('/api/backend?action='+encodeURIComponent(action), {
    method: body ? 'POST' : 'GET',
    headers: {'Content-Type':'application/json'},
    credentials:'same-origin',
    body: body ? JSON.stringify(body) : undefined
  }).then(async r => {
    let data = {};
    try { data = await r.json(); } catch {}
    if (!r.ok || data.ok === false) {
      const err = new Error(data.message || 'تعذر تنفيذ الطلب.');
      err.code = data.error || 'REQUEST_FAILED'; err.status = r.status; throw err;
    }
    return data;
  });

  const layer = document.getElementById('authLayer');
  if (!layer) return;
  layer.classList.add('mz-auth-layer');
  layer.innerHTML = `
    <div class="mz-auth-shell" role="dialog" aria-modal="true" aria-label="تسجيل الدخول">
      <button class="mz-auth-close" type="button" aria-label="إغلاق">×</button>
      <div class="mz-auth-mascot">🎓</div>
      <h2 class="mz-auth-title">أهلاً بيك في مُذاكرة</h2>
      <p class="mz-auth-sub">ذاكر، تابع تقدمك، وخلي كل حاجة خاصة بدراستك في مكان واحد.</p>
      <div class="mz-auth-switch">
        <button type="button" data-mode="login" class="active">تسجيل الدخول</button>
        <button type="button" data-mode="signup">إنشاء حساب</button>
      </div>
      <div class="mz-auth-message" id="mzAuthMessage"></div>

      <form id="mzLoginForm" class="mz-auth-form" novalidate>
        <div class="mz-auth-field">
          <label for="mzLoginPhone">رقم الموبايل</label>
          <div class="mz-auth-input-wrap"><input id="mzLoginPhone" class="mz-auth-input" inputmode="tel" autocomplete="tel" placeholder="01xxxxxxxxx" required><span class="mz-auth-field-icon">📱</span></div>
        </div>
        <div class="mz-auth-field mz-auth-password">
          <label for="mzLoginPassword">كلمة المرور</label>
          <div class="mz-auth-input-wrap"><input id="mzLoginPassword" class="mz-auth-input" type="password" autocomplete="current-password" placeholder="اكتب كلمة المرور" required><button type="button" class="mz-auth-eye" data-eye="mzLoginPassword">👁</button></div>
        </div>
        <div class="mz-auth-row">
          <label class="mz-auth-check"><input id="mzRemember" type="checkbox" checked> تذكر هذا الجهاز</label>
          <button class="mz-auth-link" type="button" id="mzForgot">نسيت كلمة المرور؟</button>
        </div>
        <button class="mz-auth-submit" type="submit" id="mzLoginSubmit">دخول إلى حسابي</button>
      </form>

      <form id="mzSignupForm" class="mz-auth-form mz-auth-hidden" novalidate>
        <div class="mz-auth-field"><label for="mzSignupName">الاسم</label><div class="mz-auth-input-wrap"><input id="mzSignupName" class="mz-auth-input" autocomplete="name" placeholder="اسمك بالكامل" required><span class="mz-auth-field-icon">👤</span></div></div>
        <div class="mz-auth-field"><label for="mzSignupPhone">رقم الموبايل</label><div class="mz-auth-input-wrap"><input id="mzSignupPhone" class="mz-auth-input" inputmode="tel" autocomplete="tel" placeholder="01xxxxxxxxx" required><span class="mz-auth-field-icon">📱</span></div></div>
        <div class="mz-auth-extra">
          <div class="mz-auth-field"><label for="mzSignupGrade">الصف</label><select id="mzSignupGrade" class="mz-auth-select"><option value="">اختياري</option><option value="first">الأول الثانوي</option><option value="second">الثاني الثانوي</option><option value="third">الثالث الثانوي</option></select></div>
          <div class="mz-auth-field"><label for="mzSignupBranch">الشعبة</label><select id="mzSignupBranch" class="mz-auth-select"><option value="">اختر الصف أولاً</option></select></div>
        </div>
        <div class="mz-auth-field mz-auth-password"><label for="mzSignupPassword">كلمة المرور</label><div class="mz-auth-input-wrap"><input id="mzSignupPassword" class="mz-auth-input" type="password" autocomplete="new-password" placeholder="6 أحرف على الأقل" required><button type="button" class="mz-auth-eye" data-eye="mzSignupPassword">👁</button></div></div>
        <div class="mz-auth-field mz-auth-password"><label for="mzSignupPassword2">تأكيد كلمة المرور</label><div class="mz-auth-input-wrap"><input id="mzSignupPassword2" class="mz-auth-input" type="password" autocomplete="new-password" placeholder="أعد كتابة كلمة المرور" required><button type="button" class="mz-auth-eye" data-eye="mzSignupPassword2">👁</button></div></div>
        <button class="mz-auth-submit" type="submit" id="mzSignupSubmit">إنشاء حساب والبدء</button>
      </form>
      <div class="mz-auth-help">⚡ بعد النجاح هنفتح لك الموقع مباشرة، ورسائل الأخطاء هتظهر بتفاصيلها بدل «حدث خطأ».</div>
    </div>`;

  const shell=layer.querySelector('.mz-auth-shell'), msg=layer.querySelector('#mzAuthMessage');
  const loginForm=layer.querySelector('#mzLoginForm'), signupForm=layer.querySelector('#mzSignupForm');
  const loginPhone=layer.querySelector('#mzLoginPhone'), signupPhone=layer.querySelector('#mzSignupPhone');
  const grade=layer.querySelector('#mzSignupGrade'), branch=layer.querySelector('#mzSignupBranch');
  const branches={first:[['general','عام']],second:[['science','علمي'],['literary','أدبي']],third:[['science_biology','علمي علوم'],['science_math','علمي رياضة'],['literary','أدبي']]};

  function show(mode){
    layer.classList.add('is-open'); document.body.classList.add('mz-auth-open');
    msg.className='mz-auth-message'; msg.textContent='';
    layer.querySelectorAll('.mz-auth-switch button').forEach(b=>b.classList.toggle('active', b.dataset.mode===mode));
    loginForm.classList.toggle('mz-auth-hidden',mode!=='login'); signupForm.classList.toggle('mz-auth-hidden',mode!=='signup');
    setTimeout(()=> (mode==='login'?loginPhone:layer.querySelector('#mzSignupName')).focus(),60);
    location.hash = mode==='login' ? '#/login' : '#/signup';
  }
  function close(){layer.classList.remove('is-open');document.body.classList.remove('mz-auth-open');}
  function message(text,type='error'){msg.textContent=text||'';msg.className='mz-auth-message '+(text?'show ':'')+type;}
  function loading(btn,on,label){btn.disabled=on;btn.innerHTML=on?'<span class="mz-auth-loading"><span class="mz-auth-spinner"></span> جاري التنفيذ...</span>':label;}
  function cleanPhone(v){return String(v||'').replace(/\D/g,'').replace(/^00/,'').replace(/^20/,'').replace(/^0/,'');}
  function setBranches(){const xs=branches[grade.value]||[];branch.innerHTML='<option value="">'+(xs.length?'اختر الشعبة':'اختر الصف أولاً')+'</option>'+xs.map(([v,t])=>`<option value="${v}">${t}</option>`).join('');}

  document.getElementById('btnAuth')?.addEventListener('click',()=>show('login'));
  layer.querySelector('.mz-auth-close').addEventListener('click',close);
  layer.addEventListener('click',e=>{if(e.target===layer)close();});
  layer.querySelectorAll('.mz-auth-switch button').forEach(b=>b.addEventListener('click',()=>show(b.dataset.mode)));
  layer.querySelectorAll('[data-eye]').forEach(b=>b.addEventListener('click',()=>{const i=document.getElementById(b.dataset.eye);i.type=i.type==='password'?'text':'password';b.textContent=i.type==='password'?'👁':'🙈';}));
  grade.addEventListener('change',setBranches);
  document.getElementById('mzForgot').addEventListener('click',()=>message('استرجاع كلمة المرور يحتاج أن يتفعل من لوحة الإدارة. مؤقتًا تواصل مع الدعم لو فقدت كلمة المرور.','error'));

  loginForm.addEventListener('submit',async e=>{
    e.preventDefault();
    const phone=cleanPhone(loginPhone.value), password=layer.querySelector('#mzLoginPassword').value;
    if(!/^1[0125]\d{8}$/.test(phone)) return message('اكتب رقم موبايل مصري صحيح مكوّن من 11 رقم.');
    if(!password) return message('اكتب كلمة المرور.');
    const btn=layer.querySelector('#mzLoginSubmit'); loading(btn,true,'دخول إلى حسابي');
    try{ await api('login',{identifier:'0'+phone,password}); message('تم تسجيل الدخول بنجاح.','success'); setTimeout(()=>location.reload(),400); }
    catch(err){ message(err.message||'تعذر تسجيل الدخول.'); }
    finally{ loading(btn,false,'دخول إلى حسابي'); }
  });

  signupForm.addEventListener('submit',async e=>{
    e.preventDefault();
    const name=layer.querySelector('#mzSignupName').value.trim(), phone=cleanPhone(signupPhone.value), password=layer.querySelector('#mzSignupPassword').value, password2=layer.querySelector('#mzSignupPassword2').value;
    if(name.length<2) return message('اكتب اسمك.');
    if(!/^1[0125]\d{8}$/.test(phone)) return message('اكتب رقم موبايل مصري صحيح مكوّن من 11 رقم.');
    if(password.length<6) return message('كلمة المرور لازم تكون 6 أحرف على الأقل.');
    if(password!==password2) return message('تأكيد كلمة المرور غير مطابق.');
    if((grade.value&&!branch.value)||(branch.value&&!grade.value)) return message('اختار الصف والشعبة مع بعض أو اتركهم لوقت لاحق.');
    const btn=layer.querySelector('#mzSignupSubmit'); loading(btn,true,'إنشاء حساب والبدء');
    try{ await api('signup',{name,phone:'0'+phone,password,grade:grade.value||undefined,branch:branch.value||undefined}); message('تم إنشاء الحساب بنجاح. جاري فتح الموقع...','success'); setTimeout(()=>location.reload(),500); }
    catch(err){ message(err.message||'تعذر إنشاء الحساب.'); }
    finally{ loading(btn,false,'إنشاء حساب والبدء'); }
  });

  // URL routes for the new auth experience.
  if(location.hash==='#/login') show('login');
  if(location.hash==='#/signup') show('signup');
  window.MozakraAuth={open:show,close};
})();
