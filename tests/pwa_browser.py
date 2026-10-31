import asyncio
from playwright.async_api import async_playwright

async def unlock(page):
    if await page.locator('#securityCover').is_visible():
        await page.locator('#securityPassword').fill('Clara-QA-Senha-2026!')
        if await page.locator('#securityConfirmWrap').is_visible():
            await page.locator('#securityConfirm').fill('Clara-QA-Senha-2026!')
        await page.locator('#securitySubmit').click()
        await page.wait_for_function("document.documentElement.dataset.unlocked==='true'",timeout=30000)

async def run():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  for width in (390,768,1440):
   context=await browser.new_context(viewport={'width':width,'height':844})
   page=await context.new_page()
   errors=[]
   page.on('pageerror',lambda exc:errors.append(str(exc)))
   await page.goto('http://127.0.0.1:8765/',wait_until='load')
   await unlock(page)
   await page.wait_for_function('navigator.serviceWorker.controller!==null',timeout=30000)
   state=await page.evaluate('({tx:state.transactions.length,acct:state.accounts.length,last:NAV.at(-1)[0]})')
   assert state=={'tx':0,'acct':1,'last':'ajustes'},state
   result=await page.evaluate('window.ClaraQA.run()')
   assert result['passed']==result['total'],[x for x in result['results'] if x['status']!='APROVADO']
   display=await page.locator('#floatTrigger').evaluate('(el)=>getComputedStyle(el).display')
   assert (display!='none')==(width<=760),(width,display)
   if width==390:
    prev=await page.evaluate("""() => {
      const p=plusMonth(todayISO().slice(0,7)+'-01',-1).slice(0,7);
      state.transactions.push({id:'auditoria-qa',kind:'Receita',description:'Receita histórica QA',
        category:'Salário',amountCents:13000,accountId:'principal',toAccountId:'',
        date:p+'-12',paidAt:p+'-12',status:'Realizado'});
      save();return p;
    }""")
    await page.locator('#floatTrigger').click()
    await page.locator('#mobileNav [data-view="historico"]').click()
    assert await page.locator('#pageTitle').inner_text()=='Histórico financeiro'
    assert await page.locator('#historyMonth').input_value()==prev
    totals=await page.evaluate("""() => {
      const r=historicalSummary();
      return {income:r.income,net:r.net,period:state.settings.period,entries:r.entries.length};
    }""")
    assert totals['income']==13000 and totals['net']==13000 and totals['entries']==1,totals
    assert totals['period']!=prev
    assert await page.locator('#historyAccount option').count()>=2
    await page.locator('#historyPrev').click()
    assert await page.locator('#historyMonth').input_value()!=prev
    await page.locator('#floatTrigger').click()
    await page.locator('#mobileNav [data-view="painel"]').click()
    assert await page.evaluate("state.settings.period===todayISO().slice(0,7)")
    await page.evaluate("state.transactions=state.transactions.filter(t=>t.id!=='auditoria-qa');save()")
   if width==390:
    await page.locator('#floatTrigger').click()
    assert await page.locator('#floatTrigger').get_attribute('aria-expanded')=='true'
    await page.locator('#mobileNav [data-view="ajustes"]').click()
    assert await page.locator('#pageTitle').inner_text()=='Configurações'

    # A nova navegação usa pílula com quatro botões e bolha separada de Perfil.
    assert await page.locator('.mobile-dock-wrap').is_visible()
    assert await page.locator('.mobile-dock .dock-link').count()==3
    assert await page.locator('#profileFab').is_visible()
    assert await page.locator('#floatTrigger').get_attribute('aria-expanded')=='false'
    await page.locator('.mobile-dock [data-view="mov"]').click()
    assert await page.locator('#pageTitle').inner_text()=='Movimentações'
    await page.locator('#profileFab').click()
    assert await page.locator('#modalBg').get_attribute('data-kind')=='profile'
    await page.locator('#m_name').fill('Usuário de Validação')
    await page.locator('#m_email').fill('teste@exemplo.com')
    await page.locator('#m_phone').fill('(11) 99999-8888')
    # Foto JPEG gerada localmente e sem tráfego de rede.
    await page.locator('#m_photo').set_input_files({
      'name':'avatar.png','mimeType':'image/png',
      'buffer':__import__('base64').b64decode('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAALUlEQVR4nGM0rTjKQEvARFPTRy0YtWDUglELRi0YtWDUglELRi0YtWDUAioCABQJAbKyokn6AAAAAElFTkSuQmCC')
    })
    await page.wait_for_function("!!document.querySelector('#profilePreview img')",timeout=10000)
    await page.locator('#modalForm button[type="submit"]').click()
    assert await page.locator('#profileFab').get_attribute('aria-label')=='Abrir perfil de Usuário de Validação'
    profile=await page.evaluate("""() => ({
      p:state.profile, raw:localStorage.getItem('clara-financas-vault-aesgcm-v1')
    })""")
    assert profile['p']['name']=='Usuário de Validação' and profile['p']['photo'].startswith('data:image/jpeg;base64,')
    assert 'Usuário de Validação' not in profile['raw']
    await page.evaluate("window.ClaraSecurity.flush()")
    await page.reload(wait_until='load')
    await unlock(page)
    assert await page.evaluate("state.profile.name==='Usuário de Validação' && state.profile.photo.startsWith('data:image/jpeg;base64,')")
    await page.locator('#profileFab').click()
    await page.locator('#lockFromProfile').click()
    assert await page.locator('#securityCover').is_visible()
    await unlock(page)


   # Contratos dos miniaplicativos: catálogo, editor, persistência e ações reais.
   if width==390:
    await page.goto('http://127.0.0.1:8765/',wait_until='load')
    await unlock(page)
    assert await page.locator('#dashboardMiniapps [data-widget]').count()>=7
    await page.get_by_role('button',name='Editar painel').click()
    assert await page.locator('.clw-editor').count()==1
    await page.get_by_role('button',name='Mostrar todos').click()
    assert await page.locator('#dashboardMiniapps [data-widget]').count()==15
    await page.evaluate("window.ClaraSecurity.flush()")
    await page.reload(wait_until='load')
    await unlock(page)
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
   await page.evaluate("window.ClaraSecurity.flush()")
   await page.reload(wait_until='load')
   await unlock(page)
   assert await page.locator('#pageTitle').is_visible()
   await context.close()
  await browser.close()

asyncio.run(run())
