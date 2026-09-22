import {createNetworkMotion} from './network-motion.js';
const motion=createNetworkMotion();
export function drawOnline(world,time,render){if(online)motion.draw(world,time,render);else render();}
export const online=new URLSearchParams(location.search).get('online')==='1';
export async function roomAPI(op,data){const r=await fetch('/api/shooter/'+op,{method:data===undefined?'GET':'POST',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});const value=await r.json();if(!r.ok)throw Error(value.error||'Lỗi kết nối');return value;}
export function connectMatch({game,receive,input,buttons,keyAction,notice}){
 if(!online)return;
 const strip=document.createElement('aside');strip.className='online-strip';strip.setAttribute('aria-live','polite');const label=document.createElement('span'),back=document.createElement('a');back.href='/rooms?stay=1&game='+game;back.textContent='Về phòng';strip.append(label,back);document.querySelector('main').prepend(strip);label.textContent='Đang kết nối phòng…';
 let snapshot=null,actions=[],seq=0,busy=false,lastPacket=0,room=null,stopped=false;
 function queue(action){if(snapshot?.status==='playing'&&snapshot.actors[snapshot.playerId].alive&&actions.length<6)actions.push(action);}
 document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const action=buttons(b);if(action){e.preventDefault();e.stopImmediatePropagation();queue(action);}},true);
 document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select')||document.querySelector('dialog[open]'))return;const action=keyAction(e.code);if(action){e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)queue(action);}},true);
 window.addEventListener('blur',()=>{actions=[];});
 const events=new EventSource('/api/shooter/events');events.addEventListener('room',e=>{const value=JSON.parse(e.data);room=value.room;if(!room||room.game!==game){stopped=true;label.textContent='Phòng đã đóng hoặc không đúng game. Bấm Về phòng.';return;}if(!room.locked&&room.status==='waiting')location.href='/rooms?game='+game;});
 events.addEventListener('match',e=>{const next=JSON.parse(e.data);if(!next||stopped)return;snapshot=next;seq=Math.max(seq,next.inputSeq||0);lastPacket=performance.now();const p=next.actors[next.playerId];const team=next.actors.filter(a=>a.team===p.team);label.textContent='Phòng '+(room?.code||'')+' · '+(next.teamMode==='squad'?'Đội '+(p.team+1)+' · '+team.map(a=>a.name+(a.alive?' ♥':' ✕')).join(' / '):'Solo')+' · '+(p.alive?(next.status==='playing'?'Độ khó đã khóa':next.status==='won'?'CHIẾN THẮNG':'KẾT THÚC'):'Đã bị hạ · Chờ kết quả đội');motion.accept(next,lastPacket);receive(next);});
 events.onerror=()=>{label.textContent='Mất kết nối — đang nối lại. Trận đấu vẫn tiếp tục.';};
 const timer=setInterval(async()=>{if(stopped||busy||!snapshot||snapshot.status!=='playing')return;if(performance.now()-lastPacket>2500){label.textContent='Đang chờ máy chủ…';return;}busy=true;const batch=actions.splice(0),sample=document.hidden?{}:input();try{await roomAPI('input',{...sample,actions:document.hidden?[]:batch,seq:++seq,matchId:snapshot.matchId});}catch(e){label.textContent=e.message;}finally{busy=false;}},100);
 window.addEventListener('pagehide',()=>{clearInterval(timer);events.close();},{once:true});
}
