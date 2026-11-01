"""Verifica no Chromium a recuperação integrada após falha de módulo crítico."""
import asyncio
import json
import re
from pathlib import Path
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:8765/'
PASSWORD = 'Clara-QA-Senha-2026!'
FILES = [Path('dist/sw.js'), Path('dist/version.json'), Path('dist/clara-updater.js'), Path('dist/index.html')]


async def main():
    originals = {path: path.read_text(encoding='utf-8') for path in FILES}
    expected_boot_error = 'Simulated critical updater module failure'
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(headless=True)
            context = await browser.new_context(viewport={'width': 390, 'height': 844})
            page = await context.new_page()
            await page.goto(BASE, wait_until='load')
            if await page.locator('#securityCover').is_visible():
                await page.locator('#securityPassword').fill(PASSWORD)
                if await page.locator('#securityConfirmWrap').is_visible():
                    await page.locator('#securityConfirm').fill(PASSWORD)
                await page.locator('#securitySubmit').click()
                await page.wait_for_function("document.documentElement.dataset.unlocked==='true'", timeout=30000)
            await page.wait_for_function('navigator.serviceWorker.controller !== null', timeout=30000)
            await page.wait_for_function("window.ClaraUpdate.status==='Atualizado'", timeout=30000)

            metadata = json.loads(originals[FILES[1]])
            metadata['version'] = '99.9.9-rc'
            metadata['notes'] = ['Falha de boot simulada para validar rollback.']
            FILES[1].write_text(json.dumps(metadata), encoding='utf-8')
            FILES[2].write_text(f"throw new Error('{expected_boot_error}');\n", encoding='utf-8')
            worker = originals[FILES[0]]
            current_name = re.search(r"const CACHE_NAME = '([^']+)'", worker).group(1)
            candidate_name = 'clara-financas-4-2-5-rc-qa-rollback'
            FILES[0].write_text(worker.replace(current_name, candidate_name, 1), encoding='utf-8')
            FILES[3].write_text(originals[FILES[3]].replace(current_name, candidate_name, 1), encoding='utf-8')

            page.on('dialog', lambda dialog: asyncio.create_task(dialog.accept()))
            await page.evaluate('window.ClaraUpdate.check(true)')
            await page.wait_for_function("window.ClaraUpdate.remoteVersion==='99.9.9-rc'", timeout=15000)
            await page.wait_for_function('navigator.serviceWorker.ready.then(registration => !!registration.waiting)', timeout=30000)
            await page.evaluate('window.ClaraUpdate.check(false)')
            await page.wait_for_function('window.ClaraUpdate.ready', timeout=10000)
            candidate_source = await page.evaluate("""async name => {
              const cache = await caches.open(name);
              return (await (await cache.match(new URL('./clara-updater.js', location.href))).text());
            }""", candidate_name)
            assert expected_boot_error in candidate_source, 'O pacote candidato precisa conter o módulo defeituoso simulado.'
            await page.locator('#claraUpdateNoticeInstall').click()

            await page.wait_for_function("""async () => {
              const stateCache = await caches.open('clara-update-system-v1');
              const stateResponse = await stateCache.match(new URL('./__clara_update_state__', location.href));
              if (!stateResponse) return false;
              const state = await stateResponse.json();
              if (!state.rolledBack) return false;
              const source = await (await fetch('./clara-updater.js')).text();
              return !source.includes('Simulated critical updater module failure') && !!window.ClaraUpdate;
            }""", timeout=45000)
            state = await page.evaluate("""async () => {
              const cache = await caches.open('clara-update-system-v1');
              return (await (await cache.match(new URL('./__clara_update_state__', location.href))).json());
            }""")
            assert state['rolledBack'] and state['previous'], state
            print('QA ROLLBACK DE BOOT OK: módulo crítico falhou, shell anterior voltou e o cache do candidato foi isolado.')
            await context.close()
            await browser.close()
    finally:
        for path, content in originals.items():
            path.write_text(content, encoding='utf-8')


asyncio.run(main())
