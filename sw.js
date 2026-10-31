/* Clara Finanças: origem canônica do cache; o build substitui o identificador pelo hash dos recursos. */
const CACHE_NAME = '__CLARA_CACHE_NAME__';
const APP_FILES = ['./','./index.html','./manifest.webmanifest','./version.json','./assets/icon-192.png','./assets/icon-512.png'];
const scopedURL = relative => new URL(relative, self.registration.scope);
const versionPath = scopedURL('./version.json').pathname;

self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE_NAME);
  // Não reutilizar respostas mantidas em cache por um controlador anterior.
  // Cada recurso deve vir da rede e ser gravado pelo caminho canônico,
  // inclusive durante uma troca de versão ainda controlada pelo SW antigo.
  await Promise.all(APP_FILES.map(async path => {
    const url = scopedURL(path);
    const response = await fetch(new Request(url, {cache:'no-store'}));
    if (!response.ok) throw Error('Falha ao preparar atualização PWA: ' + path);
    await cache.put(url, response);
  }));
  // O novo SW fica aguardando confirmação pelo atualizador da interface.
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
    // Pedidos de atualização do navegador ou de um novo Service Worker devem buscar a rede.
    // Caso contrário, o controlador anterior pode devolver recursos obsoletos do próprio cache.
    if (request.cache === 'reload' || request.cache === 'no-store') {
      try { return await fetch(request); }
      catch { return await cache.match(request, {ignoreSearch:true}) || Response.error(); }
    }
    // A consulta de atualizações não pode ficar presa ao version.json em cache.
    if (url.pathname === versionPath) {
      try { return await fetch(request, {cache:'no-store'}); }
      catch { return await cache.match(scopedURL('./version.json')) || Response.error(); }
    }
    if (request.mode === 'navigate') {
      // Navegação sempre tenta HTML novo pela rede. Somente offline usa a versão instalada.
      try {
        const fresh = await fetch(new Request(request, {cache:'no-store'}));
        if (fresh.ok) return fresh;
      } catch {}
      return await cache.match(scopedURL('./index.html')) || Response.error();
    }
    const hit = await cache.match(request, {ignoreSearch:true});
    if (hit) return hit;
    try { return await fetch(request); }
    catch { return Response.error(); }
  })());
});

self.addEventListener('message', event => {
  if(event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
