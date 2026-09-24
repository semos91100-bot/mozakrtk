// ============ Core: utils / theme / toast / modal / timer / auth ============
const $ = (sel, el) => (el||document).querySelector(sel);
const $$ = (sel, el) => Array.from((el||document).querySelectorAll(sel));
const esc = (s="") => String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

// ---------- Toast ----------
function toast(msg){
  let wrap = $("#toastWrap");
  if(!wrap){ wrap = document.createElement("div"); wrap.id="toastWrap"; wrap.className="toast-wrap"; document.body.appendChild(wrap); }
  const t = document.createElement("div"); t.className="toast"; t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(()=> t.remove(), 3200);
}

// ---------- Theme ----------
const Theme = {
  init(){
    const saved = localStorage.getItem("mozakra_theme");
    if(saved) document.documentElement.setAttribute("data-theme", saved);
  },
  toggle(){
    const cur = document.documentElement.getAttribute("data-theme")==="dark" ? "light":"dark";
    document.documentElement.setAttribute("data-theme", cur);
    localStorage.setItem("mozakra_theme", cur);
  }
};

// ---------- Router ----------
const Router = {
  routes:{},
  on(path, fn){ this.routes[path]=fn; },
  go(path){ location.hash = "#/" + path; },
  current(){ return (location.hash||"#/dashboard").replace("#/","").split("?")[0] || "dashboard"; },
  start(){
    window.addEventListener("hashchange", ()=> this.render());
    this.render();
  },
  render(){
    const path = this.current();
    const fn = this.routes[path] || this.routes["dashboard"];
    $("#view").innerHTML = fn ? fn() : "<p>الصفحة غير موجودة</p>";
    $$(".nav a, .tabbar a").forEach(a=>{
      a.classList.toggle("active", a.dataset.route === path);
    });
    window.scrollTo(0,0);
    if(window.onRouteRendered) window.onRouteRendered(path);
  }
};

// ---------- Modal (auth) ----------
function closeAuthModal(){ $("#authLayer").innerHTML = ""; }
function openAuthModal(mode="login"){
  $("#authLayer").innerHTML = `
  <div class="modal-backdrop" id="authBackdrop">
    <div class="modal">
      <div class="tabs">
        <button data-tab="login" class="${mode==='login'?'active':''}">تسجيل الدخول</button>
        <button data-tab="register" class="${mode==='register'?'active':''}">حساب جديد</button>
      </div>
      <form id="loginForm" style="display:${mode==='login'?'block':'none'}">
        <div class="field"><label>البريد الإلكتروني</label><input type="email" name="email" required></div>
        <div class="field"><label>كلمة المرور</label><input type="password" name="password" required></div>
        <button class="btn" style="width:100%" type="submit">دخول</button>
      </form>
      <form id="registerForm" style="display:${mode==='register'?'block':'none'}">
        <div class="field"><label>الاسم</label><input type="text" name="name" required></div>
        <div class="field"><label>البريد الإلكتروني</label><input type="email" name="email" required></div>
        <div class="field"><label>كلمة المرور</label><input type="password" name="password" required minlength="4"></div>
        <button class="btn" style="width:100%" type="submit">إنشاء الحساب</button>
      </form>
    </div>
  </div>`;
  $("#authBackdrop").addEventListener("click", e=>{ if(e.target.id==="authBackdrop") closeAuthModal(); });
  $$('.tabs button', $("#authLayer")).forEach(b=> b.addEventListener("click", ()=>{
    $$('.tabs button', $("#authLayer")).forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    $("#loginForm").style.display = b.dataset.tab==="login" ? "block":"none";
    $("#registerForm").style.display = b.dataset.tab==="register" ? "block":"none";
  }));
  $("#loginForm").addEventListener("submit", e=>{
    e.preventDefault();
    const f = new FormData(e.target);
    const r = Auth.login(f.get("email"), f.get("password"));
    if(!r.ok) return toast(r.msg);
    closeAuthModal(); toast(`أهلاً بيك، ${r.user.name} 👋`); refreshAuthUI(); Router.render();
  });
  $("#registerForm").addEventListener("submit", e=>{
    e.preventDefault();
    const f = new FormData(e.target);
    const r = Auth.register(f.get("name"), f.get("email"), f.get("password"));
    if(!r.ok) return toast(r.msg);
    closeAuthModal(); toast(`تم إنشاء الحساب، أهلاً بيك ${r.user.name} 👋`); refreshAuthUI(); Router.render();
  });
}

function refreshAuthUI(){
  const u = Auth.current();
  const btn = $("#btnAuth");
  if(!btn) return;
  if(u){
    btn.textContent = u.role==="admin" ? `⚙️ ${u.name}` : `👤 ${u.name.split(" ")[0]}`;
    btn.onclick = ()=>{
      if(confirm("هل تريد تسجيل الخروج؟")){ Auth.logout(); toast("تم تسجيل الخروج"); refreshAuthUI(); Router.go("dashboard"); }
    };
  } else {
    btn.textContent = "تسجيل الدخول";
    btn.onclick = ()=> openAuthModal("login");
  }
  const dot = $("#bellDot");
  if(dot) dot.hidden = Notifications.unreadCount()===0;
  buildNav();
}

// ---------- مؤقت المذاكرة ----------
const StudyTimer = {
  seconds:0, running:false, interval:null,
  toggleWidget(){
    const l = $("#layer");
    if($("#timerBox")){ l.innerHTML=""; return; }
    l.innerHTML = `
      <div class="modal-backdrop" id="timerBackdrop" style="align-items:flex-start;justify-content:flex-end;padding-top:70px;padding-inline-end:24px;background:transparent">
        <div class="modal" id="timerBox" style="max-width:260px;text-align:center">
          <h3 style="margin-bottom:4px">⏱️ مؤقت المذاكرة</h3>
          <div style="font-size:34px;font-weight:800;margin:12px 0" id="timerDisplay">00:00:00</div>
          <div style="display:flex;gap:8px">
            <button class="btn" id="timerStart" style="flex:1">${this.running?'إيقاف':'ابدأ'}</button>
            <button class="btn ghost" id="timerReset" style="flex:1">تصفير</button>
          </div>
        </div>
      </div>`;
    $("#timerBackdrop").addEventListener("click", e=>{ if(e.target.id==="timerBackdrop") l.innerHTML=""; });
    this.updateDisplay();
    $("#timerStart").addEventListener("click", ()=> this.toggle());
    $("#timerReset").addEventListener("click", ()=> this.reset());
  },
  toggle(){
    this.running = !this.running;
    if(this.running){ this.interval = setInterval(()=>{ this.seconds++; this.updateDisplay(); }, 1000); }
    else clearInterval(this.interval);
    const b = $("#timerStart"); if(b) b.textContent = this.running?'إيقاف':'ابدأ';
  },
  reset(){ this.seconds=0; this.running=false; clearInterval(this.interval); this.updateDisplay(); const b=$("#timerStart"); if(b) b.textContent="ابدأ"; },
  updateDisplay(){
    const h = String(Math.floor(this.seconds/3600)).padStart(2,"0");
    const m = String(Math.floor((this.seconds%3600)/60)).padStart(2,"0");
    const s = String(this.seconds%60).padStart(2,"0");
    const d = $("#timerDisplay"); if(d) d.textContent = `${h}:${m}:${s}`;
  }
};

// ---------- الإشعارات (نافذة) ----------
function toggleNotifPanel(){
  const l = $("#layer");
  if($("#notifBox")){ l.innerHTML=""; return; }
  const list = Notifications.forCurrentUser();
  l.innerHTML = `
    <div class="modal-backdrop" id="notifBackdrop" style="align-items:flex-start;justify-content:flex-end;padding-top:70px;padding-inline-end:70px;background:transparent">
      <div class="modal" id="notifBox" style="max-width:320px;max-height:60vh;overflow:auto">
        <h3>🔔 الإشعارات</h3>
        ${!list.length ? `<p style="color:var(--text-dim);font-size:13px">مفيش إشعارات دلوقتي.</p>` :
          list.map(n=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)">
            <b style="font-size:13px">${esc(n.title)}</b>
            <p style="margin:3px 0;font-size:12.5px;color:var(--text-dim)">${esc(n.body)}</p>
            <span style="font-size:10.5px;color:var(--text-dim)">${fmtTime(n.at)}</span>
          </div>`).join("") }
      </div>
    </div>`;
  Notifications.markAllRead();
  const dot = $("#bellDot"); if(dot) dot.hidden = true;
  $("#notifBackdrop").addEventListener("click", e=>{ if(e.target.id==="notifBackdrop") l.innerHTML=""; });
}
