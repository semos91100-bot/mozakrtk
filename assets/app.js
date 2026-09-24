// ============ App bootstrap ============
Theme.init();

const NAV_ITEMS = [
  { route:"dashboard", label:"الرئيسية", icon:"🏠" },
  { route:"subjects", label:"المواد", icon:"📚" },
  { route:"exams", label:"الاختبارات", icon:"📝" },
  { route:"teachers", label:"المدرّسون", icon:"🧑‍🏫" },
  { route:"support", label:"الدعم الفني", icon:"🎫" },
  { route:"settings", label:"الإعدادات", icon:"⚙️" },
];
// العناصر اللي بتظهر في الشريط السفلي بالموبايل (5 بس عشان تفضل واضحة)
const TABBAR_ROUTES = ["dashboard","subjects","exams","support","settings"];

function buildNav(){
  const isAdmin = Auth.isAdmin();
  const items = [...NAV_ITEMS];
  const open = Auth.current() ? Tickets.stats().open + Tickets.stats().progress : 0;

  $("#nav").innerHTML = items.map(i=>`
    <a href="#/${i.route}" data-route="${i.route}">
      <span>${i.icon}</span><span>${i.label}</span>
      ${i.route==='support' && isAdmin && open ? `<span class="badge" style="margin-inline-start:auto">${open}</span>`:""}
    </a>`).join("") + (isAdmin ? `<a href="#/support" data-route="support" style="margin-top:8px;border-top:1px solid rgba(255,255,255,.15);padding-top:14px"><span>🛡️</span><span>لوحة الدعم (أدمن)</span></a>` : "");

  $("#tabbar").innerHTML = items.filter(i=>TABBAR_ROUTES.includes(i.route)).map(i=>`
    <a href="#/${i.route}" data-route="${i.route}"><span>${i.icon}</span><span>${i.label}</span></a>`).join("");

  $$(".nav a, .tabbar a").forEach(a=> a.addEventListener("click", ()=> setTimeout(()=> $$(".nav a,.tabbar a").forEach(x=>x.classList.toggle("active", x.dataset.route===Router.current())),10)));
}

Router.on("dashboard", viewDashboard);
Router.on("subjects", viewSubjects);
Router.on("exams", viewExams);
Router.on("exam", viewExamTake);
Router.on("teachers", viewTeachers);
Router.on("support", viewSupport);
Router.on("settings", viewSettings);

// بعد كل رندر: فعّل التبويب الصح في القائمة، وابعت الأحداث للنماذج الديناميكية (تذكرة جديدة)
window.onRouteRendered = function(path){
  const activeFor = path==="exam" ? "exams" : path;
  $$(".nav a, .tabbar a").forEach(a=> a.classList.toggle("active", a.dataset.route===activeFor));
  wireNewTicketForm();
};

document.addEventListener("DOMContentLoaded", ()=>{
  buildNav();
  refreshAuthUI();
  Router.start();

  $("#btnTimer").addEventListener("click", ()=> StudyTimer.toggleWidget());
  $("#btnBell").addEventListener("click", ()=> toggleNotifPanel());
  $("#btnTheme").addEventListener("click", ()=> Theme.toggle());
  $("#q").addEventListener("keydown", e=>{
    if(e.key==="Enter"){ toast(`جاري البحث عن: ${e.target.value}`); }
  });
});
