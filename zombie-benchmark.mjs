import {performance} from 'node:perf_hooks';
import {createWorld,stepWorld,WALLS,blocked} from './battle-engine.js';
let seed=53;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
const worlds=Array.from({length:4},()=>{
 const w=createWorld('vanguard',random,'hard',{mode:'zombie',teamSize:4});w.network=true;w.zombie.wave=8;w.zombie.rest=0;w.zombie.spawnLeft=48;
 for(const a of w.actors.slice(0,4)){a.bot=false;a.hp=a.maxHp=1e8;a.guard=999;}
 for(let i=0;i<48;i++){w.zombie.spawnTimer=0;stepWorld(w,.05);}
 for(const a of w.actors.filter(a=>a.zombie)){a.hp=a.maxHp=1e8;}
 return w;
});
const timings=[];let peakBullets=0;for(let frame=0;frame<1200;frame++){
 for(const w of worlds){w.inputs={};for(const a of w.actors.slice(0,4)){a.bag.heavy=240;w.inputs[a.id]={fire:true,angle:frame*.03+a.id};}}
 const t=performance.now();for(const w of worlds)stepWorld(w,.05);const ms=performance.now()-t;if(frame>=100)timings.push(ms);peakBullets=Math.max(peakBullets,...worlds.map(w=>w.bullets.length));
}
timings.sort((a,b)=>a-b);console.log(JSON.stringify({scenario:'4 simultaneous zombie matches, 4 survivors + 48 zombies each, 20 Hz simulation, 60 simulated seconds, invulnerable actors to sustain load',node:process.version,meanMs:timings.reduce((a,b)=>a+b,0)/timings.length,p95Ms:timings[Math.floor(timings.length*.95)],maxMs:timings.at(-1),peakBulletsPerMatch:peakBullets,liveZombies:worlds.map(w=>w.actors.filter(a=>a.zombie&&a.alive).length)},null,2));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),oldBlocked=(x,y,r)=>x<r||y<r||x>16000-r||y>16000-r||WALLS.some(w=>(x-clamp(x,w.x,w.x+w.w))**2+(y-clamp(y,w.y,w.y+w.h))**2<r*r);
const points=Array.from({length:100000},()=>[random()*16000,random()*16000,3]);const measure=fn=>{let hits=0;const t=performance.now();for(const p of points)hits+=fn(...p)?1:0;return {ms:performance.now()-t,hits};};console.log(JSON.stringify({collisionBaseline:measure(oldBlocked),collisionIndexed:measure(blocked)}));
