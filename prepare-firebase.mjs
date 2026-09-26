import {mkdir,writeFile} from 'node:fs/promises';
// Generate a Hosting entry point only after Cloud Run returns its real URL.
const [project,raw]=process.argv.slice(2);
if(!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project||'')) throw new Error('Provide the actual Firebase project ID.');
const url=new URL(raw);
if(url.protocol!=='https:'||!url.hostname.endsWith('.run.app')||url.username||url.password||url.port||url.pathname!=='/'||url.search||url.hash) throw new Error('Provide the HTTPS Cloud Run service origin returned by Google.');
await mkdir('firebase-public',{recursive:true});
await writeFile('firebase-public/404.html','<!doctype html><html lang="vi"><meta charset="utf-8"><title>Xanh Arcade</title><p>Trang không tồn tại. Hãy mở trang chủ Xanh Arcade.</p></html>');
await writeFile('firebase.json',JSON.stringify({hosting:{public:'firebase-public',ignore:['firebase.json','**/.*','**/node_modules/**'],redirects:[{source:'/',destination:url.origin+'/',type:302},{source:'/:path*',destination:url.origin+'/:path',type:302}]}},null,2)+'\n');
await writeFile('.firebaserc',JSON.stringify({projects:{default:project}},null,2)+'\n');
console.log('Prepared Firebase Hosting entry point. Game runs directly on Cloud Run; nothing has been deployed.');
