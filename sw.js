/* Clara 4.1.2: Service Worker versionado por pacote + HTML + CSS + JS + código do próprio SW. */
const CACHE_NAME = '__CLARA_CACHE_NAME__';
const APP_FILES = ['./','./index.html','./clara-simple.css','./clara-simple.js','./clara-biometric.css','./clara-biometric.js','./clara-storage-ui.css','./clara-storage-ui.js','./clara-agenda.css','./clara-agenda.js','./clara-premium.css','./clara-guest.css','./clara-guest.js','./clara-extras.css','./clara-extras.js','./clara-backup.js','./manifest.webmanifest','./version.json','./assets/icon-192.png','./assets/icon-512.png'];
const scopedURL = relative => new URL(relative, self.registration.scope);
const versionPath = scopedURL('./version.json').pathname;

// A instalação é atômica: recursos obrigatórios precisam estar íntegros antes
// de oferecer o pacote. Repetir uma falha temporária, sem tocar no cofre
// (OPFS, IndexedDB e localStorage não participam deste ciclo).
async function downloadRequired(path){
 const url=scopedURL(path);
 let lastError;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(new Request(url,{cache:'no-store'}));
   if(!response.ok)throw Error('HTTP '+response.status+' em '+path);
   return {url,response};
  }catch(error){
   lastError=error;
   if(attempt<2)await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));
  }
 }
 throw Error('Recurso obrigatório indisponível: '+path+' ('+(lastError?.message||'rede')+')');
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE_NAME);
 // Promise.allSettled aguarda todas as gravações antes de apagar um cache incompleto,
 // evitando sobras concorrentes quando um único arquivo falhar.
 const results=await Promise.allSettled(APP_FILES.map(async path=>{
  const {url,response}=await downloadRequired(path);
  await cache.put(url, response);
 }));
 const failed=results.find(x=>x.status==='rejected');
 if(failed){
  await caches.delete(CACHE_NAME);
  throw Error('Instalação do Clara não concluída: '+(failed.reason?.message||'falha no cache'));
 }
 // Nunca executar skipWaiting automaticamente; a troca exige aprovação e backup.
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
    // O número de versão NÃO pode ser inferido do cache quando não há rede:
    // uma falha de conexão jamais deve responder com version.json antigo e
    // afirmar incorretamente que o app está atualizado.
    if (url.pathname === versionPath) {
      try { return await fetch(new Request(request, {cache:'no-store'})); }
      catch { return Response.error(); }
    }
    // Pedidos explícitos de recarga procuram a rede e só os recursos estáticos
    // (nunca version.json) podem ter fallback offline para o cache ativo.
    if (request.cache === 'reload' || request.cache === 'no-store') {
      try { return await fetch(request); }
      catch { return await cache.match(request, {ignoreSearch:true}) || Response.error(); }
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
