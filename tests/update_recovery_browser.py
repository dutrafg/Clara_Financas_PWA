"""QA de recuperação do atualizador preso e efeito de vidro nos botões.

Usa cofre de teste em contexto isolado. Não limpa dados de produção.
"""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

URL='http://127.0.0.1:8765/'
VERSION_FILE=Path('dist/version.json')

async def unlock(page):
    if await page.locator('#securityCover').is_visible():
        await page.locator('#securityPassword').fill('Clara-QA-Senha-2026!')
        if await page.locator('#securityConfirmWrap').is_visible():
            await page.locator('#securityConfirm').fill('Clara-QA-Senha-2026!')
        await page.locator('#securitySubmit').click()
        await page.wait_for_function("document.documentElement.dataset.unlocked==='true'",timeout=30000)

async def run():
    original=VERSION_FILE.read_text(encoding='utf-8')
    async with async_playwright() as playwright:
        browser=await playwright.chromium.launch(headless=True)
        try:
            for width in (390,768,1440):
                context=await browser.new_context(viewport={'width':width,'height':844})
                page=await context.new_page()
                errors=[]
                page.on('pageerror',lambda err:errors.append(str(err)))
                await page.goto(URL,wait_until='load')
                await unlock(page)
                await page.wait_for_function("navigator.serviceWorker.controller!==null",timeout=30000)
                surfaces=await page.evaluate("""() => {
                    const names=['btn primary','btn','clara-simple-action primary','clx-add','ca-primary'];
                    return names.map(name=>{
                        const button=document.createElement('button');
                        button.className=name;
                        button.textContent='Teste visual';
                        document.body.append(button);
                        const s=getComputedStyle(button);
                        const result={name,filter:s.backdropFilter,bg:s.backgroundColor,
                            outline:s.outlineStyle};
                        button.remove();
                        return result;
                    });
                }""")
                assert all('blur(5px)' in s['filter'] for s in surfaces),surfaces
                assert any('0.8' in s['bg'] for s in surfaces),surfaces
                assert not errors,errors
                await context.close()
            context=await browser.new_context(viewport={'width':390,'height':844})
            page=await context.new_page()
            errors=[]
            page.on('pageerror',lambda exc:errors.append(str(exc)))
            await page.goto(URL,wait_until='load')
            await unlock(page)
            await page.wait_for_function("navigator.serviceWorker.controller!==null",timeout=30000)
            meta=json.loads(original)
            meta['version']='99.9.9-rc'
            meta['notes']=['Atualização de teste que simula uma requisição travada.']
            VERSION_FILE.write_text(json.dumps(meta),encoding='utf-8')
            before=await page.evaluate("JSON.stringify(state)")
            await page.evaluate("""() => {
                // Um SW pode não responder ao update(). Reproduz o travamento.
                ServiceWorkerRegistration.prototype.update=function(){
                    return new Promise(()=>{});
                };
            }""")
            await page.evaluate("window.ClaraUpdate.check(true)")
            result=await page.evaluate("""() => ({
                status:window.ClaraUpdate.status,
                remote:window.ClaraUpdate.remoteVersion,
                label:document.querySelector('#claraUpdateNoticeInstall').textContent,
                disabled:document.querySelector('#claraUpdateNoticeInstall').disabled,
                busy:document.querySelector('#claraUpdateNoticeInstall').getAttribute('aria-busy'),
                cacheCleared:!document.querySelector('#claraUpdateNotice')
            })""")
            assert result['remote']=='99.9.9-rc',result
            assert result['status']=='Falha ao preparar',result
            assert result['label']=='Tentar novamente' and not result['disabled'],result
            assert result['busy']=='false',result
            assert await page.evaluate("JSON.stringify(state)")==before
            assert not errors,errors
            await context.close()
            print('QA ATUALIZADOR RECUPERÁVEL OK: timeout, retentativa, cofre preservado; botões 390/768/1440.')
        finally:
            VERSION_FILE.write_text(original,encoding='utf-8')
            await browser.close()

asyncio.run(run())
