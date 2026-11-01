/* Clara Finanças: desbloqueio local usando WebAuthn PRF. A senha de acesso continua obrigatória como recuperação. */
(() => {
'use strict';
const RECORD_KEY='clara-financas-biometria-prf-v1';
const AAD=new TextEncoder().encode('CLARA-BIOMETRIA-PRF-V1');
const $=id=>document.getElementById(id);
const random=n=>crypto.getRandomValues(new Uint8Array(n));
const enc=new TextEncoder(),dec=new TextDecoder();
const b64url=b64=>b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
let busy=false;
const supported=()=>!!(window.isSecureContext&&crypto?.subtle&&window.PublicKeyCredential&&navigator.credentials?.create&&navigator.credentials?.get&&typeof localStorage!=='undefined');
function readRecord(){
 try{
  const raw=localStorage.getItem(RECORD_KEY);
  if(!raw)return null;
  const x=JSON.parse(raw);
  if(x.format!=='CLARA-BIOMETRIA-PRF-1'||!x.id||!x.salt||!x.iv||!x.data||!x.origin||!x.vaultSalt)throw Error('Registro inválido');
  return x;
 }catch{return null;}
}
function compatibleRecord(){
 const r=readRecord();
 if(!r||r.origin!==location.origin)return null;
 try{if(validateVault(readVault()).salt!==r.vaultSalt)return null;}catch{return null;}
 return r;
}
const uiStatus=(message,isError=false)=>{
 const node=$('claraBiometricStatus');
 if(node){node.textContent=message;node.setAttribute('data-error',String(isError));}
};
function paint(){
 const record=compatibleRecord();
 const login=$('securityBiometric');
 if(login){login.hidden=!(record&&supported()&&!$('securityConfirmWrap')?.required);login.disabled=busy;}
 const settings=$('view-ajustes');
 if(!settings||!settings.classList.contains('active')||configTab!=='dados')return;
 const area=settings.querySelector('.config-content');
 if(!area)return;
 let panel=$('claraBiometricSettings');
 if(!panel){
  panel=document.createElement('section');panel.id='claraBiometricSettings';panel.className='clara-biometric-settings';
  panel.innerHTML='<div><h3>Abrir com biometria</h3><p id="claraBiometricHelp"></p><p id="claraBiometricStatus" role="status" aria-live="polite"></p></div><button type="button" class="btn" id="claraBiometricManage"></button>';
  area.appendChild(panel);
 }
 const help=$('claraBiometricHelp'),button=$('claraBiometricManage');
 if(!supported()){
  help.textContent='Indisponível neste navegador. Use o app instalado via HTTPS em um aparelho compatível.';
  button.textContent='Não disponível';button.disabled=true;return;
 }
 help.textContent=record?'Ativada neste navegador. O sistema poderá pedir digital, rosto ou PIN.':'Ative uma vez com a senha do cofre. Depois poderá abrir sem digitá-la neste navegador.';
 button.textContent=record?'Desativar biometria':'Ativar biometria';
 button.dataset.bioAction=record?'disable':'setup';
 button.disabled=busy||!window.ClaraSecurity?.unlocked;
}
function promptPassword(){
 return new Promise(resolve=>{
  const layer=document.createElement('div');
  layer.className='clara-bio-overlay';
  layer.innerHTML='<section class="clara-bio-dialog" role="dialog" aria-modal="true" aria-labelledby="claraBioTitle"><h2 id="claraBioTitle">Ativar biometria</h2><p>Confirme a senha atual do cofre. Sua senha não será armazenada sem criptografia.</p><form id="claraBioPasswordForm"><label for="claraBioPassword">Senha do cofre</label><input id="claraBioPassword" type="password" autocomplete="current-password" required minlength="12"><div class="clara-bio-buttons"><button type="button" id="claraBioCancel" class="btn">Cancelar</button><button type="submit" class="btn primary">Continuar</button></div></form></section>';
  document.body.appendChild(layer);
  const field=$('claraBioPassword'),form=$('claraBioPasswordForm');
  const done=value=>{document.removeEventListener('keydown',onKey,true);layer.remove();resolve(value);};
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();done(null);}};
  $('claraBioCancel').addEventListener('click',()=>done(null),{once:true});
  form.addEventListener('submit',e=>{e.preventDefault();e.stopPropagation();const pass=field.value;field.value='';done(pass);},{once:true});
  document.addEventListener('keydown',onKey,true);
  field.focus();
 });
}
async function credentialPrf(record){
 const allowedId=b64Bytes(record.id);
 const response=await navigator.credentials.get({publicKey:{
  challenge:random(32),
  allowCredentials:[{type:'public-key',id:allowedId}],
  userVerification:'required',timeout:60000,
  extensions:{prf:{evalByCredential:{[b64url(record.id)]:{first:b64Bytes(record.salt)}}}}
 }});
 if(!response||response.type!=='public-key'||bytesB64(new Uint8Array(response.rawId))!==record.id)
  throw Error('Chave de acesso diferente da cadastrada neste navegador.');
 const value=response.getClientExtensionResults?.().prf?.results?.first;
 if(!value||new Uint8Array(value).length!==32)throw Error('Este autenticador não oferece a chave criptográfica necessária. Abra com a senha.');
 return crypto.subtle.importKey('raw',value,'AES-GCM',false,['encrypt','decrypt']);
}
function explain(error){
 if(error?.name==='NotAllowedError'||error?.name==='AbortError')return 'Autenticação cancelada ou não autorizada. Use sua senha normalmente.';
 if(error?.name==='NotSupportedError'||error?.name==='SecurityError')return 'Biometria não suportada neste navegador. A senha do cofre continua funcionando.';
 return error?.message||'Não foi possível usar a biometria. Abra com sua senha.';
}
async function setup(){
 if(busy)return;
 busy=true;paint();
 let password=null;
 try{
  if(!supported())throw Error('A biometria exige HTTPS e suporte a WebAuthn PRF.');
  if(!window.ClaraSecurity?.unlocked)throw Error('Desbloqueie o cofre com a senha primeiro.');
  password=await promptPassword();
  if(password===null)return;
  const vault=validateVault(readVault());
  const derived=await deriveKey(password,b64Bytes(vault.salt));
  try{await decryptState(vault,derived);}catch{throw Error('Senha incorreta. A biometria não foi ativada.');}
  const salt=random(32);
  const credential=await navigator.credentials.create({publicKey:{
   challenge:random(32),
   rp:{name:'Clara Finanças'},
   user:{id:random(20),name:'clara-local',displayName:'Clara Finanças'},
   pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
   authenticatorSelection:{authenticatorAttachment:'platform',residentKey:'preferred',userVerification:'required'},
   timeout:60000,attestation:'none',extensions:{prf:{eval:{first:salt}}}
  }});
  if(!credential||!credential.rawId)throw Error('Não foi possível cadastrar uma chave biométrica.');
  const record={format:'CLARA-BIOMETRIA-PRF-1',id:bytesB64(new Uint8Array(credential.rawId)),
   salt:bytesB64(salt),origin:location.origin,vaultSalt:vault.salt};
  // A derivação da chave depende da autenticação física, não apenas da assinatura pública.
  const wrapKey=await credentialPrf(record);
  const iv=random(12);
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:AAD},wrapKey,enc.encode(password));
  record.iv=bytesB64(iv);record.data=bytesB64(new Uint8Array(cipher));
  localStorage.setItem(RECORD_KEY,JSON.stringify(record));
  uiStatus('Biometria ativada. A senha continua sendo sua forma de recuperação.');
 }catch(error){uiStatus(explain(error),true);}
 finally{password=null;busy=false;paint();}
}
async function unlock(){
 if(busy)return;
 busy=true;paint();
 let password=null;
 try{
  if(!supported())throw Error('Biometria indisponível neste navegador.');
  const record=compatibleRecord();
  if(!record)throw Error('Biometria não configurada para este cofre. Abra com a senha.');
  const key=await credentialPrf(record);
  const decrypted=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64Bytes(record.iv),additionalData:AAD},key,b64Bytes(record.data));
  password=dec.decode(decrypted);
  await secureEnter(password,'');
  secureStatus('');
 }catch(error){secureStatus(explain(error));}
 finally{password=null;busy=false;paint();}
}
function disable(){
 if(busy||!window.ClaraSecurity?.unlocked)return;
 if(!window.confirm('Desativar abertura por biometria neste navegador? A senha do cofre continuará funcionando.'))return;
 try{localStorage.removeItem(RECORD_KEY);uiStatus('Biometria desativada.');}catch{uiStatus('Não foi possível remover a configuração.',true);}
 paint();
}
document.addEventListener('click',event=>{
 const button=event.target.closest?.('#securityBiometric, #claraBiometricManage');
 if(!button)return;
 event.preventDefault();
 event.stopPropagation();
 if(button.id==='securityBiometric')unlock();
 else if(button.dataset.bioAction==='disable')disable();
 else if(button.dataset.bioAction==='setup')setup();
},true);
const originalRenderSettings=renderAjustes;
renderAjustes=function(){const v=originalRenderSettings();paint();return v;};
window.ClaraBiometric={paint,setup,unlock,disable,get enabled(){return !!compatibleRecord();}};
paint();
})();