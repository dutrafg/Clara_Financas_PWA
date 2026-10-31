import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
const html=readFileSync('index.html','utf8');const sw=readFileSync('sw.js','utf8');const manifest=JSON.parse(readFileSync('manifest.webmanifest','utf8'));
test('menu de configuração na última posição',()=>assert.match(html,/\['conf', SVG_ICONS.conf, 'Conferências'\],\s*\['ajustes', SVG_ICONS.ajustes, 'Configurações'\]/));
test('PWA inclui assets',()=>{for(const path of ['icon.svg','icon-192.png','icon-512.png','sw.js']) assert.ok(existsSync(path));assert.equal(manifest.display,'standalone');});
test('sem exemplos financeiros de fábrica',()=>{assert.match(html, /"transactions":\[\],"goals":\[\]/);assert.doesNotMatch(html, /EXEMPLO — Salário/);});
test('menu flutuante apenas smartphone',()=>{assert.match(html,/@media \(max-width: 600px\)/);assert.match(html,/\.mobile-nav \{ display: none !important; \}/);});
test('service worker protege dados e instala shell',()=>{assert.match(sw,/cache.addAll\(SHELL\)/);assert.doesNotMatch(sw,/localStorage\.clear/);});
