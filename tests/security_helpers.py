"""Autenticação sintética do cofre: nunca usar senha real nos testes."""
from playwright.async_api import Page

QA_PASSWORD = 'TesteForteLocal#2026!'

async def unlock_clara(page: Page):
    await page.locator('#securityCover').wait_for(state='visible', timeout=15000)
    title = await page.locator('#securityTitle').inner_text()
    await page.locator('#securityPassword').fill(QA_PASSWORD)
    if 'Criar' in title:
        await page.locator('#securityConfirm').fill(QA_PASSWORD)
    await page.locator('#securitySubmit').click()
    await page.locator('#securityCover').wait_for(state='hidden', timeout=20000)
    assert await page.evaluate("document.documentElement.dataset.unlocked")=='true'
    assert await page.evaluate("localStorage.getItem('clara-html-preview-planilha-optio-v2')===null")

async def flush_clara(page: Page):
    await page.evaluate("window.ClaraSecurity.flush()")
