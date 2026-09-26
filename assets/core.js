window.MozakraCore = (()=>{
  const state={user:null,route:'home',notifications:[],tickets:[],booted:false};
  const $=s=>document.querySelector(s);
  const escape=x=>String(x??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const toast=(text)=>{let t=$('#mzToast');if(!t){t=document.createElement('div');t.id='mzToast';t.className='toast';document.body.appendChild(t)}t.textContent=text;t.classList.add('show');clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.remove('show'),2800)};
  const userName=()=>state.user?.name||'الطالب';
  const roleName=r=>({student:'طالب',support:'دعم',moderator:'مشرف',admin:'إدارة',owner:'مالك'})[r]||r||'زائر';
  const track=()=>{const s=state.user?.state||{}; const g=window.MozakraData.gradeNames[s.grade]||'غير محدد'; const b=window.MozakraData.branchNames[s.branch]||'غير محدد'; return (s.grade&&s.branch)?`${g} • ${b}`:'لم تحدد المسار بعد'};
  return {state,$,escape,toast,userName,roleName,track,api:window.MozakraAPI.request};
})();
