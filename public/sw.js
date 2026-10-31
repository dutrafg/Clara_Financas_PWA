/* Clara Finanças PWA — cache versionado gerado por tools/build-pwa.mjs.
   Nenhuma requisição financeira ou armazenamento IndexedDB vai para o cache. */
const CACHE_PREFIX='clara-shell-';
const CACHE_NAME='__CLARA_CACHE_RELEASE__';
const PRECACHE_ASSETS=__CLARA_PRECACHE_ASSETS__;
const scope=self.registration.scope;
const allowed=new Set(PRECACHE_ASSETS.map(x=>new URL(x,scope).pathname));
self.addEventListener('install',event=>{
 // Falha de qualquer recurso interrompe a instalação; o worker anterior continua ativo.
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(PRECACHE_ASSETS)));
});
self.addEventListener('message',event=>{
 if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys()
 .then(keys=>Promise.all(keys.filter(x=>x.startsWith(CACHE_PREFIX)&&x!==CACHE_NAME).map(x=>caches.delete(x))))
 .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 const url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!/^https?:$/.test(url.protocol))return;
 const isNavigation=request.mode==='navigate';
 if(!isNavigation&&!allowed.has(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  if(isNavigation){
   // HTML e assets da mesma versão instalada: não misturar builds.
   const html=await cache.match(new URL('./index.html',scope).href);
   if(html)return html;
  }else{
   const hit=await cache.match(request);
   if(hit)return hit;
  }
  try{return await fetch(request)}catch{
   if(isNavigation){
    const html=await cache.match(new URL('./index.html',scope).href);
    if(html)return html;
   }
   return new Response('Abra o Clara uma vez com conexão para instalar os arquivos offline.',{
    status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}
   });
  }
 })());
});
