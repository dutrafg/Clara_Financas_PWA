(function initClaraSimple(){
 'use strict';
 const native={painel:renderPainel,mov:renderMov,plan:renderPlan,ajustes:renderAjustes,nav:renderNav};
 const mainNav=[
  ['painel',SVG_ICONS.painel,'Início'],
  ['mov',SVG_ICONS.mov,'Lançar'],
  ['plan',SVG_ICONS.plan,'Planejar'],
  ['mais','<svg class="svg-ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>','Mais']
 ];
 titleMap.mais=['Mais','Só o que você precisa, quando precisar.'];
 const mode=()=>pref('simpleMode')!==false;
 const opts=(label, attrs, kind='')=>`<button type="button" class="clara-simple-action ${kind}" ${attrs}>${label}</button>`;
 const quick=()=>`<div class="clara-simple-actions" aria-label="Novo registro">
  ${opts('<span aria-hidden="true">−</span> Despesa','data-clw-action="new" data-clw-kind="Despesa"','primary')}
  ${opts('<span aria-hidden="true">+</span> Receita','data-clw-action="new" data-clw-kind="Receita"')}
  ${opts('<span aria-hidden="true">⇄</span> Transferir','data-clw-action="new" data-clw-kind="Transferência"')}
 </div>`;
 const monthName=p=>new Date(p+'-01T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
 const monthNav=p=>`<nav class="clara-month-nav" aria-label="Escolher mês financeiro">
   <button type="button" data-simple-month-dir="-1" aria-label="Mês anterior">‹</button>
   <span aria-live="polite">${esc(monthName(p))}</span>
   <button type="button" data-simple-month-dir="1" aria-label="Próximo mês">›</button>
  </nav>`;
 let txFilter='Todas',txSearch='';

 // Lista compacta com expansão nativa, sem alterar persistência ou objetos financeiros.
 const compactList=(items,max,renderRow,empty)=>{
  if(!items.length)return '<p class="clara-compact-empty">'+esc(empty)+'</p>';
  const visible=items.slice(0,max).map(renderRow).join('');
  const hidden=items.length>max?
    '<details class="clara-compact-more"><summary>Ver mais ('+(items.length-max)+')</summary>'+
    items.slice(max).map(renderRow).join('')+'</details>':'';
  return visible+hidden;
 };
 const accountRow=a=>`<div class="clara-compact-row">
   <span class="clara-compact-mark" aria-hidden="true">${a.type==='Reserva'?'◈':'▣'}</span>
   <span class="clara-compact-label"><strong>${esc(a.name)}</strong><small>${esc(a.type)}</small></span>
   <b class="clara-compact-value">${brl(accountBalance(a.id,state.settings.cutoff))}</b>
  </div>`;
 const cardRow=a=>`<div class="clara-compact-row">
   <span class="clara-compact-mark" aria-hidden="true">▤</span>
   <span class="clara-compact-label"><strong>${esc(a.name)}</strong><small>Despesas pendentes</small></span>
   <b class="clara-compact-value">${brl(accountPendingCard(a.id))}</b>
  </div>`;
 const compactProgress=(value,label)=>`<div class="clara-compact-progress" role="progressbar"
  aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(value)}">
  <span style="width:${value}%"></span></div>`;
 const goalRow=g=>{
  const value=g.targetCents>0?Math.min(100,Math.max(0,100*g.savedCents/g.targetCents)):0;
  return `<div class="clara-compact-goal"><div class="clara-compact-line">
   <span class="clara-compact-label"><strong>${esc(g.name)}</strong><small>${brl(g.savedCents)} de ${brl(g.targetCents)}</small></span>
   <button type="button" class="clara-quiet" data-goal-edit="${esc(g.id)}">Atualizar</button>
   </div>${compactProgress(value,'Progresso da meta '+g.name)}</div>`;
 };
 const budgetRow=r=>{
  const value=r.limitCents>0?Math.min(100,Math.max(0,100*r.planned/r.limitCents)):0;
  const over=r.planned>r.limitCents;
  return `<div class="clara-compact-goal ${over?'clara-budget-over':''}">
   <div class="clara-compact-line">
    <span class="clara-compact-label"><strong>${esc(r.name)}</strong><small>Previsto: ${brl(r.planned)} de ${brl(r.limitCents)}</small></span>
    <span class="clara-compact-percent">${over?'Acima do limite':Math.round(value)+'%'}</span>
   </div>${compactProgress(value,'Uso do limite '+r.name)}</div>`;
 };
 const compactPanel=(title,action,body,extra='')=>`<section class="clara-simple-card clara-compact-panel">
    <header><h3>${title}</h3>${action}</header>${body}${extra}
   </section>`;
 function moneyPanels(p){
  const accounts=state.accounts.filter(a=>a.type!=='Cartão');
  const cards=state.accounts.filter(a=>a.type==='Cartão');
  const budgets=budgetRows(p).filter(r=>r.limitCents>0).sort((a,b)=>b.ratio-a.ratio);
  return `<div class="clara-money-panel-grid" aria-label="Contas, cartões, metas e limites">
   ${compactPanel('Contas','<button class="clara-quiet" type="button" data-config-jump="contas">Gerenciar</button>',
     compactList(accounts,2,accountRow,'Adicione uma conta para acompanhar os saldos.'),
     '<button type="button" class="clara-compact-action" data-open="account">+ Nova conta</button>')}
   ${compactPanel('Cartões','<button class="clara-quiet" type="button" data-config-jump="contas">Gerenciar</button>',
     compactList(cards,2,cardRow,'Nenhum cartão cadastrado.'),
     '<button type="button" class="clara-compact-action" data-simple-new-card>+ Adicionar cartão</button>')}
   ${compactPanel('Metas','<button type="button" class="clara-quiet" data-view="plan">Ver todas</button>',
     compactList(state.goals,2,goalRow,'Crie um objetivo para seu dinheiro.'),
     '<button type="button" class="clara-compact-action" data-open="goal">+ Criar meta</button>')}
   ${compactPanel('Limites','<button type="button" class="clara-quiet" data-view="plan">Ver todos</button>',
     compactList(budgets,2,budgetRow,'Nenhum limite definido.'),
     '<button type="button" class="clara-compact-action" data-config-jump="contas">+ Definir limites</button>')}
   </div>`;
 }

 const listLine=t=>`<div class="clara-simple-line">
   <div class="clara-simple-line-title"><strong>${esc(t.description)}</strong><small>${fmtDay(t.date)} · ${esc(t.category||t.kind)}</small></div>
   <div class="clara-simple-line-value"><b>${t.kind==='Despesa'?'− ':t.kind==='Receita'?'+ ':''}${brl(t.amountCents)}</b><button type="button" class="clara-quiet" data-edit-tx="${esc(t.id)}">Editar</button></div>
  </div>`;
 function home(){
  const today=todayISO(),p=state.settings.period,stats=stat(p),balance=totalBalance(state.settings.cutoff);
  const due=state.transactions.filter(t=>t.status==='Pendente'&&t.kind==='Despesa'&&t.date<=addDays(today,14)).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
  const recent=state.transactions.slice().sort((a,b)=>effective(b).localeCompare(effective(a))).slice(0,4);
  const spend=budgetRows(p).filter(r=>r.done>0).sort((a,b)=>b.done-a.done);
  const insight=spend.length?`Neste mês, sua maior despesa foi em ${spend[0].name}.`:'Registre uma despesa para descobrir onde seu dinheiro está indo.';
  $('view-painel').innerHTML=`<section class="clara-simple-home" aria-label="Seu dinheiro">
   <div class="clara-clean-heading"><span>Visão geral</span><span>Seu dinheiro, sem complicação</span></div>
   <div class="clara-balance"><div class="clara-balance-head"><span>Saldo atual</span><button type="button" class="clara-quiet" data-simple-hide>${pref('hideValues')?'Mostrar':'Ocultar'}</button></div>
    <strong>${brl(balance)}</strong><p>Saldo das suas contas até ${fmtDay(state.settings.cutoff)}</p></div>
   <div class="clara-simple-stats" aria-label="Resumo financeiro do mês"><article><span>Receitas</span><strong class="positive">${brl(stats.income)}</strong></article>
      <article><span>Despesas pagas</span><strong>${brl(stats.expense)}</strong></article>
      <article class="clara-clean-pending"><span>A pagar no mês</span><strong>${brl(stats.toPay)}</strong></article></div>
   ${monthNav(p)}
   ${quick()}
   ${state.transactions.length===0?`<section class="clara-welcome"><h3>Vamos começar?</h3><p>Registre uma entrada ou despesa para acompanhar seu dinheiro de forma simples.</p>
     <button type="button" class="btn primary" data-clw-action="new" data-clw-kind="Receita">Registrar primeira entrada</button></section>`:''}
   ${moneyPanels(p)}
   <section class="clara-simple-card"><header><h3>Próximos vencimentos</h3><button class="clara-quiet" data-view="mov" type="button">Ver tudo</button></header>
     ${due.length?due.map(t=>`<div class="clara-simple-line"><div class="clara-simple-line-title"><strong>${esc(t.description)}</strong><small>${t.date<today?'Venceu · ':''}${fmtDay(t.date)}</small></div><div class="clara-simple-line-value"><b>${brl(t.amountCents)}</b><button class="clara-quiet" type="button" data-toggle="${esc(t.id)}">Pagar</button></div></div>`).join(''):'<p class="clara-muted">Nenhuma conta próxima do vencimento.</p>'}
   </section>
   <section class="clara-simple-card"><header><h3>Movimentações recentes</h3><button class="clara-quiet" type="button" data-view="mov">Ver tudo</button></header>
    ${recent.length?recent.map(listLine).join(''):'<p class="clara-muted">Seus registros aparecerão aqui.</p>'}
   </section>
   ${spend.length?`<section class="clara-simple-card clara-simple-tip"><small>Seu resumo</small><p>${esc(insight)}</p><button type="button" class="clara-quiet" data-view="plan">Ver planejamento</button></section>`:''}
  </section>`;
 }
 function txResults(){
  const p=state.settings.period;
  const all=state.transactions.filter(t=>inMonth(t,p));
  const items=all.filter(t=>{
   if(txFilter==='Receitas'&&t.kind!=='Receita')return false;
   if(txFilter==='Despesas'&&t.kind!=='Despesa')return false;
   if(txFilter==='Transferências'&&t.kind!=='Transferência')return false;
   if(txFilter==='Pendentes'&&t.status!=='Pendente')return false;
   const query=txSearch.trim().toLocaleLowerCase('pt-BR');
   return !query||[t.description,t.category,t.kind].some(x=>String(x||'').toLocaleLowerCase('pt-BR').includes(query));
  }).sort((a,b)=>effective(b).localeCompare(effective(a))||b.date.localeCompare(a.date));
  if(items.length)return items.slice(0,80).map(listLine).join('');
  const empty=all.length===0&&txFilter==='Todas'&&!txSearch.trim();
  return `<div class="clara-simple-empty">
    <span class="clara-simple-empty-icon" aria-hidden="true">${SVG_ICONS.mov}</span>
    <strong>${empty?'Nenhuma transação neste mês':'Nada encontrado'}</strong>
    <p>${empty?'Registre sua primeira movimentação para acompanhar seu dinheiro.':'Nenhum lançamento corresponde aos filtros selecionados.'}</p>
    <button type="button" class="clara-simple-empty-action" ${empty?'data-clw-action="new" data-clw-kind="Despesa"':'data-simple-clear-filters'}>${empty?'Criar uma transação':'Limpar filtros e busca'}</button>
  </div>`;
 }
 function lancar(){
  const p=state.settings.period,stats=stat(p),periodTotal=stats.income-stats.expense;
  const filters=['Todas','Receitas','Despesas','Transferências','Pendentes'];
  $('view-mov').innerHTML=`<section class="clara-simple-home clara-simple-transactions">
    <div class="clara-simple-intro"><h3>Transações</h3><p>Veja o que entrou, saiu e ainda falta pagar.</p></div>
    <div class="clara-tx-summary" aria-label="Resumo mensal de lançamentos">
      <div><span>Receitas</span><strong class="positive">${brl(stats.income)}</strong></div>
      <div><span>Despesas</span><strong class="negative">${brl(stats.expense)}</strong></div>
      <div><span>Balanço</span><strong>${brl(periodTotal)}</strong></div>
    </div>
    ${monthNav(p)}
    ${quick()}
    <div class="clara-tx-filterbar" role="group" aria-label="Filtrar transações">
      ${filters.map(f=>`<button type="button" data-simple-filter="${f}" aria-pressed="${txFilter===f}" class="${txFilter===f?'active':''}">${f}</button>`).join('')}
    </div>
    <label class="clara-tx-search"><span class="clara-sr-only">Buscar transações por descrição, categoria ou tipo</span>
      <input id="claraSimpleTxSearch" type="search" autocomplete="off" placeholder="Buscar movimentações" value="${esc(txSearch)}"></label>
    <section class="clara-simple-card clara-simple-tx-results" aria-label="Movimentações filtradas">
      <div class="clara-simple-tx-items">${txResults()}</div>
    </section>
    <button type="button" class="clara-quiet" data-mode-toggle="advanced">Filtros e relatórios avançados</button>
  </section>`;
 }
 function planejar(){
  const p=state.settings.period;
  const budgets=budgetRows(p).filter(r=>r.limitCents>0).sort((a,b)=>b.ratio-a.ratio);
  $('view-plan').innerHTML=`<section class="clara-simple-home clara-simple-planning">
   <div class="clara-simple-intro"><h3>Planejamento</h3><p>Metas e limites em um só lugar.</p></div>
   ${monthNav(p)}
   <div class="clara-money-panel-grid">
     ${compactPanel('Limites do mês','<button type="button" class="clara-quiet" data-config-jump="contas">Editar limites</button>',
        compactList(budgets,3,budgetRow,'Nenhum limite definido.'),
        '<button type="button" class="clara-compact-action" data-config-jump="contas">+ Ajustar orçamento</button>')}
     ${compactPanel('Minhas metas','<button type="button" class="clara-quiet" data-open="goal">Criar meta</button>',
        compactList(state.goals,3,goalRow,'Que tal começar uma reserva de emergência?'))}
   </div>
   <section class="clara-simple-card clara-compact-panel">
    <header><h3>Contas recorrentes</h3><button type="button" class="clara-quiet" data-view="mov">Ver transações</button></header>
    <p class="clara-muted">Parcelas e despesas fixas ficam junto dos seus lançamentos.</p>
   </section>
  </section>`;
 }
 function mais(){
  const items=[
    ['Contas e cartões','Gerencie saldos e cartões','data-config-jump="contas"'],
    ['Histórico','Veja meses anteriores','data-view="historico"'],
    ['Relatórios','Exporte ou imprima','data-view="conf"'],
    ['Parcelamentos','Organize suas compras parceladas','data-view="assist"'],
    ['Meu perfil','Seu nome e foto','data-open="profile"'],
    ['Aparência','Modo claro ou escuro','data-config-jump="aparencia"'],
    ['Segurança e backup','Proteja seus dados e atualize','data-config-jump="dados"']
  ];
  $('view-mais').innerHTML=`<section class="clara-simple-home"><div class="clara-simple-intro"><h3>Tudo em um lugar</h3><p>Abra apenas o que precisar.</p></div>
    <div class="clara-more-list">${items.map(([name,sub,attrs])=>`<button type="button" class="clara-more-item" ${attrs}><span><strong>${name}</strong><small>${sub}</small></span><span aria-hidden="true">›</span></button>`).join('')}</div>
    <section class="clara-simple-card"><h3>${mode()?'Precisa de mais ferramentas?':'Quer deixar tudo mais simples?'}</h3>
     <p class="clara-muted">${mode()?'O modo avançado revela seus 15 miniaplicativos e ajustes, sem apagar nada.':'O modo simples mostra só o essencial. Suas funcionalidades continuam disponíveis.'}</p>
     <button type="button" class="btn" data-mode-toggle="${mode()?'advanced':'simple'}">${mode()?'Ativar modo avançado':'Voltar ao modo simples'}</button></section>
   </section>`;
 }
 renderPainel=function(){return mode()?home():native.painel();};
 renderMov=function(){return mode()?lancar():native.mov();};
 renderPlan=function(){return mode()?planejar():native.plan();};
 renderAjustes=function(){
   native.ajustes();
   if(!mode())return;
   document.querySelectorAll('#view-ajustes [data-config-tab]').forEach(el=>{
      if(!['aparencia','dados','contas'].includes(el.dataset.configTab))el.hidden=true;
   });
   if(configTab==='aparencia'){
      const el=document.querySelector('#view-ajustes .config-content');
      if(el)el.innerHTML=`<section class="clara-simple-card"><h3>Visual do aplicativo</h3><p class="clara-muted">Escolha o que for mais confortável.</p><label class="field"><span>Tema</span><select id="themeSelect">
       <option value="light" ${state.settings.theme==='light'?'selected':''}>Claro</option><option value="dark" ${state.settings.theme==='dark'?'selected':''}>Escuro</option></select></label>
       <p class="clara-muted">As opções detalhadas continuam disponíveis no modo avançado.</p></section>`;
   }
 };
 // A pílula em tablet/desktop concentra todos os módulos, sem painel lateral.
 const dockModules=[
  ...NAV.map(([id,icon,label])=>[id,icon,label]),
  ['mais',mainNav.find(([id])=>id==='mais')[1],'Mais']
 ];
 const dockWrap=document.querySelector('.mobile-dock-wrap');
 const desktopDock=document.createElement('nav');
 desktopDock.id='claraDesktopDock';
 desktopDock.className='clara-desktop-dock';
 desktopDock.setAttribute('aria-label','Todos os módulos da Clara');
 desktopDock.innerHTML=dockModules.map(([id,icon,label])=>
  `<button type="button" class="clara-desktop-link" data-view="${id}" title="${label}" aria-label="${label}">
    <span class="ico">${icon}</span><span>${label}</span></button>`).join('');
 dockWrap?.insertBefore(desktopDock,dockWrap.firstChild);
 renderNav=function(){
   native.nav();
   const current=['painel','mov','plan'].includes(active)?active:'mais';
   desktopDock.querySelectorAll('[data-view]').forEach(btn=>{
     const selected=btn.dataset.view===active;
     btn.classList.toggle('active',selected);
     if(selected)btn.setAttribute('aria-current','page');
     else btn.removeAttribute('aria-current');
   });
   const f=$('floatTrigger');
   if(f){f.classList.toggle('active',current==='mais');if(mode()){f.setAttribute('aria-label','Mais opções');f.setAttribute('aria-expanded','false');}}
 };
 // Personaliza a apresentação do formulário original sem alterar o motor de
 // validação, contas, centavos, status ou salvamento criptografado.
 const nativeModal=modal;
 const entryTitles={Receita:'receita',Despesa:'despesa',Transferência:'transferência'};
 function syncEntrySheet(){
  const host=$('modalBg'),kind=$('m_kind')?.value;
  if(!host||!kind)return;
  host.dataset.claraKind=kind;
  $('modalTitle').textContent=(host.dataset.kind==='editTransaction'?'Editar ':'Nova ')+(entryTitles[kind]||'transação');
 }
 modal=function(kind,itemId=''){
  nativeModal(kind,itemId);
  const host=$('modalBg');
  if(!mode()||!['transaction','editTransaction'].includes(kind)){
   delete host.dataset.claraKind;
   return;
  }
  syncEntrySheet();
  // A ação rápida define o tipo depois de abrir o modal; atualizar a
  // aparência na mesma microtarefa, antes do navegador desenhar a tela.
  queueMicrotask(syncEntrySheet);
  const date=$('m_date');
  date?.closest('.field')?.insertAdjacentHTML('beforeend',
    '<div class="clara-entry-date-chips" role="group" aria-label="Datas rápidas"><button type="button" data-simple-date="today">Hoje</button><button type="button" data-simple-date="yesterday">Ontem</button></div>');
  const description=$('m_description');
  if(description){
   description.removeAttribute('required');
   description.closest('label')?.querySelector('span')?.replaceChildren(document.createTextNode('Descrição (opcional)'));
   description.placeholder='Ex.: Supermercado, salário ou transferência';
  }
  const submit=$('modalForm')?.querySelector('button[type="submit"]');
  if(submit)submit.textContent=kind==='editTransaction'?'Salvar alterações':'Adicionar transação';
 };
 document.addEventListener('change',e=>{
  if(mode()&&e.target?.id==='m_kind'&&['transaction','editTransaction'].includes($('modalBg')?.dataset.kind))
   syncEntrySheet();
 });
 // O formulário aceita descrição vazia no modo simples, mas o registro continua
 // recebendo uma descrição informativa e válida para relatórios e auditoria.
 document.addEventListener('submit',e=>{
  if(!mode()||e.target?.id!=='modalForm'||!['transaction','editTransaction'].includes($('modalBg')?.dataset.kind))return;
  const desc=$('m_description');
  if(desc&&!desc.value.trim()){
   const kind=$('m_kind')?.value;
   desc.value=kind==='Transferência'?'Transferência':$('m_category')?.value||kind||'Movimentação';
  }
 },true);
 document.addEventListener('input',e=>{
  if(!mode()||e.target?.id!=='claraSimpleTxSearch')return;
  txSearch=e.target.value;
  const result=$('view-mov')?.querySelector('.clara-simple-tx-items');
  if(result)result.innerHTML=txResults();
 });
 document.addEventListener('click',e=>{
    if(mode()){
     const newCard=e.target.closest?.('[data-simple-new-card]');
     if(newCard){
      e.preventDefault();e.stopPropagation();
      modal('account');
      const type=$('m_type');
      if(type)type.value='Cartão';
      return;
     }
     const m=e.target.closest?.('[data-simple-month-dir]');
     if(m){
      e.preventDefault();e.stopPropagation();
      const dir=Number(m.dataset.simpleMonthDir);
      if(dir===-1||dir===1){
       state.settings.period=plusMonth(state.settings.period+'-01',dir).slice(0,7);
       render();
      }
      return;
     }
     const filter=e.target.closest?.('[data-simple-filter]');
     if(filter){
      e.preventDefault();e.stopPropagation();
      txFilter=filter.dataset.simpleFilter;
      lancar();
      return;
     }
     const clear=e.target.closest?.('[data-simple-clear-filters]');
     if(clear){e.preventDefault();e.stopPropagation();txFilter='Todas';txSearch='';lancar();return;}
     const chip=e.target.closest?.('[data-simple-date]');
     if(chip){
      e.preventDefault();e.stopPropagation();
      const input=$('m_date'),paid=$('m_paidAt');
      if(input){
       const before=input.value;
       const value=chip.dataset.simpleDate==='yesterday'?addDays(todayISO(),-1):todayISO();
       input.value=value;
       if(paid&&(!paid.value||paid.value===before))paid.value=value;
       input.dispatchEvent(new Event('change',{bubbles:true}));
      }
      return;
     }
    }
    const f=e.target.closest?.('#floatTrigger');
    if(f&&mode()){e.preventDefault();e.stopPropagation();go('mais');return;}
    const hide=e.target.closest?.('[data-simple-hide]');
    if(hide){e.preventDefault();e.stopPropagation();try{state.settings.hideValues=!pref('hideValues');persistSuccess('Preferência de privacidade atualizada.');}catch(x){showToast(x.message,true);}return;}
    const toggle=e.target.closest?.('[data-mode-toggle]');
    if(toggle){e.preventDefault();e.stopPropagation();const next=toggle.dataset.modeToggle==='simple';try{state.settings.simpleMode=next;claraDashboardEditing=false;persistSuccess(next?'Modo simples ativado.':'Ferramentas avançadas disponíveis.');go('painel');}catch(x){showToast(x.message,true);}return;}
 },true);
 window.ClaraSimple={renderMais:mais,get enabled(){return mode();},mainNav:mainNav.map(x=>x[0])};
 document.documentElement.dataset.simple=String(mode());
 const nativeRender=render;
 // A volta para o modo simples deve ser descoberta sem abrir menus.
 const exitAdvanced=document.createElement('button');
 exitAdvanced.id='claraExitAdvanced';
 exitAdvanced.type='button';
 exitAdvanced.className='clara-exit-advanced';
 exitAdvanced.dataset.modeToggle='simple';
 exitAdvanced.setAttribute('aria-label','Sair do modo avançado e voltar ao início');
 exitAdvanced.textContent='← Voltar ao modo simples';
 document.querySelector('.topbar')?.appendChild(exitAdvanced);
 render=function(){document.documentElement.dataset.simple=String(mode());nativeRender();exitAdvanced.hidden=mode();};
 // A inicialização do cofre pode já ter ocorrido; renderizar só depois do desbloqueio.
 // O cofre chama render() antes de marcar data-unlocked na primeira abertura.
 const observer=new MutationObserver(()=>{
   if(document.documentElement.dataset.unlocked==='true'){
     render();
   }
 });
 observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-unlocked']});
 if(document.documentElement.dataset.unlocked==='true')render();
})();
