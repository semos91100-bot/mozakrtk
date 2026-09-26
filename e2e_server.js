'use strict';
const http=require('http'), fs=require('fs'), path=require('path'), crypto=require('crypto');
process.env.SUPABASE_URL='http://127.0.0.1:4173/rest-mock';
process.env.SUPABASE_SERVICE_ROLE_KEY='mock-key';
process.env.SESSION_SECRET='test-secret';
process.env.OWNER_EMAIL='semos91100@gmail.com';
process.env.OWNER_PASSWORD='test-owner-pass';
const handler=require('./api/backend.js');
const db={users:[],notifications:[],tickets:[],ticket_messages:[],admin_chat_messages:[],audit_logs:[],site_content:[],exams:[],exam_questions:[],exam_attempts:[]};
const seq={users:1,notifications:1,ticket_messages:1,admin_chat_messages:1,audit_logs:1,exams:1,exam_questions:1,exam_attempts:1};
const legacySalt='legacy-test-salt';
db.users.push({id:900,email:'Legacy@Test.com',username:'Legacy_User',name:'Legacy User',role:'student',password_hash:`s1$${legacySalt}$${crypto.scryptSync('legacy-pass',legacySalt,32).toString('hex')}`,state:{},created_at:new Date().toISOString()});
seq.users=901;
function qmatch(row,p){ for(const [k,v0] of p){ if(['select','order','limit','offset'].includes(k)) continue; let v=v0; if(v.startsWith('eq.')){v=decodeURIComponent(v.slice(3)); if(String(row[k]??'')!==v) return false;} else if(v.startsWith('ilike.')){v=decodeURIComponent(v.slice(6)).replace(/\\([\\%_*])/g,'$1'); if(String(row[k]??'').toLowerCase()!==v.toLowerCase()) return false;} } return true; }
function mockFetch(url,opts={}){return new Promise(async(resolve)=>{const u=new URL(url); if(!u.pathname.startsWith('/rest-mock/rest/v1/')) return resolve(new Response(JSON.stringify({message:'bad mock url'}),{status:500})); const tail=u.pathname.replace('/rest-mock/rest/v1/',''); const table=tail; const p=[...u.searchParams.entries()]; const body=opts.body?JSON.parse(opts.body):null; const method=opts.method||'GET'; const rows=db[table]; if(!rows) return resolve(new Response(JSON.stringify({message:'table missing',code:'42P01'}),{status:404}));
if(method==='GET'){let out=rows.filter(r=>qmatch(r,p));const order=u.searchParams.get('order');if(order){const [f,d='asc']=order.split('.');out.sort((a,b)=>new Date(a[f]||0)-new Date(b[f]||0));if(d==='desc')out.reverse();}const lim=u.searchParams.get('limit');if(lim)out=out.slice(0,Number(lim)); return resolve(new Response(JSON.stringify(out),{status:200,headers:{'content-type':'application/json'}}));}
if(method==='POST'){const arr=Array.isArray(body)?body:[body]; if(table==='users'){for(const x of arr){if(x.username&&rows.some(r=>r.username&&r.username.toLowerCase()===x.username.toLowerCase()))return resolve(new Response(JSON.stringify({message:'username unique',code:'23505'}),{status:409}));if(x.phone&&rows.some(r=>r.phone===x.phone))return resolve(new Response(JSON.stringify({message:'phone unique',code:'23505'}),{status:409}));if(x.email&&rows.some(r=>r.email&&r.email.toLowerCase()===x.email.toLowerCase()))return resolve(new Response(JSON.stringify({message:'email unique',code:'23505'}),{status:409}));}}
const ins=arr.map(x=>({...x,id:x.id??seq[table]++})); rows.push(...ins); const prefer=String(opts.headers?.Prefer||''); return resolve(new Response(prefer.includes('return=representation')?JSON.stringify(ins):null,{status:prefer.includes('return=representation')?201:204,headers:{'content-type':'application/json'}})); }
if(method==='PATCH'){for(const r of rows.filter(r=>qmatch(r,p)))Object.assign(r,body);return resolve(new Response(null,{status:204}));}
if(method==='DELETE'){for(const r of [...rows.filter(r=>qmatch(r,p))]){const i=rows.indexOf(r);if(i>=0)rows.splice(i,1);}return resolve(new Response(null,{status:204}));}
resolve(new Response(null,{status:405}));});}
global.fetch=mockFetch;
function resFromNative(res){const out={headers:{},statusCode:200,body:null,setHeader(k,v){this.headers[k]=v},status(n){this.statusCode=n;return this},json(x){this.body=x;this.setHeader('Content-Type','application/json');return this}};return out}
async function api(req,res){const url=new URL(req.url,'http://127.0.0.1:4173'); const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',async()=>{let body={};if(chunks.length){try{body=JSON.parse(Buffer.concat(chunks).toString())}catch{body={}}} const vr={method:req.method,query:Object.fromEntries(url.searchParams.entries()),headers:req.headers,body}; const rr=resFromNative(res); await handler(vr,rr); res.writeHead(rr.statusCode,rr.headers); res.end(rr.body==null?'':JSON.stringify(rr.body));});}
const server=http.createServer((req,res)=>{if(req.url.startsWith('/api/backend')) return api(req,res); const pth=decodeURIComponent(new URL(req.url,'http://x').pathname); const file=path.join(__dirname,pth==='/'?'index.html':pth); if(!file.startsWith(__dirname)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end('not found');} const ext=path.extname(file); const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.txt':'text/plain','.json':'application/json'}; res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});fs.createReadStream(file).pipe(res);});
server.listen(4173,'0.0.0.0',()=>console.log('E2E_SERVER_READY'));
