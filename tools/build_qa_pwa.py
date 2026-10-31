"""Build a browser QA harness using the offline React16 compatibility preview.
Does NOT replace the React19 + Vite production build. Uses *real* IndexedDB and SW.
"""
from pathlib import Path
import shutil
r=Path(__file__).resolve().parents[1]
src=r.parent/'Clara_Financas_Preview_Etapa_02_Android.html'
if not src.exists():
 import subprocess
 subprocess.run(['python',str(r/'tools/build_standalone.py')],check=True)
html=src.read_text()
stub=(r/'tools/preview_indexeddb.js').read_text()
assert stub in html, 'Preview simulator not found; refusing to ship simulated database as real'
html=html.replace(stub,'/* QA PWA: real IndexedDB */')
html=html.replace('<title>Clara Finanças — Etapa 2 (prévia offline)</title>', '<title>Clara Finanças — Testes com IndexedDB real</title><link rel="manifest" href="./manifest.webmanifest" />')
html=html.replace('</body></html>','<script>if("serviceWorker" in navigator && location.protocol!=="file:") navigator.serviceWorker.register("./sw.js").catch(console.warn);</script></body></html>')
qa=r/'qa-pwa'
qa.mkdir(exist_ok=True)
(qa/'index.html').write_text(html,encoding='utf-8')
for file in ['sw.js','manifest.webmanifest','dados-demonstracao.json']:
 shutil.copy(r/'public'/file,qa/file)
shutil.copytree(r/'public/assets',qa/'assets',dirs_exist_ok=True)
(qa/'LEIA-ME.txt').write_text('REVISOR DE QA - ATENÇÃO: Runtime React 16 de compatibilidade. Banco REAL IndexedDB e Service Worker real. Não é o build de produção React 19/Vite. Para testar: python -m http.server 8765 --directory qa-pwa; abra http://localhost:8765. Não use com dados financeiros reais.\n',encoding='utf-8')
print(qa, sum(p.stat().st_size for p in qa.rglob('*') if p.is_file()))
