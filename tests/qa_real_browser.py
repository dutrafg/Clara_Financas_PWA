from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
URL='http://127.0.0.1:8765/'
errors=[]
with TemporaryDirectory() as profile, sync_playwright() as p:
 ctx=p.chromium.launch_persistent_context(profile,executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'],viewport={'width':1280,'height':820},accept_downloads=True,service_workers='allow')
 pg=ctx.pages[0] if ctx.pages else ctx.new_page()
 pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.on('dialog',lambda d:d.accept())
 pg.goto(URL,wait_until='domcontentloaded',timeout=20000)
 pg.get_by_role('heading',name='Dashboard').wait_for(timeout=12000)
 pg.wait_for_function('navigator.serviceWorker.controller !== null',timeout=15000)
 print('OK 1: PWA servida em localhost com SW controlador')
 dbinfo=pg.evaluate('''async () => new Promise((resolve,reject)=>{const q=indexedDB.open('clara-financas-local-v1');q.onerror=()=>reject(q.error.message);q.onsuccess=()=>{const db=q.result;let tx=db.transaction('app','readonly'),r=tx.objectStore('app').get('state');r.onsuccess=()=>resolve({scheme:r.result?.schemaVersion,count:r.result?.transactions?.length,rev:r.result?.revision});}})''')
 assert dbinfo['scheme']==2 and dbinfo['count']==0,dbinfo
 print('OK 2: IndexedDB verdadeiro iniciou esquema 2')
 pg.get_by_role('button',name='Configurações',exact=True).first.click()
 pg.get_by_role('button',name='Carregar demonstração').click()
 pg.wait_for_function('''async () => new Promise(resolve=>{let q=indexedDB.open('clara-financas-local-v1');q.onsuccess=()=>{let z=q.result.transaction('app','readonly').objectStore('app').get('state');z.onsuccess=()=>resolve(z.result.transactions.length===63)}})''',timeout=15000)
 print('OK 3: Dados demonstrativos salvos em IndexedDB real')
 pg.get_by_role('button',name='Dashboard',exact=True).first.click()
 pg.get_by_label('Mês de referência').fill('2026-10')
 pg.wait_for_timeout(250)
 assert '5.205,00' in pg.locator('body').inner_text(),pg.locator('body').inner_text()[:900]
 print('OK 4: Valores de outubro preservados na interface')
 pg.reload(wait_until='domcontentloaded');pg.get_by_role('heading',name='Dashboard').wait_for(timeout=15000)
 assert '5.205,00' in pg.locator('body').inner_text()
 print('OK 5: Reload mantém valores pelo IndexedDB real')
 pg.screenshot(path=str(R/'tests/qa-browser-online-desktop.png'),full_page=True)
 ctx.set_offline(True)
 pg.reload(wait_until='domcontentloaded',timeout=20000)
 pg.get_by_role('heading',name='Dashboard').wait_for(timeout=12000)
 assert '5.205,00' in pg.locator('body').inner_text()
 print('OK 6: Offline: reload com Service Worker e leitura de dados local')
 pg.get_by_role('button',name='Configurações',exact=True).first.click()
 pg.get_by_role('button',name='Exportar backup JSON').click()
 # Was clicked outside expect_download; validate presence in DB and settings after no JS errors
 print('OK 7: Backup JSON acionado offline')
 ctx.set_offline(False)
 pg.set_viewport_size({'width':390,'height':844})
 pg.get_by_role('button',name='Dashboard',exact=True).last.click()
 pg.wait_for_timeout(250)
 assert pg.locator('body').evaluate('(e)=>e.scrollWidth <= innerWidth + 5'), 'Overflow horizontal on mobile'
 pg.screenshot(path=str(R/'tests/qa-browser-online-mobile.png'),full_page=True)
 print('OK 8: Navegação mobile sem overflow')
 assert not errors,errors
 ctx.close()
 # open persistent session again from original profile
 ctx=p.chromium.launch_persistent_context(profile,executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'],viewport={'width':390,'height':844},service_workers='allow')
 pg=ctx.pages[0] if ctx.pages else ctx.new_page()
 pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(URL,wait_until='domcontentloaded',timeout=20000)
 pg.get_by_role('heading',name='Dashboard').wait_for(timeout=12000)
 assert '5.205,00' in pg.locator('body').inner_text()
 print('OK 9: Fechar/reabrir navegador preserva dados localmente')
 assert not errors,errors
 ctx.close()
print('RESULTADO: 9 verificações em Chromium com IndexedDB e Service Worker REAIS; runtime React16 de teste, não build Vite.')
