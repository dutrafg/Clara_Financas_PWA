/* Backup criptografado localmente: PBKDF2-SHA256 + AES-256-GCM.
   Nenhuma senha ou chave é armazenada pelo Clara. */
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const ITERATIONS=310000,MARK='clara-encrypted-backup';
const encode64=bytes=>{
 const chunks=[];for(let i=0;i<bytes.length;i+=16383)chunks.push(String.fromCharCode(...bytes.subarray(i,i+16383)));
 return btoa(chunks.join(''));
};
const decode64=text=>{
 if(typeof text!=='string'||text.length>15_000_000||!/^[A-Za-z0-9+/]*={0,2}$/.test(text)||text.length%4)
  throw Error('Dados criptografados inválidos.');
 return Uint8Array.from(atob(text),c=>c.charCodeAt(0));
};
const derive=async(pass,salt,usage,webCrypto)=>{
 const base=await webCrypto.subtle.importKey('raw',encoder.encode(pass),'PBKDF2',false,['deriveKey']);
 return webCrypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},
   base,{name:'AES-GCM',length:256},false,[usage]);
};
const requirePassword=p=>{if(typeof p!=='string'||p.length<12||p.length>1024)throw Error('A senha precisa conter de 12 a 1024 caracteres.');};
export async function encryptBackup(data,password,webCrypto=globalThis.crypto){
 requirePassword(password);
 if(!webCrypto?.subtle||!webCrypto.getRandomValues)throw Error('Criptografia indisponível. Use HTTPS ou localhost.');
 const plaintext=encoder.encode(JSON.stringify(data));
 if(plaintext.length>8_000_000)throw Error('Backup acima do limite de 8 MB.');
 const salt=webCrypto.getRandomValues(new Uint8Array(16)),iv=webCrypto.getRandomValues(new Uint8Array(12));
 const key=await derive(password,salt,'encrypt',webCrypto);
 const encrypted=await webCrypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(MARK)},
  key,plaintext);
 return JSON.stringify({format:MARK,version:1,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,
   cipher:'AES-256-GCM',salt:encode64(salt),iv:encode64(iv),payload:encode64(new Uint8Array(encrypted))});
}
export async function decryptBackup(content,password,webCrypto=globalThis.crypto){
 requirePassword(password);
 if(!webCrypto?.subtle)throw Error('Criptografia indisponível. Use HTTPS ou localhost.');
 if(typeof content!=='string'||content.length>15_000_000)throw Error('Arquivo criptografado inválido.');
 let envelope;try{envelope=JSON.parse(content)}catch{throw Error('Arquivo criptografado inválido.')}
 if(envelope?.format!==MARK||envelope.version!==1||envelope.iterations!==ITERATIONS||
   envelope.kdf!=='PBKDF2-SHA256'||envelope.cipher!=='AES-256-GCM')throw Error('Formato de backup não suportado.');
 let plain;
 try{
  const salt=decode64(envelope.salt),iv=decode64(envelope.iv),payload=decode64(envelope.payload);
  if(salt.length!==16||iv.length!==12||payload.length<16)throw Error('Invalid encryption envelope');
  const key=await derive(password,salt,'decrypt',webCrypto);
  plain=await webCrypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:encoder.encode(MARK)},key,payload);
  return JSON.parse(decoder.decode(plain));
 }catch{throw Error('Senha incorreta ou backup corrompido.');}
}
export const isEncryptedBackup=content=>{try{return JSON.parse(content)?.format===MARK;}catch{return false;}};
