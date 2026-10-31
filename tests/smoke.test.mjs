import test from 'node:test';import assert from 'node:assert/strict';import {readFile,stat} from 'node:fs/promises';
const html=await readFile('index.html','utf8');const sw=await readFile('sw.js','utf8');const manifest=JSON.parse(await readFile('manifest.webmanifest','utf8'));
test('Base financeira começa vazia',()=>{assert.match(html, /"transactions":\[\],"goals":\[\]/);assert.doesNotMatch(html,/EXEMPLO —|Restaurar demonstração/)});
test('Configurações sempre por último',()=>{const nav=html.match(/const NAV = \[([\s\S]*?)\];/)[1];assert.equal([...nav.matchAll(/\['([^']+)', SVG_ICONS/g)].at(-1)?.[1],'ajustes')});
test('Menu flutuante apenas em smartphone',()=>{assert.match(html,/\.float-trigger, \.float-menu, \.mobile-dock-wrap \{ display: none; \}/);assert.match(html,/max-width:760px/);assert.match(html,/function setFloatMenu/)});
test('PWA e cache para uso offline',async()=>{assert.equal(manifest.display,'standalone');assert.match(sw,/cache\.put\(url, response\)/);assert.match(sw,/new Request\(url, \{cache:'no-store'\}\)/);for(const n of [192,512])assert((await stat('assets/icon-'+n+'.png')).size>500)});

test('Ação Novo não é global nem duplicada no cabeçalho',()=>{assert.doesNotMatch(html,/id="quickAdd"|\$\('quickAdd'\)/);assert.match(html,/data-open="transaction">＋ Novo lançamento<\/button>/);assert.match(html,/data-open="goal">＋ Nova meta<\/button>/)});

test('Clara: 15 miniaplicativos reais, sem ClaraStore',()=>{
 const catalog=html.match(/const CLARA_WIDGETS = Object.freeze\((\[[^\n]+\])\);/);
 assert.ok(catalog,'Catálogo de miniaplicativos não encontrado');
 const widgets=JSON.parse(catalog[1]);
 assert.equal(widgets.length,15);
 assert.equal(new Set(widgets.map(w=>w.id)).size,15);
 assert.doesNotMatch(html,/ClaraStore|id="quickAdd"/);
 assert.match(html,/\$\{renderClaraMiniapps\(p\)\}/);
});
test('Clara: ações essenciais dos miniaplicativos',()=>{
 for(const key of ['pay','duplicate','new','toggle','move','all','reset','month','export'])
   assert.ok(html.includes("action==='"+key+"'"),'Ação ausente: '+key);
 for(const key of ['data-edit-tx=','data-del-tx=','data-edit-account=','data-goal-edit=','data-edit-goal-full=','data-del-goal=','data-edit-recon=','data-config-jump='])
   assert.ok(html.includes(key),'Ligação ausente: '+key);
 assert.match(html,/Backup inválido: personalização de cards/);
 assert.match(html,/openConfirmModal\(\x60Confirmar/);
});
test('Clara: editor responsivo, dados reais e histórico mensal',()=>{
 assert.match(html,/\.clw-grid\{display:grid/);
 assert.match(html,/@media\(max-width:560px\)/);
 assert.match(html,/state\.settings\.dashboardCards=/);
 assert.match(html,/state\.settings\.dashboardOrder=/);
 assert.match(html,/state\.transactions\.filter\(t=>t\.status==='Pendente'/);
 assert.match(html,/effective\(t\)\.slice\(0,7\)/);
});

test('Clara: simulador e recorrências presentes sem persistência automática',()=>{
 for (const expected of ['recurring','simulator','recurring-export','budget-export','sim-draft','simulate','agenda-days','agenda-kind','recent-status','forecast-months','account-cards','budget-risk','compare']) {
   assert.ok(html.includes(expected), 'Não localizado: '+expected);
 }
 assert.match(html,/function computeSimulation/);
 assert.match(html,/function recurringItems/);
 assert.match(html,/function widgetToolstrip/);
 assert.match(html,/function exportRecurring/);
 assert.match(html,/function exportBudget/);
 assert.match(html,/renderRecurring\(action,line,empty\)/);
 assert.match(html,/renderSimulator\(action\)/);
});
test('Clara: não há execução de bibliotecas de terceiros para miniaplicativos',()=>{
 assert.doesNotMatch(html,/ClaraStore|fetch\(['"]https:\/\/.*miniaplicativo/);
 assert.match(html,/localStorage/);
 assert.match(html,/function validateData/);
});

test('Cabeçalho sem Ajustar e seletor de meses',()=>{
 assert.doesNotMatch(html,/id="settingsBtn"|⚙ Ajustar/);
 assert.doesNotMatch(html,/type="month" aria-label="Período selecionado"/);
 assert.match(html, /<input id="period" type="hidden"/);
 assert.match(html,/state\.settings\.period = todayISO\(\)\.slice\(0, 7\)/);
});
test('PWA atualiza HTML pela rede mas abre offline',()=>{
 assert.match(sw,/const fresh = await fetch\(new Request\(request, \{cache:'no-store'\}\)\)/);
 assert.match(sw,/cache\.match\(scopedURL\('\.\/index\.html'\)\)/);
});

test('A versão publicada exige cofre AES-GCM antes de exibir dados',()=>{
 assert.match(html,/id="securityCover"/);
 assert.match(html,/CLARA_ROUNDS = 310000/);
 assert.match(html,/AES-256-GCM/);
 assert.match(html,/html:not\(\[data-unlocked="true"\]\) \.shell/);
 assert.doesNotMatch(html,/clara-preview-dados\.json/);
});
test('Atualizações por botão e aprovação, sem reiniciar durante gravação',()=>{
 assert.match(html,/id="checkClaraUpdate"/);
 assert.match(html,/ClaraSecurity\.flush\(\)/);
 assert.match(html,/const INSTALLED_VERSION=CLARA_APP_VERSION;/);
 assert.match(sw,/type === 'SKIP_WAITING'/);
 assert.doesNotMatch(sw,/await self\.skipWaiting\(\)/);
});

test('Dock flutuante com atalhos funcionais e perfil separado',()=>{
 assert.match(html,/class="mobile-dock-wrap"/);
 assert.match(html,/class="mobile-dock"/);
 assert.match(html,/id="floatTrigger"/);
 assert.match(html,/id="profileFab"/);
 assert.match(html,/data-view="painel"/);
 assert.match(html,/data-view="mov"/);
 assert.match(html,/data-view="plan"/);
 assert.doesNotMatch(html,/>Módulos<\/span>/);
});
test('Perfil validado, fotográfico e persistido no cofre',()=>{
 assert.match(html,/PROFILE_DEFAULTS=Object.freeze/);
 assert.match(html,/function validProfile/);
 assert.match(html,/function loadProfilePhoto/);
 assert.match(html,/state\.profile=updated/);
 assert.match(html,/kind==='profile'/);
 assert.match(html,/id="lockFromProfile"/);
 assert.match(html,/profile:\s*\{/);
});

test('Histórico de auditoria por mês e conta sem alterar o mês financeiro',()=>{
 assert.match(html,/function renderHistorico\(/);
 assert.match(html,/function historicalSummary\(/);
 assert.match(html,/id="view-historico"/);
 assert.match(html,/id="historyMonth"/);
 assert.match(html,/id="historyAccount"/);
 assert.match(html,/id="historyCsv"/);
 assert.doesNotMatch(html,/id="periodConfig"|id="cutoffInput"/);
 const nav=html.match(/const NAV = \[([\s\S]*?)\];/)[1];
 assert.match(nav,/\['historico', SVG_ICONS.historico, 'Histórico'\]/);
});
test('Categorias e limites do primeiro uso começam zerados',()=>{
 const found=html.match(/const SOURCE_DATA=(\{[^\n]+\});/);
 assert.ok(found);
 const initial=JSON.parse(found[1]);
 assert.ok(initial.categories.length>=10);
 assert.ok(initial.categories.every(c=>c.limitCents===0));
});

test('Registro de alterações com inclusão, edição e exclusão cifradas',()=>{
 assert.match(html,/const AUDIT_MAX=2500/);
 assert.match(html,/function recordAuditChanges\(/);
 assert.match(html,/recordAuditChanges\(auditBaseline,state\)/);
 assert.match(html,/function renderAuditJournal\(/);
 assert.match(html,/renderAuditJournal\(\)/);
 assert.match(html,/function auditEntriesForMonth\(/);
 assert.match(html,/rows\.push\(\[\],\['Alterações registradas'\]/);
 assert.match(html,/const INSTALLED_VERSION=CLARA_APP_VERSION;/);
});

test('Versão exibida acompanha a única constante do aplicativo',async()=>{
 const pkgVersion=JSON.parse(await readFile('package.json','utf8')).version;
 const expected=html.match(/const CLARA_APP_VERSION='([^']+)'/);
 assert.ok(expected,'Constante de versão ausente');
 assert.equal(expected[1],pkgVersion);
 assert.match(html,/Versão \$\{esc\(CLARA_APP_VERSION\)\}/);
 assert.match(html,/const INSTALLED_VERSION=CLARA_APP_VERSION;/);
 assert.doesNotMatch(html,/Versão 3\.6\.3-rc/);
});
