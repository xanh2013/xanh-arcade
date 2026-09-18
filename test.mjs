import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {winningLine,overlaps,brickHit} from './game-rules.js';
const server=spawn(process.execPath,['server.mjs'],{cwd:new URL('.',import.meta.url),env:{...process.env,PORT:'3187'},stdio:['ignore','pipe','pipe']});
try{
 await Promise.race([once(server.stdout,'data'),once(server,'exit').then(()=>{throw Error('Server failed');})]);
 const base='http://127.0.0.1:3187';
 async function client(){const r=await fetch(base+'/api/state');return r.headers.get('set-cookie').split(';')[0];}
 async function request(cookie,path,data,expected=200){const r=await fetch(base+'/api/'+path,{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify(data||{})});const j=await r.json();assert.equal(r.status,expected,JSON.stringify(j));return j;}
 const a=await client(),b=await client(),c=await client();
 let state=await request(a,'rooms',{title:'QA caro',game:'caro'});const code=state.room.code;
 await request(a,'start',{},409);await request(b,'join',{code});await request(c,'join',{code});
 await request(b,'start',{},403);await request(a,'ready');await request(b,'ready');
 state=await request(a,'start');assert.equal(state.me.role,'X');assert.equal(state.room.match.board.length,225);assert.ok(!JSON.stringify(state).includes(a.split('=')[1]));
 await request(c,'move',{index:22},409);await request(b,'move',{index:22},409);await request(a,'move',{index:-1},400);await request(a,'move',{index:1.5},400);
 for(let i=0;i<4;i++){await request(a,'move',{index:i});await request(b,'move',{index:15+i});}
 state=await request(a,'move',{index:4});assert.equal(state.room.match.winner,'X');assert.equal(state.room.match.line.length,5);
 await request(b,'move',{index:20},409);await request(a,'ready');await request(b,'ready');state=await request(a,'start');assert.equal(state.room.match.board.filter(Boolean).length,0);
 await request(a,'move',{index:0});await request(b,'move',{index:0},400);await request(b,'leave');state=await (await fetch(base+'/api/state',{headers:{Cookie:a}})).json();assert.equal(state.room.match.status,'aborted');
 await request(a,'leave');state=await (await fetch(base+'/api/state',{headers:{Cookie:c}})).json();assert.equal(state.me.host,true);await request(c,'leave');
 const csrf=await fetch(base+'/api/rooms',{method:'POST',headers:{Cookie:a,Origin:'https://elsewhere.example','Content-Type':'application/json'},body:'{}'});assert.equal(csrf.status,403);
 for(const path of ['/','/app.js','/games.js','/game-rules.js','/cover-runner-v2.webp','/cover-blocks-v2.webp','/cover-caro-v2.webp','/cover-chess-v2.webp','/background-runner-v2.webp','/background-space-v2.webp']){const r=await fetch(base+path);assert.equal(r.status,200,path);assert.ok((await r.arrayBuffer()).byteLength>50);}
 for(const step of [1,15,16,14]){const board=Array(225).fill(null),start=step===14?14:0;for(let i=0;i<5;i++)board[start+i*step]='X';assert.equal(winningLine(board,start).length,5);}
 const wrap=Array(225).fill(null);for(const i of [13,14,15,16,17])wrap[i]='X';assert.equal(winningLine(wrap,15).length,0);
 assert.equal(overlaps({x:0,y:0,w:10,h:10},{x:5,y:5,w:10,h:10}),true);assert.equal(overlaps({x:0,y:0,w:10,h:10},{x:11,y:5,w:10,h:10}),false);
 assert.equal(brickHit({x:4,y:4,r:2},{x:5,y:5,w:10,h:10}),true);assert.equal(brickHit({x:1,y:1,r:2},{x:5,y:5,w:10,h:10}),false);
 console.log('PASS: online roles, readiness, turn validation, wins, rematch, disconnect, host transfer, CSRF, asset routes, diagonal/wrap rules and arcade collision primitives.');
}finally{server.kill();}
