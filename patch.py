from pathlib import Path

p=Path('/mnt/data/work/api/backend.js')
s=p.read_text()

# Add helpers after getStudentByPhone
needle="""async function getStudentByPhone(p){\n  const phone=normalizePhone(p);\n  const rows=await sb(`users?select=id,email,phone,name,password_hash,role,state,created_at,updated_at&phone=eq.${eq(phone)}&limit=1`);\n  return rows?.[0]||null;\n}\n"""
repl=needle+"""
async function ensureOwnerUser(){
  let u=await getStudentByEmail(OWNER_EMAIL);
  if(u){
    if(u.role!=='owner'){
      await sb(`users?id=eq.${eq(u.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({role:'owner',name:u.name||'Owner',updated_at:now()})});
      u={...u,role:'owner'};
    }
    return u;
  }
  const inserted=await sb('users',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({email:OWNER_EMAIL,phone:null,name:'Owner',role:'owner',password_hash:hashPassword(OWNER_PASSWORD),state:{},created_at:now(),updated_at:now()})});
  return inserted?.[0]||null;
}
"""
s=s.replace(needle,repl)

# Owner login real DB id
s=s.replace("""      if(e && e===OWNER_EMAIL){\n        if(pass!==OWNER_PASSWORD) return fail(res,401,'LOGIN_FAILED');\n        const u={id:-1,email:OWNER_EMAIL,phone:'',name:'Owner',role:'owner'}; setSession(res,u); return ok(res,{authenticated:true,user:u});\n      }""","""      if(e && e===OWNER_EMAIL){\n        if(pass!==OWNER_PASSWORD) return fail(res,401,'LOGIN_FAILED');\n        const owner=await ensureOwnerUser();\n        if(!owner) return fail(res,500,'SERVER_ERROR');\n        const safe=safeUser({...owner,role:'owner',email:OWNER_EMAIL,name:owner.name||'Owner'});\n        setSession(res,safe); return ok(res,{authenticated:true,user:safe});\n      }""")

# Ticket support create: allow owner, use general ticket_create path too
s=s.replace("""    if(action==='support' && method==='POST'){\n      const u=requireUser(req); if(isStaff(u.role)) return fail(res,403,'FORBIDDEN');""","""    if(action==='support' && method==='POST'){\n      const u=requireUser(req); if(isStaff(u.role) && u.role!=='owner') return fail(res,403,'FORBIDDEN');""")
s=s.replace("""    if(action==='ticket_create' && method==='POST'){\n      const u=requireUser(req); if(isStaff(u.role)) return fail(res,403,'FORBIDDEN');""","""    if(action==='ticket_create' && method==='POST'){\n      const u=requireUser(req); if(isStaff(u.role) && u.role!=='owner') return fail(res,403,'FORBIDDEN');""")

# Role assignment owner-only and no owner promotion
s=s.replace("""      if((!rawPhone&&!id)||!ALL_ROLES.has(role)) return fail(res,422,'BAD_ROLE');""","""      if((!rawPhone&&!id)||!ALL_ROLES.has(role)||role==='owner') return fail(res,422,'ROLE_NOT_ALLOWED');""")

p.write_text(s)

# Views: owner can open own ticket; owner/staff labels
p=Path('/mnt/data/work/assets/views.js')
s=p.read_text()
s=s.replace("""  const isAdmin=isManagerRole(u.role);\n  const isStaff=isStaffRole(u.role);\n  const list=MozakraTicketing.forCurrentUser();""","""  const isAdmin=isManagerRole(u.role);\n  const isStaff=isStaffRole(u.role);\n  const canOpenTicket=!isStaff || u.role==='owner';\n  const list=MozakraTicketing.forCurrentUser();""")
s=s.replace("""    <div><h1>${isAdmin?"لوحة الدعم الفني — كل التذاكر":"الدعم الفني"}</h1>\n      <p class=\"muted sm\">${isAdmin?"تابع وردّ على تذاكر الطلاب بحسب الأولوية والحالة":"افتح تذكرة جديدة وتابع الردود من فريق الدعم"}</p></div>\n    ${!isStaff?`<button class=\"btn primary\" data-ticket-action=\"new\">+ تذكرة جديدة</button>`:\"\"}""","""    <div><h1>${isStaff?"لوحة الدعم الفني — كل التذاكر":"الدعم الفني"}</h1>\n      <p class=\"muted sm\">${isStaff?"تابع وردّ على التذاكر بحسب الأولوية والحالة":"افتح تذكرة جديدة وتابع الردود من فريق الدعم"}</p></div>\n    ${canOpenTicket?`<button class=\"btn primary\" data-ticket-action=\"new\">+ تذكرة جديدة</button>`:\"\"}""")
# Replace admin role table with owner-only tools and a view-only users list
old="""  ${AUTH.user.role==='owner'||AUTH.user.role==='admin'?`<h2 style=\"margin-bottom:10px\">📣 إشعار جديد</h2>\n  <div class=\"card\" style=\"margin-bottom:24px\">\n    <label class=\"field\"><span>العنوان</span><input id=\"n_title\" placeholder=\"مثلاً: امتحان تجريبي الأسبوع الجاي\"></label>\n    <label class=\"field\"><span>النص (اختياري)</span><textarea id=\"n_body\" rows=\"2\"></textarea></label>\n    <label class=\"field\"><span>لمين؟</span><input id=\"n_to\" value=\"all\" placeholder=\"all / staff / رقم موبايل / إيميل طالب\"></label>\n    <button class=\"btn primary\" data-act=\"sendnotif\">إرسال الإشعار</button>\n  </div>\n  <h2 style=\"margin-bottom:10px\">👥 إدارة الرتب</h2>\n  <div class=\"card\" style=\"margin-bottom:24px\">\n    ${USERS.length?`<div class=\"ticket-user-table\">${USERS.map(u=>`<div class=\"item\"><div class=\"ico\">${u.role==='owner'?'👑':u.role==='admin'?'🔴':u.role==='moderator'?'🟠':u.role==='support'?'🔵':'👤'}</div><div class=\"gr\"><b>${esc(u.name||'طالب')}</b><span>${esc(u.phone||'بدون رقم')} ${u.email?` · ${esc(u.email)}`:''}</span></div><select data-act=\"setrole\" data-id=\"${u.id}\" ${u.role==='owner'||String(u.id)===String(AUTH.user.id)?'disabled':''}>${roleOptions(u,u.role)}</select></div>`).join('')}</div>`:`<div class=\"empty\"><b>مفيش طلاب مسجلين لسه</b></div>`}\n  </div>`:''}"""
new="""  ${AUTH.user.role==='owner'||AUTH.user.role==='admin'?`<h2 style=\"margin-bottom:10px\">📣 إشعار جديد</h2>\n  <div class=\"card\" style=\"margin-bottom:24px\">\n    <label class=\"field\"><span>العنوان</span><input id=\"n_title\" placeholder=\"مثلاً: امتحان تجريبي الأسبوع الجاي\"></label>\n    <label class=\"field\"><span>النص (اختياري)</span><textarea id=\"n_body\" rows=\"2\"></textarea></label>\n    <label class=\"field\"><span>لمين؟</span><input id=\"n_to\" value=\"all\" placeholder=\"all / staff / رقم موبايل / إيميل طالب\"></label>\n    <button class=\"btn primary\" data-act=\"sendnotif\">إرسال الإشعار</button>\n  </div>`:''}\n\n  ${AUTH.user.role==='owner'?`<h2 style=\"margin-bottom:10px\">👑 أدوات الـ OWNER</h2>\n  <div class=\"grid g2\" style=\"margin-bottom:24px\">\n    <div class=\"card\">\n      <h3 style=\"margin-bottom:8px\">تعيين رتبة برقم الموبايل</h3>\n      <p class=\"muted sm\" style=\"margin-bottom:10px\">اكتب رقم الطالب وحدد الرتبة. الـ OWNER فقط يملك الصلاحية دي.</p>\n      <label class=\"field\"><span>رقم الموبايل</span><input id=\"role_phone\" inputmode=\"tel\" placeholder=\"01xxxxxxxxx\"></label>\n      <label class=\"field\"><span>الرتبة الجديدة</span><select id=\"role_value\">${['student','support','moderator','admin'].map(r=>`<option value=\"${r}\">${roleLabel(r)}</option>`).join('')}</select></label>\n      <button class=\"btn primary\" data-act=\"setrolephone\">تعيين الرتبة</button>\n    </div>\n    <div class=\"card\">\n      <h3 style=\"margin-bottom:8px\">تسجيل بريد إلكتروني</h3>\n      <p class=\"muted sm\" style=\"margin-bottom:10px\">البريد الإلكتروني للحسابات لا يضيفه إلا الـ OWNER.</p>\n      <label class=\"field\"><span>رقم الموبايل</span><input id=\"email_phone\" inputmode=\"tel\" placeholder=\"01xxxxxxxxx\"></label>\n      <label class=\"field\"><span>البريد الإلكتروني</span><input id=\"user_email\" type=\"email\" placeholder=\"student@example.com\"></label>\n      <button class=\"btn primary\" data-act=\"setuseremail\">حفظ البريد</button>\n    </div>\n  </div>\n  <h2 style=\"margin-bottom:10px\">👥 الحسابات والرتب الحالية</h2>\n  <div class=\"card\" style=\"margin-bottom:24px\">\n    ${USERS.length?`<div class=\"ticket-user-table\">${USERS.map(u=>`<div class=\"item\"><div class=\"ico\">${u.role==='owner'?'👑':u.role==='admin'?'🔴':u.role==='moderator'?'🟠':u.role==='support'?'🔵':'👤'}</div><div class=\"gr\"><b>${esc(u.name||'طالب')}</b><span>${esc(u.phone||'بدون رقم')} · ${esc(roleLabel(u.role))}${u.email?` · ${esc(u.email)}`:''}</span></div></div>`).join('')}</div>`:`<div class=\"empty\"><b>مفيش حسابات مسجلين لسه</b></div>`}\n  </div>`:''}"""
if old not in s:
    raise SystemExit('views admin block not found')
s=s.replace(old,new)
# roleOptions owner-only is now unused but simplify
s=s.replace("""  const roleOptions=(targetRole,currentRole)=>{\n    const actor=AUTH.user?.role;\n    let roles=actor==='owner'?['student','support','moderator','admin','owner']:['student','support','moderator'];\n    if(currentRole && !roles.includes(currentRole)) roles=[currentRole,...roles];\n    return roles.map(r=>`<option value=\"${r}\" ${r===currentRole?'selected':''}>${roleLabel(r)}</option>`).join('');\n  };\n""","")
p.write_text(s)

# App: remove student email signup field and adjust signup call; role event remains owner-only.
p=Path('/mnt/data/work/assets/app.js')
s=p.read_text()
s=s.replace('    ${!staff&&mode==="signup"?`<label class="field"><span>الإيميل (اختياري)</span><input id="auth_email" type="email" autocomplete="email" placeholder="للاسترجاع والإشعارات فقط"></label>`:""}','')
s=s.replace('    if(mode==="signup") signupAccount($("#auth_name")?.value.trim()||"",$("#auth_phone")?.value.trim()||"",pass,$("#auth_email")?.value.trim()||"");','    if(mode==="signup") signupAccount($("#auth_name")?.value.trim()||"",$("#auth_phone")?.value.trim()||"",pass);')
# Better error messages for send support/admin reply
s=s.replace('if(d.ok){ toast("اتبعتت رسالتك"); await fetchSupport(); render(); } else toast("حصلت مشكلة، جرّب تاني");','if(d.ok){ toast("اتبعتت رسالتك"); await fetchSupport(); render(); } else toast(authMessage(d.error));')
s=s.replace('if(d.ok){ toast("اترد على الطالب"); await fetchSupport(); render(); } else toast("حصلت مشكلة، جرّب تاني");','if(d.ok){ toast("اترد على الطالب"); await fetchSupport(); render(); } else toast(authMessage(d.error));')
p.write_text(s)

# Local API: enforce owner-only role/email and allow owner to open tickets.
p=Path('/mnt/data/work/assets/local-api.js')
s=p.read_text()
s=s.replace("if(action===\"signup\"&&method===\"POST\"){const p=normalizePhone(d.phone),pass=String(d.password||\"\"),name=String(d.name||\"\").trim().slice(0,120),e=email(d.email);if(!validPhone(p))", "if(action===\"signup\"&&method===\"POST\"){const p=normalizePhone(d.phone),pass=String(d.password||\"\"),name=String(d.name||\"\").trim().slice(0,120),e=email(d.email);if(e)return response(false,{error:\"EMAIL_OWNER_ONLY\",httpStatus:403});if(!validPhone(p))")
s=s.replace('if(action==="user_role"&&method==="POST"){if(!MANAGERS.has(u?.role))return response(false,{error:"FORBIDDEN",httpStatus:403});const id=Number(d.id),role=String(d.role||"student"),target=DB.users.find(x=>x.id===id);', 'if(action==="user_role"&&method==="POST"){if(u?.role!=="owner")return response(false,{error:"OWNER_ONLY",httpStatus:403});const phone=String(d.phone||"").trim(),id=Number(d.id),role=String(d.role||"student");if(!["student","support","moderator","admin"].includes(role))return response(false,{error:"ROLE_NOT_ALLOWED",httpStatus:403});const target=phone?DB.users.find(x=>normalizePhone(x.phone)===normalizePhone(phone)):DB.users.find(x=>x.id===id);')
# Add local user_email before ticket list
marker='    if(action==="ticket_list"&&method==="GET")'
insert='    if(action==="user_email"&&method==="POST"){if(u?.role!=="owner")return response(false,{error:"OWNER_ONLY",httpStatus:403});const phone=String(d.phone||"").trim(),e=email(d.email);if(!validPhone(phone)||!e||!validEmail(e))return response(false,{error:"INVALID_EMAIL",httpStatus:422});if(e===OWNER_EMAIL)return response(false,{error:"EMAIL_EXISTS",httpStatus:409});const target=DB.users.find(x=>normalizePhone(x.phone)===normalizePhone(phone));if(!target)return response(false,{error:"USER_NOT_FOUND",httpStatus:404});if(DB.users.some(x=>x.id!==target.id&&email(x.email)===e))return response(false,{error:"EMAIL_EXISTS",httpStatus:409});target.email=e;save();return response(true,{user:safe(target)});}\n'
s=s.replace(marker,insert+marker)
s=s.replace('if(!u)return response(false,{error:"AUTH_REQUIRED",httpStatus:401});if(STAFF.has(u.role))return response(false,{error:"FORBIDDEN",httpStatus:403});const msg=', 'if(!u)return response(false,{error:"AUTH_REQUIRED",httpStatus:401});if(STAFF.has(u.role)&&u.role!=="owner")return response(false,{error:"FORBIDDEN",httpStatus:403});const msg=')
p.write_text(s)

# README/update setup note
p=Path('/mnt/data/work/README.md')
s=p.read_text()
s=s.replace('  - إدارة الرتب من لوحة الإدارة.','  - إدارة الرتب من لوحة الإدارة للـ OWNER فقط، بالبحث برقم الموبايل.')
s=s.replace('  - الطالب يفتح تذكرة دعم جديدة ويتابعها.','  - الطالب أو الـ OWNER يفتح تذكرة دعم جديدة ويتابعها.')
s=s.replace('  - إرسال إشعار للجميع أو لفريق الدعم أو لطالب برقم الموبايل/الإيميل.','  - إشعارات مشتركة للجميع أو لفريق الدعم أو لطالب برقم الموبايل/الإيميل.')
p.write_text(s)

