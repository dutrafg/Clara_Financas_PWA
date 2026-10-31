import asyncio
from playwright.async_api import async_playwright

async def run():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  for width in (390,768,1440):
   context=await browser.new_context(viewport={'width':width,'height':844})
   page=await context.new_page()
   errors=[]
   page.on('pageerror',lambda exc:errors.append(str(exc)))
   await page.goto('http://127.0.0.1:8765/',wait_until='load')
   await page.wait_for_function('navigator.serviceWorker.controller!==null',timeout=30000)
   state=await page.evaluate('({tx:state.transactions.length,acct:state.accounts.length,last:NAV.at(-1)[0]})')
   assert state=={'tx':0,'acct':1,'last':'ajustes'},state
   result=await page.evaluate('window.ClaraQA.run()')
   assert result['passed']==result['total'],[x for x in result['results'] if x['status']!='APROVADO']
   display=await page.locator('#floatTrigger').evaluate('(el)=>getComputedStyle(el).display')
   assert (display!='none')==(width<=760),(width,display)
   if width==390:
    await page.locator('#floatTrigger').click()
    assert await page.locator('#floatTrigger').get_attribute('aria-expanded')=='true'
    await page.locator('#mobileNav [data-view="ajustes"]').click()
    assert await page.locator('#pageTitle').inner_text()=='Configurações'

   # Contratos dos miniaplicativos: catálogo, editor, persistência e ações reais.
   if width==390:
    await page.goto('http://127.0.0.1:8765/',wait_until='load')
    assert await page.locator('#dashboardMiniapps [data-widget]').count()>=7
    await page.get_by_role('button',name='Editar painel').click()
    assert await page.locator('.clw-editor').count()==1
    await page.get_by_role('button',name='Mostrar todos').click()
    assert await page.locator('#dashboardMiniapps [data-widget]').count()==15
    await page.reload(wait_until='load')
    assert await page.locator('#dashboardMiniapps [data-widget]').count()==15
    # Base de teste isolada: criar um vencimento pendente e verificar baixa auditável.
    await page.evaluate("""() => {
      state.transactions.push({id:'qa-mini-1',description:'Conta de teste de miniaplicativo',
        kind:'Despesa',category:'Moradia',amountCents:12500,
        accountId:'principal',date:todayISO(),status:'Pendente',paidAt:''});
      save();
    }""")
    await page.locator('[data-widget="agenda"] [data-clw-action="pay"][data-clw-id="qa-mini-1"]').click()
    await page.locator('#confirmModalBtn').click()
    tx=await page.evaluate("() => state.transactions.find(t=>t.id==='qa-mini-1')")
    assert tx['status']=='Realizado' and tx['paidAt']==tx['date'],tx
    await page.locator('[data-widget="recent"] [data-clw-action="duplicate"][data-clw-id="qa-mini-1"]').click()
    assert await page.locator('#modalBg').get_attribute('aria-hidden')=='false'
    assert await page.locator('#m_description').input_value()=='Conta de teste de miniaplicativo'
    assert await page.evaluate("() => state.transactions.length")==1 # não duplica antes de salvar
    await page.locator('#closeModal').click()
    await page.get_by_role('button',name='Editar painel').click()
    await page.get_by_role('button',name='Ocultar').first.click()
    assert await page.locator('#dashboardMiniapps [data-widget]').count()==14
    assert not errors,errors
   assert not errors,errors
   await context.set_offline(True)
   await page.reload(wait_until='load')
   assert await page.locator('#pageTitle').is_visible()
   await context.close()
  await browser.close()

asyncio.run(run())
