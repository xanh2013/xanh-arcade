import assert from 'node:assert/strict';
import {createShooterRooms} from './shooter-rooms.mjs';
import * as B from './battle-engine.js';
import * as F from './fortnite-engine.js';
let clock=10000;const now=()=>clock;const manager=createShooterRooms({now,maxMatches:10});const users=Array.from({length:26},(_,i)=>({id:'u'+i,name:'Player '+i}));
const denied=(fn,status)=>assert.throws(fn,e=>e.status===status);
for(const game of ['battle','fortnite']){
 const room=manager.command(users[0],'create',{game,mode:'squad',difficulty:'hard'}).room,code=room.code;
 for(let i=1;i<5;i++)manager.command(users[i],'join',{code});
 denied(()=>manager.command(users[1],'settings',{difficulty:'easy',mode:'squad'}),403);
 denied(()=>manager.command(users[4],'team',{team:0}),409);
 manager.command(users[0],'team',{team:2});manager.command(users[4],'team',{team:0});
 const state=manager.command(users[0],'state').room;assert.equal(state.humans,5);assert.equal(state.bots,20);
 denied(()=>manager.command(users[0],'start'),409);for(let i=1;i<5;i++)manager.command(users[i],'ready');
 manager.command(users[0],'start');const r=manager.rooms.get(code),m=r.match,w=m.world;assert.equal(w.actors.length,25);assert.equal(w.actors.filter(a=>!a.bot).length,5);assert.equal(w.actors.filter(a=>a.bot).length,20);assert.ok(w.actors.filter(a=>!a.bot).every(a=>a.damage===1&&a.damageScale===1));
 for(const op of ['settings','team','join'])denied(()=>manager.command(op==='join'?users[5]:users[0],op,{code,mode:'solo',difficulty:'easy',team:1}),409);
 const member=r.members.get(users[0].id),a=w.actors[member.actor],b=w.actors[r.members.get(users[1].id).actor];assert.notEqual(a.id,0);assert.equal(a.team,2);
 denied(()=>manager.command(users[0],'input',{matchId:'wrong',seq:1}),409);
 manager.command(users[0],'input',{matchId:m.id,seq:1,x:999,y:0,actions:['jump']});manager.tick();assert.equal(a.inPlane,false);assert.equal(b.inPlane,true);
 const x=a.x;clock+=100;manager.command(users[0],'input',{matchId:m.id,seq:2,x:1,y:0});manager.tick();assert.ok(a.x>x);const bx=b.x;
 clock+=100;manager.command(users[1],'input',{matchId:m.id,seq:1,x:-1,y:0,actions:['jump']});manager.tick();assert.equal(b.inPlane,false);assert.ok(b.x<bx+40);
 // One stream per player sees their own actor, but the same match and fixed difficulty.
 const packets=[];const res={writeHead(){},write(s){packets.push(s)},on(){},writableLength:0};manager.subscribe(users[0],res);manager.publish();const packet=JSON.parse(packets.findLast(x=>x.startsWith('event: match')).split('data: ')[1]);assert.equal(packet.playerId,a.id);assert.equal(packet.difficulty,'hard');assert.equal(packet.actors.length,25);assert.equal(packet.matchId,m.id);
 // Teammate bullets do not hurt; enemy bullets do. Use a known open area.
 w.phase='combat';for(const actor of w.actors){actor.inPlane=false;actor.air=game==='battle'?false:0;actor.guard=0;actor.bot=false;actor.x=4000+actor.id*50;actor.y=2000;}
 if(game==='fortnite')w.terrain.point=()=>false;
 const target=w.actors.find(t=>t.id!==a.id&&t.team===a.team);a.x=1000;a.y=1000;target.x=1040;target.y=1000;const hp=target.hp;
 w.bullets=[{x:1035,y:1000,vx:100,vy:0,speed:100,owner:a.id,damage:20,life:1,blast:0}];if(game==='battle')B.stepWorld(w,.05);else F.step(w,.05);assert.equal(target.hp,hp);
 target.team=99;w.bullets=[{x:1035,y:1000,vx:100,vy:0,speed:100,owner:a.id,damage:20,life:1,blast:0}];if(game==='battle')B.stepWorld(w,.05);else F.step(w,.05);assert.ok(target.hp<hp);
 // Host departure hands ownership on and converts exactly their actor to a bot.
 manager.command(users[0],'leave');assert.equal(a.bot,true);assert.equal(manager.command(users[1],'state').room.host,true);
 for(let i=1;i<5;i++)manager.command(users[i],'leave');assert.equal(manager.rooms.has(code),false);
}
const cap=createShooterRooms({now});const code=cap.command(users[0],'create',{game:'battle',mode:'solo',difficulty:'easy'}).room.code;for(let i=1;i<25;i++)cap.command(users[i],'join',{code});assert.equal(cap.command(users[0],'state').room.bots,0);denied(()=>cap.command(users[25],'join',{code}),409);
console.log('PASS rooms: both games, 25 slots, team capacity, host permissions, ready gate, locked settings/join/team, independent human input, own snapshot, friendly fire, bot takeover, host migration, cleanup.');
