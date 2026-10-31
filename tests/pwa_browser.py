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
   assert not errors,errors
   await context.set_offline(True)
   await page.reload(wait_until='load')
   assert await page.locator('#pageTitle').is_visible()
   await context.close()
  await browser.close()

asyncio.run(run())
