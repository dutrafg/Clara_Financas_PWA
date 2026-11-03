"""Reproduce o ERR_FAILED do Chrome após perda de cache, sem apagar o cofre.
O cenário mantém o Service Worker registrado, simula perda de CacheStorage,
abre a instalação offline e volta à rede usando a mesma origem.
"""
import asyncio
from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:8765/"
PASSWORD = "Clara-Chrome-Cache-QA-2026!"

async def unlock(page):
    if await page.locator("#securityCover").is_visible():
        await page.locator("#securityPassword").fill(PASSWORD)
        if await page.locator("#securityConfirmWrap").is_visible():
            await page.locator("#securityConfirm").fill(PASSWORD)
        await page.locator("#securitySubmit").click()
        await page.wait_for_function("window.ClaraSecurity?.unlocked === true",timeout=30000)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            for width,height in [(390,844),(1440,900)]:
                context = await browser.new_context(viewport={"width":width,"height":height})
                page = await context.new_page()
                errors = []
                page.on("pageerror",lambda e:errors.append(str(e)))
                try:
                    await page.goto(BASE,wait_until="load")
                    await unlock(page)
                    await page.wait_for_function(
                        "navigator.serviceWorker.controller!==null",timeout=30000)
                    before = await page.evaluate("""async () => {
                        state.accounts[0].openingCents=80000;
                        state.transactions=[];
                        save();
                        await window.ClaraSecurity.flush();
                        localStorage.setItem('clara-qa-cache-eviction','preservado');
                        const keys=await caches.keys();
                        return {controller:!!navigator.serviceWorker.controller,
                            cacheCount:keys.length};
                    }""")
                    assert before["controller"] and before["cacheCount"]>0,before

                    # Simular descarte/corrupção dos caches. Não tocar no cofre.
                    await page.evaluate("""async () => {
                        const keys=await caches.keys();
                        await Promise.all(keys.map(k=>caches.delete(k)));
                    }""")
                    await context.set_offline(True)
                    damaged=await context.new_page()
                    response=await damaged.goto(BASE,wait_until="load",timeout=15000)
                    assert response and response.status==503,(width,response.status if response else None)
                    assert "Clara temporariamente indisponível" in await damaged.locator("body").inner_text()
                    assert await damaged.evaluate(
                        "localStorage.getItem('clara-qa-cache-eviction')")=="preservado"
                    assert "Não apague os dados" in await damaged.locator("body").inner_text()

                    # A página deve recuperar pela rede quando ela voltar,
                    # sem limpar os dados locais nem desinstalar o Service Worker.
                    await context.set_offline(False)
                    recovered=await context.new_page()
                    restored=await recovered.goto(BASE,wait_until="load",timeout=20000)
                    assert restored and restored.status==200,(width,restored.status if restored else None)
                    await unlock(recovered)
                    assert await recovered.evaluate(
                        "localStorage.getItem('clara-qa-cache-eviction')")=="preservado"
                    saved=await recovered.evaluate("""() => ({
                        version:CLARA_APP_VERSION,
                        cents:state.accounts[0].openingCents,
                        controller:!!navigator.serviceWorker.controller
                    })""")
                    assert saved["cents"]==80000 and saved["controller"],(width,saved)
                    assert not errors,errors
                    print(f"CHROME RECOVERY OK: {width}px; cache removido, resposta offline "
                          "503 amigável, retorno online e cofre preservado.")
                finally:
                    await context.close()
        finally:
            await browser.close()

asyncio.run(main())
