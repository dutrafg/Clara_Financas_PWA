/* Status do armazenamento privado. Nenhum registro financeiro é exposto no DOM. */
(() => {
 'use strict';
 const refresh=async()=>{
  const view=document.getElementById('view-ajustes');
  if(!view?.classList.contains('active')||configTab!=='dados')return;
  const container=view.querySelector('.config-content');
  if(!container)return;
  let panel=document.getElementById('claraPrivateFolderPanel');
  if(!panel){
   panel=document.createElement('section');
   panel.id='claraPrivateFolderPanel';
   panel.className='clara-private-folder';
   panel.innerHTML='<div><h3>Armazenamento protegido</h3><p id="claraPrivateFolderStatus" role="status"></p>'
    +'<small>Seus registros ficam criptografados em uma pasta privada criada automaticamente neste navegador.'
    +' A pasta não aparece no gerenciador de arquivos. Limpar os dados do site também apaga essa pasta.</small>'
    +'<p id="claraPrivateFolderPersistence"></p></div>'
    +'<button class="btn" type="button" id="claraPrivateFolderBackup">Salvar backup</button>';
   container.appendChild(panel);
  }
  const info=window.ClaraPrivateFolder;
  document.getElementById('claraPrivateFolderStatus').textContent=info?.active
     ?'Pasta privada pronta · ClaraFinancas · cofre criptografado'
     :info?.warning||'Este navegador está utilizando o cofre criptografado de compatibilidade.';
  const persistence=document.getElementById('claraPrivateFolderPersistence');
  try{
   const granted=await navigator.storage?.persisted?.();
   if(persistence && persistence.isConnected)
    persistence.textContent=granted?'Armazenamento persistente autorizado neste dispositivo.':'Faça backups periódicos: o navegador poderá remover dados locais quando necessário.';
  }catch{if(persistence)persistence.textContent='Faça backups periódicos para evitar perda de dados.';}
 };
 const native=renderAjustes;
 renderAjustes=function(){const result=native();refresh().catch(()=>{});return result;};
 document.addEventListener('click',event=>{
  const btn=event.target.closest?.('#claraPrivateFolderBackup');
  if(!btn)return;
  event.preventDefault();event.stopPropagation();
  window.ClaraSecurity?.exportBackup?.().catch(error=>showToast(error.message,true));
 },true);
 window.ClaraPrivateFolderUI={refresh};
})();