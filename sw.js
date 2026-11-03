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
 const candidates=names.filter(name=>name!==CACHE_NAME&&name!==META_CACHE&&
  RELEASE_PREFIXES.some(p=>name.startsWith(p)));
 const previous=(await stateRead())?.current;
 let fallback=previous&&candidates.includes(previous)&&await verifiedCache(previous)
  ?previous:null;
 if(!fallback){
  for(const name of candidates.reverse()){
   if(await verifiedCache(name)){fallback=name;break;}
  }
 }
 await stateWrite({current:CACHE_NAME,previous:fallback,confirmed:!fallback,rolledBack:false});
 await self.clients.claim();
})()));

// Uma navegação nunca deve terminar em ERR_FAILED somente porque o Chrome
// descartou ou bloqueou o CacheStorage. A recuperação é independente do cofre.
function recoveryPage(){
 const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Clara Finanças — recuperação de acesso</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#151b22;color:#edf5f5;font:16px system-ui,sans-serif}
main{max-width:440px;padding:28px;line-height:1.6}h1{font-size:23px;line-height:1.2}
button{padding:12px 20px;border:0;border-radius:14px;background:#76d5c3;color:#102020;font-weight:700;font-size:16px}
small{display:block;margin-top:20px;color:#bbcbc9}</style></head><body><main>
<h1>Clara temporariamente indisponível</h1>
<p>Não foi possível carregar a interface nem recuperar o pacote offline. Verifique sua conexão e tente novamente.</p>
<button onclick="location.reload()">Tentar novamente</button>
<small>Não apague os dados do site: seu cofre financeiro é armazenado separadamente do cache de atualização.</small>
</main></body></html>`;
 return new Response(html,{status:503,headers:{
  'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 event.respondWith((async()=>{
  try{
   // version.json só representa a rede. Não servir metadados obsoletos.
   if(url.pathname===versionPath){
    try{return await fetch(new Request(request,{cache:'no-store'}));}
    catch{return Response.error();}
   }
   if(request.cache==='no-store'&&!request.destination){
    try{return await fetch(request);}
    catch{return Response.error();}
   }
   // Não recriar automaticamente um cache de release perdido. Isso pode
   // mascarar a corrupção e gerar navegação ERR_FAILED no Chrome.
   const current=await servingName();
   const names=await caches.keys();
   const cache=names.includes(current)?await caches.open(current):null;
   if(request.mode==='navigate'){
    const shell=cache?await cache.match(scopedURL('./index.html')):null;
    if(shell?.ok)return shell;
    // Se o navegador expulsou a revisão atual mas reteve o backup,
    // recuperar a última shell válida sem alterar OPFS/localStorage.
    const state=await stateRead();
    if(state?.previous&&state.previous!==current&&names.includes(state.previous)){
     const backup=await caches.open(state.previous);
     const fallback=await backup.match(scopedURL('./index.html'));
     if(fallback?.ok)return fallback;
    }
    try{return await fetch(request);}
    catch{return recoveryPage();}
   }
   const hit=cache?await cache.match(request,{ignoreSearch:true}):null;
   if(hit)return hit;
   try{return await fetch(request);}
   catch{return Response.error();}
  }catch{
   // Storage indisponível, erro de quota ou metadados corrompidos não
   // devem impedir acesso online nem destruir o cofre do usuário.
   try{return await fetch(request);}
   catch{return request.mode==='navigate'?recoveryPage():Response.error();}
  }
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
  // Apagar APENAS o backup anterior conhecido depois do boot válido.
  // Nunca varrer todos os caches de release: outro Service Worker pode
  // estar instalando uma versão futura enquanto este BOOT_OK termina.
  if(state.previous&&state.previous!==CACHE_NAME)
   await caches.delete(state.previous);
  // Cache de metadados v1 não é mais lido. Remover sem afetar o cofre.
  await caches.delete('clara-update-system-v1');
  event.source?.postMessage({type:'CLARA_BOOT_CONFIRMED'});
 })());
});
