/* Clara 4.1.1: Service Worker versionado por pacote + HTML + CSS + JS + código do próprio SW. */
const CACHE_NAME = '__CLARA_CACHE_NAME__';
const APP_FILES = ['./','./index.html','./clara-simple.css','./clara-simple.js','./clara-biometric.css','./clara-biometric.js','./clara-storage-ui.css','./clara-storage-ui.js','./clara-agenda.css','./clara-agenda.js','./clara-premium.css','./clara-guest.css','./clara-guest.js','./manifest.webmanifest','./version.json','./assets/icon-192.png','./assets/icon-512.png'];
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
      // Não substituir silenciosamente um PWA instalado: a nova shell só é
      // servida depois que o usuário confirma a troca de Service Worker.
      const installed = await cache.match(scopedURL('./index.html'));
      if (installed) return installed;
      try { return await fetch(request); }
      catch { return Response.error(); }
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
