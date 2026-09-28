import {randomUUID} from 'node:crypto';

export function createAssetP2PBroker({now=Date.now,pairTtlMs=30000,maxClients=8,maxSignals=64}={}){
 let adminId=null,adminSeen=0;
 const pairs=new Map(),adminWaiters=new Set(),clientWaiters=new Map();
 const stats={servedBytes:0,originBytes:0,files:0,cacheHits:0,connectionsOpened:0,connectionFailures:0,lastFailure:null,updated:0};
 function wakeClient(pairId){const set=clientWaiters.get(pairId);if(!set)return;for(const wake of [...set])wake();}
 function dropPair(pairId){wakeClient(pairId);clientWaiters.delete(pairId);pairs.delete(pairId);}

 function cleanup(){
  const t=now();
  if(adminId&&t-adminSeen>45000){adminId=null;for(const wake of [...adminWaiters])wake();}
  for(const [id,p] of pairs)if((p.state!=='open'&&t-p.last>pairTtlMs)||!adminId||p.adminId!==adminId)dropPair(id);
 }
 function adminRegister(sessionId,enabled=true){
  cleanup();
  if(!enabled){if(adminId===sessionId)adminId=null;for(const [id,p] of pairs)if(p.adminId===sessionId)dropPair(id);for(const wake of [...adminWaiters])wake();return {enabled:false};}
  adminId=sessionId;adminSeen=now();return {enabled:true};
 }
 function adminPoll(sessionId,reported){
  cleanup();if(adminId!==sessionId)return {enabled:false,events:[],stats:{...stats,pairs:0,connected:0,handshaking:0,maxClients}};
  adminSeen=now();
  if(reported&&typeof reported==='object'){
   for(const key of ['servedBytes','originBytes','files','cacheHits']){const n=Number(reported[key]);if(Number.isFinite(n)&&n>=0)stats[key]=Math.floor(n);}
   stats.updated=now();
  }
  const events=[];
  for(const p of pairs.values())if(p.adminId===sessionId&&p.adminQueue.length)events.push(...p.adminQueue.splice(0));
  let pairsCount=0,connected=0;for(const p of pairs.values())if(p.adminId===sessionId){pairsCount++;if(p.state==='open')connected++;}
  return {enabled:true,events,stats:{...stats,pairs:pairsCount,connected,handshaking:Math.max(0,pairsCount-connected),maxClients,savedBytes:Math.max(0,stats.servedBytes-stats.originBytes)}};
 }
 function connect(clientId){
  cleanup();if(!adminId)return {enabled:false};
  for(const [id,p] of pairs)if(p.clientId===clientId)dropPair(id);
  let clients=0;for(const p of pairs.values())if(p.adminId===adminId)clients++;if(clients>=maxClients)return {enabled:false,reason:'capacity'};
  const pairId=randomUUID(),p={id:pairId,adminId,clientId,state:'handshaking',openedAt:0,diagnostics:{admin:null,client:null},adminQueue:[{type:'connect',pairId}],clientQueue:[],last:now()};
  pairs.set(pairId,p);for(const wake of [...adminWaiters])wake();return {enabled:true,pairId};
 }
 function signal(role,sessionId,{pairId,signal}={}){
  cleanup();const p=pairs.get(pairId);if(!p||!signal||typeof signal!=='object')return {ok:false};
  if(role==='admin'&&p.adminId===sessionId){if(p.clientQueue.length>=maxSignals)return {ok:false};p.clientQueue.push({type:'signal',pairId,signal});wakeClient(pairId);}
  else if(role==='client'&&p.clientId===sessionId){if(p.adminQueue.length>=maxSignals)return {ok:false};p.adminQueue.push({type:'signal',pairId,signal});for(const wake of [...adminWaiters])wake();}
  else return {ok:false};
  p.last=now();return {ok:true};
 }
 function clientPoll(sessionId,{pairId}={}){
  cleanup();const p=pairs.get(pairId);if(!p||p.clientId!==sessionId)return {enabled:false,events:[]};
  p.last=now();return {enabled:true,events:p.clientQueue.splice(0)};
 }
 async function clientWait(sessionId,data={},timeoutMs=1200){
  let result=clientPoll(sessionId,data);if(!result.enabled||result.events.length)return result;const pairId=data.pairId;
  await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);const set=clientWaiters.get(pairId);set?.delete(finish);if(set&&!set.size)clientWaiters.delete(pairId);resolve();};const timer=setTimeout(finish,Math.max(200,Math.min(1500,timeoutMs)));let set=clientWaiters.get(pairId);if(!set)clientWaiters.set(pairId,set=new Set());set.add(finish);});
  return clientPoll(sessionId,data);
 }
 function connectionState(role,sessionId,{pairId,state,diagnostics}={}){
  cleanup();const p=pairs.get(pairId);if(!p)return {ok:false};
  if(role==='admin'&&p.adminId!==sessionId)return {ok:false};
  if(role==='client'&&p.clientId!==sessionId)return {ok:false};
  const cleanDiag=value=>{if(!value||typeof value!=='object')return null;const count=x=>Math.max(0,Math.min(64,Math.floor(Number(x)||0))),cand=v=>({host:count(v?.host),srflx:count(v?.srflx),relay:count(v?.relay),other:count(v?.other)});return {iceState:String(value.iceState||'').slice(0,24),connectionState:String(value.connectionState||'').slice(0,24),local:cand(value.local),remote:cand(value.remote),turnConfigured:value.turnConfigured===true};};
  const diag=cleanDiag(diagnostics);if(diag)p.diagnostics[role]=diag;
  const next=['handshaking','open','failed','closed'].includes(state)?state:'handshaking';const previous=p.state;p.state=next;p.last=now();
  if(next==='open'&&!p.openedAt){p.openedAt=p.last;stats.connectionsOpened++;}
  if(next==='failed'&&previous!=='open'){stats.connectionFailures++;stats.lastFailure={at:p.last,admin:p.diagnostics.admin,client:p.diagnostics.client};}
  if(next==='failed'||next==='closed')dropPair(pairId);for(const wake of [...adminWaiters])wake();
  return {ok:true,state:next};
 }
 function disconnect(role,sessionId,{pairId}={}){
  const p=pairs.get(pairId);if(!p)return {ok:true};
  if(role==='admin'&&p.adminId!==sessionId)return {ok:false};
  if(role==='client'&&p.clientId!==sessionId)return {ok:false};
  dropPair(pairId);return {ok:true};
 }
 async function adminWait(sessionId,reported,timeoutMs=18000){
  let result=adminPoll(sessionId,reported);if(!result.enabled||result.events.length)return result;
  await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);adminWaiters.delete(finish);resolve();};const timer=setTimeout(finish,Math.max(1000,Math.min(20000,timeoutMs)));adminWaiters.add(finish);});
  result=adminPoll(sessionId);return result;
 }
 function publicState(){cleanup();let pairsCount=0,connected=0;if(adminId)for(const p of pairs.values())if(p.adminId===adminId){pairsCount++;if(p.state==='open')connected++;}return {available:Boolean(adminId),pairs:pairsCount,connected,handshaking:Math.max(0,pairsCount-connected),maxClients,connectionsOpened:stats.connectionsOpened,connectionFailures:stats.connectionFailures,lastFailure:stats.lastFailure,servedBytes:stats.servedBytes,originBytes:stats.originBytes,savedBytes:Math.max(0,stats.servedBytes-stats.originBytes)};}
 return {adminRegister,adminPoll,adminWait,connect,signal,clientPoll,clientWait,connectionState,disconnect,publicState,cleanup,_pairs:pairs,_stats:stats};
}
