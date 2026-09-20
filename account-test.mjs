import assert from 'node:assert/strict';
import {createAccounts} from './accounts.mjs';
const req={headers:{}},headers=new Map(),res={getHeader:k=>headers.get(k),setHeader:(k,v)=>headers.set(k,v)};
const off=createAccounts({url:'',key:''});assert.deepEqual(await off.handle('auth/me',{},req,res),{configured:false,account:null});await assert.rejects(off.handle('auth/signup',{},req,res),e=>e.status===503);
const profile={nickname:'Xanh',coins:300,equipped:{},owned:[],dailyAvailable:true};let calls=[];
const mock=async(url,options)=>{calls.push({url,options});let value={};if(url.includes('grant_type=password'))value={access_token:'test-access',refresh_token:'test-refresh',expires_in:3600};else if(url.endsWith('/user'))value={email:'test@example.com'};else if(url.includes('/rpc/'))value=profile;return new Response(JSON.stringify(value),{status:200});};
const auth=createAccounts({url:'https://example.supabase.co',key:'test-public',secure:true,fetchImpl:mock});
await assert.rejects(auth.handle('auth/signup',{email:'bad',nickname:'Xanh',password:'abcdefghij'},req,res),e=>e.status===400);
await assert.rejects(auth.handle('auth/signup',{email:'test@example.com',nickname:'Xanh',password:'short'},req,res),e=>e.status===400);
const login=await auth.handle('auth/login',{email:'test@example.com',password:'abcdefghij'},req,res);assert.equal(login.account.coins,300);assert(!JSON.stringify(login).includes('test-access'));assert(headers.get('Set-Cookie').every(c=>c.includes('HttpOnly')&&c.includes('Secure')&&c.includes('SameSite=Lax')));
const signed={headers:{cookie:'xa_access=test-access; xa_refresh=test-refresh'}};
await auth.handle('shop/equip',{itemId:'battle-cobalt',slot:'battle'},signed,res);assert(calls.at(-1).options.body.includes('battle-cobalt'));
await assert.rejects(auth.handle('shop/equip',{itemId:'x',slot:'admin'},signed,res),e=>e.status===400);
await auth.handle('auth/logout',{},signed,res);assert.equal((await auth.handle('auth/me',{},signed,res)).account,null);
console.log('PASS: unconfigured state, invalid signup, secure cookies, no token exposure, battle equipment, invalid slot, revoked logout. Mock provider only; live DB verification pending.');

const smtpFail=createAccounts({url:'https://example.supabase.co',key:'test',fetchImpl:async()=>new Response(JSON.stringify({error_code:'email_address_not_authorized',msg:'Email address not authorized'}),{status:400})});
await assert.rejects(smtpFail.handle('auth/signup',{email:'test@example.com',nickname:'Test',password:'abcdefghijk'},req,res),e=>e.message.includes('dịch vụ gửi email'));
