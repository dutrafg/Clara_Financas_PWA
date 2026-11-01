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
test('PWA só apresenta novo HTML após troca autorizada do SW',()=>{
 assert.match(sw,/const installed = await cache\.match\(scopedURL\('\.\/index\.html'\)\)/);
 assert.match(sw,/if \(installed\) return installed/);
 assert.doesNotMatch(sw,/const fresh = await fetch\(new Request\(request, \{cache:'no-store'\}\)\)/);
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
 assert.match(html,/id="claraUpdateInstalled">\$\{esc\(CLARA_APP_VERSION\)\}/);
 assert.match(html,/const INSTALLED_VERSION=CLARA_APP_VERSION;/);
 assert.doesNotMatch(html,/Versão 3\.6\.3-rc/);
});

test('Atualizador EFI avisa e consulta automaticamente, sem instalação compulsória',()=>{
 assert.match(html,/id="claraUpdateNotice"/);
 assert.match(html,/id="claraUpdateNoticeLater"/);
 assert.match(html,/id="applyClaraUpdate"/);
 assert.match(html,/O que há de novidade/);
 assert.match(html,/ÚLTIMA VERIFICAÇÃO/);
 assert.match(html,/window\.addEventListener\('online'/);
 assert.match(html,/window\.setInterval\(/);
 assert.match(html,/document\.addEventListener\('visibilitychange'/);
 assert.match(html,/ClaraSecurity\.flush\(\)/);
 assert.match(html,/waiting\.postMessage\(\{type:'SKIP_WAITING'\}\)/);
 assert.doesNotMatch(sw,/await self\.skipWaiting\(\);/);
});

test('Configurações minimalistas conservam os controles e escondem opções avançadas',()=>{
 const render=html.match(/function renderAjustes\(\) \{([\s\S]*?)function generateInstallments\(/)?.[1];
 assert.ok(render,'renderizador de Configurações não encontrado');
 for(const field of ['id="claraUpdateInstalled"','id="claraUpdateLast"','id="checkClaraUpdate"','id="applyClaraUpdate"','id="exportJson"','id="importClara"','id="importJson"','id="lockClaraNow"','id="startEmpty"','data-open-qa="1"']) assert.ok(render.includes(field),field);
 for(const disclosure of ['id="claraReleaseNotes"','id="claraAdvancedSettings"'])assert.ok(render.includes(disclosure),disclosure);
 assert.match(html,/class="config-version"/);
 assert.match(html,/config-disclosure/);
 assert.doesNotMatch(html,/Um lugar para todos os ajustes/);
});

test('Instalação PWA sem apagar o cofre e sem simular instalação',()=>{
 assert.match(html,/id="claraInstallBtn"/);
 assert.match(html,/id="claraInstallStatus"/);
 assert.match(html,/id="clara-install-runtime"/);
 assert.match(html,/addEventListener\('beforeinstallprompt'/);
 assert.match(html,/event\.preventDefault\(\);candidate=event;paint\(\)/);
 assert.match(html,/addEventListener\('appinstalled'/);
 assert.match(html,/await prompt\.prompt\(\)/);
 assert.match(html,/id="claraInstallHelp"/);
 assert.match(html,/No Chrome, primeiro abra o site normalmente/);
 assert.match(html,/const CLARA_APP_VERSION='4\.0\.4-rc'/);
});

test('Navegação sem botão órfão de QA, preservando acesso de manutenção',()=>{
 assert.doesNotMatch(html,/id="qaOpen"/);
 assert.doesNotMatch(html,/\$\('qaOpen'\)/);
 assert.match(html,/function qaOpen\(\)/);
 assert.match(html,/if \(b\.dataset\.openQa\) \{ qaOpen\(\); return; \}/);
 assert.match(html,/id="claraAdvancedSettings"/);
 assert.match(html,/data-open-qa="1"/);
 assert.match(html,/const CLARA_APP_VERSION='4\.0\.4-rc'/);
});


test('RC4.0.4: notas da interface, metadata e instruções de segurança alinhadas',async()=>{
 const pkg=JSON.parse(await readFile('package.json','utf8'));
 const version=JSON.parse(await readFile('version.json','utf8'));
 const readme=await readFile('README.md','utf8');
 const qa=await readFile('docs/QA-Clara-4.md','utf8');
 const notesSource=html.match(/const CLARA_RELEASE_NOTES=Object\.freeze\((\[[\s\S]*?\])\);/)?.[1];
 assert.ok(notesSource,'Lista de novidades da interface ausente');
 const notes=JSON.parse(notesSource);
 assert.equal(version.version,'4.0.4-rc');
 assert.equal(pkg.version,version.version);
 assert.match(html,/Clara Finanças RC4\.0\.4/);
 assert.deepEqual(notes,version.notes,'Notas do HTML e version.json divergentes');
 assert.ok(notes.some(x=>x.includes('recarregamento')));
 assert.ok(notes.some(x=>x.includes('simples e avançado')));
 assert.match(readme,/RC4\.0\.0|RC4\.0\.4/);
 assert.match(readme,/AES-256-GCM/);
 assert.match(readme,/PBKDF2-HMAC-SHA-256/);
 assert.match(readme,/310\.000 iterações/);
 for(const scenario of ['Chrome Android','Samsung Internet','Windows 11','offline','migração','M15'])
   assert.ok(qa.toLowerCase().includes(scenario.toLowerCase()),'Cenário QA ausente: '+scenario);
});


test('Clara 4.0: quatro áreas visíveis e sete rotas antigas preservadas',async()=>{
 const simple=await readFile('clara-simple.js','utf8');
 const css=await readFile('clara-simple.css','utf8');
 const paths=['painel','mov','plan','mais'];
 for(const path of paths)assert.ok(simple.includes("'"+path+"'"),'Navegação principal ausente: '+path);
 assert.match(html,/id="view-mais"/);
 assert.match(html,/window\.ClaraSimple\.renderMais\(\)/);
 assert.match(html,/simpleMode: true/);
 assert.match(html,/const PREF_BOOL_KEYS = [^\n]*'simpleMode'/);
 assert.match(simple,/renderPainel=function/);
 assert.match(simple,/renderMov=function/);
 assert.match(simple,/renderPlan=function/);
 assert.match(simple,/renderAjustes=function/);
 assert.match(simple,/renderNav=function/);
 assert.match(simple,/data-mode-toggle/);
 assert.match(simple,/state\.settings\.simpleMode=next/);
 assert.match(simple,/data-simple-hide/);
 assert.match(css,/:root\[data-simple="true"\]/);
 assert.match(css,/max-width:760px/);
});
test('Clara 4.0: Service Worker novo contém todos os arquivos e hash de si mesmo',async()=>{
 const build=await readFile('tools/build.mjs','utf8');
 const verify=await readFile('tools/verify-paths.mjs','utf8');
 const simple=await readFile('clara-simple.js','utf8');
 assert.match(html,/href="\.\/clara-simple\.css"/);
 assert.match(html,/src="\.\/clara-simple\.js"/);
 for(const asset of ['clara-simple.js','clara-simple.css']){
  assert.ok(sw.includes('./'+asset),'SW não faz precache: '+asset);
  assert.ok(build.includes("'"+asset+"'"),'Build não copia: '+asset);
  assert.ok(verify.includes("'"+asset+"'"),'QA não verifica: '+asset);
 }
 assert.ok(build.includes("cacheHash.update('sw.js\\n')"),'Código do próprio SW deve mudar cache');
 assert.ok(verify.includes("hash.update('sw.js\\n')"),'QA deve verificar hash SW');
 assert.ok(simple.includes('persistSuccess('),'Modo não persiste');
 assert.match(html,/ClaraSecurity\.flush\(\)/);
 assert.doesNotMatch(sw,/await self\.skipWaiting\(\)/);
});


test('Clara 4.0.4: biometria opcional não substitui nem expõe a senha do cofre',async()=>{
 const bio=await readFile('clara-biometric.js','utf8');
 assert.match(html,/id="securityBiometric"/);
 assert.match(html,/src="\.\/clara-biometric\.js"/);
 assert.match(html,/href="\.\/clara-biometric\.css"/);
 assert.match(bio,/navigator\.credentials\.create/);
 assert.match(bio,/navigator\.credentials\.get/);
 assert.match(bio,/userVerification:'required'/);
 assert.match(bio,/prf/);
 assert.match(bio,/AES-GCM/);
 assert.match(bio,/await secureEnter\(password,''\)/);
 assert.match(bio,/const derived=await deriveKey\(password/);
 assert.match(bio,/localStorage\.removeItem\(RECORD_KEY\)/);
 assert.doesNotMatch(bio,/localStorage\.setItem\(.*password/);
 assert.match(html,/const CLARA_VAULT_KEY = 'clara-financas-vault-aesgcm-v1'/);
});
test('Clara 4.0.4: modo avançado tem saída direta e dock aproveita a tela',async()=>{
 const simple=await readFile('clara-simple.js','utf8');
 const css=await readFile('clara-simple.css','utf8');
 assert.match(simple,/id='claraExitAdvanced'/);
 assert.match(simple,/dataset\.modeToggle='simple'/);
 assert.match(simple,/exitAdvanced\.hidden=mode\(\)/);
 assert.match(css,/\.mobile-dock-wrap \{[\s\S]*?left:12px;right:12px/);
 assert.match(css,/width:calc\(100% - 24px\)/);
 assert.match(css,/\.mobile-dock \{flex:1 1 auto/);
});
test('Clara 4.0.4: aceita foto original de 10 MiB e reduz antes de criptografar',()=>{
 assert.match(html,/file\.size>10\*1024\*1024/);
 assert.match(html,/foto de até 10 MB/i);
 assert.match(html,/192\/Math\.max\(picture\.width,picture\.height\)/);
 assert.match(html,/canvas\.toDataURL\('image\/jpeg',0\.78\)/);
 assert.match(html,/p\.photo\.length>120000/);
});
test('Clara 4.0.4: precache inclui todos os arquivos biométricos',async()=>{
 const sw=await readFile('sw.js','utf8'),build=await readFile('tools/build.mjs','utf8'),verify=await readFile('tools/verify-paths.mjs','utf8');
 for(const file of ['clara-biometric.js','clara-biometric.css']){
  assert.ok(sw.includes('./'+file));
  assert.ok(build.includes("'"+file+"'"));
  assert.ok(verify.includes("'"+file+"'"));
 }
});


test('Clara 4.0.4: OPFS primário em pasta privada criptografada e migração legada',async()=>{
 assert.match(html,/CLARA_FS_FOLDER='ClaraFinancas'/);
 assert.match(html,/CLARA_FS_SLOTS=\['cofre-0\.clara','cofre-1\.clara'\]/);
 assert.match(html,/navigator\.storage\.getDirectory\(\)/);
 assert.match(html,/await claraFSInit\(\)/);
 assert.match(html,/validateVault\(entry\.vault\)/);
 assert.match(html,/await claraFSWrite\(raw\)/);
 assert.match(html,/const disk=await claraFSLatest\(\)/);
 assert.match(html,/if\(claraFSDirectory\)await claraFSWrite\(raw\)/);
 assert.match(html,/safeStorageSet\(CLARA_VAULT_KEY,raw\)/);
 assert.match(html,/navigator\.storage\.persist\(\)/);
 const ui=await readFile('clara-storage-ui.js','utf8');
 assert.match(ui,/ClaraFinancas/);
 assert.match(ui,/Salvar backup/);
 assert.match(ui,/ClaraSecurity\?\.exportBackup/);
});
test('Clara 4.0.4: todos os arquivos biométricos e do OPFS estão em cache offline',async()=>{
 const build=await readFile('tools/build.mjs','utf8');
 const verify=await readFile('tools/verify-paths.mjs','utf8');
 const sw=await readFile('sw.js','utf8');
 for(const file of ['clara-biometric.js','clara-biometric.css','clara-storage-ui.js','clara-storage-ui.css']){
  assert.ok(build.includes("'"+file+"'"),'Faltou arquivo no build: '+file);
  assert.ok(verify.includes("'"+file+"'"),'Faltou arquivo em verify: '+file);
  assert.ok(sw.includes("'./"+file+"'"),'Faltou arquivo no SW: '+file);
 }
 assert.match(html,/src="\.\/clara-storage-ui\.js"/);
 assert.match(html,/href="\.\/clara-storage-ui\.css"/);
});

test('Clara 4.0.4: recarregamento bloqueado por padrão, reversível e integrado às configurações',()=>{
 assert.match(html,/simpleMode: true, reloadLock: true/);
 assert.match(html,/const PREF_BOOL_KEYS = [^\n]*'reloadLock'/);
 assert.match(html,/prefSwitch\('reloadLock','Proteger contra recarregamento'/);
 assert.match(html,/id="clara-reload-guard"/);
 assert.match(html,/const key=String\(e\.key/);
 assert.match(html,/key==='f5'/);
 assert.match(html,/key==='r'&&\(e\.ctrlKey\|\|e\.metaKey\)/);
 assert.match(html,/event\.preventDefault\(\)/);
 assert.match(html,/addEventListener\('beforeunload'/);
 assert.match(html,/event\.returnValue=' '/);
 assert.match(html,/window\.ClaraSecurity\?\.unlocked && pref\('reloadLock'\)/);
 assert.match(html,/window\.ClaraReloadGuard\?\.allowOfficialUpdate\(\);location\.reload\(\)/);
 assert.match(html,/await window\.ClaraSecurity\.flush\(\);/);
 assert.match(html,/const CLARA_APP_VERSION='4\.0\.4-rc'/);
});


test('Clara 4.0.4: agenda mensal e sino para ambos os modos',async()=>{
 const calendar=await readFile('clara-agenda.js','utf8');
 const style=await readFile('clara-agenda.css','utf8');
 assert.match(calendar,/window\.ClaraAgenda=/);
 for(const term of ['renderCalendar','renderBell','calendarEvents','notificationsRead','dateValid','formOpen','saveEvent','persistSuccess','new Date','bell.dataset.caBell','data-ca-day','data-ca-new','data-ca-edit','data-ca-toggle','data-ca-delete','data-ca-readall','data-ca-alert'])
  assert.ok(calendar.includes(term),'Agenda incompleta: '+term);
 assert.match(calendar,/const nativeRender=render/);
 assert.match(calendar,/render=function\(\)\{nativeRender\(\);paint\(\);\}/);
 assert.match(style,/\.ca-grid\{display:grid/);
 assert.match(style,/\.ca-bell\{/);
 assert.match(style,/max-width:760px/);
 assert.match(html,/src="\.\/clara-agenda\.js"/);
 assert.match(html,/href="\.\/clara-agenda\.css"/);
 assert.match(html,/calendarEvents: \[\]/);
 assert.match(html,/notificationsRead: \[\]/);
 assert.match(html,/data\.calendarEvents!==undefined/);
 assert.match(html,/data\.notificationsRead!==undefined/);
 assert.match(html,/obj\.calendarEvents=obj\.calendarEvents\|\|\[\]/);
});
test('Clara 4.0.4: novas fontes de notificação com persistência no cofre',async()=>{
 const calendar=await readFile('clara-agenda.js','utf8');
 for(const token of ['for(const ev of calendarData())','for(const tx of state.transactions)','for(const goal of state.goals)','for(const budget of budgetRows())','update?.remoteVersion','update.compare','markRead([id])','state.notificationsRead=','window.ClaraUpdate.check'])
  assert.ok(calendar.includes(token),'Fonte de notificação ausente: '+token);
 assert.match(html,/await encryptState\(snapshot,claraKey,salt\)/);
 assert.match(html,/CLARA_FS_FOLDER='ClaraFinancas'/);
});
test('Clara 4.0.4: cache offline da agenda acompanha a versão',async()=>{
 const build=await readFile('tools/build.mjs','utf8');
 const verify=await readFile('tools/verify-paths.mjs','utf8');
 for(const f of ['clara-agenda.css','clara-agenda.js']){
  assert.ok(sw.includes("'./"+f+"'"));
  assert.ok(build.includes("'"+f+"'"));
  assert.ok(verify.includes("'"+f+"'"));
 }
 assert.match(html,/const CLARA_APP_VERSION='4\.0\.4-rc'/);
});
