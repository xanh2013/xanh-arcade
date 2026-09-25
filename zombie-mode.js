export const ZOMBIE_WAVES=8;
export function initZombies(w,teamSize,weaponIds,blocked){
 const count=teamSize===4?4:1,template=w.actors[1];
 w.mode='zombie';w.phase='combat';w.zone={x:8000,y:8000,r:16000,stage:0,remaining:0};
 w.actors=w.actors.slice(0,count);
 for(const [i,a]of w.actors.entries()){
  Object.assign(a,{team:0,x:8000+i*45,y:8000,air:false,altitude:0,inPlane:false,guard:8,damageScale:1,armor:100,goal:{x:8000,y:8000},name:i?'Đồng đội '+i:'Bạn'});
  a.slots=[{id:'cedar',ammo:30},{id:'tempest',ammo:8}];a.bag={light:180,heavy:240,shell:120,med:5,glue:6};
 }
 // Reuse a bounded actor pool so IDs remain valid in snapshots and bullet ownership.
 for(let id=count;id<count+48;id++)w.actors.push({...template,id,zombie:true,team:1,name:'Zombie',alive:false,air:false,inPlane:false,slots:[null,null],bag:{light:0,heavy:0,shell:0,med:0,glue:0},path:[],vehicle:null});
 w.loot=[];w.vehicles=[];w.zombie={wave:0,totalWaves:ZOMBIE_WAVES,remaining:0,spawnLeft:0,rest:5,spawnTimer:0,survivors:count,kills:0};
 for(let i=0;i<weaponIds.length;i++){
  const angle=i*Math.PI*2/weaponIds.length;for(let attempt=0;attempt<24;attempt++){const r=340+attempt*25,x=8000+Math.cos(angle)*r,y=8000+Math.sin(angle)*r;if(!blocked(x,y,24)){w.loot.push({x,y,type:'weapon',weapon:weaponIds[i]});break;}}
 }
}
function supply(w){
 for(const a of w.actors){if(a.zombie)break;if(!a.alive)continue;
  for(const ammo of ['light','heavy','shell'])a.bag[ammo]=Math.min(240,a.bag[ammo]+90);
  a.bag.med=Math.min(5,a.bag.med+1);a.bag.glue=Math.min(6,a.bag.glue+1);a.hp=Math.min(a.maxHp,a.hp+35);
 }
 // Prune old drops; supplies do not grow without bound during a long session.
 if(w.loot.length>120)w.loot=w.loot.slice(-120);
}
export function prepareZombies(w,dt,blocked){
 const z=w.zombie;if(!z)return;
 w.zombiePathBudget=1;
 const survivors=w.actors.filter(a=>!a.zombie&&a.alive);
 if(!survivors.length){w.status='lost';return;}
 if(z.rest>0){z.rest=Math.max(0,z.rest-dt);if(z.rest>0)return;
  z.wave++;z.spawnLeft=8+z.wave*4+(z.survivors-1)*6;z.remaining=z.spawnLeft;z.spawnTimer=0;
  w.events.push({type:'wave',wave:z.wave});
 }
 if(!z.spawnLeft)return;
 z.spawnTimer-=dt;if(z.spawnTimer>0)return;
 const a=w.actors.find(a=>a.zombie&&!a.alive);if(!a)return;
 const target=survivors[Math.floor(w.random()*survivors.length)];let pos=null;
 for(let i=0;i<24;i++){const ang=w.random()*Math.PI*2,r=580+w.random()*260,x=Math.max(40,Math.min(15960,target.x+Math.cos(ang)*r)),y=Math.max(40,Math.min(15960,target.y+Math.sin(ang)*r));if(Math.hypot(x-target.x,y-target.y)>450&&!blocked(x,y,22,w.covers)){pos={x,y};break;}}
 if(!pos){z.spawnTimer=.5;return;}
 const roll=w.random(),kind=z.wave>=3&&roll<.18?'brute':z.wave>=2&&roll<.45?'runner':'walker';
 const scale={easy:.8,normal:1,hard:1.2}[w.difficulty],hp=(kind==='brute'?210:kind==='runner'?62:90)*(1+(z.wave-1)*.09)*scale;
 Object.assign(a,pos,{alive:true,zombie:true,variant:kind,hp,maxHp:hp,armor:kind==='brute'?55:0,r:kind==='brute'?21:14,speed:(kind==='runner'?150:kind==='brute'?65:91)*(1+z.wave*.012),color:kind==='brute'?'#87956a':kind==='runner'?'#a5b887':'#76977a',angle:0,guard:0,cool:.8,attack:0,shield:0,healing:0,reload:0,path:[],pathTime:0,think:(a.id%5)*.05,goal:{x:target.x,y:target.y},targetId:target.id,vx:0,vy:0});
 z.spawnLeft--;z.spawnTimer=Math.max(.18,.65-z.wave*.045);
}
export function stepZombie(w,a,dt,api){
 const oldX=a.x,oldY=a.y;a.cool=Math.max(0,a.cool-dt);a.attack=Math.max(0,(a.attack||0)-dt);a.think-=dt;a.pathTime-=dt;
 if(a.think<=0){let nearest=null,best=Infinity;for(const b of w.actors){if(b.zombie)break;if(!b.alive)continue;const d=(a.x-b.x)**2+(a.y-b.y)**2;if(d<best){nearest=b;best=d;}}
  a.targetId=nearest?.id;a.think=.25+(a.id%5)*.04;
 }
 const target=w.actors[a.targetId];if(!target?.alive)return;
 a.goal={x:target.x,y:target.y};const dist=Math.hypot(a.x-target.x,a.y-target.y);a.angle=Math.atan2(target.y-a.y,target.x-a.x);
 if(dist<a.r+target.r+16&&api.lineClear(a,target,w)){
  if(a.cool<=0){const damage=({easy:9,normal:12,hard:16}[w.difficulty])*(a.variant==='brute'?1.8:1);api.hit(w,target,damage,a);a.cool=a.variant==='runner'?.85:1.25;a.attack=.25;}return;
 }
 if(a.pathTime<=0&&w.zombiePathBudget>0){w.zombiePathBudget--;a.pathTime=1.5+(a.id%6)*.2;a.path=api.lineClear(a,target,w)?[]:api.findPath(a,target);}
 if(a.path.length&&Math.hypot(a.x-a.path[0].x,a.y-a.path[0].y)<40)a.path.shift();
 const dest=a.path[0]||target,angle=Math.atan2(dest.y-a.y,dest.x-a.x),step=a.speed*dt;
 api.moveActor(a,Math.cos(angle)*step,Math.sin(angle)*step,w);
 if(Math.abs(oldX-a.x)+Math.abs(oldY-a.y)<.1){const side=a.id%2?1:-1;api.moveActor(a,Math.cos(angle+side*1.1)*step,Math.sin(angle+side*1.1)*step,w);const cover=w.covers.find(c=>a.x>c.x-45&&a.x<c.x+c.w+45&&a.y>c.y-45&&a.y<c.y+c.h+45);if(cover&&a.cool<=0){cover.hp-=30;a.cool=1;}}
 a.vx=(a.x-oldX)/dt||0;a.vy=(a.y-oldY)/dt||0;
}
export function finishZombies(w){
 const z=w.zombie;if(!z)return;
 if(!w.actors.some(a=>!a.zombie&&a.alive)){w.status='lost';return;}
 z.remaining=z.spawnLeft+w.actors.filter(a=>a.zombie&&a.alive).length;
 if(z.wave>0&&z.remaining===0&&z.rest<=0){if(z.wave===z.totalWaves)w.status='won';else{z.rest=15;supply(w);w.events.push({type:'resupply'});}}
}
