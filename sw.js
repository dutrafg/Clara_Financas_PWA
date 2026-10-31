/* Clara Finanças: origem canônica do cache; o build substitui o identificador pelo hash dos recursos. */
const CACHE_NAME = '__CLARA_CACHE_NAME__';
const APP_FILES = ['./','./index.html','./manifest.webmanifest','./version.json','./assets/icon-192.png','./assets/icon-512.png'];
const scopedURL = relative => new URL(relative, self.registration.scope);
const versionPath = scopedURL('./version.json').pathname;

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(APP_FILES.map(path => new Request(scopedURL(path), {cache:'reload'})));
  await self.skipWaiting();
})()));

self.addEventListener('activate', event => event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter(name => name.startsWith('clara-financas-') && name !== CACHE_NAME).map(name => caches.delete(name)));
  await self.clients.claim();
})()));

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    // A consulta de atualizações não pode ficar presa ao version.json em cache.
    if (url.pathname === versionPath) {
      try { return await fetch(request, {cache:'no-store'}); }
      catch { return await cache.match(scopedURL('./version.json')) || Response.error(); }
    }
    if (request.mode === 'navigate') {
      return await cache.match(scopedURL('./index.html')) || await fetch(request);
    }
    const hit = await cache.match(request, {ignoreSearch:true});
    if (hit) return hit;
    try { return await fetch(request); }
    catch { return Response.error(); }
  })());
});
