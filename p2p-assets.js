const SAFE_ASSET=/^\/(?:fortnite-assets\/[A-Za-z0-9_-]+\.(?:svg|json)|cover-(?:runner|blocks|caro|chess)-v2\.webp|background-(?:runner|space)-v2\.webp)$/;
const ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const api=async(op,data={})=>{const r=await fetch('/api/p2p/'+op,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(5000)});let value={};try{value=await r.json();}catch{}if(!r.ok)throw Error(value.error||'P2P signaling failed');return value;};
const safePath=path=>typeof path==='string'&&SAFE_ASSET.test(path);

let clientPromise=null,clientChannel=null,clientPair=null,currentTransfer=null,clientPeer=null;
async function signalClient(signal){if(clientPair)await api('client-signal',{pairId:clientPair,signal});}
async function openClient(){
 if(clientChannel?.readyState==='open')return clientChannel;
 if(clientPromise)return clientPromise;
 clientPromise=(async()=>{
  if(typeof RTCPeerConnection==='undefined')return null;
  const start=await api('client-connect');if(!start.enabled)return null;clientPair=start.pairId;
  const pc=clientPeer=new RTCPeerConnection(ICE);
  pc.onicecandidate=e=>{if(e.candidate)signalClient({candidate:e.candidate}).catch(()=>{});};
  pc.ondatachannel=e=>{clientChannel=e.channel;setupClientChannel(clientChannel);};
  const deadline=performance.now()+2200;
  try{
   while(performance.now()<deadline){
    const polled=await api('client-poll',{pairId:clientPair});
    if(!polled.enabled)break;
    for(const event of polled.events||[])if(event.type==='signal'){
     const s=event.signal;
     if(s.description){await pc.setRemoteDescription(s.description);if(s.description.type==='offer'){const answer=await pc.createAnswer();await pc.setLocalDescription(answer);await signalClient({description:pc.localDescription});}}
     else if(s.candidate)try{await pc.addIceCandidate(s.candidate);}catch{}
    }
    if(clientChannel?.readyState==='open')return clientChannel;
    await sleep(100);
   }
  }catch{}
  try{pc.close();}catch{}clientPeer=null;clientChannel=null;
  if(clientPair)api('client-disconnect',{pairId:clientPair}).catch(()=>{});
  clientPair=null;return null;
 })().finally(()=>{clientPromise=null;});
 return clientPromise;
}
function setupClientChannel(channel){
 channel.binaryType='arraybuffer';
 channel.onclose=()=>{if(clientChannel===channel)clientChannel=null;};
 channel.onmessage=e=>{
  if(typeof e.data==='string'){
   let msg;try{msg=JSON.parse(e.data);}catch{return;}
   const t=currentTransfer;if(!t||msg.id!==t.id)return;
   if(msg.type==='asset-start'){t.type=msg.mime||'application/octet-stream';t.expected=msg.size||0;t.chunks=[];}
   else if(msg.type==='asset-end'){clearTimeout(t.timer);currentTransfer=null;t.resolve(new Blob(t.chunks,{type:t.type}));}
   else if(msg.type==='asset-error'){clearTimeout(t.timer);currentTransfer=null;t.resolve(null);}
  }else if(currentTransfer)currentTransfer.chunks.push(e.data);
 };
}
let queue=Promise.resolve();
export function fetchAssetBlob(path){
 if(!safePath(path))return Promise.resolve(null);
 const work=async()=>{
  const channel=await openClient();if(!channel||channel.readyState!=='open')return null;
  return new Promise(resolve=>{
   const id=Math.random().toString(36).slice(2)+Date.now().toString(36),timer=setTimeout(()=>{if(currentTransfer?.id===id)currentTransfer=null;resolve(null);},8000);
   currentTransfer={id,resolve,timer,chunks:[],type:'application/octet-stream',expected:0};
   try{channel.send(JSON.stringify({type:'get',id,path}));}catch{clearTimeout(timer);currentTransfer=null;resolve(null);}
  });
 };
 const result=queue.then(work,work);queue=result.catch(()=>null);return result;
}
export async function assetObjectURL(path){
 const blob=await fetchAssetBlob(path);return blob?URL.createObjectURL(blob):path;
}
export async function loadAssetImage(img,path){
 const blob=await fetchAssetBlob(path);
 if(!blob){img.src=path;return {p2p:false};}
 const url=URL.createObjectURL(blob);img.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true});img.addEventListener('error',()=>URL.revokeObjectURL(url),{once:true});img.src=url;return {p2p:true,bytes:blob.size};
}
export async function hydrateAssetImages(root=document){
 const images=[...root.querySelectorAll('img[data-asset-src]')];
 await Promise.all(images.map(async img=>{const path=img.dataset.assetSrc;if(!safePath(path))return;await loadAssetImage(img,path);delete img.dataset.assetSrc;}));
}
export function warmP2PAssets(){openClient().catch(()=>{});}

async function waitBuffered(channel){
 if(channel.bufferedAmount<524288)return;
 await new Promise(resolve=>{const old=channel.onbufferedamountlow;channel.bufferedAmountLowThreshold=131072;channel.onbufferedamountlow=e=>{channel.onbufferedamountlow=old;if(old)old.call(channel,e);resolve();};setTimeout(resolve,1500);});
}
export function createAdminAssetDonor(adminApi,onState=()=>{},onStats=()=>{}){
 let running=false,generation=0,timer=null,peers=new Map(),cachePromise=null;
 const stats={servedBytes:0,originBytes:0,files:0,cacheHits:0};
 const getCache=()=>cachePromise??=(typeof caches!=='undefined'?caches.open('xanh-p2p-assets-v1'):Promise.resolve(null));
 async function sendAsset(channel,msg){
  if(!safePath(msg.path)||!msg.id)return;
  try{
   const cache=await getCache();let response=cache?await cache.match(msg.path):null,wasCached=Boolean(response);
   if(wasCached){stats.cacheHits++;}else{response=await fetch(msg.path,{cache:'force-cache',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();if(cache)await cache.put(msg.path,response.clone());}
   const blob=await response.blob();
   // A cache miss consumes Render bandwidth once; future clients reuse the cached copy.
   if(!wasCached)stats.originBytes+=blob.size;
   channel.send(JSON.stringify({type:'asset-start',id:msg.id,size:blob.size,mime:blob.type}));
   const buffer=await blob.arrayBuffer(),chunk=16384;
   for(let offset=0;offset<buffer.byteLength;offset+=chunk){await waitBuffered(channel);channel.send(buffer.slice(offset,Math.min(buffer.byteLength,offset+chunk)));}
   channel.send(JSON.stringify({type:'asset-end',id:msg.id}));stats.servedBytes+=blob.size;stats.files++;onStats({...stats,savedBytes:Math.max(0,stats.servedBytes-stats.originBytes)});
  }catch{try{channel.send(JSON.stringify({type:'asset-error',id:msg.id}));}catch{}}
 }
 function closePeer(pairId){const p=peers.get(pairId);if(!p)return;try{p.channel?.close();p.pc.close();}catch{}peers.delete(pairId);}
 async function createPeer(pairId,g){
  if(!running||g!==generation||typeof RTCPeerConnection==='undefined')return;
  closePeer(pairId);const pc=new RTCPeerConnection(ICE),channel=pc.createDataChannel('xanh-assets',{ordered:true});peers.set(pairId,{pc,channel});
  channel.onopen=()=>onState('P2P đang phục vụ '+[...peers.values()].filter(p=>p.channel.readyState==='open').length+' máy.',true);
  channel.onclose=()=>closePeer(pairId);
  channel.onmessage=e=>{if(typeof e.data!=='string')return;let msg;try{msg=JSON.parse(e.data);}catch{return;}if(msg.type==='get')sendAsset(channel,msg);};
  pc.onicecandidate=e=>{if(e.candidate)adminApi('p2p/admin-signal',{pairId,signal:{candidate:e.candidate}}).catch(()=>{});};
  const offer=await pc.createOffer();await pc.setLocalDescription(offer);await adminApi('p2p/admin-signal',{pairId,signal:{description:pc.localDescription}});
 }
 async function poll(g){
  if(!running||g!==generation)return;
  try{
   const r=await adminApi('p2p/admin-poll',{stats});if(!r.enabled){stop(false);onState('Chia sẻ băng thông đã dừng.',false);return;}
   for(const event of r.events||[]){
    if(event.type==='connect')await createPeer(event.pairId,g);
    else if(event.type==='signal'){const p=peers.get(event.pairId);if(!p)continue;const s=event.signal;if(s.description)await p.pc.setRemoteDescription(s.description);else if(s.candidate)try{await p.pc.addIceCandidate(s.candidate);}catch{}}
   }
   onStats({...stats,...r.stats,savedBytes:Math.max(0,stats.servedBytes-stats.originBytes)});
  }catch(error){if(running)onState('P2P đang nối lại: '+error.message,true);}
  finally{if(running&&g===generation)timer=setTimeout(()=>poll(g),350);}
 }
 function stop(notify=true){running=false;generation++;clearTimeout(timer);for(const id of [...peers.keys()])closePeer(id);if(notify)adminApi('p2p/admin-register',{enabled:false}).catch(()=>{});onState('Đã dừng chia sẻ băng thông.',false);}
 return {async start(){if(running)return;if(typeof RTCPeerConnection==='undefined'){onState('Trình duyệt không hỗ trợ WebRTC.',false);return;}running=true;generation++;const g=generation;try{const r=await adminApi('p2p/admin-register',{enabled:true});if(!r.enabled)throw Error('Không bật được P2P');onState('Đang chia sẻ băng thông P2P · chờ người chơi…',true);poll(g);}catch(e){running=false;onState(e.message,false);}},stop,getStats:()=>({...stats,savedBytes:Math.max(0,stats.servedBytes-stats.originBytes)})};
}
