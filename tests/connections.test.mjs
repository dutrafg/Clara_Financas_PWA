import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile('index.html','utf8');
const updater=await readFile('clara-updater.js','utf8');
const guest=await readFile('clara-guest.js','utf8');
const version=JSON.parse(await readFile('version.json','utf8'));
const pkg=JSON.parse(await readFile('package.json','utf8'));

const literals=(attr)=>[...html.matchAll(new RegExp(attr+'=["\\\']([^"\\\']+)["\\\']','g'))]
 .map(x=>x[1]).filter(x=>!x.includes('${'));

test('Versão, schema e chave de migração permanecem consistentes',()=>{
 assert.equal(pkg.version,version.version);
 assert.equal(version.schema,2);
 assert.match(html,/const KEY = 'clara-html-preview-planilha-optio-v2'/);
 assert.match(html,/function parseImportedJSON\(/);
 assert.match(html,/function validateData\(/);
});

test('Navegação de cards aponta somente para módulos existentes',()=>{
 const nav=html.match(/const NAV = \[([\s\S]*?)\];/);
 assert.ok(nav);
 const ids=[...nav[1].matchAll(/\['([^']+)', SVG_ICONS/g)].map(m=>m[1]);
 const unique=new Set(ids);
 assert.equal(unique.size,ids.length);
 for(const id of unique){
   assert.ok(html.includes('id="view-'+id+'"'),'Falta área do módulo '+id);
   const renderer={painel:'renderPainel',mov:'renderMov',plan:'renderPlan',assist:'renderAssist',conf:'renderConf',historico:'renderHistorico',ajustes:'renderAjustes'}[id];
   assert.ok(html.includes('function '+renderer+'('),'Falta renderizador '+renderer);
 }
 for(const id of literals('data-view')) assert.ok(unique.has(id),'Botão aponta para módulo antigo: '+id);
});

test('Botões de cadastro só apontam a modais ainda disponíveis',()=>{
 const valid=new Set(['transaction','goal','account']);
 for(const id of literals('data-open')) assert.ok(valid.has(id),'Modal externo ao contrato: '+id);
 for(const id of valid)assert.ok(html.includes(id+": '")||html.includes(id+': "'),'Modal ausente: '+id);
});

test('Atalhos de configurações apontam para seções válidas',()=>{
 const tabs=html.match(/const CONFIG_TABS = \[([\s\S]*?)\];/);
 assert.ok(tabs);
 const valid=new Set([...tabs[1].matchAll(/\['([^']+)',/g)].map(m=>m[1]));
 for(const id of literals('data-config-jump')) assert.ok(valid.has(id),'Configuração inexistente: '+id);
 assert.match(html,/e\.target\.closest\?\.\('\[data-config-jump\]'\)/);
});

test('Minidispositivos têm ações conectadas a handlers reais',()=>{
 const actions=literals('data-clw-action');
 const ids=[...new Set(actions)];
 for(const id of ids){
   assert.ok(html.includes("action==='"+id+"'"),'Ação sem manipulador: '+id);
 }
 assert.match(html,/if \(b\.dataset\.clwAction\) \{ handleClaraWidgetAction\(b\); return; \}/);
 const catalog=html.match(/const CLARA_WIDGETS = Object\.freeze\((\[[^\n]+\])\);/);
 assert.ok(catalog);
 const items=JSON.parse(catalog[1]);
 assert.equal(items.length,15);
 assert.equal(new Set(items.map(x=>x.id)).size,15);
 for(const item of items)assert.ok(html.includes(item.id+':()=>')||html.includes('cards.'+item.id+'=()'),'Card sem implementação: '+item.id);
});

test('Referências relativas e atualizador vinculados à distribuição atual',()=>{
 assert.match(html,/href="\.\/manifest\.webmanifest"/);
 assert.match(updater,/navigator\.serviceWorker\.register\('\.\/sw\.js',\{updateViaCache:'none'\}\)/);
 assert.doesNotMatch(html,/(?:href|src)=["'](?:\.\.\/|\/)(?:release|v[0-9]+|rc[0-9]+)[^"']*/i);
});

test('Atualização de recursos ignora o cache anterior',async()=>{
 const sw=await readFile('sw.js','utf8');
 assert.match(sw,/request\.cache === 'reload' \|\| request\.cache === 'no-store'/);
 assert.match(sw,/return await fetch\(request\)/);
});

test('Service Worker não confirma versão antiga quando a rede falha',async()=>{
 const sw=await readFile('sw.js','utf8');
 const versionBranch=sw.match(/if \(url\.pathname === versionPath\) \{([\s\S]*?)\n    \}/);
 assert.ok(versionBranch,'Consulta explícita de versão no Service Worker ausente');
 assert.match(versionBranch[1],/new Request\(request, \{cache:'no-store'\}\)/);
 assert.match(versionBranch[1],/catch \{ return Response\.error\(\); \}/);
 assert.doesNotMatch(versionBranch[1],/cache\.match/);
 assert.ok(sw.indexOf('if (url.pathname === versionPath)')<sw.indexOf("if (request.cache === 'reload'"),
  'A versão precisa ser verificada antes do fallback para recursos offline');
 const vercel=JSON.parse(await readFile('vercel.json','utf8'));
 for(const path of ['/sw.js','/version.json']){
  const headers=vercel.headers.find(x=>x.source===path)?.headers||[];
  assert.ok(headers.some(x=>x.key.toLowerCase()==='cache-control'&&x.value.includes('no-store')),
   'Cache HTTP indevido: '+path);
 }
});

test('Cabeçalhos HTTP reduzem MIME sniffing, clickjacking e vazamento de referrer',async()=>{
 const vercel=JSON.parse(await readFile('vercel.json','utf8'));
 const general=vercel.headers.find(rule=>rule.source==='/(.*)')?.headers||[];
 const header=key=>general.find(item=>item.key.toLowerCase()===key.toLowerCase())?.value;
 assert.equal(header('X-Content-Type-Options'),'nosniff');
 assert.equal(header('X-Frame-Options'),'DENY');
 assert.equal(header('Referrer-Policy'),'strict-origin-when-cross-origin');
});

test('Atualização não fica pendente indefinidamente e mantém cache antigo se o download falhar',async()=>{
 const sw=await readFile('sw.js','utf8');
 assert.match(sw,/Promise\.allSettled\(APP_FILES\.map/);
 assert.match(sw,/caches\.delete\(CACHE_NAME\)/);
 assert.match(sw,/attempt<3/);
 assert.doesNotMatch(sw,/caches\.delete\(['"]clara-financas-vault/);
 assert.match(html,/id="applyClaraUpdate"/);
 assert.match(updater,/action\.hidden=!newer\(\)\|\|applying/);
 assert.match(updater,/PREPARE_TIMEOUT=120000/);
 assert.match(updater,/parseVersion/);
 assert.match(updater,/async function activatedPackageReady\(r\)/);
 assert.match(updater,/async function reopenInstalled\(r\)/);
 assert.match(updater,/action\.disabled=applying\|\|preparing/);
 assert.match(updater,/await bounded\(r\.update\(\),NETWORK_TIMEOUT/);
 assert.match(updater,/registration\?\.installing/);
 assert.match(updater,/watchInstalling\(r\.installing\)/);
 assert.match(updater,/worker\.state==='redundant'/);
 assert.match(sw,/CLARA_BOOT_OK/);
 assert.match(sw,/CLARA_BOOT_FAILED/);
 assert.match(sw,/state\.rolledBack&&state\.previous\?state\.previous:CACHE_NAME/);
 assert.match(sw,/await announceProgress\(done,APP_FILES\.length,path\)/);
 assert.match(html,/id="claraUpdateRecoveryHint"/);
 assert.match(updater,/window\.ClaraBackups\?\.beforeUpdate\?\.\(\)/);
 assert.match(html,/id="clara-update-boot-guard"/);
});

test('Versão no painel deriva da mesma constante usada pelo atualizador',()=>{
 const appVersion=html.match(/const CLARA_APP_VERSION='([^']+)'/);
 assert.ok(appVersion);
 assert.equal(appVersion[1],version.version);
 assert.equal(version.version,pkg.version);
 assert.match(updater,/const INSTALLED_VERSION=CLARA_APP_VERSION;/);
});

test('SemVer reconhece atualizações RC e ordena identificadores corretamente',()=>{
 const a=updater.match(/const parseVersion=value=>\{[\s\S]*?\n \};\n const compare=/);
 assert.ok(a,'Parser SemVer não encontrado');
 assert.match(updater,/leftNumeric&&rightNumeric\)return BigInt\(left\)>BigInt\(right\)\?1:-1/);
 assert.match(updater,/x\.prerelease\.length\?-1:1/);
 assert.match(updater,/info\.version\.length>128\|\|!parseVersion\(info\.version\)/);
});

test('Modo demonstração permite consultar atualização, sem permitir instalação/gravação',()=>{
 assert.match(guest,/\[data-view\].*#checkClaraUpdate/);
 assert.match(guest,/promptCreate\(\)/);
 assert.match(updater,/if\(!window\.ClaraSecurity\?\.unlocked\)throw Error\('Desbloqueie o cofre antes de atualizar\.'\)/);
});

test('Instalação preserva manifesto, Service Worker e opções de segurança',()=>{
 assert.match(html,/id="claraInstallBtn"/);
 assert.match(html,/id="claraInstallHelp"/);
 assert.match(html,/window\.ClaraInstall\?\.paint\?\.\(\)/);
 assert.match(html,/const CLARA_VAULT_KEY/);
});

test('Clara 4.0 mantém todas as rotas antigas e separa as quatro áreas do menu',async()=>{
 const simple=await readFile('clara-simple.js','utf8');
 assert.match(html,/id="view-mais"/);
 assert.match(html,/const NAV = \[/);
 assert.match(simple,/mainNav=\[/);
 assert.match(simple,/native\.nav\(\)/);
 assert.match(simple,/window\.ClaraSimple=/);
 for(const id of ['mais','historico','assist','conf','ajustes'])
  assert.ok(html.includes('id="view-'+id+'"'),'Rota removida: '+id);
});
