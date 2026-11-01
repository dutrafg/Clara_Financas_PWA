import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const updaterSource=await readFile('clara-updater.js','utf8');
const workerTemplate=await readFile('sw.js','utf8');
const candidateCacheName='clara-financas-4-2-5-rc-unit-test';
const workerSource=workerTemplate.replace('__CLARA_CACHE_NAME__',candidateCacheName);
assert.ok(!workerSource.includes('__CLARA_CACHE_NAME__'),'fixture criou um nome de cache concreto');

function createUpdaterHarness({remote='4.2.6-rc.1',installing=true,update=async()=>{}}={}){
 let now=1_000,nextId=0;
 const timers=new Map(),swEvents=new Map(),regEvents=new Map(),workerEvents=new Map();
 const elements=new Map();
 const serviceWorker={controller:{postMessage(){}},addEventListener(type,fn){swEvents.set(type,fn);},register:async()=>registration};
 const worker=installing?{
  state:'installing',addEventListener(type,fn){workerEvents.set(type,fn);},
  setState(value){this.state=value;workerEvents.get('statechange')?.();}
 }:null;
 const registration={scope:'https://clara.test/',installing:worker,waiting:null,
  active:{state:'activated',postMessage(){}},update,
  addEventListener(type,fn){regEvents.set(type,fn);}};
 const doc={hidden:false,getElementById(id){
  if(!elements.has(id))elements.set(id,{id,textContent:'',hidden:false,disabled:false,attributes:{},setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k]??null;}});
  return elements.get(id);
 },addEventListener(){}};
 const win={ClaraSecurity:{unlocked:true,flush:async()=>{}},ClaraBackups:{beforeUpdate:async()=>({local:true,external:true})},
  ClaraReloadGuard:{allowOfficialUpdate(){}},confirm:()=>true,addEventListener(){},setInterval(){return 1;}};
 const clock=class extends Date{static now(){return now;}};
 const sandbox={
  window:win,document:doc,navigator:{onLine:true,serviceWorker},location:{protocol:'https:',reload(){}},
  CLARA_APP_VERSION:'4.2.5-rc',
  localStorage:{getItem(){return null;},setItem(){}},caches:{keys:async()=>[],open:async()=>({match:async()=>null})},
  fetch:async()=>({ok:true,json:async()=>({version:remote,notes:['Atualização de teste.']})}),
  showToast(){},Date:clock,URL,AbortController,Promise,WeakSet,BigInt,Math,
  setTimeout(fn,delay=0){const id=++nextId;timers.set(id,{at:now+delay,fn});return id;},
  clearTimeout(id){timers.delete(id);},setInterval(){return 1;},clearInterval(){},
 };
 vm.runInNewContext(updaterSource,sandbox,{filename:'clara-updater.js'});
 async function advance(ms){
  const end=now+ms;
  for(;;){
   const due=[...timers.entries()].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
   if(!due)break;
   const [id,timer]=due;timers.delete(id);now=timer.at;timer.fn();
   await Promise.resolve();await Promise.resolve();
  }
  now=end;await Promise.resolve();
 }
 return {api:win.ClaraUpdate,registration,worker,elements,advance,now:()=>now,swEvents,regEvents};
}

test('SemVer ordena releases e pré-releases sem esconder atualizações RC',()=>{
 const compare=createUpdaterHarness().api.compare;
 const ordered=[
  ['4.2.4-rc.1','4.2.4-rc.2',-1],
  ['4.2.4-rc.2','4.2.4-rc.10',-1],
  ['4.2.4-rc.10','4.2.4',-1],
  ['4.2.4-alpha','4.2.4-beta',-1],
  ['4.2.9','4.2.10',-1],
  ['4.2.10+build.1','4.2.10+build.2',0],
  ['4.2.4-1','4.2.4-alpha',-1],
 ];
 for(const [left,right,result] of ordered)assert.equal(compare(left,right),result,`${left} vs ${right}`);
 assert.equal(compare('4.2.4-rc.01','4.2.4-rc.2'),0,'Identificador numérico com zero inicial deve ser inválido');
});

test('Verificação não chama pacote pronto antes do evento installed',async()=>{
 const h=createUpdaterHarness({remote:'4.2.6-rc.1'});
 const result=await h.api.check(true);
 assert.equal(result,false,'Uma versão apenas detectada não é uma instalação pronta');
 assert.equal(h.api.status,'Preparando atualização');
 assert.equal(h.elements.get('claraUpdateState').textContent,'Preparando atualização');
 await h.advance(60_000);
 assert.equal(h.api.status,'Preparando atualização','Download ativo não pode virar falha só pelo relógio');
 h.registration.waiting=h.worker;h.registration.installing=null;h.worker.setState('installed');
 assert.equal(h.api.ready,true);
 assert.equal(h.api.status,'Atualização disponível');
});

test('Preparação sem instalação termina com falha recuperável e não deixa timer órfão',async()=>{
 const h=createUpdaterHarness({remote:'4.2.6-rc.1',installing:false});
 assert.equal(await h.api.check(true),false);
 assert.equal(h.api.status,'Preparando atualização');
 await h.advance(120_001);
 assert.equal(h.api.status,'Falha ao preparar');
 assert.equal(h.elements.get('applyClaraUpdate').disabled,false);
 assert.equal(h.elements.get('applyClaraUpdate').textContent,'Tentar novamente');
});

test('Progresso real renova o limite de inatividade durante uma instalação longa',async()=>{
 const h=createUpdaterHarness({remote:'4.2.6-rc.1'});
 await h.api.check();
 for(let done=1;done<=3;done++){
  await h.advance(110_000);
  h.swEvents.get('message')?.({data:{type:'CLARA_UPDATE_PROGRESS',done,total:20}});
  assert.equal(h.api.status,'Preparando atualização');
 }
 await h.advance(119_999);
 assert.equal(h.api.status,'Preparando atualização');
 await h.advance(2);
 assert.equal(h.api.status,'Falha ao preparar','sem avanço de progresso, a falha deve se tornar recuperável');
});

test('Metadados remotos malformados ou excessivos não são aceitos como versão',async()=>{
 for(const version of ['99.1','4.2.5-rc.01','9'.repeat(129)]){
  const h=createUpdaterHarness({remote:version});
  assert.equal(await h.api.check(),false);
  assert.equal(h.api.remoteVersion,'');
  assert.equal(h.api.status,'Falha ao preparar');
 }
});

function createWorkerHarness({failPath=null}={}){
 const scope='https://clara.test/app/';
 const listeners=new Map(),stores=new Map(),clientMessages=[];
 const makeCache=name=>{
  if(!stores.has(name))stores.set(name,new Map());
  const records=stores.get(name);
  return {put:async(key,response)=>records.set(String(key.url||key),response.clone()),
   match:async(key)=>records.get(String(key.url||key))?.clone()||null};
 };
 const caches={open:async name=>makeCache(name),keys:async()=>[...stores.keys()],
  delete:async name=>stores.delete(name),has:async name=>stores.has(name)};
 const client={postMessage:message=>clientMessages.push(message)};
 const self={registration:{scope},location:{origin:'https://clara.test'},skipWaiting(){},
  clients:{matchAll:async()=>[client],claim:async()=>{}},
  addEventListener(type,fn){listeners.set(type,fn);}};
 const fetch=async request=>{
  const url=new URL(request.url||request);
  if(failPath&&url.pathname.endsWith(failPath))throw Error('simulated network failure');
  return new Response('network '+url.pathname,{status:200});
 };
 const sandbox={self,caches,fetch,Request,Response,URL,Promise,Error,Map,JSON,Array,Math,
  setTimeout(fn){fn();return 1;},clearTimeout(){}};
 vm.runInNewContext(workerSource,sandbox,{filename:'dist/sw.js'});
 const fire=async(type,event={})=>{
  const handler=listeners.get(type);assert.ok(handler,`handler ${type} existe`);
  let pending;const e={...event,waitUntil(value){pending=value;}};
  handler(e);if(pending)await pending;return e;
 };
 const message=async(type,cacheName=candidateCacheName)=>fire('message',{data:{type,cacheName},source:{postMessage:m=>clientMessages.push(m)}});
 const readState=async()=>{
  const cache=await caches.open('clara-update-system-v1');
  const response=await cache.match(new URL('./__clara_update_state__',scope));
  return response?response.json():null;
 };
 const cacheText=async(name,url)=>{
  const response=await (await caches.open(name)).match(new URL(url,scope));
  return response?response.text():null;
 };
 return {scope,caches,clientMessages,fire,message,readState,cacheText,stores};
}

test('Service Worker só ativa um pacote completo e informa progresso',async()=>{
 const h=createWorkerHarness();
 const old=await h.caches.open('clara-financas-4-2-4-old');
 await old.put(new URL('./index.html',h.scope),new Response('old shell'));
 await h.fire('install');
 const messages=h.clientMessages.filter(x=>x.type==='CLARA_UPDATE_PROGRESS');
 assert.ok(messages.length>1);
 assert.equal(messages.at(-1).done,21);
 assert.equal(messages.at(-1).total,21);
 assert.ok(messages.at(-1).path.startsWith('./'));
 await h.fire('activate');
 assert.equal(await h.cacheText(candidateCacheName,'./index.html'),'network /app/index.html');
 const state=await h.readState();
 assert.equal(state.previous,'clara-financas-4-2-4-old');
 assert.equal(state.confirmed,false);
 assert.ok(h.stores.has('clara-update-system-v1'),'metadata precisa sobreviver à limpeza de caches antigos');
 await h.message('CLARA_BOOT_OK','clara-financas-4-2-4-old');
 assert.equal((await h.readState()).confirmed,false,'pacote anterior não pode confirmar o candidato');
 assert.ok(await h.caches.has('clara-financas-4-2-4-old'),'cache de recuperação permanece até o boot do candidato');
 await h.message('CLARA_BOOT_OK');
 assert.equal((await h.readState()).confirmed,true);
 assert.equal(await h.caches.has('clara-financas-4-2-4-old'),false);
 assert.ok(h.stores.has('clara-update-system-v1'));
});

test('Falha de boot volta ao pacote anterior; o usuário pode tentar o candidato novamente',async()=>{
 const h=createWorkerHarness();
 const old=await h.caches.open('clara-financas-4-2-4-old');
 await old.put(new URL('./index.html',h.scope),new Response('stable shell'));
 await h.fire('install');await h.fire('activate');
 await h.message('CLARA_BOOT_FAILED','clara-financas-4-2-4-old');
 assert.equal((await h.readState()).rolledBack,false,'pacote antigo não pode reprovar o candidato');
 await h.message('CLARA_BOOT_FAILED');
 assert.equal((await h.readState()).rolledBack,true);
 assert.ok(h.clientMessages.some(m=>m.type==='CLARA_ROLLBACK_SELECTED'));
 let responsePromise;
 await h.fire('fetch',{request:{method:'GET',url:h.scope,mode:'navigate',cache:'default'},respondWith(promise){responsePromise=promise;}});
 assert.equal(await (await responsePromise).text(),'stable shell');
 await h.message('CLARA_RETRY_CANDIDATE');
 assert.equal((await h.readState()).rolledBack,false);
 assert.ok(h.stores.has('clara-financas-4-2-4-old'));
});

test('Download inválido descarta apenas o candidato e preserva o pacote anterior',async()=>{
 const h=createWorkerHarness({failPath:'clara-updater.js'});
 const old=await h.caches.open('clara-financas-4-2-4-old');
 await old.put(new URL('./index.html',h.scope),new Response('stable shell'));
 await assert.rejects(h.fire('install'),/Instalação do Clara não concluída/);
 assert.ok(h.stores.has('clara-financas-4-2-4-old'));
 assert.equal(await h.caches.has(candidateCacheName),false);
});
