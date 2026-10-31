"""QA do cadastro obrigatório, migração e persistência criptografada."""
import asyncio
from playwright.async_api import async_playwright

BASE='http://127.0.0.1:8765/'
PWD='Clara-QA-Senha-2026!'

async def main():
  async with async_playwright() as p:
    browser=await p.chromium.launch(headless=True)
    context=await browser.new_context(viewport={'width':390,'height':844})
    page=await context.new_page()
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    await page.goto(BASE,wait_until='load')
    assert await page.locator('#securityCover').is_visible()
    assert not await page.locator('.shell').is_visible()
    await page.evaluate("""() => {
      const legacy=structuredClone(state);
      legacy.accounts[0].openingCents=123456;
      legacy.transactions.push({
        id:'mig-qa',description:'QA-SEGREDO-NAO-PLAIN',
        kind:'Receita',category:'Salário',amountCents:9001,
        accountId:'principal',toAccountId:'',status:'Realizado',
        date:todayISO(),paidAt:todayISO()
      });
      localStorage.setItem('clara-html-preview-planilha-optio-v2',JSON.stringify(legacy));
    }""")
    await page.reload(wait_until='load')
    assert await page.locator('#securityCover').is_visible()
    await page.locator('#securityPassword').fill(PWD)
    await page.locator('#securityConfirm').fill(PWD)
    await page.locator('#securitySubmit').click()
    await page.wait_for_function("document.documentElement.dataset.unlocked==='true'",timeout=30000)
    saved=await page.evaluate("""() => ({
      plain:localStorage.getItem('clara-html-preview-planilha-optio-v2'),
      vault:localStorage.getItem('clara-financas-vault-aesgcm-v1'),
      record:state.transactions.find(t=>t.id==='mig-qa')
    })""")
    assert saved['plain'] is None,saved
    assert saved['vault'] and 'QA-SEGREDO-NAO-PLAIN' not in saved['vault']
    assert saved['record']['amountCents']==9001
    await page.reload(wait_until='load')
    assert await page.locator('#securityCover').is_visible()
    assert not await page.locator('.shell').is_visible()
    await page.locator('#securityPassword').fill('Senha-Incorreta-2026!')
    await page.locator('#securitySubmit').click()
    assert await page.locator('#securityCover').is_visible()
    await page.locator('#securityPassword').fill(PWD)
    await page.locator('#securitySubmit').click()
    await page.wait_for_function("document.documentElement.dataset.unlocked==='true'",timeout=30000)
    assert await page.evaluate("state.transactions.some(t=>t.id==='mig-qa')")
    await page.evaluate("""() => {state.accounts[0].openingCents=77777;save();}""")
    await page.evaluate('window.ClaraSecurity.flush()')
    await page.reload(wait_until='load')
    await page.locator('#securityPassword').fill(PWD)
    await page.locator('#securitySubmit').click()
    await page.wait_for_function("document.documentElement.dataset.unlocked==='true'",timeout=30000)
    assert await page.evaluate("state.accounts[0].openingCents===77777")
    assert not errors,errors
    print('COFRE APROVADO: senha, dados antigos migrados, criptografia e reabertura')
    await context.close()
    await browser.close()
asyncio.run(main())
