"""Integration regression for the hosted application. Runs in GitHub Actions, not against file://."""
import http.server, socketserver, threading
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1] / 'dist'
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw): super().__init__(*a, directory=str(ROOT), **kw)
    def log_message(self, *a): pass
class HTTP(socketserver.ThreadingTCPServer):
    allow_reuse_address = True

with HTTP(('127.0.0.1', 0), Handler) as server:
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url=f'http://127.0.0.1:{server.server_address[1]}/'
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        context=browser.new_context(viewport={'width':390,'height':844}, service_workers='allow')
        page=context.new_page()
        errors=[]
        page.on('pageerror', lambda err: errors.append(str(err)))
        page.goto(url, wait_until='load')
        page.wait_for_function('navigator.serviceWorker.controller !== null', timeout=20000)
        assert page.evaluate('state.transactions.length') == 0
        assert page.evaluate('NAV.at(-1)[0]') == 'ajustes'
        assert page.locator('#mobileFab').is_visible()
        page.locator('#mobileFab').click()
        assert page.locator('#mobileMenuGrid [data-view]').count() == 6
        page.locator('#mobileMenuGrid [data-view=conf]').click()
        assert page.locator('#pageTitle').inner_text() == 'Conferências'
        assert page.locator('#mobileFab').get_attribute('aria-expanded') == 'false'
        run = page.evaluate('window.ClaraQA.run()')
        assert run['passed']==120, [(x['id'],x['message']) for x in run['results'] if x['status']!='APROVADO']
        page.evaluate("go('mov');state.transactions.push({id:'test_income',date:state.settings.cutoff,description:'Teste offline',category:'Salário',kind:'Receita',amountCents:12345,accountId:'principal',toAccountId:'',status:'Realizado',paidAt:state.settings.cutoff});save()")
        page.reload()
        assert page.evaluate('state.transactions.length') == 1
        context.set_offline(True)
        page.reload(wait_until='domcontentloaded')
        assert page.evaluate('state.transactions.length') == 1
        for key in ['painel','mov','plan','assist','conf','ajustes']:
            page.evaluate('(key)=>go(key)',key)
            assert page.locator('#pageTitle').inner_text()
        assert errors == [], errors
        context.close()
        browser.close()
print('PWA aprovado: Service Worker, offline, persistência, módulos e 120 testes')
