import {mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = new URL('../',import.meta.url);
const dist = new URL('../dist/',import.meta.url);
const files = ['index.html','clara-simple.css','clara-simple.js','manifest.webmanifest','version.json','assets/icon-192.png','assets/icon-512.png'];
const file = name => new URL(name,root);
const load = async name => readFile(file(name));
const pkg=JSON.parse((await load('package.json')).toString('utf8'));
const meta=JSON.parse((await load('version.json')).toString('utf8'));
const manifest=JSON.parse((await load('manifest.webmanifest')).toString('utf8'));
const html=(await load('index.html')).toString('utf8');
const serviceWorker=(await load('sw.js')).toString('utf8');

if(pkg.version !== meta.version) throw Error('Versão divergente entre package.json e version.json');
if(!/^\d+\.\d+\.\d+(?:-[a-z\d.-]+)?$/.test(pkg.version)) throw Error('Versão inválida');
if(manifest.id !== './' || manifest.start_url !== './' || manifest.scope !== './')
  throw Error('Manifesto precisa usar rotas relativas à instalação (id/start_url/scope = ./)');
if(!html.includes('href="./manifest.webmanifest"') || !html.includes("serviceWorker.register('./sw.js',{updateViaCache:'none'})"))
  throw Error('Referências canônicas de manifesto e Service Worker ausentes');
if(!serviceWorker.includes("const CACHE_NAME = '__CLARA_CACHE_NAME__';"))
  throw Error('Service Worker não contém marcador de cache versionado');
if(!serviceWorker.includes('const APP_FILES = ')) throw Error('Pré-cache PWA ausente');

const localRef = path => {
  const trimmed=path.split(/[?#]/)[0];
  if(!trimmed || trimmed === './' || trimmed.startsWith('#')) return null;
  if(trimmed.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(trimmed)) return null;
  if(trimmed.startsWith('/')) throw Error('Caminho absoluto no aplicativo: '+path);
  if(!trimmed.startsWith('./')) throw Error('Caminho não relativo no aplicativo: '+path);
  const normalized=trimmed.slice(2);
  if(!normalized || normalized.includes('..') || normalized.includes('\\')) throw Error('Caminho inválido: '+path);
  return normalized;
};

const htmlRefTags=[...html.matchAll(/<(?:link|script|img|source)\b[^>]*>/gi)];
const htmlRefs=htmlRefTags.flatMap(x=>[...x[0].matchAll(/(?:href|src)=(["'])(.*?)\1/g)].map(m=>m[2]));
const manifestRefs=[manifest.id,manifest.start_url,manifest.scope,...(manifest.icons||[]).map(icon=>icon.src)];
const referenced=[...new Set([...htmlRefs,...manifestRefs].map(localRef).filter(Boolean))];
for(const ref of referenced) await load(ref);

const cacheHash=createHash('sha256');
cacheHash.update(pkg.version+'\n');
for(const name of files) {cacheHash.update(name+'\n');cacheHash.update(await load(name));}
// Mudanças apenas no motor do SW também forçam uma nova identidade de cache.
cacheHash.update('sw.js\n');cacheHash.update(await load('sw.js'));

const revision=cacheHash.digest('hex').slice(0,16);
const cacheName='clara-financas-'+pkg.version.replace(/[^a-z\d-]/gi,'-')+'-'+revision;

await rm(dist,{recursive:true,force:true});
await mkdir(new URL('./assets/',dist),{recursive:true});
for(const name of files) await writeFile(new URL(name,dist),await load(name));
await writeFile(new URL('sw.js',dist),serviceWorker.replace('__CLARA_CACHE_NAME__',cacheName));
console.log('Clara Finanças '+pkg.version+' | cache '+cacheName+' | arquivos verificados: '+files.length+' | referências: '+referenced.length+' | saída: '+fileURLToPath(dist));
