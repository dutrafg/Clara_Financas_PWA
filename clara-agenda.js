(function setupClaraAgenda(){
'use strict';
let month=todayISO().slice(0,7),selected=todayISO(),bellOpen=false,openedEvent=null;
const $id=id=>document.getElementById(id);
// Traçado vetorial original, inspirado no contorno leve dos símbolos do macOS.
const glyph='<svg class="ca-apple-bell" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18.1 9.25c0-3.54-2.46-6.05-6.1-6.05S5.9 5.71 5.9 9.25v3.7c0 1.25-.55 2.25-1.52 3.15-.44.4-.6.72-.6 1.08 0 .67.52 1.12 1.29 1.12h13.86c.77 0 1.29-.45 1.29-1.12 0-.36-.16-.68-.6-1.08-.97-.9-1.52-1.9-1.52-3.15v-3.7Z"/><path d="M9.65 20.7c.46.7 1.22 1.08 2.35 1.08s1.89-.38 2.35-1.08"/></svg>';
const safe=esc;
const calendarData=()=>Array.isArray(state?.calendarEvents)?state.calendarEvents:[];
const readData=()=>Array.isArray(state?.notificationsRead)?state.notificationsRead:[];
const validTime=t=>t===''||/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t);
const labelDate=date=>date===todayISO()?'Hoje':fmtDay(date);
const today=todayISO;
const minDate=(d,time='09:00')=>new Date(d+'T'+time+':00');
const countdown=(date)=>Math.ceil((new Date(date+'T12:00:00').getTime()-new Date(today()+'T12:00:00').getTime())/86400000);
const weekend=new Intl.DateTimeFormat('pt-BR',{weekday:'long'});
function entries(){
 const data=new Map();
 const add=(entry)=>{
  if(!dateValid(entry.date))return;
  if(!data.has(entry.date))data.set(entry.date,[]);
  data.get(entry.date).push(entry);
 };
 for(const ev of calendarData())add({id:ev.id,date:ev.date,time:ev.time,title:ev.title,kind:'appointment',done:ev.done,notes:ev.notes});
 for(const tx of state.transactions){
  if(tx.status==='Cancelado')continue;
  add({id:tx.id,date:tx.date,time:'',title:tx.description,kind:'tx',done:tx.status==='Realizado',type:tx.kind,amountCents:tx.amountCents});
 }
 for(const goal of state.goals)if(goal.dueDate)add({id:goal.id,date:goal.dueDate,time:'',title:goal.name,kind:'goal',done:goal.savedCents>=goal.targetCents,amountCents:goal.targetCents});
 return data;
}
// Lembretes por hora exigem horário explícito, antes do alerta genérico do dia.
// O relógio pode ser injetado no QA; o cálculo usa datas locais, sem converter para UTC.
function appointmentReminder(ev,instant=new Date()){
 if(ev.done||!dateValid(ev.date))return '';
 const now=new Date(instant);
 const localDay=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
 const diff=Math.round((new Date(ev.date+'T12:00:00')-new Date(localDay+'T12:00:00'))/86400000);
 const hasClock=!!ev.time&&validTime(ev.time);
 const diffMinutes=hasClock?(minDate(ev.date,ev.time)-now)/60000:Infinity;
 if(diff<0||(hasClock&&diffMinutes<0))return 'Compromisso atrasado';
 if(hasClock&&diffMinutes>0&&diffMinutes<=60&&(ev.reminder==='hour'||ev.reminder==='both'))return 'Compromisso em até 1 hora';
 if(diff===0)return 'Compromisso de hoje';
 if(diff===1&&(ev.reminder==='day'||ev.reminder==='both'))return 'Compromisso amanhã';
 return '';
}
const canViewAlerts=()=>Boolean(window.ClaraSecurity?.unlocked||window.ClaraGuest?.active);
function listNotifications(){
 if(!canViewAlerts())return [];
 const now=new Date(),items=[];
 for(const ev of calendarData()){
  const label=appointmentReminder(ev,now);
  if(label)items.push({id:'cal:'+ev.id+':'+label,title:label,detail:ev.title+' · '+labelDate(ev.date)+(ev.time?' às '+ev.time:''),kind:'appointment',ref:ev.id,priority:label==='Compromisso atrasado'?0:1});
 }
 for(const tx of state.transactions){
  if(tx.status!=='Pendente')continue;
  const diff=countdown(tx.date);
  if(diff>3)continue;
  const label=diff<0?'Lançamento vencido':diff===0?'Vence hoje':diff===1?'Vence amanhã':'Vencimento próximo';
  items.push({id:'tx:'+tx.id+':'+tx.date,title:label,detail:tx.description+' · '+labelDate(tx.date)+(tx.kind==='Despesa'?' · '+brl(tx.amountCents):''),kind:'tx',ref:tx.id,priority:diff<0?0:2});
 }
 for(const goal of state.goals){
  if(!goal.dueDate||goal.savedCents>=goal.targetCents)continue;
  const diff=countdown(goal.dueDate);
  if(diff>7)continue;
  items.push({id:'goal:'+goal.id+':'+goal.dueDate,title:diff<0?'Meta atrasada':diff===0?'Meta vence hoje':'Prazo de meta próximo',detail:goal.name+' · '+labelDate(goal.dueDate),kind:'goal',ref:goal.id,priority:diff<0?0:3});
 }
 for(const budget of budgetRows()){
  if(!budget.limitCents||budget.ratio<.75)continue;
  const level=budget.ratio>=1?'limite excedido':'75% do limite';
  items.push({id:'budget:'+state.settings.period+':'+budget.name+':'+level,title:level==='limite excedido'?'Orçamento ultrapassado':'Orçamento próximo do limite',detail:budget.name+' · '+Math.round(budget.ratio*100)+'% utilizado',kind:'budget',ref:budget.name,priority:4});
 }
 const update=window.ClaraUpdate;
 if(update?.remoteVersion&&update.compare(update.remoteVersion,update.installedVersion)>0){
   items.push({id:'update:'+update.remoteVersion,title:update.ready?'Atualização pronta para instalar':'Nova versão da Clara',detail:'Versão '+update.remoteVersion+(update.ready?' disponível para instalar.':' sendo preparada.'),kind:'update',ref:update.remoteVersion,priority:0});
 }
 return items.sort((a,b)=>a.priority-b.priority||a.title.localeCompare(b.title,'pt-BR')).slice(0,70);
}
function markRead(ids){
 const unique=new Set([...readData(),...ids]);
 state.notificationsRead=[...unique].slice(-4000);
 persistSuccess('Notificações atualizadas.');
}
function changeDay(day){if(!dateValid(day))return;selected=day;month=day.slice(0,7);render();}
function dayEntries(data,day){return (data.get(day)||[]).slice().sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99')||a.title.localeCompare(b.title,'pt-BR'));}
function eventItem(ev){
 const what=ev.kind==='appointment'?'Compromisso':ev.kind==='goal'?'Meta':ev.type==='Receita'?'Recebimento':ev.type==='Transferência'?'Transferência':'Conta / lançamento';
 const actions=ev.kind==='appointment'
  ? `<button type="button" data-ca-toggle="${safe(ev.id)}">${ev.done?'Reabrir':'Concluir'}</button><button type="button" data-ca-edit="${safe(ev.id)}">Editar</button>`
  :ev.kind==='goal'
  ? `<button type="button" data-ca-goal="${safe(ev.id)}">Abrir meta</button>`
  : `<button type="button" data-ca-tx="${safe(ev.id)}">Ver lançamento</button>`;
 return `<div class="ca-item ${ev.done?'ca-done':''}"><div><span class="ca-type">${what}${ev.time?' · '+ev.time:''}</span><strong>${safe(ev.title)}</strong>${ev.notes?`<small>${safe(ev.notes)}</small>`:''}${ev.amountCents!=null?`<small>${brl(ev.amountCents)}</small>`:''}</div><div class="ca-item-actions">${actions}</div></div>`;
}
function renderCalendar(){
 if(active!=='painel')return;
 const view=$id('view-painel');if(!view)return;
 let root=$id('claraCalendar');
 if(!root){root=document.createElement('section');root.id='claraCalendar';root.className='ca-calendar';view.prepend(root);}
 let first=new Date(month+'-01T12:00:00'),firstWeek=(first.getDay()+6)%7;
 const days=new Date(first.getFullYear(),first.getMonth()+1,0).getDate(),count=Math.ceil((days+firstWeek)/7)*7;
 const data=entries(),monthName=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(first);
 const dates=Array.from({length:count},(_,i)=>{
  const day=i-firstWeek+1;if(day<1||day>days)return '<span class="ca-empty" aria-hidden="true"></span>';
  const iso=month+'-'+String(day).padStart(2,'0'),entriesOnDay=dayEntries(data,iso),count=entriesOnDay.length;
  return `<button type="button" class="ca-day ${iso===selected?'ca-selected':''} ${iso===today()?'ca-today':''}" data-ca-day="${iso}" aria-pressed="${iso===selected}" aria-label="${day} de ${monthName}, ${count} evento(s)"><span>${day}</span>${count?`<i aria-hidden="true">${count>9?'9+':count}</i>`:''}</button>`;
 });
 const selectedItems=dayEntries(data,selected);
 root.innerHTML=`<div class="ca-top">
 <div><h3>Calendário e agenda</h3><p>Compromissos, contas, parcelas e metas em um só lugar.</p></div>
 <button type="button" class="ca-primary" data-ca-new="${safe(selected)}">+ Compromisso</button></div>
 <div class="ca-header"><button type="button" data-ca-prev aria-label="Mês anterior">‹</button><strong>${safe(monthName)}</strong><button type="button" data-ca-today>Hoje</button><button type="button" data-ca-next aria-label="Próximo mês">›</button></div>
 <div class="ca-grid" role="group" aria-label="Calendário de ${safe(monthName)}">${['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(s=>`<span class="ca-weekday">${s}</span>`).join('')}${dates.join('')}</div>
 <div class="ca-agenda"><div class="ca-agenda-head"><h4>${labelDate(selected)} <span>(${selectedItems.length})</span></h4><button type="button" data-ca-new="${safe(selected)}">Adicionar</button></div>
 ${selectedItems.length?selectedItems.map(eventItem).join(''):'<p class="ca-nothing">Nada previsto para este dia.</p>'}
 </div>`;
}
function renderBell(){
 // Ancorar no body impede que o sino acompanhe a rolagem do cabeçalho.
 const overlayParent=document.body;if(!overlayParent)return;
 let bell=$id('claraNotificationButton');
 if(!bell){
  bell=document.createElement('button');bell.type='button';bell.id='claraNotificationButton';bell.className='ca-bell';
  bell.dataset.caBell='1';bell.setAttribute('aria-label','Abrir notificações');bell.setAttribute('aria-controls','claraNotificationPanel');
  bell.innerHTML=glyph+'<span id="claraNotifBadge" class="ca-badge" hidden>0</span>';
  overlayParent.appendChild(bell);
 }
 let panel=$id('claraNotificationPanel');
 if(!panel){
  panel=document.createElement('section');panel.id='claraNotificationPanel';panel.className='ca-popover';
  panel.setAttribute('aria-label','Central de notificações');panel.setAttribute('role','region');overlayParent.appendChild(panel);
 }
 const notifications=listNotifications(),read=new Set(readData()),unread=notifications.filter(x=>!read.has(x.id));
 const badge=$id('claraNotifBadge');badge.hidden=unread.length===0;badge.textContent=unread.length>99?'99+':String(unread.length);
 bell.setAttribute('aria-expanded',String(bellOpen));
 bell.hidden=!canViewAlerts();
 panel.hidden=!bellOpen||!canViewAlerts();
 if(panel.hidden)return;
 panel.innerHTML=`<div class="ca-popover-head"><strong>Notificações <span>(${unread.length})</span></strong><button type="button" data-ca-close-bell aria-label="Fechar notificações">✕</button></div>
 <div class="ca-popover-items">${notifications.length?notifications.map(n=>`<button type="button" class="ca-notification ${read.has(n.id)?'ca-read':''}" data-ca-alert="${safe(n.id)}"><span class="ca-notification-dot" aria-hidden="true"></span><span><strong>${safe(n.title)}</strong><small>${safe(n.detail)}</small></span></button>`).join(''):'<p class="ca-nothing">Nenhum aviso por enquanto.</p>'}</div>
 <div class="ca-popover-bottom"><button type="button" data-ca-readall ${unread.length?'':'disabled'}>Marcar todas como lidas</button><button type="button" data-ca-openagenda>Ver agenda</button></div>`;
}
function paint(){renderCalendar();renderBell();}
function formOpen(eventId='',date=selected){
 if(!window.ClaraSecurity?.unlocked)return;
 const original=calendarData().find(ev=>ev.id===eventId);
 const event=original||{title:'',date,time:'',notes:'',reminder:'both',done:false};
 openedEvent=original?.id||null;
 const overlay=document.createElement('div');overlay.id='claraAgendaOverlay';overlay.className='ca-overlay';
 overlay.innerHTML=`<section class="ca-dialog" role="dialog" aria-modal="true" aria-labelledby="caDialogTitle">
 <div class="ca-dialog-header"><h3 id="caDialogTitle">${original?'Editar compromisso':'Novo compromisso'}</h3><button type="button" data-ca-close aria-label="Fechar">✕</button></div>
 <form id="claraAgendaForm"><label>Compromisso<input name="title" type="text" required maxlength="120" placeholder="Ex.: Reunião, consulta ou pagamento" value="${safe(event.title)}"></label>
 <div class="ca-row"><label>Data<input name="date" type="date" required value="${safe(event.date)}"></label><label>Hora (opcional)<input name="time" type="time" value="${safe(event.time)}"></label></div>
 <label>Lembrete<select name="reminder"><option value="both" ${event.reminder==='both'?'selected':''}>1 dia e 1 hora antes</option><option value="day" ${event.reminder==='day'?'selected':''}>1 dia antes</option><option value="hour" ${event.reminder==='hour'?'selected':''}>1 hora antes</option><option value="none" ${event.reminder==='none'?'selected':''}>Somente no dia</option></select></label>
 <label>Observações (opcional)<textarea name="notes" rows="2" maxlength="500">${safe(event.notes)}</textarea></label>
 <label class="ca-check"><input name="done" type="checkbox" ${event.done?'checked':''}>Compromisso concluído</label>
 <div id="claraAgendaError" class="ca-error" role="alert"></div>
 <div class="ca-form-actions">${original?'<button type="button" data-ca-delete class="ca-delete">Excluir</button>':''}<button type="button" data-ca-close>Cancelar</button><button type="submit" class="ca-primary">Salvar</button></div></form></section>`;
 document.body.appendChild(overlay);overlay.querySelector('[name="title"]').focus();
}
function closeDialog(){openedEvent=null;$id('claraAgendaOverlay')?.remove();}
function saveEvent(form){
 const val=n=>String(new FormData(form).get(n)||'');
 const title=val('title').trim(),date=val('date'),time=val('time'),notes=val('notes').trim(),reminder=val('reminder'),done=form.elements.namedItem('done').checked;
 if(!title||title.length>120||!dateValid(date)||!validTime(time)||notes.length>500||!['none','day','hour','both'].includes(reminder))throw Error('Verifique o nome, a data, a hora e as observações.');
 const prior=calendarData().find(ev=>ev.id===openedEvent);
 const event={id:prior?.id||uid(),title,date,time,notes,reminder,done};
 if(prior)Object.assign(prior,event);
 else {
  if(calendarData().length>=2000)throw Error('A agenda atingiu o limite de 2.000 compromissos.');
  state.calendarEvents.push(event);
 }
 selected=date;month=date.slice(0,7);
 persistSuccess(prior?'Compromisso atualizado.':'Compromisso adicionado.');
 closeDialog();paint();
}
function deleteEvent(){
 if(!openedEvent)return;
 if(!window.confirm('Excluir este compromisso da agenda?'))return;
 state.calendarEvents=calendarData().filter(x=>x.id!==openedEvent);
 persistSuccess('Compromisso excluído.');
 closeDialog();paint();
}
function alertAction(id){
 const n=listNotifications().find(x=>x.id===id);
 if(!n)return;
 markRead([id]);bellOpen=false;renderBell();
 if(n.kind==='update'){configTab='dados';go('ajustes');return;}
 if(n.kind==='budget'){go('plan');return;}
 if(n.kind==='tx'){modal('editTransaction',n.ref);return;}
 if(n.kind==='goal'){modal('editGoal',n.ref);return;}
 if(n.kind==='appointment'){
  const event=calendarData().find(ev=>ev.id===n.ref);
  if(event){selected=event.date;month=selected.slice(0,7);go('painel');formOpen(event.id);}
 }
}
document.addEventListener('click',e=>{
 const button=e.target.closest?.('button');
 if(!button)return;
 const ds=button.dataset;
 if(!Object.keys(ds).some(k=>k.startsWith('ca')))return;
 e.preventDefault();e.stopImmediatePropagation();
 try{
  if(ds.caBell){bellOpen=!bellOpen;renderBell();}
  else if('caCloseBell' in ds){bellOpen=false;renderBell();}
  else if('caReadall' in ds){markRead(listNotifications().map(n=>n.id));renderBell();}
  else if('caAlert' in ds)alertAction(ds.caAlert);
  else if('caOpenagenda' in ds){bellOpen=false;go('painel');$id('claraCalendar')?.scrollIntoView({behavior:'smooth'});}
  else if('caPrev' in ds){month=plusMonth(month+'-01',-1).slice(0,7);selected=month+'-01';paint();}
  else if('caNext' in ds){month=plusMonth(month+'-01',1).slice(0,7);selected=month+'-01';paint();}
  else if('caToday' in ds){changeDay(today());}
  else if('caDay' in ds){changeDay(ds.caDay);}
  else if('caNew' in ds){formOpen('',ds.caNew);}
  else if('caEdit' in ds){formOpen(ds.caEdit);}
  else if('caToggle' in ds){const ev=calendarData().find(x=>x.id===ds.caToggle);if(ev){ev.done=!ev.done;persistSuccess(ev.done?'Compromisso concluído.':'Compromisso reaberto.');}}
  else if('caTx' in ds){modal('editTransaction',ds.caTx);}
  else if('caGoal' in ds){modal('editGoal',ds.caGoal);}
  else if('caClose' in ds){closeDialog();}
  else if('caDelete' in ds){deleteEvent();}
 }catch(error){showToast(error.message,true);}
},true);
document.addEventListener('submit',e=>{
 if(e.target.id!=='claraAgendaForm')return;
 e.preventDefault();e.stopImmediatePropagation();
 try{saveEvent(e.target);}catch(error){const el=$id('claraAgendaError');if(el)el.textContent=error.message;}
},true);
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&$id('claraAgendaOverlay')){e.preventDefault();closeDialog();}
});
document.addEventListener('click',e=>{
 if(bellOpen&&!e.target.closest?.('#claraNotificationPanel,#claraNotificationButton')){bellOpen=false;renderBell();}
});
const nativeRender=render;
render=function(){nativeRender();paint();};
const observer=new MutationObserver(()=>{if(document.documentElement.dataset.unlocked==='true')paint();else{bellOpen=false;renderBell();closeDialog();}});
observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-unlocked']});
const nativeCheck=window.ClaraUpdate?.check;
if(nativeCheck)window.ClaraUpdate.check=async function(...args){const result=await nativeCheck.apply(this,args);renderBell();return result;};
window.addEventListener('focus',renderBell);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)renderBell();});
window.setInterval(()=>{if(!document.hidden&&window.ClaraSecurity?.unlocked)renderBell();},60000);
window.ClaraAgenda={render:paint,get entries(){return calendarData()},get notifications(){return listNotifications()},reminderFor:appointmentReminder,select:changeDay,open:formOpen};
paint();
})();
