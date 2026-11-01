"""Exercita erros de entrada e saída HTML com um cofre Chromium isolado."""
import asyncio
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:8765/'
PASSWORD = 'Clara-QA-Senha-2026!'
INVALID_AMOUNTS = ['', 'não é número', '1,001', '1e3', '0x10', '-1,00', '0', '10000000000,01']
XSS_DESCRIPTION = '<img src=x onerror="window.__qaXss=1">'


async def unlock(page):
    if await page.locator('#securityCover').is_visible():
        await page.locator('#securityPassword').fill(PASSWORD)
        if await page.locator('#securityConfirmWrap').is_visible():
            await page.locator('#securityConfirm').fill(PASSWORD)
        await page.locator('#securitySubmit').click()
        await page.wait_for_function("document.documentElement.dataset.unlocked==='true'", timeout=30000)


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 390, 'height': 844})
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto(BASE, wait_until='load')
        await unlock(page)
        initial_count = await page.evaluate('state.transactions.length')

        for amount in INVALID_AMOUNTS:
            await page.evaluate("modal('transaction')")
            await page.locator('#m_description').fill('Entrada inválida QA')
            await page.locator('#m_amount').fill(amount)
            await page.locator('#modalForm button[type=submit]').click()
            try:
                await page.wait_for_function("document.querySelector('#err_amount')?.textContent.trim()", timeout=3000)
            except Exception as error:
                actual = await page.locator('#m_amount').input_value()
                modal_kind = await page.locator('#modalBg').get_attribute('data-kind')
                raise AssertionError(f'Valor inválido sem erro de campo: {amount!r}; valor={actual!r}; modal={modal_kind!r}') from error
            assert await page.evaluate('state.transactions.length') == initial_count
            await page.locator('#closeModal').click()

        await page.evaluate("window.__qaXss=0;modal('transaction')")
        await page.locator('#m_description').fill(XSS_DESCRIPTION)
        await page.locator('#m_date').fill('2026-11-01')
        await page.locator('#m_account').select_option('principal')
        await page.locator('#m_category').select_option('Alimentação')
        await page.locator('#m_amount').fill('1.234,56')
        await page.locator('#m_kind').select_option('Despesa')
        await page.locator('#m_status').select_option('Pendente')
        await page.locator('#modalForm button[type=submit]').click()
        try:
            await page.wait_for_function('state.transactions.length === arg + 1', arg=initial_count, timeout=5000)
        except Exception as error:
            fields = await page.locator('#modalForm .field-error').all_inner_texts()
            raise AssertionError(f'Lançamento válido não foi salvo; erros={fields!r}') from error
        assert await page.evaluate("state.transactions.at(-1).amountCents") == 123456
        await page.evaluate("go('mov')")
        await page.wait_for_function("document.querySelector('#view-mov')?.textContent.includes('1.234,56')")
        assert await page.locator('#view-mov img[src="x"]').count() == 0
        assert await page.evaluate('window.__qaXss') == 0
        assert not errors, errors
        print(f'QA DE ENTRADAS OK: {len(INVALID_AMOUNTS)} valores inválidos rejeitados; valor limite válido e payload HTML inerte.')
        await context.close()
        await browser.close()


asyncio.run(main())
