import assert from 'node:assert/strict';
import {createAccounts} from './accounts.mjs';
const req={headers:{}},headers=new Map(),res={getHeader:k=>headers.get(k),setHeader:(k,v)=>headers.set(k,v)};
const off=createAccounts({url:'',key:''});assert.deepEqual(await off.handle('auth/me',{},req,res),{configured:false,account:null});await assert.rejects(off.handle('auth/signup',{},req,res),e=>e.status===503);
const profile={nickname:'Xanh',coins:300,equipped:{},owned:[],dailyAvailable:true},adminDirectory=[{userId:'11111111-1111-4111-8111-111111111111',email:'test@example.com',nickname:'Xanh',isAdmin:true,protected:true,isSelf:true,confirmed:true},{userId:'22222222-2222-4222-8222-222222222222',email:'player@example.com',nickname:'Player',isAdmin:false,protected:false,isSelf:false,confirmed:true}];let calls=[];
const mock=async(url,options)=>{calls.push({url,options});let value={};if(url.includes('grant_type=password'))value={access_token:'test-access',refresh_token:'test-refresh',expires_in:3600};else if(url.endsWith('/user'))value={email:'test@example.com',email_confirmed_at:'2026-09-29T00:00:00Z'};else if(url.includes('/rpc/xa_is_admin'))value=true;else if(url.includes('/rpc/xa_admin_directory'))value=adminDirectory;else if(url.includes('/rpc/xa_admin_grant'))value=adminDirectory.map(x=>x.userId.startsWith('2222')?{...x,isAdmin:true}:x);else if(url.includes('/rpc/xa_admin_revoke'))value=adminDirectory;else if(url.includes('/rpc/'))value=profile;return new Response(JSON.stringify(value),{status:200});};
const auth=createAccounts({url:'https://example.supabase.co',key:'test-public',secure:true,fetchImpl:mock});
await assert.rejects(auth.handle('auth/signup',{email:'bad',nickname:'Xanh',password:'abcdefghij'},req,res),e=>e.status===400);
await assert.rejects(auth.handle('auth/signup',{email:'test@example.com',nickname:'Xanh',password:'short'},req,res),e=>e.status===400);
const login=await auth.handle('auth/login',{email:'test@example.com',password:'abcdefghij'},req,res);assert.equal(login.account.coins,300);assert.equal(login.account.role,'admin');assert(!JSON.stringify(login).includes('test-access'));assert(headers.get('Set-Cookie').every(c=>c.includes('HttpOnly')&&c.includes('Secure')&&c.includes('SameSite=Lax')));
const signed={headers:{cookie:'xa_access=test-access; xa_refresh=test-refresh'}};
await auth.handle('shop/equip',{itemId:'battle-cobalt',slot:'battle'},signed,res);assert(calls.at(-1).options.body.includes('battle-cobalt'));
const admins=await auth.handle('admin/list',{},signed,res);assert.equal(admins.users.length,2);assert.equal(admins.users[0].protected,true);
const granted=await auth.handle('admin/grant',{userId:'22222222-2222-4222-8222-222222222222'},signed,res);assert.equal(granted.users[1].isAdmin,true);assert(calls.at(-1).options.body.includes('22222222-2222-4222-8222-222222222222'));
await assert.rejects(auth.handle('admin/grant',{userId:'bad-id'},signed,res),e=>e.status===400);
await assert.rejects(auth.handle('shop/equip',{itemId:'x',slot:'admin'},signed,res),e=>e.status===400);
await auth.handle('auth/logout',{},signed,res);assert.equal((await auth.handle('auth/me',{},signed,res)).account,null);

const nonAdminMock=async(url,options)=>{if(url.endsWith('/user'))return new Response(JSON.stringify({email:'player@example.com',email_confirmed_at:'2026-09-29T00:00:00Z'}),{status:200});if(url.includes('/rpc/xa_is_admin'))return new Response('false',{status:200});if(url.includes('/rpc/xa_account'))return new Response(JSON.stringify(profile),{status:200});return new Response(JSON.stringify({}),{status:200});};
const nonAdmin=createAccounts({url:'https://example.supabase.co',key:'test-public',fetchImpl:nonAdminMock});await assert.rejects(nonAdmin.handle('admin/list',{},signed,res),e=>e.status===403);
console.log('PASS: auth, live admin registry, grant validation, non-admin denial, secure cookies, shop equipment and revoked logout.');

const smtpFail=createAccounts({url:'https://example.supabase.co',key:'test',fetchImpl:async()=>new Response(JSON.stringify({error_code:'email_address_not_authorized',msg:'Email address not authorized'}),{status:400})});
await assert.rejects(smtpFail.handle('auth/signup',{email:'test@example.com',nickname:'Test',password:'abcdefghijk'},req,res),e=>e.message.includes('dịch vụ gửi email'));
