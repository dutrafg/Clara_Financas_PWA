/* Política cache-first para assets versionados; nunca armazena os dados financeiros nem requisições que não sejam GET. */
const CACHE='clara-pwa-0.6.0-shell';
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png','./dados-demonstracao.json'])).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('clara-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]));});
self.addEventListener('fetch',e=>{const r=e.request;const u=new URL(r.url);if(r.method!=='GET'||u.origin!==location.origin)return;
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>res).catch(()=>caches.match('./index.html')));return;}
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok&&['script','style','image','font','manifest'].includes(r.destination)){const copy=res.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(r,copy)));}return res;})));
});
