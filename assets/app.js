(function(){
  const C=window.MozakraCore;
  async function boot(){
    try{const r=await C.api('me');C.state.user=r.user||null}catch{C.state.user=null}
    const btn=C.$('#btnAuth');
    if(btn){btn.textContent=C.state.user?'حسابي':'تسجيل الدخول';btn.onclick=()=>C.state.user?go('profile'):window.MozakraAuth.open('login');}
    const theme=C.$('#btnTheme');
    if(localStorage.getItem('mz_theme')==='dark'){document.body.classList.add('dark');theme.textContent='☀️'}
    theme?.addEventListener('click',()=>{document.body.classList.toggle('dark');const dark=document.body.classList.contains('dark');localStorage.setItem('mz_theme',dark?'dark':'light');theme.textContent=dark?'☀️':'🌙'});
    C.$('#btnTimer')?.addEventListener('click',()=>C.toast('مؤقت المذاكرة هيتوفر هنا قريبًا ⏱️'));
    C.$('#btnBell')?.addEventListener('click',()=>go('notifications'));
    C.$('#q')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.currentTarget.value.trim()){C.toast('جاري البحث عن: '+e.currentTarget.value.trim())}});
    window.MozakraViews.renderNav();
    const fromHash=location.hash.match(/^#\/(home|lessons|teachers|exams|practice|notifications|tickets|profile)$/)?.[1]||'home';
    go(fromHash);
  }
  function go(route){window.MozakraViews.render(route)}
  async function logout(){try{await C.api('logout');location.reload()}catch(e){C.toast(e.message)}}
  async function newTicket(){
    const subject=prompt('عنوان المشكلة');if(!subject)return;const text=prompt('اكتب تفاصيل المشكلة');if(!text)return;
    try{await C.api('ticketcreate',{subject,text});C.toast('تم فتح التذكرة بنجاح');go('tickets')}catch(e){C.toast(e.message)}
  }
  async function openExam(id){return window.MozakraViews.openExam(id)}
  async function openTicket(id){try{const r=await C.api('ticketget',{id});const msg=(r.messages||[]).map(x=>`• ${x.text}`).join('\n')||'مفيش ردود لسه';alert(`${r.ticket?.subject||'التذكرة'}\n\n${msg}`)}catch(e){C.toast(e.message)}}
  window.MozakraApp={boot,go,logout,newTicket,openTicket,openExam};
  boot();
})();
