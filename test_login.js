// شغّل: node e2e_server.js ثم node test_login.js
const B='http://127.0.0.1:4173/api/backend?action=';
let cookie='';
async function call(a,body,ck=cookie){const r=await fetch(B+a,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',cookie:ck},body:body&&JSON.stringify(body)});const sc=r.headers.get('set-cookie');if(sc&&ck===cookie)cookie=sc.split(';')[0];return [r.status,await r.json()];}
const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)process.exitCode=1;};
(async()=>{
  let s,j;
  [s,j]=await call('health');ok('health',s===200&&j.ok);
  [s,j]=await call('signup',{name:'طالب',username:'Ali_1',phone:'+201012345678',password:'123456',grade:'third',branch:'science_biology'});ok('signup',s===200&&j.ok);
  [s,j]=await call('signup',{name:'x2',username:'ali_1',phone:'01099999999',password:'123456',grade:'third',branch:'science_biology'});ok('dup username rejected',s===409);
  cookie='';
  for(const id of ['01012345678','201012345678','+201012345678','ali_1','ALI_1']){[s,j]=await call('login',{identifier:id,password:'123456'});ok('login '+id,s===200&&j.ok);cookie='';}
  [s,j]=await call('login',{identifier:'01012345678',password:'bad'});ok('wrong password 401',s===401);
  [s,j]=await call('login',{identifier:'legacy@test.com',password:'legacy-pass'});ok('legacy mixed-case email login',s===200&&j.ok);cookie='';
  [s,j]=await call('login',{identifier:'legacy_user',password:'legacy-pass'});ok('legacy mixed-case username login',s===200&&j.ok);cookie='';
  [s,j]=await call('login',{identifier:'semos91100@gmail.com',password:'test-owner-pass'});ok('owner login',s===200&&j.user.role==='owner');
  const ownerCookie=cookie;
  [s,j]=await call('accounts');ok('owner accounts',s===200&&j.accounts.length>=2&&!('password_hash' in j.accounts[0]));
  const stu=j.accounts.find(a=>a.username==='ali_1');
  [s,j]=await call('setemail',{user_id:stu.id,email:'Ali@Test.com'});ok('owner links email',s===200);
  [s,j]=await call('sitecontentsave',{teachers:[{name:'أ/ أحمد',subject:'رياضيات',bio:'مراجعة',grades:['third'],branches:['science_biology']}],removed:[]},ownerCookie);ok('owner saves teachers',s===200);
  [s,j]=await call('teachers',null,'');ok('guest teachers endpoint',s===200&&j.ok&&j.teachers.length===1);
  [s,j]=await call('examcreate',{title:'اختبار تجريبي',subject:'رياضيات',description:'اختبار بسيط',grade:'third',branch:'science_biology',duration_minutes:20},ownerCookie);ok('owner creates exam',s===200&&j.exam?.id);
  const examId=j.exam?.id;
  [s,j]=await call('examquestionadd',{exam_id:examId,text:'1+1 يساوي؟',options:['1','2','3'],correct_index:1,points:1},ownerCookie);ok('owner adds exam question',s===200&&j.question?.id);
  [s,j]=await call('questionbankadd',{subject:'رياضيات',text:'2+2 يساوي؟',options:['3','4','5'],correct_index:1,grade:'third',branch:'science_biology',difficulty:'سهل',explanation:'2+2 = 4',points:1},ownerCookie);ok('owner adds question bank item',s===200&&j.question?.id);
  [s,j]=await call('exampublish',{id:examId,published:true},ownerCookie);ok('owner publishes exam',s===200&&j.ok);
  cookie='';
  [s,j]=await call('login',{identifier:'01012345678',password:'123456'});ok('student re-login',s===200);
  const studentCookie=cookie;
  [s,j]=await call('examlist',null,studentCookie);ok('student sees published exam',s===200&&j.exams.length===1);
  [s,j]=await call('examget',{id:examId},studentCookie);ok('student opens exam',s===200&&j.questions.length===1&&!('correct_index' in j.questions[0]));
  const qid=j.questions[0].id;
  [s,j]=await call('examsubmit',{id:examId,answers:{[qid]:1}},studentCookie);ok('student submits exam',s===200&&j.percent===100);
  [s,j]=await call('questionbank',null,studentCookie);ok('student sees question bank',s===200&&j.questions.length===1&&j.questions[0].subject==='رياضيات'&&!('correct_index' in j.questions[0]));
  const qb=j.questions[0];
  [s,j]=await call('questioncheck',{id:qb.id,answer_index:1},studentCookie);ok('student checks question bank',s===200&&j.correct===true&&j.correct_index===1);
  [s,j]=await call('tickets',null,ownerCookie);ok('owner tickets',s===200);
  [s,j]=await call('notifications',null,'');ok('guest public notifications',s===200&&j.ok);
  [s,j]=await call('ticketcreate',{subject:'a',text:'b'},'');ok('guest cannot open ticket',s===401);
  [s,j]=await call('me',null,'');ok('guest me null',s===200&&j.user===null);
  console.log('DONE');
})().catch(e=>{console.error(e);process.exitCode=1});
