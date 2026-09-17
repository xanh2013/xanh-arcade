import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
const port=Number(process.env.PORT)||3000, sessions=new Map(), rooms=new Map(), limits=new Map();
const files={'/so-do':['so-do.svg','image/svg+xml'],'/so-do.svg':['so-do.svg','image/svg+xml'],'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8'],'/favicon.svg':['favicon.svg','image/svg+xml']};
const games=new Set(['caro','chess','runner','blocks']);
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function roomView(r){return {code:r.code,title:r.title,game:r.game,members:[...r.members].map(id=>{const s=sessions.get(id);return {name:s?.name||'Người chơi',ready:s?.ready||false,host:r.host===id};})};}
function state(s){return {online:[...sessions.values()].filter(x=>x.streams.size).length,rooms:[...rooms.values()].map(r=>({code:r.code,title:r.title,game:r.game,count:r.members.size})),me:{name:s.name,ready:s.ready,room:s.room},room:s.room&&rooms.has(s.room)?roomView(rooms.get(s.room)):null};}
function broadcast(){for(const s of sessions.values()){const message='data: '+JSON.stringify(state(s))+'\n\n';for(const stream of s.streams)stream.write(message);}}
function leave(s){const r=rooms.get(s.room);if(r){r.members.delete(s.id);if(!r.members.size)rooms.delete(r.code);else if(r.host===s.id)r.host=[...r.members][0];}s.room=null;s.ready=false;}
const server=http.createServer(async(req,res)=>{try{
res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'");
const path=new URL(req.url,'http://localhost').pathname;
if(req.method==='GET'&&files[path]){const [file,type]=files[path];res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache'});res.end(await readFile(new URL(file,import.meta.url)));return;}
if(path==='/health'){send(res,200,{ok:true});return;}
if(!path.startsWith('/api/')){send(res,404,{error:'Không tìm thấy trang.'});return;}
if(req.method==='POST'&&(!req.headers.origin||new URL(req.headers.origin).host!==req.headers.host)){send(res,403,{error:'Yêu cầu không hợp lệ.'});return;}
const cookie=/(?:^|;\s*)xa_session=([^;]+)/.exec(req.headers.cookie||'')?.[1];let s=sessions.get(cookie);
if(!s){if(sessions.size>=1500){send(res,503,{error:'Sảnh đang đầy, bạn thử lại sau nhé.'});return;}const id=randomUUID();s={id,name:'Người chơi '+randomBytes(2).toString('hex').toUpperCase(),room:null,ready:false,streams:new Set(),last:Date.now()};sessions.set(id,s);res.setHeader('Set-Cookie','xa_session='+id+'; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400'+(process.env.RENDER?'; Secure':''));}
s.last=Date.now();
if(req.method==='GET'&&path==='/api/state'){send(res,200,state(s));return;}
if(req.method==='GET'&&path==='/api/events'){if(s.streams.size>=5){send(res,429,{error:'Bạn đang mở quá nhiều cửa sổ.'});return;}res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(': connected\n\n');s.streams.add(res);broadcast();req.on('close',()=>{s.streams.delete(res);s.last=Date.now();broadcast();});return;}
if(req.method!=='POST'){send(res,405,{error:'Phương thức không được hỗ trợ.'});return;}
const ip=req.socket.remoteAddress;const now=Date.now();let rate=limits.get(ip);if(!rate||now-rate.at>60000){rate={at:now,n:0};limits.set(ip,rate);}if(++rate.n>90){send(res,429,{error:'Thao tác hơi nhanh. Chờ một chút nhé.'});return;}
let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096){send(res,413,{error:'Nội dung quá dài.'});return;}}let data;try{data=JSON.parse(raw||'{}');}catch{send(res,400,{error:'Dữ liệu không hợp lệ.'});return;}
if(!data||typeof data!=='object'||Array.isArray(data)){send(res,400,{error:'Dữ liệu không hợp lệ.'});return;}
if(path==='/api/profile'){const name=String(data.name||'').trim().slice(0,24);if(!name){send(res,400,{error:'Nhập biệt danh của bạn nhé.'});return;}s.name=name;}
else if(path==='/api/rooms'){if(s.room){send(res,409,{error:'Hãy rời phòng hiện tại trước.'});return;}if(rooms.size>=100){send(res,503,{error:'Đã đủ phòng, bạn vào một phòng có sẵn nhé.'});return;}const game=games.has(data.game)?data.game:'caro';let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));const r={code,title:String(data.title||'Phòng của '+s.name).trim().slice(0,40),game,members:new Set([s.id]),host:s.id};rooms.set(code,r);s.room=code;s.ready=false;}
else if(path==='/api/join'){const code=String(data.code||'').trim().toUpperCase();const r=rooms.get(code);if(!r){send(res,404,{error:'Không tìm thấy phòng. Kiểm tra lại mã nhé.'});return;}if(s.room===code){send(res,200,state(s));return;}if(r.members.size>=8){send(res,409,{error:'Phòng đã đủ 8 người.'});return;}leave(s);r.members.add(s.id);s.room=code;}
else if(path==='/api/leave')leave(s);
else if(path==='/api/ready'){if(!s.room){send(res,400,{error:'Bạn chưa vào phòng.'});return;}s.ready=!s.ready;}
else{send(res,404,{error:'Không tìm thấy thao tác.'});return;}
send(res,200,state(s));broadcast();
}catch(error){console.error(error.message);if(!res.headersSent)send(res,500,{error:'Có lỗi kết nối. Bạn thử lại nhé.'});else res.end();}});
setInterval(()=>{const now=Date.now();let changed=false;for(const [id,s]of sessions){for(const stream of s.streams)stream.write(': heartbeat\n\n');if(!s.streams.size&&now-s.last>120000){leave(s);sessions.delete(id);changed=true;}}for(const [ip,r]of limits)if(now-r.at>60000)limits.delete(ip);if(changed)broadcast();},20000).unref();
server.listen(port,'0.0.0.0',()=>console.log('Xanh Arcade listening on '+port));
