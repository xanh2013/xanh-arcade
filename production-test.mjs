import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const port=3207,base='http://127.0.0.1:'+port,build='abcdef1234567890';
const server=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),env:{...process.env,PORT:String(port),RENDER_GIT_COMMIT:build,RENDER_GIT_BRANCH:'main',P2P_TURN_URLS:'turn:turn.example.test:3478',P2P_TURN_SECRET:'unit-test-secret'},stdio:['ignore','pipe','pipe']});
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),6000);server.once('error',reject);server.once('exit',code=>reject(Error('Server exited '+code)));server.stdout.on('data',data=>{if(String(data).includes('listening')){clearTimeout(timer);resolve();}});});
 const healthRes=await fetch(base+'/health');assert.equal(healthRes.status,200);const health=await healthRes.json();assert.equal(health.ok,true);assert.equal(health.version,'2.8.0-beta');assert.equal(health.build,build.slice(0,12));assert.equal(health.branch,'main');assert.equal(typeof health.p2p.available,'boolean');assert.equal(typeof health.p2p.connectionFailures,'number');assert.equal(typeof health.resource.adminDonors,'number');assert.equal(typeof health.resource.recentCpuMs,'number');assert.equal(typeof health.resource.ramCacheBytes,'number');assert.ok(health.uptimeSec>=0);
 for(const path of ['/sw.js','/pwa.js','/manifest.webmanifest']){const r=await fetch(base+path);assert.equal(r.status,200,path);assert.ok((await r.text()).length>100,path);}
 const manifest=await (await fetch(base+'/manifest.webmanifest')).json();assert.equal(manifest.name,'Xanh Arcade');assert.equal(manifest.display,'standalone');
 const compressed=await fetch(base+'/app.js',{headers:{'Accept-Encoding':'br'}});assert.equal(compressed.status,200);assert.equal(compressed.headers.get('content-encoding'),'br');assert.ok((await compressed.text()).includes('Xanh'));
 const security=await fetch(base+'/');assert.equal(security.headers.get('x-content-type-options'),'nosniff');assert.equal(security.headers.get('x-frame-options'),'DENY');assert.ok(security.headers.get('content-security-policy').includes("img-src 'self' data: blob:"));assert.ok(security.headers.get('permissions-policy').includes('camera=()'));
 const iceRes=await fetch(base+'/api/p2p/ice',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});assert.equal(iceRes.status,200);const ice=await iceRes.json();assert.equal(ice.turnConfigured,true);assert.equal(ice.mode,'ephemeral');assert.equal(ice.iceServers.length,2);assert.ok(String(ice.iceServers[1].urls).includes('turn.example.test'));assert.ok(/^\d+:xanh$/.test(ice.iceServers[1].username));assert.ok(ice.iceServers[1].credential.length>10);assert.equal(JSON.stringify(ice).includes('unit-test-secret'),false);
 const p2pRes=await fetch(base+'/api/p2p/manifest',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});assert.equal(p2pRes.status,200);const p2p=await p2pRes.json();assert.equal(p2p.version,build.slice(0,12));const path='/fortnite-assets/cover.svg',raw=await readFile(new URL('.'+path,import.meta.url)),hash=createHash('sha256').update(raw).digest('base64url');assert.equal(p2p.assets[path].sha256,hash);assert.equal(p2p.assets[path].bytes,raw.length);
 console.log('PASS production: build health, PWA routes, Brotli, security headers and P2P SHA-256 manifest.');
}finally{server.kill();}
