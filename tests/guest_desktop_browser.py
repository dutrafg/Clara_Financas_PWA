"""Clara 4.1.1: demonstração sem cofre + dock desktop centralizada à esquerda."""
import asyncio
from playwright.async_api import async_playwright

URL='http://127.0.0.1:8765/'
PASS='Senha-Exemplo-Longa-2026!'

async def run():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  for width,height in [(390,844),(768,1024),(1024,768),(1440,900),(1920,1080)]:
   context=await browser.new_context(viewport={'width':width,'height':height})
   page=await context.new_page()
   errors=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('dialog',lambda d:asyncio.create_task(d.accept()))
   await page.goto(URL,wait_until='load')
   await page.locator('#securityGuest').wait_for(state='visible',timeout=12000)
   assert await page.locator('#securityConfirmWrap').is_visible()
   assert await page.evaluate("window.ClaraSecurity.unlocked") is False
   await page.locator('#securityGuest').click()
   assert await page.evaluate("window.ClaraGuest.active") is True
   assert await page.locator('#securityCover').is_hidden()
   assert await page.locator('#claraGuestNotice').is_visible()
   assert await page.evaluate("state.transactions.length")>=4
   assert await page.evaluate("state.goals.length")>=1
   assert await page.locator('#claraCalendar').is_visible()
   await page.evaluate("go('mov')")
   assert await page.locator('#view-mov').is_visible()
   start=await page.evaluate("state.transactions.length")
   await page.locator('[data-open="transaction"]').first.click()
   assert await page.locator('#modalBg').is_hidden()
   assert await page.evaluate("state.transactions.length")==start
   await page.evaluate("""() => {
     try{save();return false}catch(error){return true}
   }""")
   assert await page.evaluate("window.ClaraSecurity.unlocked") is False
   vault=await page.evaluate("""() => ({
     exists:!!localStorage.getItem('clara-financas-vault-aesgcm-v1'),
     plaintext:!!localStorage.getItem('clara-financas-data'),
     keys:Object.keys(localStorage).filter(k=>k.includes('vault')||k.includes('data'))
   })""")
   assert not vault['exists'] and not vault['plaintext'],vault

   # Modo avançado também é navegável sem cadastrar dados.
   await page.evaluate("go('mais')")
   await page.locator('[data-mode-toggle="advanced"]').click()
   assert await page.evaluate("pref('simpleMode')") is False
   assert await page.locator('#claraExitAdvanced').is_visible()
   await page.locator('#claraExitAdvanced').click()
   assert await page.evaluate("pref('simpleMode')") is True

   dims=await page.evaluate("""() => {
     const dock=document.getElementById('claraDesktopDock');
     const wrap=document.querySelector('.mobile-dock-wrap');
     const main=document.querySelector('.main');
     const win=window.innerWidth;
     const d=dock.getBoundingClientRect(),w=wrap.getBoundingClientRect(),
           m=main.getBoundingClientRect();
     const c=getComputedStyle(wrap),dc=getComputedStyle(dock);
     return {viewport:win,mainLeft:m.left,mainRight:m.right,mainWidth:m.width,
       dockLeft:d.left,dockTop:w.top,dockHeight:w.height,
       dockRight:d.right,dockCenter:w.top+w.height/2,
       vCenter:innerHeight/2,dockFlow:dc.flexDirection,
       wrapFlow:c.flexDirection,
       overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
       dockVisible:d.width>0&&dc.display!=='none'};
   }""")
   assert dims['overflow']<=3,dims
   if width>=1024:
    assert dims['dockVisible'] and dims['dockFlow']=='column' and dims['wrapFlow']=='column',dims
    assert abs(dims['dockCenter']-dims['vCenter'])<=6,dims
    assert dims['dockLeft']<40 and dims['dockRight']<dims['mainLeft'],dims
    assert dims['mainRight']>=width-1 and dims['mainWidth']>=width-108,dims
    await page.locator('#claraDesktopDock [data-view="plan"]').click()
    assert await page.locator('#view-plan').is_visible()
   else:
    assert width==390 or width==768

   await page.locator('#claraGuestCreate').click()
   assert await page.locator('#securityCover').is_visible()
   assert await page.evaluate("window.ClaraGuest.active") is False
   assert await page.evaluate("state.transactions.length")==0
   assert await page.evaluate("state.goals.length")==0
   await page.locator('#securityPassword').fill(PASS)
   await page.locator('#securityConfirm').fill(PASS)
   await page.locator('#securitySubmit').click()
   await page.wait_for_function("window.ClaraSecurity.unlocked",timeout=15000)
   assert await page.evaluate("state.transactions.length")==0
   assert await page.evaluate("state.calendarEvents.length")==0
   assert await page.locator('#securityGuest').is_hidden()
   assert await page.evaluate("!!localStorage.getItem('clara-financas-vault-aesgcm-v1')")
   await page.reload(wait_until='load')
   assert await page.locator('#securityGuest').is_hidden()
   assert await page.locator('#securityCover').is_visible()
   assert not errors,errors
   print('DEMO & DOCK QA OK',width,'px')
   await context.close()
  await browser.close()

asyncio.run(run())
