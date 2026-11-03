"""Integração PWA: instalação 4.3.0-rc, upgrade 4.3.1-rc e cofre offline intacto.

Este teste é executado com dois builds reais, produzidos pelo workflow:
  qa-upgrade/old/dist/  (commit estável da main)
  dist/                 (candidato da branch atual)
Os arquivos servidos são trocados sem apagar cookies, OPFS, cache ou armazenamento.
"""
import asyncio
import json
import re
import shutil
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path("qa-upgrade")
OLD = ROOT / "old" / "dist"
SITE = ROOT / "site"
NEW = Path("dist")
BASE = "http://127.0.0.1:8767/"
PASSWORD = "Clara-QA-Upgrade-2026!"


def cache_name(path):
    worker = (path / "sw.js").read_text(encoding="utf-8")
    match = re.search(r"const CACHE_NAME = '([^']+)';", worker)
    assert match, "Service Worker sem cache nomeado"
    return match.group(1)


async def unlock(page):
    await page.locator("#securityCover").wait_for(state="visible", timeout=30000)
    await page.locator("#securityPassword").fill(PASSWORD)
    if await page.locator("#securityConfirmWrap").is_visible():
        await page.locator("#securityConfirm").fill(PASSWORD)
    await page.locator("#securitySubmit").click()
    await page.wait_for_function("window.ClaraSecurity?.unlocked === true", timeout=30000)


async def main():
    old_meta = json.loads((OLD / "version.json").read_text(encoding="utf-8"))
    new_meta = json.loads((NEW / "version.json").read_text(encoding="utf-8"))
    assert old_meta["version"] == "4.3.0-rc", old_meta["version"]
    assert new_meta["version"] == "4.3.1-rc", new_meta["version"]
    old_cache = cache_name(OLD)
    new_cache = cache_name(NEW)
    assert old_cache != new_cache, "Atualização precisa ter pacote e cache distintos"
    # O servidor de QA passa a apontar para um release imutável.
    # Nunca copiar arquivos de uma versão sobre a outra em funcionamento:
    # Vercel troca a revisão como pacote, não arquivo por arquivo.
    if SITE.is_symlink():
        SITE.unlink()
    elif SITE.exists():
        shutil.rmtree(SITE)
    SITE.symlink_to(OLD.resolve(), target_is_directory=True)

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 390, "height": 844},
            timezone_id="America/Sao_Paulo",
        )
        page = await context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        try:
            await page.goto(BASE, wait_until="load")
            await unlock(page)
            await page.wait_for_function(
                "navigator.serviceWorker.controller !== null", timeout=30000
            )
            await page.wait_for_function(
                "window.ClaraUpdate?.status === 'Atualizado'",timeout=30000
            )
            assert await page.evaluate("CLARA_APP_VERSION") == "4.3.0-rc"
            original = await page.evaluate("""async () => {
                const date=todayISO();
                state.accounts[0].openingCents=54321;
                state.transactions=[];
                state.transactions.push({
                    id:'upgrade-kept-transaction',
                    date,paidAt:date,description:'Conta preservada na atualização',
                    kind:'Despesa',category:'Moradia',amountCents:1227,
                    accountId:state.accounts[0].id,toAccountId:'',
                    status:'Realizado'
                });
                save();
                await window.ClaraSecurity.flush();
                const vault=localStorage.getItem('clara-financas-vault-aesgcm-v1');
                return {
                    id:state.accounts[0].id,
                    openingCents:state.accounts[0].openingCents,
                    amountCents:state.transactions.find(t=>t.id==='upgrade-kept-transaction').amountCents,
                    balance:accountBalance(state.accounts[0].id,date),
                    vaultPresent:!!vault,
                    encrypted:!vault.includes('Conta preservada na atualização'),
                    installedVersion:CLARA_APP_VERSION,
                    caches:await caches.keys()
                };
            }""")
            assert original["openingCents"] == 54321, original
            assert original["amountCents"] == 1227, original
            assert original["balance"] == 53094, original
            assert original["vaultPresent"] and original["encrypted"], original
            assert old_cache in original["caches"], original

            # Publicação atômica do build novo. O servidor resolve o link
            # somente por requisição, logo nunca observa um pacote parcial.
            candidate_link = ROOT / "candidate-ready"
            if candidate_link.exists() or candidate_link.is_symlink():
                candidate_link.unlink()
            candidate_link.symlink_to(NEW.resolve(), target_is_directory=True)
            candidate_link.replace(SITE)

            # Uma navegação antes do consentimento deve continuar na shell antiga.
            await page.reload(wait_until="load")
            await unlock(page)
            assert await page.evaluate("CLARA_APP_VERSION") == "4.3.0-rc", (
                "Shell mudou antes de instalar a atualização aprovada"
            )
            assert await page.evaluate(
                "state.transactions.some(t=>t.id==='upgrade-kept-transaction')"
            )

            # O usuário verifica explicitamente e aplica a atualização pela interface.
            await page.evaluate("() => {configTab='dados';go('ajustes');}")
            dialogs = []
            async def accept_dialog(dialog):
                dialogs.append(dialog.message)
                await dialog.accept()
            page.on("dialog", accept_dialog)
            await page.locator("#checkClaraUpdate").click()
            # Fazer uma única verificação pela UI evita uma segunda busca
            # concorrente que poderia substituir o worker aguardando.
            await page.wait_for_function("""async expected => {
                if(window.ClaraUpdate?.remoteVersion!=='4.3.1-rc' ||
                   !window.ClaraUpdate.ready)return false;
                const registration=await navigator.serviceWorker.ready;
                if(!registration.waiting)return false;
                const stage='clara-stage-'+expected.slice('clara-financas-'.length);
                const names=await caches.keys();
                if(!names.includes(stage))return false;
                const cache=await caches.open(stage);
                const response=await cache.match(new URL('./index.html',location.href));
                return !!response&&(await response.text()).includes("const CLARA_APP_VERSION='4.3.1-rc'");
            }""",arg=new_cache,timeout=45000)
            candidate = await page.evaluate("""async () => {
                const reg=await navigator.serviceWorker.ready;
                return {
                    waiting:!!reg.waiting, active:reg.active?.state,
                    ready:window.ClaraUpdate.ready,
                    reopenReady:window.ClaraUpdate.reopenReady,
                    status:window.ClaraUpdate.status,
                    remoteVersion:window.ClaraUpdate.remoteVersion,
                    caches:await caches.keys()
                };
            }""")
            print('QA UPGRADE CANDIDATE',candidate,flush=True)

            # Confirmar o resultado do clique: não interpretar apenas troca de cache.
            await page.evaluate("""() => {
                const apply=window.ClaraUpdate.apply.bind(window.ClaraUpdate);
                window.__qaApplyPromise=null;
                window.ClaraUpdate.apply=()=>{
                    window.__qaApplyPromise=apply();
                    return window.__qaApplyPromise;
                };
            }""")
            await page.locator("#applyClaraUpdate").click()
            applied=await page.evaluate("window.__qaApplyPromise")
            assert applied is True, {
                'applied':applied,'candidate':candidate,'dialogs':dialogs,
                'status':await page.evaluate('window.ClaraUpdate?.status')
            }

            await page.wait_for_function(
                "typeof CLARA_APP_VERSION !== 'undefined' && CLARA_APP_VERSION === '4.3.1-rc'", timeout=45000
            )
            await unlock(page)
            upgraded = await page.evaluate("""async () => {
                const date=todayISO(),t=state.transactions.find(
                    t=>t.id==='upgrade-kept-transaction');
                await window.ClaraSecurity.flush();
                const vault=localStorage.getItem('clara-financas-vault-aesgcm-v1');
                return {
                    version:CLARA_APP_VERSION,
                    account:state.accounts.find(a=>a.id==='principal')?.openingCents,
                    accountId:t?.accountId,
                    amountCents:t?.amountCents,
                    balance:accountBalance(t?.accountId,date),
                    encrypted:!vault.includes('Conta preservada na atualização'),
                    caches:await caches.keys(),
                    controller:!!navigator.serviceWorker.controller
                };
            }""")
            assert upgraded["version"] == "4.3.1-rc", upgraded
            assert upgraded["accountId"] == original["id"], upgraded
            assert upgraded["account"] == original["openingCents"], upgraded
            assert upgraded["amountCents"] == original["amountCents"], upgraded
            assert upgraded["balance"] == original["balance"], upgraded
            assert upgraded["encrypted"] and upgraded["controller"], upgraded
            await page.wait_for_function(
                """async expected => {
                    const names=await caches.keys();
                    return names.includes(expected.newCache) &&
                        !names.includes(expected.oldCache);
                }""",
                arg={"newCache":new_cache, "oldCache":old_cache},
                timeout=30000
            )

            # Instalação atualizada continua utilizável quando não existe rede.
            await context.set_offline(True)
            offline = await context.new_page()
            offline_errors = []
            offline.on("pageerror", lambda error: offline_errors.append(str(error)))
            await offline.goto(BASE, wait_until="load")
            await unlock(offline)
            saved_offline = await offline.evaluate("""() => {
                const t=state.transactions.find(t=>t.id==='upgrade-kept-transaction');
                return {
                    version:CLARA_APP_VERSION,
                    account:state.accounts[0].openingCents,
                    cents:t?.amountCents,
                    balance:accountBalance(t?.accountId,todayISO()),
                    encrypted:!localStorage.getItem(
                        'clara-financas-vault-aesgcm-v1'
                    ).includes('Conta preservada na atualização')
                };
            }""")
            assert saved_offline == {
                "version": "4.3.1-rc",
                "account": 54321,
                "cents": 1227,
                "balance": 53094,
                "encrypted": True
            }, saved_offline
            assert not errors, errors
            assert not offline_errors, offline_errors
            print("QA UPGRADE REAL OK: 4.3.0-rc -> 4.3.1-rc; cofre preservado, "
                  "centavos exatos, SW atualizado e navegação offline.")
        finally:
            await context.close()
            await browser.close()


asyncio.run(main())
