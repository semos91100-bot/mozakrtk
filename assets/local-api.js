/* local-api.js
   Vercel-safe local API shim.
   Keeps the original UI/API contract while removing the PHP filesystem dependency.
   Data is stored in this browser's localStorage, so it is suitable for a zero-config
   deployment/demo. For shared multi-device data, a real database backend is needed.
*/
(function(){
  "use strict";
  const DB_KEY = "mozakra_local_api_v2";
  const ADMIN_EMAIL = "semos91100@gmail.com";
  const ADMIN_PASSWORD = "alton112233";

  function blank(){
    return {users:[],content:{teachers:[],removed:[]},notifications:[],support:[],current:null,nextUserId:1,nextTicketId:1,nextNotifId:1};
  }
  function load(){
    try{
      const raw = localStorage.getItem(DB_KEY);
      const d = raw ? JSON.parse(raw) : null;
      const x = Object.assign(blank(), d && typeof d === "object" ? d : {});
      x.users = Array.isArray(x.users) ? x.users : [];
      x.notifications = Array.isArray(x.notifications) ? x.notifications : [];
      x.support = Array.isArray(x.support) ? x.support : [];
      x.content = x.content && typeof x.content === "object" ? x.content : {teachers:[],removed:[]};
      x.content.teachers = Array.isArray(x.content.teachers) ? x.content.teachers : [];
      x.content.removed = Array.isArray(x.content.removed) ? x.content.removed : [];
      return x;
    }catch(_){ return blank(); }
  }
  let DB = load();
  function save(){ try{ localStorage.setItem(DB_KEY,JSON.stringify(DB)); }catch(_){} }
  function now(){ return Math.floor(Date.now()/1000); }
  function email(v){ return String(v||"").trim().toLowerCase(); }
  function validEmail(v){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length<=190; }
  function current(){
    if(DB.current && DB.current.role === "admin" && email(DB.current.email)===ADMIN_EMAIL){
      return {id:-1,email:ADMIN_EMAIL,name:"Admin",role:"admin"};
    }
    if(DB.current && DB.current.role === "student"){
      const u=DB.users.find(x=>x.id===DB.current.id);
      if(u) return {id:u.id,email:u.email,name:u.name,role:"student"};
    }
    return null;
  }
  function response(ok, extra){ return Object.assign({ok}, extra||{}); }
  function body(opts){
    try{ return opts && opts.body ? JSON.parse(opts.body) : {}; }catch(_){ return {}; }
  }
  async function hash(text){
    if(globalThis.crypto && crypto.subtle && globalThis.TextEncoder){
      const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join("");
    }
    return String(text);
  }
  async function authLogin(emailIn,pass){
    const e=email(emailIn);
    if(e===ADMIN_EMAIL){
      if(pass!==ADMIN_PASSWORD) return null;
      DB.current={id:-1,email:ADMIN_EMAIL,role:"admin"}; save();
      return current();
    }
    const ph=await hash(pass);
    const u=DB.users.find(x=>x.email===e && x.passwordHash===ph);
    if(!u) return null;
    DB.current={id:u.id,email:u.email,role:"student"}; save();
    return current();
  }
  async function handle(action,opts){
    const method=(opts && opts.method ? opts.method : "GET").toUpperCase();
    const d=body(opts);
    const u=current();

    if(action==="me") return response(true,{authenticated:!!u,user:u||undefined});

    if(action==="signup" && method==="POST"){
      const e=email(d.email), pass=String(d.password||""), name=String(d.name||"").trim().slice(0,120);
      if(!validEmail(e)) return response(false,{error:"INVALID_EMAIL",httpStatus:422});
      if(pass.length<8) return response(false,{error:"PASSWORD_SHORT",httpStatus:422});
      if(pass.length>200) return response(false,{error:"PASSWORD_LONG",httpStatus:422});
      if(e===ADMIN_EMAIL || DB.users.some(x=>x.email===e)) return response(false,{error:"EMAIL_EXISTS",httpStatus:409});
      const rec={id:Number(DB.nextUserId||1),email:e,passwordHash:await hash(pass),name:name||"طالب",state:{},created_at:now(),updated_at:now()};
      DB.nextUserId=rec.id+1; DB.users.push(rec); DB.current={id:rec.id,email:rec.email,role:"student"}; save();
      return response(true,{authenticated:true,user:{id:rec.id,email:rec.email,name:rec.name,role:"student"}});
    }

    if(action==="login" && method==="POST"){
      const logged=await authLogin(d.email,d.password||"");
      if(!logged) return response(false,{error:"LOGIN_FAILED",httpStatus:401});
      return response(true,{authenticated:true,user:logged});
    }

    if(action==="logout" && method==="POST"){
      DB.current=null; save(); return response(true);
    }

    if(action==="state" && method==="GET"){
      if(!u) return response(false,{error:"AUTH_REQUIRED",httpStatus:401});
      if(u.role==="admin") return response(true,{state:{},updated:now()});
      const rec=DB.users.find(x=>x.id===u.id);
      return response(true,{state:rec && rec.state && typeof rec.state==="object" ? rec.state : {},updated:rec?rec.updated_at:0});
    }
    if(action==="state" && method==="POST"){
      if(!u) return response(false,{error:"AUTH_REQUIRED",httpStatus:401});
      if(u.role==="admin") return response(true);
      if(!d.state || typeof d.state!=="object") return response(false,{error:"BAD_STATE",httpStatus:422});
      const rec=DB.users.find(x=>x.id===u.id);
      if(!rec) return response(false,{error:"AUTH_REQUIRED",httpStatus:401});
      rec.state=d.state; rec.name=String(d.state.name||rec.name||"طالب").slice(0,120); rec.updated_at=now(); save();
      return response(true,{updated:rec.updated_at});
    }

    if(action==="ai" && method==="POST"){
      if(!u) return response(false,{error:"AUTH_REQUIRED",httpStatus:401});
      return response(false,{error:"AI_NOT_CONFIGURED",httpStatus:503});
    }

    if(action==="content" && method==="GET"){
      return response(true,{content:DB.content});
    }
    if(action==="content" && method==="POST"){
      if(!u || u.role!=="admin") return response(false,{error:"FORBIDDEN",httpStatus:403});
      if(!Array.isArray(d.teachers)||!Array.isArray(d.removed)) return response(false,{error:"BAD_CONTENT",httpStatus:422});
      DB.content={teachers:d.teachers,removed:d.removed}; save(); return response(true);
    }

    if(action==="notifications" && method==="GET"){
      if(!u) return response(false,{error:"AUTH_REQUIRED",httpStatus:401});
      const target=email(u.email);
      const mine=DB.notifications.filter(n=>n.to==="all" || email(n.to)===target).sort((a,b)=>(b.created_at||0)-(a.created_at||0)).slice(0,50);
      return response(true,{notifications:mine});
    }
    if(action==="notifications" && method==="POST"){
      if(!u || u.role!=="admin") return response(false,{error:"FORBIDDEN",httpStatus:403});
      const title=String(d.title||"").trim().slice(0,150), text=String(d.body||"").trim().slice(0,1000), to=email(d.to||"all");
      if(!title) return response(false,{error:"EMPTY_TITLE",httpStatus:422});
      if(to!=="all" && !validEmail(to)) return response(false,{error:"INVALID_EMAIL",httpStatus:422});
      const row={id:Number(DB.nextNotifId||1),title,body:text,to,created_at:now()}; DB.nextNotifId=row.id+1; DB.notifications.push(row); save(); return response(true);
    }

    if(action==="support" && method==="GET"){
      if(!u) return response(false,{error:"AUTH_REQUIRED",httpStatus:401});
      const rows=u.role==="admin" ? DB.support : DB.support.filter(t=>Number(t.uid)===Number(u.id));
      rows.sort((a,b)=>(b.created_at||0)-(a.created_at||0));
      return response(true,{tickets:rows,isAdmin:u.role==="admin"});
    }
    if(action==="support" && method==="POST"){
      if(!u) return response(false,{error:"AUTH_REQUIRED",httpStatus:401});
      const msg=String(d.message||"").trim().slice(0,2000);
      if(!msg) return response(false,{error:"EMPTY_MESSAGE",httpStatus:422});
      const row={id:Number(DB.nextTicketId||1),uid:u.id,email:u.email,name:u.name,message:msg,reply:null,status:"open",created_at:now(),replied_at:null};
      DB.nextTicketId=row.id+1; DB.support.push(row); save(); return response(true);
    }
    if(action==="support_reply" && method==="POST"){
      if(!u || u.role!=="admin") return response(false,{error:"FORBIDDEN",httpStatus:403});
      const id=Number(d.id||0), reply=String(d.reply||"").trim().slice(0,2000);
      const row=DB.support.find(x=>Number(x.id)===id);
      if(!row || !reply) return response(false,{error:row?"BAD_REQUEST":"NOT_FOUND",httpStatus:row?422:404});
      row.reply=reply; row.status="answered"; row.replied_at=now();
      DB.notifications.push({id:Number(DB.nextNotifId||1),title:"رد على رسالتك للدعم الفني",body:"المشرف رد على رسالتك، افتح صفحة الدعم الفني عشان تشوف الرد.",to:email(row.email),created_at:now()});
      DB.nextNotifId++; save(); return response(true);
    }
    return response(false,{error:"NOT_FOUND",httpStatus:404});
  }

  globalThis.MozakraLocalAPI = {handle};
})();


/* ============================================================
   نظام تذاكر الدعم الفني — مدموج مع النسخة الأصلية
   ============================================================ */
(function(){
  "use strict";
  const KEY = "mozakra_ticketing_v1";
  const LEGACY_KEY = "mozakra_local_api_v2";
  function load(){
    try{
      const raw=localStorage.getItem(KEY);
      if(raw){ const d=JSON.parse(raw); if(d && Array.isArray(d.tickets)) return d; }
    }catch(_){ }
    return migrateLegacy();
  }
  function save(db){ try{ localStorage.setItem(KEY,JSON.stringify(db)); }catch(_){} }
  function migrateLegacy(){
    const db={tickets:[],notifications:[]};
    try{
      const raw=localStorage.getItem(LEGACY_KEY);
      const old=raw?JSON.parse(raw):null;
      if(old && Array.isArray(old.support)){
        db.tickets=old.support.map((t,i)=>{
          const created=new Date(Number(t.created_at||0)*1000).toISOString();
          const msgs=[{from:"student",authorName:t.name||"طالب",text:String(t.message||""),at:created}];
          if(t.reply){ msgs.push({from:"admin",authorName:"فريق الدعم",text:String(t.reply),at:new Date(Number(t.replied_at||t.created_at||0)*1000).toISOString()}); }
          return {id:`TCK-${String(t.id||i+1).padStart(4,"0")}`,userId:String(t.uid??""),userName:t.name||"طالب",userEmail:t.email||"",subject:"طلب دعم",category:"other",priority:"medium",status:t.status==="answered"?"resolved":"open",createdAt:created,updatedAt:msgs[msgs.length-1].at,messages:msgs};
        });
      }
    }catch(_){ }
    save(db);
    return db;
  }
  let DB=load();
  const current=()=>{ const u=globalThis.AUTH&&AUTH.user; return u?{id:String(u.id),name:u.name||"طالب",email:u.email||"",role:u.role||"student"}:null; };
  const uid=()=>`TCK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  const now=()=>new Date().toISOString();
  const sortDesc=(a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt);
  function pushNotification(n){
    const rec={id:`TN-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,read:false,at:now(),...n};
    DB.notifications.unshift(rec); save(DB);
  }
  function normalizeRemote(t){
    if(!t) return null;
    return {id:String(t.id),userId:String(t.user_id),userName:t.user_name||"طالب",userEmail:t.user_email||"",subject:t.subject||"طلب دعم",category:t.category||"other",priority:t.priority||"medium",status:t.status||"open",createdAt:t.created_at||now(),updatedAt:t.updated_at||t.created_at||now(),messages:Array.isArray(t.messages)?t.messages.map(m=>({id:m.id,from:m.from,authorName:m.authorName||"",text:m.text||"",at:m.at||now()})):[]};
  }
  async function syncRemote(){
    try{
      if(typeof apiJSON!=="function" || !AUTH || !AUTH.user) return false;
      const d=await apiJSON("ticket_list");
      if(!d.ok) return false;
      const remote=(d.tickets||[]).map(normalizeRemote).filter(Boolean);
      const pending=DB.tickets.filter(t=>t.syncPending && !remote.some(r=>r.id===t.id));
      DB.tickets=remote.concat(pending);
      const nd=await apiJSON("notifications");
      if(nd.ok){
        const oldRead=new Map(DB.notifications.filter(n=>String(n.id).startsWith("server-")).map(n=>[String(n.id),!!n.read]));
        const rn=(nd.notifications||[]).map(n=>{
          const id=`server-${n.id}`;
          return {id,read:oldRead.get(id)||false,at:new Date(Number(n.created_at||0)*1000).toISOString(),title:n.title,body:n.body,audience:(String(n.to||"")===(AUTH.user.role==="admin"?"all-admins":AUTH.user.email)||n.to==="all")?(AUTH.user.role==="admin"?"admin":"user"):"",userId:String(AUTH.user.id)};
        }).filter(n=>n.audience);
        DB.notifications=rn.concat(DB.notifications.filter(n=>!String(n.id).startsWith("server-")));
      }
      save(DB);
      return true;
    }catch(_){ return false; }
  }
  const api={
    sync:syncRemote,
    all(){ return DB.tickets; },
    forCurrentUser(){
      const u=current(); if(!u) return [];
      const list=u.role==="admin"?DB.tickets:DB.tickets.filter(t=>String(t.userId)===String(u.id));
      return [...list].sort(sortDesc);
    },
    get(id){ return DB.tickets.find(t=>t.id===id)||null; },
    create({subject,category,priority,message}){
      const u=current(); if(!u) return {ok:false,msg:"لازم تسجّل الدخول الأول."};
      const at=now();
      const ticket={id:uid(),userId:String(u.id),userName:u.name,userEmail:u.email,subject:String(subject||"").trim().slice(0,180),category:category||"other",priority:priority||"medium",status:"open",createdAt:at,updatedAt:at,messages:[{from:"student",authorName:u.name,text:String(message||"").trim().slice(0,5000),at}]};
      if(!ticket.subject || !ticket.messages[0].text) return {ok:false,msg:"اكتب موضوع ومحتوى التذكرة."};
      ticket.syncPending=true; DB.tickets.unshift(ticket); save(DB);
      pushNotification({audience:"admin",title:"تذكرة دعم جديدة",body:`${u.name}: ${ticket.subject}`,ticketId:ticket.id});
      if(typeof apiJSON==="function") (async()=>{
        const d=await apiJSON("ticket_create",{method:"POST",body:JSON.stringify({id:ticket.id,subject:ticket.subject,category:ticket.category,priority:ticket.priority,message:ticket.messages[0].text})});
        if(d.ok && d.ticket){ const rt=normalizeRemote(d.ticket); const idx=DB.tickets.findIndex(x=>x.id===ticket.id); if(idx>=0){ delete rt.syncPending; DB.tickets[idx]=rt; save(DB); } }
      })();
      return {ok:true,ticket};
    },
    reply(id,text){
      const u=current(); const t=this.get(id); if(!u||!t) return {ok:false,msg:"التذكرة غير موجودة."};
      const clean=String(text||"").trim().slice(0,5000); if(!clean) return {ok:false,msg:"اكتب الرد الأول."};
      const isAdmin=u.role==="admin";
      if(!isAdmin && String(t.userId)!==String(u.id)) return {ok:false,msg:"غير مسموح."};
      const at=now(); t.messages.push({from:isAdmin?"admin":"student",authorName:u.name,text:clean,at}); t.updatedAt=at;
      if(isAdmin && (t.status==="open" || t.status==="closed")) t.status="progress";
      if(!isAdmin && (t.status==="resolved"||t.status==="closed")) t.status="open";
      save(DB);
      pushNotification(isAdmin?{audience:"user",userId:String(t.userId),title:"رد جديد على تذكرتك",body:t.subject,ticketId:t.id}:{audience:"admin",title:"رد جديد من طالب",body:`${u.name}: ${t.subject}`,ticketId:t.id});
      if(typeof apiJSON==="function") (async()=>{ const d=await apiJSON("ticket_reply",{method:"POST",body:JSON.stringify({id:t.id,text:clean})}); if(d.ok&&d.ticket){ const rt=normalizeRemote(d.ticket); const i=DB.tickets.findIndex(x=>x.id===t.id); if(i>=0) DB.tickets[i]=rt; save(DB); } })();
      return {ok:true,ticket:t};
    },
    setStatus(id,status){ const u=current(),t=this.get(id); if(!u||u.role!=="admin"||!t||!TICKET_STATUSES.some(x=>x.id===status)) return {ok:false}; t.status=status;t.updatedAt=now();save(DB); if(typeof apiJSON==="function") apiJSON("ticket_status",{method:"POST",body:JSON.stringify({id,status})});return {ok:true,ticket:t}; },
    setPriority(id,priority){ const u=current(),t=this.get(id); if(!u||u.role!=="admin"||!t||!TICKET_PRIORITIES.some(x=>x.id===priority)) return {ok:false}; t.priority=priority;t.updatedAt=now();save(DB); if(typeof apiJSON==="function") apiJSON("ticket_priority",{method:"POST",body:JSON.stringify({id,priority})});return {ok:true,ticket:t}; },
    stats(){ const a=DB.tickets; return {total:a.length,open:a.filter(t=>t.status==="open").length,progress:a.filter(t=>t.status==="progress").length,resolved:a.filter(t=>t.status==="resolved"||t.status==="closed").length,urgent:a.filter(t=>t.priority==="urgent"&&!['resolved','closed'].includes(t.status)).length}; },
    unread(){
      const u=current(); if(!u) return 0;
      return DB.notifications.filter(n=>!n.read && ((u.role==="admin"&&n.audience==="admin")||(u.role!=="admin"&&n.audience==="user"&&String(n.userId)===String(u.id)))).length;
    },
    markRead(){
      const u=current(); if(!u) return;
      DB.notifications.forEach(n=>{ if((u.role==="admin"&&n.audience==="admin")||(u.role!=="admin"&&n.audience==="user"&&String(n.userId)===String(u.id))) n.read=true; }); save(DB);
      if(typeof apiJSON==="function") apiJSON("ticket_mark_read",{method:"POST",body:"{}"});
    }
  };
  globalThis.MozakraTicketing=api;
})();
