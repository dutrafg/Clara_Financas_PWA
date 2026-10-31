"""Production acceptance: real Vite dist, real IndexedDB & service worker.
Run: npm install && npm run build && python tests/e2e_production.py
Raises on ANY failure. No simulated storage or mocked React runtime.
"""
from pathlib import Path
import http.server, socket, socketserver, threading
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT/'dist'
assert (DIST/'index.html').is_file(), 'Build ausente: execute npm run build'
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(DIST),**kwargs)
 def log_message(self,*args): pass
class ThreadingServer(socketserver.ThreadingTCPServer): allow_reuse_address=True

with ThreadingServer(('127.0.0.1',0),Handler) as srv:
 thread=threading.Thread(target=srv.serve_forever,daemon=True);thread.start()
 url=f'http://127.0.0.1:{srv.server_address[1]}/'
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True)
  ctx=browser.new_context(viewport={'width':1366,'height':900},accept_downloads=True,service_workers='allow')
  page=ctx.new_page();errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('dialog',lambda d:d.accept())
  page.goto(url,wait_until='domcontentloaded')
  page.get_by_role('heading',name='Dashboard').wait_for(timeout=15000)
  page.wait_for_function('navigator.serviceWorker.controller !== null',timeout=15000)
  assert page.evaluate('''() => !!navigator.serviceWorker.controller''')
  print('PASSOU: build, interface React, SW instalado')
  page.get_by_role('button',name='Configurações',exact=True).first.click()
  page.get_by_role('button',name='Carregar demonstração').click()
  page.wait_for_function('''async () => new Promise((resolve,reject)=>{const r=indexedDB.open('clara-financas-local-v1');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;const q=db.transaction('app','readonly').objectStore('app').get('state');q.onsuccess=()=>resolve(q.result?.transactions?.length===63);q.onerror=()=>reject(q.error)}})''')
  print('PASSOU: 63 registros gravados em IndexedDB real')
  page.get_by_role('button',name='Dashboard',exact=True).first.click()
  page.get_by_label('Mês de referência').fill('2026-10')
  page.get_by_text('R$ 5.205,00').first.wait_for(timeout=15000)
  page.screenshot(path=str(ROOT/'tests/e2e-desktop.png'),full_page=True)
  page.reload();page.get_by_text('R$ 5.205,00').first.wait_for(timeout=15000)
  print('PASSOU: valores preservados ao atualizar a página')
  ctx.set_offline(True)
  page.reload(wait_until='domcontentloaded',timeout=15000)
  page.get_by_text('R$ 5.205,00').first.wait_for(timeout=15000)
  page.get_by_role('button',name='Configurações',exact=True).first.click()
  with page.expect_download() as dl:
   page.get_by_role('button',name='Exportar backup JSON').click()
  assert dl.value.suggested_filename.endswith('.json')
  print('PASSOU: acesso offline e backup JSON offline')
  ctx.set_offline(False)
  page.set_viewport_size({'width':390,'height':844})
  page.get_by_role('button',name='Dashboard',exact=True).last.click()
  assert page.locator('body').evaluate('(el)=>el.scrollWidth <= innerWidth + 6')
  page.screenshot(path=str(ROOT/'tests/e2e-mobile.png'),full_page=True)
  assert not errors,errors
  print('PASSOU: navegação mobile, sem erros de JavaScript')
  browser.close()
 srv.shutdown()
print('ACEITE: execução end-to-end do build de produção concluída')
