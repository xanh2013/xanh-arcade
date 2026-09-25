import assert from 'node:assert/strict';
import {createWorld,stepWorld,WEAPONS,pickup,currentGun,blocked,WALLS} from './battle-engine.js';
import {NEW_WEAPONS} from './battle-weapons.js';
import {createShooterRooms} from './shooter-rooms.mjs';
import {createFrameMeter} from './performance-meter.js';
const rng=()=>{let s=173;return()=>((s=Math.imul(s,1664525)+1013904223>>>0)/4294967296);};
const world=(teamSize=1)=>createWorld('vanguard',rng(),'easy',{mode:'zombie',teamSize});
assert.equal(Object.keys(NEW_WEAPONS).length,20);assert.equal(Object.keys(WEAPONS).length,25);
let w=world();assert.equal(w.actors.length,49);assert.equal(w.actors.filter(a=>a.alive).length,1);assert.equal(w.phase,'combat');assert.equal(w.loot.filter(a=>a.type==='weapon').length,20);
for(const [id,spec]of Object.entries(NEW_WEAPONS)){
 const g=world();g.loot=[];const l={x:g.player.x,y:g.player.y,type:'weapon',weapon:id};g.loot.push(l);assert.ok(pickup(g,g.player,l));assert.equal(currentGun(g.player).id,id);const before=currentGun(g.player).ammo;stepWorld(g,.05,{fire:true,angle:0});assert.equal(currentGun(g.player).ammo,before-1);assert.equal(g.bullets.length,spec.pellets);assert.ok(spec.damage>0&&spec.reload>0&&spec.range>0);
}
for(let i=0;i<130;i++)stepWorld(w,.05);assert.equal(w.zombie.wave,1);assert.ok(w.actors.some(a=>a.zombie&&a.alive));
const z=w.actors.find(a=>a.zombie&&a.alive);z.x=w.player.x+30;z.y=w.player.y;z.cool=0;w.player.guard=0;const hp=w.player.hp;stepWorld(w,.05);assert.ok(w.player.hp<hp);assert.equal(w.bullets.length,0);
w=world();for(let i=0;i<16000&&w.status==='playing';i++){w.player.guard=999;for(const a of w.actors)if(a.zombie)a.alive=false;stepWorld(w,.05);}assert.equal(w.status,'won');assert.equal(w.zombie.wave,8);assert.ok(w.loot.length<=120);
w=world();w.player.alive=false;stepWorld(w,.05);assert.equal(w.status,'lost');
const random=rng(),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));for(let i=0;i<10000;i++){const x=random()*16000,y=random()*16000,r=[3,14,38,65][i%4];const expected=x<r||y<r||x>16000-r||y>16000-r||WALLS.some(b=>(x-clamp(x,b.x,b.x+b.w))**2+(y-clamp(y,b.y,b.y+b.h))**2<r*r);assert.equal(blocked(x,y,r),expected);}
let clock=10000;const mgr=createShooterRooms({now:()=>clock}),users=Array.from({length:5},(_,i)=>({id:'z'+i,name:'Tester '+i}));const denied=(fn,status)=>assert.throws(fn,e=>e.status===status);
const room=mgr.command(users[0],'create',{game:'battle',ruleset:'zombie',mode:'squad',difficulty:'normal'}).room;assert.equal(room.capacity,4);assert.equal(room.bots,3);const code=room.code;
for(let i=1;i<4;i++)mgr.command(users[i],'join',{code});denied(()=>mgr.command(users[4],'join',{code}),409);denied(()=>mgr.command(users[0],'settings',{mode:'solo',ruleset:'zombie',difficulty:'normal'}),409);denied(()=>mgr.command(users[1],'settings',{mode:'squad',difficulty:'hard'}),403);
for(let i=1;i<4;i++)mgr.command(users[i],'ready');mgr.command(users[0],'start');const match=mgr.rooms.get(code).match;assert.equal(match.world.actors.length,52);assert.equal(match.world.actors.filter(a=>!a.bot).length,4);assert.ok(match.world.actors.slice(0,4).every(a=>a.team===0&&!a.inPlane&&!a.air));mgr.tick();assert.equal(match.status,'playing');denied(()=>mgr.command(users[0],'settings',{mode:'squad',difficulty:'hard'}),409);
const packets=[];mgr.subscribe(users[0],{writeHead(){},write(s){packets.push(s)},on(){},writableLength:0});mgr.publish();const snap=JSON.parse(packets.findLast(s=>s.startsWith('event: match')).split('data: ')[1]);assert.equal(snap.mode,'zombie');assert.equal(snap.zombie.totalWaves,8);assert.equal(snap.actors.filter(a=>a.zombie).length,48);
for(const a of match.world.actors)if(!a.zombie){a.guard=0;a.bot=false;}const a=match.world.actors[0],b=match.world.actors[1];b.x=a.x+40;b.y=a.y;const oldHP=b.hp;match.world.bullets=[{x:b.x-5,y:b.y,vx:100,vy:0,speed:100,owner:a.id,damage:80,life:1}];mgr.tick();assert.equal(b.hp,oldHP);
mgr.command(users[0],'leave');assert.equal(a.bot,true);assert.equal(mgr.command(users[1],'state').room.host,true);for(const actor of match.world.actors)if(!actor.zombie)actor.alive=false;mgr.tick();assert.equal(match.status,'finished');assert.equal(match.winner,null);
const solo=createShooterRooms();const r=solo.command(users[0],'create',{game:'battle',ruleset:'zombie',mode:'solo',difficulty:'easy'}).room;assert.equal(r.capacity,1);denied(()=>solo.command(users[1],'join',{code:r.code}),409);solo.command(users[0],'start');assert.equal(solo.rooms.get(r.code).match.world.actors.filter(a=>a.alive).length,1);
const meter=createFrameMeter();for(let i=0;i<=120;i++)meter.frame(i*1000/60);assert.ok(Math.abs(meter.read(2000).fps-60)<.01);meter.frame(2120);assert.equal(meter.read(2120).stutters,1);meter.reset();assert.equal(meter.read(2200),null);
console.log('PASS zombie: 20 usable guns, waves 1–8, win/loss, melee, bounded pools, wall equivalence, solo/four-player rooms, host/lock/capacity checks, snapshots, friendly fire, host departure, FPS meter.');
