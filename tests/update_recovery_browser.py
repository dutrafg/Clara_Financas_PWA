"""QA v2: falha de registro recuperável, cofre intacto e ação de nova tentativa."""
import asyncio
from playwright.async_api import async_playwright

BASE="http://127.0.0.1:8765/"
PASSWORD="Clara-Recuperacao-V2-2026!"

async def run():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True)
        try:
            for width,height in [(390,844),(768,1024),(1440,900)]:
                context=await browser.new_context(viewport={"width":width,"height":height})
                page=await context.new_page()
                errors=[]
                page.on("pageerror",lambda e:errors.append(str(e)))
                try:
                    await page.goto(BASE,wait_until="load")
                    await page.locator("#securityPassword").fill(PASSWORD)
                    if await page.locator("#securityConfirmWrap").is_visible():
                        await page.locator("#securityConfirm").fill(PASSWORD)
                    await page.locator("#securitySubmit").click()
                    await page.wait_for_function("ClaraSecurity.unlocked",timeout=30000)
                    await page.wait_for_function(
                        "navigator.serviceWorker.controller!==null",timeout=30000)
                    # A checagem inicial termina antes do cenário de rede travada.
                    await page.evaluate("ClaraUpdate.check(false)")
                    baseline=await page.evaluate("JSON.stringify(state)")
                    await page.evaluate("() => {configTab='dados';go('ajustes');}")
                    assert await page.locator("#applyClaraUpdate").count()==1
                    await page.evaluate("""() => {
                        const nativeFetch=window.fetch.bind(window);
                        window.fetch=(input,options)=>
                            String(input).includes('version.json?fresh=')
                            ?Promise.resolve(new Response(JSON.stringify({
                                version:'9.9.9-rc',
                                cache:'clara-v2-9-9-9-rc-qa-timeout',
                                notes:['Falha simulada de registro do pacote']
                            }),{status:200,headers:{'content-type':'application/json'}}))
                            :nativeFetch(input,options);
                        const nativeRegister=navigator.serviceWorker.register.bind(navigator.serviceWorker);
                        navigator.serviceWorker.register=(scriptURL,options)=>
                            String(scriptURL).includes('build=clara-v2-9-9-9-rc-qa-timeout')
                            ?Promise.reject(new Error('Falha simulada ao registrar pacote futuro'))
                            :nativeRegister(scriptURL,options);
                    }""")
                    result=await page.evaluate("ClaraUpdate.check(true)")
                    assert result is False
                    outcome=await page.evaluate("""() => ({
                        status:ClaraUpdate.status,
                        remote:ClaraUpdate.remoteVersion,
                        label:document.getElementById('applyClaraUpdate').textContent,
                        disabled:document.getElementById('applyClaraUpdate').disabled,
                        hidden:document.getElementById('applyClaraUpdate').hidden,
                        vault:JSON.stringify(state)
                    })""")
                    assert outcome["status"]=="Falha ao preparar",(width,outcome)
                    assert outcome["remote"]=="9.9.9-rc",outcome
                    assert outcome["label"]=="Tentar novamente",outcome
                    assert not outcome["disabled"] and not outcome["hidden"],outcome
                    assert outcome["vault"]==baseline,"Falha do updater não pode modificar dados"
                    assert not errors,errors
                    print(f"QA ATUALIZADOR V2 RECUPERÁVEL OK: {width}px, timeout, nova tentativa e cofre.")
                finally:
                    await context.close()
        finally:
            await browser.close()

asyncio.run(run())
