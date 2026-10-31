import assert from 'node:assert/strict';
import {blankData,validateBackup} from '../src/legacy/core.mjs';
let checks=0;
const check=(ok,label)=>{assert.ok(ok,label);checks++};
const rejected=async(fn,pattern,label)=>{await assert.rejects(fn,pattern,label);checks++};
const tables=new Map();
const db={
 createObjectStore(name){tables.set(name,new Map());},
 transaction(name){
  const table=tables.get(name);let failed=false;
  const tx={error:null,abort(){failed=true;queueMicrotask(()=>this.onabort?.())},objectStore(){return{
   get(key){return request(()=>structuredClone(table.get(key)))},
   put(value,key){return request(()=>{table.set(key,structuredClone(value));return key})},
   delete(key){return request(()=>table.delete(key))}
  }}};
  function request(op){const req={};queueMicrotask(()=>{
   try{req.result=op();req.onsuccess?.();queueMicrotask(()=>{if(!failed)tx.oncomplete?.()})}
   catch(e){failed=true;tx.error=e;req.onerror?.();tx.onerror?.()}
  });return req}
  return tx;
 }
};
globalThis.indexedDB={open(){const r={result:db};queueMicrotask(()=>{if(!tables.size)r.onupgradeneeded?.();r.onsuccess?.()});return r}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{storage:{persist:async()=>true}}});
const storage=await import('../src/legacy/db.mjs');
const password='Uma senha segura para o Clara 2026';
const original=await storage.initData();
original.accounts[0].openingCents=47123;
const saved=await storage.saveData(original);
check(saved.accounts[0].openingCents===47123,'Legacy data saved');
check(tables.get('app').has('state'),'Legacy plain record exists before opt-in');
await storage.enableVault(password);
check(!tables.get('app').has('state'),'Plain record atomically deleted after enable');
check(typeof tables.get('app').get('state-vault')==='string','Vault holds encrypted envelope');
check(!tables.get('app').get('state-vault').includes(saved.accounts[0].name),'Vault does not leak account name');
check(await storage.vaultExists(),'Vault enabled');
check((await storage.loadData()).accounts[0].openingCents===47123,'Vault data loads before lock');
const changed=await storage.saveData({...saved,accounts:[{...saved.accounts[0],openingCents:98333}]});
check(changed.accounts[0].openingCents===98333,'Encrypted edits persist');
check(!tables.get('app').has('state'),'Edits do not restore plaintext');
storage.lockVault();
await rejected(storage.loadData(),e=>e.code==='VAULT_LOCKED','Locked vault blocks reads');
await rejected(storage.saveData(saved),e=>e.code==='VAULT_LOCKED','Locked vault blocks writes');
await rejected(storage.unlockVault('Senha incorreta segura 2026'),/Senha incorreta/,'Wrong password cannot unlock');
check(!tables.get('app').has('state'),'Bad password cannot cause fallback to plaintext');
const recovered=await storage.unlockVault(password);
check(recovered.accounts[0].openingCents===98333,'Correct password recovers latest update');
check(validateBackup(recovered)===true,'Vault contents validate');
await rejected(storage.disableVault('Senha incorreta segura 2026'),/Senha incorreta/,'Wrong password cannot disable protection');
check(!tables.get('app').has('state'),'Disable failure preserves ciphertext');
const restored=await storage.disableVault(password);
check(restored.accounts[0].openingCents===98333,'Disable preserves data');
check(tables.get('app').has('state')&&!tables.get('app').has('state-vault'),'Disable restores plain storage only on request');
check((await storage.loadData()).accounts[0].openingCents===98333,'Legacy mode still works');
// Prevent ciphertext resurrection when a save overlaps a vault transition.
await storage.enableVault(password);
const pending=storage.saveData({...restored,accounts:[{...restored.accounts[0],openingCents:120123}]});
const disabling=storage.disableVault(password);
const [lastSave,afterDisable]=await Promise.all([pending,disabling]);
check(lastSave.accounts[0].openingCents===120123,'Concurrent write completed');
check(afterDisable.accounts[0].openingCents===120123,'Disable waited for latest write');
check(!await storage.vaultExists(),'Concurrent save must not resurrect ciphertext');
check((await storage.loadData()).accounts[0].openingCents===120123,'Latest balance survives disable');
await storage.enableVault(password);
const disablingFirst=storage.disableVault(password);
const writingAfter=storage.saveData({...restored,accounts:[{...restored.accounts[0],openingCents:130456}]});
await Promise.all([disablingFirst,writingAfter]);
check(!await storage.vaultExists(),'Later write does not re-enable vault');
check((await storage.loadData()).accounts[0].openingCents===130456,'Write after disable uses plaintext only');
console.log('RC2: '+checks+' testes de migração de cofre, reabertura, senha e integridade aprovados');
