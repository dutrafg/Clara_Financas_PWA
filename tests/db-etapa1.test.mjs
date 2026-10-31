import assert from 'node:assert/strict';
import {blankData,validateBackup} from '../src/legacy/core.mjs';
/* Simulador mínimo de transações IndexedDB para conferir sequência e persistência no módulo de acesso.
   Não substitui teste em navegador real. */
const tables=new Map();
const db={
 createObjectStore(name){tables.set(name,new Map());},
 transaction(name){const table=tables.get(name);const tx={error:null,abort(){queueMicrotask(()=>this.onabort?.())},objectStore(){return {
 get(key){return req(()=>table.get(key))},put(value,key){return req(()=>{table.set(key,key==='folder'?value:structuredClone(value));return key})},delete(key){return req(()=>table.delete(key))}
 };}};function req(run){const r={};queueMicrotask(()=>{try{r.result=run();r.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());}catch(e){tx.error=e;tx.onerror?.();}});return r;}return tx;
 }
};
globalThis.indexedDB={open(){const r={result:db};queueMicrotask(()=>{if(!tables.size)r.onupgradeneeded?.();r.onsuccess?.();});return r;}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{persist:async()=>true}}});
const mod=await import('../src/legacy/db.mjs');
let count=0;function ok(name,v){assert.ok(v,name);console.log('OK '+(++count)+' '+name);}
let d=await mod.initData();ok('inicializa banco vazio com esquema v2',d.schemaVersion===2&&d.accounts.length===1&&d.revision===1);
ok('carrega estado gravado',((await mod.loadData()).revision===1));
const old=d;const edited=structuredClone(d);edited.accounts[0].openingCents=12345;
const saved=await mod.saveData(edited);ok('salva revisão nova e preserva original',saved.revision===2&&old.revision===1&&edited.revision===1);
ok('reabre saldo já armazenado',((await mod.loadData()).accounts[0].openingCents===12345));
const bad=structuredClone(saved);bad.accounts[0].openingCents=1.25;
await assert.rejects(mod.saveData(bad),/inválidos/);ok('escrita inválida não substitui estado anterior',(await mod.loadData()).accounts[0].openingCents===12345);
const oldVersion=structuredClone(saved);oldVersion.schemaVersion=1;await new Promise((resolve)=>{let t=db.transaction('app');t.objectStore().put(oldVersion,'state');t.oncomplete=resolve;});
const recovered=await mod.initData();ok('migra banco anterior ao carregar',recovered.schemaVersion===2&&recovered.revision===3);
ok('migração preserva a conta e o saldo',recovered.accounts[0].openingCents===12345);
let storeFile={};const folder={name:'Meus Documentos',async queryPermission(){return 'granted'},async requestPermission(){return 'granted'},async getFileHandle(name,opt){if(!storeFile[name]&&!opt?.create)throw Object.assign(new Error('NotFound'),{name:'NotFoundError'});return {async createWritable(){return {async write(s){storeFile[name]=s},async close(){},async abort(){}}},async getFile(){return {async text(){return storeFile[name]}}}};}};
globalThis.showDirectoryPicker=async()=>folder;
const selected=await mod.chooseFolder();ok('seleção de pasta autorizada',selected.name==='Meus Documentos');
const folderSecret='Senha forte de pasta para teste 2026';
ok('espelha cópia AES-GCM na pasta escolhida',
 await mod.writeFolderCopy(recovered,folderSecret)===true&&'clara-financas-dados.clara'in storeFile);
ok('cópia protegida não contém dados legíveis',
 !storeFile['clara-financas-dados.clara'].includes(recovered.accounts[0].name));
const restored=await mod.readFolderCopy(folderSecret);ok('lê e valida cópia da pasta',restored.schemaVersion===2&&restored.accounts[0].openingCents===12345);
const backupV1=structuredClone(restored);backupV1.schemaVersion=1;storeFile['clara-financas-dados.json']=JSON.stringify(backupV1);
ok('importa backup antigo da pasta', (await mod.readLegacyFolderCopy()).schemaVersion===2);
ok('JSON antigo é detectado sem ser sobrescrito',await mod.hasLegacyFolderCopy()===true);
ok('Cópia cifrada é detectada',await mod.hasFolderCopy()===true);
await assert.rejects(mod.readFolderCopy('Senha incorreta e longa'),/Senha incorreta/);
ok('Senha incorreta não restaura dados',true);
await mod.clearDirectoryHandle();ok('desvincula sem apagar backup externo',!!storeFile['clara-financas-dados.json']&&!!storeFile['clara-financas-dados.clara']&&(await mod.getDirectoryHandle())==null);
console.log(`RESULTADO: ${count} verificações isoladas de persistência e pasta.`);
