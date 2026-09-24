// ============ Local API — تخزين محلي بالكامل عبر localStorage ============
const DB = {
  key:(k)=>`mozakra_${k}`,
  get(k, def){ try{ const v = localStorage.getItem(this.key(k)); return v?JSON.parse(v):def; }catch(e){ return def; } },
  set(k, v){ localStorage.setItem(this.key(k), JSON.stringify(v)); },
};

function uid(prefix){ return (prefix||"") + Math.random().toString(36).slice(2,9).toUpperCase(); }
function nowISO(){ return new Date().toISOString(); }
function fmtTime(iso){
  const d = new Date(iso);
  return d.toLocaleString("ar-EG", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });
}

// ---------- المستخدمون والجلسة ----------
const Auth = {
  ensureSeed(){
    let users = DB.get("users", null);
    if(!users){
      users = [{ id:"admin", name:ADMIN_ACCOUNT.name, email:ADMIN_ACCOUNT.email, password:ADMIN_ACCOUNT.password, role:"admin", createdAt: nowISO() }];
      DB.set("users", users);
    }
  },
  users(){ return DB.get("users", []); },
  register(name, email, password){
    const users = this.users();
    if(users.some(u=>u.email===email)) return { ok:false, msg:"البريد الإلكتروني مسجل بالفعل." };
    const user = { id: uid("U"), name, email, password, role:"student", createdAt: nowISO() };
    users.push(user); DB.set("users", users);
    this.setSession(user);
    return { ok:true, user };
  },
  login(email, password){
    const user = this.users().find(u=>u.email===email && u.password===password);
    if(!user) return { ok:false, msg:"البريد الإلكتروني أو كلمة المرور غير صحيحة." };
    this.setSession(user);
    return { ok:true, user };
  },
  logout(){ localStorage.removeItem(DB.key("session")); },
  setSession(user){ DB.set("session", { id:user.id }); },
  current(){
    const s = DB.get("session", null);
    if(!s) return null;
    return this.users().find(u=>u.id===s.id) || null;
  },
  isAdmin(){ const u = this.current(); return !!u && u.role==="admin"; },
};

// ---------- نظام تذاكر الدعم الفني ----------
const Tickets = {
  all(){ return DB.get("tickets", []); },
  save(list){ DB.set("tickets", list); },
  forCurrentUser(){
    const u = Auth.current();
    if(!u) return [];
    if(u.role==="admin") return this.all().sort((a,b)=> new Date(b.updatedAt)-new Date(a.updatedAt));
    return this.all().filter(t=>t.userId===u.id).sort((a,b)=> new Date(b.updatedAt)-new Date(a.updatedAt));
  },
  get(id){ return this.all().find(t=>t.id===id); },
  create({subject, category, priority, message}){
    const u = Auth.current();
    if(!u) return { ok:false, msg:"لازم تسجّل الدخول الأول." };
    const list = this.all();
    const ticket = {
      id: uid("TCK-"),
      userId: u.id,
      userName: u.name,
      userEmail: u.email,
      subject, category, priority: priority||"medium",
      status:"open",
      createdAt: nowISO(),
      updatedAt: nowISO(),
      messages:[{ from:"student", authorName:u.name, text:message, at: nowISO() }],
    };
    list.unshift(ticket);
    this.save(list);
    Notifications.push({ audience:"admin", title:"تذكرة دعم جديدة", body:`${u.name}: ${subject}`, link:`support:${ticket.id}` });
    return { ok:true, ticket };
  },
  reply(id, text, isAdmin){
    const list = this.all();
    const t = list.find(x=>x.id===id);
    if(!t) return { ok:false };
    const u = Auth.current();
    t.messages.push({ from: isAdmin?"admin":"student", authorName:u.name, text, at: nowISO() });
    t.updatedAt = nowISO();
    if(isAdmin && t.status==="open") t.status = "progress";
    if(!isAdmin && (t.status==="resolved"||t.status==="closed")) t.status = "open";
    this.save(list);
    if(isAdmin){
      Notifications.push({ audience:"user", userId:t.userId, title:"رد جديد على تذكرتك", body:t.subject, link:`support:${t.id}` });
    } else {
      Notifications.push({ audience:"admin", title:"رد جديد من طالب", body:`${u.name}: ${t.subject}`, link:`support:${t.id}` });
    }
    return { ok:true, ticket:t };
  },
  setStatus(id, status){
    const list = this.all();
    const t = list.find(x=>x.id===id);
    if(!t) return;
    t.status = status; t.updatedAt = nowISO();
    this.save(list);
  },
  setPriority(id, priority){
    const list = this.all();
    const t = list.find(x=>x.id===id);
    if(!t) return;
    t.priority = priority; t.updatedAt = nowISO();
    this.save(list);
  },
  stats(){
    const list = this.all();
    return {
      total:list.length,
      open:list.filter(t=>t.status==="open").length,
      progress:list.filter(t=>t.status==="progress").length,
      resolved:list.filter(t=>t.status==="resolved"||t.status==="closed").length,
      urgent:list.filter(t=>t.priority==="urgent" && t.status!=="resolved" && t.status!=="closed").length,
    };
  }
};

// ---------- إشعارات ----------
const Notifications = {
  all(){ return DB.get("notifications", []); },
  save(l){ DB.set("notifications", l); },
  push(n){
    const l = this.all();
    l.unshift({ id: uid("N"), read:false, at: nowISO(), ...n });
    this.save(l);
  },
  forCurrentUser(){
    const u = Auth.current();
    if(!u) return [];
    const l = this.all();
    if(u.role==="admin") return l.filter(n=>n.audience==="admin");
    return l.filter(n=>n.audience==="user" && n.userId===u.id);
  },
  unreadCount(){ return this.forCurrentUser().filter(n=>!n.read).length; },
  markAllRead(){
    const u = Auth.current(); if(!u) return;
    const l = this.all().map(n=>{
      if(u.role==="admin" && n.audience==="admin") n.read = true;
      if(u.role!=="admin" && n.audience==="user" && n.userId===u.id) n.read = true;
      return n;
    });
    this.save(l);
  }
};

Auth.ensureSeed();
