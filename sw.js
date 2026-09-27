const CORE=['/','/style.css','/app.js','/games.js','/game-rules.js','/p2p-assets.js','/favicon.svg','/manifest.webmanifest'];
const HEAVY=/^\/(?:fortnite-assets\/|cover-|background-)/;
const STATIC=/\.(?:js|mjs|css|svg|webp|json|webmanifest)$/;
let buildPromise;
async function build(){if(!buildPromise)buildPromise=fetch('/health',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(v=>v?.build||'dev').catch(()=>'offline');return buildPromise;}
async function cacheName(){return 'xanh-static-'+await build();}
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(await cacheName());await Promise.allSettled(CORE.map(url=>cache.add(new Request(url,{cache:'reload'}))));self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const keep=await cacheName();for(const name of await caches.keys())if(name.startsWith('xanh-static-')&&name!==keep)await caches.delete(name);await self.clients.claim();})()));
async function cacheFirst(request){const cache=await caches.open(await cacheName()),hit=await cache.match(request);if(hit)return hit;const response=await fetch(request);if(response.ok)cache.put(request,response.clone());return response;}
async function freshWithFallback(request){const cache=await caches.open(await cacheName());try{const response=await fetch(request);if(response.ok)cache.put(request,response.clone());return response;}catch{const hit=await cache.match(request);if(hit)return hit;throw new Error('offline');}}
self.addEventListener('fetch',event=>{const request=event.request;if(request.method!=='GET')return;const url=new URL(request.url);if(url.origin!==location.origin||url.pathname.startsWith('/api/'))return;if(request.mode==='navigate'){event.respondWith(freshWithFallback(request));return;}if(HEAVY.test(url.pathname)){event.respondWith(cacheFirst(request));return;}if(STATIC.test(url.pathname)){event.respondWith(freshWithFallback(request));}});
