"""Clara 4.3.1: gestão clean de contas, cartões e limites em telas responsivas."""
import asyncio

from playwright.async_api import async_playwright

BASE = "http://127.0.0.1:8765/"
PASSWORD = "Clara-Gestao-Cartoes-2026!"


async def unlock(page):
    await page.goto(BASE, wait_until="load")
    await page.locator("#securityPassword").fill(PASSWORD)
    if await page.locator("#securityConfirmWrap").is_visible():
        await page.locator("#securityConfirm").fill(PASSWORD)
    await page.locator("#securitySubmit").click()
    await page.wait_for_function("window.ClaraSecurity.unlocked", timeout=30000)


async def run():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        try:
            for width, height in [(320, 700), (390, 844), (768, 1024), (1440, 900)]:
                context = await browser.new_context(
                    viewport={"width": width, "height": height},
                    timezone_id="America/Sao_Paulo",
                )
                page = await context.new_page()
                errors = []
                page.on("pageerror", lambda error: errors.append(str(error)))
                try:
                    await unlock(page)
                    await page.evaluate("() => {configTab='contas';go('ajustes');}")
                    root = page.locator("#view-ajustes .clara-accounts-manage")
                    assert await root.is_visible(), width
                    assert await root.locator(".clara-account-manage-section").count() == 2
                    assert await root.locator(".clara-account-manage-row").count() == 1
                    assert await root.locator(".clara-account-empty").is_visible()
                    assert await page.evaluate(
                        "document.documentElement.scrollWidth<=innerWidth+2"
                    ), width

                    # Cadastro de cartão diretamente do estado vazio.
                    await root.locator("[data-simple-new-card]").click()
                    assert await page.locator("#modalBg").is_visible()
                    assert await page.locator("#m_type").input_value() == "Cartão"
                    await page.locator("#m_name").fill("Cartão de QA")
                    await page.locator("#m_opening").fill("0,00")
                    await page.locator("#modalForm button[type=submit]").click()
                    await page.wait_for_function(
                        "state.accounts.some(a=>a.name==='Cartão de QA')"
                    )
                    assert await root.locator(".clara-account-empty").count() == 0
                    card = root.locator(".clara-account-manage-section").nth(1)
                    assert await card.locator(".clara-account-manage-row").count() == 1
                    assert await page.evaluate(
                        "state.accounts.find(a=>a.name==='Cartão de QA').type"
                    ) == "Cartão"

                    # Edição reutiliza o formulário e o ID originais.
                    card_id = await page.evaluate(
                        "state.accounts.find(a=>a.name==='Cartão de QA').id"
                    )
                    await card.locator("[data-edit-account]").click()
                    assert await page.locator("#m_type").input_value() == "Cartão"
                    await page.locator("#m_name").fill("Cartão renomeado")
                    await page.locator("#modalForm button[type=submit]").click()
                    await page.wait_for_function(
                        "state.accounts.some(a=>a.name==='Cartão renomeado')"
                    )
                    assert await page.evaluate(
                        "(id)=>state.accounts.find(a=>a.name==='Cartão renomeado').id===id",
                        card_id
                    )

                    # Contas e reservas são organizadas separadamente dos cartões.
                    await root.locator(".clara-account-manage-section").first.locator(
                        '[data-open="account"]'
                    ).click()
                    await page.locator("#m_name").fill("Reserva QA")
                    await page.locator("#m_type").select_option("Reserva")
                    await page.locator("#m_opening").fill("120,25")
                    await page.locator("#modalForm button[type=submit]").click()
                    await page.wait_for_function(
                        "state.accounts.some(a=>a.name==='Reserva QA')"
                    )
                    account_section = root.locator(".clara-account-manage-section").first
                    assert await account_section.locator(
                        ".clara-account-manage-row"
                    ).count() == 2
                    assert "Reserva QA" in await account_section.inner_text()
                    assert "Cartão renomeado" not in await account_section.inner_text()
                    assert await page.evaluate(
                        "document.documentElement.scrollWidth<=innerWidth+2"
                    ), width

                    # Lançamento vinculado não pode ser apagado com a conta.
                    await page.evaluate("""() => {
                        const account=state.accounts.find(a=>a.name==='Cartão renomeado');
                        const date=todayISO();
                        state.transactions.push({
                          id:'qa-card-linked',accountId:account.id,toAccountId:'',
                          kind:'Despesa',category:'Moradia',
                          description:'Fatura vinculada QA',amountCents:7351,
                          status:'Pendente',date,paidAt:''
                        });
                        save();
                    }""")
                    shown = await card.inner_text()
                    assert "73,51" in shown, (width, shown)
                    await card.locator("[data-del-account]").click()
                    await page.locator("#confirmModalBtn").click()
                    await page.wait_for_function(
                        "document.getElementById('toast').textContent.includes('vinculados')"
                    )
                    assert await page.evaluate(
                        "(id)=>state.accounts.some(a=>a.id===id)", card_id
                    )

                    # Edição dos limites mantém o mesmo mecanismo central.
                    await root.locator(".clara-account-limit-section summary").click()
                    field = root.locator(".clara-account-limit-grid .limit-input").first
                    category = await field.get_attribute("data-category")
                    await field.fill("432,10")
                    await root.locator("#saveLimits").click()
                    assert await page.evaluate(
                        "(name)=>state.categories.find(c=>c.group==='Despesa' && c.name===name).limitCents",
                        category
                    ) == 43210

                    # A opção de ocultação precisa proteger resumos e linhas.
                    await page.evaluate(
                        "() => {state.settings.hideValues=true;render();}"
                    )
                    assert "R$ ••••" in await root.inner_text(), width
                    assert await page.evaluate(
                        "document.documentElement.scrollWidth<=innerWidth+2"
                    ), width
                    assert not errors, (width, errors)
                    print(
                        f"GESTÃO CLEAN OK: {width}px; contas, cartão, edição, "
                        "exclusão protegida, limites e privacidade"
                    )
                finally:
                    await context.close()
        finally:
            await browser.close()


asyncio.run(run())
