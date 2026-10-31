"""Offline testing artifact: bundles the same React TSX components against locally available React UMD.
Vite package build remains the production path; preview is for visual/interaction review only.
"""
import json,subprocess, pathlib, html
R=pathlib.Path(__file__).resolve().parents[1]
node_script=r'''const fs=require('fs');const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const src=process.argv[1];const dst=process.argv[2];let modules={};
for(const [id,file] of Object.entries({
 'src/App.tsx':'src/App.tsx',
 'src/components/icons.tsx':'src/components/icons.tsx',
 'src/domain/finance.ts':'src/domain/finance.ts',
 'src/domain/storage.ts':'src/domain/storage.ts',
 'src/legacy/core.mjs':'src/legacy/core.mjs',
 'src/legacy/db.mjs':'src/legacy/db.mjs'
})){
 const code=fs.readFileSync(src+'/'+file,'utf8');
 const out=ts.transpileModule(code,{fileName:file.replace(/\.mjs$/,'.ts'),compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 if(out.diagnostics?.length)throw new Error(JSON.stringify(out.diagnostics));
 modules[id]=out.outputText;
}
fs.writeFileSync(dst,JSON.stringify(modules),'utf8');'''
mod_path=R/'tools/.bundled.json'
subprocess.run(['node','-e',node_script,str(R),str(mod_path)],check=True)
mods=json.loads(mod_path.read_text())
react_dir=pathlib.Path('/opt/pyvenv/lib/python3.13/site-packages/nbclassic/static/components/react')
react=(react_dir/'react.production.min.js').read_text()
react_dom=(react_dir/'react-dom.production.min.js').read_text()
style=(R/'src/styles.css').read_text()
data=(R/'public/dados-demonstracao.json').read_text()
compat=(R/'tools/compat_hooks.js').read_text()
preview_db=(R/'tools/preview_indexeddb.js').read_text()
html_out=f'''<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Clara Finanças — Etapa 2 (prévia offline)</title><style>{style}</style></head><body><div id="root"></div><script>{react}</script><script>{react_dom}</script><script>
{compat}
{preview_db}
window.__claraDemoData={data};
var __originalFetch = window.fetch ? window.fetch.bind(window) : null;
window.fetch=function(input,init){{if(String(input).includes('dados-demonstracao.json'))return Promise.resolve(new Response(JSON.stringify(window.__claraDemoData),{{status:200,headers:{{'content-type':'application/json'}}}}));return __originalFetch?__originalFetch(input,init):Promise.reject(new Error('Sem conexão.'));}};
window.__claraModules={json.dumps(mods,ensure_ascii=False)};
(function(){{
 const cache={{}};
 function load(name){{
  if(name==='react')return window.React;
  if(name==='react-dom/client')return window.ReactDOM;
  if(cache[name])return cache[name].exports;
  const target=window.__claraModules[name];if(!target)throw new Error('Módulo não encontrado: '+name);
  const module={{exports:{{}}}};cache[name]=module;
  const resolve=(request)=>{{
    if(request==='react'||request==='react-dom/client')return load(request);
    let base=name.split('/');base.pop();for(let part of request.split('/')){{if(part==='.')continue;if(part==='..')base.pop();else base.push(part)}}
    const path=base.join('/');for(const candidate of [path,path+'.ts',path+'.tsx',path+'.mjs'])if(window.__claraModules[candidate])return load(candidate);
    throw new Error(name+' precisa de '+request);
  }};
  new Function('module','exports','require',target)(module,module.exports,resolve);return module.exports;
 }}
 try{{const App=load('src/App.tsx').default;window.ReactDOM.render(window.React.createElement(App),document.getElementById('root'));}}
 catch(err){{document.getElementById('root').innerHTML='<div class="boot-error"><h1>Erro ao abrir a prévia</h1><pre>'+String(err)+'</pre></div>';console.error(err)}}
}})();
</script></body></html>'''
out=R.parent/'Clara_Financas_Preview_Etapa_02_Android.html'
out.write_text(html_out,encoding='utf8')
print('PREVIEW',out,'bytes',out.stat().st_size)
