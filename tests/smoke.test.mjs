import test from 'node:test';import assert from 'node:assert/strict';import {readFile,stat} from 'node:fs/promises';
const html=await readFile('index.html','utf8');const sw=await readFile('sw.js','utf8');const manifest=JSON.parse(await readFile('manifest.webmanifest','utf8'));
test('Base financeira começa vazia',()=>{assert.match(html, /"transactions":\[\],"goals":\[\]/);assert.doesNotMatch(html,/EXEMPLO —|Restaurar demonstração/)});
test('Configurações sempre por último',()=>{const nav=html.match(/const NAV = \[([\s\S]*?)\];/)[1];assert.equal([...nav.matchAll(/\['([^']+)', SVG_ICONS/g)].at(-1)?.[1],'ajustes')});
test('Menu flutuante apenas em smartphone',()=>{assert.match(html,/\.float-trigger, \.float-menu \{ display: none; \}/);assert.match(html,/max-width:760px/);assert.match(html,/function setFloatMenu/)});
test('PWA e cache para uso offline',async()=>{assert.equal(manifest.display,'standalone');assert.match(sw,/cache.addAll\(APP_FILES\)/);for(const n of [192,512])assert((await stat('assets/icon-'+n+'.png')).size>500)});
