/* Clara: pacote versionado, progresso de instalação e rollback do shell não confirmado. */
const CACHE_NAME = '__CLARA_CACHE_NAME__';
const APP_FILES = ['./','./index.html','./clara-simple.css','./clara-simple.js','./clara-biometric.css','./clara-biometric.js','./clara-storage-ui.css','./clara-storage-ui.js','./clara-agenda.css','./clara-agenda.js','./clara-updater.js','./clara-premium.css','./clara-guest.css','./clara-guest.js','./clara-extras.css','./clara-extras.js','./clara-backup.js','./manifest.webmanifest','./version.json','./assets/icon-192.png','./assets/icon-512.png'];
const scopedURL = relative => new URL(relative, self.registration.scope);
const versionPath = scopedURL('./version.json').pathname;
const SYSTEM_CACHE='clara-update-system-v1';
const SYSTEM_STATE_URL=scopedURL('./__clara_update_state__');
const cachePrefix='clara-financas-';
// Cache temporário NÃO usa o prefixo de releases: o worker anterior
// pode limpar caches de releases enquanto um novo pacote está em espera.
const STAGING_CACHE='clara-stage-'+CACHE_NAME.slice(cachePrefix.length);

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
// O staging tem prefixo diferente do cache de versões antigas. Mantê-lo
// até o próximo boot evita que uma limpeza tardia do worker anterior deixe
// o PWA sem shell quando a nova versão já tiver sido ativada.
async function stagedHit(url,options){
 const names=await caches.keys();
 return names.includes(STAGING_CACHE)?(await caches.open(STAGING_CACHE)).match(url,options):null;
}
async function promoteStaging(){
 const staged=await caches.open(STAGING_CACHE);
 const current=await caches.open(CACHE_NAME);
 for(const path of APP_FILES){
  const url=scopedURL(path);
  const response=await staged.match(url);
  if(!response?.ok)throw Error('Arquivo offline ausente na promoção: '+path);
  await current.put(url,response);
 }
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
 const cache=await caches.open(STAGING_CACHE);
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
  // Não apagar um estágio compartilhado: outra tentativa da mesma revisão
  // pode ter completado o download enquanto esta recebeu erro de rede.
  // Sem install bem-sucedido, este pacote nunca será promovido nem servido.
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

  // Marcar o candidato antes de promovê-lo impede o worker antigo de apagar
  // a revisão em uma confirmação tardia. O worker antigo continua servindo o
  // próprio CACHE_NAME enquanto a nova ativação não for concluída.
  await writeUpdateState({current:CACHE_NAME,previous,rolledBack:false,confirmed:!previous});
  try{
   await promoteStaging();
   // Não descartar staging aqui: outro worker pode ainda ter em andamento
   // uma confirmação antiga que apague CACHE_NAME após esta promoção.
  }catch(error){
   await caches.delete(CACHE_NAME);
   if(priorState)await writeUpdateState(priorState);
   else await caches.delete(SYSTEM_CACHE);
   throw error;
  }
  // Só então a nova shell assume clientes; o pacote anterior continua
  // disponível para rollback até que a inicialização seja confirmada.
  await self.clients.claim();
})()));

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;

  event.respondWith((async () => {
    const serving=await servingCacheName();
    const cache = await caches.open(serving);
    // O número de versão NÃO pode ser inferido do cache quando não há rede:
    // uma falha de conexão jamais deve responder com version.json antigo e
    // afirmar incorretamente que o app está atualizado.
    if (url.pathname === versionPath) {
      try { return await fetch(new Request(request, {cache:'no-store'})); }
      catch { return Response.error(); }
    }
    // Fetch explícito de diagnóstico (destination vazia) pede rede fresca.
    // Navegação e recursos executáveis continuam presos à revisão aprovada.
    if (request.cache === 'no-store' && !request.destination) {
      try { return await fetch(request); }
      catch { return Response.error(); }
    }
    // Inclusive em Ctrl+F5, servir o shell do pacote aprovado. Buscar index.html
    // na rede antes da troca consentida misturava HTML novo e JS antigo.
    if (request.mode === 'navigate') {
      // Não substituir silenciosamente um PWA instalado: a nova shell só é
      // servida depois que o usuário confirma a troca de Service Worker.
      const installed = await cache.match(scopedURL('./index.html'));
      if (installed) return installed;
      if(serving===CACHE_NAME){
       const recovery=await stagedHit(scopedURL('./index.html'));
       if(recovery)return recovery;
      }
      try { return await fetch(request); }
      catch { return Response.error(); }
    }
    // Arquivos estáticos pertencem a uma única revisão atômica, mesmo quando
    // o navegador envia cache:reload/no-store. Apenas version.json verifica a rede.
    const hit = await cache.match(request, {ignoreSearch:true});
    if (hit) return hit;
    if(serving===CACHE_NAME){
     const recovery=await stagedHit(request,{ignoreSearch:true});
     if(recovery)return recovery;
    }
    try { return await fetch(request); }
    catch { return Response.error(); }
  })());
});

self.addEventListener('message',event=>{
 const type=event.data?.type;
 if(type==='SKIP_WAITING'){self.skipWaiting();return;}
 event.waitUntil((async()=>{
  let state=await readUpdateState();
  // O worker antigo pode sobrescrever seu próprio estado após a ativação
  // desta revisão. Um BOOT_OK/FALHA da nova shell pode recuperar o estado
  // somente se o identificador exato e o staging íntegro coincidirem.
  if((type==='CLARA_BOOT_OK'||type==='CLARA_BOOT_FAILED')&&
     event.data.cacheName===CACHE_NAME&&(!state||state.current!==CACHE_NAME)){
   const backup=await stagedHit(scopedURL('./index.html'));
   if(backup?.ok){
    const names=await caches.keys();
    const previous=names.filter(n=>n.startsWith(cachePrefix)&&n!==CACHE_NAME).at(-1)||null;
    state={current:CACHE_NAME,previous,rolledBack:false,confirmed:false};
    await writeUpdateState(state);
   }
  }
  if(!state||state.current!==CACHE_NAME)return;
  // A página que disparou a atualização ainda executa o pacote anterior.
  // Só a nova shell pode confirmar ou reprovar o boot deste cache.
  if((type==='CLARA_BOOT_OK'||type==='CLARA_BOOT_FAILED')&&event.data.cacheName!==CACHE_NAME)return;
  if(type==='CLARA_BOOT_OK'&&!state.rolledBack){
   // Reconstituir os arquivos caso tenham sido excluídos pelo worker anterior.
   // O pacote antigo só será apagado após conferir a cópia completa.
   await promoteStaging();
   state.confirmed=true;
   await writeUpdateState(state);
   // Excluir apenas o backup anterior identificado na ativação DESTE pacote.
   // Um BOOT_OK tardio do worker antigo não pode eliminar o cache de uma
   // atualização mais nova que já esteja sendo baixada ou aguardando.
   if(state.previous&&state.previous!==CACHE_NAME)
    await caches.delete(state.previous);
   // Não limpar outros stagings aqui: um worker futuro pode estar instalando
   // enquanto este BOOT_OK termina. Uma limpeza tardia repetiria a corrida.
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
