/* Clara 4.1.1 — exploração em memória: sem cofre, persistência ou acesso a dados pessoais. */
(() => {
 'use strict';
 let guest=false;
 const byId=id=>document.getElementById(id);
 const isSafePreview=()=>!readVault()&&!safeStorageGet(KEY)&&!initializationError;
 function sample(){
  const data=fresh(),today=todayISO(),month=today.slice(0,7);
  data.accounts[0].openingCents=275000;
  const category=data.categories.find(c=>c.name==='Alimentação');
  if(category)category.limitCents=75000;
  const transaction=(id,description,kind,amountCents,date,status,category)=>({
    id,description,kind,amountCents,date,status,category,accountId:'principal',
    toAccountId:'',paidAt:status==='Realizado'?date:''
  });
  data.transactions=[
    transaction('demo-income','Recebimento de exemplo','Receita',485000,month+'-05','Realizado','Salário'),
    transaction('demo-market','Supermercado','Despesa',38750,month+'-09','Realizado','Alimentação'),
    transaction('demo-bill','Conta de energia','Despesa',15990,today,'Pendente','Contas fixas'),
    transaction('demo-transport','Combustível','Despesa',16800,month+'-12','Realizado','Transporte'),
    transaction('demo-leisure','Lazer','Despesa',7200,month+'-13','Realizado','Lazer')
  ];
  data.goals=[{id:'demo-goal',name:'Reserva de emergência',savedCents:120000,targetCents:500000,dueDate:plusMonth(today,4)}];
  data.calendarEvents=[{id:'demo-event',title:'Revisar o orçamento',date:today,time:'18:00',notes:'Exemplo ilustrativo',done:false,reminder:'both'}];
  data.reminders=[{id:'demo-reminder',title:'Revisar fatura',detail:'Lembrete fictício',dueDate:today,time:'19:00',priority:'normal',reminder:'both',done:false}];
  data.quickNotes=[{id:'demo-note',title:'Ideias para economizar',content:'Exemplo: separar uma quantia para a reserva mensal.',pinned:true,updatedAt:new Date().toISOString()}];
  data.settings.simpleMode=true;
  validateData(data);
  return data;
 }
 function promptCreate(){
  showToast('Para adicionar ou alterar informações, crie primeiro a senha do cofre.',true);
  byId('claraGuestCreate')?.focus({preventScroll:true});
 }
 function enter(){
  if(!isSafePreview())return;
  guest=true;
  state=sample();active='painel';
  document.documentElement.dataset.guest='true';
  document.documentElement.dataset.unlocked='true';
  byId('securityCover').hidden=true;
  byId('claraGuestNotice').hidden=false;
  render();
 }
 function createVault(){
  if(!guest)return;
  guest=false;
  delete document.documentElement.dataset.guest;
  document.documentElement.removeAttribute('data-unlocked');
  state=fresh();active='painel';
  byId('securityCover').hidden=false;
  byId('claraGuestNotice').hidden=true;
  secureMode(true);
  render();
  byId('securityPassword').focus();
 }
 const safePreviewSelector='[data-view],[data-config-tab],[data-ca-expand],[data-ca-day],[data-ca-prev],[data-ca-next],[data-ca-today],[data-ca-bell],[data-ca-close-bell],[data-ca-openagenda],#checkClaraUpdate';
 const safeWidgetActions=new Set(['simulate','focus','agenda-days','agenda-kind','recent-status','budget-risk','account-cards','compare','editor']);
 window.addEventListener('click',event=>{
  if(!guest)return;
  const b=event.target.closest?.('button,a,[role="button"]');
  if(!b)return;
  if(b.closest('#claraGuestNotice'))return;
  if(b.closest('[data-mode-toggle]')){
   event.preventDefault();event.stopImmediatePropagation();
   state.settings.simpleMode=b.closest('[data-mode-toggle]').dataset.modeToggle==='simple';
   go('painel');return;
  }
  if(b.closest(safePreviewSelector)||b.id==='floatTrigger'||b.id==='floatBackdrop')return;
  if(['view-note','close'].includes(b.dataset.clx))return;
  if(b.dataset.clwAction && safeWidgetActions.has(b.dataset.clwAction))return;
  if(b.matches('a[href^="https://"],a[href^="http://"]'))return;
  event.preventDefault();event.stopImmediatePropagation();promptCreate();
 },true);
 window.addEventListener('submit',event=>{
  if(!guest)return;
  event.preventDefault();event.stopImmediatePropagation();promptCreate();
 },true);
 window.addEventListener('change',event=>{
  if(!guest)return;
  if(['historyMonth','historyAccount','statusFilter','accountFilter','clw-sim-income','clw-sim-expense','clw-sim-months'].includes(event.target.id))return;
  event.preventDefault();event.stopImmediatePropagation();promptCreate();
 },true);
 // Cadastro/edição da agenda passam por delegação própria: são bloqueados como as demais gravações.
 byId('securityGuest')?.addEventListener('click',enter);
 byId('claraGuestCreate')?.addEventListener('click',createVault);
 window.ClaraGuest={get active(){return guest;},enter,createVault,prompt:promptCreate};
})();
