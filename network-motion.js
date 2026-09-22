// Render-only smoothing: server state is restored after every draw.
export function createNetworkMotion(){
 let previous=new Map(),tracks=[],started=0,lastArrival=0,match=null,duration=100;
 const key=(group,item,index)=>group+':'+(item.id??index);
 function accept(world,now){
  const reset=world.matchId!==match||now-lastArrival>500;
  duration=reset?100:Math.max(50,Math.min(150,now-lastArrival));
  started=lastArrival=now;match=world.matchId;tracks=[];
  const next=new Map();
  for(const group of ['actors','vehicles','cars'])for(const [index,item] of (world[group]||[]).entries()){
   const id=key(group,item,index),old=reset?null:previous.get(id);
   const jump=!old||Math.hypot(item.x-old.x,item.y-old.y)>450||item.alive===false;
   const point={x:jump?item.x:old.x,y:jump?item.y:old.y,angle:jump?(item.angle||0):old.angle};
   tracks.push({item,point,from:{...point},x:item.x,y:item.y,angle:item.angle||0});next.set(id,point);
  }
  previous=next;
 }
 function draw(world,now,render){
  const t=Math.max(0,Math.min(1,(now-started)/duration)),restore=[];
  try{
   for(const v of tracks){const a=v.item;restore.push([a,a.x,a.y,a.angle]);v.point.x=v.from.x+(v.x-v.from.x)*t;v.point.y=v.from.y+(v.y-v.from.y)*t;const turn=Math.atan2(Math.sin(v.angle-v.from.angle),Math.cos(v.angle-v.from.angle));v.point.angle=v.from.angle+turn*t;a.x=v.point.x;a.y=v.point.y;a.angle=v.point.angle;}
   // Short visual extrapolation only; never simulate hits or damage here.
   const dt=Math.max(0,Math.min(.08,(now-lastArrival)/1000));
   if(world.status==='playing')for(const b of world.bullets||[]){restore.push([b,b.x,b.y,b.angle]);b.x+=(b.vx||0)*dt;b.y+=(b.vy||0)*dt;}
   render();
  }finally{for(const [a,x,y,angle]of restore){a.x=x;a.y=y;if(angle!==undefined)a.angle=angle;}}
 }
 return {accept,draw};
}
