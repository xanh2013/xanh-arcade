export const SIZE=1800;
export const CLASSES={vanguard:{name:'Tiên phong',hp:150,speed:205,damage:18,delay:.17,color:'#73adcf'},ranger:{name:'Xạ thủ',hp:105,speed:230,damage:24,delay:.21,color:'#d5b071'},scout:{name:'Trinh sát',hp:115,speed:270,damage:14,delay:.12,color:'#8db990'}};
export const WALLS=[{x:260,y:300,w:200,h:65},{x:640,y:240,w:70,h:240},{x:1080,y:300,w:300,h:70},{x:1490,y:540,w:65,h:210},{x:350,y:700,w:70,h:220},{x:710,y:730,w:140,h:65},{x:980,y:970,w:180,h:65},{x:620,y:1260,w:70,h:250},{x:1120,y:1310,w:300,h:70},{x:260,y:1370,w:200,h:65},{x:1260,y:710,w:65,h:220}];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function blocked(x,y,r=17){if(x<r||y<r||x>SIZE-r||y>SIZE-r)return true;return WALLS.some(w=>(x-clamp(x,w.x,w.x+w.w))**2+(y-clamp(y,w.y,w.y+w.h))**2<r*r);}
export function moveActor(a,dx,dy){if(!blocked(a.x+dx,a.y,a.r))a.x+=dx;if(!blocked(a.x,a.y+dy,a.r))a.y+=dy;}
export function lineClear(a,b){const d=distance(a,b),steps=Math.ceil(d/12);for(let i=1;i<steps;i++)if(blocked(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps,3))return false;return true;}
export function createWorld(classId='vanguard',random=Math.random){const c=CLASSES[classId]||CLASSES.vanguard;const spawn=[[900,900],[160,170],[870,150],[1630,170],[1650,980],[1590,1620],[870,1620],[160,1610],[140,920]];const actors=spawn.map(([x,y],i)=>({id:i,x,y,r:17,hp:i?100:c.hp,maxHp:i?100:c.hp,speed:i?180:c.speed,damage:i?12:c.damage,delay:i?.38:c.delay,angle:0,cool:0,reload:0,ammo:24,maxAmmo:24,shield:0,dash:0,shieldCd:0,novaCd:0,kills:0,level:1,alive:true,color:i?'#c07c6a':c.color,bot:i>0,strafe:random()>.5?1:-1,think:0}));return {actors,player:actors[0],bullets:[],effects:[],loot:[{x:530,y:500,type:'med'},{x:940,y:500,type:'armor'},{x:1440,y:1120,type:'med'},{x:810,y:1150,type:'med'},{x:410,y:1100,type:'armor'}],time:0,zone:{x:900,y:900,r:1230},status:'playing',random,events:[],classId};}
function fx(w,x,y,color,count=8){w.effects.push({x,y,color,life:.4,count});}
function hit(w,a,amount,source){if(!a.alive)return;const reduced=a.shield>0?amount*.25:amount;a.hp-=reduced;fx(w,a.x,a.y,a.shield>0?'#9fc9e1':'#d9a277',4);if(a.hp>0)return;a.hp=0;a.alive=false;w.events.push({type:'kill',actor:a.id,source:source?.id});w.loot.push({x:a.x,y:a.y,type:'med'});if(source&&source.id!==a.id){source.kills++;if(source.kills%2===0){source.level++;source.maxHp+=12;source.hp=Math.min(source.maxHp,source.hp+30);source.damage+=2;}}}
function shoot(w,a,angle){if(!a.alive||a.cool>0||a.reload>0)return;if(a.ammo<=0){a.reload=1.35;return;}a.ammo--;a.cool=a.delay;a.angle=angle;const spread=(w.random()-.5)*(a.bot?.1:.035);const d=angle+spread;w.bullets.push({x:a.x+Math.cos(d)*24,y:a.y+Math.sin(d)*24,vx:Math.cos(d)*720,vy:Math.sin(d)*720,owner:a.id,damage:a.damage,life:.85});w.events.push({type:'shot',actor:a.id});}
export function ability(w,type){const p=w.player;if(w.status!=='playing'||!p.alive)return false;
if(type==='dash'&&p.dash<=0){for(let i=0;i<18;i++)moveActor(p,Math.cos(p.angle)*8,Math.sin(p.angle)*8);p.dash=4;fx(w,p.x,p.y,'#dce8dc',16);}
else if(type==='shield'&&p.shieldCd<=0){p.shield=3;p.shieldCd=12;}
else if(type==='nova'&&p.novaCd<=0){p.novaCd=16;for(const a of w.actors)if(a.id!==0&&a.alive&&distance(p,a)<210&&lineClear(p,a))hit(w,a,60,p);w.effects.push({x:p.x,y:p.y,color:'#e9b472',life:.65,count:210,nova:true});}
else return false;w.events.push({type:'skill',actor:0});return true;}
export function stepWorld(w,dt,input={}){if(w.status!=='playing')return;dt=clamp(dt,0,.04);w.events=[];w.time+=dt;w.zone.r=Math.max(110,1230-w.time*6.3);const p=w.player;
for(const a of w.actors){if(!a.alive)continue;for(const k of ['cool','shield','dash','shieldCd','novaCd'])a[k]=Math.max(0,a[k]-dt);if(a.reload>0){a.reload=Math.max(0,a.reload-dt);if(a.reload===0)a.ammo=a.maxAmmo;}
if(distance(a,w.zone)>w.zone.r)hit(w,a,(w.time>130?20:10)*dt,null);
if(!a.alive)continue;
if(!a.bot){const dx=input.x||0,dy=input.y||0,n=Math.max(1,Math.hypot(dx,dy));moveActor(a,dx/n*a.speed*dt,dy/n*a.speed*dt);if(Number.isFinite(input.angle))a.angle=input.angle;if(input.reload&&a.ammo<a.maxAmmo&&!a.reload)a.reload=1.35;if(input.fire)shoot(w,a,a.angle);}
else{const targets=w.actors.filter(b=>b.id!==a.id&&b.alive).sort((b,c)=>distance(a,b)-distance(a,c));const target=targets[0];if(!target)continue;const d=distance(a,target);a.angle=Math.atan2(target.y-a.y,target.x-a.x);const outside=distance(a,w.zone)>w.zone.r-70;let gx=outside?900:target.x,gy=outside?900:target.y;let heading=Math.atan2(gy-a.y,gx-a.x);const clear=lineClear(a,target);if(!outside&&clear&&d<310)heading+=Math.PI/2*a.strafe;const old={x:a.x,y:a.y};moveActor(a,Math.cos(heading)*a.speed*dt,Math.sin(heading)*a.speed*dt);if(distance(old,a)<.3){heading+=Math.PI/2*a.strafe;moveActor(a,Math.cos(heading)*a.speed*dt,Math.sin(heading)*a.speed*dt);a.think+=dt;if(a.think>1.5){a.strafe*=-1;a.think=0;}}
if(d<580&&clear)shoot(w,a,a.angle);}
if(a.ammo===0&&!a.reload)a.reload=1.35;
}
for(const b of w.bullets){b.life-=dt;const sub=Math.max(1,Math.ceil(720*dt/7));for(let i=0;i<sub&&b.life>0;i++){b.x+=b.vx*dt/sub;b.y+=b.vy*dt/sub;if(blocked(b.x,b.y,3)){b.life=0;fx(w,b.x,b.y,'#b7ad90',3);break;}const victim=w.actors.find(a=>a.alive&&a.id!==b.owner&&distance(a,b)<a.r+3);if(victim){hit(w,victim,b.damage,w.actors[b.owner]);b.life=0;}}}w.bullets=w.bullets.filter(b=>b.life>0);
for(const l of w.loot){if(p.alive&&distance(p,l)<36&&(l.type==='armor'||p.hp<p.maxHp)){if(l.type==='med')p.hp=Math.min(p.maxHp,p.hp+40);else p.shield=Math.max(p.shield,5);l.used=true;w.events.push({type:'pickup',actor:0});}}w.loot=w.loot.filter(l=>!l.used);for(const e of w.effects)e.life-=dt;w.effects=w.effects.filter(e=>e.life>0);
if(!p.alive)w.status='lost';else if(w.actors.filter(a=>a.alive).length===1)w.status='won';
}
