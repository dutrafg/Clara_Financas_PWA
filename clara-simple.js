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
   <div class="clara-balance"><div class="clara-balance-head"><span>Seu saldo hoje</span><button type="button" class="clara-quiet" data-simple-hide>${pref('hideValues')?'Mostrar':'Ocultar'}</button></div>
    <strong>${brl(balance)}</strong><p>Saldo das suas contas até ${fmtDay(state.settings.cutoff)}</p></div>
   ${quick()}
   ${state.transactions.length===0?`<section class="clara-welcome"><h3>Vamos começar?</h3><p>Você não precisa configurar tudo. Registre uma entrada ou despesa e acompanhe seu dinheiro com facilidade.</p>
     <button type="button" class="btn primary" data-clw-action="new" data-clw-kind="Receita">Registrar primeira entrada</button></section>`:''}
   <div class="clara-simple-stats"><article><span>Entrou no mês</span><strong class="positive">${brl(stats.income)}</strong></article>
      <article><span>Saiu no mês</span><strong>${brl(stats.expense)}</strong></article></div>
   <section class="clara-simple-card"><header><h3>Contas próximas</h3><button class="clara-quiet" data-view="mov" type="button">Ver tudo</button></header>
     ${due.length?due.map(t=>`<div class="clara-simple-line"><div class="clara-simple-line-title"><strong>${esc(t.description)}</strong><small>${t.date<today?'Venceu · ':''}${fmtDay(t.date)}</small></div><div class="clara-simple-line-value"><b>${brl(t.amountCents)}</b><button class="clara-quiet" type="button" data-toggle="${esc(t.id)}">Pagar</button></div></div>`).join(''):'<p class="clara-muted">Nenhuma conta próxima do vencimento.</p>'}
   </section>
   <section class="clara-simple-card"><header><h3>Últimos registros</h3><button class="clara-quiet" type="button" data-view="mov">Ver tudo</button></header>
    ${recent.length?recent.map(listLine).join(''):'<p class="clara-muted">Seus registros aparecerão aqui.</p>'}
   </section>
   <section class="clara-simple-card clara-simple-tip"><small>Uma dica para você</small><p>${esc(insight)}</p><button type="button" class="clara-quiet" data-view="plan">Ver planejamento</button></section>
  </section>`;
 }
 function lancar(){
  const recent=state.transactions.filter(t=>inMonth(t,state.settings.period)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12);
  $('view-mov').innerHTML=`<section class="clara-simple-home">
   <div class="clara-simple-intro"><h3>O que vamos registrar?</h3><p>Escolha uma opção. Você só precisa informar o valor e o motivo.</p></div>
   ${quick()}
   <section class="clara-simple-card"><header><h3>Este mês</h3><button class="clara-quiet" data-view="historico" type="button">Outros meses</button></header>
     ${recent.length?recent.map(listLine).join(''):'<p class="clara-muted">Ainda não há lançamentos neste mês.</p>'}</section>
   <button type="button" class="clara-quiet" data-mode-toggle="advanced">Ver filtros e controles avançados</button>
  </section>`;
 }
 function planejar(){
  const budgets=budgetRows().filter(r=>r.limitCents>0);
  $('view-plan').innerHTML=`<section class="clara-simple-home">
   <section class="clara-simple-card"><header><h3>Meu orçamento</h3><button type="button" class="clara-quiet" data-config-jump="contas">Ajustar limites</button></header>
    <p class="clara-muted">Defina quanto pode gastar em cada categoria.</p>
    ${budgets.length?budgets.slice(0,7).map(r=>`<div class="clara-simple-budget"><div><strong>${esc(r.name)}</strong><small>${brl(r.planned)} de ${brl(r.limitCents)}</small></div><div class="clara-simple-track"><span style="width:${Math.min(100,r.ratio*100)}%;background:${r.ratio>=1?'var(--red)':'var(--teal)'}"></span></div></div>`).join(''):'<p class="clara-muted">Nenhum limite definido. Comece com alimentação e moradia.</p>'}
   </section>
   <section class="clara-simple-card"><header><h3>Minhas metas</h3><button type="button" class="clara-quiet" data-open="goal">Criar meta</button></header>
    ${state.goals.length?state.goals.map(g=>`<div class="clara-simple-line"><div class="clara-simple-line-title"><strong>${esc(g.name)}</strong><small>${brl(g.savedCents)} de ${brl(g.targetCents)}</small></div><button type="button" class="clara-quiet" data-goal-edit="${esc(g.id)}">Atualizar</button></div>`).join(''):'<p class="clara-muted">Que tal criar uma reserva de emergência?</p>'}
   </section>
   <section class="clara-simple-card"><header><h3>Contas recorrentes</h3></header><p class="clara-muted">Parcelas e contas fixas aparecem nos seus registros.</p><button type="button" class="clara-quiet" data-view="mov">Ver registros</button></section>
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
   $('sideNav').innerHTML=mainNav.map(([id,icon,label])=>`<button type="button" class="navlink ${current===id?'active':''}" data-view="${id}" title="${label}" aria-label="${label}" ${current===id?'aria-current="page"':''}><span class="ico">${icon}</span><span>${label}</span></button>`).join('');
   desktopDock.querySelectorAll('[data-view]').forEach(btn=>{
     const selected=btn.dataset.view===active;
     btn.classList.toggle('active',selected);
     if(selected)btn.setAttribute('aria-current','page');
     else btn.removeAttribute('aria-current');
   });
   const f=$('floatTrigger');
   if(f){f.classList.toggle('active',current==='mais');if(mode()){f.setAttribute('aria-label','Mais opções');f.setAttribute('aria-expanded','false');}}
 };
 document.addEventListener('click',e=>{
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
