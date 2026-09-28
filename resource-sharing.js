export const RESOURCE_PROTOCOL='hybrid-p2p-v1';
export const RESOURCE_DUTY_CYCLE=.045;
const finite=n=>typeof n==='number'&&Number.isFinite(n);

export function detectResourceCapabilities(scope=globalThis){
 const navigatorLike=scope.navigator||{};
 const cores=Math.max(1,Number(navigatorLike.hardwareConcurrency)||1);
 const memoryGb=Number(navigatorLike.deviceMemory)||0;
 const connection=navigatorLike.connection||{};
 const saveData=connection.saveData===true;
 const mobile=/Android|iPhone|iPad|Mobile/i.test(navigatorLike.userAgent||'');
 // Capability only: no GPU workload is dispatched until a validated WebGPU task exists.
 const webgpu=Boolean(navigatorLike.gpu);
 const eligible=!saveData&&cores>=4&&(!memoryGb||memoryGb>=4);
 return {cores,memoryGb,webgpu,saveData,mobile,eligible,dutyCycle:RESOURCE_DUTY_CYCLE};
}

export function sanitizeCapabilities(value){
 if(!value||typeof value!=='object')return null;
 const cores=Math.max(1,Math.min(128,Math.floor(Number(value.cores)||0)));
 const memoryGb=Math.max(0,Math.min(1024,Number(value.memoryGb)||0));
 const packetLoss=Number(value.packetLoss);
 return {cores,memoryGb,webgpu:value.webgpu===true,saveData:value.saveData===true,mobile:value.mobile===true,
  eligible:value.eligible===true&&cores>=4&&!value.saveData&&(!memoryGb||memoryGb>=4),
  packetLoss:finite(packetLoss)?Math.max(0,Math.min(1,packetLoss)):0};
}

export function createDutyCycleScheduler({dutyCycle=RESOURCE_DUTY_CYCLE,periodMs=1000}={}){
 const queue=[],budgetMs=Math.max(1,periodMs*Math.min(.05,Math.max(.01,dutyCycle)));
 let windowStart=0,usedMs=0,running=false;
 const pump=()=>{
  if(running||!queue.length)return;
  const now=performanceNow();
  if(now-windowStart>=periodMs){windowStart=now;usedMs=0;}
  if(!windowStart)windowStart=now;
  if(usedMs>=budgetMs){setTimeout(pump,Math.max(4,periodMs-(now-windowStart)));return;}
  const item=queue.shift();running=true;
  const started=performanceNow();
  try{item.resolve(item.work());}catch(error){item.reject(error);}
  usedMs+=Math.max(0,performanceNow()-started);running=false;
  if(queue.length)setTimeout(pump,0);
 };
 return {enqueue(work){return new Promise((resolve,reject)=>{queue.push({work,resolve,reject});pump();});},
  getBudget(){return {budgetMs,usedMs,queued:queue.length};}};
}

const performanceNow=()=>globalThis.performance?.now?.()??Date.now();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const PATH_DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
const cellIndex=(x,y,width,cell)=>Math.max(0,Math.min(width-1,Math.floor(x/cell)));

function gridKey(task){if(task.gridKey)return String(task.gridKey).slice(0,256);const obs=(task.obstacles||[]).map(o=>[Math.round(o.x),Math.round(o.y),Math.round(o.w),Math.round(o.h)]);return JSON.stringify([task.bounds?.width,task.bounds?.height,task.cell,obs]);}
function makeGrid(task){
 const width=Math.max(1,Math.min(256,Math.ceil(task.bounds.width/task.cell)));
 const height=Math.max(1,Math.min(256,Math.ceil(task.bounds.height/task.cell)));
 const blocked=new Uint8Array(width*height);
 if(Array.isArray(task.blocked)){for(let i=0;i<blocked.length&&i<task.blocked.length;i++)blocked[i]=task.blocked[i]?1:0;}
 for(const obstacle of task.obstacles||[]){
  for(let y=Math.max(0,Math.floor(obstacle.y/task.cell));y<Math.min(height,Math.ceil((obstacle.y+obstacle.h)/task.cell));y++)
   for(let x=Math.max(0,Math.floor(obstacle.x/task.cell));x<Math.min(width,Math.ceil((obstacle.x+obstacle.w)/task.cell));x++)blocked[y*width+x]=1;
 }
 return {width,height,cell:task.cell,blocked};
}
export function createResourceCache({maxGrids=4}={}){return {grids:new Map(),maxGrids:Math.max(1,Math.min(8,maxGrids))};}
export function resourceCacheBytes(cache){let bytes=0;for(const grid of cache?.grids?.values?.()||[])bytes+=grid.blocked?.byteLength||0;return bytes;}
function cachedGrid(task,cache){if(!cache?.grids)return makeGrid(task);const key=gridKey(task);let grid=cache.grids.get(key);if(grid){cache.grids.delete(key);cache.grids.set(key,grid);return grid;}grid=makeGrid(task);cache.grids.set(key,grid);while(cache.grids.size>cache.maxGrids)cache.grids.delete(cache.grids.keys().next().value);return grid;}

function pathFor(grid,request){
 const {width,height,cell,blocked}=grid;
 const sx=cellIndex(request.start.x,request.start.y,width,cell),sy=Math.max(0,Math.min(height-1,Math.floor(request.start.y/cell)));
 const ex=cellIndex(request.goal.x,request.goal.y,width,cell),ey=Math.max(0,Math.min(height-1,Math.floor(request.goal.y/cell)));
 const start=sy*width+sx,end=ey*width+ex;
 if(blocked[start]||blocked[end])return [];
 const open=[start],inOpen=new Uint8Array(width*height);inOpen[start]=1;const came=new Int32Array(width*height);came.fill(-1);const cost=new Float32Array(width*height);cost.fill(Infinity);cost[start]=0;
 const score=new Float32Array(width*height);score.fill(Infinity);score[start]=Math.abs(sx-ex)+Math.abs(sy-ey);const closed=new Uint8Array(width*height);
 let last=start,iterations=0;
 while(open.length&&iterations++<900){
  let best=0;for(let i=1;i<open.length;i++)if(score[open[i]]<score[open[best]])best=i;
  const current=open.splice(best,1)[0];inOpen[current]=0;last=current;if(current===end)break;closed[current]=1;
  const x=current%width,y=(current/width)|0;
  for(const [dx,dy]of PATH_DIRS){
   const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const next=ny*width+nx;
   if(blocked[next]||closed[next])continue;const nextCost=cost[current]+1;
   if(nextCost<cost[next]){came[next]=current;cost[next]=nextCost;score[next]=nextCost+Math.abs(nx-ex)+Math.abs(ny-ey);if(!inOpen[next]){open.push(next);inOpen[next]=1;}}
  }
 }
 const path=[];while(last!==start&&came[last]>=0){path.push({x:(last%width+.5)*cell,y:(Math.floor(last/width)+.5)*cell});last=came[last];}
 return path.reverse();
}

function computeBotPaths(task,cache){
 const grid=cachedGrid(task,cache);
 return {kind:task.kind,paths:(task.requests||[]).map(request=>({id:request.id,path:pathFor(grid,request).slice(0,64)}))};
}

function segmentDistance(point,bullet){
 const speed=Math.max(1,Math.hypot(bullet.vx,bullet.vy)),length=Math.max(1,speed*Math.min(.1,bullet.dt||.05));
 const dx=bullet.vx/speed*length,dy=bullet.vy/speed*length;
 const px=point.x-bullet.x,py=point.y-bullet.y,den=dx*dx+dy*dy||1;
 const t=clamp((px*dx+py*dy)/den,0,1),x=bullet.x+dx*t,y=bullet.y+dy*t;
 return Math.hypot(point.x-x,point.y-y);
}

function computeBulletCollisions(task){
 const hits=[];
 for(const bullet of task.bullets||[]){
  let best=null,bestDistance=Infinity;
  for(const actor of task.actors||[]){
   if(!actor.alive||actor.air||actor.id===bullet.owner||actor.team!==undefined&&actor.team===bullet.ownerTeam)continue;
   const d=segmentDistance(actor,bullet);if(d<(actor.r||15)+3&&d<bestDistance){best=actor;bestDistance=d;}
  }
  if(best)hits.push({bulletId:bullet.id,kind:'actor',actorId:best.id});
 }
 return {kind:task.kind,hits};
}

export function runResourceTask(task,{capabilities,cache}={}){
 if(!task||task.protocol!==RESOURCE_PROTOCOL)return {kind:'invalid',error:'unsupported-protocol'};
 const mode='cpu-worker';
 if(task.kind==='bot-pathfinding')return {...computeBotPaths(task,cache),mode};
 if(task.kind==='bullet-collision')return {...computeBulletCollisions(task),mode};
 return {kind:'invalid',error:'unsupported-task'};
}
