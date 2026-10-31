import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile('index.html','utf8');
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
 assert.match(html,/navigator\.serviceWorker\.register\('\.\/sw\.js',\{updateViaCache:'none'\}\)/);
 assert.doesNotMatch(html,/(?:href|src)=["'](?:\.\.\/|\/)(?:release|v[0-9]+|rc[0-9]+)[^"']*/i);
});

test('Atualização de recursos ignora o cache anterior',async()=>{
 const sw=await readFile('sw.js','utf8');
 assert.match(sw,/request\.cache === 'reload' \|\| request\.cache === 'no-store'/);
 assert.match(sw,/return await fetch\(request\)/);
});

test('Versão no painel deriva da mesma constante usada pelo atualizador',()=>{
 const appVersion=html.match(/const CLARA_APP_VERSION='([^']+)'/);
 assert.ok(appVersion);
 assert.equal(appVersion[1],version.version);
 assert.equal(version.version,pkg.version);
 assert.match(html,/const INSTALLED_VERSION=CLARA_APP_VERSION;/);
});

test('Instalação preserva manifesto, Service Worker e opções de segurança',()=>{
 assert.match(html,/id="claraInstallBtn"/);
 assert.match(html,/id="claraInstallHelp"/);
 assert.match(html,/window\.ClaraInstall\?\.paint\?\.\(\)/);
 assert.match(html,/const CLARA_VAULT_KEY/);
});
