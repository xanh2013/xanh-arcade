import assert from 'node:assert/strict';
import {readdir,stat} from 'node:fs/promises';
import path from 'node:path';
const root=new URL('.',import.meta.url);
const entries=await readdir(root,{withFileTypes:true});
let runtimeBytes=0,cssBytes=0,htmlBytes=0,totalStatic=0,largest={name:'',bytes:0};
for(const entry of entries){
 if(!entry.isFile())continue;
 const name=entry.name,s=(await stat(new URL(name,root))).size;
 if(/\.(js|mjs)$/.test(name)&&!/-test\.mjs$/.test(name)&&!/(benchmark|prepare-firebase)\.mjs$/.test(name)){runtimeBytes+=s;if(s>largest.bytes)largest={name,bytes:s};}
 if(/\.css$/.test(name))cssBytes+=s;
 if(/\.html$/.test(name))htmlBytes+=s;
 if(/\.(?:js|mjs|css|html|svg|webp|json|webmanifest)$/.test(name)&&!/-test\.mjs$/.test(name))totalStatic+=s;
}
assert.ok(runtimeBytes<450_000,'Runtime JS/MJS budget exceeded: '+runtimeBytes);
assert.ok(cssBytes<90_000,'CSS budget exceeded: '+cssBytes);
assert.ok(htmlBytes<70_000,'HTML budget exceeded: '+htmlBytes);
assert.ok(largest.bytes<60_000,'Single runtime module too large: '+largest.name+' '+largest.bytes);
assert.ok(totalStatic<2_000_000,'Top-level static budget exceeded: '+totalStatic);
console.log('PASS performance budgets: runtime '+runtimeBytes+' B, CSS '+cssBytes+' B, HTML '+htmlBytes+' B, largest '+largest.name+' '+largest.bytes+' B.');
