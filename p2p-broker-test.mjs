import assert from 'node:assert/strict';
import {createAssetP2PBroker} from './p2p-broker.mjs';

let clock=1000;const now=()=>clock;
const b=createAssetP2PBroker({now,pairTtlMs:5000});
assert.equal(b.publicState().available,false);
assert.equal(b.connect('client-a').enabled,false);
assert.equal(b.adminRegister('admin-a',true).enabled,true);
assert.equal(b.publicState().available,true);

const waiting=b.adminWait('admin-a',null,1000);await new Promise(r=>setTimeout(r,5));const wakeLink=b.connect('client-wake');const woke=await waiting;assert.equal(woke.events.some(e=>e.pairId===wakeLink.pairId),true);b.disconnect('client','client-wake',{pairId:wakeLink.pairId});

const link=b.connect('client-a');assert.equal(link.enabled,true);assert.ok(link.pairId);
let publicState=b.publicState();assert.equal(publicState.pairs,1);assert.equal(publicState.handshaking,1);assert.equal(publicState.connected,0);
let admin=b.adminPoll('admin-a');assert.equal(admin.events.length,1);assert.equal(admin.events[0].type,'connect');assert.equal(admin.events[0].pairId,link.pairId);
assert.equal(b.signal('admin','admin-a',{pairId:link.pairId,signal:{description:{type:'offer',sdp:'x'}}}).ok,true);
let client=b.clientPoll('client-a',{pairId:link.pairId});assert.equal(client.events.length,1);assert.equal(client.events[0].signal.description.type,'offer');
assert.equal(b.signal('client','client-a',{pairId:link.pairId,signal:{description:{type:'answer',sdp:'y'}}}).ok,true);
assert.equal(b.connectionState('admin','admin-a',{pairId:link.pairId,state:'open'}).ok,true);
admin=b.adminPoll('admin-a',{servedBytes:3000,originBytes:1000,files:3,cacheHits:2});assert.equal(admin.events[0].signal.description.type,'answer');assert.equal(admin.stats.savedBytes,2000);assert.equal(admin.stats.pairs,1);assert.equal(admin.stats.connected,1);assert.equal(admin.stats.handshaking,0);assert.equal(admin.stats.connectionsOpened,1);
clock+=6000;b.cleanup();assert.equal(b.publicState().connected,1);assert.equal(b.clientPoll('client-a',{pairId:link.pairId}).enabled,true);
assert.equal(b.connectionState('client','client-a',{pairId:link.pairId,state:'closed'}).ok,true);assert.equal(b.publicState().pairs,0);assert.equal(b.publicState().connectionsOpened,1);

const bad=b.connect('client-bad');assert.equal(b.connectionState('admin','admin-a',{pairId:bad.pairId,state:'handshaking',diagnostics:{iceState:'checking',connectionState:'connecting',iceErrors:1,local:{host:2,srflx:1,relay:0},remote:{host:1,srflx:0,relay:0},turnConfigured:false,ip:'10.0.0.1'}}).ok,true);assert.equal(b.connectionState('client','client-bad',{pairId:bad.pairId,state:'failed',diagnostics:{iceState:'failed',connectionState:'failed',iceErrors:2,local:{host:1,srflx:0,relay:0},remote:{host:1,srflx:1,relay:0},turnConfigured:false,candidate:'secret'}}).ok,true);admin=b.adminPoll('admin-a');assert.equal(admin.stats.connectionFailures,1);const publicFail=b.publicState().lastFailure;assert.equal(publicFail.admin.local.srflx,1);assert.equal(publicFail.client.iceErrors,2);assert.equal('ip' in publicFail.admin,false);assert.equal('candidate' in publicFail.client,false);assert.equal(JSON.stringify(publicFail).includes('10.0.0.1'),false);
assert.equal(b.signal('client','other',{pairId:'missing',signal:{candidate:{candidate:'bad'}}}).ok,false);

clock+=50000;b.cleanup();assert.equal(b.publicState().available,false);

const cap=createAssetP2PBroker({now,maxClients:2});cap.adminRegister('admin-cap',true);const c1=cap.connect('c1'),c2=cap.connect('c2'),c3=cap.connect('c3');assert.equal(c1.enabled,true);assert.equal(c2.enabled,true);assert.equal(c3.enabled,false);assert.equal(c3.reason,'capacity');assert.equal(cap.publicState().pairs,2);assert.equal(cap.publicState().maxClients,2);
console.log('PASS P2P broker: signaling, true DataChannel state, TTL behavior, failure counters, capacity and byte accounting.');
