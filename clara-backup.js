(function setupClaraOfflineBackups(){
 'use strict';
 const DAYS=30, PREFIX='daily-', FOLDER='ClaraFinancas', CHILD='Backups';
 const byId=id=>document.getElementById(id);
 const pad=n=>String(n).padStart(2,'0');
 const stamp=d=>[d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-');
 const unlocked=()=>!!window.ClaraSecurity?.unlocked&&!window.ClaraGuest?.active;
 let current=[],lastStatus='',running=null,nextTimer=null,hasRendered=false,backend='';
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
    if(h.kind==='file'&&/^(?:daily-\d{4}-\d{2}-\d{2}|manual-\d{8}-\d{6})\.clara$/.test(filename))
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
   const stateLabel=pref('autoBackup')?'Ativado · diariamente às 02:00':'Desativado nas configurações';
   const items=current.slice(0,5).map(x=>
    `<div class="cb-entry"><span>${label(x.name)}</span><div class="cb-actions"><button type="button" data-cb-download="${x.name}">Baixar</button><button type="button" data-cb-restore="${x.name}">Restaurar</button><button type="button" data-cb-delete="${x.name}">Excluir</button></div></div>`).join('');
   return `<div class="cb-status"><span>Backup automático <strong>${stateLabel}</strong></span><span>Último: <strong>${newest?label(newest.name):'Nenhum ainda'}</strong></span>
     <span>Próxima verificação: <strong>${pad(next.getHours())}:${pad(next.getMinutes())} ou ao reabrir</strong></span>
     <span>Arquivos locais: <strong>${current.length}</strong> · ${backend||'Armazenamento privado'}</span></div>
     <div class="cb-actions"><button type="button" class="btn primary" data-cb-create>Salvar cópia agora</button>
     <button type="button" class="btn" data-cb-export>Exportar .clara</button></div>
     ${items?`<div class="cb-history">${items}</div>`:'<p class="cb-secondary">Nenhuma cópia local na lista. A exportação é recomendada como backup externo.</p>'}
     <p class="cb-secondary">${status||'A cópia usa o cofre AES-256-GCM. Não substitui o backup externo: limpar dados do site pode apagar as cópias locais.'}</p>`;
  };
  const view=byId('view-painel');
  if(view&&active==='painel'){
   let panel=byId('claraBackupCard');
   if(!panel){
    panel=document.createElement('section');panel.id='claraBackupCard';panel.className='cb-card';
    view.appendChild(panel);
   }
   panel.innerHTML=`<header><div><h3>Backup e proteção</h3><p>Cópias offline da Clara, incluindo os registros, notas e lembretes.</p></div></header>${html(lastStatus)}`;
  }
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
   const name=kind==='daily'?`daily-${d}.clara`:`manual-${d.replaceAll('-','')}-${[now.getHours(),now.getMinutes(),now.getSeconds()].map(pad).join('')}.clara`;
   if(kind==='daily'&&(await useStore('list')).some(x=>x.name===name))return;
   await useStore('put',name,raw);
   await rotate();
   await list();
   say(kind==='daily'?'Backup automático criptografado concluído.':'Cópia local criptografada salva.');
  })();
  try{return await running;}finally{running=null;}
 }
 async function daily(){
  if(!unlocked()||!pref('autoBackup')||!dueToday())return;
  try{await create('daily');}
  catch(e){say('Backup automático não concluído: '+e.message);}
 }
 async function download(name){
  if(!unlocked())throw Error('Desbloqueie seu cofre.');
  const raw=await useStore('get',name);
  if(typeof raw!=='string')throw Error('Arquivo local não encontrado.');
  validateVault(raw);
  dl(name,raw,'application/octet-stream');
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
 const mo=new MutationObserver(()=>{
  if(unlocked()){list().catch(e=>say('Cópias não acessíveis: '+e.message));daily();}
  else{current=[];paint();}
 });
 mo.observe(document.documentElement,{attributes:true,attributeFilter:['data-unlocked']});
 document.addEventListener('click',event=>{
  const button=event.target.closest?.('button[data-cb-create],button[data-cb-export],button[data-cb-download],button[data-cb-restore],button[data-cb-delete]');
  if(!button)return;
  event.preventDefault();event.stopImmediatePropagation();
  const action=Object.keys(button.dataset).find(k=>k.startsWith('cb'));
  Promise.resolve().then(async()=>{
   if(action==='cbCreate')await create('manual');
   else if(action==='cbExport')await window.ClaraSecurity.exportBackup();
   else if(action==='cbDownload')await download(button.dataset.cbDownload);
   else if(action==='cbRestore')await restore(button.dataset.cbRestore);
   else if(action==='cbDelete')await remove(button.dataset.cbDelete);
  }).catch(e=>{say(e.message);showToast(e.message,true);});
 },true);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)daily();});
 window.addEventListener('focus',daily);
 window.setInterval(daily,15*60*1000);
 schedule();
 window.ClaraBackups={get entries(){return current.slice();},get backend(){return backend;},get next(){return nextTwo();},create,list,check:daily,refresh:paint};
 paint();
})();
