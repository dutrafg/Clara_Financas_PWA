/* Cache atômico do PWA, inspirado na estratégia de release completa do EvoluFísico2.
   Executado somente depois de compilar o Vite. Não armazena dados financeiros. */
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {createHash} from 'node:crypto';
const dist=new URL('../dist/',import.meta.url);
const walk=async folder=>{
 const children=await readdir(folder,{withFileTypes:true});
 let entries=[];
 for(const child of children){
  const path=join(folder,child.name);
  if(child.isDirectory())entries.push(...await walk(path));
  else if(child.isFile())entries.push(path);
 }
 return entries;
};
const path=dist.pathname;
const all=(await walk(path)).map(f=>relative(path,f).replaceAll('\\','/')).filter(f=>f!=='sw.js'&&!f.endsWith('.map')&&!f.startsWith('.'));
if(!all.includes('index.html')||!all.includes('manifest.webmanifest')||!all.some(x=>x.endsWith('.js'))||!all.some(x=>x.endsWith('.css')))
 throw Error('Build incompleta: index/manifest/javascript/css não encontrados.');
const hashes=[];
for(const file of all.sort()){
 const bytes=await readFile(join(path,file));
 hashes.push(file+':'+createHash('sha256').update(bytes).digest('hex').slice(0,14));
}
const fingerprint=createHash('sha256').update(hashes.join('|')).digest('hex').slice(0,16);
const manifest=all.map(x=>'./'+x);
const raw=await readFile(join(path,'sw.js'),'utf8');
if(!raw.includes('__CLARA_CACHE_RELEASE__')||!raw.includes('__CLARA_PRECACHE_ASSETS__'))
 throw Error('Service Worker não possui os marcadores de build necessários.');
const worker=raw.replaceAll('__CLARA_CACHE_RELEASE__','clara-shell-'+fingerprint)
 .replace('__CLARA_PRECACHE_ASSETS__',JSON.stringify(manifest));
await writeFile(join(path,'sw.js'),worker);
const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
await writeFile(join(path,'version.json'),JSON.stringify({app:'Clara Finanças',version:pkg.version,build:fingerprint,
 releaseAssets:manifest.length,channel:'homologacao'},null,2)+'\n');
console.log('PWA ready:',pkg.version,fingerprint,manifest.length,'arquivos no cache.');
