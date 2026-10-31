/* Bloqueio de interface opcional. NÃO criptografa o IndexedDB.
   Uso somente local, sem senha persistida; acesso ao perfil do navegador
   ou limpeza de armazenamento pode contornar o bloqueio. */
const te=new TextEncoder();
const toHex=arr=>Array.from(arr,x=>x.toString(16).padStart(2,'0')).join('');
const fromHex=s=>Uint8Array.from(s.match(/.{2}/g)||[],x=>parseInt(x,16));
const compare=(a,b)=>{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;};
async function pbkdf(password,salt,cryptoAPI){
 const key=await cryptoAPI.subtle.importKey('raw',te.encode(password),'PBKDF2',false,['deriveBits']);
 return new Uint8Array(await cryptoAPI.subtle.deriveBits({name:'PBKDF2',salt,iterations:200000,hash:'SHA-256'},key,256));
}
export async function createLockRecord(password,cryptoAPI=globalThis.crypto){
 if(typeof password!=='string'||password.length<12||password.length>1024)throw Error('Informe uma senha de pelo menos 12 caracteres.');
 if(!cryptoAPI?.subtle||!cryptoAPI.getRandomValues)throw Error('Recurso criptográfico indisponível.');
 const salt=cryptoAPI.getRandomValues(new Uint8Array(16));
 return JSON.stringify({format:'clara-local-lock',version:1,salt:toHex(salt),verifier:toHex(await pbkdf(password,salt,cryptoAPI))});
}
export async function verifyLockRecord(record,password,cryptoAPI=globalThis.crypto){
 if(typeof password!=='string'||!cryptoAPI?.subtle)return false;
 try{const obj=JSON.parse(record);if(obj.format!=='clara-local-lock'||obj.version!==1||
  !/^[a-f0-9]{32}$/.test(obj.salt)||!/^[a-f0-9]{64}$/.test(obj.verifier))return false;
  const actual=await pbkdf(password,fromHex(obj.salt),cryptoAPI);
  return compare(actual,fromHex(obj.verifier));
 }catch{return false;}
}
