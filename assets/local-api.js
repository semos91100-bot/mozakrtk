/* Local fallback API: same contract as Vercel API, stored per-browser. */
(function(){
  "use strict";
  const DB_KEY="mozakra_local_api_v3";
  const OWNER_EMAIL="semos91100@gmail.com";
  const OWNER_PASSWORD="alton112233";
  const ROLE_LEVEL={student:0,support:1,moderator:2,admin:3,owner:4};
  const STAFF=new Set(["support","moderator","admin","owner"]);
  const MANAGERS=new Set(["admin","owner"]);
  function blank(){return {users:[],content:{teachers:[],removed:[]},notifications:[],support:[],current:null,nextUserId:1,nextTicketId:1,nextNotifId:1};}
  function normalizePhone(v){let p=String(v||"").trim().replace(/[\s().-]/g,"");if(p.startsWith("00"))p="+"+p.slice(2);if(/^01\d{9}$/.test(p))p="+20"+p.slice(1);if(p.startsWith("+20"))p="+20"+p.slice(3).replace(/\D/g,"");else p=p.replace(/\D/g,"");return p;}
  function email(v){return String(v||"").trim().toLowerCase();}
  function validPhone(v){return /^\+?\d{10,15}$/.test(normalizePhone(v));}
  function validEmail(v){return !v||(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=190);}
  function now(){return Math.floor(Date.now()/1000);}
  function load(){try{const r=localStorage.getItem(DB_KEY);const d=r?JSON.parse(r):null;const x=Object.assign(blank(),d&&typeof d==="object"?d:{});x.users=Array.isArray(x.users)?x.users:[];x.notifications=Array.isArray(x.notifications)?x.notifications:[];x.support=Array.isArray(x.support)?x.support:[];return x;}catch(_){return blank();}}
  let DB=load();
  function save(){try{localStorage.setItem(DB_KEY,JSON.stringify(DB));}catch(_){}}
  async function hash(text){if(globalThis.crypto?.subtle&&globalThis.TextEncoder){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(String(text)));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");}return String(text);}
  function safe(u){return u?{id:u.id,email:u.email||"",phone:u.phone||"",name:u.name||"طالب",role:u.role||"student"}:null;}
  function current(){if(DB.current?.role==="owner"&&email(DB.current.email)===OWNER_EMAIL)return {id:-1,email:OWNER_EMAIL,phone:"",name:"Owner",role:"owner"};if(!DB.current)return null;const u=DB.users.find(x=>String(x.id)===String(DB.current.id));return safe(u);}
  function response(ok,extra){return Object.assign({ok},extra||{});}
  function body(opts){try{return opts?.body?JSON.parse(opts.body):{};}catch(_){return {};}}
  async function find(identifier){const raw=String(identifier||"").trim();if(raw.includes("@")){const e=email(raw);return DB.users.find(u=>email(u.email)===e)||null;}const p=normalizePhone(raw);return DB.users.find(u=>normalizePhone(u.phone)===p)||null;}
  async function handle(action,opts){
    const method=(opts?.method||"GET").toUpperCase(),d=body(opts),u=current();
    if(action==="me")return response(true,{authenticated:!!u,user:u||undefined});
    if(action==="signup"&&method==="POST"){const p=normalizePhone(d.phone),pass=String(d.password||""),name=String(d.name||"").trim().slice(0,120),e=email(d.email);if(!validPhone(p))return response(false,{error:"INVALID_PHONE",httpStatus:422});if(pass.length<8)return response(false,{error:"PASSWORD_SHORT",httpStatus:422});if(!validEmail(e))return response(false,{error:"INVALID_EMAIL",httpStatus:422});if(DB.users.some(x=>normalizePhone(x.phone)===p))return response(false,{error:"PHONE_EXISTS",httpStatus:409});if(e&&(e===OWNER_EMAIL||DB.users.some(x=>email(x.email)===e)))return response(false,{error:"EMAIL_EXISTS",httpStatus:409});const rec={id:Number(DB.nextUserId||1),email:e,phone:p,passwordHash:await hash(pass),name:name||"طالب",role:"student",state:{},created_at:now()};DB.nextUserId=rec.id+1;DB.users.push(rec);DB.current={id:rec.id};save();return response(true,{authenticated:true,user:safe(rec)});}
    if(action==="login"&&method==="POST"){const id=String(d.identifier||d.phone||d.email||"").trim(),pass=String(d.password||"");if(email(id)===OWNER_EMAIL){if(pass!==OWNER_PASSWORD)return response(false,{error:"LOGIN_FAILED",httpStatus:401});DB.current={role:"owner",email:OWNER_EMAIL};save();return response(true,{authenticated:true,user:current()});}const rec=await find(id);if(!rec||rec.passwordHash!==await hash(pass))return response(false,{error:"LOGIN_FAILED",httpStatus:401});DB.current={id:rec.id};save();return response(true,{authenticated:true,user:safe(rec)});}
    if(action==="logout"&&method==="POST"){DB.current=null;save();return response(true);}
    if(action==="state"){if(!u)return response(false,{error:"AUTH_REQUIRED",httpStatus:401});if(STAFF.has(u.role))return response(true,{state:{},updated:now()});const rec=DB.users.find(x=>String(x.id)===String(u.id));if(method==="GET")return response(true,{state:rec?.state||{},updated:rec?.updated_at||0});if(method==="POST"){rec.state=d.state||{};rec.name=String(d.state?.name||rec.name||"طالب").slice(0,120);rec.updated_at=now();save();return response(true,{updated:rec.updated_at});}}
    if(action==="content"){if(method==="GET")return response(true,{content:DB.content||{teachers:[],removed:[]}});if(!u||!MANAGERS.has(u.role))return response(false,{error:"FORBIDDEN",httpStatus:403});DB.content={teachers:Array.isArray(d.teachers)?d.teachers:[],removed:Array.isArray(d.removed)?d.removed:[]};save();return response(true);}
    if(action==="notifications"){if(!u)return response(false,{error:"AUTH_REQUIRED",httpStatus:401});if(method==="GET"){const mine=DB.notifications.filter(n=>n.to==="all"||n.to==="staff"&&STAFF.has(u.role)||String(n.userId||"")===String(u.id)||email(n.to)===email(u.email)).sort((a,b)=>b.created_at-a.created_at).slice(0,100);return response(true,{notifications:mine});}if(!MANAGERS.has(u.role))return response(false,{error:"FORBIDDEN",httpStatus:403});const title=String(d.title||"").trim(),txt=String(d.body||"").trim(),to=String(d.to||"all").trim();if(!title)return response(false,{error:"EMPTY_TITLE",httpStatus:422});let row={id:Number(DB.nextNotifId||1),title,body:txt,to:"",userId:null,created_at:now()};DB.nextNotifId++;if(to==="all"||to==="staff")row.to=to;else{const target=await find(to);if(!target)return response(false,{error:"USER_NOT_FOUND",httpStatus:404});row.userId=target.id;row.to=target.email||target.phone;}DB.notifications.push(row);save();return response(true);}
    if(action==="users"&&method==="GET"){if(!MANAGERS.has(u?.role))return response(false,{error:"FORBIDDEN",httpStatus:403});return response(true,{users:DB.users.map(x=>({id:x.id,name:x.name,email:x.email||"",phone:x.phone||"",role:x.role||"student",created_at:x.created_at,updated_at:x.updated_at}))});}
    if(action==="user_role"&&method==="POST"){if(!MANAGERS.has(u?.role))return response(false,{error:"FORBIDDEN",httpStatus:403});const id=Number(d.id),role=String(d.role||"student"),target=DB.users.find(x=>x.id===id);if(!target)return response(false,{error:"USER_NOT_FOUND",httpStatus:404});if(String(target.id)===String(u.id))return response(false,{error:"CANNOT_CHANGE_SELF_ROLE",httpStatus:403});if(target.role==="owner")return response(false,{error:"OWNER_PROTECTED",httpStatus:403});if(u.role==="admin"&&!['student','support','moderator'].includes(role))return response(false,{error:"ROLE_NOT_ALLOWED",httpStatus:403});target.role=role;save();return response(true);}
    if(action==="ticket_list"&&method==="GET"){if(!u)return response(false,{error:"AUTH_REQUIRED",httpStatus:401});const list=STAFF.has(u.role)?MozakraTicketing?.all?.()||DB.support:DB.support.filter(t=>String(t.uid)===String(u.id));return response(true,{tickets:list,isAdmin:STAFF.has(u.role)});}
    if(action==="ticket_create"&&method==="POST"){if(!u)return response(false,{error:"AUTH_REQUIRED",httpStatus:401});if(STAFF.has(u.role))return response(false,{error:"FORBIDDEN",httpStatus:403});const msg=String(d.message||"").trim().slice(0,5000),subject=String(d.subject||"").trim().slice(0,180);if(!msg||!subject)return response(false,{error:"BAD_REQUEST",httpStatus:422});const id=String(d.id||`TCK-${Date.now().toString(36).toUpperCase()}`);const t={id,userId:String(u.id),userName:u.name,userEmail:u.email||"",subject,category:d.category||"other",priority:d.priority||"medium",status:"open",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),messages:[{from:"student",authorName:u.name,text:msg,at:new Date().toISOString()}]};DB.support.unshift({id,uid:u.id,email:u.email||"",name:u.name,message:msg,reply:null,status:"open",created_at:now(),replied_at:null,subject,category:t.category,priority:t.priority,messages:t.messages});DB.notifications.unshift({id:Number(DB.nextNotifId||1),title:"تذكرة دعم جديدة",body:`${u.name}: ${subject}`,to:"staff",created_at:now()});DB.nextNotifId++;save();return response(true,{ticket:t});}
    if(action==="ticket_reply"&&method==="POST"){if(!u)return response(false,{error:"AUTH_REQUIRED",httpStatus:401});const row=DB.support.find(x=>String(x.id)===String(d.id));if(!row)return response(false,{error:"NOT_FOUND",httpStatus:404});if(!STAFF.has(u.role)&&String(row.uid)!==String(u.id))return response(false,{error:"FORBIDDEN",httpStatus:403});const txt=String(d.text||"").trim().slice(0,5000);if(!txt)return response(false,{error:"BAD_REQUEST",httpStatus:422});const at=new Date().toISOString();row.messages=row.messages||[{from:"student",authorName:row.name,text:row.message,at:new Date(Number(row.created_at)*1000).toISOString()}];row.messages.push({from:STAFF.has(u.role)?u.role:"student",authorName:u.name,text:txt,at});row.updatedAt=at;if(STAFF.has(u.role)){row.reply=txt;row.status="answered";row.replied_at=now();DB.notifications.unshift({id:Number(DB.nextNotifId||1),title:"رد جديد على تذكرتك",body:row.subject||"الدعم الفني",to:row.email||"",userId:row.uid,created_at:now()});}else{row.status="open";DB.notifications.unshift({id:Number(DB.nextNotifId||1),title:"رد جديد من طالب",body:`${u.name}: ${row.subject||"الدعم الفني"}`,to:"staff",created_at:now()});}DB.nextNotifId++;save();return response(true,{ticket:row});}
    if(action==="ticket_status"&&method==="POST"){if(!STAFF.has(u?.role))return response(false,{error:"FORBIDDEN",httpStatus:403});const r=DB.support.find(x=>String(x.id)===String(d.id));if(!r)return response(false,{error:"NOT_FOUND",httpStatus:404});if(!['open','progress','resolved','closed'].includes(d.status))return response(false,{error:"BAD_STATUS",httpStatus:422});r.status=d.status;save();return response(true);}
    if(action==="ticket_priority"&&method==="POST"){if(!STAFF.has(u?.role))return response(false,{error:"FORBIDDEN",httpStatus:403});const r=DB.support.find(x=>String(x.id)===String(d.id));if(!r)return response(false,{error:"NOT_FOUND",httpStatus:404});if(!['low','medium','high','urgent'].includes(d.priority))return response(false,{error:"BAD_PRIORITY",httpStatus:422});r.priority=d.priority;save();return response(true);}
    if(action==="support"&&method==="GET")return handle("ticket_list",{method:"GET",body:"{}"});
    if(action==="support"&&method==="POST")return handle("ticket_create",{method:"POST",body:JSON.stringify({id:`TCK-${Date.now().toString(36)}`,subject:"طلب دعم",message:d.message,category:"other",priority:"medium"})});
    if(action==="support_reply"&&method==="POST")return handle("ticket_reply",{method:"POST",body:JSON.stringify({id:d.id,text:d.reply})});
    if(action==="ticket_mark_read"&&method==="POST")return response(true);
    if(action==="ai"&&method==="POST")return response(false,{error:"AI_NOT_CONFIGURED",httpStatus:503});
    return response(false,{error:"NOT_FOUND",httpStatus:404});
  }
  globalThis.MozakraLocalAPI={handle};
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
  const current=()=>{ const a=(typeof AUTH!=="undefined"?AUTH:globalThis.AUTH); const u=a&&a.user; return u?{id:String(u.id),name:u.name||"طالب",email:u.email||"",role:u.role||"student"}:null; };
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
      const a=(typeof AUTH!=="undefined"?AUTH:globalThis.AUTH); if(typeof apiJSON!=="function" || !a || !a.user) return false;
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
          const staff=(typeof isStaffRole==="function"?isStaffRole(a.user.role):["support","moderator","admin","owner"].includes(a.user.role));
          return {id,read:oldRead.get(id)||false,at:new Date(Number(n.created_at||0)*1000).toISOString(),title:n.title,body:n.body,audience:staff?"admin":"user",userId:String(a.user.id)};
        });
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
      const staff=(typeof isStaffRole==="function"?isStaffRole(u.role):["support","moderator","admin","owner"].includes(u.role));
      const list=staff?DB.tickets:DB.tickets.filter(t=>String(t.userId)===String(u.id));
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
      const isAdmin=(typeof isStaffRole==="function"?isStaffRole(u.role):["support","moderator","admin","owner"].includes(u.role));
      if(!isAdmin && String(t.userId)!==String(u.id)) return {ok:false,msg:"غير مسموح."};
      const at=now(); t.messages.push({from:isAdmin?"admin":"student",authorName:u.name,text:clean,at}); t.updatedAt=at;
      if(isAdmin && (t.status==="open" || t.status==="closed")) t.status="progress";
      if(!isAdmin && (t.status==="resolved"||t.status==="closed")) t.status="open";
      save(DB);
      pushNotification(isAdmin?{audience:"user",userId:String(t.userId),title:"رد جديد على تذكرتك",body:t.subject,ticketId:t.id}:{audience:"admin",title:"رد جديد من طالب",body:`${u.name}: ${t.subject}`,ticketId:t.id});
      if(typeof apiJSON==="function") (async()=>{ const d=await apiJSON("ticket_reply",{method:"POST",body:JSON.stringify({id:t.id,text:clean})}); if(d.ok&&d.ticket){ const rt=normalizeRemote(d.ticket); const i=DB.tickets.findIndex(x=>x.id===t.id); if(i>=0) DB.tickets[i]=rt; save(DB); } })();
      return {ok:true,ticket:t};
    },
    setStatus(id,status){ const u=current(),t=this.get(id); if(!u||!((typeof isStaffRole==="function"?isStaffRole(u.role):["support","moderator","admin","owner"].includes(u.role)))||!t||!TICKET_STATUSES.some(x=>x.id===status)) return {ok:false}; t.status=status;t.updatedAt=now();save(DB); if(typeof apiJSON==="function") apiJSON("ticket_status",{method:"POST",body:JSON.stringify({id,status})});return {ok:true,ticket:t}; },
    setPriority(id,priority){ const u=current(),t=this.get(id); if(!u||!((typeof isStaffRole==="function"?isStaffRole(u.role):["support","moderator","admin","owner"].includes(u.role)))||!t||!TICKET_PRIORITIES.some(x=>x.id===priority)) return {ok:false}; t.priority=priority;t.updatedAt=now();save(DB); if(typeof apiJSON==="function") apiJSON("ticket_priority",{method:"POST",body:JSON.stringify({id,priority})});return {ok:true,ticket:t}; },
    stats(){ const a=DB.tickets; return {total:a.length,open:a.filter(t=>t.status==="open").length,progress:a.filter(t=>t.status==="progress").length,resolved:a.filter(t=>t.status==="resolved"||t.status==="closed").length,urgent:a.filter(t=>t.priority==="urgent"&&!['resolved','closed'].includes(t.status)).length}; },
    unread(){
      const u=current(); if(!u) return 0;
      return DB.notifications.filter(n=>!n.read && (((typeof isStaffRole==="function"?isStaffRole(u.role):["support","moderator","admin","owner"].includes(u.role))&&n.audience==="admin")||(u.role!=="admin"&&n.audience==="user"&&String(n.userId)===String(u.id)))).length;
    },
    markRead(){
      const u=current(); if(!u) return;
      DB.notifications.forEach(n=>{ if(((typeof isStaffRole==="function"?isStaffRole(u.role):["support","moderator","admin","owner"].includes(u.role))&&n.audience==="admin")||(u.role!=="admin"&&n.audience==="user"&&String(n.userId)===String(u.id))) n.read=true; }); save(DB);
      if(typeof apiJSON==="function") apiJSON("ticket_mark_read",{method:"POST",body:"{}"});
    }
  };
  globalThis.MozakraTicketing=api;
})();
