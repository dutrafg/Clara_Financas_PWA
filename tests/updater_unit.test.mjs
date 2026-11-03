import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const updaterSource=await readFile('clara-updater.js','utf8');
const workerSource=(await readFile('sw.js','utf8'))
 .replace('__CLARA_CACHE_NAME__','clara-v2-4-4-0-rc-testhash');
const cacheName='clara-v2-4-4-0-rc-testhash';

function app({remoteVersion='4.4.1',remoteCache='clara-v2-4-4-1-next',waiting=false,installing=false,update=()=>Promise.resolve()}={}){
 const elements=new Map(),listeners=new Map(),regListeners=new Map();
 for(const id of ['claraUpdateInstalled','claraUpdateLast','claraUpdateState',
  'claraUpdateMessage','checkClaraUpdate','applyClaraUpdate','claraUpdateRecoveryHint',
  'claraUpdateNotice','claraUpdateNoticeTitle','claraUpdateNoticeText','claraUpdateNoticeInstall']){
  elements.set(id,{hidden:false,disabled:false,textContent:'',setAttribute(){}});
 }
 const worker={state:'installed',sent:[],handlers:{},addEventListener(type,fn){this.handlers[type]=fn;},
  postMessage(m){this.sent.push(m);}};
 const reg={waiting:waiting?worker:null,installing:installing?worker:null,active:{state:'activated'},
  scope:'https://clara.test/app/',update,addEventListener(t,f){regListeners.set(t,f);}};
 const local=new Map();
 const events={};
 let flushes=0,backups=0;
 const win={ClaraSecurity:{unlocked:true,flush:async()=>{flushes++;}},
  ClaraBackups:{beforeUpdate:async()=>{backups++;return {local:true,external:true};}},
  confirm(){return true;},
  addEventListener(name,fn){events[name]=fn;}};
 const nav={serviceWorker:{register:async()=>reg,
  addEventListener(name,fn){listeners.set(name,fn);}}};
 const dom={getElementById:id=>elements.get(id)||null,
  addEventListener(){},hidden:false};
 const sandbox={window:win,navigator:nav,document:dom,
  location:{protocol:'https:',reload(){}},
  localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v)},
  fetch:async()=>({ok:true,json:async()=>({
   version:remoteVersion,cache:remoteCache,notes:['Nova revisão.']})}),
  CLARA_APP_VERSION:'4.4.0-rc',CLARA_BOOT_CACHE:cacheName,
  AbortController,Date,URL,Promise,Math,WeakSet,BigInt,Error,Response,Request,
  setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},
  showToast(){}};
 vm.runInNewContext(updaterSource,sandbox,{filename:'clara-updater.js'});
 return {api:win.ClaraUpdate,window:win,worker,reg,elements,events,listeners,regListeners,
  get flushes(){return flushes;},get backups(){return backups;}};
}
function worker(){
 const scope='https://clara.test/app/',handlers=new Map(),records=new Map(),messages=[];
 const make=name=>{
  if(!records.has(name))records.set(name,new Map());
  const rows=records.get(name);
  return {put:async(key,r)=>rows.set(String(key.url||key),r.clone()),
   match:async(key)=>rows.get(String(key.url||key))?.clone()||null};
 };
 const caches={open:async name=>make(name),keys:async()=>[...records.keys()],
  delete:async name=>records.delete(name)};
 const self={registration:{scope},location:{origin:'https://clara.test'},
  clients:{claim:async()=>{},matchAll:async()=>[{postMessage:m=>messages.push(m)}]},
  skipWaiting:async()=>{},addEventListener:(t,fn)=>handlers.set(t,fn)};
 const fetch=async req=>new Response('content '+new URL(req.url||req).pathname,{
  status:200,headers:{'content-type':'text/plain'}});
 const sandbox={self,caches,fetch,Request,Response,URL,Promise,Array,
  JSON,Map,Math,Error,setTimeout(){return 1;}};
 vm.runInNewContext(workerSource,sandbox,{filename:'sw.js'});
 const fire=async(name,payload={})=>{
  let pending;handlers.get(name)({...payload,waitUntil(p){pending=p;}});
  if(pending)await pending;
 };
 return {scope,fire,caches,records,messages,make,async content(name,path){
  const res=await make(name).match(new URL(path,scope));return res?.text()||null;
 },async state(){
  const r=await make('clara-v2-metadata').match(new URL('./__clara_v2_state__',scope));
  return r?.json()||null;
 }};
}

test('SemVer distingue releases e pré-releases',()=>{
 const compare=app().api.compare;
 for(const [a,b,r] of [
  ['4.4.0-rc','4.4.0',-1],['4.4.0-rc.2','4.4.0-rc.10',-1],
  ['4.4.1','4.4.0',1],['4.4.0','4.4.0',0]
 ])assert.equal(compare(a,b),r);
});

test('Revisão idêntica não exibe atualização',async()=>{
 const h=app({remoteVersion:'4.4.0-rc',remoteCache:cacheName});
 await h.api.init();
 assert.equal(h.api.status,'Atualizado');
 assert.equal(h.elements.get('applyClaraUpdate').hidden,true);
});

test('Revisão alterada, mesmo SemVer, pode ser instalada',async()=>{
 const h=app({remoteVersion:'4.4.0-rc',remoteCache:'clara-v2-4-4-0-rc-newhash',waiting:true});
 assert.equal(await h.api.check(true),true);
 assert.equal(h.api.ready,true);
 assert.equal(h.elements.get('applyClaraUpdate').hidden,false);
});

test('Um Service Worker já aguardando não dispara outra instalação',async()=>{
 let updates=0;
 const h=app({waiting:true,update:()=>{updates++;return Promise.resolve();}});
 await h.api.check(true);
 assert.equal(updates,0);
 assert.equal(h.api.status,'Atualização disponível');
});

test('O usuário precisa aprovar snapshot antes do SKIP_WAITING',async()=>{
 const h=app({waiting:true});
 await h.api.check(true);
 assert.equal(await h.api.apply(),true);
 assert.equal(h.flushes,1);
 assert.equal(h.backups,1);
 assert.equal(h.worker.sent[0].type,'SKIP_WAITING');
});

test('Não ativar sem cofre desbloqueado',async()=>{
 const h=app({waiting:true});
 await h.api.check();
 // O estado do cofre pertence a window; substituí-lo simula o bloqueio.
 h.window.ClaraSecurity.unlocked=false;
 await assert.rejects(h.api.apply(),/Desbloqueie/);
 assert.equal(h.worker.sent.length,0);
});

test('Service Worker instala somente o pacote completo e sem SKIP_WAITING automático',async()=>{
 const h=worker();
 await h.fire('install');
 assert.equal(await h.content(cacheName,'./index.html'),'content /app/index.html');
 assert.equal(h.messages.at(-1).total,21);
 assert.equal(await h.state(),null);
 await h.fire('activate');
 assert.equal((await h.state()).confirmed,true);
});

test('Worker anterior só é apagado após a confirmação do novo boot',async()=>{
 const h=worker();
 const previous='clara-v2-4-3-9-previous';
 const old=await h.caches.open(previous);
 for(const path of ['./','./index.html','./clara-updater.js','./version.json',
  './clara-simple.css','./clara-simple.js','./clara-biometric.css','./clara-biometric.js',
  './clara-storage-ui.css','./clara-storage-ui.js','./clara-agenda.css','./clara-agenda.js',
  './clara-premium.css','./clara-guest.css','./clara-guest.js','./clara-extras.css',
  './clara-extras.js','./clara-backup.js','./manifest.webmanifest',
  './assets/icon-192.png','./assets/icon-512.png']){
  await old.put(new URL(path,h.scope),new Response('previous'));
 }
 await h.fire('install');await h.fire('activate');
 assert.equal((await h.state()).previous,previous);
 assert.ok((await h.caches.keys()).includes(previous));
 await h.fire('message',{data:{type:'CLARA_BOOT_OK',cacheName:previous},
  source:{postMessage:m=>h.messages.push(m)}});
 assert.equal((await h.state()).confirmed,false);
 await h.fire('message',{data:{type:'CLARA_BOOT_OK',cacheName},
  source:{postMessage:m=>h.messages.push(m)}});
 assert.equal((await h.state()).confirmed,true);
 assert.ok(!(await h.caches.keys()).includes(previous));
});

test('BOOT_OK de worker antigo não remove cache futuro já preparado',async()=>{
 const h=worker();
 await h.fire('install');
 await h.fire('activate');
 const future='clara-v2-4-5-0-rc-futurepackage';
 await (await h.caches.open(future)).put(
  new URL('./index.html',h.scope),new Response('future package'));
 await h.fire('message',{data:{type:'CLARA_BOOT_OK',cacheName},
  source:{postMessage:m=>h.messages.push(m)}});
 assert.equal(await h.content(future,'./index.html'),'future package',
  'confirmação tardia não pode apagar uma atualização futura');
 assert.equal((await h.state()).confirmed,true);
});

test('Falha do módulo crítico seleciona o pacote anterior sem apagar o cofre',async()=>{
 const h=worker();
 const old='clara-v2-4-3-9-previous';
 const oldCache=await h.caches.open(old);
 for(const path of ['./','./index.html','./clara-simple.css','./clara-simple.js',
  './clara-biometric.css','./clara-biometric.js','./clara-storage-ui.css',
  './clara-storage-ui.js','./clara-agenda.css','./clara-agenda.js',
  './clara-updater.js','./clara-premium.css','./clara-guest.css',
  './clara-guest.js','./clara-extras.css','./clara-extras.js',
  './clara-backup.js','./manifest.webmanifest','./version.json',
  './assets/icon-192.png','./assets/icon-512.png']){
  await oldCache.put(new URL(path,h.scope),new Response('previous'));
 }
 await h.fire('install');await h.fire('activate');
 await h.fire('message',{data:{type:'CLARA_BOOT_FAILED',cacheName},
  source:{postMessage:m=>h.messages.push(m)}});
 assert.equal((await h.state()).rolledBack,true);
 assert.equal(h.messages.at(-1).type,'CLARA_ROLLBACK_SELECTED');
 assert.equal((await h.caches.keys()).includes(old),true);
});
