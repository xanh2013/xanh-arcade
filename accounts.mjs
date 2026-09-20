import {catalog} from './shop-catalog.js';
import {createHash} from 'node:crypto';
export class AccountError extends Error{constructor(status,message){super(message);this.status=status;}}
const friendly={NOT_ENOUGH_COINS:'Chưa đủ xu. Nhận quà hằng ngày để tích thêm nhé.',ITEM_NOT_FOUND:'Vật phẩm không tồn tại.',ITEM_NOT_OWNED:'Bạn chưa sở hữu vật phẩm này.',INVALID_SLOT:'Loại trang bị không hợp lệ.',DAILY_ALREADY_CLAIMED:'Bạn đã nhận quà hôm nay. Quà mới mở lúc 07:00 giờ Việt Nam.',INVALID_NICKNAME:'Biệt danh cần từ 3 đến 24 ký tự.',AUTH_REQUIRED:'Bạn cần đăng nhập.'};
function cookie(req,name){try{return decodeURIComponent(new RegExp('(?:^|;\\s*)'+name+'=([^;]+)').exec(req.headers.cookie||'')?.[1]||'');}catch{return '';}}
function email(value){if(typeof value!=='string'||value.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(value.trim()))throw new AccountError(400,'Nhập email hợp lệ nhé.');return value.trim().toLowerCase();}
function nickname(value){if(typeof value!=='string')throw new AccountError(400,friendly.INVALID_NICKNAME);const n=value.trim().replace(/[\x00-\x1f\x7f]/g,'');if(n.length<3||n.length>24)throw new AccountError(400,friendly.INVALID_NICKNAME);return n;}
export function createAccounts({url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY,secure=Boolean(process.env.RENDER),fetchImpl=fetch}={}){
 const configured=Boolean(url&&key);const refreshes=new Map(),revoked=new Map();
 if(configured&&new URL(url).protocol!=='https:')throw Error('SUPABASE_URL must use HTTPS');
 function cookies(res,tokens){const old=res.getHeader('Set-Cookie')||[];const values=Array.isArray(old)?old:[old];const tail='; HttpOnly; SameSite=Lax; Path=/api'+(secure?'; Secure':'');for(const [name,value,age]of [['xa_access',tokens?.access_token,tokens?Math.min(tokens.expires_in||3600,3600):0],['xa_refresh',tokens?.refresh_token,tokens?2592000:0]])values.push(name+'='+encodeURIComponent(value||'')+'; Max-Age='+age+tail);res.setHeader('Set-Cookie',values);}
 async function remote(path,{token,method='POST',data}={}){
  let response;try{response=await fetchImpl(url.replace(/\/$/,'')+path,{method,headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(12000)});}catch{throw new AccountError(503,'Chưa kết nối được tài khoản. Bạn thử lại sau nhé.');}
  let body;try{body=await response.json();}catch{body={};}
  if(!response.ok){const raw=body.message||body.msg||body.error_description||body.error||'';let message=Object.entries(friendly).find(([code])=>raw.includes(code))?.[1];if(!message){if(body.error_code==='email_address_not_authorized'||raw.toLowerCase().includes('email address not authorized'))message='Dịch vụ email xác nhận chưa mở cho người chơi bên ngoài. Quản trị viên cần kết nối dịch vụ gửi email.';else if(response.status===429)message='Thao tác quá nhanh. Chờ một chút rồi thử lại.';else if(raw.includes('Email not confirmed'))message='Hãy xác nhận email trước khi đăng nhập.';else if(response.status===400||response.status===401||response.status===403)message='Thông tin đăng nhập hoặc mã xác nhận chưa đúng.';else message='Dịch vụ tài khoản chưa sẵn sàng. Vui lòng thử lại sau.';}throw new AccountError(response.status>=500?503:response.status,message);}
  return body;
 }
 function revokedToken(token){return revoked.has(createHash('sha256').update(token).digest('hex'));}
 function revoke(token){if(token)revoked.set(createHash('sha256').update(token).digest('hex'),Date.now()+3600000);for(const [k,t]of revoked)if(t<Date.now())revoked.delete(k);}
 async function context(req,res){let token=cookie(req,'xa_access');if(token&&revokedToken(token))throw new AccountError(401,friendly.AUTH_REQUIRED);if(token){try{return {token,user:await remote('/auth/v1/user',{method:'GET',token})};}catch(e){if(e.status!==401&&e.status!==403)throw e;}}
  const refresh=cookie(req,'xa_refresh');if(!refresh)throw new AccountError(401,friendly.AUTH_REQUIRED);
  try{const id=createHash('sha256').update(refresh).digest('hex');let pending=refreshes.get(id);if(!pending){pending=remote('/auth/v1/token?grant_type=refresh_token',{data:{refresh_token:refresh}});refreshes.set(id,pending);pending.finally(()=>{const timer=setTimeout(()=>refreshes.delete(id),10000);timer.unref?.();}).catch(()=>{});}const tokens=await pending;if(!tokens.access_token||!tokens.refresh_token)throw new AccountError(401,friendly.AUTH_REQUIRED);cookies(res,tokens);token=tokens.access_token;return {token,user:await remote('/auth/v1/user',{method:'GET',token})};}catch(e){if(e.status===400||e.status===401||e.status===403){cookies(res,null);throw new AccountError(401,'Phiên đã hết hạn. Đăng nhập lại nhé.');}throw e;}
 }
 async function account(ctx){const profile=await remote('/rest/v1/rpc/xa_account',{token:ctx.token,data:{}});return {...profile,email:ctx.user.email};}
 async function handle(path,data,req,res){
  if(path==='shop/catalog'){if(!configured)return {configured:false,catalog};return {configured:true,catalog:await remote('/rest/v1/xa_catalog?select=id,slot,name,description,price,variant&order=price.asc',{method:'GET'})};}
  if(!configured){if(path==='auth/me')return {configured:false,account:null};throw new AccountError(503,'Tính năng tài khoản đang chờ kết nối. Bạn vẫn có thể chơi game và xem shop.');}
  if(path==='auth/signup'){const address=email(data.email),name=nickname(data.nickname);if(typeof data.password!=='string'||data.password.length<10||data.password.length>128)throw new AccountError(400,'Mật khẩu cần từ 10 đến 128 ký tự.');const tokens=await remote('/auth/v1/signup',{data:{email:address,password:data.password,data:{nickname:name}}});if(tokens.access_token&&tokens.refresh_token){const result=await account({token:tokens.access_token,user:await remote('/auth/v1/user',{method:'GET',token:tokens.access_token})});cookies(res,tokens);return {configured:true,account:result};}return {configured:true,account:null,verificationRequired:true,message:'Kiểm tra email để xác nhận nick. Sau đó quay lại đăng nhập.'};}
  if(path==='auth/login'){
   if(typeof data.password!=='string'||!data.password||data.password.length>128)throw new AccountError(400,'Nhập email và mật khẩu hợp lệ.');
   const tokens=await remote('/auth/v1/token?grant_type=password',{data:{email:email(data.email),password:data.password}});
   if(!tokens.access_token||!tokens.refresh_token)throw new AccountError(401,'Không tạo được phiên đăng nhập.');
   const ctx={token:tokens.access_token,user:await remote('/auth/v1/user',{method:'GET',token:tokens.access_token})};
   const result=await account(ctx);cookies(res,tokens);return {configured:true,account:result};
  }
  if(path==='auth/verify'){
   if(typeof data.token!=='string'||!/^\d{6,10}$/.test(data.token))throw new AccountError(400,'Nhập mã xác nhận trong email.');
   const tokens=await remote('/auth/v1/verify',{data:{email:email(data.email),token:data.token,type:'signup'}});
   if(!tokens.access_token||!tokens.refresh_token)throw new AccountError(401,'Không xác nhận được nick.');
   const result=await account({token:tokens.access_token,user:await remote('/auth/v1/user',{method:'GET',token:tokens.access_token})});cookies(res,tokens);return {configured:true,account:result};
  }
  if(path==='auth/logout'){
   const access=cookie(req,'xa_access');let ctx;try{ctx=await context(req,res);}catch(e){if(e.status!==401)throw e;}
   if(ctx){await remote('/auth/v1/logout?scope=local',{token:ctx.token});revoke(ctx.token);}revoke(access);cookies(res,null);return {configured:true,account:null};
  }
  let ctx;try{ctx=await context(req,res);}catch(e){if(path==='auth/me'&&e.status===401)return {configured:true,account:null};throw e;}
  if(path==='auth/me')return {configured:true,account:await account(ctx)};
  const procedures={'shop/buy':['xa_purchase',{p_item_id:data.itemId}],'shop/equip':['xa_equip',{p_item_id:data.itemId??null,p_slot:data.slot}],'shop/daily':['xa_daily',{}],'auth/profile':['xa_rename',{p_nickname:path==='auth/profile'?nickname(data.nickname):''}]};
  const proc=procedures[path];if(!proc)throw new AccountError(404,'Không tìm thấy thao tác.');
  if(path==='shop/buy'&&(typeof data.itemId!=='string'||data.itemId.length>60))throw new AccountError(400,'Vật phẩm không hợp lệ.');
  if(path==='shop/equip'&&(!['runner','paddle','board','avatar','battle'].includes(data.slot)||(data.itemId!==null&&(typeof data.itemId!=='string'||data.itemId.length>60))))throw new AccountError(400,'Trang bị không hợp lệ.');
  const profile=await remote('/rest/v1/rpc/'+proc[0],{token:ctx.token,data:proc[1]});return {configured:true,account:{...profile,email:ctx.user.email}};
 }
 return {configured,handle};
}
