// شغّل: node e2e_server.js  (في نافذة) ثم node test_login.js
const B='http://127.0.0.1:4173/api/backend?action=';
let cookie='';
async function call(a,body,ck=cookie){const r=await fetch(B+a,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',cookie:ck},body:body&&JSON.stringify(body)});const sc=r.headers.get('set-cookie');if(sc&&ck===cookie)cookie=sc.split(';')[0];return [r.status,await r.json()];}
const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)process.exitCode=1;};
(async()=>{
 let [s,j]=await call('health');ok('health',s===200&&j.ok);
 [s,j]=await call('signup',{name:'طالب',username:'Ali_1',phone:'+201012345678',password:'123456',grade:'third',branch:'science_biology'});ok('signup',s===200&&j.ok);
 [s,j]=await call('signup',{name:'x2',username:'ali_1',phone:'01099999999',password:'123456',grade:'third',branch:'science_biology'});ok('dup username rejected',s===409);
 cookie='';
 for(const id of ['01012345678','201012345678','+201012345678','ali_1','ALI_1']){[s,j]=await call('login',{identifier:id,password:'123456'});ok('login '+id,s===200&&j.ok);cookie='';}
 [s,j]=await call('login',{identifier:'01012345678',password:'bad'});ok('wrong password 401',s===401);
 [s,j]=await call('login',{identifier:'legacy@test.com',password:'legacy-pass'});ok('legacy mixed-case email login',s===200&&j.ok);cookie='';
 [s,j]=await call('login',{identifier:'legacy_user',password:'legacy-pass'});ok('legacy mixed-case username login',s===200&&j.ok);cookie='';
 [s,j]=await call('login',{identifier:'semos91100@gmail.com',password:'test-owner-pass'});ok('owner login',s===200&&j.user.role==='owner');
 [s,j]=await call('accounts');ok('owner accounts',s===200&&j.accounts.length>=2&&!('password_hash' in j.accounts[0]));
 const stu=j.accounts.find(a=>a.username==='ali_1');
 [s,j]=await call('setemail',{user_id:stu.id,email:'Ali@Test.com'});ok('owner links email',s===200);
 const oc=cookie;cookie='';
 [s,j]=await call('login',{identifier:'ALI@test.com',password:'123456'});ok('login by email (case-insens.)',s===200);
 [s,j]=await call('ticketcreate',{subject:'مشكلة',text:'تفاصيل'});ok('ticket create',s===200);
 [s,j]=await call('accounts');ok('student blocked from accounts',s===403);
 [s,j]=await call('tickets',null,oc);ok('owner sees ticket',s===200&&j.tickets.length===1);
})();
(async()=>{await new Promise(r=>setTimeout(r,1500));
 const [s1,j1]=await call('notifications',null,'');console.log((s1===200&&j1.ok?'PASS ':'FAIL ')+'guest can read public notifications');
 const [s2]=await call('ticketcreate',{subject:'a',text:'b'},'');console.log((s2===401?'PASS ':'FAIL ')+'guest cannot open ticket (401)');
 const [s3,j3]=await call('me',null,'');console.log((s3===200&&j3.user===null?'PASS ':'FAIL ')+'guest me = null, no error');
 const [s4,j4]=await call('sitecontent',null,'');console.log((s4===200&&j4.ok?'PASS ':'FAIL ')+'guest reads site content');
})();
