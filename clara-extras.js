/* Clara Finanças: miniaplicativos de Lembretes e Bloco de notas (cofre único). */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const escape=esc;
const reminders=()=>Array.isArray(state?.reminders)?state.reminders:[];
const notes=()=>Array.isArray(state?.quickNotes)?state.quickNotes:[];
let query='',openForm=null;
const canWrite=()=>{
 if(window.ClaraGuest?.active){window.ClaraGuest.prompt();return false;}
 if(!window.ClaraSecurity?.unlocked)throw Error('Desbloqueie o cofre para salvar.');
 return true;
};
function change(work,message){
 if(!canWrite())return false;
 const before=structuredClone(state);
 try{work();validateData(state);persistSuccess(message);return true;}
 catch(e){state=before;render();throw e;}
}
const sortedReminders=()=>reminders().slice().sort((a,b)=>Number(a.done)-Number(b.done)||({high:0,normal:1,low:2}[a.priority]-{high:0,normal:1,low:2}[b.priority])||a.dueDate.localeCompare(b.dueDate));
const visibleNotes=()=>notes().filter(n=>(n.title+' '+n.content).toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))
 .sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updatedAt.localeCompare(a.updatedAt));
function reminderMarkup(r){
 return '<article class="clx-item '+(r.done?'clx-done':'')+'"><div><span class="clx-label">'+escape(r.dueDate)+' '+escape(r.time)+'</span>'+
  '<strong>'+escape(r.title)+'</strong><small>'+escape(r.detail||'Lembrete')+' · '+(r.priority==='high'?'Alta prioridade':r.priority==='low'?'Baixa prioridade':'Prioridade normal')+'</small></div>'+
  '<div class="clx-item-actions"><button type="button" data-clx="toggle" data-id="'+escape(r.id)+'">'+(r.done?'Reabrir':'Concluir')+'</button>'+
  '<button type="button" data-clx="edit-reminder" data-id="'+escape(r.id)+'">Editar</button>'+
  '<button type="button" data-clx="delete-reminder" data-id="'+escape(r.id)+'">Excluir</button></div></article>';
}
function noteMarkup(n){
 return '<article class="clx-item"><div><span class="clx-label">'+(n.pinned?'Fixada · ':'')+escape(n.updatedAt.slice(0,10))+'</span>'+
  '<strong>'+escape(n.title)+'</strong><small class="clx-note-content">'+escape(n.content||'Nota sem conteúdo')+'</small></div>'+
  '<div class="clx-item-actions"><button type="button" data-clx="view-note" data-id="'+escape(n.id)+'">Ler</button>'+
  '<button type="button" data-clx="edit-note" data-id="'+escape(n.id)+'">Editar</button>'+
  '<button type="button" data-clx="pin" data-id="'+escape(n.id)+'">'+(n.pinned?'Desafixar':'Fixar')+'</button>'+
  '<button type="button" data-clx="delete-note" data-id="'+escape(n.id)+'">Excluir</button></div></article>';
}
function paint(){
 const view=$('view-painel');
 if(!view||active!=='painel')return;
 let panel=$('claraExtras');
 if(!panel){
  panel=document.createElement('section');panel.id='claraExtras';panel.className='clx-section';
  const calendar=$('claraCalendar');
  if(calendar&&calendar.parentElement===view)calendar.insertAdjacentElement('afterend',panel);
  else view.prepend(panel);
 }
 const rs=sortedReminders(),ns=visibleNotes();
 panel.innerHTML='<div class="clx-header"><div><h3>Meu espaço</h3><p>Lembretes e notas privadas, conectados ao calendário e à Clara.</p></div></div>'+
 '<div class="clx-grid"><section class="clx-card" aria-label="Miniaplicativo Lembretes"><header><div><h4>Lembretes</h4><small>'+
 rs.filter(r=>!r.done).length+' pendente(s), com alertas no sino.</small></div><button type="button" class="clx-add" data-clx="new-reminder">+ Novo</button></header>'+
 '<div id="clxReminderList" class="clx-list">'+(rs.length?rs.slice(0,6).map(reminderMarkup).join(''):'<p class="clx-empty">Nenhum lembrete cadastrado.</p>')+
 '</div></section><section class="clx-card" aria-label="Miniaplicativo Bloco de notas"><header><div><h4>Bloco de notas</h4><small>'+
 notes().length+' nota(s), com pesquisa e fixação.</small></div><button type="button" class="clx-add" data-clx="new-note">+ Nova nota</button></header>'+
 '<input id="clxNoteSearch" class="clx-note-search" type="search" aria-label="Pesquisar notas" placeholder="Pesquisar notas" value="'+escape(query)+'">'+
 '<div id="clxNotesList" class="clx-list">'+(ns.length?ns.slice(0,6).map(noteMarkup).join(''):'<p class="clx-empty">Nenhuma nota encontrada.</p>')+'</div></section></div>';
}
function close(){openForm?.remove();openForm=null;}
function showForm(kind,id='',readonly=false){
 if(!readonly&&!canWrite())return;
 const note=kind==='note',item=(note?notes():reminders()).find(x=>x.id===id);
 const defaultValue=note?{title:'',content:'',pinned:false}:{title:'',detail:'',dueDate:todayISO(),time:'',reminder:'both',priority:'normal',done:false};
 const val=item||defaultValue;
 close();const layer=document.createElement('div');layer.className='clx-modal';layer.id='claraExtrasModal';
 const input=(name,label,type,value,attrs='')=>'<label>'+label+'<input name="'+name+'" type="'+type+'" value="'+escape(value)+'" '+attrs+'></label>';
 const opts=(name,label,items,selected)=>'<label>'+label+'<select name="'+name+'">'+items.map(([key,description])=>'<option value="'+key+'" '+(selected===key?'selected':'')+'>'+description+'</option>').join('')+'</select></label>';
 layer.innerHTML='<section class="clx-dialog" role="dialog" aria-modal="true" aria-labelledby="clxTitle"><h3 id="clxTitle">'+
 (readonly?'Ler nota':id?'Editar '+(note?'nota':'lembrete'):'Novo '+(note?'bloco de notas':'lembrete'))+'</h3>'+
 '<form id="claraExtrasForm" data-kind="'+kind+'" data-id="'+escape(id)+'">'+
 input('title','Título','text',val.title,'required maxlength="120" '+(readonly?'readonly':''))+
 (note?'<label>Conteúdo<textarea name="content" maxlength="6000" rows="8" '+(readonly?'readonly':'')+'>'+escape(val.content)+'</textarea></label>'+
 '<label class="clx-inline"><input type="checkbox" name="pinned" '+(val.pinned?'checked':'')+' '+(readonly?'disabled':'')+'> Fixar nota</label>'
 :'<div class="clx-row">'+input('dueDate','Data','date',val.dueDate,'required')+input('time','Hora opcional','time',val.time)+'</div>'+
 '<div class="clx-row">'+opts('priority','Prioridade',[['low','Baixa'],['normal','Normal'],['high','Alta']],val.priority)+
 opts('reminder','Aviso',[['both','1 dia e 1 hora antes'],['day','1 dia antes'],['hour','1 hora antes'],['none','Somente no dia']],val.reminder)+'</div>'+
 '<label>Descrição<textarea name="detail" rows="3" maxlength="700">'+escape(val.detail)+'</textarea></label>'+
 '<label class="clx-inline"><input type="checkbox" name="done" '+(val.done?'checked':'')+'> Concluído</label>')+
 '<p class="clx-error" id="clxError" role="alert"></p><div class="clx-form-actions">'+
 '<button type="button" data-clx="close">Fechar</button>'+(readonly?'':'<button type="submit" class="primary">Salvar</button>')+
 '</div></form></section>';
 document.body.appendChild(layer);openForm=layer;layer.querySelector('[name="title"]')?.focus();
}
function saveForm(form){
 if(!canWrite())return;
 const values=new FormData(form);
 const get=x=>String(values.get(x)||'');
 const title=get('title').trim(),id=form.dataset.id,kind=form.dataset.kind;
 if(!title||title.length>120)throw Error('Informe um título entre 1 e 120 caracteres.');
 if(kind==='note'){
  const content=get('content'),pinned=form.elements.namedItem('pinned').checked;
  if(content.length>6000)throw Error('Nota muito longa.');
  change(()=>{
   const orig=notes().find(x=>x.id===id);
   const value={id:orig?.id||uid(),title,content,pinned,updatedAt:new Date().toISOString()};
   if(orig)Object.assign(orig,value);
   else{if(notes().length>=500)throw Error('Limite de notas atingido.');state.quickNotes.push(value);}
  },id?'Nota atualizada.':'Nota criada.');
 }else{
  const dueDate=get('dueDate'),time=get('time'),detail=get('detail'),priority=get('priority'),reminder=get('reminder'),done=form.elements.namedItem('done').checked;
  if(!dateValid(dueDate)||(time&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))||
    !['low','normal','high'].includes(priority)||!['none','day','hour','both'].includes(reminder)||detail.length>700)throw Error('Data, hora ou prioridade inválida.');
  change(()=>{
   const orig=reminders().find(x=>x.id===id);
   const value={id:orig?.id||uid(),title,detail,dueDate,time,priority,reminder,done};
   if(orig)Object.assign(orig,value);
   else{if(reminders().length>=1000)throw Error('Limite de lembretes atingido.');state.reminders.push(value);}
  },id?'Lembrete atualizado.':'Lembrete criado.');
 }
 close();paint();
 window.ClaraAgenda?.render();
}
function act(button){
 const name=button.dataset.clx,id=button.dataset.id;
 if(name==='close'){close();return;}
 if(name==='new-reminder'){showForm('reminder');return;}
 if(name==='new-note'){showForm('note');return;}
 if(name==='view-note'){showForm('note',id,true);return;}
 if(name==='edit-reminder'){showForm('reminder',id);return;}
 if(name==='edit-note'){showForm('note',id);return;}
 if(!canWrite())return;
 if(name==='toggle'){
  change(()=>{const r=reminders().find(x=>x.id===id);if(!r)throw Error('Lembrete não encontrado.');r.done=!r.done;},'Lembrete atualizado.');
 }else if(name==='pin'){
  change(()=>{const n=notes().find(x=>x.id===id);if(!n)throw Error('Nota não encontrada.');n.pinned=!n.pinned;n.updatedAt=new Date().toISOString();},'Nota atualizada.');
 }else if(name==='delete-reminder'||name==='delete-note'){
  if(!window.confirm('Excluir definitivamente este item?'))return;
  change(()=>{
   if(name==='delete-reminder')state.reminders=reminders().filter(x=>x.id!==id);
   else state.quickNotes=notes().filter(x=>x.id!==id);
  },'Item excluído.');
 }
 paint();window.ClaraAgenda?.render();
}
document.addEventListener('click',event=>{
 const button=event.target.closest?.('[data-clx]');
 if(!button)return;
 event.preventDefault();event.stopImmediatePropagation();
 try{act(button);}catch(e){showToast(e.message,true);}
},true);
document.addEventListener('submit',event=>{
 if(event.target?.id!=='claraExtrasForm')return;
 event.preventDefault();event.stopImmediatePropagation();
 try{saveForm(event.target);}catch(e){const node=$('clxError');if(node)node.textContent=e.message;}
},true);
document.addEventListener('input',event=>{
 if(event.target?.id!=='clxNoteSearch')return;
 query=event.target.value;
 const list=$('clxNotesList');
 if(list){const found=visibleNotes();list.innerHTML=found.length?found.slice(0,6).map(noteMarkup).join(''):'<p class="clx-empty">Nenhuma nota encontrada.</p>';}
});
const originalRender=render;
render=function(){originalRender();paint();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openForm)close();});
window.ClaraExtras={paint,sortedReminders,visibleNotes,showForm};
paint();
})();
