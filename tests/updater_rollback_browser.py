"""QA v2: falha fatal de script na nova revisão provoca rollback ao build anterior."""
import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

BASE="http://127.0.0.1:8765/"
PASSWORD="Clara-Rollback-V2-2026!"
FILES=[Path("dist/sw.js"),Path("dist/version.json"),
       Path("dist/clara-updater.js"),Path("dist/index.html")]

async def run():
    original={path:path.read_text() for path in FILES}
    cache=json.loads(original[FILES[1]])["cache"]
    candidate="clara-v2-9-9-9-rc-qa-rollback"
    error="Simulated critical updater module failure"
    try:
        async with async_playwright() as p:
            browser=await p.chromium.launch(headless=True)
            context=await browser.new_context(viewport={"width":390,"height":844})
            page=await context.new_page()
            dialogs=[]
            async def accept(dialog):
                dialogs.append(dialog.message)
                await dialog.accept()
            page.on("dialog",accept)
            try:
                await page.goto(BASE,wait_until="load")
                await page.locator("#securityPassword").fill(PASSWORD)
                if await page.locator("#securityConfirmWrap").is_visible():
                    await page.locator("#securityConfirm").fill(PASSWORD)
                await page.locator("#securitySubmit").click()
                await page.wait_for_function("ClaraSecurity.unlocked",timeout=30000)
                await page.wait_for_function(
                    "navigator.serviceWorker.controller!==null",timeout=30000)
                await page.evaluate("ClaraUpdate.check(false)")
                previous=await page.evaluate("CLARA_BOOT_CACHE")
                assert previous==cache,previous
                await page.evaluate("""async () => {
                    state.accounts[0].openingCents=112233;
                    save();await ClaraSecurity.flush();
                }""")
                meta=json.loads(original[FILES[1]])
                meta["version"]="9.9.9-rc"
                meta["cache"]=candidate
                meta["notes"]=["Rollback de QA"]
                FILES[1].write_text(json.dumps(meta))
                FILES[2].write_text(f"throw new Error('{error}');\n")
                FILES[0].write_text(
                    original[FILES[0]].replace(f"const CACHE_NAME = '{cache}';",
                                                f"const CACHE_NAME = '{candidate}';",1))
                FILES[3].write_text(
                    original[FILES[3]].replace(
                        f"const CLARA_BOOT_CACHE='{cache}';",
                        f"const CLARA_BOOT_CACHE='{candidate}';",1).replace(
                        "const CLARA_APP_VERSION='4.4.1-rc';",
                        "const CLARA_APP_VERSION='9.9.9-rc';",1))
                # O próprio botão de atualização aciona registro e instalação.
                await page.evaluate("ClaraUpdate.check(true)")
                await page.wait_for_function("""() =>
                    ClaraUpdate.ready && !!navigator.serviceWorker.controller
                """,timeout=45000)
                result=await page.evaluate("ClaraUpdate.apply()")
                assert result is True,{"result":result,"dialogs":dialogs}
                await page.wait_for_function("""async (oldCache) => {
                    const keys=await caches.keys();
                    if(!keys.includes('clara-v2-metadata'))return false;
                    const cache=await caches.open('clara-v2-metadata');
                    const response=await cache.match(new URL('./__clara_v2_state__',location.href));
                    if(!response)return false;
                    const state=await response.json();
                    return state.rolledBack===true&&state.previous===oldCache;
                }""",arg=cache,timeout=60000)
                # Navegação posterior deve ser atendida pelo pacote anterior,
                # mesmo com o servidor contendo o script defeituoso.
                new_page=await context.new_page()
                await new_page.goto(BASE,wait_until="load")
                await new_page.wait_for_function(
                    "window.ClaraUpdate && typeof CLARA_BOOT_CACHE==='string'",timeout=20000)
                state=await new_page.evaluate("""() => ({
                    cache:CLARA_BOOT_CACHE,
                    version:CLARA_APP_VERSION,
                    hasUpdater:!!window.ClaraUpdate
                })""")
                assert state["cache"]==cache,state
                assert state["hasUpdater"],state
                assert error not in await new_page.content()
                print("QA ROLLBACK V2 OK: falha crítica da shell nova preservou pacote anterior.")
            finally:
                await context.close()
                await browser.close()
    finally:
        for path,content in original.items():
            path.write_text(content)

asyncio.run(run())
