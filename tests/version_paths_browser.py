"""QA v2: paths relativos, cache imutável e navegação offline em subpasta."""
import asyncio
import json
import shutil
from pathlib import Path
from playwright.async_api import async_playwright

site=Path("qa-scope/preview/clara")
shutil.rmtree(Path("qa-scope"),ignore_errors=True)
site.parent.mkdir(parents=True,exist_ok=True)
shutil.copytree("dist",site)
BASE="http://127.0.0.1:8766/qa-scope/preview/clara/"
PASSWORD="Clara-Subpasta-QA-2026!"

async def unlock(page):
    if await page.locator("#securityCover").is_visible():
        await page.locator("#securityPassword").fill(PASSWORD)
        if await page.locator("#securityConfirmWrap").is_visible():
            await page.locator("#securityConfirm").fill(PASSWORD)
        await page.locator("#securitySubmit").click()
        await page.wait_for_function("ClaraSecurity.unlocked",timeout=30000)

async def run():
    meta=json.loads((site/"version.json").read_text())
    expected=meta["cache"]
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True)
        context=await browser.new_context(viewport={"width":390,"height":844})
        page=await context.new_page()
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        try:
            await page.goto(BASE,wait_until="load")
            await unlock(page)
            await page.wait_for_function("navigator.serviceWorker.controller!==null",timeout=30000)
            result=await page.evaluate("""async () => ({
                scope:(await navigator.serviceWorker.ready).scope,
                version:CLARA_APP_VERSION,
                bootCache:CLARA_BOOT_CACHE,
                caches:await caches.keys()
            })""")
            assert result["scope"]==BASE,result
            assert result["version"]==meta["version"],result
            assert result["bootCache"]==expected,result
            assert expected in result["caches"],result
            online=await page.evaluate("""async () => {
                const r=await fetch('./version.json?fresh=qa',{cache:'no-store'});
                return r.json();
            }""")
            assert online["cache"]==expected,online
            await context.set_offline(True)
            offline=await context.new_page()
            offline_errors=[]
            offline.on("pageerror",lambda e:offline_errors.append(str(e)))
            await offline.goto(BASE,wait_until="load")
            await unlock(offline)
            assert await offline.evaluate("CLARA_APP_VERSION")==meta["version"]
            assert await offline.evaluate("CLARA_BOOT_CACHE")==expected
            assert await offline.evaluate(
                "document.documentElement.dataset.unlocked==='true'")
            assert not errors,errors
            assert not offline_errors,offline_errors
            print("QA SUBPASTA V2 OK: paths relativos, versão online, shell e módulos offline.")
        finally:
            await context.close()
            await browser.close()

asyncio.run(run())
