'use strict';
/* Atualizador Clara: fluxo inspirado na confirmação de worker instalada do EvoluFísico2.
 * Armazenamento cifrado não é cache: nunca apagar OPFS, IndexedDB ou localStorage. */
const ClaraUpdate=(()=>{
 const INSTALLED_VERSION=CLARA_APP_VERSION;
 const HOUR=60*60*1000,RESUME=15*60*1000,DISMISS_KEY='clara-update-dismissed-v1';
 const PREPARE_TIMEOUT=120000, NETWORK_TIMEOUT=10000,PROGRESS_POLL=5000;
 let registration=null,initialPromise=null,checking=null,installPromise=null;
 let applying=false,ready=false,reopenReady=false,observed=false;
 let status='Aguardando',message='Verificação automática ao desbloquear.',lastCheck=0;
 let remoteVersion='',releaseNotes=[],prepareTimer=null,activationTimer=null;
 let preparationStartedAt=0,lastProgressAt=0,lastProgressDone=-1,installProgress=null;
 const workers=new WeakSet(),get=id=>document.getElementById(id);
 const parseVersion=value=>{
  const match=String(value||'').match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/);
  if(!match)return null;
  const prerelease=match[4]?.split('.')||[];
  if(prerelease.some(part=>/^\d+$/.test(part)&&part.length>1&&part[0]==='0'))return null;
  return {core:match.slice(1,4).map(BigInt),prerelease};
 };
 const compare=(a,b)=>{
  const x=parseVersion(a),y=parseVersion(b);
  if(!x||!y)return 0;
  for(let i=0;i<3;i++){if(x.core[i]!==y.core[i])return x.core[i]>y.core[i]?1:-1;}
  if(!x.prerelease.length||!y.prerelease.length)return x.prerelease.length===y.prerelease.length?0:x.prerelease.length?-1:1;
  for(let i=0;i<Math.max(x.prerelease.length,y.prerelease.length);i++){
   const left=x.prerelease[i],right=y.prerelease[i];
   if(left===undefined)return -1;if(right===undefined)return 1;if(left===right)continue;
   const leftNumeric=/^\d+$/.test(left),rightNumeric=/^\d+$/.test(right);
   if(leftNumeric&&rightNumeric)return BigInt(left)>BigInt(right)?1:-1;
   if(leftNumeric!==rightNumeric)return leftNumeric?-1:1;
   return left>right?1:-1;
  }
  return 0;
 };
 const dismissed=()=>{try{return localStorage.getItem(DISMISS_KEY)===remoteVersion;}catch{return false;}};
 const newer=()=>!!remoteVersion&&compare(remoteVersion,INSTALLED_VERSION)>0;
 const bounded=(task,ms,reason)=>{
  let timer;
  return Promise.race([Promise.resolve(task),new Promise((_,reject)=>{
   timer=setTimeout(()=>reject(Error(reason)),ms);
  })]).finally(()=>clearTimeout(timer));
 };
 function setStatus(next,detail){status=next;message=detail;paint();}
 function clearPreparation(){preparationStartedAt=0;lastProgressAt=0;lastProgressDone=-1;installProgress=null;clearTimeout(prepareTimer);prepareTimer=null;}
 function startPreparation(){
  if(!preparationStartedAt)preparationStartedAt=Date.now();
  clearTimeout(prepareTimer);
  const idle=Date.now()-(lastProgressAt||preparationStartedAt);
  const worker=registration?.installing;
  if(registration?.waiting){handleWaiting();return;}
  if(worker?.state==='redundant'){
   clearPreparation();setStatus('Falha ao preparar','O navegador rejeitou o pacote offline. Confira a conexão e tente novamente sem apagar os dados.');return;
  }
  if(idle>=PREPARE_TIMEOUT){
   clearPreparation();setStatus('Falha ao preparar','A preparação ultrapassou 2 minutos sem confirmar o pacote. Você pode tentar novamente; o cofre e os caches anteriores foram preservados.');return;
  }
  const detail=installProgress?.total
   ? `Arquivos offline ${installProgress.done}/${installProgress.total}. O pacote só será instalado depois de completo.`
   : worker?'O navegador está baixando e validando os arquivos offline.':'Aguardando o navegador iniciar a instalação do pacote.';
  setStatus('Preparando atualização',detail);
  prepareTimer=setTimeout(()=>startPreparation(),Math.min(PROGRESS_POLL,PREPARE_TIMEOUT-idle));
 }
 async function activatedPackageReady(r){
  // Uma segunda aba pode já ter ativado o novo SW, sem recarregar esta aba.
  // Não confiar só na versão remota: exigir cache completo e HTML de destino.
  if(!r?.active||r.active.state!=='activated'||!newer())return false;
  try{
   const names=await caches.keys();
   for(const name of names.filter(n=>n.startsWith('clara-financas-'+remoteVersion+'-'))){
    const response=await (await caches.open(name)).match(new URL('./index.html',r.scope));
    if(response?.ok&&(await response.text()).includes("const CLARA_APP_VERSION='"+remoteVersion+"'"))return true;
   }
  }catch{}
  return false;
 }
 function paint(){
  const installed=get('claraUpdateInstalled'),last=get('claraUpdateLast');
  if(installed)installed.textContent=INSTALLED_VERSION;
  if(last)last.textContent=lastCheck?new Date(lastCheck).toLocaleString('pt-BR'):'Ainda não verificado';
  if(get('claraUpdateState'))get('claraUpdateState').textContent=status;
  if(get('claraUpdateMessage'))get('claraUpdateMessage').textContent=message;
  const checkButton=get('checkClaraUpdate');
  if(checkButton){checkButton.disabled=!!checking;checkButton.textContent=checking?'Verificando…':'Verificar agora';}
  const preparing=status==='Preparando atualização';
  const label=reopenReady?'Reabrir atualizado':ready?'Aplicar atualização':
   ['Falha ao preparar','Sem confirmação'].includes(status)?'Tentar novamente':preparing?'Preparando…':'Atualizar agora';
  const action=get('applyClaraUpdate');
  if(action){
   action.hidden=!newer()||applying;
   action.disabled=applying||preparing;
   action.textContent=label;
   action.setAttribute('aria-busy','false');
  }
  if(get('claraUpdateRecoveryHint'))get('claraUpdateRecoveryHint').hidden=!newer()||!['Falha ao preparar','Sem confirmação'].includes(status);
  const notice=get('claraUpdateNotice');
  if(!notice)return;
  notice.hidden=!newer()||dismissed()||applying;
  const title=get('claraUpdateNoticeTitle'),description=get('claraUpdateNoticeText');
  if(title)title.textContent=ready?'Atualização pronta para instalar':reopenReady?'Atualização pronta para reabrir':
   preparing?'Preparando atualização':
   status==='Falha ao preparar'?'Atualização ainda não pronta':'Nova versão encontrada';
  if(description)description.textContent='Clara '+remoteVersion+'. '+
   (ready?'O pacote está pronto. Instale após proteger o cofre.':reopenReady?'O navegador já ativou o novo pacote. Reabra após salvar o cofre.':
    preparing?message:
    status==='Falha ao preparar'||status==='Sem confirmação'?'Falha na preparação. Tente novamente sem limpar os dados do navegador.':
    'Preparando arquivos offline. Você pode repetir a tentativa se não concluir.')+
   (releaseNotes.length?' '+releaseNotes[0]:'');
  const button=get('claraUpdateNoticeInstall');
  if(button){button.hidden=false;button.disabled=applying||preparing;button.textContent=label;button.setAttribute('aria-busy',String(preparing||applying));}
 }
 function handleWaiting(){
  ready=!!registration?.waiting;
  if(ready){
   reopenReady=false;clearPreparation();
   setStatus('Atualização disponível','Versão '+(remoteVersion||'nova')+' pronta. Selecione Aplicar atualização.');
   // A confirmação é sempre feita no toque do usuário, nunca em um evento assíncrono.
  }else paint();
 }
 function watchInstalling(worker){
  if(!worker||workers.has(worker))return;
  workers.add(worker);
  const sync=()=>{
   if(worker.state==='installed')handleWaiting();
   else if(worker.state==='redundant'&&newer()&&!registration?.waiting){
    ready=false;clearPreparation();
    setStatus('Falha ao preparar','O navegador rejeitou o pacote offline. Confira sua conexão e tente novamente.');
   }
  };
  worker.addEventListener('statechange',sync);sync();
 }
 function bindEvents(){
  if(observed)return;
  observed=true;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
   if(applying){
    clearTimeout(activationTimer);activationTimer=null;applying=false;
    window.ClaraReloadGuard?.allowOfficialUpdate();
    location.reload();
   }else if(newer())void check(false);
  });
  navigator.serviceWorker.addEventListener('message',event=>{
   const data=event.data;
   if(data?.type==='CLARA_UPDATE_PROGRESS'){
    const done=Number(data.done)||0,total=Number(data.total)||0;
    if(done>lastProgressDone){lastProgressDone=done;lastProgressAt=Date.now();}
    installProgress={done,total};
    if(newer()&&!registration?.waiting)startPreparation();
   }else if(data?.type==='CLARA_ROLLBACK_SELECTED'){
    clearTimeout(activationTimer);activationTimer=null;applying=false;
    window.ClaraReloadGuard?.allowOfficialUpdate();location.reload();
   }
  });
  window.addEventListener('online',()=>{check(false).catch(()=>{});});
  window.addEventListener('focus',()=>{if(lastCheck&&Date.now()-lastCheck>=RESUME)check(false).catch(()=>{});});
  document.addEventListener('visibilitychange',()=>{
   if(!document.hidden&&(!lastCheck||Date.now()-lastCheck>=RESUME))check(false).catch(()=>{});
  });
  window.setInterval(()=>{if(!document.hidden&&navigator.onLine)check(false).catch(()=>{});},HOUR);
 }
 async function ensureRegistration(){
  if(registration)return registration;
  if(initialPromise)return initialPromise;
  if(!('serviceWorker'in navigator)||!/^https?:$/.test(location.protocol)){
   setStatus('Indisponível','Atualização automática requer HTTPS e Service Worker.');return null;
  }
  initialPromise=(async()=>{
   const r=await bounded(navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}),NETWORK_TIMEOUT,'O registro do Service Worker não respondeu.');
   registration=r;bindEvents();
   r.addEventListener('updatefound',()=>watchInstalling(r.installing));
   watchInstalling(r.installing);handleWaiting();return r;
  })().finally(()=>{initialPromise=null;});
  return initialPromise;
 }
 async function latest(){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),NETWORK_TIMEOUT);
  try{
   const res=await fetch('./version.json?fresh='+Date.now(),{cache:'no-store',signal:controller.signal});
   if(!res.ok)throw Error('Não foi possível consultar a versão publicada.');
   const info=await res.json();
   if(typeof info.version!=='string'||info.version.length>128||!parseVersion(info.version))throw Error('Versão remota inválida.');
   return {...info,notes:Array.isArray(info.notes)?info.notes.filter(s=>typeof s==='string').slice(0,5).map(s=>s.slice(0,500)):[]};
  }finally{clearTimeout(timer);}
 }
 async function check(interactive=false){
  if(checking)return checking;
  checking=(async()=>{
   try{
    const r=await bounded(ensureRegistration(),NETWORK_TIMEOUT,'O serviço de atualização não respondeu.');
    if(!r){if(interactive)showToast('Atualização indisponível neste navegador.',true);return false;}
    if(!navigator.onLine){clearPreparation();setStatus('Sem conexão','A Clara continua funcionando offline.');return false;}
    setStatus('Verificando','Consultando a versão publicada…');
    const info=await latest();
    remoteVersion=info.version;
    releaseNotes=info.notes;
    lastCheck=Date.now();
    try{
     await bounded(r.update(),NETWORK_TIMEOUT,'A consulta do Service Worker não respondeu.');
    }catch(e){
     if(!r.waiting&&!(await activatedPackageReady(r)))throw e;
    }
    ready=!!r.waiting;
    reopenReady=!ready&&await activatedPackageReady(r);
    if(ready)handleWaiting();
    else if(reopenReady){
     clearPreparation();
     setStatus('Pronto para reabrir','Nova versão já ativada no navegador. Reabra após proteger o cofre.');
    }else if(newer()){
     watchInstalling(r.installing);
     startPreparation();
    }else{
     clearPreparation();
     setStatus('Atualizado','Você está usando a versão '+INSTALLED_VERSION+'.');
    }
    if(interactive&&!newer()&&!ready)showToast('Clara atualizado. Versão '+INSTALLED_VERSION+'.');
    return ready||reopenReady;
   }catch(error){
    clearPreparation();ready=!!registration?.waiting;
    reopenReady=!ready&&await activatedPackageReady(registration);
    if(ready)handleWaiting();
    else if(reopenReady)setStatus('Pronto para reabrir','O novo pacote já foi ativado. Reabra após salvar o cofre.');
    else if(remoteVersion&&newer()&&registration?.installing&&registration.installing.state!=='redundant')startPreparation();
    else setStatus('Falha ao preparar','Não foi possível concluir: '+(error?.message||'erro de rede')+'. Tente novamente sem apagar dados.');
    if(interactive)showToast(error.message,true);
    return ready||reopenReady;
   }finally{checking=null;paint();}
  })();
  return checking;
 }
 function canInstall(){
  if(!window.ClaraSecurity?.unlocked)throw Error('Desbloqueie o cofre antes de atualizar.');
  const modal=get('modalBg');
  if(modal&&modal.getAttribute('aria-hidden')==='false'){
   showToast('Conclua a edição aberta antes de atualizar.',true);return false;
  }
  return true;
 }
 async function protectAndConfirm(label){
  if(!canInstall())return false;
  if(!window.confirm(label))return false;
  await bounded(window.ClaraSecurity.flush(),NETWORK_TIMEOUT,'O cofre não terminou de salvar.');
  const protection=await bounded(window.ClaraBackups?.beforeUpdate?.(),15000,'O backup pré-atualização não respondeu.');
  if(!protection?.local)throw Error('Não foi possível criar o ponto de proteção pré-atualização.');
  if(!protection.external&&!window.confirm('Foi criado um ponto local cifrado, mas não há cópia externa confirmada. Limpar os dados do navegador pode causar perda. Continuar?'))return false;
  return true;
 }
 async function installReady(r){
  if(installPromise)return installPromise;
  installPromise=(async()=>{
   if(!r?.waiting||applying)return false;
   if(!await protectAndConfirm('Aplicar a atualização '+(remoteVersion||'disponível')+'? A Clara reabrirá sem limpar o cofre.'))return false;
   const worker=r.waiting;
   if(!worker){setStatus('Falha ao preparar','O pacote mudou durante o backup. Verifique novamente.');return false;}
   applying=true;setStatus('Aplicando atualização','Backup concluído. Ativando a versão validada…');
   activationTimer=setTimeout(()=>{
    if(!applying)return;
    applying=false;activationTimer=null;
    setStatus('Falha ao preparar','O navegador não confirmou a ativação. Tente novamente.');
   },PREPARE_TIMEOUT);
   worker.postMessage({type:'SKIP_WAITING'});
   return true;
  })().finally(()=>{installPromise=null;paint();});
  return installPromise;
 }
 async function reopenInstalled(r){
  if(!await activatedPackageReady(r)){
   reopenReady=false;setStatus('Falha ao preparar','Arquivos incompletos. Verifique novamente.');return false;
  }
  if(!await protectAndConfirm('O pacote '+remoteVersion+' já foi ativado. Salvar o cofre e reabrir agora?'))return false;
  r.active?.postMessage({type:'CLARA_RETRY_CANDIDATE'});
  window.ClaraReloadGuard?.allowOfficialUpdate();location.reload();return true;
 }
 async function apply(){
  if(applying)return false;
  if(!canInstall())return false;
  const r=await bounded(ensureRegistration(),NETWORK_TIMEOUT,'Service Worker sem resposta.');
  if(!r)return false;
  if(r.waiting){clearPreparation();return installReady(r);}
  if(reopenReady||await activatedPackageReady(r)){clearPreparation();return reopenInstalled(r);}
  if(!navigator.onLine){setStatus('Sem conexão','Conecte-se para preparar a atualização.');return false;}
  if(r.installing){watchInstalling(r.installing);startPreparation();return false;}
  startPreparation();
  setStatus('Preparando atualização','Nova tentativa solicitada. Não limpe os dados do site.');
  await check(false);
  if(r.waiting){clearPreparation();return installReady(r);}
  if(reopenReady){clearPreparation();return reopenInstalled(r);}
  if(status==='Falha ao preparar'||status==='Sem conexão'||status==='Atualizado'){
   clearPreparation();showToast('Pacote ainda não pronto. Tente novamente.',true);return false;
  }
  return Boolean(r.waiting||reopenReady);
 }
 function dismiss(){
  clearPreparation();
  try{if(remoteVersion)localStorage.setItem(DISMISS_KEY,remoteVersion);}catch{}
  if(get('claraUpdateNotice'))get('claraUpdateNotice').hidden=true;
 }
 async function init(){
  try{await ensureRegistration();await check(false);}
  catch(e){setStatus('Sem confirmação','Não foi possível consultar atualizações agora.');}
 }
 return {init,check,apply,dismiss,paint,compare,
  get installedVersion(){return INSTALLED_VERSION;},
  get ready(){return ready;},get remoteVersion(){return remoteVersion;},
  get status(){return status;},get reopenReady(){return reopenReady;},
  get installProgress(){return installProgress&&{...installProgress};}};
})();
window.ClaraUpdate=ClaraUpdate;

