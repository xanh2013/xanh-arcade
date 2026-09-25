import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {createResourceExecutor} from './resource-executor.js';
import {createShooterRooms} from './shooter-rooms.mjs';
class Adapter{constructor(url){this.worker=new Worker(`const {parentPort}=await import('node:worker_threads');globalThis.self={postMessage:data=>parentPort.postMessage(data)};await import(${JSON.stringify(String(url))});parentPort.on('message',data=>self.onmessage({data}));`,{eval:true});this.worker.on('message',data=>this.onmessage?.({data}));this.worker.on('error',e=>this.onerror?.(e));}postMessage(data){this.worker.postMessage(data);}terminate(){this.worker.terminate();}}
const executor=createResourceExecutor({WorkerClass:Adapter});const task={protocol:'hybrid-p2p-v1',kind:'bot-pathfinding',cell:100,bounds:{width:16000,height:16000},requests:[{id:1,start:{x:50,y:50},goal:{x:1500,y:50}}],obstacles:[]};
try{const r=await executor.run(task);assert.equal(r.result.mode,'cpu-worker');assert.ok(r.cpuMs>=0);assert.equal(r.result.paths[0].path.length,15);}finally{executor.close();}
class Silent{postMessage(){}terminate(){}}
const stalled=createResourceExecutor({WorkerClass:Silent,timeoutMs:20});await assert.rejects(stalled.run(task));stalled.close();
let time=10000;const mgr=createShooterRooms({now:()=>time}),u={id:'test',name:'Tester'};const room=mgr.command(u,'create',{game:'battle',mode:'solo',difficulty:'easy'}).room;mgr.command(u,'start');mgr.subscribe(u,{writeHead(){},write(){},on(){},writableLength:0});mgr.command(u,'admin-boost',{enabled:true},{admin:true});const m=mgr.rooms.get(room.code).match;
mgr.command(u,'resource-capability',{matchId:m.id,capabilities:{eligible:true,cores:8,memoryGb:8}});assert.equal(mgr.command(u,'resource-heartbeat',{matchId:m.id,rtt:220,packetLoss:0}).host,true);
for(const a of m.world.actors){a.air=false;a.inPlane=false;}mgr.publish();assert.ok(m.resource.pending.size);assert.ok([...m.resource.pending.values()].every(t=>t.kind==='bot-pathfinding'));
const t=[...m.resource.pending.values()][0];mgr.command(u,'resource-result',{matchId:m.id,taskId:t.taskId,result:{paths:[{id:t.botIds[0],path:Array.from({length:100},(_,i)=>({x:t.requests[0].start.x+i,y:t.requests[0].start.y}))}]}});assert.equal(m.world.resourceOffload.paths.get(t.botIds[0]).length,64);
mgr.publish();const old=[...m.resource.pending.keys()];time+=2000;mgr.publish();assert.ok(old.every(id=>!m.resource.pending.has(id)));console.log('PASS resources: real separate CPU worker, path output, timeout, 220ms RTT, path-only offload, bounded results and pending expiry.');
