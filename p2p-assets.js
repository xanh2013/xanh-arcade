const SAFE_ASSET=/^\/(?:fortnite-assets\/[A-Za-z0-9_-]+\.(?:svg|json)|cover-(?:runner|blocks|caro|chess)-v2\.webp|background-(?:runner|space)-v2\.webp)$/;
const ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const api=async(op,data={})=>{const r=await fetch('/api/p2p/'+op,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(5000)});let value={};try{value=await r.json();}catch{}if(!r.ok)throw Error(value.error||'P2P signaling failed');return value;};
const safePath=path=>typeof path==='string'&&SAFE_ASSET.test(path);
let manifestPromise=null;
const getManifest=()=>manifestPromise??=api('manifest').catch(()=>({assets:{},version:'unknown'}));
function base64url(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
async function verifyAsset(path,blob){
 const meta=(await getManifest()).assets?.[path];if(!meta)return false;
 if(meta.bytes!==blob.size)return false;
 if(!globalThis.crypto?.subtle)return false;
 const hash=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
 return base64url(new Uint8Array(hash))===meta.sha256;
}

let clientPromise=null,clientChannel=null,clientPair=null,currentTransfer=null,clientPeer=null,clientUnavailableUntil=0;const assetMemory=new Map();
async function signalClient(signal){if(clientPair)await api('client-signal',{pairId:clientPair,signal});}
function resetClient({state='closed',backoff=3000}={}){
 const pairId=clientPair,pc=clientPeer,channel=clientChannel;clientPair=null;clientPeer=null;clientChannel=null;currentTransfer=null;clientUnavailableUntil=Date.now()+backoff;
 try{if(channel){channel.onclose=null;channel.close();}}catch{}try{if(pc)pc.close();}catch{}
 if(pairId)api('client-state',{pairId,state}).catch(()=>{});
}
function setupClientChannel(channel){
 clientChannel=channel;channel.binaryType='arraybuffer';
 channel.onopen=()=>{if(clientPair)api('client-state',{pairId:clientPair,state:'open'}).catch(()=>{});};
 channel.onclose=()=>{if(clientChannel===channel)resetClient({state:'closed',backoff:2500});};
 channel.onerror=()=>{};
 channel.onmessage=e=>{
  if(typeof e.data==='string'){
   let msg;try{msg=JSON.parse(e.data);}catch{return;}
   const t=currentTransfer;if(!t||msg.id!==t.id)return;
   if(msg.type==='asset-start'){t.type=msg.mime||'application/octet-stream';t.expected=msg.size||0;t.received=0;t.chunks=[];}
   else if(msg.type==='asset-end'){clearTimeout(t.timer);currentTransfer=null;if(t.expected&&t.received!==t.expected){t.resolve(null);return;}t.resolve(new Blob(t.chunks,{type:t.type}));}
   else if(msg.type==='asset-error'){clearTimeout(t.timer);currentTransfer=null;t.resolve(null);}
  }else if(currentTransfer){currentTransfer.chunks.push(e.data);currentTransfer.received+=(e.data?.byteLength||0);}
 };
}
async function connectClient(){
 if(clientChannel?.readyState==='open')return clientChannel;
 if(Date.now()<clientUnavailableUntil)return null;
 if(clientPromise)return clientPromise;
 clientPromise=(async()=>{
  if(typeof RTCPeerConnection==='undefined')return null;
  const start=await api('client-connect');if(!start.enabled){clientUnavailableUntil=Date.now()+8000;return null;}clientPair=start.pairId;
  const pc=clientPeer=new RTCPeerConnection(ICE);
  pc.onicecandidate=e=>{if(e.candidate)signalClient({candidate:e.candidate}).catch(()=>{});};
  pc.ondatachannel=e=>setupClientChannel(e.channel);
  pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')resetClient({state:'failed',backoff:5000});};
  const deadline=performance.now()+8000;
  try{
   while(clientPair===start.pairId&&performance.now()<deadline){
    const polled=await api('client-poll',{pairId:start.pairId});
    if(!polled.enabled)break;
    for(const event of polled.events||[])if(event.type==='signal'){
     const s=event.signal;
     if(s.description){await pc.setRemoteDescription(s.description);if(s.description.type==='offer'){const answer=await pc.createAnswer();await pc.setLocalDescription(answer);await signalClient({description:pc.localDescription});}}
     else if(s.candidate)try{await pc.addIceCandidate(s.candidate);}catch{}
    }
    if(clientChannel?.readyState==='open')return clientChannel;
    if(pc.connectionState==='failed'||pc.iceConnectionState==='failed')break;
    await sleep(100);
   }
  }catch{}
  if(clientPair===start.pairId)resetClient({state:'failed',backoff:5000});return null;
 })().finally(()=>{clientPromise=null;});
 return clientPromise;
}
async function channelSoon(waitMs=180){
 if(clientChannel?.readyState==='open')return clientChannel;
 const connecting=connectClient().catch(()=>null);
 return Promise.race([connecting,sleep(waitMs).then(()=>clientChannel?.readyState==='open'?clientChannel:null)]);
}
let queue=Promise.resolve();
export async function fetchAssetBlob(path){
 if(!safePath(path))return null;
 if(assetMemory.has(path))return assetMemory.get(path);
 const channel=await channelSoon();if(!channel||channel.readyState!=='open')return null;
 const work=()=>new Promise(resolve=>{
  const id=Math.random().toString(36).slice(2)+Date.now().toString(36),timer=setTimeout(()=>{if(currentTransfer?.id===id)currentTransfer=null;resolve(null);},8000);
  currentTransfer={id,resolve,timer,chunks:[],type:'application/octet-stream',expected:0,received:0};
  try{channel.send(JSON.stringify({type:'get',id,path}));}catch{clearTimeout(timer);currentTransfer=null;resolve(null);}
 });
 const result=queue.then(work,work).then(async blob=>{if(blob&&!await verifyAsset(path,blob))return null;if(blob)assetMemory.set(path,blob);return blob;});queue=result.catch(()=>null);return result;
}
export async function assetObjectURL(path){const blob=await fetchAssetBlob(path);return blob?URL.createObjectURL(blob):path;}
export async function loadAssetImage(img,path){
 const blob=await fetchAssetBlob(path);if(!blob){img.src=path;return {p2p:false};}
 const url=URL.createObjectURL(blob);img.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true});img.addEventListener('error',()=>URL.revokeObjectURL(url),{once:true});img.src=url;return {p2p:true,bytes:blob.size};
}
export async function hydrateAssetImages(root=document){const images=[...root.querySelectorAll('img[data-asset-src]')];await Promise.all(images.map(async img=>{const path=img.dataset.assetSrc;if(!safePath(path))return;await loadAssetImage(img,path);delete img.dataset.assetSrc;}));}
export function warmP2PAssets(){connectClient().catch(()=>{});}

async function waitBuffered(channel){
 if(channel.bufferedAmount<524288)return;
 await new Promise(resolve=>{const old=channel.onbufferedamountlow;channel.bufferedAmountLowThreshold=131072;channel.onbufferedamountlow=e=>{channel.onbufferedamountlow=old;if(old)old.call(channel,e);resolve();};setTimeout(resolve,1500);});
}
export function createAdminAssetDonor(adminApi,onState=()=>{},onStats=()=>{}){
 let running=false,generation=0,timer=null,peers=new Map(),cachePromise=null;
 const stats={servedBytes:0,originBytes:0,files:0,cacheHits:0};let remoteStats={pairs:0,connected:0,handshaking:0,maxClients:0};
 const getCache=()=>cachePromise??=(typeof caches!=='undefined'?getManifest().then(m=>caches.open('xanh-p2p-assets-'+String(m.version||'v1'))):Promise.resolve(null));
 async function sendAsset(channel,msg){
  if(!safePath(msg.path)||!msg.id)return;
  try{
   const cache=await getCache();let response=cache?await cache.match(msg.path):null,wasCached=Boolean(response);
   if(wasCached){stats.cacheHits++;}else{response=await fetch(msg.path,{cache:'force-cache',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();if(cache)await cache.put(msg.path,response.clone());}
   const blob=await response.blob();
   if(!await verifyAsset(msg.path,blob)){if(cache)await cache.delete(msg.path);throw Error('Asset integrity mismatch');}
   // A cache miss consumes Render bandwidth once; future clients reuse the cached copy.
   if(!wasCached)stats.originBytes+=blob.size;
   channel.send(JSON.stringify({type:'asset-start',id:msg.id,size:blob.size,mime:blob.type}));
   const buffer=await blob.arrayBuffer(),chunk=16384;
   for(let offset=0;offset<buffer.byteLength;offset+=chunk){await waitBuffered(channel);channel.send(buffer.slice(offset,Math.min(buffer.byteLength,offset+chunk)));}
   channel.send(JSON.stringify({type:'asset-end',id:msg.id}));stats.servedBytes+=blob.size;stats.files++;onStats({...stats,...remoteStats,savedBytes:Math.max(0,stats.servedBytes-stats.originBytes)});
  }catch{try{channel.send(JSON.stringify({type:'asset-error',id:msg.id}));}catch{}}
 }
 function closePeer(pairId,state='closed',notify=true){const peer=peers.get(pairId);if(!peer)return;peers.delete(pairId);try{peer.channel.onclose=null;peer.pc.onconnectionstatechange=null;peer.channel?.close();peer.pc.close();}catch{}if(notify)adminApi('p2p/admin-state',{pairId,state}).catch(()=>{});}
 async function createPeer(pairId,g){
  if(!running||g!==generation||typeof RTCPeerConnection==='undefined')return;
  closePeer(pairId,'closed',false);const pc=new RTCPeerConnection(ICE),channel=pc.createDataChannel('xanh-assets',{ordered:true});peers.set(pairId,{pc,channel,sendQueue:Promise.resolve()});
  channel.onopen=()=>{adminApi('p2p/admin-state',{pairId,state:'open'}).catch(()=>{});const direct=[...peers.values()].filter(p=>p.channel.readyState==='open').length;onState('P2P trực tiếp đang phục vụ '+direct+' máy.',true);};
  channel.onclose=()=>closePeer(pairId,'closed',true);
  channel.onmessage=e=>{if(typeof e.data!=='string'||e.data.length>512)return;let msg;try{msg=JSON.parse(e.data);}catch{return;}if(msg.type==='get'){const peer=peers.get(pairId);if(peer)peer.sendQueue=peer.sendQueue.then(()=>sendAsset(channel,msg),()=>sendAsset(channel,msg));}};
  pc.onicecandidate=e=>{if(e.candidate)adminApi('p2p/admin-signal',{pairId,signal:{candidate:e.candidate}}).catch(()=>{});};
  pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')closePeer(pairId,'failed',true);};
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
   remoteStats={pairs:r.stats?.pairs||0,connected:r.stats?.connected||0,handshaking:r.stats?.handshaking||0,maxClients:r.stats?.maxClients||0};onStats({...stats,...remoteStats,savedBytes:Math.max(0,stats.servedBytes-stats.originBytes)});
  }catch(error){if(running)onState('P2P đang nối lại: '+error.message,true);}
  finally{if(running&&g===generation)timer=setTimeout(()=>poll(g),25);}
 }
 function stop(notify=true){running=false;generation++;clearTimeout(timer);for(const id of [...peers.keys()])closePeer(id,'closed',false);if(notify)adminApi('p2p/admin-register',{enabled:false}).catch(()=>{});onState('Đã dừng chia sẻ băng thông.',false);}
 async function preload(){
  const manifest=await getManifest(),entries=Object.entries(manifest.assets||{}),cache=await getCache();let done=0,misses=0;
  for(const [path,meta] of entries){
   let response=cache?await cache.match(path):null;
   if(!response){response=await fetch(path,{cache:'reload',signal:AbortSignal.timeout(15000)});if(!response.ok)continue;const blob=await response.blob();if(!await verifyAsset(path,blob))continue;if(cache)await cache.put(path,new Response(blob,{headers:{'Content-Type':meta.type||blob.type}}));stats.originBytes+=blob.size;misses++;}
   done++;if(done%10===0||done===entries.length){onState('Đang nạp cache P2P '+done+' / '+entries.length+'…',running);onStats({...stats,...remoteStats,savedBytes:Math.max(0,stats.servedBytes-stats.originBytes)});}
  }
  onState('Cache P2P sẵn sàng · '+done+' file'+(misses?' · tải mới '+misses:' · không cần tải mới'),running);return {done,misses};
 }
 return {async start(){if(running)return;if(typeof RTCPeerConnection==='undefined'){onState('Trình duyệt không hỗ trợ WebRTC.',false);return;}running=true;generation++;const g=generation;try{const r=await adminApi('p2p/admin-register',{enabled:true});if(!r.enabled)throw Error('Không bật được P2P');onState('Đang chia sẻ băng thông P2P · chờ người chơi…',true);poll(g);}catch(e){running=false;onState(e.message,false);}},stop,preload,getStats:()=>({...stats,savedBytes:Math.max(0,stats.servedBytes-stats.originBytes)})};
}
