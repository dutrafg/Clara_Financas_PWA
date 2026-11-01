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
    for width,height in [(320,700),(360,780),(390,844),(430,932),(760,900),(768,1024),(1024,768),(1440,900),(1920,1080)]:
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
      # Revisão da dock/pílula: bordas constantes e enquadramento sem overflow.
      dock_geometry=await page.evaluate("""() => {
        const mobile=innerWidth<=760;
        const dock=document.querySelector(mobile?'.mobile-dock':'#claraDesktopDock');
        const style=getComputedStyle(dock), rect=dock.getBoundingClientRect();
        const links=[...dock.querySelectorAll('button')];
        return {display:style.display,clip:style.overflowX,radius:parseFloat(style.borderTopLeftRadius),
          left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,
          linkRadii:links.map(x=>parseFloat(getComputedStyle(x).borderTopLeftRadius)),
          documentWidth:document.documentElement.scrollWidth};
      }""")
      assert dock_geometry['radius']>=30,dock_geometry
      assert dock_geometry['clip']=='hidden',dock_geometry
      assert all(r>=14 for r in dock_geometry['linkRadii']),dock_geometry
      assert dock_geometry['left']>=-2 and dock_geometry['right']<=width+2,dock_geometry
      if width<=760:
        # Modo avançado: o menu deve bloquear a rolagem de fundo e ficar acima do sino.
        await page.locator('#floatTrigger').click()
        assert await page.locator('#floatMenu').get_attribute('aria-hidden')=='false'
        assert await page.locator('#floatTrigger').get_attribute('aria-expanded')=='true'
        overlay=await page.evaluate("""() => {
          const z=id=>Number(getComputedStyle(document.querySelector(id)).zIndex);
          return {menu:z('#floatMenu'),dock:z('.mobile-dock-wrap'),bell:z('#claraNotificationButton'),
                  body:document.body.classList.contains('clara-menu-open'),
                  overflow:getComputedStyle(document.body).overflowY};
        }""")
        assert overlay['body'] and overlay['overflow']=='hidden',overlay
        assert overlay['dock']>overlay['menu']>overlay['bell'],overlay
        # Ciclo de foco sem deixar a navegação de fundo capturar TAB.
        await page.keyboard.press('Shift+Tab')
        assert await page.evaluate("document.activeElement===document.querySelector('#mobileNav .navlink:last-child')")
        await page.keyboard.press('Tab')
        assert await page.evaluate("document.activeElement===document.querySelector('#mobileNav .navlink:first-child')")
        snapshots=await page.evaluate("""async () => {
          const menu=document.getElementById('mobileNav');
          const read=()=>{
            const st=getComputedStyle(menu),r=menu.getBoundingClientRect();
            return {radius:parseFloat(st.borderTopLeftRadius),clip:st.overflowX,
             left:r.left,right:r.right,bottom:r.bottom,bg:st.backgroundClip,animation:st.animationName};
          };
          const samples=[read()];
          await new Promise(resolve=>requestAnimationFrame(resolve));samples.push(read());
          await new Promise(resolve=>setTimeout(resolve,80));samples.push(read());
          await new Promise(resolve=>setTimeout(resolve,260));samples.push(read());
          return samples;
        }""")
        assert all(frame['radius']==22 and frame['clip']=='hidden' and frame['bg']=='padding-box' for frame in snapshots),snapshots
        assert all(frame['left']>=8 and frame['right']<=width-8 and frame['bottom']<=height for frame in snapshots),snapshots
        assert await page.locator('#mobileNav [data-view]').count()==7
        await page.keyboard.press('Escape')
        assert await page.locator('#floatMenu').get_attribute('aria-hidden')=='true'
        assert await page.locator('#floatTrigger').get_attribute('aria-expanded')=='false'
        assert not await page.evaluate("document.body.classList.contains('clara-menu-open')")
        assert await page.evaluate("document.activeElement.id")=='floatTrigger'
        await page.locator('#floatTrigger').click()
        await page.locator('#floatBackdrop').click(position={'x':3,'y':3},force=True)
        assert await page.locator('#floatMenu').get_attribute('aria-hidden')=='true'
        if width in (320,390):
          await page.screenshot(path=str(CAPTURES/f'studio-dock-{width}.png'),full_page=False)
      # Formulários bloqueiam o sino e a dock, sem permitir cliques por trás.
      await page.evaluate("modal('transaction')")
      modal_layers=await page.evaluate("""() => {
        const z=selector=>Number(getComputedStyle(document.querySelector(selector)).zIndex);
        return {modal:z('#modalBg'),bell:z('#claraNotificationButton'),
                dock:z('.mobile-dock-wrap'),toast:z('#toast')};
      }""")
      assert modal_layers['toast']>modal_layers['modal']>max(modal_layers['bell'],modal_layers['dock']),modal_layers
      assert await page.locator('#modalBg').get_attribute('aria-hidden')=='false'
      await page.evaluate("closeModal()")
      assert await page.locator('#modalBg').get_attribute('aria-hidden')=='true'
      # Atualizações ficam abaixo do sino no desktop, sem sobreposição dos controles.
      if width>760:
        notification_placement=await page.evaluate("""() => {
          const bell=document.getElementById('claraNotificationButton').getBoundingClientRect();
          const notice=document.getElementById('claraUpdateNotice').getBoundingClientRect();
          return {bellBottom:bell.bottom,noticeTop:notice.top};
        }""")
        assert notification_placement['noticeTop']>notification_placement['bellBottom'],notification_placement
      await page.emulate_media(reduced_motion='reduce')
      animation=await page.evaluate("""() => getComputedStyle(document.querySelector('.view.active')).animationName""")
      assert animation=='none',(width,animation)
      if width<=760:
        await page.locator('#floatTrigger').click()
        assert await page.evaluate("getComputedStyle(document.getElementById('mobileNav')).animationName")=='none'
        await page.keyboard.press('Escape')
      assert not errors,errors
      await ctx.close()
      print('CLARA STUDIO QA OK:',width,'px - light, dark, navigation, motion, overflow')
    await browser.close()

asyncio.run(run())
