/* Clara Finanças RC3.5: cache offline completo versionado */
const CACHE_NAME = 'clara-financas-rc3-5-v1';
const APP_FILES = ['./','./index.html','./manifest.webmanifest','./version.json','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install', event => event.waitUntil((async () => {const cache=await caches.open(CACHE_NAME);await cache.addAll(APP_FILES);await self.skipWaiting()})()));
self.addEventListener('activate', event => event.waitUntil((async () => {const names=await caches.keys();await Promise.all(names.filter(name=>name.startsWith('clara-financas-')&&name!==CACHE_NAME).map(name=>caches.delete(name)));await self.clients.claim()})()));
self.addEventListener('fetch', event => {
 if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE_NAME);const url=new URL(event.request.url);const file=event.request.mode==='navigate'?'./index.html':'.'+url.pathname;const hit=await cache.match(file);if(hit)return hit;try{return await fetch(event.request)}catch{if(event.request.mode==='navigate')return await cache.match('./index.html');return Response.error()}})());
});
