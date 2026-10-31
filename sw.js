// Clara Finanças: release atômica, sem cache de dados financeiros.
const CACHE='clara-shell-rc3.5-086470d72e6e';
const SHELL=["/", "/index.html", "/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png"];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for(const key of await caches.keys()) if(key.startsWith('clara-shell-') && key!==CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('message',event => {if(event.data?.type==='SKIP_WAITING') self.skipWaiting();});
self.addEventListener('fetch',event => {
  if(event.request.method!=='GET' || new URL(event.request.url).origin!==self.location.origin) return;
  const url=new URL(event.request.url);
  // Sempre rede para sw.js; conteúdo pessoal é apenas localStorage, nunca enviado ou cacheado.
  if(url.pathname.endsWith('/sw.js')) return;
  if(event.request.mode==='navigate') {
    event.respondWith(fetch(event.request).catch(async ()=> (await caches.match('/index.html')) || Response.error()));
  } else if(SHELL.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
  }
});
