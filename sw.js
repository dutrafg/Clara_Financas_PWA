/* Clara: pacote versionado, progresso de instalação e rollback do shell não confirmado. */
const CACHE_NAME = '__CLARA_CACHE_NAME__';
const APP_FILES = ['./','./index.html','./clara-simple.css','./clara-simple.js','./clara-biometric.css','./clara-biometric.js','./clara-storage-ui.css','./clara-storage-ui.js','./clara-agenda.css','./clara-agenda.js','./clara-updater.js','./clara-premium.css','./clara-guest.css','./clara-guest.js','./clara-extras.css','./clara-extras.js','./clara-backup.js','./manifest.webmanifest','./version.json','./assets/icon-192.png','./assets/icon-512.png'];
const scopedURL = relative => new URL(relative, self.registration.scope);
const versionPath = scopedURL('./version.json').pathname;
const SYSTEM_CACHE='clara-update-system-v1';
const SYSTEM_STATE_URL=scopedURL('./__clara_update_state__');
const cachePrefix='clara-financas-';

async function readUpdateState(){
 try{
  const response=await (await caches.open(SYSTEM_CACHE)).match(SYSTEM_STATE_URL);
  return response?await response.json():null;
 }catch{return null;}
}
async function writeUpdateState(state){
 const cache=await caches.open(SYSTEM_CACHE);
 await cache.put(SYSTEM_STATE_URL,new Response(JSON.stringify(state),{headers:{'content-type':'application/json'}}));
}
async function servingCacheName(){
 const state=await readUpdateState();
 return state?.current===CACHE_NAME&&state.rolledBack&&state.previous?state.previous:CACHE_NAME;
}
async function announceProgress(done,total,path){
 try{
  const clients=await self.clients.matchAll({includeUncontrolled:true,type:'window'});
  for(const client of clients)client.postMessage({type:'CLARA_UPDATE_PROGRESS',done,total,path});
 }catch{}
}

// A instalação é atômica: recursos obrigatórios precisam estar íntegros antes
// de oferecer o pacote. Repetir uma falha temporária, sem tocar no cofre
// (OPFS, IndexedDB e localStorage não participam deste ciclo).
async function downloadRequired(path){
 const url=scopedURL(path);
 let lastError;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(new Request(url, {cache:'no-store'}));
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
 let done=0;
 await announceProgress(done,APP_FILES.length,'');
 const results=await Promise.allSettled(APP_FILES.map(async path=>{
  const {url,response}=await downloadRequired(path);
  await cache.put(url, response);
  done++;
  await announceProgress(done,APP_FILES.length,path);
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
  const priorState=await readUpdateState();
  const previous=priorState?.current&&priorState.current!==CACHE_NAME&&names.includes(priorState.current)
    ?priorState.current
    :names.filter(name=>name.startsWith(cachePrefix)&&name!==CACHE_NAME).at(-1)||null;
  // Preserve the preceding complete package until the candidate app confirms
  // that its critical scripts initialized successfully.
  await writeUpdateState({current:CACHE_NAME,previous,rolledBack:false,confirmed:!previous});
  await self.clients.claim();
})()));

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;

  event.respondWith((async () => {
    const cache = await caches.open(await servingCacheName());
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

self.addEventListener('message',event=>{
 const type=event.data?.type;
 if(type==='SKIP_WAITING'){self.skipWaiting();return;}
 event.waitUntil((async()=>{
  const state=await readUpdateState();
  // A página que disparou a atualização ainda executa o pacote anterior.
  // Só a nova shell pode confirmar ou reprovar o boot deste cache.
  if(!state||state.current!==CACHE_NAME||event.data.cacheName!==CACHE_NAME)return;
  if(type==='CLARA_BOOT_OK'&&!state.rolledBack){
   state.confirmed=true;
   await writeUpdateState(state);
   const names=await caches.keys();
   await Promise.all(names.filter(name=>name.startsWith(cachePrefix)&&name!==CACHE_NAME).map(name=>caches.delete(name)));
   event.source?.postMessage({type:'CLARA_BOOT_CONFIRMED'});
  }else if(type==='CLARA_BOOT_FAILED'){
   if(state.previous&&await caches.has(state.previous)){
    state.rolledBack=true;state.confirmed=false;
    await writeUpdateState(state);
    event.source?.postMessage({type:'CLARA_ROLLBACK_SELECTED'});
   }else event.source?.postMessage({type:'CLARA_ROLLBACK_UNAVAILABLE'});
  }else if(type==='CLARA_RETRY_CANDIDATE'&&state.previous&&await caches.has(state.previous)){
   state.rolledBack=false;state.confirmed=false;
   await writeUpdateState(state);
   event.source?.postMessage({type:'CLARA_CANDIDATE_RETRY_SELECTED'});
  }
 })());
});
