import {randomUUID} from 'node:crypto';

export function createAssetP2PBroker({now=Date.now,pairTtlMs=30000}={}){
 let adminId=null,adminSeen=0;
 const pairs=new Map(),adminWaiters=new Set();
 const stats={servedBytes:0,originBytes:0,files:0,cacheHits:0,updated:0};

 function cleanup(){
  const t=now();
  if(adminId&&t-adminSeen>45000){adminId=null;for(const wake of [...adminWaiters])wake();}
  for(const [id,p] of pairs)if(t-p.last>pairTtlMs||!adminId||p.adminId!==adminId)pairs.delete(id);
 }
 function adminRegister(sessionId,enabled=true){
  cleanup();
  if(!enabled){if(adminId===sessionId)adminId=null;for(const [id,p] of pairs)if(p.adminId===sessionId)pairs.delete(id);for(const wake of [...adminWaiters])wake();return {enabled:false};}
  adminId=sessionId;adminSeen=now();return {enabled:true};
 }
 function adminPoll(sessionId,reported){
  cleanup();if(adminId!==sessionId)return {enabled:false,events:[],stats:{...stats,clients:0}};
  adminSeen=now();
  if(reported&&typeof reported==='object'){
   for(const key of ['servedBytes','originBytes','files','cacheHits']){const n=Number(reported[key]);if(Number.isFinite(n)&&n>=0)stats[key]=Math.floor(n);}
   stats.updated=now();
  }
  const events=[];
  for(const p of pairs.values())if(p.adminId===sessionId&&p.adminQueue.length)events.push(...p.adminQueue.splice(0));
  const clients=[...pairs.values()].filter(p=>p.adminId===sessionId).length;
  return {enabled:true,events,stats:{...stats,clients,savedBytes:Math.max(0,stats.servedBytes-stats.originBytes)}};
 }
 function connect(clientId){
  cleanup();if(!adminId)return {enabled:false};
  for(const [id,p] of pairs)if(p.clientId===clientId)pairs.delete(id);
  const pairId=randomUUID(),p={id:pairId,adminId,clientId,adminQueue:[{type:'connect',pairId}],clientQueue:[],last:now()};
  pairs.set(pairId,p);for(const wake of [...adminWaiters])wake();return {enabled:true,pairId};
 }
 function signal(role,sessionId,{pairId,signal}={}){
  cleanup();const p=pairs.get(pairId);if(!p||!signal||typeof signal!=='object')return {ok:false};
  if(role==='admin'&&p.adminId===sessionId)p.clientQueue.push({type:'signal',pairId,signal});
  else if(role==='client'&&p.clientId===sessionId){p.adminQueue.push({type:'signal',pairId,signal});for(const wake of [...adminWaiters])wake();}
  else return {ok:false};
  p.last=now();return {ok:true};
 }
 function clientPoll(sessionId,{pairId}={}){
  cleanup();const p=pairs.get(pairId);if(!p||p.clientId!==sessionId)return {enabled:false,events:[]};
  p.last=now();return {enabled:true,events:p.clientQueue.splice(0)};
 }
 function disconnect(role,sessionId,{pairId}={}){
  const p=pairs.get(pairId);if(!p)return {ok:true};
  if(role==='admin'&&p.adminId!==sessionId)return {ok:false};
  if(role==='client'&&p.clientId!==sessionId)return {ok:false};
  pairs.delete(pairId);return {ok:true};
 }
 async function adminWait(sessionId,reported,timeoutMs=18000){
  let result=adminPoll(sessionId,reported);if(!result.enabled||result.events.length)return result;
  await new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timer);adminWaiters.delete(finish);resolve();};const timer=setTimeout(finish,Math.max(1000,Math.min(20000,timeoutMs)));adminWaiters.add(finish);});
  result=adminPoll(sessionId);return result;
 }
 function publicState(){cleanup();return {available:Boolean(adminId)};}
 return {adminRegister,adminPoll,adminWait,connect,signal,clientPoll,disconnect,publicState,cleanup,_pairs:pairs,_stats:stats};
}
