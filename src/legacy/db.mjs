/* IndexedDB é a fonte de verdade. A pasta selecionada, quando suportada, recebe um espelho JSON. */
import {blankData,migrateData,validateBackup} from './core.mjs';
import {encryptBackup,decryptBackup} from './security.mjs';
const DB_NAME='clara-financas-local-v1';let dbPromise;
let vaultPassword=null;
export class VaultLockedError extends Error{constructor(){super('O banco criptografado está bloqueado. Informe a senha local.');this.name='VaultLockedError';this.code='VAULT_LOCKED';}}
const openDB=()=>dbPromise ||= new Promise((resolve,reject)=>{if(!globalThis.indexedDB)return reject(new Error('IndexedDB indisponível'));const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{const db=r.result;db.createObjectStore('app');db.createObjectStore('preferences');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function transaction(store,mode,operation){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);let value;let settled=false;tx.oncomplete=()=>resolve(value);tx.onerror=()=>{if(!settled){settled=true;reject(tx.error||new Error('Falha ao gravar dados'));}};tx.onabort=()=>{if(!settled){settled=true;reject(tx.error||new Error('Gravação abortada'));}};try{const req=operation(tx.objectStore(store));if(req){req.onsuccess=()=>{value=req.result;};req.onerror=()=>{tx.abort();};}}catch(e){tx.abort();reject(e);}});}
export async function vaultExists(){return !!(await transaction('app','readonly',s=>s.get('state-vault')));}
export async function loadData(){
 const encrypted=await transaction('app','readonly',s=>s.get('state-vault'));
 if(encrypted){
  if(!vaultPassword)throw new VaultLockedError();
  const result=migrateData(await decryptBackup(encrypted,vaultPassword));validateBackup(result);return result;
 }
 return (await transaction('app','readonly',s=>s.get('state')))||null;
}
async function swapVaultData(plaintext,ciphertext,enable){
 const db=await openDB();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('app','readwrite');
  const store=tx.objectStore('app');
  try{if(enable){store.put(ciphertext,'state-vault');store.delete('state');}
   else{store.put(plaintext,'state');store.delete('state-vault');}}
  catch(e){try{tx.abort()}catch{}reject(e);return;}
  tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error||new Error('Falha na proteção do banco'));
  tx.onabort=()=>reject(tx.error||new Error('Operação de proteção abortada'));
 });
}
export async function enableVault(password){
 if(await vaultExists())throw Error('O banco já está criptografado.');
 const plain=await transaction('app','readonly',s=>s.get('state'));
 if(!plain)throw Error('Banco local vazio; inicialize antes de ativar.');
 validateBackup(plain);
 const encrypted=await encryptBackup(plain,password);
 const verified=migrateData(await decryptBackup(encrypted,password));
 validateBackup(verified);
 await swapVaultData(null,encrypted,true);
 vaultPassword=password;
 return true;
}
export async function unlockVault(password){
 const encrypted=await transaction('app','readonly',s=>s.get('state-vault'));
 if(!encrypted)throw Error('Banco protegido não encontrado.');
 const data=migrateData(await decryptBackup(encrypted,password));
 validateBackup(data);
 vaultPassword=password;
 return data;
}
export function lockVault(){vaultPassword=null;}
export async function disableVault(password){
 const encrypted=await transaction('app','readonly',s=>s.get('state-vault'));
 if(!encrypted)throw Error('O banco não está criptografado.');
 const data=migrateData(await decryptBackup(encrypted,password));validateBackup(data);
 await swapVaultData(data,null,false);
 vaultPassword=null;return data;
}
export async function saveData(data){
 const next=structuredClone(data);validateBackup(next);next.revision=(next.revision||0)+1;
 next.updatedAt=new Date().toISOString();
 if(await vaultExists()){
  if(!vaultPassword)throw new VaultLockedError();
  const encrypted=await encryptBackup(next,vaultPassword);
  await transaction('app','readwrite',s=>s.put(encrypted,'state-vault'));
 }else{
  await transaction('app','readwrite',s=>s.put(next,'state'));
 }
 return next;
}
export const getDirectoryHandle=()=>transaction('preferences','readonly',s=>s.get('folder'));
export const setDirectoryHandle=(handle)=>transaction('preferences','readwrite',s=>s.put(handle,'folder'));
export const clearDirectoryHandle=()=>transaction('preferences','readwrite',s=>s.delete('folder'));
export async function persistentStorage(){try{return await navigator.storage?.persist?.()||false;}catch{return false;}}
export async function chooseFolder(){if(typeof showDirectoryPicker!=='function')throw Error('Este navegador não permite selecionar pastas. Use Exportar backup ou Chrome/Edge no computador.');const handle=await showDirectoryPicker({id:'clara-financas',mode:'readwrite',startIn:'documents'});const allowed=await handle.requestPermission({mode:'readwrite'});if(allowed!=='granted')throw Error('Permissão de gravação não concedida.');await setDirectoryHandle(handle);return handle;}
export async function getWritableFolder(){const h=await getDirectoryHandle();if(!h)return null;const p=await h.queryPermission({mode:'readwrite'});return p==='granted'?h:null;}
export async function folderPermission(){const h=await getDirectoryHandle();if(!h)return {state:'none',name:''};const p=await h.queryPermission({mode:'readwrite'});return {state:p,name:h.name};}
export async function askFolderPermission(){const h=await getDirectoryHandle();if(!h)return false;return (await h.requestPermission({mode:'readwrite'}))==='granted';}
const LEGACY_FILE='clara-financas-dados.json';
const SAFE_FILE='clara-financas-dados.clara';
export async function writeFolderCopy(data,password){
 if(typeof password!=='string'||!password)throw Error('Para proteger a cópia em pasta, informe uma senha.');
 validateBackup(data);
 const encrypted=await encryptBackup(data,password);
 const h=await getWritableFolder();if(!h)return false;
 const file=await h.getFileHandle(SAFE_FILE,{create:true});
 const writer=await file.createWritable();
 try{await writer.write(encrypted);await writer.close();return true;}
 catch(e){try{await writer.abort()}catch{}throw e;}
}
async function folderRead(name){
 const h=await getDirectoryHandle();
 if(!h)throw Error('Nenhuma pasta selecionada.');
 const permission=await h.queryPermission({mode:'read'});
 if(permission!=='granted'&&await h.requestPermission({mode:'read'})!=='granted')
  throw Error('Permissão de leitura negada.');
 let file;try{file=await h.getFileHandle(name);}catch{throw Error('Arquivo de cópia não encontrado na pasta.');}
 return (await file.getFile()).text();
}
export async function readFolderCopy(password){
 if(typeof password!=='string'||!password)throw Error('Informe a senha do backup protegido.');
 const plain=await decryptBackup(await folderRead(SAFE_FILE),password);
 const data=migrateData(plain);validateBackup(data);return data;
}
export async function readLegacyFolderCopy(){
 const data=migrateData(JSON.parse(await folderRead(LEGACY_FILE)));
 validateBackup(data);return data;
}
export async function removeLegacyFolderCopy(){
 const h=await getWritableFolder();if(!h)throw Error('Permissão de gravação necessária.');
 // O usuário deve primeiro confirmar a restauração segura; esta rotina remove
 // somente o JSON antigo e jamais modifica o backup cifrado.
 await h.removeEntry(LEGACY_FILE);return true;
}
export async function hasFolderCopy(){
 try{const h=await getDirectoryHandle();if(!h)return false;
  await h.getFileHandle(SAFE_FILE);return true;}catch{return false;}
}
export async function hasLegacyFolderCopy(){
 try{const h=await getDirectoryHandle();if(!h)return false;
  await h.getFileHandle(LEGACY_FILE);return true;}catch{return false;}
}
export async function initData(){const raw=await loadData();if(!raw)return saveData(blankData());const migrated=migrateData(raw);validateBackup(migrated);return raw.schemaVersion!==migrated.schemaVersion?saveData(migrated):migrated;}
