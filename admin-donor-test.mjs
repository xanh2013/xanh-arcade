import assert from 'node:assert/strict';
import {createShooterRooms} from './shooter-rooms.mjs';
import {runResourceTask} from './resource-sharing.js';
let clock=10000;const mgr=createShooterRooms({now:()=>clock});const admin={id:'admin',name:'Admin'},player={id:'player',name:'Player'},caps={eligible:true,cores:8,memoryGb:8};
assert.throws(()=>mgr.command(admin,'admin-resource-donor',{enabled:true,capabilities:caps}),e=>e.status===403);
let result=mgr.command(admin,'admin-resource-donor',{enabled:true,start:true,capabilities:caps},{admin:true});assert.equal(result.enabled,true);assert.equal(result.matches,0);assert.equal(result.task,null);
const room=mgr.command(player,'create',{game:'battle',ruleset:'zombie',mode:'squad',difficulty:'easy'}).room;mgr.command(player,'start');const m=mgr.rooms.get(room.code).match;for(const a of m.world.actors.slice(1,4)){a.x=8000;a.y=8000;a.goal={x:8200,y:8000};a.pathTime=0;}
result=mgr.command(admin,'admin-resource-donor',{enabled:true,capabilities:caps,usage:{cpuMs:12,bytes:1024,tasks:1}},{admin:true});assert.equal(result.matches,1);assert.equal(result.task.kind,'bot-pathfinding');assert.equal(mgr.command(admin,'state').room,null);
const task=result.task,computed=runResourceTask(task);mgr.command(admin,'admin-resource-result',{matchId:m.id,taskId:task.taskId,result:computed},{admin:true});assert.ok(m.world.resourceOffload.paths.size>0);
const stats=mgr.command(admin,'admin-resource-stats',{}, {admin:true});assert.ok(stats.hosts.some(h=>h.name==='Admin'&&h.host&&h.cpuMs===12));
result=mgr.command(admin,'admin-resource-donor',{enabled:true,capabilities:caps},{admin:true});assert.ok(result.task);mgr.command(admin,'admin-resource-donor',{enabled:false},{admin:true});assert.equal(m.resource.pending.size,0);
assert.throws(()=>mgr.command(admin,'admin-resource-result',{matchId:m.id,taskId:result.task.taskId,result:computed},{admin:true}),e=>e.status===409);
mgr.command(admin,'admin-resource-donor',{enabled:true,capabilities:caps},{admin:true});clock+=9000;mgr.publish();assert.equal(m.resource.pending.size,0);
console.log('PASS admin donor: admin-only, no room required, Zombie task delivery/result, real usage, stop cancels tasks, timeout and stale result rejection.');
