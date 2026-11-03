'use strict';
/* Clara Finanças — Atualizador v2: sem estado do atualizador legado.
 * Atualiza apenas os arquivos PWA, nunca OPFS, IndexedDB ou o cofre local.
 */
const ClaraUpdate=(()=>{
 const INSTALLED_VERSION=CLARA_APP_VERSION;
 const INSTALLED_CACHE=typeof CLARA_BOOT_CACHE==='string'?CLARA_BOOT_CACHE:'';
 const DISMISS_KEY='clara-update-dismissed-v2';
 const NETWORK_TIMEOUT=12000,PREPARE_TIMEOUT=120000,ACTIVATE_TIMEOUT=30000,RESUME=15*60*1000;
 let registration=null,registering=null,checking=null,applying=false,ready=false;
 let remoteVersion='',remoteCache='',releaseNotes=[],lastCheck=0,progress=null;
 let status='Aguardando',message='Verificação automática após iniciar o Clara.';
 let installTimer=null,activationTimer=null,listenerBound=false;
 let lastProgress=0,startedPreparing=0;
 const tracked=new WeakSet(),get=id=>document.getElementById(id);
 const parse=value=>{
  const match=String(value||'').match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/);
  if(!match)return null;
  const pre=match[4]?.split('.')||[];
  if(pre.some(p=>/^\d+$/.test(p)&&p.length>1&&p[0]==='0'))return null;
  return {core:match.slice(1,4).map(BigInt),pre};
 };
 const compare=(a,b)=>{
  const x=parse(a),y=parse(b);if(!x||!y)return 0;
  for(let i=0;i<3;i++)if(x.core[i]!==y.core[i])return x.core[i]>y.core[i]?1:-1;
  if(!x.pre.length||!y.pre.length)return x.pre.length===y.pre.length?0:x.pre.length?-1:1;
  for(let i=0;i<Math.max(x.pre.length,y.pre.length);i++){
   const l=x.pre[i],r=y.pre[i];
   if(l===undefined)return -1;if(r===undefined)return 1;if(l===r)continue;
   const ln=/^\d+$/.test(l),rn=/^\d+$/.test(r);
   if(ln&&rn)return BigInt(l)>BigInt(r)?1:-1;
   if(ln!==rn)return ln?-1:1;
   return l>r?1:-1;
  }
  return 0;
 };
 const bound=(promise,timeout,text)=>{
  let timer;return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(Error(text)),timeout);
  })]).finally(()=>clearTimeout(timer));
 };
 const dismissed=()=>{try{return localStorage.getItem(DISMISS_KEY)===(remoteCache||remoteVersion);}catch{return false;}};
 const candidate=()=>Boolean(registration?.waiting);
 const newer=()=>candidate()||(Boolean(remoteVersion)&&(compare(remoteVersion,INSTALLED_VERSION)>0||
  (Boolean(remoteCache)&&remoteCache!==INSTALLED_CACHE)));
 const setStatus=(value,detail)=>{status=value;message=detail;paint();};
 const stopPreparing=()=>{clearTimeout(installTimer);installTimer=null;startedPreparing=0;lastProgress=0;progress=null;};
 function paint(){
  const installed=get('claraUpdateInstalled'),last=get('claraUpdateLast');
  if(installed)installed.textContent=INSTALLED_VERSION;
  if(last)last.textContent=lastCheck?new Date(lastCheck).toLocaleString('pt-BR'):'Ainda não verificado';
  if(get('claraUpdateState'))get('claraUpdateState').textContent=status;
  if(get('claraUpdateMessage'))get('claraUpdateMessage').textContent=message;
  const checkButton=get('checkClaraUpdate');
  if(checkButton){
   checkButton.disabled=Boolean(checking)||applying;
   checkButton.textContent=checking?'Verificando…':'Verificar agora';
  }
  const inProgress=status==='Preparando atualização';
  const label=ready?'Aplicar atualização':inProgress?'Preparando…':
   status==='Falha ao preparar'?'Tentar novamente':'Atualizar agora';
  const visible=newer()||ready;
  const action=get('applyClaraUpdate');
  if(action){
   action.hidden=!visible||applying;
   action.disabled=applying||inProgress;
   action.textContent=label;
   action.setAttribute('aria-busy',String(inProgress||applying));
  }
  const recovery=get('claraUpdateRecoveryHint');
  if(recovery)recovery.hidden=status!=='Falha ao preparar';
  const notice=get('claraUpdateNotice');
  if(!notice)return;
  notice.hidden=!visible||dismissed()||applying;
  const title=get('claraUpdateNoticeTitle'),detail=get('claraUpdateNoticeText');
  if(title)title.textContent=ready?'Atualização pronta para instalar':
   inProgress?'Preparando atualização':
   status==='Falha ao preparar'?'Falha ao preparar atualização':'Nova versão disponível';
  if(detail)detail.textContent='Clara '+(remoteVersion||'nova versão')+'. '+
   (ready?'Pacote offline completo. Após fazer o backup, confirme a instalação.':
   inProgress?message:
   status==='Falha ao preparar'?'Você pode tentar novamente sem apagar o cofre.':
   'Nova versão detectada.')+(releaseNotes[0]?' '+releaseNotes[0]:'');
  const button=get('claraUpdateNoticeInstall');
  if(button){
   button.hidden=false;button.disabled=applying||inProgress;
   button.setAttribute('aria-busy',String(inProgress||applying));
   button.textContent=label;
  }
 }
 function prepared(){
  ready=candidate();
  if(!ready)return false;
  stopPreparing();
  setStatus('Atualização disponível','Pacote completo e aguardando sua confirmação.');
  return true;
 }
 function watch(worker){
  if(!worker||tracked.has(worker))return;
  tracked.add(worker);
  const onState=()=>{
   if(worker.state==='installed'){
    if(!prepared()&&!newer()){
     stopPreparing();setStatus('Atualizado','Você está usando a versão '+INSTALLED_VERSION+'.');
    }
   }else if(worker.state==='redundant'&&!candidate()){
    stopPreparing();setStatus('Falha ao preparar','O navegador rejeitou o pacote. Tente novamente.');
   }
  };
  worker.addEventListener('statechange',onState);onState();
 }
 function prepare(){
  if(prepared())return;
  if(!newer()){stopPreparing();setStatus('Atualizado','Você está usando a versão '+INSTALLED_VERSION+'.');return;}
  if(!startedPreparing)startedPreparing=Date.now();
  const idle=Date.now()-(lastProgress||startedPreparing);
  if(idle>=PREPARE_TIMEOUT){
   stopPreparing();setStatus('Falha ao preparar','Tempo de preparação esgotado. Tente novamente sem limpar os dados.');return;
  }
  const worker=registration?.installing;
  const detail=progress?.total
   ?'Arquivos offline '+progress.done+'/'+progress.total+'; verificando pacote completo.'
   :worker?'O navegador está validando a nova versão.':'Aguardando o download da nova versão.';
  setStatus('Preparando atualização',detail);
  clearTimeout(installTimer);
  installTimer=setTimeout(prepare,Math.min(5000,PREPARE_TIMEOUT-idle));
 }
 function bind(){
  if(listenerBound)return;listenerBound=true;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
   if(applying){
    applying=false;clearTimeout(activationTimer);activationTimer=null;
    window.ClaraReloadGuard?.allowOfficialUpdate?.();
    location.reload();return;
   }
   if(prepared())return;
   if(!newer()){
    stopPreparing();setStatus('Atualizado','Você está usando a versão '+INSTALLED_VERSION+'.');
   }
  });
  navigator.serviceWorker.addEventListener('message',event=>{
   const data=event.data;
   if(data?.type==='CLARA_UPDATE_PROGRESS'){
    const done=Number(data.done)||0,total=Number(data.total)||0;
    if(!progress||done>progress.done)lastProgress=Date.now();
    progress={done,total};if(newer()&&!candidate())prepare();
   }else if(data?.type==='CLARA_ROLLBACK_SELECTED'){
    applying=false;clearTimeout(activationTimer);
    window.ClaraReloadGuard?.allowOfficialUpdate?.();location.reload();
   }else if(data?.type==='CLARA_BOOT_CONFIRMED'){
    if(!newer())setStatus('Atualizado','Nova versão validada.');
   }
  });
  window.addEventListener('online',()=>check(false).catch(()=>{}));
  window.addEventListener('focus',()=>{if(!lastCheck||Date.now()-lastCheck>RESUME)check(false).catch(()=>{});});
  document.addEventListener('visibilitychange',()=>{
   if(!document.hidden&&(!lastCheck||Date.now()-lastCheck>RESUME))check(false).catch(()=>{});
  });
  setInterval(()=>{if(!document.hidden)check(false).catch(()=>{});},60*60*1000);
 }
 async function register(){
  if(registration)return registration;
  if(registering)return registering;
  if(!('serviceWorker'in navigator)||!/^https?:$/.test(location.protocol)){
   setStatus('Indisponível','O atualizador requer HTTPS e Service Worker.');return null;
  }
  registering=(async()=>{
   const reg=await bound(navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}),
    NETWORK_TIMEOUT,'Registro do Service Worker não respondeu.');
   registration=reg;bind();
   reg.addEventListener('updatefound',()=>{watch(reg.installing);if(newer())prepare();});
   watch(reg.installing);
   prepared();
   return reg;
  })().finally(()=>{registering=null;});
  return registering;
 }
 async function latest(){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),NETWORK_TIMEOUT);
  try{
   const response=await fetch('./version.json?fresh='+Date.now(),{cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error('Não foi possível consultar a versão publicada.');
   const data=await response.json();
   if(typeof data.version!=='string'||data.version.length>128||!parse(data.version))
    throw Error('Metadados de versão inválidos.');
   if(data.cache!==undefined&&
      (typeof data.cache!=='string'||!/^clara-v2-[a-z\d-]{1,160}$/.test(data.cache)))
    throw Error('Identificador de build remoto inválido.');
   return {version:data.version,cache:data.cache||'',notes:Array.isArray(data.notes)
    ?data.notes.filter(s=>typeof s==='string').slice(0,5).map(s=>s.slice(0,500)):[]};
  }finally{clearTimeout(timer);}
 }
 async function check(interactive=false){
  if(checking)return checking;
  checking=(async()=>{
   try{
    const reg=await register();
    if(!reg)return false;
    setStatus('Verificando','Consultando a revisão publicada…');
    const remote=await latest();
    remoteVersion=remote.version;remoteCache=remote.cache;releaseNotes=remote.notes;
    lastCheck=Date.now();
    if(prepared())return true;
    // Checar UMA vez por solicitação. Se um worker estiver instalando,
    // não reiniciar o processo com outra chamada update().
    if(!reg.installing){
     await bound(reg.update(),NETWORK_TIMEOUT,'Consulta ao Service Worker não respondeu.');
    }
    if(prepared())return true;
    if(reg.installing){watch(reg.installing);prepare();return false;}
    if(newer()){prepare();return false;}
    stopPreparing();setStatus('Atualizado','Você está usando a versão '+INSTALLED_VERSION+'.');
    if(interactive&&typeof showToast==='function')showToast('Clara atualizado. Versão '+INSTALLED_VERSION+'.');
    return false;
   }catch(error){
    if(prepared())return true;
    stopPreparing();setStatus('Falha ao preparar','Não foi possível concluir: '+(error?.message||'erro de rede')+'.');
    if(interactive&&typeof showToast==='function')showToast(error.message,true);
    return false;
   }finally{checking=null;paint();}
  })();
  return checking;
 }
 function canApply(){
  if(!window.ClaraSecurity?.unlocked)throw Error('Desbloqueie o cofre antes de atualizar.');
  const modal=get('modalBg');
  if(modal?.getAttribute('aria-hidden')==='false'){
   if(typeof showToast==='function')showToast('Conclua a edição aberta antes de atualizar.',true);
   return false;
  }
  return true;
 }
 async function preflight(){
  if(!canApply())return false;
  if(!window.confirm('Aplicar a atualização '+(remoteVersion||'disponível')+'?'))return false;
  await bound(window.ClaraSecurity.flush(),15000,'O cofre não terminou de salvar.');
  const backup=await bound(window.ClaraBackups?.beforeUpdate?.(),15000,'Backup pré-atualização não respondeu.');
  if(!backup?.local)throw Error('Falha ao criar o ponto de recuperação criptografado.');
  if(!backup.external&&!window.confirm(
   'Backup local concluído; ainda não há cópia externa confirmada. Continuar?'))return false;
  return true;
 }
 async function apply(){
  if(applying)return false;
  if(!canApply())return false;
  const reg=await register();if(!reg)return false;
  if(!reg.waiting){
   await check(true);
   if(!reg.waiting)return false;
  }
  if(!await preflight())return false;
  // Conferir novamente depois do snapshot: outro tab pode ter ativado o worker.
  const worker=reg.waiting;
  if(!worker){setStatus('Falha ao preparar','O pacote mudou durante o backup. Verifique novamente.');return false;}
  stopPreparing();ready=false;applying=true;
  setStatus('Aplicando atualização','Snapshot confirmado. Ativando pacote validado…');
  activationTimer=setTimeout(()=>{
   if(!applying)return;
   applying=false;setStatus('Falha ao preparar','Ativação não confirmada. Reabra o Clara ou verifique novamente.');
  },ACTIVATE_TIMEOUT);
  worker.postMessage({type:'SKIP_WAITING'});
  return true;
 }
 function dismiss(){
  try{if(remoteVersion)localStorage.setItem(DISMISS_KEY,remoteCache||remoteVersion);}catch{}
  if(get('claraUpdateNotice'))get('claraUpdateNotice').hidden=true;
 }
 async function init(){
  try{await register();await check(false);}
  catch{setStatus('Sem confirmação','Não foi possível verificar atualizações agora.');}
 }
 return {init,check,apply,dismiss,paint,compare,
  get installedVersion(){return INSTALLED_VERSION;},
  get status(){return status;},
  get ready(){return ready;},
  get remoteVersion(){return remoteVersion;},
  get reopenReady(){return false;},
  get installProgress(){return progress&&{...progress};}};
})();
window.ClaraUpdate=ClaraUpdate;
