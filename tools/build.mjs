import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for (const file of ['index.html','manifest.webmanifest','sw.js','version.json','icon.svg','icon-192.png','icon-512.png']) await copyFile(file, `dist/${file}`);
console.log('Clara Finanças RC3.5: dist/ preparado para Vercel.');
