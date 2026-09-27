<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
$oauthAction=(string)($_GET['action']??'');
$oauthProviderHint=(string)($_GET['provider']??'');
$oauthCrossSite=$https && ($oauthAction==='oauth_callback' || ($oauthAction==='oauth_start' && $oauthProviderHint==='apple'));
ini_set('session.gc_maxlifetime','2592000');
session_set_cookie_params([
  'httponly' => true,
  'samesite' => $oauthCrossSite?'None':'Lax',
  'secure' => $https,
  'path' => '/'
]);
session_start();
function setRememberCookie(bool $remember=false): void {
  $https=(!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS']!=='off') || (($_SERVER['HTTP_X_FORWARDED_PROTO']??'')==='https');
  setcookie(session_name(),session_id(),[
    'expires'=>$remember?time()+2592000:0,
    'httponly'=>true,
    'samesite'=>'Lax',
    'secure'=>$https,
    'path'=>'/'
  ]);
}

$configFile = __DIR__ . '/config.php';
$config = file_exists($configFile) ? require $configFile : require __DIR__ . '/config.example.php';

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
function blobBridgeConfig(): ?array {
  $url=trim((string)(getenv('BLOB_BRIDGE_URL') ?: ''));
  $secret=trim((string)(getenv('BLOB_BRIDGE_SECRET') ?: ''));
  if($url==='' && $secret==='') return null;
  if($url==='' || $secret==='') throw new RuntimeException('Blob bridge configuration is incomplete');
  if(!filter_var($url,FILTER_VALIDATE_URL) || strtolower((string)parse_url($url,PHP_URL_SCHEME))!=='https') throw new RuntimeException('Blob bridge URL must use HTTPS');
  return ['url'=>rtrim($url,'/').'/api/bridge','secret'=>$secret];
}
function blobBridgeCall(array $cfg,array $payload): array {
  if(!function_exists('curl_init')) throw new RuntimeException('PHP cURL extension is required for Blob storage');
  $ch=curl_init($cfg['url']);
  curl_setopt_array($ch,[
    CURLOPT_POST=>true,
    CURLOPT_RETURNTRANSFER=>true,
    CURLOPT_CONNECTTIMEOUT=>5,
    CURLOPT_TIMEOUT=>20,
    CURLOPT_HTTPHEADER=>['Content-Type: application/json','Authorization: Bearer '.$cfg['secret']],
    CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)
  ]);
  $raw=curl_exec($ch); $status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE); $error=curl_error($ch); curl_close($ch);
  if($raw===false || $status<200 || $status>=300) throw new RuntimeException('Blob bridge request failed'.($status?(' (HTTP '.$status.')'):'').($error?': '.$error:''));
  $result=json_decode((string)$raw,true);
  if(!is_array($result) || empty($result['ok'])) throw new RuntimeException('Blob bridge returned an invalid response');
  return $result;
}
function readStorageJson(string $filename,mixed $fallback): mixed {
  $cfg=blobBridgeConfig(); $local=__DIR__.'/storage/'.$filename;
  if($cfg){
    $result=blobBridgeCall($cfg,['operation'=>'read','key'=>'mz-data/'.$filename]);
    if(!empty($result['found'])){
      $data=json_decode((string)($result['data']??''),true);
      return is_array($data)?$data:$fallback;
    }
    if(is_file($local)){
      $data=json_decode((string)file_get_contents($local),true);
      if(is_array($data)){ writeStorageJson($filename,$data); return $data; }
    }
    return $fallback;
  }
  if(!is_file($local)) return $fallback;
  $data=json_decode((string)file_get_contents($local),true);
  return is_array($data)?$data:$fallback;
}
function writeStorageJson(string $filename,array $data): void {
  $json=json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
  $cfg=blobBridgeConfig();
  if($cfg){ blobBridgeCall($cfg,['operation'=>'write','key'=>'mz-data/'.$filename,'data'=>$json]); return; }
  $dir=storeDir(); $file=$dir.'/'.$filename; $tmp=$file.'.tmp';
  if(file_put_contents($tmp,$json,LOCK_EX)===false || !rename($tmp,$file)) throw new RuntimeException('Could not persist local JSON storage');
}
function storeDir(): string {
  $dir=__DIR__.'/storage'; if(!is_dir($dir)) mkdir($dir,0755,true);
  return $dir;
}
function storeFile(): string { return storeDir().'/users.json'; }
function contentFile(): string { return storeDir().'/content.json'; }
function supportFile(): string { return storeDir().'/support.json'; }
function allUsers(): array { $d=readStorageJson('users.json',[]); return is_array($d)?$d:[]; }
function writeUsers(array $users): void { writeStorageJson('users.json',array_values($users)); }
function defaultContent(): array {
  return ['teachers'=>[],'lessons'=>[],'questions'=>[],'teacher_overrides'=>[],'disabled_teachers'=>[],'updated_at'=>0];
}
function allContent(): array {
  $d=readStorageJson('content.json',defaultContent());
  if(!is_array($d)) $d=defaultContent();
  foreach(defaultContent() as $k=>$v) if(!array_key_exists($k,$d)) $d[$k]=$v;
  if(!is_array($d['teachers'])) $d['teachers']=[];
  if(!is_array($d['lessons'])) $d['lessons']=[];
  if(!is_array($d['questions'])) $d['questions']=[];
  if(!is_array($d['teacher_overrides'])) $d['teacher_overrides']=[];
  if(!is_array($d['disabled_teachers'])) $d['disabled_teachers']=[];
  return $d;
}
function defaultSupport(): array { return ['next_id'=>1,'tickets'=>[]]; }
function allSupport(): array {
  $d=readStorageJson('support.json',defaultSupport()); if(!is_array($d)) $d=defaultSupport();
  if(!isset($d['next_id']) || (int)$d['next_id']<1) $d['next_id']=1;
  if(!is_array($d['tickets'])) $d['tickets']=[];
  return $d;
}
function writeSupport(array $data): void {
  writeStorageJson('support.json',$data);
}
function ticketForUser(int $uid): ?array {
  $d=allSupport(); $found=null;
  foreach($d['tickets'] as $t){ if((int)($t['user_id']??0)===$uid && ($t['status']??'')!=='closed') $found=$t; }
  return $found;
}
function cleanSupportText(mixed $v,int $max=4000): string { return cleanText($v,$max); }
function supportPublicTicket(array $t): array {
  return ['id'=>(int)($t['id']??0),'reason'=>cleanSupportText($t['reason']??'',2500),'user_phone'=>cleanPhone((string)($t['user_phone']??'')),'status'=>(string)($t['status']??'open'),'created_at'=>(int)($t['created_at']??0),'updated_at'=>(int)($t['updated_at']??0),'transferred_at'=>(int)($t['transferred_at']??0),'messages'=>array_values(array_map(fn($m)=>['id'=>(int)($m['id']??0),'sender'=>(string)($m['sender']??'support'),'text'=>cleanSupportText($m['text']??'',4000),'ts'=>(int)($m['ts']??0)], $t['messages']??[]))];
}
function writeContent(array $content): void {
  $content['updated_at']=time();
  writeStorageJson('content.json',$content);
}
function nextId(array $users): int { $m=0; foreach($users as $u) $m=max($m,(int)($u['id']??0)); return $m+1; }
function findUserById(int $id): ?array { foreach(allUsers() as $u) if((int)($u['id']??0)===$id) return $u; return null; }
function findUserByEmail(string $email): ?array { foreach(allUsers() as $u) if(strtolower((string)($u['email']??''))===$email) return $u; return null; }
function user(): ?array { if(empty($_SESSION['uid'])) return null; return findUserById((int)$_SESSION['uid']); }
function requireUser(): array { $u=user(); if(!$u) out(['ok'=>false,'error'=>'AUTH_REQUIRED'],401); return $u; }
function requireAdmin(): void { if(empty($_SESSION['admin_ok'])) out(['ok'=>false,'error'=>'ADMIN_AUTH_REQUIRED'],401); }
function cleanEmail(string $e): string { return strtolower(trim($e)); }
function validEmail(string $e): bool { return (bool)filter_var($e,FILTER_VALIDATE_EMAIL) && strlen($e)<=190; }
function cleanPhone(string $p): string {
  $p=strtr(trim($p), ['٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9','۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9']);
  $p=preg_replace('/[^0-9+]/','',$p) ?? '';
  if(str_starts_with($p,'+20')) $p='0'.substr($p,3);
  if(str_starts_with($p,'20') && strlen($p)===12) $p='0'.substr($p,2);
  return substr($p,0,20);
}
function validPhone(string $p): bool { return (bool)preg_match('/^01[0125][0-9]{8}$/',$p); }
function findUserByLogin(string $login): ?array {
  $login=trim($login);
  $phone=cleanPhone($login);
  foreach(allUsers() as $u){
    if($phone!=='' && cleanPhone((string)($u['phone']??''))===$phone) return $u;
    $email=cleanEmail($login);
    if($email!=='' && cleanEmail((string)($u['email']??''))===$email) return $u;
  }
  return null;
}
function cutText(string $s, int $max): string { return function_exists('mb_substr') ? mb_substr($s,0,$max) : substr($s,0,$max); }
function cleanText(mixed $v, int $max=5000): string { return cutText(trim((string)($v ?? '')),$max); }
function cleanUrl(string $url): string {
  $url=trim($url); if($url==='') return '';
  $p=parse_url($url); if(!$p || !in_array(strtolower((string)($p['scheme']??'')),['http','https'],true)) return '';
  return cutText($url,1000);
}
function cleanLinks(mixed $links): array {
  if(!is_array($links)) return [];
  $allowed=['site','yt','fb','tg','ig','app','lt','wa']; $out=[];
  foreach(array_slice($links,0,20) as $l){
    if(!is_array($l)) continue;
    $url=cleanUrl((string)($l['url']??'')); if(!$url) continue;
    $k=(string)($l['k']??'site'); if(!in_array($k,$allowed,true)) $k='site';
    $out[]=['k'=>$k,'t'=>cleanText($l['t']??'رابط',120),'url'=>$url];
  }
  return $out;
}
function cleanTeacher(array $t): array {
  return [
    'id'=>cleanText($t['id']??'',100),
    'n'=>cleanText($t['n']??'',160),
    's'=>cleanText($t['s']??'',20),
    'ti'=>cleanText($t['ti']??'',80),
    'bio'=>cleanText($t['bio']??'',1500),
    'links'=>cleanLinks($t['links']??[]),
    'lectures'=>cleanLinks($t['lectures']??[]),
    'notes'=>cleanLinks($t['notes']??[])
  ];
}
function cleanLesson(array $l): array {
  return [
    'id'=>cleanText($l['id']??'',120), 'title'=>cleanText($l['title']??'',220),
    'unit'=>cleanText($l['unit']??'',220), 'ui'=>max(1,(int)($l['ui']??1)), 'li'=>max(1,(int)($l['li']??1)),
    'sid'=>cleanText($l['sid']??'',20), 'summary'=>cleanText($l['summary']??'',6000),
    'video'=>cleanUrl((string)($l['video']??'')),
    'points'=>is_array($l['points']??null)?array_values(array_map(fn($x)=>cleanText($x,500),array_slice($l['points'],0,30))):[],
    'laws'=>is_array($l['laws']??null)?array_values(array_map(function($x){return is_array($x)?['f'=>cleanText($x['f']??'',300),'d'=>cleanText($x['d']??'',500)]:null;},array_slice($l['laws'],0,30))):[],
    'mistakes'=>is_array($l['mistakes']??null)?array_values(array_map(fn($x)=>cleanText($x,500),array_slice($l['mistakes'],0,30))):[],
    'checks'=>is_array($l['checks']??null)?array_values(array_map(fn($x)=>cleanText($x,500),array_slice($l['checks'],0,30))):[]
  ];
}
function cleanQuestion(array $q): array {
  $opts=is_array($q['o']??null)?array_values(array_map(fn($x)=>cleanText($x,700),array_slice($q['o'],0,6))):[];
  return [
    'id'=>cleanText($q['id']??'',120), 't'=>'mcq', 's'=>cleanText($q['s']??'',20), 'u'=>max(1,(int)($q['u']??1)), 'l'=>max(1,(int)($q['l']??1)),
    'd'=>in_array(($q['d']??'mid'),['easy','mid','hard'],true)?$q['d']:'mid',
    'q'=>cleanText($q['q']??'',1500), 'o'=>$opts, 'a'=>max(0,(int)($q['a']??0)), 'e'=>cleanText($q['e']??'',2000)
  ];
}
function oauthConfigured(string $provider): bool {
  global $config;
  return $provider==='google'
    ? !empty($config['google_client_id']) && !empty($config['google_client_secret'])
    : ($provider==='apple' && !empty($config['apple_service_id']) && !empty($config['apple_team_id']) && !empty($config['apple_key_id']) && !empty($config['apple_private_key']));
}
function oauthBaseUrl(): string {
  global $config;
  $base=rtrim(trim((string)($config['oauth_base_url']??'')),'/');
  $parts=parse_url($base);
  if(!$parts || empty($parts['host']) || !in_array(strtolower((string)($parts['scheme']??'')),['https','http'],true)) oauthErrorPage('إعداد OAUTH_BASE_URL غير صحيح على الاستضافة.');
  $local=in_array(strtolower((string)$parts['host']),['localhost','127.0.0.1'],true);
  if(!$local && strtolower((string)$parts['scheme'])!=='https') oauthErrorPage('يلزم نشر الموقع عبر HTTPS لتسجيل الدخول الاجتماعي.');
  if(isset($parts['user'])||isset($parts['pass'])||isset($parts['query'])||isset($parts['fragment'])) oauthErrorPage('إعداد رابط الموقع غير صالح.');
  return $base;
}
function oauthRedirectUri(): string { return oauthBaseUrl().'/api/oauth.php'; }
function oauthErrorPage(string $message,int $status=503): never {
  http_response_code($status); header('Content-Type: text/html; charset=utf-8'); header('Cache-Control: no-store');
  $safe=htmlspecialchars($message,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');
  echo '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تعذر تسجيل الدخول</title><body style="margin:0;background:#fff;color:#182a42;font:16px system-ui,Arial;display:grid;place-items:center;min-height:100vh"><main style="max-width:520px;margin:20px;padding:28px;border:1px solid #e1e8f1;border-radius:20px;box-shadow:0 16px 45px #14243b18"><h1 style="font-size:22px">تعذر تسجيل الدخول</h1><p style="line-height:1.8;color:#60718a">'.$safe.'</p><a style="display:inline-block;padding:11px 16px;border-radius:11px;background:#2468d8;color:white;text-decoration:none" href="../study.html">العودة للموقع</a></main></body></html>'; exit;
}
function oauthB64UrlDecode(string $value): string|false { $pad=strlen($value)%4; if($pad) $value.=str_repeat('=',4-$pad); return base64_decode(strtr($value,'-_','+/'),true); }
function oauthDerLength(int $length): string {
  if($length<128) return chr($length);
  $bytes=''; while($length>0){$bytes=chr($length&255).$bytes;$length>>=8;} return chr(0x80|strlen($bytes)).$bytes;
}
function oauthDer(int $tag,string $data): string { return chr($tag).oauthDerLength(strlen($data)).$data; }
function oauthRsaJwkPem(array $jwk): string {
  if(($jwk['kty']??'')!=='RSA'||empty($jwk['n'])||empty($jwk['e'])) throw new RuntimeException('Unsupported signing key');
  $n=oauthB64UrlDecode((string)$jwk['n']); $e=oauthB64UrlDecode((string)$jwk['e']); if($n===false||$e===false) throw new RuntimeException('Invalid RSA signing key');
  $integer=fn($v)=>oauthDer(0x02,(ord($v[0])&0x80)?"\0".$v:$v);
  $rsa=oauthDer(0x30,$integer($n).$integer($e));
  $algorithm=hex2bin('300d06092a864886f70d0101010500');
  $spki=oauthDer(0x30,$algorithm.oauthDer(0x03,"\0".$rsa));
  return "-----BEGIN PUBLIC KEY-----\n".chunk_split(base64_encode($spki),64,"\n")."-----END PUBLIC KEY-----\n";
}
function oauthHttpJson(string $url,?array $post=null,array $headers=[]): array {
  if(!function_exists('curl_init')) throw new RuntimeException('PHP cURL is required for social sign-in');
  $ch=curl_init($url); $opts=[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>8,CURLOPT_TIMEOUT=>18,CURLOPT_HTTPHEADER=>$headers];
  if($post!==null){$opts[CURLOPT_POST]=true;$opts[CURLOPT_POSTFIELDS]=http_build_query($post,'','&',PHP_QUERY_RFC3986);$opts[CURLOPT_HTTPHEADER]=array_merge(['Content-Type: application/x-www-form-urlencoded'],$headers);}
  curl_setopt_array($ch,$opts); $body=curl_exec($ch); $code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE); $err=curl_error($ch); curl_close($ch);
  if($body===false || $code<200 || $code>=300) throw new RuntimeException('OAuth provider request failed'.($code?' HTTP '.$code:'').($err?': '.$err:''));
  $data=json_decode((string)$body,true); if(!is_array($data)) throw new RuntimeException('OAuth provider returned invalid JSON'); return $data;
}
function oauthVerifyIdToken(string $jwt,string $provider,string $clientId,string $nonce): array {
  $parts=explode('.',$jwt); if(count($parts)!==3) throw new RuntimeException('Invalid identity token');
  $head=json_decode((string)oauthB64UrlDecode($parts[0]),true); $claims=json_decode((string)oauthB64UrlDecode($parts[1]),true); $sig=oauthB64UrlDecode($parts[2]);
  if(!is_array($head)||!is_array($claims)||$sig===false||empty($head['kid'])) throw new RuntimeException('Invalid identity token');
  if(($head['alg']??'')!=='RS256') throw new RuntimeException('Unexpected identity-token algorithm');
  $jwksUrl=$provider==='google'?'https://www.googleapis.com/oauth2/v3/certs':'https://appleid.apple.com/auth/keys';
  $jwks=oauthHttpJson($jwksUrl); $jwk=null;
  foreach(($jwks['keys']??[]) as $key) if(($key['kid']??'')===$head['kid']){$jwk=$key;break;}
  if(!$jwk) throw new RuntimeException('Identity-token signing key not found');
  $public=openssl_pkey_get_public(oauthRsaJwkPem($jwk)); if($public===false || openssl_verify($parts[0].'.'.$parts[1],$sig,$public,OPENSSL_ALGO_SHA256)!==1) throw new RuntimeException('Identity-token signature verification failed');
  $issuer=$provider==='google'?['accounts.google.com','https://accounts.google.com']:['https://appleid.apple.com'];
  $aud=$claims['aud']??''; $audOk=is_array($aud)?in_array($clientId,$aud,true):hash_equals($clientId,(string)$aud);
  if(!in_array((string)($claims['iss']??''),$issuer,true)||!$audOk||empty($claims['sub'])||(int)($claims['exp']??0)<time()||(int)($claims['iat']??0)>time()+120) throw new RuntimeException('Identity-token claims are invalid');
  $receivedNonce=(string)($claims['nonce']??'');
  if($receivedNonce==='' || (!hash_equals($nonce,$receivedNonce) && !($provider==='apple' && hash_equals(hash('sha256',$nonce),$receivedNonce)))) throw new RuntimeException('Identity-token nonce mismatch');
  return $claims;
}
function oauthAppleClientSecret(): string {
  global $config;
  $header=['alg'=>'ES256','kid'=>(string)$config['apple_key_id']]; $now=time();
  $payload=['iss'=>(string)$config['apple_team_id'],'iat'=>$now,'exp'=>$now+3600,'aud'=>'https://appleid.apple.com','sub'=>(string)$config['apple_service_id']];
  $encode=fn($v)=>rtrim(strtr(base64_encode(json_encode($v,JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR)),'+/','-_'),'=');
  $input=$encode($header).'.'.$encode($payload); $pem=str_replace('\\n',"\n",(string)$config['apple_private_key']); $key=openssl_pkey_get_private($pem); $der='';
  if($key===false || !openssl_sign($input,$der,$key,OPENSSL_ALGO_SHA256)) throw new RuntimeException('Apple private key could not sign the client secret');
  $p=2; if((ord($der[1])&0x80)!==0) $p=2+(ord($der[1])&0x7f); if(ord($der[$p]??"\0")!==0x02) throw new RuntimeException('Invalid ECDSA signature encoding');
  $rlen=ord($der[$p+1]); $r=substr($der,$p+2,$rlen); $q=$p+2+$rlen; if(ord($der[$q]??"\0")!==0x02) throw new RuntimeException('Invalid ECDSA signature encoding');
  $slen=ord($der[$q+1]); $s=substr($der,$q+2,$slen); $r=str_pad(substr(ltrim($r,"\0"),-32),32,"\0",STR_PAD_LEFT); $s=str_pad(substr(ltrim($s,"\0"),-32),32,"\0",STR_PAD_LEFT);
  return $input.'.'.rtrim(strtr(base64_encode($r.$s),'+/','-_'),'=');
}
function oauthFindOrCreateUser(string $provider,array $claims,string $name=''): array {
  $sub=cleanText($claims['sub']??'',255); if($sub==='') throw new RuntimeException('Provider account has no subject identifier');
  $email=cleanEmail((string)($claims['email']??'')); $verified=in_array($claims['email_verified']??false,[true,1,'1','true'],true);
  if($email!=='' && (!validEmail($email)||!$verified)) $email='';
  $users=allUsers(); $foundIndex=null;
  foreach($users as $i=>$u){
    if(hash_equals((string)($u['oauth'][$provider]??''),$sub)){$foundIndex=$i;break;}
    if($email!=='' && cleanEmail((string)($u['email']??''))===$email){
      if(empty($u['email_verified'])) throw new RuntimeException('ACCOUNT_EXISTS_UNVERIFIED_EMAIL');
      $foundIndex=$i;break;
    }
  }
  $now=time();
  if($foundIndex!==null){
    $u=$users[$foundIndex]; if(($u['status']??'active')!=='active') throw new RuntimeException('This account is disabled');
    if($email!=='') foreach($users as $i=>$other) if($i!==$foundIndex && cleanEmail((string)($other['email']??''))===$email) throw new RuntimeException('ACCOUNT_EMAIL_CONFLICT');
    $u['oauth']=is_array($u['oauth']??null)?$u['oauth']:[]; $u['oauth'][$provider]=$sub;
    if($email!==''){$u['email']=$email;$u['email_verified']=true;} if(trim($name)!=='' && trim((string)($u['name']??''))==='') $u['name']=cleanText($name,160);
    $u['updated_at']=$now; $users[$foundIndex]=$u;
  } else {
    $id=nextId($users); $users[]=['id'=>$id,'email'=>$email,'email_verified'=>$email!=='','phone'=>'','school'=>'','governorate'=>'','grade'=>'الثالث الثانوي — علمي علوم','password'=>password_hash(bin2hex(random_bytes(32)),PASSWORD_DEFAULT),'oauth'=>[$provider=>$sub],'name'=>cleanText($name?:('طالب '.($provider==='google'?'Google':'Apple')),160),'status'=>'active','state'=>'{}','created_at'=>$now,'updated_at'=>$now];
    $foundIndex=count($users)-1;
  }
  writeUsers($users); $user=$users[$foundIndex]; session_regenerate_id(true); $_SESSION['uid']=(int)$user['id']; setRememberCookie(false);
  return ['id'=>(int)$user['id'],'email'=>$user['email']??'','phone'=>$user['phone']??'','name'=>$user['name']??'','school'=>$user['school']??'','governorate'=>$user['governorate']??'','grade'=>$user['grade']??'الثالث الثانوي — علمي علوم','oauth_providers'=>array_values(array_keys($user['oauth']??[]))];
}
function teacherInContent(array $content,string $id): ?array {
  foreach($content['teachers'] as $t) if((string)($t['id']??'')===$id) return $t;
  return null;
}

$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if($action==='oauth_start'){
  $provider=(string)($_GET['provider']??''); $mode=(string)($_GET['mode']??'login');
  if(!in_array($provider,['google','apple'],true)||!in_array($mode,['login','signup'],true)) oauthErrorPage('طلب تسجيل الدخول غير صالح.',400);
  if(!oauthConfigured($provider)) oauthErrorPage('تسجيل '.$provider.' غير مفعّل بعد. على صاحب الموقع إعداد بيانات OAuth في الاستضافة واتباع OAUTH-SETUP-AR.md.');
  try{
    $state=bin2hex(random_bytes(32)); $nonce=bin2hex(random_bytes(32));
    $_SESSION['oauth_state']=$state; $_SESSION['oauth_nonce']=$nonce; $_SESSION['oauth_provider']=$provider; $_SESSION['oauth_mode']=$mode; $_SESSION['oauth_started']=time();
    $redirect=oauthRedirectUri();
    if($provider==='google'){
      $params=['client_id'=>$config['google_client_id'],'redirect_uri'=>$redirect,'response_type'=>'code','scope'=>'openid email profile','state'=>$state,'nonce'=>$nonce,'prompt'=>'select_account'];
      header('Location: https://accounts.google.com/o/oauth2/v2/auth?'.http_build_query($params,'','&',PHP_QUERY_RFC3986),true,302); exit;
    }
    $baseParts=parse_url(oauthBaseUrl()); $appleHost=strtolower((string)($baseParts['host']??''));
    if(strtolower((string)($baseParts['scheme']??''))!=='https'||$appleHost==='localhost'||filter_var($appleHost,FILTER_VALIDATE_IP)) oauthErrorPage('يتطلب Apple نطاقًا عامًا حقيقيًا يعمل عبر HTTPS.');
    $params=['client_id'=>$config['apple_service_id'],'redirect_uri'=>$redirect,'response_type'=>'code','response_mode'=>'form_post','scope'=>'name email','state'=>$state,'nonce'=>$nonce];
    header('Location: https://appleid.apple.com/auth/authorize?'.http_build_query($params,'','&',PHP_QUERY_RFC3986),true,302); exit;
  }catch(Throwable $e){error_log('[mozakra-oauth] start '.$provider.' '.get_class($e).': '.$e->getMessage());oauthErrorPage('تعذر بدء تسجيل الدخول. تحقق من إعدادات مزود الدخول في الاستضافة.');}
}
if($action==='oauth_callback'){
  $provider=(string)($_SESSION['oauth_provider']??''); $state=(string)($_POST['state']??$_GET['state']??'');
  $expectedState=(string)($_SESSION['oauth_state']??''); $nonce=(string)($_SESSION['oauth_nonce']??''); $started=(int)($_SESSION['oauth_started']??0);
  if(!in_array($provider,['google','apple'],true)||$expectedState===''||$state===''||!hash_equals($expectedState,$state)||$started<time()-600||$nonce==='') oauthErrorPage('انتهت جلسة تسجيل الدخول أو لم تطابق. ارجع وابدأ المحاولة من جديد.',400);
  unset($_SESSION['oauth_state'],$_SESSION['oauth_nonce'],$_SESSION['oauth_provider'],$_SESSION['oauth_mode'],$_SESSION['oauth_started']);
  if(!empty($_POST['error'])||!empty($_GET['error'])) oauthErrorPage('تم إلغاء تسجيل الدخول أو رفضه. يمكنك الرجوع وتجربة مزود آخر.',400);
  $code=(string)($_POST['code']??$_GET['code']??''); if($code===''||!oauthConfigured($provider)) oauthErrorPage('لم يكتمل رد مزود تسجيل الدخول.');
  try{
    $redirect=oauthRedirectUri();
    if($provider==='google'){
      $token=oauthHttpJson('https://oauth2.googleapis.com/token',['code'=>$code,'client_id'=>$config['google_client_id'],'client_secret'=>$config['google_client_secret'],'redirect_uri'=>$redirect,'grant_type'=>'authorization_code']);
      $claims=oauthVerifyIdToken((string)($token['id_token']??''),'google',(string)$config['google_client_id'],$nonce);
      if(empty($claims['email'])||!in_array($claims['email_verified']??false,[true,1,'1','true'],true)) throw new RuntimeException('Google did not provide a verified email');
      $name=cleanText($claims['name']??'',160);
    }else{
      $token=oauthHttpJson('https://appleid.apple.com/auth/token',['code'=>$code,'client_id'=>$config['apple_service_id'],'client_secret'=>oauthAppleClientSecret(),'redirect_uri'=>$redirect,'grant_type'=>'authorization_code']);
      $claims=oauthVerifyIdToken((string)($token['id_token']??''),'apple',(string)$config['apple_service_id'],$nonce);
      $appleUser=json_decode((string)($_POST['user']??''),true); $name='';
      if(is_array($appleUser)&&is_array($appleUser['name']??null)) $name=trim((string)($appleUser['name']['firstName']??'').' '.(string)($appleUser['name']['lastName']??''));
      if($name==='') $name=cleanText($claims['email']??'طالب Apple',160);
    }
    oauthFindOrCreateUser($provider,$claims,$name);
    header('Location: '.oauthBaseUrl().'/study.html',true,303); exit;
  }catch(Throwable $e){error_log('[mozakra-oauth] callback '.$provider.' '.get_class($e).': '.$e->getMessage());oauthErrorPage('لم نتمكن من التحقق من حسابك أو حفظه. تحقق من إعدادات '.($provider==='google'?'Google':'Apple').' وأن التخزين متصل، ثم حاول مرة أخرى.');}
}

try {
  if ($action==='me') {
    $u=user();
    if(!$u) out(['ok'=>true,'authenticated'=>false]);
    out(['ok'=>true,'authenticated'=>true,'user'=>['id'=>(int)$u['id'],'email'=>$u['email']??'','phone'=>$u['phone']??'','name'=>$u['name']??'','school'=>$u['school']??'','governorate'=>$u['governorate']??'','grade'=>$u['grade']??'الثالث الثانوي — علمي علوم','oauth_providers'=>array_values(array_keys($u['oauth']??[]))]]);
  }
  if ($action==='content' && $method==='GET') {
    $c=allContent();
    out(['ok'=>true,'content'=>$c]);
  }
  if ($action==='signup' && $method==='POST') {
    $d=input();
    $name=cleanText($d['name']??'',160);
    $phone=cleanPhone((string)($d['phone']??''));
    $email=cleanEmail((string)($d['email']??''));
    $school=cleanText($d['school']??'',180);
    $governorate=cleanText($d['governorate']??'',80);
    $grade='الثالث الثانوي — علمي علوم';
    $pass=(string)($d['password']??'');
    if($name==='') out(['ok'=>false,'error'=>'NAME_REQUIRED'],422);
    if(!validPhone($phone)) out(['ok'=>false,'error'=>'INVALID_PHONE'],422);
    if($email!=='' && !validEmail($email)) out(['ok'=>false,'error'=>'INVALID_EMAIL'],422);
    if(strlen($pass)<8) out(['ok'=>false,'error'=>'PASSWORD_SHORT'],422);
    if(strlen($pass)>200) out(['ok'=>false,'error'=>'PASSWORD_LONG'],422);
    $now=time(); $users=allUsers();
    foreach($users as $u){
      if(cleanPhone((string)($u['phone']??''))===$phone) out(['ok'=>false,'error'=>'PHONE_EXISTS'],409);
      if($email!=='' && cleanEmail((string)($u['email']??''))===$email) out(['ok'=>false,'error'=>'EMAIL_EXISTS'],409);
    }
    $id=nextId($users);
    $users[]=['id'=>$id,'email'=>$email,'email_verified'=>false,'phone'=>$phone,'school'=>$school,'governorate'=>$governorate,'grade'=>$grade,'password'=>password_hash($pass,PASSWORD_DEFAULT),'name'=>$name,'status'=>'active','state'=>'{}','created_at'=>$now,'updated_at'=>$now];
    writeUsers($users); session_regenerate_id(true); $_SESSION['uid']=$id; setRememberCookie(false);
    out(['ok'=>true,'authenticated'=>true,'user'=>['id'=>$id,'email'=>$email,'phone'=>$phone,'name'=>$name,'school'=>$school,'governorate'=>$governorate,'grade'=>$grade]]);
  }
  if ($action==='login' && $method==='POST') {
    $d=input(); $login=cleanText($d['login']??'',190);
    if($login==='') $login=cleanText($d['email']??'',190);
    $pass=(string)($d['password']??''); $u=findUserByLogin($login);
    if(!$u || !password_verify($pass,(string)$u['password'])) out(['ok'=>false,'error'=>'LOGIN_FAILED'],401);
    if(($u['status']??'active')!=='active') out(['ok'=>false,'error'=>'ACCOUNT_DISABLED'],403);
    if(password_needs_rehash((string)$u['password'],PASSWORD_DEFAULT)){
      $users=allUsers(); foreach($users as &$x) if((int)$x['id']===(int)$u['id']){$x['password']=password_hash($pass,PASSWORD_DEFAULT);$x['updated_at']=time();} unset($x); writeUsers($users); $u=findUserById((int)$u['id']);
    }
    $_SESSION['uid']=(int)$u['id']; session_regenerate_id(true); setRememberCookie(!empty($d['remember'])); out(['ok'=>true,'authenticated'=>true,'user'=>['id'=>(int)$u['id'],'email'=>$u['email']??'','phone'=>$u['phone']??'','name'=>$u['name']??'','school'=>$u['school']??'','governorate'=>$u['governorate']??'','grade'=>$u['grade']??'الثالث الثانوي — علمي علوم']]);
  }
  if ($action==='logout' && $method==='POST') { $_SESSION['uid']=null; setcookie(session_name(),'', ['expires'=>time()-3600,'httponly'=>true,'samesite'=>'Lax','secure'=>$https,'path'=>'/']); session_destroy(); out(['ok'=>true]); }
  if ($action==='profile' && $method==='GET') {
    $u=requireUser();
    out(['ok'=>true,'profile'=>['id'=>(int)$u['id'],'name'=>$u['name']??'','phone'=>$u['phone']??'','email'=>$u['email']??'','school'=>$u['school']??'','governorate'=>$u['governorate']??'','grade'=>$u['grade']??'الثالث الثانوي — علمي علوم','oauth_providers'=>array_values(array_keys($u['oauth']??[]))]]);
  }
  if ($action==='profile' && $method==='POST') {
    $u=requireUser(); $d=input();
    $name=cleanText($d['name']??$u['name']??'',160); $phone=cleanPhone((string)($d['phone']??$u['phone']??''));
    $email=cleanEmail((string)($d['email']??$u['email']??'')); $school=cleanText($d['school']??$u['school']??'',180); $gov=cleanText($d['governorate']??$u['governorate']??'',80);
    if($name==='') out(['ok'=>false,'error'=>'NAME_REQUIRED'],422);
    $socialAccount=($phone==='' && !empty($u['oauth']) && is_array($u['oauth']));
    if(($phone==='' && !$socialAccount)||($phone!=='' && !validPhone($phone))) out(['ok'=>false,'error'=>'INVALID_PHONE'],422);
    if($email!=='' && !validEmail($email)) out(['ok'=>false,'error'=>'INVALID_EMAIL'],422);
    $users=allUsers();
    foreach($users as $x){
      if((int)($x['id']??0)===(int)$u['id']) continue;
      if($phone!=='' && cleanPhone((string)($x['phone']??''))===$phone) out(['ok'=>false,'error'=>'PHONE_EXISTS'],409);
      if($email!=='' && cleanEmail((string)($x['email']??''))===$email) out(['ok'=>false,'error'=>'EMAIL_EXISTS'],409);
    }
    $updated=null; $now=time();
    foreach($users as &$x) if((int)$x['id']===(int)$u['id']){ if(cleanEmail((string)($x['email']??''))!==$email) $x['email_verified']=false; $x['name']=$name; $x['phone']=$phone; $x['email']=$email; $x['school']=$school; $x['governorate']=$gov; $x['updated_at']=$now; $updated=$x; break; } unset($x);
    if(!$updated) out(['ok'=>false,'error'=>'USER_NOT_FOUND'],404); writeUsers($users);
    out(['ok'=>true,'user'=>['id'=>(int)$updated['id'],'email'=>$updated['email']??'','phone'=>$updated['phone']??'','name'=>$updated['name']??'','school'=>$updated['school']??'','governorate'=>$updated['governorate']??'','grade'=>$updated['grade']??'الثالث الثانوي — علمي علوم','oauth_providers'=>array_values(array_keys($updated['oauth']??[]))]]);
  }
  if ($action==='state' && $method==='GET') {
    $u=requireUser(); $state=json_decode((string)($u['state'] ?? '{}'),true); if(!is_array($state)) $state=[];
    out(['ok'=>true,'state'=>$state,'updated'=>(int)($u['updated_at']??0)]);
  }
  if ($action==='state' && $method==='POST') {
    $u=requireUser(); $d=input(); $state=$d['state']??null;
    if(!is_array($state)) out(['ok'=>false,'error'=>'BAD_STATE'],422);
    $json=json_encode($state,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
    if($json===false || strlen($json)>5000000) out(['ok'=>false,'error'=>'STATE_TOO_LARGE'],413);
    $name=cleanText($state['name']??$u['name']??'',160); $now=time(); $users=allUsers();
    foreach($users as &$x){ if((int)$x['id']===(int)$u['id']){ $x['state']=$json; $x['name']=$name; $x['updated_at']=$now; } } unset($x); writeUsers($users);
    out(['ok'=>true,'updated'=>$now]);
  }
  // ========================= الدعم الفني =========================
  if ($action==='support_user' && $method==='GET') {
    $u=requireUser(); $t=ticketForUser((int)$u['id']);
    out(['ok'=>true,'ticket'=>$t?supportPublicTicket($t):null]);
  }
  if ($action==='support_create' && $method==='POST') {
    $u=requireUser(); $d=input(); $reason=cleanSupportText($d['reason']??'',2500);
    if($reason==='') out(['ok'=>false,'error'=>'SUPPORT_REASON_REQUIRED'],422);
    $data=allSupport(); $existing=ticketForUser((int)$u['id']);
    if($existing) out(['ok'=>true,'ticket'=>supportPublicTicket($existing),'already'=>true]);
    $now=time(); $id=(int)$data['next_id']++;
    $ticket=['id'=>$id,'user_id'=>(int)$u['id'],'user_name'=>cleanText($u['name']??'بدون اسم',160),'user_email'=>cleanEmail((string)($u['email']??'')),'user_phone'=>cleanPhone((string)($u['phone']??'')),'reason'=>$reason,'status'=>'open','created_at'=>$now,'updated_at'=>$now,'transferred_at'=>$now,
      'messages'=>[['id'=>1,'sender'=>'support','text'=>'أهلًا بيك 👋 وصلتني المشكلة. سجلت السبب وحوّلت طلبك للمشرف عشان يتابع معاك. ابعت أي تفاصيل إضافية هنا لو مهمة.','ts'=>$now]]];
    $data['tickets'][]=$ticket; writeSupport($data);
    out(['ok'=>true,'ticket'=>supportPublicTicket($ticket)]);
  }
  if ($action==='support_send' && $method==='POST') {
    $u=requireUser(); $d=input(); $text=cleanSupportText($d['text']??'',4000); $t=ticketForUser((int)$u['id']);
    if(!$t) out(['ok'=>false,'error'=>'SUPPORT_TICKET_NOT_FOUND'],404);
    if($text==='') out(['ok'=>false,'error'=>'SUPPORT_MESSAGE_REQUIRED'],422);
    $data=allSupport(); $now=time(); $changed=null;
    foreach($data['tickets'] as &$x){ if((int)$x['id']===(int)$t['id']){
      $maxId=0; foreach(($x['messages']??[]) as $m) $maxId=max($maxId,(int)($m['id']??0));
      $x['messages'][]=['id'=>$maxId+1,'sender'=>'user','text'=>$text,'ts'=>$now]; $x['status']='open'; $x['updated_at']=$now; $changed=$x; break;
    }} unset($x);
    if(!$changed) out(['ok'=>false,'error'=>'SUPPORT_TICKET_NOT_FOUND'],404);
    writeSupport($data); out(['ok'=>true,'ticket'=>supportPublicTicket($changed)]);
  }
  if ($action==='admin_support' && $method==='GET') {
    requireAdmin(); $data=allSupport(); $tickets=[];
    foreach($data['tickets'] as $t){
      $tickets[]= ['id'=>(int)($t['id']??0),'user_id'=>(int)($t['user_id']??0),'user_name'=>cleanText($t['user_name']??'بدون اسم',160),'user_email'=>cleanEmail((string)($t['user_email']??'')),'user_phone'=>cleanPhone((string)($t['user_phone']??'')),'reason'=>cleanSupportText($t['reason']??'',2500),'user_phone'=>cleanPhone((string)($t['user_phone']??'')),'status'=>(string)($t['status']??'open'),'created_at'=>(int)($t['created_at']??0),'updated_at'=>(int)($t['updated_at']??0),'transferred_at'=>(int)($t['transferred_at']??0),'messages'=>array_values(array_map(fn($m)=>['id'=>(int)($m['id']??0),'sender'=>(string)($m['sender']??'support'),'text'=>cleanSupportText($m['text']??'',4000),'ts'=>(int)($m['ts']??0)], $t['messages']??[]))];
    }
    usort($tickets,fn($a,$b)=>$b['updated_at']<=>$a['updated_at']);
    out(['ok'=>true,'tickets'=>$tickets]);
  }
  if ($action==='admin_support' && $method==='POST') {
    requireAdmin(); $d=input(); $id=(int)($d['id']??0); $mode=(string)($d['mode']??'reply');
    if($id<=0) out(['ok'=>false,'error'=>'SUPPORT_TICKET_REQUIRED'],422);
    $data=allSupport(); $now=time(); $found=false; $changed=null;
    foreach($data['tickets'] as &$t) if((int)($t['id']??0)===$id){
      $found=true;
      if($mode==='reply'){
        $text=cleanSupportText($d['text']??'',4000); if($text==='') out(['ok'=>false,'error'=>'SUPPORT_MESSAGE_REQUIRED'],422);
        $maxId=0; foreach(($t['messages']??[]) as $m) $maxId=max($maxId,(int)($m['id']??0));
        $t['messages'][]=['id'=>$maxId+1,'sender'=>'admin','text'=>$text,'ts'=>$now]; $t['status']='waiting_user'; $t['updated_at']=$now;
      } elseif($mode==='close'){ $t['status']='closed'; $t['updated_at']=$now; }
      elseif($mode==='open'){ $t['status']='open'; $t['updated_at']=$now; }
      else out(['ok'=>false,'error'=>'BAD_MODE'],422);
      $changed=$t; break;
    } unset($t);
    if(!$found) out(['ok'=>false,'error'=>'SUPPORT_TICKET_NOT_FOUND'],404);
    writeSupport($data); out(['ok'=>true,'ticket'=>supportPublicTicket($changed)]);
  }

  if ($action==='ai' && $method==='POST') {
    requireUser();
    $key=trim((string)($config['gemini_api_key']??'')); $model=trim((string)($config['gemini_model']??'gemini-2.0-flash'));
    if(!$key || str_contains($key,'ضع_مفتاح')) out(['ok'=>false,'error'=>'AI_NOT_CONFIGURED'],503);
    $d=input(); $messages=$d['messages']??[]; $context=$d['context']??'';
    if(!is_array($messages)) out(['ok'=>false,'error'=>'BAD_MESSAGES'],422);
    $contents=[];
    foreach(array_slice($messages,-12) as $m){ $role=($m['role']??'user')==='model'?'model':'user'; $text=trim((string)($m['content']??'')); if($text!=='') $contents[]=['role'=>$role,'parts'=>[['text'=>$text]]]; }
    if(!$contents) out(['ok'=>false,'error'=>'EMPTY_MESSAGE'],422);
    $system="أنت مدرس خصوصي لطالب في الصف الثالث الثانوي (علمي علوم) في مصر. اتكلم بالعامية المصرية البسيطة والمحترمة.\n".
      "اشرح بإيجاز وبخطوات، استخدم مثالًا واضحًا، وفي نهاية الرد اسأل سؤال فهم قصير. إذا طلب الطالب اختبارًا أنشئ 5 أسئلة اختيار من متعدد واذكر الإجابات بعد الأسئلة. لا تخترع معلومات خارج المنهج المصري، وإذا لم تكن متأكدًا قل ذلك بوضوح.\n".
      "سياق الطالب: ".substr((string)$context,0,3000);
    $payload=['systemInstruction'=>['parts'=>[['text'=>$system]]],'contents'=>$contents,'generationConfig'=>['temperature'=>0.35,'maxOutputTokens'=>1200]];
    $url='https://generativelanguage.googleapis.com/v1beta/models/'.rawurlencode($model).':generateContent';
    $ch=curl_init($url); curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_POST=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json','x-goog-api-key: '.$key],CURLOPT_POSTFIELDS=>json_encode($payload),CURLOPT_TIMEOUT=>45]);
    $body=curl_exec($ch); $code=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE); $err=curl_error($ch); curl_close($ch);
    if($body===false) out(['ok'=>false,'error'=>'AI_NETWORK','detail'=>$err],502);
    $j=json_decode($body,true); if($code<200||$code>=300) out(['ok'=>false,'error'=>'AI_PROVIDER','status'=>$code],502);
    $text=$j['candidates'][0]['content']['parts'][0]['text']??''; if(!$text) out(['ok'=>false,'error'=>'AI_EMPTY'],502); out(['ok'=>true,'text'=>$text]);
  }

  // ========================= لوحة المشرف =========================
  if ($action==='admin_me' && $method==='GET') out(['ok'=>true,'authenticated'=>!empty($_SESSION['admin_ok'])]);
  if ($action==='admin_login' && $method==='POST') {
    $d=input(); $code=(string)($d['code']??''); $expected=(string)($config['admin_code']??'');
    if($expected==='' || strlen($code)>100 || !hash_equals($expected,$code)){
      $_SESSION['admin_fail']=(int)($_SESSION['admin_fail']??0)+1;
      if($_SESSION['admin_fail']>=5) usleep(500000);
      out(['ok'=>false,'error'=>'ADMIN_LOGIN_FAILED'],401);
    }
    $_SESSION['admin_ok']=true; $_SESSION['admin_fail']=0;
    out(['ok'=>true,'authenticated'=>true,'name'=>(string)($config['admin_name']??'المشرف')]);
  }
  if ($action==='admin_logout' && $method==='POST') { $_SESSION['admin_ok']=null; $_SESSION['admin_fail']=0; out(['ok'=>true]); }
  if ($action==='admin_overview' && $method==='GET') {
    requireAdmin(); $users=allUsers(); $content=allContent();
    $summary=[];
    foreach($users as $u){
      $state=json_decode((string)($u['state']??'{}'),true); if(!is_array($state)) $state=[];
      $done=is_array($state['done']??null)?count(array_filter($state['done'])):0;
      $attempts=is_array($state['attempts']??null)?count($state['attempts']):0;
      $summary[]=['id'=>(int)($u['id']??0),'name'=>cleanText($u['name']??'',160),'email'=>cleanText($u['email']??'',190),'phone'=>cleanPhone((string)($u['phone']??'')),'school'=>cleanText($u['school']??'',180),'governorate'=>cleanText($u['governorate']??'',80),'grade'=>cleanText($u['grade']??'الثالث الثانوي — علمي علوم',80),'status'=>(($u['status']??'active')==='active'?'active':'disabled'),'created_at'=>(int)($u['created_at']??0),'updated_at'=>(int)($u['updated_at']??0),'done'=>$done,'attempts'=>$attempts];
    }
    usort($summary,fn($a,$b)=>$b['updated_at']<=>$a['updated_at']);
    out(['ok'=>true,'users'=>$summary,'content'=>$content,'admin_name'=>(string)($config['admin_name']??'المشرف')]);
  }
  if ($action==='admin_teacher' && $method==='POST') {
    requireAdmin(); $d=input(); $mode=(string)($d['mode']??'upsert'); $source=(string)($d['source']??'global'); $c=allContent();
    if($mode==='upsert'){
      $t=cleanTeacher(is_array($d['teacher']??null)?$d['teacher']:[]); $t['n'] && $t['s'] || out(['ok'=>false,'error'=>'TEACHER_REQUIRED'],422);
      if($source==='base'){
        if(!$t['id']) out(['ok'=>false,'error'=>'TEACHER_ID_REQUIRED'],422);
        $c['teacher_overrides'][$t['id']]=$t; $c['disabled_teachers']=array_values(array_diff($c['disabled_teachers'],[$t['id']]));
      } else {
        if(!$t['id']) $t['id']='adm_t_'.date('YmdHis').'_'.bin2hex(random_bytes(2));
        $found=false; foreach($c['teachers'] as &$x){ if((string)($x['id']??'')===$t['id']){$x=$t;$found=true;break;} } unset($x);
        if(!$found) $c['teachers'][]=$t;
      }
      writeContent($c); out(['ok'=>true,'teacher'=>$t,'content'=>$c]);
    }
    $id=cleanText($d['id']??'',120); if(!$id) out(['ok'=>false,'error'=>'TEACHER_ID_REQUIRED'],422);
    if($mode==='toggle'){
      if($source==='base'){
        if(in_array($id,$c['disabled_teachers'],true)) $c['disabled_teachers']=array_values(array_diff($c['disabled_teachers'],[$id])); else $c['disabled_teachers'][]=$id;
      } else {
        foreach($c['teachers'] as &$x) if((string)($x['id']??'')===$id){ $x['disabled']=empty($x['disabled']); } unset($x);
      }
      writeContent($c); out(['ok'=>true,'content'=>$c]);
    }
    if($mode==='delete'){
      if($source==='base'){
        $c['disabled_teachers']=array_values(array_unique(array_merge($c['disabled_teachers'],[$id]))); unset($c['teacher_overrides'][$id]);
      } else { $c['teachers']=array_values(array_filter($c['teachers'],fn($x)=>(string)($x['id']??'')!==$id)); }
      writeContent($c); out(['ok'=>true,'content'=>$c]);
    }
    out(['ok'=>false,'error'=>'BAD_MODE'],422);
  }
  if ($action==='admin_lesson' && $method==='POST') {
    requireAdmin(); $d=input(); $mode=(string)($d['mode']??'upsert'); $c=allContent();
    if($mode==='upsert'){
      $l=cleanLesson(is_array($d['lesson']??null)?$d['lesson']:[]); if(!$l['title']||!$l['sid']) out(['ok'=>false,'error'=>'LESSON_REQUIRED'],422);
      if(!$l['id']) $l['id']='adm_l_'.date('YmdHis').'_'.bin2hex(random_bytes(2));
      $found=false; foreach($c['lessons'] as &$x){ if((string)($x['id']??'')===$l['id']){$x=$l;$found=true;break;} } unset($x); if(!$found) $c['lessons'][]=$l;
      writeContent($c); out(['ok'=>true,'lesson'=>$l,'content'=>$c]);
    }
    $id=cleanText($d['id']??'',120); if(!$id) out(['ok'=>false,'error'=>'LESSON_ID_REQUIRED'],422);
    $c['lessons']=array_values(array_filter($c['lessons'],fn($x)=>(string)($x['id']??'')!==$id)); writeContent($c); out(['ok'=>true,'content'=>$c]);
  }
  if ($action==='admin_question' && $method==='POST') {
    requireAdmin(); $d=input(); $mode=(string)($d['mode']??'upsert'); $c=allContent();
    if($mode==='upsert'){
      $q=cleanQuestion(is_array($d['question']??null)?$d['question']:[]); if(!$q['q']||count($q['o'])<2||$q['a']>=count($q['o'])) out(['ok'=>false,'error'=>'QUESTION_REQUIRED'],422);
      if(!$q['id']) $q['id']='adm_q_'.date('YmdHis').'_'.bin2hex(random_bytes(2));
      $found=false; foreach($c['questions'] as &$x){ if((string)($x['id']??'')===$q['id']){$x=$q;$found=true;break;} } unset($x); if(!$found) $c['questions'][]=$q;
      writeContent($c); out(['ok'=>true,'question'=>$q,'content'=>$c]);
    }
    $id=cleanText($d['id']??'',120); if(!$id) out(['ok'=>false,'error'=>'QUESTION_ID_REQUIRED'],422);
    $c['questions']=array_values(array_filter($c['questions'],fn($x)=>(string)($x['id']??'')!==$id)); writeContent($c); out(['ok'=>true,'content'=>$c]);
  }
  if ($action==='admin_user' && $method==='POST') {
    requireAdmin(); $d=input(); $mode=(string)($d['mode']??''); $id=(int)($d['id']??0); if($id<=0) out(['ok'=>false,'error'=>'USER_ID_REQUIRED'],422);
    $users=allUsers(); $found=false;
    if($mode==='delete'){
      $users=array_values(array_filter($users,fn($u)=>(int)($u['id']??0)!==$id)); writeUsers($users); if((int)($_SESSION['uid']??0)===$id) $_SESSION['uid']=null; out(['ok'=>true]);
    }
    foreach($users as &$u) if((int)($u['id']??0)===$id){
      $found=true; if($mode==='toggle') $u['status']=($u['status']??'active')==='active'?'disabled':'active';
    } unset($u);
    if(!$found) out(['ok'=>false,'error'=>'USER_NOT_FOUND'],404);
    writeUsers($users); out(['ok'=>true]);
  }

  out(['ok'=>false,'error'=>'NOT_FOUND'],404);
} catch(Throwable $e) {
  $requestId=bin2hex(random_bytes(5));
  error_log('[mozakra-api] request='.$requestId.' action='.preg_replace('/[^a-z0-9_-]/i','',(string)$action).' error='.get_class($e).': '.$e->getMessage());
  $storageError=str_contains(strtolower($e->getMessage()),'blob') || str_contains(strtolower($e->getMessage()),'storage') || str_contains(strtolower($e->getMessage()),'persist');
  out(['ok'=>false,'error'=>$storageError?'STORAGE_UNAVAILABLE':'SERVER_ERROR','request_id'=>$requestId],$storageError?503:500);
}
