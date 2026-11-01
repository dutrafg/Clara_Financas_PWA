import test from 'node:test';import assert from 'node:assert/strict';import {readFile,stat} from 'node:fs/promises';
const appVersion=JSON.parse(await readFile('version.json','utf8')).version;
const html=await readFile('index.html','utf8');const sw=await readFile('sw.js','utf8');const updater=await readFile('clara-updater.js','utf8');const guest=await readFile('clara-guest.js','utf8');const manifest=JSON.parse(await readFile('manifest.webmanifest','utf8'));
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

test('Confirmação de boot só aceita a shell vinculada ao cache candidato',async()=>{
 const worker=await readFile('sw.js','utf8');
 const build=await readFile('tools/build.mjs','utf8');
 const verify=await readFile('tools/verify-paths.mjs','utf8');
 assert.match(html,/const CLARA_BOOT_CACHE='__CLARA_CACHE_NAME__'/);
 assert.match(html,/cacheName:CLARA_BOOT_CACHE/);
 assert.match(worker,/event\.data\.cacheName!==CACHE_NAME/);
 assert.match(build,/html\.replace\('__CLARA_CACHE_NAME__',cacheName\)/);
 assert.match(verify,/HTML deve conter o identificador imutável do pacote/);
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
 assert.match(updater,/ClaraSecurity\.flush\(\)/);
 assert.match(updater,/const INSTALLED_VERSION=CLARA_APP_VERSION;/);
 assert.match(sw,/type==='SKIP_WAITING'/);
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
 assert.match(updater,/const INSTALLED_VERSION=CLARA_APP_VERSION;/);
});

test('Versão exibida acompanha a única constante do aplicativo',async()=>{
 const pkgVersion=JSON.parse(await readFile('package.json','utf8')).version;
 const expected=html.match(/const CLARA_APP_VERSION='([^']+)'/);
 assert.ok(expected,'Constante de versão ausente');
 assert.equal(expected[1],pkgVersion);
 assert.match(html,/id="claraUpdateInstalled">\$\{esc\(CLARA_APP_VERSION\)\}/);
 assert.match(updater,/const INSTALLED_VERSION=CLARA_APP_VERSION;/);
 assert.doesNotMatch(html,/Versão 3\.6\.3-rc/);
});

test('Atualizador EFI avisa e consulta automaticamente, sem instalação compulsória',()=>{
 assert.match(html,/id="claraUpdateNotice"/);
 assert.match(html,/id="claraUpdateNoticeLater"/);
 assert.match(html,/id="applyClaraUpdate"/);
 assert.match(html,/O que há de novidade/);
 assert.match(html,/ÚLTIMA VERIFICAÇÃO/);
 assert.match(updater,/window\.addEventListener\('online'/);
 assert.match(updater,/window\.setInterval\(/);
 assert.match(updater,/document\.addEventListener\('visibilitychange'/);
 assert.match(updater,/ClaraSecurity\.flush\(\)/);
 assert.match(updater,/worker\.postMessage\(\{type:'SKIP_WAITING'\}\)/);
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
 assert.match(html,/No Windows, abra a Clara instalada pelo atalho/);
 assert.match(html,/para atualizar, use Atualizações/i);
 assert.match(html,/clw-panel/);
 assert.match(html,/clw-scroll-area/);
 assert.match(html,/function claraWidgetPanel\(/);
 assert.match(updater,/Aplicar atualização/);
 assert.doesNotMatch(updater,/Instalar atualização/);
 assert.ok(html.includes("const CLARA_APP_VERSION='"+appVersion+"'"));
});

test('Navegação sem botão órfão de QA, preservando acesso de manutenção',()=>{
 assert.doesNotMatch(html,/id="qaOpen"/);
 assert.doesNotMatch(html,/\$\('qaOpen'\)/);
 assert.match(html,/function qaOpen\(\)/);
 assert.match(html,/if \(b\.dataset\.openQa\) \{ qaOpen\(\); return; \}/);
 assert.match(html,/id="claraAdvancedSettings"/);
 assert.match(html,/data-open-qa="1"/);
 assert.ok(html.includes("const CLARA_APP_VERSION='"+appVersion+"'"));
});


test('RC4.1.2: notas da interface, metadata e instruções de segurança alinhadas',async()=>{
 const pkg=JSON.parse(await readFile('package.json','utf8'));
 const version=JSON.parse(await readFile('version.json','utf8'));
 const readme=await readFile('README.md','utf8');
 const qa=await readFile('docs/QA-Clara-4.md','utf8');
 const notesSource=html.match(/const CLARA_RELEASE_NOTES=Object\.freeze\((\[[\s\S]*?\])\);/)?.[1];
 assert.ok(notesSource,'Lista de novidades da interface ausente');
 const notes=JSON.parse(notesSource);
 assert.equal(version.version,appVersion);
 assert.equal(pkg.version,version.version);
 assert.ok(html.includes('Clara Finanças RC'+appVersion.split('-')[0]));
 assert.deepEqual(notes,version.notes,'Notas do HTML e version.json divergentes');
 assert.ok(notes.some(x=>x.includes('recarregamento')));
 assert.ok(notes.some(x=>x.includes('simples e avançado')));
 assert.match(readme,/RC4\.0\.0|RC4\.1\.2/);
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
 for(const asset of ['clara-simple.js','clara-simple.css','clara-updater.js']){
  assert.ok(sw.includes('./'+asset),'SW não faz precache: '+asset);
  assert.ok(build.includes("'"+asset+"'"),'Build não copia: '+asset);
  assert.ok(verify.includes("'"+asset+"'"),'QA não verifica: '+asset);
 }
 assert.match(html,/src="\.\/clara-updater\.js"/);
 assert.ok(build.includes("cacheHash.update('sw.js\\n')"),'Código do próprio SW deve mudar cache');
 assert.ok(verify.includes("hash.update('sw.js\\n')"),'QA deve verificar hash SW');
 assert.ok(simple.includes('persistSuccess('),'Modo não persiste');
 assert.match(updater,/ClaraSecurity\.flush\(\)/);
 assert.doesNotMatch(sw,/await self\.skipWaiting\(\)/);
});


test('Clara 4.1.2: biometria opcional não substitui nem expõe a senha do cofre',async()=>{
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
test('Clara 4.1.2: modo avançado tem saída direta e dock aproveita a tela',async()=>{
 const simple=await readFile('clara-simple.js','utf8');
 const css=await readFile('clara-simple.css','utf8');
 assert.match(simple,/id='claraExitAdvanced'/);
 assert.match(simple,/dataset\.modeToggle='simple'/);
 assert.match(simple,/exitAdvanced\.hidden=mode\(\)/);
 assert.match(css,/\.mobile-dock-wrap \{[\s\S]*?left:12px;right:12px/);
 assert.match(css,/width:calc\(100% - 24px\)/);
 assert.match(css,/\.mobile-dock \{flex:1 1 auto/);
});
test('Clara 4.1.2: aceita foto original de 10 MiB e reduz antes de criptografar',()=>{
 assert.match(html,/file\.size>10\*1024\*1024/);
 assert.match(html,/foto de até 10 MB/i);
 assert.match(html,/192\/Math\.max\(picture\.width,picture\.height\)/);
 assert.match(html,/canvas\.toDataURL\('image\/jpeg',0\.78\)/);
 assert.match(html,/p\.photo\.length>120000/);
});
test('Clara 4.1.2: precache inclui todos os arquivos biométricos',async()=>{
 const sw=await readFile('sw.js','utf8'),build=await readFile('tools/build.mjs','utf8'),verify=await readFile('tools/verify-paths.mjs','utf8');
 for(const file of ['clara-biometric.js','clara-biometric.css']){
  assert.ok(sw.includes('./'+file));
  assert.ok(build.includes("'"+file+"'"));
  assert.ok(verify.includes("'"+file+"'"));
 }
});


test('Clara 4.1.2: OPFS primário em pasta privada criptografada e migração legada',async()=>{
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
test('Clara 4.1.2: todos os arquivos biométricos e do OPFS estão em cache offline',async()=>{
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

test('Clara 4.1.2: recarregamento bloqueado por padrão, reversível e integrado às configurações',()=>{
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
 assert.match(updater,/await bounded\(window\.ClaraSecurity\.flush\(\),NETWORK_TIMEOUT/);
 assert.ok(html.includes("const CLARA_APP_VERSION='"+appVersion+"'"));
});


test('Clara 4.1.2: agenda mensal e sino para ambos os modos',async()=>{
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
test('Clara 4.1.2: novas fontes de notificação com persistência no cofre',async()=>{
 const calendar=await readFile('clara-agenda.js','utf8');
 for(const token of ['for(const ev of calendarData())','for(const tx of state.transactions)','for(const goal of state.goals)','for(const budget of budgetRows())','update?.remoteVersion','update.compare','markRead([id])','state.notificationsRead=','window.ClaraUpdate.check'])
  assert.ok(calendar.includes(token),'Fonte de notificação ausente: '+token);
 assert.match(html,/await encryptState\(snapshot,claraKey,salt\)/);
 assert.match(html,/CLARA_FS_FOLDER='ClaraFinancas'/);
});
test('Clara 4.1.2: cache offline da agenda acompanha a versão',async()=>{
 const build=await readFile('tools/build.mjs','utf8');
 const verify=await readFile('tools/verify-paths.mjs','utf8');
 for(const f of ['clara-agenda.css','clara-agenda.js']){
  assert.ok(sw.includes("'./"+f+"'"));
  assert.ok(build.includes("'"+f+"'"));
  assert.ok(verify.includes("'"+f+"'"));
 }
 assert.ok(html.includes("const CLARA_APP_VERSION='"+appVersion+"'"));
});

test('Clara 4.1.2: símbolo macOS, canto fixo, painel de alertas independente do cabeçalho',async()=>{
 const js=await readFile('clara-agenda.js','utf8'),css=await readFile('clara-agenda.css','utf8');
 assert.match(js,/class="ca-apple-bell"/);
 assert.match(js,/stroke-width="1\.65"/);
 assert.match(js,/overlayParent=document\.body/);
 assert.match(js,/overlayParent\.appendChild\(bell\)/);
 assert.match(js,/overlayParent\.appendChild\(panel\)/);
 assert.match(css,/\.ca-bell\{position:fixed;top:calc\(12px \+ env\(safe-area-inset-top,0px\)\)/);
 assert.match(css,/right:calc\(14px \+ env\(safe-area-inset-right,0px\)\)/);
 assert.match(css,/\.ca-popover\{position:fixed/);
 assert.match(css,/\.ca-badge\{/);
 assert.ok(html.includes("const CLARA_APP_VERSION='"+appVersion+"'"));
});
test('Clara 4.1.2: dock tablet e desktop tem todos os módulos, menu lateral fora da interface',async()=>{
 const js=await readFile('clara-simple.js','utf8'),css=await readFile('clara-simple.css','utf8');
 assert.match(js,/const dockModules=\[/);
 assert.match(js,/\.{3}NAV\.map\(/);
 assert.match(js,/desktopDock\.id='claraDesktopDock'/);
 assert.match(js,/dockWrap\?\.insertBefore\(desktopDock,dockWrap\.firstChild\)/);
 assert.match(js,/desktopDock\.querySelectorAll\('\[data-view\]'\)/);
 assert.doesNotMatch(html,/<aside class="sidebar">/);
 assert.doesNotMatch(js,/\$\('sideNav'\)/);
 assert.match(css,/\.shell\{display:block!important;/);
 assert.match(css,/@media \(min-width:761px\)/);
 assert.match(css,/\.mobile-dock-wrap\{[\s\S]*?display:flex!important/);
 assert.match(css,/\.clara-desktop-dock\{[\s\S]*?display:flex/);
 assert.match(css,/\.mobile-dock-wrap>\.mobile-dock\{display:none!important;\}/);
 assert.match(css,/@media print/);
});

test('Clara 4.1.2: lembretes por hora precedem aviso genérico do dia e são testáveis',async()=>{
 const code=await readFile('clara-agenda.js','utf8');
 assert.match(code,/function appointmentReminder\(ev,instant=new Date\(\)\)/);
 assert.match(code,/const label=appointmentReminder\(ev,now\)/);
 assert.match(code,/window\.ClaraAgenda=\{[^\n]*reminderFor:appointmentReminder/);
 const hour=code.indexOf("return 'Compromisso em até 1 hora'");
 const today=code.indexOf("return 'Compromisso de hoje'");
 assert.ok(hour>0 && today>hour,'1h deve ter prioridade sobre aviso de hoje');
 assert.match(code,/ev\.reminder==='day'/);
 assert.match(code,/ev\.reminder==='hour'/);
});
test('Clara 4.1.2: QA único cobre main e homologação sem workflows legados',async()=>{
 const workflow=await readFile('.github/workflows/rc3610-qa.yml','utf8');
 assert.match(workflow,/branches:\s*\n\s*- main\s*\n\s*- 'homologacao\/\*\*'/);
 assert.match(workflow,/python tests\/pwa_browser\.py/);
 assert.match(workflow,/python tests\/security_pwa\.py/);
 assert.match(workflow,/python tests\/input_validation_browser\.py/);
 assert.match(workflow,/python tests\/updater_rollback_browser\.py/);
 assert.match(workflow,/python tests\/agenda_browser\.py/);
 assert.match(workflow,/python tests\/miniapps_extended\.py/);
 const {access}=await import('node:fs/promises');
 await assert.rejects(access('.github/workflows/validar-rc35.yml'));
 await assert.rejects(access('.github/workflows/validar-etapa-02.yml'));
});



test('Clara Studio 4.1: barra lateral legada removida sem perder navegação',async()=>{
 const core=await readFile('index.html','utf8');
 const simple=await readFile('clara-simple.js','utf8');
 assert.ok(!core.includes('id="sideNav"'));
 assert.ok(!core.includes('sidebarCompact'));
 assert.ok(!core.includes('.sidebar {\n  position: sticky'));
 assert.ok(!simple.includes('sideNav'));
 assert.ok(core.includes('id="mobileNav"'));
 assert.ok(simple.includes("id='claraDesktopDock'"));
 assert.ok(core.includes('MOBILE_NAV_LABELS'));
 assert.ok(core.includes('renderProfileBubble()'));
});
test('Clara Studio 4.1: sistema visual local e acessível',async()=>{
 const css=await readFile('clara-premium.css','utf8');
 const build=await readFile('tools/build.mjs','utf8');
 const verify=await readFile('tools/verify-paths.mjs','utf8');
 const sw=await readFile('sw.js','utf8');
 assert.ok(html.includes('href="./clara-premium.css"'));
 for(const body of [sw,build,verify])assert.ok(body.includes('clara-premium.css'));
 for(const token of ['--studio-card-shadow','--studio-radius-4','clara-balance',
    'clara-desktop-dock','ca-bell','prefers-reduced-motion','hover:none','max-width:760px',
    'data-theme="light"','data-theme="dark"'])
  assert.ok(css.includes(token),'Token de design ausente: '+token);
 assert.ok(!css.includes('@import '));
 assert.ok(!css.includes('url(http'));
 assert.ok(css.includes(':focus-visible'));
});

test('RC4.1.2: visitante explora sem senha, sem salvar ou importar informações',async()=>{
 const guest=await readFile('clara-guest.js','utf8');
 const guestCss=await readFile('clara-guest.css','utf8');
 assert.match(html,/id="securityGuest"/);
 assert.match(html,/id="claraGuestNotice"/);
 assert.match(html,/id="claraGuestCreate"/);
 assert.match(html,/!isCreate\|\|!!safeStorageGet\(KEY\)/);
 assert.match(html,/if\(window\.ClaraGuest\?\.active\)/);
 assert.match(guest,/function sample\(\)/);
 assert.match(guest,/const data=fresh\(\)/);
 assert.match(guest,/function createVault\(\)/);
 assert.match(guest,/state=fresh\(\);active='painel'/);
 assert.match(guest,/get active\(\)\{return guest;\}/);
 assert.match(guest,/event\.stopImmediatePropagation\(\)/);
 assert.match(guest,/isSafePreview\(\)/);
 assert.match(guestCss,/\.clara-guest-notice/);
});
test('RC4.1.2: layout desktop livre e dock vertical fixa à esquerda',async()=>{
 const premium=await readFile('clara-premium.css','utf8');
 const simple=await readFile('clara-simple.css','utf8');
 assert.match(premium,/@media screen and \(min-width:1024px\)/);
 assert.match(premium,/width:calc\(100% - 105px\)/);
 assert.match(premium,/margin:0 0 0 105px/);
 assert.match(premium,/flex-direction:column/);
 assert.match(premium,/top:50%/);
 assert.match(premium,/transform:translateY\(-50%\)/);
 assert.match(premium,/\.clara-simple-home,\.clara-balance,\.clara-simple-intro/);
 assert.match(simple,/\.clara-desktop-dock/);
 assert.match(premium,/@media print/);
});
test('RC4.1.2: PWA inclui os recursos da demonstração no cache offline',async()=>{
 const guestFiles=['clara-guest.js','clara-guest.css'];
 const build=await readFile('tools/build.mjs','utf8');
 const verify=await readFile('tools/verify-paths.mjs','utf8');
 for(const filename of guestFiles){
  assert.ok(sw.includes("'./"+filename+"'"));
  assert.ok(build.includes("'"+filename+"'"));
  assert.ok(verify.includes("'./"+filename+"'")||verify.includes("'"+filename+"'"));
 }
 assert.ok(html.includes("const CLARA_APP_VERSION='"+appVersion+"'"));
});


test('RC4.1.2: lembretes e notas respeitam o cofre e versões legadas',async()=>{
 const js=await readFile('clara-extras.js','utf8');
 const agenda=await readFile('clara-agenda.js','utf8');
 assert.match(html,/reminders: \[\]/);
 assert.match(html,/quickNotes: \[\]/);
 assert.match(html,/data\.reminders!==undefined/);
 assert.match(html,/data\.quickNotes!==undefined/);
 assert.match(html,/obj\.reminders=obj\.reminders\|\|\[\]/);
 assert.match(html,/obj\.quickNotes=obj\.quickNotes\|\|\[\]/);
 assert.match(js,/function saveForm\(form\)/);
 assert.match(js,/validateData\(state\);persistSuccess\(message\)/);
 assert.match(js,/window\.ClaraGuest\?\.active/);
 assert.match(js,/id="clxNoteSearch"/);
 assert.match(js,/data-clx="pin"/);
 assert.match(js,/data-clx="toggle"/);
 assert.match(agenda,/kind:'reminder'/);
 assert.match(agenda,/id:'rem:'/);
 assert.match(agenda,/caReminder/);
});
test('RC4.1.2: backup criptografado OPFS/IndexedDB, 02h e recuperação autenticada',async()=>{
 const js=await readFile('clara-backup.js','utf8');
 assert.match(js,/new Date\(now\.getFullYear\(\),now\.getMonth\(\),now\.getDate\(\),2,0,0\)/);
 assert.match(js,/window\.ClaraSecurity\.flush\(\)/);
 assert.match(js,/const raw=readVault\(\)/);
 assert.match(js,/validateVault\(raw\)/);
 assert.match(js,/getDirectoryHandle\(CHILD,\{create:true\}\)/);
 assert.match(js,/indexedDB\.open\('ClaraFinancasBackups',1\)/);
 assert.match(js,/async function restore\(name\)/);
 assert.match(js,/restoreLocalEncrypted\(raw,password\)/);
 assert.match(html,/autoBackup: true/);
 assert.match(html,/prefSwitch\('autoBackup','Backup automático às 2h'/);
 assert.match(html,/secureRestoreLocalEncrypted\(raw,password\)/);
 assert.match(html,/await decryptState\(v,key\)/);
 assert.match(html,/await claraSaving/);
 assert.match(html,/data\.quickNotes/);
});
test('RC4.1.2: miniapps e backup disponíveis offline',async()=>{
 const sw=await readFile('sw.js','utf8');
 const build=await readFile('tools/build.mjs','utf8');
 const verify=await readFile('tools/verify-paths.mjs','utf8');
 for(const file of ['clara-extras.js','clara-extras.css','clara-backup.js']){
  assert.match(html,new RegExp(file.replace('.','\\.')+'["]'));
  assert.ok(build.includes("'"+file+"'"),file+' não encontrado no build');
  assert.ok(verify.includes("'"+file+"'"),file+' não encontrado na auditoria');
  assert.ok(sw.includes("'./"+file+"'"),file+' não encontrado no pre-cache');
 }
});
