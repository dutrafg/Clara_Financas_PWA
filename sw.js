/* Clara Finanças — Atualizador v2.
 * Cada build possui cache imutável. O cofre (OPFS/IndexedDB/localStorage)
 * nunca é alterado por este Service Worker.
 */
const CACHE_NAME = '__CLARA_CACHE_NAME__';
const APP_FILES = ['./','./index.html','./clara-simple.css','./clara-simple.js','./clara-biometric.css','./clara-biometric.js','./clara-storage-ui.css','./clara-storage-ui.js','./clara-agenda.css','./clara-agenda.js','./clara-updater.js','./clara-premium.css','./clara-guest.css','./clara-guest.js','./clara-extras.css','./clara-extras.js','./clara-backup.js','./manifest.webmanifest','./version.json','./assets/icon-192.png','./assets/icon-512.png'];
const scopedURL = relative => new URL(relative, self.registration.scope);
const versionPath = scopedURL('./version.json').pathname;
const V2_PREFIX='clara-v2-';
const META_CACHE='clara-v2-metadata';
const META_URL=scopedURL('./__clara_v2_state__');
const RELEASE_PREFIXES=[V2_PREFIX,'clara-financas-'];

async function stateRead(){
 try{
  const response=await (await caches.open(META_CACHE)).match(META_URL);
  return response?await response.json():null;
 }catch{return null;}
}
async function stateWrite(value){
 const cache=await caches.open(META_CACHE);
 await cache.put(META_URL,new Response(JSON.stringify(value),{
  headers:{'content-type':'application/json'}}));
}
async function notify(type,extra={}){
 try{
  for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))
   client.postMessage({type,...extra});
 }catch{}
}
async function fetchAsset(path){
 const url=scopedURL(path);
 let error;
 for(let n=0;n<3;n++){
  try{
   const response=await fetch(new Request(url,{cache:'no-store'}));
   if(!response.ok)throw Error('HTTP '+response.status+' '+path);
   const mime=response.headers.get('content-type')||'';
   if(path.endsWith('.js')&&mime&&!/javascript|ecmascript|text\/plain/i.test(mime))
    throw Error('MIME inválido para '+path);
   if(path.endsWith('.css')&&mime&&!/css|text\/plain/i.test(mime))
    throw Error('MIME inválido para '+path);
   return {url,response};
  }catch(e){
   error=e;
   if(n<2)await new Promise(resolve=>setTimeout(resolve,300*(n+1)));
  }
 }
 throw Error('Arquivo obrigatório indisponível: '+path+' ('+(error?.message||'rede')+')');
}
async function verifiedCache(name){
 const names=await caches.keys();
 if(!names.includes(name))return false;
 const cache=await caches.open(name);
 for(const path of APP_FILES){
  const response=await cache.match(scopedURL(path));
  if(!response?.ok)return false;
 }
 return true;
}
async function servingName(){
 const state=await stateRead();
 if(state?.current===CACHE_NAME&&state.rolledBack&&state.previous&&await verifiedCache(state.previous))
  return state.previous;
 return CACHE_NAME;
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE_NAME);
 let completed=0;
 await notify('CLARA_UPDATE_PROGRESS',{done:0,total:APP_FILES.length});
 const results=await Promise.allSettled(APP_FILES.map(async path=>{
  const {url,response}=await fetchAsset(path);
  await cache.put(url,response);
  completed++;
  await notify('CLARA_UPDATE_PROGRESS',{done:completed,total:APP_FILES.length,path});
 }));
 const error=results.find(r=>r.status==='rejected');
 if(error||!(await verifiedCache(CACHE_NAME))){
  await caches.delete(CACHE_NAME);
  throw Error('Pacote incompleto: '+(error?.reason?.message||'verificação offline'));
 }
 // Não chamar skipWaiting: upgrades requerem confirmação depois do backup.
 // Primeira instalação ativa normalmente, sem intervenção do usuário.
})()));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const names=await caches.keys();
 const candidates=names.filter(name=>name!==CACHE_NAME&&RELEASE_PREFIXES.some(p=>name.startsWith(p)));
 const previous=(await stateRead())?.current;
 const fallback=previous&&candidates.includes(previous)&&await verifiedCache(previous)
  ?previous
  :candidates.at(-1)||null;
 await stateWrite({current:CACHE_NAME,previous:fallback,confirmed:!fallback,rolledBack:false});
 await self.clients.claim();
})()));

self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 event.respondWith((async()=>{
  // version.json só representa a rede. Nunca simular uma atualização com
  // metadados de uma versão offline antiga.
  if(url.pathname===versionPath){
   try{return await fetch(new Request(request,{cache:'no-store'}));}
   catch{return Response.error();}
  }
  // Diagnóstico no-store consulta a rede; shell e scripts normais ficam
  // bloqueados à revisão aprovada até a troca do SW.
  if(request.cache==='no-store'&&!request.destination){
   try{return await fetch(request);}
   catch{return Response.error();}
  }
  const cache=await caches.open(await servingName());
  if(request.mode==='navigate'){
   const hit=await cache.match(scopedURL('./index.html'));
   if(hit)return hit;
   try{return await fetch(request);}
   catch{return Response.error();}
  }
  const hit=await cache.match(request,{ignoreSearch:true});
  if(hit)return hit;
  try{return await fetch(request);}
  catch{return Response.error();}
 })());
});

self.addEventListener('message',event=>{
 const type=event.data?.type;
 if(type==='SKIP_WAITING'){
  event.waitUntil(self.skipWaiting());return;
 }
 if(!['CLARA_BOOT_OK','CLARA_BOOT_FAILED','CLARA_RETRY_CANDIDATE'].includes(type))return;
 event.waitUntil((async()=>{
  const state=await stateRead();
  if(!state||state.current!==CACHE_NAME)return;
  // A página do build anterior jamais pode confirmar o novo cache.
  if(type!=='CLARA_RETRY_CANDIDATE'&&event.data?.cacheName!==CACHE_NAME)return;
  if(type==='CLARA_BOOT_FAILED'){
   if(state.previous&&await verifiedCache(state.previous)){
    await stateWrite({...state,rolledBack:true,confirmed:false});
    event.source?.postMessage({type:'CLARA_ROLLBACK_SELECTED'});
   }else event.source?.postMessage({type:'CLARA_ROLLBACK_UNAVAILABLE'});
   return;
  }
  if(type==='CLARA_RETRY_CANDIDATE'){
   await stateWrite({...state,rolledBack:false,confirmed:false});
   event.source?.postMessage({type:'CLARA_CANDIDATE_RETRY_SELECTED'});
   return;
  }
  if(state.rolledBack)return;
  if(!(await verifiedCache(CACHE_NAME)))return;
  await stateWrite({...state,confirmed:true});
  // Remover versões antigas SOMENTE após inicialização bem-sucedida.
  // Não tocar caches de terceiros ou bancos de dados do usuário.
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name!==CACHE_NAME&&RELEASE_PREFIXES.some(p=>name.startsWith(p)))
   .map(name=>caches.delete(name)));
  // Cache de metadados v1 não é mais lido. Remover sem afetar o cofre.
  await caches.delete('clara-update-system-v1');
  event.source?.postMessage({type:'CLARA_BOOT_CONFIRMED'});
 })());
});
