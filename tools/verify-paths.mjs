import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const root=new URL('../',import.meta.url);
const dist=new URL('../dist/',import.meta.url);
const get=(base,path)=>readFile(new URL(path,base));
const text=(base,path)=>get(base,path).then(b=>b.toString('utf8'));
const files=['index.html','clara-simple.css','clara-simple.js','manifest.webmanifest','version.json','assets/icon-192.png','assets/icon-512.png'];
const pkg=JSON.parse(await text(root,'package.json'));
const meta=JSON.parse(await text(root,'version.json'));
const manifest=JSON.parse(await text(dist,'manifest.webmanifest'));
const html=await text(dist,'index.html'),sw=await text(dist,'sw.js');
assert.equal(pkg.version,meta.version,'Versão do pacote e versão publicada não podem divergir');
assert.equal(JSON.parse(await text(dist,'version.json')).version,pkg.version);
assert.deepEqual([manifest.id,manifest.start_url,manifest.scope],['./','./','./'],'PWA deve seguir caminhos relativos');
assert.ok(html.includes('Clara Finanças RC'+pkg.version.split('.').slice(0,2).join('.')),'Título da interface divergente');
assert.ok(html.includes('href="./manifest.webmanifest"'),'Manifesto não referenciado');
assert.ok(html.includes("serviceWorker.register('./sw.js',{updateViaCache:'none'})"),'Service Worker fora do caminho canônico');
for (const path of files) {
  assert.deepEqual(await get(root,path),await get(dist,path),'Arquivo divergente: '+path);
  assert.ok((await stat(new URL(path,dist))).isFile(),'Artefato ausente: '+path);
}
const hash=createHash('sha256');
hash.update(pkg.version+'\n');
for (const path of files){hash.update(path+'\n');hash.update(await get(root,path));}
hash.update('sw.js\n');hash.update(await get(root,'sw.js'));

const revision=hash.digest('hex').slice(0,16);
const expected='clara-financas-'+pkg.version.replace(/[^a-z\d-]/gi,'-')+'-'+revision;
const found=sw.match(/const CACHE_NAME = '([^']+)';/);
assert.equal(found?.[1],expected,'Cache não corresponde à versão e ao hash do build');
assert.ok(!sw.includes('__CLARA_CACHE_NAME__'),'Marcador de template não pode ir para produção');
assert.ok(sw.includes("fetch(request, {cache:'no-store'})"),'Verificação de atualização precisa buscar versão online');
assert.ok(sw.includes('new URL(relative, self.registration.scope)'),'URLs offline devem respeitar o escopo');
assert.ok(sw.includes('event.request') || sw.includes('const request = event.request'),'Roteamento de recursos ausente');
assert.ok(!sw.includes("'.'+url.pathname"),'Não reintroduzir caminhos quebrados por subpastas');

const match=sw.match(/const APP_FILES = (\[[^\n]+\]);/);
assert.ok(match,'Lista de precache ausente');
const items=[...match[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
assert.deepEqual(items,['./','./index.html','./clara-simple.css','./clara-simple.js','./manifest.webmanifest','./version.json','./assets/icon-192.png','./assets/icon-512.png']);
for(const path of items.filter(p=>p!=='./'))await stat(new URL(path,dist));
for(const icon of manifest.icons)await stat(new URL(icon.src,dist));
const refs=[...html.matchAll(/<(?:link|script|img|source)\b[^>]*>/gi)]
 .flatMap(x=>[...x[0].matchAll(/(?:href|src)=(["'])(.*?)\1/g)].map(m=>m[2]));
for(const ref of refs.filter(s=>s.startsWith('./'))){
  const base=ref.split(/[?#]/)[0];
  assert.ok(!base.includes('..'),'Referência fora da pasta: '+ref);
  await stat(new URL(base,dist));
}
const syntheticHash=createHash('sha256').update(pkg.version+'\n');
for(const path of files){
  syntheticHash.update(path+'\n');
  const b=await get(root,path);
  syntheticHash.update(path==='index.html'?Buffer.concat([b,Buffer.from('\n<!-- alteração de referência -->')]):b);
}
syntheticHash.update('sw.js\n');syntheticHash.update(await get(root,'sw.js'));
assert.notEqual(syntheticHash.digest('hex').slice(0,16),revision,'Hash não muda quando os recursos mudam');
console.log('QA DE CAMINHOS OK | versão',pkg.version,'| cache',expected,'| arquivos',files.length,'| referências HTML',refs.length,'| pre-cache',items.length);
