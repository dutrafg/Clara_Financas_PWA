(function setupClaraOfflineBackups(){
 'use strict';
 const DAYS=30, PREFIX='daily-', FOLDER='ClaraFinancas', CHILD='Backups';
 const byId=id=>document.getElementById(id);
 const pad=n=>String(n).padStart(2,'0');
 const stamp=d=>[d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-');
 const unlocked=()=>!!window.ClaraSecurity?.unlocked&&!window.ClaraGuest?.active;
 let current=[],lastStatus='',running=null,nextTimer=null,backend='';
 let selectedFolder=null,folderLoaded=false;
 const externalSupported=()=>typeof window.showDirectoryPicker==='function';
 const folderLabel=()=>selectedFolder?esc(selectedFolder.name):'Nenhuma pasta selecionada';
 async function folderPrefs(method,handle){
  const db=await new Promise((resolve,reject)=>{
   if(!window.indexedDB)return reject(Error('IndexedDB indisponível'));
   const request=indexedDB.open('ClaraFinancasPastaBackup',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('preferences');
   request.onerror=()=>reject(request.error||Error('Não foi possível abrir as preferências'));
   request.onsuccess=()=>resolve(request.result);
  });
  try{return await new Promise((resolve,reject)=>{
   const tx=db.transaction('preferences',method==='get'?'readonly':'readwrite');
   const store=tx.objectStore('preferences');
   let result;
   const request=method==='get'?store.get('external-directory'):store.put(handle,'external-directory');
   request.onsuccess=()=>{result=request.result;};
   tx.oncomplete=()=>resolve(result);
   tx.onerror=()=>reject(tx.error||Error('Não foi possível salvar a pasta'));
   tx.onabort=()=>reject(tx.error||Error('Seleção de pasta cancelada'));
  });}finally{db.close();}
 }
 async function loadFolder(){
  try{const handle=await folderPrefs('get');if(handle?.kind==='directory'&&!selectedFolder)selectedFolder=handle;}catch{}
  folderLoaded=true;paint();
 }
 async function chooseFolder(){
  if(!unlocked())throw Error('Desbloqueie o cofre antes de selecionar uma pasta.');
  if(!externalSupported())throw Error('Este navegador não permite escolher pastas diretamente. Use Exportar pelo navegador e selecione o destino permitido pelo dispositivo.');
  const folder=await window.showDirectoryPicker({id:'clara-financas-backups',mode:'readwrite'});
  if(!folder||folder.kind!=='directory')throw Error('Seleção de pasta não concluída.');
  if(typeof folder.queryPermission==='function'){
   const p=await folder.queryPermission({mode:'readwrite'});
   if(p!=='granted'&&typeof folder.requestPermission==='function'){
    if(await folder.requestPermission({mode:'readwrite'})!=='granted')throw Error('Permissão de gravação na pasta não concedida.');
   }else if(p!=='granted')throw Error('Permissão de gravação na pasta não concedida.');
  }
  selectedFolder=folder;folderLoaded=true;
  try{await folderPrefs('put',folder);say('Pasta escolhida. Todos os backups externos serão criptografados.');}
  catch{say('Pasta selecionada apenas nesta sessão. Selecione-a novamente após reiniciar o navegador.');}
  paint();
  return folder.name;
 }
 async function writeExternal(name,raw){
  if(!selectedFolder)throw Error('Selecione primeiro uma pasta local para backup.');
  if(typeof selectedFolder.queryPermission==='function'&&await selectedFolder.queryPermission({mode:'readwrite'})!=='granted')
   throw Error('Permissão da pasta expirada. Selecione-a novamente.');
  const handle=await selectedFolder.getFileHandle(name,{create:true});
  const writer=await handle.createWritable();
  try{await writer.write(raw);await writer.close();}
  catch(error){try{await writer.abort();}catch{}throw error;}
  if(await (await handle.getFile()).text()!==raw)throw Error('Não foi possível verificar o backup gravado na pasta.');
 }
 function uniqueName(kind,now){
  const date=stamp(now),time=[now.getHours(),now.getMinutes(),now.getSeconds()].map(pad).join('');
  const suffix=Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>n.toString(16).padStart(2,'0')).join('');
  return kind==='daily'?`daily-${date}-${time}-${suffix}.clara`:`manual-${date.replaceAll('-','')}-${time}-${suffix}.clara`;
 }
 function say(message){lastStatus=message;paint();}
 function dueToday(now=new Date()){return now.getHours()>=2;}
 function nextTwo(now=new Date()){
  const at=new Date(now.getFullYear(),now.getMonth(),now.getDate(),2,0,0);
  if(at<=now)at.setDate(at.getDate()+1);
  return at;
 }
 async function opfs(){
  if(!navigator.storage?.getDirectory)throw Error('Pasta privada não disponível');
  const root=await navigator.storage.getDirectory();
  const dir=await root.getDirectoryHandle(FOLDER,{create:true});
  return dir.getDirectoryHandle(CHILD,{create:true});
 }
 function openIDB(){
  return new Promise((resolve,reject)=>{
   if(!window.indexedDB)return reject(Error('IndexedDB indisponível'));
   const request=indexedDB.open('ClaraFinancasBackups',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('snapshots',{keyPath:'name'});
   request.onerror=()=>reject(request.error||Error('Falha de armazenamento'));
   request.onsuccess=()=>resolve(request.result);
  });
 }
 async function idb(method,name,raw){
  const db=await openIDB();
  try{
   return await new Promise((resolve,reject)=>{
    const tx=db.transaction('snapshots',method==='list'||method==='get'?'readonly':'readwrite');
    const store=tx.objectStore('snapshots');
    let result;
    const request=method==='list'?store.getAll():
      method==='get'?store.get(name):
      method==='put'?store.put({name,raw}):store.delete(name);
    request.onsuccess=()=>{result=request.result;};
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(tx.error||Error('Falha no banco local de backups'));
    tx.onabort=()=>reject(tx.error||Error('Transação de backup cancelada'));
   });
  }finally{db.close();}
 }
 async function useStore(method,name='',raw=''){
  try{
   const dir=await opfs();
   backend='OPFS';
   if(method==='put'){
    const h=await dir.getFileHandle(name,{create:true}),writer=await h.createWritable();
    try{await writer.write(raw);await writer.close();}
    catch(e){try{await writer.abort();}catch{}throw e;}
    const saved=await (await h.getFile()).text();
    if(saved!==raw)throw Error('A cópia gravada não foi verificada');
    return;
   }
   if(method==='get'){
    const h=await dir.getFileHandle(name);
    return (await h.getFile()).text();
   }
   if(method==='delete'){await dir.removeEntry(name);return;}
   const rows=[];
   for await(const [filename,h] of dir.entries()){
    if(h.kind==='file'&&/^(?:daily-\d{4}-\d{2}-\d{2}(?:-\d{6}-[a-f0-9]{12})?|manual-\d{8}-\d{6}(?:-[a-f0-9]{12})?)\.clara$/.test(filename))
      rows.push({name:filename});
   }
   return rows;
  }catch(err){
   // Não trocar silenciosamente de backend se um OPFS existente falhar: isso ocultaria um backup.
   if(err.name!=='NotSupportedError'&&!String(err.message).includes('Pasta privada não disponível')&&!String(err.message).includes('getDirectory'))throw err;
   backend='IndexedDB';
   const result=await idb(method,name,raw);
   if(method==='list')return result.map(({name})=>({name}));
   return method==='get'?result?.raw:undefined;
  }
 }
 async function list(){
  if(!unlocked()){current=[];paint();return [];}
  current=(await useStore('list')).sort((a,b)=>b.name.localeCompare(a.name));
  paint();
  return current;
 }
 function label(name){
  const date=name.startsWith(PREFIX)?name.slice(6,16):name.slice(7,15).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
  return (name.startsWith(PREFIX)?'Automático':'Manual')+' · '+date;
 }
 function paint(){
  const html=status=>{
   if(!unlocked())return '<p class="cb-secondary">Crie ou desbloqueie o cofre para armazenar cópias criptografadas.</p>';
   const newest=current.find(x=>x.name.startsWith(PREFIX));
   const next=nextTwo();
   const stateLabel=!pref('autoBackup')?'Desativado nas configurações':!selectedFolder?'Pendente · escolha uma pasta local':'Ativado · diariamente às 02:00, com app aberto';
   const folderStatus=selectedFolder?'Pasta: '+folderLabel():folderLoaded?'Selecione uma pasta de destino':'Carregando destino…';
   const items=current.slice(0,5).map(x=>
    `<div class="cb-entry"><span>${label(x.name)}</span><div class="cb-actions"><button type="button" data-cb-download="${x.name}">Copiar para pasta</button><button type="button" data-cb-restore="${x.name}">Restaurar</button><button type="button" data-cb-delete="${x.name}">Excluir</button></div></div>`).join('');
   return `<div class="cb-status"><span>Backup automático <strong>${stateLabel}</strong></span><span>Último: <strong>${newest?label(newest.name):'Nenhum ainda'}</strong></span>
     <span>Próxima verificação: <strong>${pad(next.getHours())}:${pad(next.getMinutes())} ou ao reabrir</strong></span>
     <span>Arquivos privados: <strong>${current.length}</strong> · ${backend||'Armazenamento privado'}</span>
     <span>Destino externo: <strong>${folderStatus}</strong></span></div>
     <div class="cb-actions"><button type="button" class="btn" data-cb-folder>${selectedFolder?'Trocar pasta local':'Escolher pasta local'}</button>
     <button type="button" class="btn primary" data-cb-create>Salvar backup na pasta</button>
     <button type="button" class="btn" data-cb-export>Exportar pelo navegador</button></div>
     ${items?`<div class="cb-history">${items}</div>`:'<p class="cb-secondary">Nenhuma cópia local na lista. A exportação é recomendada como backup externo.</p>'}
     <p class="cb-secondary">${status||'Todos os dados — inclusive os não financeiros, como perfil, configurações, notas e lembretes — são criptografados com AES-256-GCM. O histórico privado pode desaparecer ao limpar os dados do site. Para salvar externamente, escolha uma pasta e mantenha a permissão de gravação. Em navegadores sem seletor de pastas, use Exportar pelo navegador.'}</p>`;
  };
  const view=byId('view-painel');
  const dashboardCard=byId('claraBackupCard');
  // A Dashboard só orienta a configuração inicial. Depois que a pasta for
  // selecionada, remova o card (inclusive quando a escolha veio de Configurações).
  // Aguarde carregar a escolha persistida para evitar o card piscar na inicialização.
  if(selectedFolder)dashboardCard?.remove();
  else if(view&&active==='painel'&&folderLoaded){
   let panel=dashboardCard;
   if(!panel){
    panel=document.createElement('section');panel.id='claraBackupCard';panel.className='cb-card';
    view.appendChild(panel);
   }
   panel.innerHTML=`<header><div><h3>Backup e proteção</h3><p>Cópias offline da Clara, incluindo os registros, notas e lembretes.</p></div></header>${html(lastStatus)}`;
  }
  // As ações, o histórico e o status seguem sempre disponíveis em Configurações.
  const settings=byId('claraBackupSettings');
  if(settings)settings.innerHTML=html(lastStatus);
 }
 async function rotate(){
  const old=(await useStore('list')).filter(x=>x.name.startsWith(PREFIX)).sort((a,b)=>b.name.localeCompare(a.name)).slice(DAYS);
  for(const x of old)await useStore('delete',x.name);
 }
 async function create(kind='manual'){
  if(!unlocked())throw Error('Desbloqueie o cofre para criar um backup.');
  if(running)return running;
  running=(async()=>{
   await window.ClaraSecurity.flush();
   if(!unlocked())throw Error('Cofre foi bloqueado durante o backup.');
   const raw=readVault();
   validateVault(raw);
   const now=new Date(),d=stamp(now);
   if(kind==='daily'&&(await useStore('list')).some(x=>x.name.startsWith('daily-'+d+'.clara')||x.name.startsWith('daily-'+d+'-')))return;
   if(!selectedFolder)throw Error('Escolha uma pasta local antes de salvar o backup.');
   const name=uniqueName(kind,now);
   await writeExternal(name,raw);
   await useStore('put',name,raw);
   await rotate();
   await list();
   say(kind==='daily'?'Backup automático criptografado salvo na pasta escolhida.':'Backup criptografado salvo na pasta escolhida e no histórico privado.');
  })();
  try{return await running;}finally{running=null;}
 }
 async function daily(){
  if(!unlocked()||!pref('autoBackup')||!dueToday()||!selectedFolder)return;
  try{await create('daily');}
  catch(e){say('Backup automático não concluído: '+e.message);}
 }
 async function download(name){
  if(!unlocked())throw Error('Desbloqueie seu cofre.');
  const raw=await useStore('get',name);
  if(typeof raw!=='string')throw Error('Arquivo local não encontrado.');
  validateVault(raw);
  if(selectedFolder)await writeExternal(name,raw);
  else if(!externalSupported())dl(name,raw,'application/octet-stream');
  else throw Error('Escolha uma pasta local para copiar o backup.');
 }
 async function restore(name){
  if(!unlocked())throw Error('Desbloqueie seu cofre.');
  if(!window.confirm('Restaurar esta cópia substituirá os dados atuais. Confirma?'))return;
  const raw=await useStore('get',name);
  validateVault(raw);
  const password=window.prompt('Informe a senha do cofre utilizada neste backup:');
  if(password===null)return;
  try{
   // Garante uma cópia anterior à restauração, se o cofre ainda estiver íntegro.
   await create('manual');
   await window.ClaraSecurity.restoreLocalEncrypted(raw,password);
   await list();
   say('Backup restaurado. Confira seus registros e exporte uma cópia externa.');
  }finally{ /* não persistir a senha no armazenamento nem no DOM */ }
 }
 async function remove(name){
  if(!unlocked()||!window.confirm('Excluir esta cópia local?'))return;
  await useStore('delete',name);
  await list();
  say('Cópia local excluída.');
 }
 function schedule(){
  if(nextTimer)clearTimeout(nextTimer);
  const wait=Math.max(1000,nextTwo().getTime()-Date.now()+700);
  nextTimer=setTimeout(()=>{daily().finally(schedule);},Math.min(wait,2147483647));
 }
 const nativeRender=render;
 render=function(){nativeRender();paint();};
 // As guias de Configurações também são trocadas sem chamar render():
 // reconstruir o painel de backup sempre que a guia Dados for aberta.
 const nativeSettingsRender=renderAjustes;
 renderAjustes=function(){const result=nativeSettingsRender();paint();return result;};
 const mo=new MutationObserver(()=>{
  if(unlocked()){list().catch(e=>say('Cópias não acessíveis: '+e.message));daily();}
  else{current=[];paint();}
 });
 mo.observe(document.documentElement,{attributes:true,attributeFilter:['data-unlocked']});
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('button[data-cb-create],button[data-cb-folder],button[data-cb-export],button[data-cb-download],button[data-cb-restore],button[data-cb-delete]');
  if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  const action=Object.keys(button.dataset).find(k=>k.startsWith('cb'));
  if(action==='cbFolder'){
   chooseFolder().catch(e=>{say(e.message);showToast(e.message,true);});
   return;
  }
  Promise.resolve().then(async()=>{
   if(action==='cbCreate')await create('manual');
   else if(action==='cbExport'){
    if(externalSupported())await create('manual');
    else await window.ClaraSecurity.exportBackup();
   }
   else if(action==='cbDownload')await download(button.dataset.cbDownload);
   else if(action==='cbRestore')await restore(button.dataset.cbRestore);
   else if(action==='cbDelete')await remove(button.dataset.cbDelete);
  }).catch(e=>{say(e.message);showToast(e.message,true);});
 },true);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)daily();});
 window.addEventListener('focus',daily);
 window.setInterval(daily,15*60*1000);
 schedule();
 window.ClaraBackups={get entries(){return current.slice();},get backend(){return backend;},get next(){return nextTwo();},
  get folder(){return selectedFolder?.name||'';},get folderReady(){return !!selectedFolder;},
  chooseFolder,create,list,check:daily,refresh:paint};
 loadFolder().catch(e=>say(e.message));
 paint();
})();
