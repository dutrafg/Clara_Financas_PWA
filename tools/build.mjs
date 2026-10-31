import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);const dist=new URL('../dist/',import.meta.url);
await mkdir(new URL('./assets/',dist),{recursive:true});
for(const name of ['index.html','manifest.webmanifest','sw.js','version.json']) await writeFile(new URL(name,dist),await readFile(new URL(name,root)));
for(const size of [192,512]) await copyFile(new URL('assets/icon-'+size+'.png',root),new URL('assets/icon-'+size+'.png',dist));
console.log('RC3.5 PWA compilada em dist/.');
