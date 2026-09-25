import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const port=3197,base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),5000);server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)));server.stdout.on('data',data=>{if(String(data).includes('listening')){clearTimeout(timer);resolve();}});});
 for(const path of ['/battle?mode=zombie','/rooms?game=battle&ruleset=zombie','/battle-weapons.js','/zombie-mode.js','/performance-meter.js']){const r=await fetch(base+path);assert.equal(r.status,200,path);assert.ok((await r.text()).length>100);}
 const state=await fetch(base+'/api/shooter/state');const cookie=state.headers.get('set-cookie').split(';')[0];
 const post=async(op,body)=>{const r=await fetch(base+'/api/shooter/'+op,{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 const create=await post('create',{game:'battle',ruleset:'zombie',mode:'squad',difficulty:'easy'});assert.equal(create.status,200);assert.equal(create.data.room.ruleset,'zombie');assert.equal(create.data.room.bots,3);
 const start=await post('start',{});assert.equal(start.status,200);assert.equal(start.data.room.locked,true);
 const locked=await post('settings',{mode:'solo',difficulty:'hard',ruleset:'zombie'});assert.equal(locked.status,409);
 const abort=new AbortController(),r=await fetch(base+'/api/shooter/events',{headers:{Cookie:cookie},signal:abort.signal});const reader=r.body.getReader();let text='';for(let i=0;i<5&&!text.includes('event: match');i++)text+=new TextDecoder().decode((await reader.read()).value);const match=JSON.parse(text.split('event: match\ndata: ')[1].split('\n\n')[0]);assert.equal(match.mode,'zombie');assert.equal(match.actors.filter(a=>!a.zombie&&a.bot).length,3);assert.equal(match.zombie.totalWaves,8);abort.abort();
 console.log('PASS HTTP: new asset routes, Zombie create/start, 3 ally bots, locked settings, SSE match snapshot.');
}finally{server.kill();}
