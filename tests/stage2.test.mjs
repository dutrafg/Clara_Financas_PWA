import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('src/App.tsx'),main=read('src/main.tsx'),pkg=JSON.parse(read('package.json'));
let checks=0;function ok(label,test){assert.ok(test,label);checks++;console.log(`OK ${checks}: ${label}`)}
ok('React 19 declarado',pkg.dependencies.react?.startsWith('^19.'));
ok('React DOM e TypeScript presentes',!!pkg.dependencies['react-dom']&&!!pkg.devDependencies.typescript);
ok('Vite como processo oficial de build',pkg.scripts.build.includes('vite build')&&pkg.scripts.build.includes('tsc'));
ok('Componente inicial React TSX',main.includes('createRoot(')&&app.includes('export default function App'));
ok('Banco da Etapa 1 preservado',read('src/legacy/db.mjs').includes("clara-financas-local-v1"));
ok('Backup e validação legados preservados',read('src/legacy/core.mjs').includes('validateBackup'));
ok('Seis módulos disponíveis', ['dashboard','transactions','accounts','planning','reports','settings'].every(x=>app.includes(`id:'${x}'`)));
ok('Data efetiva e lançamento presentes',app.includes('effectiveDate')&&app.includes('paidAt'));
ok('Pasta local e recuperação presentes',app.includes('chooseFolder')&&app.includes('readFolderCopy'));
ok('Tema, privacidade e dados demo presentes',app.includes('hideValues')&&app.includes('Carregar demonstração'));
ok('Manifest e service worker disponíveis',read('public/manifest.webmanifest').includes('standalone')&&read('public/sw.js').includes('CACHE'));
ok('Fonte não publica dados em backend',!app.includes('https://api.clara-financas'));
console.log(`RESULTADO: ${checks} verificações de estrutura da Etapa 2`);
