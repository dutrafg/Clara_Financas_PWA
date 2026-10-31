"""QA de caminhos relativos, migração de cache e PWA em uma subpasta simulada."""
import asyncio
import json
import re
import shutil
from pathlib import Path
from playwright.async_api import async_playwright

site = Path('qa-scope/preview/clara')
shutil.rmtree(Path('qa-scope'), ignore_errors=True)
site.parent.mkdir(parents=True, exist_ok=True)
shutil.copytree('dist', site)
BASE = 'http://127.0.0.1:8766/qa-scope/preview/clara/'

async def run():
  async with async_playwright() as p:
    browser=await p.chromium.launch(headless=True)
    context=await browser.new_context(viewport={'width':390,'height':844})
    page=await context.new_page()
    errors=[]
    page.on('pageerror',lambda exc:errors.append(str(exc)))
    await page.goto(BASE,wait_until='load')
    await page.wait_for_function('navigator.serviceWorker.controller !== null',timeout=20000)
    origin=await page.evaluate("""async () => {
      const r=await navigator.serviceWorker.ready;
      return {scope:r.scope,keys:await caches.keys(),
        start:new URL('./',location.href).href};
    }""")
    assert origin['scope']==BASE and origin['start']==BASE,origin
    assert len([key for key in origin['keys'] if key.startswith('clara-financas-')])==1,origin
    assert await page.locator('#dashboardMiniapps').count()==1

    meta=json.loads((site/'version.json').read_text())
    meta['version']='3.6.0-rc-qa-upgrade'
    (site/'version.json').write_text(json.dumps(meta))
    online=await page.evaluate("""async () => (await (await fetch('./version.json',{cache:'no-store'})).json()).version""")
    assert online=='3.6.0-rc-qa-upgrade',online
    original=(site/'index.html').read_text()
    (site/'index.html').write_text(original.replace('</head>','<!-- qa-version-two -->\n</head>',1))
    old_sw=(site/'sw.js').read_text()
    old_name=re.search(r"const CACHE_NAME = '([^']+)';",old_sw).group(1)
    new_name='clara-financas-qa-upgrade-v2'
    assert new_name != old_name
    (site/'sw.js').write_text(old_sw.replace(old_name,new_name,1))
    await page.evaluate("""async () => {
      const registration=await navigator.serviceWorker.ready;
      await registration.update();
    }""")
    await page.wait_for_function("""async () => {
      const names=await caches.keys();
      return names.includes('clara-financas-qa-upgrade-v2') &&
        !names.some(key=>key.startsWith('clara-financas-')&&key!=='clara-financas-qa-upgrade-v2');
    }""",timeout=20000)
    snapshot=await page.evaluate("""async () => {
      const registration=await navigator.serviceWorker.ready;
      const cache=await caches.open('clara-financas-qa-upgrade-v2');
      const response=await cache.match(new URL('./index.html',location.href));
      return {active:registration.active?.state,
        marker:response? (await response.text()).includes('qa-version-two'):false};
    }""")
    assert snapshot['active']=='activated' and snapshot['marker'],snapshot
    # Nova navegação offline não deve usar documentos de um controlador antigo.
    await context.set_offline(True)
    new_page=await context.new_page()
    await new_page.goto(BASE,wait_until='load')
    assert 'qa-version-two' in await new_page.content(),'Nova navegação offline usa HTML obsoleto'
    assert await new_page.locator('#dashboardMiniapps').count()==1
    assert not errors,errors
    print('QA SUBPASTA/VERSÕES OK: escopo relativo, versão online, atualização SW, substituição de cache e HTML novo offline.')
    await context.close()
    await browser.close()

asyncio.run(run())
