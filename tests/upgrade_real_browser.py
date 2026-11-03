"""QA real do atualizador v2: release instalado -> release seguinte -> offline."""
import asyncio
import json
import shutil
from pathlib import Path

from playwright.async_api import async_playwright

ROOT=Path("qa-upgrade")
ORIGINAL=ROOT/"old"/"dist"
NEXT=ROOT/"next"/"dist"
LIVE=ROOT/"site"
URL="http://127.0.0.1:8767/"
PASSWORD="Clara-Upgrade-V2-QA-2026!"

async def unlock(page):
    cover=page.locator("#securityCover")
    if await cover.is_visible():
        await page.locator("#securityPassword").fill(PASSWORD)
        if await page.locator("#securityConfirmWrap").is_visible():
            await page.locator("#securityConfirm").fill(PASSWORD)
        await page.locator("#securitySubmit").click()
        await page.wait_for_function("window.ClaraSecurity?.unlocked === true",timeout=30000)

def switch_to(directory):
    link=ROOT/"releasing"
    if link.exists() or link.is_symlink():
        link.unlink()
    link.symlink_to(directory.resolve(),target_is_directory=True)
    link.replace(LIVE)

async def main():
    before=json.loads((ORIGINAL/"version.json").read_text())
    after=json.loads((NEXT/"version.json").read_text())
    assert before["cache"] != after["cache"],"Nova versão precisa ter revisão distinta"
    assert before["version"] != after["version"],"Exige evolução de versão"
    if LIVE.is_symlink():LIVE.unlink()
    elif LIVE.exists():shutil.rmtree(LIVE)
    LIVE.symlink_to(ORIGINAL.resolve(),target_is_directory=True)

    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True)
        context=await browser.new_context(viewport={"width":390,"height":844})
        page=await context.new_page()
        errors=[]
        page.on("pageerror",lambda e:errors.append(str(e)))
        try:
            await page.goto(URL,wait_until="load")
            await unlock(page)
            await page.wait_for_function(
                "navigator.serviceWorker.controller!==null",timeout=30000)
            assert await page.evaluate("CLARA_APP_VERSION")==before["version"]
            await page.evaluate("""async () => {
                state.accounts[0].openingCents=81234;
                const date=todayISO();
                state.transactions=[{
                    id:'v2-upgrade-kept',date,paidAt:date,description:'Dados preservados',
                    kind:'Despesa',category:'Moradia',status:'Realizado',
                    amountCents:1234,accountId:state.accounts[0].id,toAccountId:''
                }];
                save();
                await ClaraSecurity.flush();
            }""")
            original=await page.evaluate("""() => {
                const vault=localStorage.getItem('clara-financas-vault-aesgcm-v1');
                return {
                    cents:state.transactions[0].amountCents,
                    balance:accountBalance(state.accounts[0].id,todayISO()),
                    encrypted:!!vault&&!vault.includes('Dados preservados')
                };
            }""")
            assert original=={"cents":1234,"balance":80000,"encrypted":True},original
            # A primeira checagem/registro precisa terminar antes do deploy.
            # Caso contrário, duas buscas de sw.js disputam a instalação.
            await page.evaluate("window.ClaraUpdate.check(false)")
            await page.wait_for_function(
                "window.ClaraUpdate.status==='Atualizado'",timeout=30000)
            await page.evaluate("""async () => {
                const r=await navigator.serviceWorker.ready;
                if(r.installing||r.waiting)throw Error('Instalação inicial inconclusa');
            }""")

            switch_to(NEXT)
            # Apenas um pedido do atualizador da revisão instalada.
            # A confirmação não pode ocorrer até que o pacote esteja integral.
            await page.evaluate("window.ClaraUpdate.check(true)")
            await page.wait_for_function("""async version => {
                const r=await navigator.serviceWorker.getRegistration();
                return window.ClaraUpdate.remoteVersion===version
                    && window.ClaraUpdate.ready && !!r?.waiting;
            }""",arg=after["version"],timeout=45000)
            assert await page.evaluate("CLARA_APP_VERSION")==before["version"]
            assert await page.evaluate(
                "state.transactions[0].id==='v2-upgrade-kept'")

            messages=[]
            async def accept(dialog):
                messages.append(dialog.message)
                await dialog.accept()
            page.on("dialog",accept)
            snapshot=await page.evaluate("""async () => {
                const r=await navigator.serviceWorker.getRegistration();
                const keys=await caches.keys();
                return {
                    status:ClaraUpdate.status,ready:ClaraUpdate.ready,
                    waiting:r?.waiting?.state||null,
                    installing:r?.installing?.state||null,
                    active:r?.active?.state||null,
                    controller:!!navigator.serviceWorker.controller,
                    unlocked:window.ClaraSecurity?.unlocked,
                    modal:document.getElementById('modalBg')?.getAttribute('aria-hidden'),
                    names:keys,
                    version:ClaraUpdate.remoteVersion
                };
            }""")
            print('V2 UPGRADER SNAPSHOT',snapshot,flush=True)
            applied=await page.evaluate("window.ClaraUpdate.apply()")
            assert applied is True,{"applied":applied,"dialogs":messages,
                                   "status":await page.evaluate("window.ClaraUpdate.status")}
            await page.wait_for_function(
                "version=>typeof CLARA_APP_VERSION!=='undefined'&&CLARA_APP_VERSION===version",
                arg=after["version"],timeout=45000)
            await unlock(page)
            upgraded=await page.evaluate("""async () => {
                await ClaraSecurity.flush();
                const tx=state.transactions.find(t=>t.id==='v2-upgrade-kept');
                const vault=localStorage.getItem('clara-financas-vault-aesgcm-v1');
                return {
                    cents:tx?.amountCents,
                    balance:accountBalance(tx.accountId,todayISO()),
                    encrypted:!!vault&&!vault.includes('Dados preservados'),
                    cache:CLARA_BOOT_CACHE
                };
            }""")
            assert upgraded=={"cents":1234,"balance":80000,"encrypted":True,
                              "cache":after["cache"]},upgraded
            await page.wait_for_function("""async name => {
                const all=await caches.keys();
                if(!all.includes(name))return false;
                const meta=await caches.open('clara-v2-metadata');
                const response=await meta.match(new URL('./__clara_v2_state__',location.href));
                const state=response?await response.json():null;
                return state?.current===name&&state.confirmed===true&&!state.rolledBack;
            }""",arg=after["cache"],timeout=30000)

            await context.set_offline(True)
            offline=await context.new_page()
            offline_errors=[]
            offline.on("pageerror",lambda e:offline_errors.append(str(e)))
            await offline.goto(URL,wait_until="load")
            await unlock(offline)
            result=await offline.evaluate("""() => ({
                version:CLARA_APP_VERSION,
                cents:state.transactions.find(t=>t.id==='v2-upgrade-kept')?.amountCents,
                balance:accountBalance(state.accounts[0].id,todayISO())
            })""")
            assert result=={"version":after["version"],"cents":1234,
                            "balance":80000},result
            assert not errors,errors
            assert not offline_errors,offline_errors
            print("UPGRADE V2 OK:",before["version"],"→",after["version"],
                  "dados cifrados preservados, pacote confirmado e offline funcional")
        finally:
            await context.close()
            await browser.close()

asyncio.run(main())
