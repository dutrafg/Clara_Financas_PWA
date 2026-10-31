from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
preview=R.parent/'Clara_Financas_Preview_Etapa_03_Android.html'
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-web-security'])
 page=browser.new_page(viewport={'width':390,'height':844},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('dialog',lambda d:d.accept())
 try:
  page.set_content(preview.read_text(encoding='utf8'),wait_until='load')
  page.get_by_role('heading',name='Dashboard').wait_for(timeout=15000)
  page.get_by_role('button',name='Movimentações',exact=True).last.click()
  page.get_by_role('button',name='Novo lançamento').click()
  page.locator('input[name="description"]').fill('Teste de conta mensal')
  page.locator('input[name="date"]').fill('2026-10-15')
  page.locator('select[name="status"]').select_option('Pendente')
  page.locator('select[name="category"]').select_option('Contas fixas')
  page.locator('input[name="amount"]').fill('149,90')
  page.locator('select[name="recurrence"]').select_option('monthly')
  page.locator('input[name="occurrences"]').fill('3')
  page.get_by_role('button',name='Salvar',exact=True).click()
  page.wait_for_timeout(500)
  page.get_by_text('Teste de conta mensal').first.wait_for(timeout=15000)
  page.get_by_role('button',name='Confirmar hoje').first.click()
  page.get_by_label('Filtrar tipo').select_option('Receita')
  assert page.get_by_text('Teste de conta mensal').count()==0
  page.get_by_label('Filtrar tipo').select_option('Despesa')
  page.get_by_text('Teste de conta mensal').first.wait_for(timeout=15000)
  assert not errors,errors
  page.screenshot(path=str(R/'tests/movements-stage3-mobile.png'),full_page=True)
  page.set_viewport_size({'width':1400,'height':900})
  page.screenshot(path=str(R/'tests/movements-stage3-desktop.png'),full_page=True)
  print('ETAPA 3: interface e recorrências aprovadas na prévia HTML')
 finally:browser.close()
