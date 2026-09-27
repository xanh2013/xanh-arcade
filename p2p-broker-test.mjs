import assert from 'node:assert/strict';
import {createAssetP2PBroker} from './p2p-broker.mjs';

let clock=1000;const now=()=>clock;
const b=createAssetP2PBroker({now,pairTtlMs:5000});
assert.equal(b.publicState().available,false);
assert.equal(b.connect('client-a').enabled,false);
assert.equal(b.adminRegister('admin-a',true).enabled,true);
assert.equal(b.publicState().available,true);
const link=b.connect('client-a');assert.equal(link.enabled,true);assert.ok(link.pairId);
let admin=b.adminPoll('admin-a');assert.equal(admin.events.length,1);assert.equal(admin.events[0].type,'connect');assert.equal(admin.events[0].pairId,link.pairId);
assert.equal(b.signal('admin','admin-a',{pairId:link.pairId,signal:{description:{type:'offer',sdp:'x'}}}).ok,true);
let client=b.clientPoll('client-a',{pairId:link.pairId});assert.equal(client.events.length,1);assert.equal(client.events[0].signal.description.type,'offer');
assert.equal(b.signal('client','client-a',{pairId:link.pairId,signal:{description:{type:'answer',sdp:'y'}}}).ok,true);
admin=b.adminPoll('admin-a',{servedBytes:3000,originBytes:1000,files:3,cacheHits:2});assert.equal(admin.events[0].signal.description.type,'answer');assert.equal(admin.stats.savedBytes,2000);assert.equal(admin.stats.clients,1);
assert.equal(b.signal('client','other',{pairId:link.pairId,signal:{candidate:{candidate:'bad'}}}).ok,false);
clock+=6000;b.cleanup();assert.equal(b.clientPoll('client-a',{pairId:link.pairId}).enabled,false);
clock+=50000;b.cleanup();assert.equal(b.publicState().available,false);
console.log('PASS P2P broker: admin registration, client pairing, bidirectional signaling, byte accounting and expiry.');
