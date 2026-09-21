import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as B from './battle-engine.js';
import * as F from './fortnite-engine.js';
const data=JSON.parse(readFileSync(new URL('./fortnite-assets/world.json',import.meta.url))),masks=JSON.parse(readFileSync(new URL('./fortnite-assets/collision.json',import.meta.url)));
const validGame=g=>['battle','fortnite'].includes(g),validMode=m=>['solo','squad'].includes(m),validDifficulty=d=>['easy','normal','hard'].includes(d);
export class RoomError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new RoomError(status,message);};
export function createShooterRooms({now=Date.now,maxMatches=4}={}){
 const rooms=new Map(),clients=new Map();
 const client=s=>{let c=clients.get(s.id);if(!c){c={session:s,room:null,streams:new Set(),last:now(),rate:0,at:now(),inputAt:0};clients.set(s.id,c);}c.last=now();return c;};
 const getRoom=c=>{const r=rooms.get(c.room);if(!r)fail(404,'Bạn chưa vào phòng.');return r;};
 const waiting=r=>{if(r.match?.status==='playing')fail(409,'Trận đã bắt đầu: cấu hình và đội đã khóa.');};
 const host=(r,c)=>{if(r.host!==c.session.id)fail(403,'Chỉ chủ phòng được thay đổi cấu hình hoặc bắt đầu.');};
 const cap=(r,t)=>r.mode==='solo'?1:t===6?1:4;
 const teamCount=r=>r.mode==='solo'?25:7;
 const available=(r,t)=>[...r.members.values()].filter(m=>m.team===t).length<cap(r,t);
 const autoTeam=r=>{for(let t=0;t<teamCount(r);t++)if(available(r,t))return t;fail(409,'Phòng đã đủ 25 người.');};
 const view=(r,c)=>({code:r.code,game:r.game,mode:r.mode,difficulty:r.difficulty,host:r.host===c.session.id,locked:r.match?.status==='playing',matchId:r.match?.id||null,status:r.match?.status||'waiting',winner:r.match?.winner??null,humans:r.members.size,bots:25-r.members.size,members:[...r.members].map(([id,m])=>({name:m.name,team:m.team,ready:m.ready,host:id===r.host,me:id===c.session.id})),teamCapacities:Array.from({length:teamCount(r)},(_,i)=>cap(r,i))});
 function state(c){const r=rooms.get(c.room);return {room:r?view(r,c):null,rooms:[...rooms.values()].filter(r=>!r.match||r.match.status!=='playing').map(r=>({code:r.code,game:r.game,mode:r.mode,count:r.members.size,difficulty:r.difficulty}))};}
 function emit(c,event,payload){const text='event: '+event+'\ndata: '+JSON.stringify(payload)+'\n\n';for(const res of c.streams){if(res.destroyed){c.streams.delete(res);continue;}if(res.writableLength>512000){res.destroy();c.streams.delete(res);continue;}res.write(text);}}
 function notify(){for(const c of clients.values())if(c.streams.size)emit(c,'room',state(c));}
 function leave(c){const r=rooms.get(c.room);if(r){const member=r.members.get(c.session.id);if(member&&r.match?.status==='playing'){const a=r.match.world.actors[member.actor];a.bot=true;a.name=member.name+' · bot';delete r.match.controls[a.id];}r.members.delete(c.session.id);if(!r.members.size)rooms.delete(r.code);else if(r.host===c.session.id)r.host=r.members.keys().next().value;}c.room=null;}
 function start(r){const world=r.game==='battle'?B.createWorld('vanguard',Math.random,r.difficulty):F.createGame(data,masks,{difficulty:r.difficulty});world.network=true;world.phase='drop';world.inputs={};for(const a of world.actors)a.bot=true;
 const slots=Array.from({length:25},(_,id)=>({id,team:r.mode==='solo'?id:Math.floor(id/4)}));
 for(const [sid,m] of r.members){const slot=slots.find(s=>s.team===m.team&&!s.used);slot.used=true;m.actor=slot.id;m.seq=-1;const a=world.actors[slot.id];a.bot=false;a.name=m.name;a.damage=1;a.damageScale=1;a.speed=145;a.guard=20;}
 for(const a of world.actors){if(a.bot){a.damage=F.MODES[r.difficulty].damage;a.damageScale=B.DIFFICULTIES[r.difficulty].damage;}a.team=slots[a.id].team;a.inPlane=true;a.dropAt=4+(a.team*2.37)%15;a.name??='Bot '+(a.id+1);if(r.game==='battle'){a.x=800;a.y=B.SIZE/2;}else{a.x=520;a.y=F.HEIGHT/2;}}
 r.match={id:randomUUID(),world,status:'playing',winner:null,controls:{},started:now(),finished:null};
 }
 function action(r,a,name){const w=r.match.world;if(!a.alive)return;if(name==='jump'){a.inPlane=false;return;}if(a.inPlane)return;const original=w.player;w.player=a;
 try{if(r.game==='battle'){if(name==='pickup')B.pickup(w,a,B.nearestLoot(w,a));else if(name==='heal')B.heal(a);else if(name==='reload')B.reload(a);else if(name==='glue')B.deployGlue(w,a);else if(name==='vehicle')B.toggleVehicle(w);else if(['dash','shield','nova'].includes(name))B.ability(w,name);else if(/^slot[01]$/.test(name))B.switchWeapon(a,Number(name.slice(4)));}
 else{if(name==='pickup')F.collect(w,a);else if(name==='heal')F.heal(a);else if(name==='reload')F.reload(a);else if(name==='build')F.build(w);else if(name==='vehicle')F.enterCar(w);else if(name==='grenade')F.throwGrenade(w);else if(name==='axe'){a.tool=!a.tool;a.reload=0;}else if(/^slot[0-5]$/.test(name))F.swap(w,Number(name.slice(4)));}}
 finally{w.player=original;}}
 function snapshot(r,c){const m=r.match,member=r.members.get(c.session.id);if(!m||!member)return null;const w=m.world,p=w.actors[member.actor];if(!p)return null;const nearby=o=>Math.abs(o.x-p.x)<1700&&Math.abs(o.y-p.y)<1400;const actorFields=r.game==='battle'?['id','name','team','x','y','r','hp','maxHp','speed','angle','vx','vy','cool','reload','shield','dash','shieldCd','novaCd','kills','level','alive','color','bot','active','slots','bag','armor','vehicle','guard','glueCd','healing','air','altitude','inPlane']:['id','name','team','x','y','hp','maxHp','armor','angle','vx','vy','alive','air','slots','slot','ammo','wood','med','grenades','vehicle','cool','reload','heal','kills','skin','damage','guard','tool','buildCd','bot','inPlane'];
 const actors=w.actors.map(a=>Object.fromEntries(actorFields.map(k=>[k,a[k]])));const out={matchId:m.id,inputSeq:member.seq,playerId:p.id,time:w.time,flight:w.flight,difficulty:r.difficulty,actors,zone:w.zone,phase:p.inPlane?'flight':p.air?'drop':'combat',status:m.status==='playing'?'playing':m.winner===p.team?'won':'lost',teamMode:r.mode,bullets:w.bullets.filter(nearby),effects:w.effects.filter(nearby),loot:w.loot.filter(nearby),events:w.events};
 if(r.game==='battle')Object.assign(out,{covers:w.covers,vehicles:w.vehicles,classId:'vanguard',diff:w.diff});else Object.assign(out,{walls:w.walls,cars:w.cars,trees:w.trees.filter(nearby),chests:w.chests,pads:w.pads});return out;
 }
 function tick(dt=.05){for(const r of rooms.values()){const m=r.match;if(!m||m.status!=='playing')continue;const w=m.world;w.flight=Math.min(r.game==='battle'?25:22,w.flight+dt);for(const a of w.actors){if(!a.inPlane)continue;const duration=r.game==='battle'?25:22;a.x=(r.game==='battle'?800:520)+w.flight*(r.game==='battle'?B.SIZE-1600:F.WIDTH-1040)/duration;a.y=r.game==='battle'?B.SIZE/2:F.HEIGHT/2;if(w.flight>=duration||a.bot&&w.flight>=a.dropAt)a.inPlane=false;}
 w.inputs={};for(const [id,control]of Object.entries(m.controls)){if(now()-control.at>600)continue;w.inputs[id]=control.input;for(const cmd of control.actions.splice(0))action(r,w.actors[id],cmd);}
 if(r.game==='battle')B.stepWorld(w,dt);else F.step(w,dt);
 const teams=new Set(w.actors.filter(a=>a.alive).map(a=>a.team));if(teams.size<=1||w.time>1500){m.status='finished';m.winner=teams.size===1?[...teams][0]:null;m.finished=now();for(const v of r.members.values())v.ready=false;notify();}
 }}
 function publish(){for(const c of clients.values()){const r=rooms.get(c.room);if(r?.match&&c.streams.size)emit(c,'match',snapshot(r,c));}}
 function cleanup(){for(const c of clients.values()){if(now()-c.last>120000){leave(c);for(const res of c.streams)res.end();clients.delete(c.session.id);}else for(const res of c.streams)res.write(': heartbeat\n\n');}notify();}
 function command(s,op,d={}){const c=client(s);if(op==='state')return state(c);if(op==='input'){const r=getRoom(c),m=r.match,member=r.members.get(s.id);if(!m||m.status!=='playing'||d.matchId!==m.id)fail(409,'Trận không còn hoạt động.');if(!Number.isSafeInteger(d.seq)||d.seq<=member.seq)return {ok:true};if(now()-c.inputAt<30)fail(429,'Gửi điều khiển quá nhanh.');c.inputAt=now();member.seq=d.seq;const old=m.controls[member.actor];const finite=n=>typeof n==='number'&&Number.isFinite(n);m.controls[member.actor]={at:now(),input:{x:finite(d.x)?Math.max(-1,Math.min(1,d.x)):0,y:finite(d.y)?Math.max(-1,Math.min(1,d.y)):0,angle:finite(d.angle)?d.angle%(Math.PI*2):0,fire:d.fire===true,reload:d.reload===true},actions:[...(old?.actions||[]),...(Array.isArray(d.actions)?d.actions.filter(a=>typeof a==='string').slice(0,6):[])].slice(0,12)};return {ok:true};}
 if(now()-c.at>60000){c.at=now();c.rate=0;}if(++c.rate>90)fail(429,'Thao tác quá nhanh, thử lại sau.');
 if(op==='create'){if(c.room)fail(409,'Hãy rời phòng hiện tại.');if(!validGame(d.game)||!validMode(d.mode)||!validDifficulty(d.difficulty))fail(400,'Cấu hình phòng không hợp lệ.');if(rooms.size>=100)fail(503,'Sảnh đang đầy.');let code;do{code=randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));const r={code,game:d.game,mode:d.mode,difficulty:d.difficulty,host:s.id,members:new Map()};rooms.set(code,r);c.room=code;r.members.set(s.id,{name:String(d.name||s.name).trim().slice(0,24)||'Xanh',team:0,ready:true});}
 else if(op==='join'){const r=rooms.get(String(d.code||'').trim().toUpperCase());if(!r)fail(404,'Không tìm thấy phòng.');if(c.room===r.code)return state(c);if(c.room)fail(409,'Hãy rời phòng hiện tại.');waiting(r);if(r.match?.status==='finished')r.match=null;if(r.members.size>=25)fail(409,'Phòng đã đủ 25 người.');const team=autoTeam(r);c.room=r.code;r.members.set(s.id,{name:String(d.name||s.name).trim().slice(0,24)||'Người chơi',team,ready:false});}
 else if(op==='leave')leave(c);
 else{const r=getRoom(c);waiting(r);if(r.match?.status==='finished')r.match=null;const member=r.members.get(s.id);if(op==='settings'){host(r,c);if(!validDifficulty(d.difficulty)||!validMode(d.mode))fail(400,'Cấu hình không hợp lệ.');r.difficulty=d.difficulty;if(r.mode!==d.mode){r.mode=d.mode;let i=0;for(const m of r.members.values())m.team=r.mode==='solo'?i++:Math.floor(i++/4);}for(const [id,m]of r.members)m.ready=id===r.host;}
 else if(op==='team'){if(r.mode!=='squad'||!Number.isInteger(d.team)||d.team<0||d.team>=7)fail(400,'Đội không hợp lệ.');if(member.team!==d.team&&!available(r,d.team))fail(409,'Đội đã đủ người.');member.team=d.team;member.ready=false;}
 else if(op==='ready')member.ready=!member.ready;
 else if(op==='start'){host(r,c);if([...r.members].some(([id,m])=>id!==r.host&&!m.ready))fail(409,'Chờ mọi người sẵn sàng.');if([...rooms.values()].filter(x=>x.match?.status==='playing').length>=maxMatches)fail(503,'Máy chủ đang đủ trận. Thử lại sau.');start(r);}
 else fail(404,'Thao tác không tồn tại.');}
 notify();return state(c);
 }
 function subscribe(s,res){const c=client(s);if(c.streams.size>=3)fail(429,'Quá nhiều cửa sổ phòng.');res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});c.streams.add(res);emit(c,'room',state(c));const r=rooms.get(c.room);if(r?.match)emit(c,'match',snapshot(r,c));res.on('close',()=>c.streams.delete(res));}
 return {command,subscribe,tick,publish,cleanup,rooms};
}
