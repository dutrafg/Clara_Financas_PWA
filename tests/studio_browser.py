"""QA Clara Studio 4.1: responsividade, modo claro/escuro, navegação e acabamento."""
import asyncio
import os
from pathlib import Path
from playwright.async_api import async_playwright

ROOT='http://127.0.0.1:8765/'
PASSWORD='Clara-Studio-QA-2026!'
CAPTURES=Path('/tmp/clara-studio-shots')
CAPTURES.mkdir(parents=True,exist_ok=True)

async def open_clara(page):
    failures=[]
    page.on('pageerror',lambda err:failures.append(str(err)))
    await page.goto(ROOT,wait_until='load')
    if await page.locator('#securityCover').is_visible():
        await page.locator('#securityPassword').fill(PASSWORD)
        if await page.locator('#securityConfirmWrap').is_visible():
            await page.locator('#securityConfirm').fill(PASSWORD)
        await page.locator('#securitySubmit').click()
        await page.wait_for_function("document.documentElement.dataset.unlocked==='true'",timeout=30000)
    await page.locator('#claraCalendar').wait_for(timeout=12000)
    return failures

async def run():
  async with async_playwright() as pw:
    browser=await pw.chromium.launch(headless=True)
    for width,height in [(320,700),(390,844),(768,1024),(1024,768),(1440,900),(1920,1080)]:
      ctx=await browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1)
      page=await ctx.new_page()
      errors=await open_clara(page)
      stats=await page.evaluate("""() => {
        const premium=[...document.styleSheets].some(s=>s.href?.endsWith('/clara-premium.css'));
        const main=document.querySelector('.main'),h=document.querySelector('#pageTitle');
        const balance=document.querySelector('.clara-balance'),desktop=document.querySelector('#claraDesktopDock');
        const panel=document.querySelector('#claraCalendar'),bell=document.querySelector('#claraNotificationButton');
        const d=document.documentElement;
        return {premium,sidebar:document.querySelectorAll('.sidebar,#sideNav').length,
          mobileMenu:!!document.getElementById('mobileNav'),
          title:parseFloat(getComputedStyle(h).fontSize),
          family:getComputedStyle(d).fontFamily,
          rounded:parseFloat(getComputedStyle(balance).borderTopLeftRadius),
          panelRounded:parseFloat(getComputedStyle(panel).borderTopLeftRadius),
          dockCount:desktop.querySelectorAll('[data-view]').length,
          dockVisible:desktop.getBoundingClientRect().height>0&&getComputedStyle(desktop).display!=='none',
          bellFixed:getComputedStyle(bell).position==='fixed',
          width:innerWidth,documentWidth:d.scrollWidth,
          mainWidth:main.getBoundingClientRect().width};
      }""")
      assert stats['premium'],stats
      assert stats['sidebar']==0 and stats['mobileMenu'],stats
      assert stats['rounded']>=20 and stats['panelRounded']>=19,stats
      assert stats['title']>=29,stats
      assert stats['dockCount']==8 and stats['dockVisible']==(width>760),stats
      assert stats['bellFixed'],stats
      assert stats['documentWidth']<=width+2,stats
      assert not errors,errors
      if width in (390,768,1440):
        await page.screenshot(path=str(CAPTURES/f'studio-light-{width}.png'),full_page=True)
      # Modo escuro e modo avançado são independentes dos dados e seguem o mesmo design.
      await page.evaluate("""() => {
        state.settings.theme='dark';
        state.settings.simpleMode=false;
        render();
      }""")
      assert await page.locator('html').get_attribute('data-theme')=='dark'
      assert await page.locator('html').get_attribute('data-simple')=='false'
      assert await page.locator('#claraCalendar').is_visible()
      assert await page.locator('#claraNotificationButton').is_visible()
      assert await page.locator('#claraDesktopDock [data-view]').count()==8
      if width in (390,1440):
        await page.screenshot(path=str(CAPTURES/f'studio-dark-advanced-{width}.png'),full_page=True)
      await page.emulate_media(reduced_motion='reduce')
      animation=await page.evaluate("""() => getComputedStyle(document.querySelector('.view.active')).animationName""")
      assert animation=='none',(width,animation)
      assert not errors,errors
      await ctx.close()
      print('CLARA STUDIO QA OK:',width,'px - light, dark, navigation, motion, overflow')
    await browser.close()

asyncio.run(run())
