import {createAdminDonor} from './admin-resource-client.js';
import {createAdminAssetDonor} from './p2p-assets.js';
// Confirmation links may return tokens in the fragment. Login uses server cookies; never persist these tokens.
const confirmationReturned=location.hash.includes('access_token=');if(location.hash)history.replaceState(null,'',location.pathname+location.search);
const uiCache=new Map(),$=s=>{if(!uiCache.has(s))uiCache.set(s,document.querySelector(s));return uiCache.get(s);};let mode='login',account=null,catalog=[],adminUsers=[],adminUsersLoading=false;const donor=createAdminDonor(api,(message,running)=>{$('#donor-state').textContent=message;$('#donor-start').disabled=running;$('#donor-stop').disabled=!running;});
async function api(path,data){const r=await fetch('/api/'+path,{signal:AbortSignal.timeout(path==='p2p/admin-poll'?23000:10000),method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},...(data?{body:JSON.stringify(data)}:{})});let result;try{result=await r.json();}catch{throw Error('Không đọc được phản hồi. Thử tải lại trang nhé.');}if(!r.ok){const e=Error(result.error||'Không kết nối được tài khoản.');e.status=r.status;throw e;}return result;}
const fmtMb=b=>(Number(b||0)/1048576).toFixed(b>=104857600?1:2)+' MB';
function diagnoseP2P(stats){
 const failure=stats.lastFailure;if(!failure)return stats.connected?'P2P trực tiếp đang hoạt động.':'Chưa có lỗi ICE gần nhất.';
 const a=failure.admin||{},cl=failure.client||{},al=a.local||{},ar=a.remote||{},cll=cl.local||{},clr=cl.remote||{};
 const adminPublic=(al.srflx||0)+(al.relay||0)>0,clientPublic=(cll.srflx||0)+(cll.relay||0)>0,relay=(al.relay||0)+(ar.relay||0)+(cll.relay||0)+(clr.relay||0),iceErrors=(a.iceErrors||0)+(cl.iceErrors||0);
 if(iceErrors&&!adminPublic&&!clientPublic)return 'STUN/TURN phát sinh '+iceErrors+' lỗi và hai đầu không lấy được candidate công khai. Kiểm tra UDP/firewall/DNS hoặc dùng TURN qua TCP/TLS.';
 if(!adminPublic&&!clientPublic)return 'Cả Admin và client đều không lấy được candidate STUN/relay. Kiểm tra UDP/firewall hoặc cấu hình TURN.';
 if(!adminPublic)return 'Máy Admin không lấy được candidate công khai qua STUN. Có thể UDP/firewall/NAT đang chặn; TURN ngoài Render sẽ giúp ổn định.';
 if(!clientPublic)return 'Client không lấy được candidate công khai qua STUN. Mạng client/Cloud Browser có thể chặn WebRTC trực tiếp; cần TURN dự phòng.';
 if(!relay&&!stats.turnConfigured)return 'Hai đầu đều có STUN candidate nhưng ICE vẫn thất bại. Khả năng NAT/CGNAT hạn chế; nên cấu hình TURN bên ngoài Render.';
 if(stats.turnConfigured&&!relay)return 'TURN đã cấu hình nhưng chưa tạo được relay candidate. Kiểm tra URL/credential/firewall của dịch vụ TURN.';
 if(relay)return 'Đã có relay candidate nhưng kết nối vẫn thất bại. Kiểm tra TURN transport/credential và trạng thái ICE.';
 return 'ICE thất bại trước khi DataChannel mở. Xem trạng thái ICE hai đầu và thử TURN dự phòng.';
}
const assetDonor=createAdminAssetDonor(api,(message,running)=>{$('#bandwidth-state').textContent=message;$('#bandwidth-start').disabled=running;$('#bandwidth-stop').disabled=!running;},stats=>{$('#p2p-handshaking').textContent=stats.handshaking||0;$('#p2p-clients').textContent=(stats.connected||0)+(stats.maxClients?' / '+stats.maxClients:'');$('#p2p-failed').textContent=stats.connectionFailures||0;$('#p2p-served').textContent=fmtMb(stats.servedBytes);$('#p2p-origin').textContent=fmtMb(stats.originBytes);$('#p2p-saved').textContent=fmtMb(stats.savedBytes);$('#p2p-turn').textContent=stats.turnConfigured?'Đã cấu hình ('+(stats.turnMode||'TURN')+')':'Chưa cấu hình';$('#p2p-diagnosis').textContent=diagnoseP2P(stats);});
function status(t){$('#status').textContent=t;}
function renderAdminUsers(){
 const body=$('#admin-users-table tbody');if(!body)return;body.replaceChildren();
 for(const user of adminUsers){
  const row=body.insertRow(),name=row.insertCell(),mail=row.insertCell(),state=row.insertCell(),role=row.insertCell(),action=row.insertCell();
  name.textContent=user.nickname||'Người chơi';mail.textContent=user.email||'';state.textContent=user.confirmed?'Đã xác nhận':'Chưa xác nhận';
  const badge=document.createElement('span');badge.className='admin-badge';badge.textContent=user.isAdmin?(user.protected?'Admin gốc':'Admin'):'Người chơi';role.append(badge);
  if(user.isAdmin&&(user.protected||user.isSelf)){action.textContent=user.protected?'Được bảo vệ':'Tài khoản hiện tại';continue;}
  const button=document.createElement('button');button.type='button';button.textContent=user.isAdmin?'Thu hồi Admin':'Cấp Admin';button.disabled=!user.isAdmin&&!user.confirmed;
  button.onclick=()=>{const grant=!user.isAdmin,verb=grant?'cấp quyền Admin cho ':'thu hồi quyền Admin của ';if(!confirm('Xác nhận '+verb+(user.nickname||user.email)+'?'))return;run(button,async()=>{const result=await api(grant?'admin/grant':'admin/revoke',{userId:user.userId});adminUsers=result.users||[];renderAdminUsers();status(grant?'Đã cấp quyền Admin.':'Đã thu hồi quyền Admin.');});};
  action.append(button);
 }
 $('#admin-users-note').textContent=adminUsers.length+' tài khoản · '+adminUsers.filter(u=>u.isAdmin).length+' Admin.';
}
async function loadAdminUsers(force=false){
 if(account?.role!=='admin')return;if(adminUsersLoading)return;if(adminUsers.length&&!force){renderAdminUsers();return;}
 adminUsersLoading=true;$('#admin-users-note').textContent='Đang tải danh sách tài khoản…';
 try{const result=await api('admin/list');adminUsers=result.users||[];renderAdminUsers();}catch(e){$('#admin-users-note').textContent=e.message;}finally{adminUsersLoading=false;}
}
function render(){ $('#auth-panel').hidden=!!account;$('#profile').hidden=!account;$('#admin-panel').hidden=account?.role!=='admin';if(!account){adminUsers=[];return;}$('#welcome').textContent='Chào '+account.nickname+'!';$('#email').textContent=account.email;$('#coins').textContent=account.coins;$('#daily').disabled=!account.dailyAvailable;$('#daily').textContent=account.dailyAvailable?'Nhận 75 xu':'Đã nhận hôm nay';$('#rename').elements.nickname.value=account.nickname;$('#inventory').replaceChildren();for(const item of catalog){const article=document.createElement('article'),h=document.createElement('h3'),p=document.createElement('p'),b=document.createElement('button');h.textContent=item.name;p.textContent=item.description+' · '+item.price+' xu';const owned=account.owned.includes(item.id),active=account.equipped[item.slot]===item.id;b.textContent=active?'Đang dùng · Tháo':owned?'Trang bị':'Mua';b.onclick=()=>run(b,async()=>{const r=await api(owned?'shop/equip':'shop/buy',owned?{itemId:active?null:item.id,slot:item.slot}:{itemId:item.id});account=r.account;render();status(owned?'Đã cập nhật trang bị.':'Mua thành công. Bấm Trang bị để dùng.');});article.append(h,p,b);$('#inventory').append(article);}if(account.role==='admin')loadAdminUsers();}
async function run(button,fn){button.disabled=true;try{await fn();}catch(e){status(e.message);}finally{if(button.isConnected)button.disabled=false;if(account&&!account.dailyAvailable)$('#daily').disabled=true;}}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('#nickname-label').hidden=mode!=='signup';const form=$('#auth-form');form.elements.nickname.required=mode==='signup';form.elements.password.minLength=mode==='signup'?10:1;form.elements.password.autocomplete=mode==='signup'?'new-password':'current-password';form.querySelector('button').textContent=mode==='signup'?'Tạo nick':'Đăng nhập';$('#password-note').textContent=mode==='signup'?'Mật khẩu từ 10 đến 128 ký tự.':'Dùng email và mật khẩu đã đăng ký.';});
$('#auth-form').onsubmit=e=>{e.preventDefault();const f=e.currentTarget;run(f.querySelector('button'),async()=>{const r=await api('auth/'+mode,Object.fromEntries(new FormData(f)));f.elements.password.value='';account=r.account;render();status(account?'Đăng nhập thành công.':r.message);});};
$('#logout').onclick=e=>run(e.currentTarget,async()=>{donor.stop();assetDonor.stop();await api('auth/logout',{});account=null;render();status('Đã đăng xuất.');});
$('#daily').onclick=e=>run(e.currentTarget,async()=>{account=(await api('shop/daily',{})).account;render();status('Đã nhận 75 xu vào tài khoản.');});
$('#rename').onsubmit=e=>{e.preventDefault();const f=e.currentTarget;run(f.querySelector('button'),async()=>{account=(await api('auth/profile',{nickname:f.elements.nickname.value})).account;render();status('Đã lưu biệt danh.');});};
try{const [me,shop]=await Promise.all([api('auth/me'),api('shop/catalog')]);catalog=shop.catalog||[];if(!me.configured){status('Tạo nick đang chờ kích hoạt máy chủ. Bạn vẫn có thể chơi Battle BETA và dùng shop chơi khách.');}else{account=me.account;render();status(account?'Nick đã được kết nối.':confirmationReturned?'Email đã được xác nhận. Đăng nhập để vào nick.':'Đăng nhập hoặc tạo nick để lưu hồ sơ và đồ trực tuyến.');}}catch(e){status(e.message);}

for(const [id,enabled] of [['admin-enable',true],['admin-disable',false]])$( '#'+id).onclick=e=>run(e.currentTarget,async()=>{const r=await api('shooter/admin-boost',{enabled});status(r.adminBoostActive?'Đã bật hỗ trợ tài nguyên.':'Đã tắt hỗ trợ tài nguyên.');});

// Admin-only resource sharing monitor
const fmtRate=b=>b>=1048576?(b/1048576).toFixed(2)+' MB/s':b>=1024?(b/1024).toFixed(1)+' KB/s':Math.round(b)+' B/s',fmtRam=b=>b>=1048576?(b/1048576).toFixed(2)+' MB':b>=1024?(b/1024).toFixed(1)+' KB':Math.round(b)+' B';
function drawShare(history){const c=$('#share-chart'),x=c.getContext('2d'),W=c.width,H=c.height;x.clearRect(0,0,W,H);const cs=getComputedStyle(c);const maxCpu=Math.max(50,...history.map(h=>h.cpuMs)),maxB=Math.max(1e5,...history.map(h=>h.bytes));x.globalAlpha=.25;x.strokeStyle=cs.color;for(let i=1;i<4;i++){x.beginPath();x.moveTo(0,H*i/4);x.lineTo(W,H*i/4);x.stroke();}x.globalAlpha=1;
 const line=(key,max,color)=>{x.strokeStyle=color;x.lineWidth=2;x.beginPath();history.forEach((h,i)=>{const px=i/(history.length-1)*W,py=H-6-(h[key]/max)*(H-24);i?x.lineTo(px,py):x.moveTo(px,py);});x.stroke();};
 line('cpuMs',maxCpu,'#3ddc84');line('bytes',maxB,'#4aa3ff');x.font='12px sans-serif';x.fillStyle='#3ddc84';x.fillText('CPU (đỉnh '+maxCpu.toFixed(0)+' ms/s)',8,14);x.fillStyle='#4aa3ff';x.fillText('Dữ liệu tác vụ (đỉnh '+fmtRate(maxB)+')',200,14);x.fillStyle=cs.color;x.fillText('60 giây gần nhất',W-110,14);}
async function pollShare(){if(account?.role!=='admin'||$('#admin-panel').hidden)return;try{const r=await api('shooter/admin-resource-stats',{});const last=r.history.slice(-5),cpu=last.reduce((sum,h)=>sum+h.cpuMs,0)/last.length,bytes=last.reduce((sum,h)=>sum+h.bytes,0)/last.length,ram=r.hosts.reduce((sum,h)=>sum+(h.ramBytes||0),0),gpuReady=r.hosts.filter(h=>h.webgpu).length;
 const level=cpu<1?'Không chia sẻ':cpu<20?'Ít':cpu<60?'Vừa':'Nhiều';
 $('#share-level').textContent=(r.adminBoostActive?'Đang bật':'Đang tắt')+' · Mức chia sẻ CPU: '+level;$('#share-cpu').textContent=cpu.toFixed(1)+' ms tính toán/s';$('#share-ram').textContent=fmtRam(ram);$('#share-data').textContent=fmtRate(bytes);$('#share-gpu').textContent='Chưa dùng'+(gpuReady?' · '+gpuReady+' máy có WebGPU':'');$('#share-hosts').textContent=r.hosts.filter(h=>h.host).length+' / '+r.hosts.length;
 const t=$('#share-table');t.replaceChildren();const head=t.insertRow();for(const h of ['Người chơi','Luồng CPU','RAM máy','RAM cache task','WebGPU','CPU ms/s','Dữ liệu task','Ping','Mất gói','Tổng'])head.appendChild(Object.assign(document.createElement('th'),{textContent:h}));
 for(const h of r.hosts){const row=t.insertRow();for(const v of [h.name+(h.host?' ✓':''),h.cores,h.memoryGb?h.memoryGb+' GB':'?',fmtRam(h.ramBytes||0),h.webgpu?'Sẵn sàng · chưa dùng':'Không/ẩn',h.cpuMs.toFixed(1),fmtRate(h.bytes),h.rtt==null?'-':h.rtt.toFixed(0)+' ms',(h.packetLoss*100).toFixed(1)+'%',(h.totalCpuMs/1000).toFixed(1)+' s CPU · '+(h.totalBytes/1048576).toFixed(2)+' MB'])row.insertCell().textContent=v;}
 drawShare(r.history);}catch(e){$('#share-level').textContent=e.message;}}
setInterval(pollShare,2000);setTimeout(pollShare,500);


$('#admin-users-refresh').onclick=()=>loadAdminUsers(true);
$('#donor-start').onclick=()=>donor.start();$('#donor-stop').onclick=()=>donor.stop();$('#bandwidth-start').onclick=()=>assetDonor.start();$('#bandwidth-preload').onclick=e=>run(e.currentTarget,()=>assetDonor.preload());$('#bandwidth-stop').onclick=()=>assetDonor.stop();window.addEventListener('pagehide',()=>{donor.stop(false);assetDonor.stop(false);});
