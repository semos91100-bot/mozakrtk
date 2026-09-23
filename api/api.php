<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
session_set_cookie_params([
  'httponly' => true,
  'samesite' => 'Lax',
  'secure' => $https,
  'path' => '/'
]);
session_start();

$configFile = __DIR__ . '/config.php';
$config = file_exists($configFile) ? require $configFile : require __DIR__ . '/config.example.php';
$adminConfigFile = dirname(__DIR__) . '/admin/admin_config.php';
$adminConfig = file_exists($adminConfigFile) ? require $adminConfigFile : ['admins'=>[]];

function out(array $data, int $status=200): never {
  http_response_code($status);
  echo json_encode($data, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
  exit;
}
function input(): array {
  $raw = file_get_contents('php://input');
  $d = json_decode($raw ?: '{}', true);
  return is_array($d) ? $d : [];
}

/* ---------- تخزين JSON محلي بدون أي سحابة، مع قفل ملفات لمنع تعارض الكتابة المتزامنة ---------- */
function storageDir(): string { $d=__DIR__.'/storage'; if(!is_dir($d)) mkdir($d,0755,true); return $d; }
function storeFile(string $name): string { return storageDir().'/'.$name; }
function readStore(string $name, array $default): array {
  $f=storeFile($name); if(!file_exists($f)) return $default;
  $raw=file_get_contents($f); $d=json_decode($raw!==false && $raw!=='' ? $raw : 'null', true);
  return is_array($d) ? $d : $default;
}
/** يفتح الملف، يقفله (flock)، يمرر بياناته الحالية لدالة $mutate اللي بترجع ['data'=>..,'result'=>..]
 *  يكتب data الجديدة تحت نفس القفل، يرجّع result. كده مفيش سباق كتابة بين طلبين في نفس اللحظة. */
function withStore(string $name, array $default, callable $mutate) {
  $file=storeFile($name);
  $fh=fopen($file,'c+');
  if($fh===false) out(['ok'=>false,'error'=>'STORAGE_ERROR'],500);
  flock($fh,LOCK_EX);
  rewind($fh);
  $raw=stream_get_contents($fh);
  $data=($raw!==false && trim((string)$raw)!=='') ? json_decode($raw,true) : $default;
  if(!is_array($data)) $data=$default;
  $ret=$mutate($data);
  $encoded=json_encode($ret['data'], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
  rewind($fh); ftruncate($fh,0); fwrite($fh,$encoded); fflush($fh);
  flock($fh,LOCK_UN); fclose($fh);
  return $ret['result'] ?? null;
}
function nextId(array $rows): int { $m=0; foreach($rows as $r) $m=max($m,(int)($r['id']??0)); return $m+1; }

/* ---------- المستخدمين ---------- */
function allUsers(): array { return readStore('users.json',[]); }
function adminAccounts(): array {
  global $adminConfig;
  $rows = (array)($adminConfig['admins'] ?? []);
  return array_values(array_filter($rows, fn($a)=>is_array($a) && validEmail((string)($a['email']??'')) && !empty($a['password_hash'])));
}
function findAdminByEmail(string $email): ?array {
  foreach(adminAccounts() as $a){
    if(strtolower(trim((string)($a['email']??'')))===$email){
      return [
        'id' => -1,
        'email' => strtolower(trim((string)$a['email'])),
        'name' => trim((string)($a['name']??'Admin')),
        'password' => (string)$a['password_hash'],
        'state' => '{}',
        'is_admin_account' => true
      ];
    }
  }
  return null;
}
function findUserById(int $id): ?array { foreach(allUsers() as $u) if((int)($u['id']??0)===$id) return $u; return null; }
function findUserByEmail(string $email): ?array { foreach(allUsers() as $u) if(strtolower((string)($u['email']??''))===$email) return $u; return findAdminByEmail($email); }
function user(): ?array {
  if(!empty($_SESSION['admin_email'])) return findAdminByEmail(cleanEmail((string)$_SESSION['admin_email']));
  if(empty($_SESSION['uid'])) return null;
  return findUserById((int)$_SESSION['uid']);
}
function requireUser(): array { $u=user(); if(!$u) out(['ok'=>false,'error'=>'AUTH_REQUIRED'],401); return $u; }
function isAdmin(array $u): bool { return !empty($u['is_admin_account']); }
function requireAdmin(): array { $u=requireUser(); if(!isAdmin($u)) out(['ok'=>false,'error'=>'FORBIDDEN'],403); return $u; }
function cleanEmail(string $e): string { return strtolower(trim($e)); }
function validEmail(string $e): bool { return (bool)filter_var($e,FILTER_VALIDATE_EMAIL) && strlen($e)<=190; }
function roleOf(array $u): string { return isAdmin($u) ? 'admin' : 'student'; }

/* ---------- حماية بسيطة من محاولات دخول متكررة (بدون خدمة خارجية) ---------- */
function tooManyAttempts(string $key): bool {
  $now=time(); $cnt=0;
  foreach(readStore('attempts.json',[]) as $r) if(($r['k']??'')===$key && $now-(int)($r['t']??0) < 900) $cnt++;
  return $cnt>=8;
}
function recordAttempt(string $key): void {
  withStore('attempts.json',[],function($rows) use($key){
    $now=time();
    $rows=array_values(array_filter($rows, fn($r)=>$now-(int)($r['t']??0) < 900));
    $rows[]=['k'=>$key,'t'=>$now];
    return ['data'=>$rows];
  });
}
function clearAttempts(string $key): void {
  withStore('attempts.json',[],function($rows) use($key){
    return ['data'=>array_values(array_filter($rows, fn($r)=>($r['k']??'')!==$key))];
  });
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
  if ($action==='me') {
    $u=user();
    if(!$u) out(['ok'=>true,'authenticated'=>false]);
    out(['ok'=>true,'authenticated'=>true,'user'=>['id'=>(int)$u['id'],'email'=>$u['email'],'name'=>$u['name'],'role'=>roleOf($u)]]);
  }

  if ($action==='signup' && $method==='POST') {
    $d=input(); $email=cleanEmail((string)($d['email']??'')); $pass=(string)($d['password']??''); $name=trim((string)($d['name']??''));
    if(strlen($name)>120) $name=substr($name,0,120);
    if(!validEmail($email)) out(['ok'=>false,'error'=>'INVALID_EMAIL'],422);
    if(strlen($pass)<8) out(['ok'=>false,'error'=>'PASSWORD_SHORT'],422);
    if(strlen($pass)>200) out(['ok'=>false,'error'=>'PASSWORD_LONG'],422);
    $hash=password_hash($pass,PASSWORD_DEFAULT); $now=time();
    $result=withStore('users.json',[],function($users) use($email,$hash,$name,$now){
      if(findAdminByEmail($email)) return ['data'=>$users,'result'=>['error'=>'EMAIL_EXISTS']];
      foreach($users as $u) if(strtolower((string)$u['email'])===$email) return ['data'=>$users,'result'=>['error'=>'EMAIL_EXISTS']];
      $id=nextId($users);
      $users[]=['id'=>$id,'email'=>$email,'password'=>$hash,'name'=>$name,'state'=>'{}','created_at'=>$now,'updated_at'=>$now];
      return ['data'=>$users,'result'=>['id'=>$id]];
    });
    if(isset($result['error'])) out(['ok'=>false,'error'=>$result['error']],409);
    unset($_SESSION['admin_email']);
    $_SESSION['uid']=$result['id'];
    out(['ok'=>true,'authenticated'=>true,'user'=>['id'=>$result['id'],'email'=>$email,'name'=>$name,'role'=>roleOf(['email'=>$email])]]);
  }

  if ($action==='login' && $method==='POST') {
    $d=input(); $email=cleanEmail((string)($d['email']??'')); $pass=(string)($d['password']??'');
    $key='login:'.$email;
    if(tooManyAttempts($key)) out(['ok'=>false,'error'=>'TOO_MANY_ATTEMPTS'],429);
    $u=findUserByEmail($email);
    if(!$u || !password_verify($pass,(string)$u['password'])) { recordAttempt($key); out(['ok'=>false,'error'=>'LOGIN_FAILED'],401); }
    clearAttempts($key);
    if(isAdmin($u)){
      $_SESSION=[];
      $_SESSION['admin_email']=$u['email'];
    }else{
      if(password_needs_rehash((string)$u['password'],PASSWORD_DEFAULT)){
        $newHash=password_hash($pass,PASSWORD_DEFAULT); $uid=(int)$u['id'];
        withStore('users.json',[],function($users) use($uid,$newHash){
          foreach($users as &$x){ if((int)$x['id']===$uid){ $x['password']=$newHash; $x['updated_at']=time(); } } unset($x);
          return ['data'=>$users];
        });
        $u=findUserById($uid);
      }
      unset($_SESSION['admin_email']);
      $_SESSION['uid']=(int)$u['id'];
    }
    out(['ok'=>true,'authenticated'=>true,'user'=>['id'=>(int)$u['id'],'email'=>$u['email'],'name'=>$u['name'],'role'=>roleOf($u)]]);
  }

  if ($action==='logout' && $method==='POST') { $_SESSION=[]; if(ini_get('session.use_cookies')){ $p=session_get_cookie_params(); setcookie(session_name(),'',['expires'=>time()-42000,'path'=>$p['path'],'domain'=>$p['domain']??'','secure'=>$p['secure'],'httponly'=>$p['httponly'],'samesite'=>$p['samesite']??'Lax']); } session_destroy(); out(['ok'=>true]); }

  if ($action==='state' && $method==='GET') {
    $u=requireUser(); if(isAdmin($u)) out(['ok'=>true,'state'=>[],'updated'=>time()]);
    $state=json_decode((string)($u['state'] ?? '{}'),true); if(!is_array($state)) $state=[];
    out(['ok'=>true,'state'=>$state,'updated'=>(int)($u['updated_at']??0)]);
  }
  if ($action==='state' && $method==='POST') {
    $u=requireUser(); $d=input(); if(isAdmin($u)) out(['ok'=>true]); $state=$d['state']??null;
    if(!is_array($state)) out(['ok'=>false,'error'=>'BAD_STATE'],422);
    $json=json_encode($state,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    if($json===false || strlen($json)>5000000) out(['ok'=>false,'error'=>'STATE_TOO_LARGE'],413);
    $name=trim((string)($state['name']??$u['name']??'')); if(strlen($name)>120) $name=substr($name,0,120);
    $now=time(); $uid=(int)$u['id'];
    withStore('users.json',[],function($users) use($uid,$json,$name,$now){
      foreach($users as &$x){ if((int)$x['id']===$uid){ $x['state']=$json; $x['name']=$name; $x['updated_at']=$now; } } unset($x);
      return ['data'=>$users];
    });
    out(['ok'=>true,'updated'=>$now]);
  }

  if ($action==='ai' && $method==='POST') {
    requireUser();
    $key=trim((string)($config['gemini_api_key']??'')); $model=trim((string)($config['gemini_model']??'gemini-2.0-flash'));
    if(!$key || str_contains($key,'ضع_مفتاح')) out(['ok'=>false,'error'=>'AI_NOT_CONFIGURED'],503);
    $d=input(); $messages=$d['messages']??[]; $context=$d['context']??'';
    if(!is_array($messages)) out(['ok'=>false,'error'=>'BAD_MESSAGES'],422);
    $contents=[];
    foreach(array_slice($messages,-12) as $m){
      $role=($m['role']??'user')==='model'?'model':'user'; $text=trim((string)($m['content']??'')); if($text!=='') $contents[]=['role'=>$role,'parts'=>[['text'=>$text]]];
    }
    if(!$contents) out(['ok'=>false,'error'=>'EMPTY_MESSAGE'],422);
    $system="أنت مدرس خصوصي لطالب في الصف الثالث الثانوي (علمي علوم) في مصر. اتكلم بالعامية المصرية البسيطة والمحترمة.\n".
      "اشرح بإيجاز وبخطوات، استخدم مثالًا واضحًا، وفي نهاية الرد اسأل سؤال فهم قصير. إذا طلب الطالب اختبارًا أنشئ 5 أسئلة اختيار من متعدد واذكر الإجابات بعد الأسئلة. لا تخترع معلومات خارج المنهج المصري، وإذا لم تكن متأكدًا قل ذلك بوضوح.\n".
      "سياق الطالب: ".substr($context,0,3000);
    $payload=['systemInstruction'=>['parts'=>[['text'=>$system]]],'contents'=>$contents,'generationConfig'=>['temperature'=>0.35,'maxOutputTokens'=>1200]];
    $url='https://generativelanguage.googleapis.com/v1beta/models/'.rawurlencode($model).':generateContent';
    $ch=curl_init($url); curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','x-goog-api-key: '.$key],CURLOPT_POSTFIELDS=>json_encode($payload),CURLOPT_TIMEOUT=>45]);
    $body=curl_exec($ch); $code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE); $err=curl_error($ch); curl_close($ch);
    if($body===false) out(['ok'=>false,'error'=>'AI_NETWORK','detail'=>$err],502);
    $j=json_decode($body,true);
    if($code<200||$code>=300) out(['ok'=>false,'error'=>'AI_PROVIDER','status'=>$code],502);
    $text=$j['candidates'][0]['content']['parts'][0]['text']??'';
    if(!$text) out(['ok'=>false,'error'=>'AI_EMPTY'],502);
    out(['ok'=>true,'text'=>$text]);
  }

  /* ---------- محتوى الموقع (المدرّسين) — يعدّله المشرف فيظهر للجميع ---------- */
  if ($action==='content' && $method==='GET') {
    out(['ok'=>true,'content'=>readStore('content.json',['teachers'=>[],'removed'=>[]])]);
  }
  if ($action==='content' && $method==='POST') {
    requireAdmin();
    $d=input(); $teachersIn=$d['teachers']??null; $removedIn=$d['removed']??null;
    if(!is_array($teachersIn) || !is_array($removedIn)) out(['ok'=>false,'error'=>'BAD_CONTENT'],422);
    $clean=[];
    foreach($teachersIn as $t){
      if(!is_array($t)) continue;
      $id=trim((string)($t['id']??'')); $n=trim((string)($t['n']??'')); $s=trim((string)($t['s']??''));
      if($id==='' || $n==='' || !in_array($s,['fz','km','ah','ar','en'],true)) continue;
      $links=[];
      foreach((array)($t['links']??[]) as $l){
        if(!is_array($l)) continue;
        $lk=trim((string)($l['k']??'')); $lt=trim((string)($l['t']??'')); $url=trim((string)($l['url']??''));
        if($lk===''||$lt===''||!preg_match('~^https://~i',$url)) continue;
        $links[]=['k'=>substr($lk,0,10),'t'=>substr($lt,0,60),'url'=>substr($url,0,500)];
      }
      $clean[]=['id'=>substr($id,0,40),'n'=>substr($n,0,120),'s'=>$s,'ti'=>substr(trim((string)($t['ti']??'')),0,20),'bio'=>substr(trim((string)($t['bio']??'')),0,400),'links'=>$links];
    }
    $removedClean=array_values(array_unique(array_map('strval', array_filter($removedIn, fn($x)=>is_string($x)||is_int($x)))));
    withStore('content.json',['teachers'=>[],'removed'=>[]],function($c) use($clean,$removedClean){
      return ['data'=>['teachers'=>$clean,'removed'=>$removedClean]];
    });
    out(['ok'=>true]);
  }

  /* ---------- الإشعارات — المشرف يبعتها، الطالب يستقبلها ---------- */
  if ($action==='notifications' && $method==='GET') {
    $u=requireUser(); $email=strtolower((string)$u['email']);
    $mine=array_values(array_filter(readStore('notifications.json',[]), fn($n)=>($n['to']??'all')==='all' || strtolower((string)($n['to']??''))===$email));
    usort($mine, fn($a,$b)=>($b['created_at']??0)<=>($a['created_at']??0));
    out(['ok'=>true,'notifications'=>array_slice($mine,0,50)]);
  }
  if ($action==='notifications' && $method==='POST') {
    requireAdmin();
    $d=input(); $title=trim((string)($d['title']??'')); $body=trim((string)($d['body']??'')); $to=cleanEmail((string)($d['to']??'all'));
    if($title==='') out(['ok'=>false,'error'=>'EMPTY_TITLE'],422);
    if($to!=='all' && !validEmail($to)) out(['ok'=>false,'error'=>'INVALID_EMAIL'],422);
    $title=substr($title,0,150); $body=substr($body,0,1000); $now=time();
    withStore('notifications.json',[],function($rows) use($title,$body,$to,$now){
      $rows[]=['id'=>nextId($rows),'title'=>$title,'body'=>$body,'to'=>$to,'created_at'=>$now];
      return ['data'=>$rows];
    });
    out(['ok'=>true]);
  }

  /* ---------- الدعم الفني — الطالب يبعت رسالة، المشرف يشوفها ويرد ---------- */
  if ($action==='support' && $method==='GET') {
    $u=requireUser(); $all=readStore('support.json',[]);
    $mine=isAdmin($u) ? $all : array_values(array_filter($all, fn($t)=>(int)($t['uid']??0)===(int)$u['id']));
    usort($mine, fn($a,$b)=>($b['created_at']??0)<=>($a['created_at']??0));
    out(['ok'=>true,'tickets'=>$mine,'isAdmin'=>isAdmin($u)]);
  }
  if ($action==='support' && $method==='POST') {
    $u=requireUser(); $d=input(); $msg=trim((string)($d['message']??''));
    if($msg==='') out(['ok'=>false,'error'=>'EMPTY_MESSAGE'],422);
    $msg=substr($msg,0,2000); $now=time();
    withStore('support.json',[],function($rows) use($u,$msg,$now){
      $rows[]=['id'=>nextId($rows),'uid'=>(int)$u['id'],'email'=>$u['email'],'name'=>$u['name'],'message'=>$msg,'reply'=>null,'status'=>'open','created_at'=>$now,'replied_at'=>null];
      return ['data'=>$rows];
    });
    out(['ok'=>true]);
  }
  if ($action==='support_reply' && $method==='POST') {
    requireAdmin();
    $d=input(); $id=(int)($d['id']??0); $reply=trim((string)($d['reply']??''));
    if(!$id || $reply==='') out(['ok'=>false,'error'=>'BAD_REQUEST'],422);
    $reply=substr($reply,0,2000); $now=time(); $found=false; $ticketEmail=null;
    withStore('support.json',[],function($rows) use($id,$reply,$now,&$found,&$ticketEmail){
      foreach($rows as &$t){ if((int)($t['id']??0)===$id){ $t['reply']=$reply; $t['status']='answered'; $t['replied_at']=$now; $found=true; $ticketEmail=$t['email']??null; } } unset($t);
      return ['data'=>$rows];
    });
    if(!$found) out(['ok'=>false,'error'=>'NOT_FOUND'],404);
    if($ticketEmail){
      withStore('notifications.json',[],function($rows) use($ticketEmail,$now){
        $rows[]=['id'=>nextId($rows),'title'=>'رد على رسالتك للدعم الفني','body'=>'المشرف رد على رسالتك، افتح صفحة الدعم الفني عشان تشوف الرد.','to'=>$ticketEmail,'created_at'=>$now];
        return ['data'=>$rows];
      });
    }
    out(['ok'=>true]);
  }

  out(['ok'=>false,'error'=>'NOT_FOUND'],404);
} catch(Throwable $e) {
  out(['ok'=>false,'error'=>'SERVER_ERROR'],500);
}
