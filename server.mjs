import {secureCookies} from './runtime-config.mjs';
import {createShooterRooms,RoomError} from './shooter-rooms.mjs';
import {createAssetP2PBroker} from './p2p-broker.mjs';
const shooter=createShooterRooms(),p2p=createAssetP2PBroker();
import http from 'node:http';
import {createAccounts,AccountError} from './accounts.mjs';
const accounts=createAccounts(),authRates=new Map();
import {winningLine} from './game-rules.js';
import {readFile,readdir} from 'node:fs/promises';
import {gzip} from 'node:zlib';
import {promisify} from 'node:util';
const gzipAsync=promisify(gzip);
const staticCache=new Map();
import {randomUUID,randomBytes,createHash} from 'node:crypto';
const port=Number(process.env.PORT)||8000, sessions=new Map(), rooms=new Map(), limits=new Map(),p2pRates=new Map();
const files={'/so-do':['so-do.svg','image/svg+xml'],'/so-do.svg':['so-do.svg','image/svg+xml'],'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8'],'/favicon.svg':['favicon.svg','image/svg+xml']};
for(const game of ['runner','blocks','caro','chess']) files['/cover-'+game+'-v2.webp']=['cover-'+game+'-v2.webp','image/webp'];
for(const name of ['game-rules.js','games.js'])files['/'+name]=[name,'text/javascript; charset=utf-8'];
for(const name of ['runner','space'])files['/background-'+name+'-v2.webp']=['background-'+name+'-v2.webp','image/webp'];
for(const f of ['battle.js','battle-engine.js','battle-weapons.js','zombie-mode.js','performance-meter.js','battle-settings.js','beta-shop.js'])files['/'+f]=[f,'text/javascript; charset=utf-8'];
for(const f of ['battle.css','shop.css'])files['/'+f]=[f,'text/css; charset=utf-8'];
files['/battle']=['battle.html','text/html; charset=utf-8'];files['/shop']=['shop.html','text/html; charset=utf-8'];
files['/account']=['account.html','text/html; charset=utf-8'];
files['/account.js']=['account.js','text/javascript; charset=utf-8'];
files['/account.css']=['account.css','text/css; charset=utf-8'];
files['/fortnite-z']=['fortnite.html','text/html; charset=utf-8'];
for(const f of ['fortnite.js','fortnite-engine.js'])files['/'+f]=[f,'text/javascript; charset=utf-8'];
files['/fortnite.css']=['fortnite.css','text/css; charset=utf-8'];
for(const f of await readdir(new URL('fortnite-assets/',import.meta.url))){if(/^[a-zA-Z0-9_-]+\.(svg|json)$/.test(f))files['/fortnite-assets/'+f]=['fortnite-assets/'+f,f.endsWith('.svg')?'image/svg+xml':'application/json; charset=utf-8'];}
files['/rooms']=['rooms.html','text/html; charset=utf-8'];
 for(const f of ['rooms.js','shooter-client.js','network-motion.js','resource-sharing.js','resource-worker.js','resource-executor.js','admin-resource-client.js','p2p-assets.js'])files['/'+f]=[f,'text/javascript; charset=utf-8'];files['/rooms.css']=['rooms.css','text/css; charset=utf-8'];
files['/online.css']=['online.css','text/css; charset=utf-8'];
const P2P_ASSET=/^\/(?:fortnite-assets\/[A-Za-z0-9_-]+\.(?:svg|json)|cover-(?:runner|blocks|caro|chess)-v2\.webp|background-(?:runner|space)-v2\.webp)$/;
let p2pManifestPromise=null;
function assetManifest(){return p2pManifestPromise??=Promise.all(Object.entries(files).filter(([path])=>P2P_ASSET.test(path)).map(async([path,[file,type]])=>{const raw=await readFile(new URL(file,import.meta.url));return [path,{sha256:createHash('sha256').update(raw).digest('base64url'),bytes:raw.length,type}];})).then(entries=>({version:(process.env.RENDER_GIT_COMMIT||'dev').slice(0,12),assets:Object.fromEntries(entries)}));}
function allowP2P(id,op){const now=Date.now(),key=id+':'+op,limit=op==='admin-poll'?12:op==='client-poll'?180:120;let r=p2pRates.get(key);if(!r||now-r.at>60000){r={at:now,n:0};p2pRates.set(key,r);}return ++r.n<=limit;}
const games=new Set(['caro','chess','runner','blocks']);
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function roomView(r){return {code:r.code,title:r.title,game:r.game,match:r.match?{board:r.match.board,turn:r.match.turn,status:r.match.status,winner:r.match.winner,line:r.match.line,last:r.match.last}:null,members:[...r.members].map(id=>{const s=sessions.get(id);return {name:s?.name||'Người chơi',ready:s?.ready||false,host:r.host===id,role:r.match?.players.indexOf(id)===0?'X':r.match?.players.indexOf(id)===1?'O':null};})};}
function sharedLobby(){let online=0;for(const session of sessions.values())if(session.streams.size)online++;return {online,rooms:[...rooms.values()].map(r=>({code:r.code,title:r.title,game:r.game,count:r.members.size}))};}
function state(s,shared=sharedLobby()){return {online:shared.online,rooms:shared.rooms,me:{name:s.name,ready:s.ready,room:s.room,host:rooms.get(s.room)?.host===s.id,role:rooms.get(s.room)?.match?.players.indexOf(s.id)===0?'X':rooms.get(s.room)?.match?.players.indexOf(s.id)===1?'O':null},room:s.room&&rooms.has(s.room)?roomView(rooms.get(s.room)):null};}
function broadcast(){const shared=sharedLobby();for(const s of sessions.values()){const message='data: '+JSON.stringify(state(s,shared))+'\n\n';for(const stream of s.streams){if(stream.destroyed){s.streams.delete(stream);continue;}if(stream.writableLength>131072){stream.destroy();s.streams.delete(stream);continue;}stream.write(message);}}}
function leave(s){const r=rooms.get(s.room);if(r){if(r.match?.status==='playing'&&r.match.players.includes(s.id)){r.match.status='aborted';for(const id of r.members){const m=sessions.get(id);if(m)m.ready=false;}}r.members.delete(s.id);if(!r.members.size)rooms.delete(r.code);else if(r.host===s.id)r.host=[...r.members][0];}s.room=null;s.ready=false;}
const server=http.createServer(async(req,res)=>{try{
res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
const path=new URL(req.url,'http://localhost').pathname;
if(req.method==='GET'&&files[path]){const [file,type]=files[path];let cached=staticCache.get(file);if(!cached){const raw=await readFile(new URL(file,import.meta.url));cached={raw,gzip:null,gzipPromise:null,compressible:/text|json|svg/.test(type)&&raw.length>1024,etag:'"'+createHash('sha1').update(raw).digest('base64url')+'"'};staticCache.set(file,cached);}const wantsGzip=cached.compressible&&/\bgzip\b/.test(req.headers['accept-encoding']||'');const common={'Cache-Control':'no-cache','ETag':cached.etag,'Vary':'Accept-Encoding'};if(req.headers['if-none-match']===cached.etag){res.writeHead(304,common);res.end();return;}let body=cached.raw,zipped=false;if(wantsGzip){if(!cached.gzip){cached.gzipPromise??=gzipAsync(cached.raw).then(value=>cached.gzip=value).finally(()=>cached.gzipPromise=null);await cached.gzipPromise;}body=cached.gzip;zipped=true;}res.writeHead(200,{'Content-Type':type,...common,...(zipped?{'Content-Encoding':'gzip'}:{})});res.end(body);return;}
if(path==='/health'){send(res,200,{ok:true,version:'2.6.0-beta',build:(process.env.RENDER_GIT_COMMIT||'local').slice(0,12),branch:process.env.RENDER_GIT_BRANCH||'local',uptimeSec:Math.floor(process.uptime()),p2p:p2p.publicState()});return;}
if(!path.startsWith('/api/')){send(res,404,{error:'Không tìm thấy trang.'});return;}
if(req.method==='POST'&&(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host)){send(res,403,{error:'Yêu cầu không hợp lệ.'});return;}
if(/^\/api\/(auth|shop)\//.test(path)){
 const action=path.slice(5),read=['auth/me','shop/catalog'].includes(action);
 if(req.method!==(read?'GET':'POST')){send(res,405,{error:'Phương thức không được hỗ trợ.'});return;}
 const addr=req.socket.remoteAddress||'unknown',now=Date.now();
 for(const [k,v] of authRates)if(now-v.at>60000)authRates.delete(k);
 const rate=authRates.get(addr)||{at:now,n:0};authRates.set(addr,rate);
 if(++rate.n>100){send(res,429,{error:'Thao tác quá nhanh. Chờ một phút rồi thử lại.'});return;}
 let raw='',data={};if(!read){for await(const chunk of req){raw+=chunk;if(raw.length>4096){send(res,413,{error:'Nội dung quá dài.'});return;}}try{data=JSON.parse(raw||'{}');}catch{send(res,400,{error:'Dữ liệu không hợp lệ.'});return;}if(!data||typeof data!=='object'||Array.isArray(data)){send(res,400,{error:'Dữ liệu không hợp lệ.'});return;}}
 try{send(res,200,await accounts.handle(action,data,req,res));}catch(e){if(e instanceof AccountError){send(res,e.status,{error:e.message});return;}throw e;}return;
}
const cookie=/(?:^|;\s*)xa_session=([^;]+)/.exec(req.headers.cookie||'')?.[1];let s=sessions.get(cookie);
if(!s){if(sessions.size>=1500){send(res,503,{error:'Sảnh đang đầy, bạn thử lại sau nhé.'});return;}const id=randomUUID();s={id,name:'Người chơi '+randomBytes(2).toString('hex').toUpperCase(),room:null,ready:false,streams:new Set(),last:Date.now()};sessions.set(id,s);res.setHeader('Set-Cookie','xa_session='+id+'; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400'+(secureCookies()?'; Secure':''));}
s.last=Date.now();
if(path.startsWith('/api/p2p/')){
 const op=path.slice('/api/p2p/'.length);
 if(req.method!=='POST'){send(res,405,{error:'Phương thức không hỗ trợ.'});return;}
 if(!allowP2P(s.id,op)){send(res,429,{error:'P2P đang yêu cầu quá nhanh.'});return;}
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>16384){send(res,413,{error:'Nội dung P2P quá dài.'});return;}}
 let d;try{d=JSON.parse(raw||'{}');}catch{send(res,400,{error:'JSON không hợp lệ.'});return;}
 if(!d||typeof d!=='object'||Array.isArray(d)){send(res,400,{error:'Dữ liệu không hợp lệ.'});return;}
 try{
  if(op==='manifest')send(res,200,await assetManifest());
  else if(op==='client-connect')send(res,200,p2p.connect(s.id));
  else if(op==='client-poll')send(res,200,p2p.clientPoll(s.id,d));
  else if(op==='client-signal')send(res,200,p2p.signal('client',s.id,d));
  else if(op==='client-disconnect')send(res,200,p2p.disconnect('client',s.id,d));
  else if(op.startsWith('admin-')){
   if(op==='admin-register'){await accounts.requireAdmin(req,res);send(res,200,p2p.adminRegister(s.id,d.enabled!==false));}
   else if(op==='admin-poll')send(res,200,await p2p.adminWait(s.id,d.stats,18000));
   else if(op==='admin-signal')send(res,200,p2p.signal('admin',s.id,d));
   else if(op==='admin-disconnect')send(res,200,p2p.disconnect('admin',s.id,d));
   else send(res,404,{error:'Không tìm thấy thao tác P2P.'});
  }else send(res,404,{error:'Không tìm thấy thao tác P2P.'});
 }catch(e){if(e instanceof AccountError)send(res,e.status,{error:e.message});else throw e;}
 return;
}
if(path.startsWith('/api/shooter/')){
const op=path.slice('/api/shooter/'.length);try{
if(req.method==='GET'&&op==='events'){shooter.subscribe(s,res);return;}
if(req.method==='GET'&&op==='state'){send(res,200,shooter.command(s,'state'));return;}
if(req.method!=='POST'){send(res,405,{error:'Phương thức không hỗ trợ.'});return;}
let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>(op==='resource-result'||op==='admin-resource-result'?65536:4096)){send(res,413,{error:'Nội dung quá dài.'});return;}}
let d;try{d=JSON.parse(raw||'{}');}catch{send(res,400,{error:'JSON không hợp lệ.'});return;}if(!d||typeof d!=='object'||Array.isArray(d)){send(res,400,{error:'Dữ liệu không hợp lệ.'});return;}
if(op.startsWith('admin-')){await accounts.requireAdmin(req,res);send(res,200,shooter.command(s,op,d,{admin:true}));}else send(res,200,shooter.command(s,op,d));
}catch(e){if(e instanceof RoomError||e instanceof AccountError)send(res,e.status,{error:e.message});else throw e;}return;}
if(req.method==='GET'&&path==='/api/state'){send(res,200,state(s));return;}
if(req.method==='GET'&&path==='/api/events'){if(s.streams.size>=5){send(res,429,{error:'Bạn đang mở quá nhiều cửa sổ.'});return;}res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(': connected\n\n');s.streams.add(res);broadcast();req.on('close',()=>{s.streams.delete(res);s.last=Date.now();broadcast();});return;}
if(req.method!=='POST'){send(res,405,{error:'Phương thức không được hỗ trợ.'});return;}
const ip=s.id;const now=Date.now();let rate=limits.get(ip);if(!rate||now-rate.at>60000){rate={at:now,n:0};limits.set(ip,rate);}if(++rate.n>90){send(res,429,{error:'Thao tác hơi nhanh. Chờ một chút nhé.'});return;}
let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096){send(res,413,{error:'Nội dung quá dài.'});return;}}let data;try{data=JSON.parse(raw||'{}');}catch{send(res,400,{error:'Dữ liệu không hợp lệ.'});return;}
if(!data||typeof data!=='object'||Array.isArray(data)){send(res,400,{error:'Dữ liệu không hợp lệ.'});return;}
if(path==='/api/profile'){const name=String(data.name||'').trim().slice(0,24);if(!name){send(res,400,{error:'Nhập biệt danh của bạn nhé.'});return;}s.name=name;}
else if(path==='/api/rooms'){if(s.room){send(res,409,{error:'Hãy rời phòng hiện tại trước.'});return;}if(rooms.size>=100){send(res,503,{error:'Đã đủ phòng, bạn vào một phòng có sẵn nhé.'});return;}const game=games.has(data.game)?data.game:'caro';let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));const r={code,title:String(data.title||'Phòng của '+s.name).trim().slice(0,40),game,members:new Set([s.id]),host:s.id};rooms.set(code,r);s.room=code;s.ready=false;}
else if(path==='/api/join'){const code=String(data.code||'').trim().toUpperCase();const r=rooms.get(code);if(!r){send(res,404,{error:'Không tìm thấy phòng. Kiểm tra lại mã nhé.'});return;}if(s.room===code){send(res,200,state(s));return;}if(r.members.size>=8){send(res,409,{error:'Phòng đã đủ 8 người.'});return;}leave(s);r.members.add(s.id);s.room=code;}
else if(path==='/api/leave')leave(s);
else if(path==='/api/start'){
const r=rooms.get(s.room);if(!r||r.host!==s.id||r.game!=='caro'){send(res,403,{error:'Chỉ chủ phòng caro được mở ván.'});return;}
if(r.match?.status==='playing'){send(res,409,{error:'Ván đang diễn ra.'});return;}
const players=[...r.members].slice(0,2);if(players.length!==2||players.some(id=>!sessions.get(id)?.ready)){send(res,409,{error:'Hai người đầu phòng cần sẵn sàng. Người còn lại xem trận.'});return;}
r.match={players,board:Array(225).fill(null),turn:'X',status:'playing',winner:null,line:[],last:null};
}
else if(path==='/api/move'){
const r=rooms.get(s.room),m=r?.match;const role=m?.players.indexOf(s.id)===0?'X':m?.players.indexOf(s.id)===1?'O':null;
if(!m||m.status!=='playing'||!role||m.turn!==role){send(res,409,{error:'Chưa đến lượt của bạn hoặc ván đã kết thúc.'});return;}
const i=data.index;if(!Number.isInteger(i)||i<0||i>=225||m.board[i]){send(res,400,{error:'Ô cờ không hợp lệ.'});return;}
m.board[i]=role;m.last=i;m.line=winningLine(m.board,i);if(m.line.length){m.status='won';m.winner=role;}else if(m.board.every(Boolean))m.status='draw';else m.turn=role==='X'?'O':'X';
if(m.status!=='playing')for(const id of r.members)sessions.get(id).ready=false;
}
else if(path==='/api/ready'){if(rooms.get(s.room)?.match?.status==='playing'){send(res,409,{error:'Ván đang diễn ra.'});return;}if(!s.room){send(res,400,{error:'Bạn chưa vào phòng.'});return;}s.ready=!s.ready;}
else{send(res,404,{error:'Không tìm thấy thao tác.'});return;}
send(res,200,state(s));broadcast();
}catch(error){console.error(error.message);if(!res.headersSent)send(res,500,{error:'Có lỗi kết nối. Bạn thử lại nhé.'});else res.end();}});
setInterval(()=>{const now=Date.now();let changed=false;for(const [id,s]of sessions){for(const stream of s.streams){if(stream.destroyed){s.streams.delete(stream);continue;}if(stream.writableLength>131072){stream.destroy();s.streams.delete(stream);continue;}stream.write(': heartbeat\n\n');}if(!s.streams.size&&now-s.last>120000){leave(s);sessions.delete(id);changed=true;}}for(const [ip,r]of limits)if(now-r.at>60000)limits.delete(ip);for(const [key,r]of p2pRates)if(now-r.at>60000)p2pRates.delete(key);if(changed)broadcast();},20000).unref();
setInterval(()=>shooter.tick(.05),50).unref();
setInterval(()=>shooter.publish(),100).unref();
setInterval(()=>shooter.cleanup(),20000).unref();
setInterval(()=>p2p.cleanup(),10000).unref();
// Koyeb: keep sockets bounded, recover memory, and exit cleanly so the platform can restart.
server.keepAliveTimeout=65000;server.headersTimeout=66000;server.requestTimeout=30000;server.maxConnections=3000;
const MEMORY_LIMIT_MB=Number(process.env.MEMORY_LIMIT_MB)||512;
setInterval(()=>{const {rss,heapUsed}=process.memoryUsage(),mb=rss/1048576;if(mb>MEMORY_LIMIT_MB*.8){limits.clear();for(const [id,s]of sessions)if(!s.streams.size){leave(s);sessions.delete(id);}shooter.cleanup();globalThis.gc?.();console.warn('Memory high: '+Math.round(mb)+'MB RSS, heap '+Math.round(heapUsed/1048576)+'MB, trimmed idle sessions');}},15000).unref();
process.on('unhandledRejection',e=>console.error('Unhandled rejection',e));
process.on('uncaughtException',e=>{console.error('Fatal error',e);process.exit(1);});
let closing=false;const shutdown=()=>{if(closing)return;closing=true;console.log('Shutting down');server.close(()=>process.exit(0));server.closeAllConnections?.();setTimeout(()=>process.exit(0),8000).unref();};
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
server.listen(port,'0.0.0.0',()=>console.log('Xanh Arcade listening on '+port));



