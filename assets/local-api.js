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
