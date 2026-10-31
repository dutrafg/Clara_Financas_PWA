"""Production acceptance: real Vite dist, real IndexedDB & service worker.
Run: npm install && npm run build && python tests/e2e_production.py
Raises on ANY failure. No simulated storage or mocked React runtime.
"""
from pathlib import Path
import http.server, socket, socketserver, threading
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT/'dist'
assert (DIST/'index.html').is_file(), 'Build ausente: execute npm run build'
class Handler(http.server.SimpleHTTPRequestHandler):
 def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(DIST),**kwargs)
 def log_message(self,*args): pass
class ThreadingServer(socketserver.ThreadingTCPServer): allow_reuse_address=True

with ThreadingServer(('127.0.0.1',0),Handler) as srv:
 thread=threading.Thread(target=srv.serve_forever,daemon=True);thread.start()
 url=f'http://127.0.0.1:{srv.server_address[1]}/'
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True)
  ctx=browser.new_context(viewport={'width':1366,'height':900},accept_downloads=True,service_workers='allow')
  page=ctx.new_page();errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('dialog',lambda d:d.accept())
  page.goto(url,wait_until='domcontentloaded')
  page.get_by_role('heading',name='Dashboard').wait_for(timeout=15000)
  page.wait_for_function('navigator.serviceWorker.controller !== null',timeout=15000)
  assert page.evaluate('''() => !!navigator.serviceWorker.controller''')
  print('PASSOU: build, interface React, SW instalado')
  page.get_by_role('button',name='Configurações',exact=True).first.click()
  page.get_by_role('button',name='Carregar demonstração').click()
  page.wait_for_function('''async () => new Promise((resolve,reject)=>{const r=indexedDB.open('clara-financas-local-v1');r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result;const q=db.transaction('app','readonly').objectStore('app').get('state');q.onsuccess=()=>resolve(q.result?.transactions?.length===63);q.onerror=()=>reject(q.error)}})''')
  print('PASSOU: 63 registros gravados em IndexedDB real')
  # Redesign visual: validar o modo grafite sem alterar as transações.
  page.get_by_label('Tema',exact=True).select_option('dark')
  page.wait_for_function("document.body.dataset.theme === 'dark'")
  page.get_by_role('button',name='Dashboard',exact=True).first.click()
  page.get_by_label('Mês de referência').fill('2026-10')
  page.get_by_text('R$ 5.205,00').first.wait_for(timeout=15000)
  page.locator('.clara-balance-hero').wait_for(timeout=15000)
  page.locator('.category-donut-figure svg').wait_for(timeout=15000)
  assert page.locator('.category-legend-row').count()>0
  page.screenshot(path=str(ROOT/'tests/e2e-desktop.png'),full_page=True)
  page.reload();page.get_by_text('R$ 5.205,00').first.wait_for(timeout=15000)
  print('PASSOU: valores preservados ao atualizar a página')
  ctx.set_offline(True)
  page.reload(wait_until='domcontentloaded',timeout=15000)
  page.get_by_text('R$ 5.205,00').first.wait_for(timeout=15000)
  page.get_by_role('button',name='Configurações',exact=True).first.click()
  with page.expect_download() as dl:
   page.get_by_role('button',name='Exportar JSON sem proteção').click()
  assert dl.value.suggested_filename.endswith('.json')
  print('PASSOU: acesso offline e backup JSON offline')
  ctx.set_offline(False)
  page.set_viewport_size({'width':390,'height':844})
  page.get_by_role('button',name='Dashboard',exact=True).last.click()
  assert page.locator('body').evaluate('(el)=>el.scrollWidth <= innerWidth + 6')
  page.screenshot(path=str(ROOT/'tests/e2e-mobile.png'),full_page=True)
  assert not errors,errors
  print('PASSOU: navegação mobile, sem erros de JavaScript')
  page.get_by_role('button',name='Planejamento',exact=True).last.click()
  page.get_by_role('button',name='12 meses',exact=True).click()
  page.get_by_role('heading',name='Projeção de fluxo de caixa · 12 meses').wait_for(timeout=15000)
  assert page.locator('.planning-table').last.locator('tbody tr').count()==12
  assert page.locator('body').evaluate('(el)=>el.scrollWidth <= innerWidth + 6')
  page.get_by_role('button',name='3 meses',exact=True).click()
  assert page.locator('.planning-table').last.locator('tbody tr').count()==3
  print('PASSOU: modo escuro, distribuição por categorias, projeção 3/12 meses e layout responsivo')
  # Etapa 3: exercício real de tela + persistência de recorrência.
  page.get_by_role('button',name='Movimentações',exact=True).last.click()
  page.get_by_role('button',name='Novo lançamento').click()
  page.locator('input[name="date"]').fill('2026-10-15')
  page.locator('select[name="status"]').select_option('Pendente')
  page.locator('input[name="description"]').fill('Conta de energia teste mensal')
  page.locator('input[name="amount"]').fill('145,50')
  page.locator('select[name="category"]').select_option('Contas fixas')
  page.locator('select[name="recurrence"]').select_option('monthly')
  page.locator('input[name="occurrences"]').fill('3')
  page.get_by_role('button',name='Salvar',exact=True).click()
  page.get_by_text('Conta de energia teste mensal').first.wait_for(timeout=15000)
  page.wait_for_function('''async () => new Promise(resolve => {const r=indexedDB.open('clara-financas-local-v1'); r.onsuccess=()=>{const q=r.result.transaction('app','readonly').objectStore('app').get('state');q.onsuccess=()=>resolve(q.result.transactions.filter(t=>t.description==='Conta de energia teste mensal').length===3)}})''')
  page.get_by_role('button',name='Confirmar hoje').first.click()
  page.wait_for_function('''async () => new Promise(resolve => {const r=indexedDB.open('clara-financas-local-v1');r.onsuccess=()=>{const q=r.result.transaction('app','readonly').objectStore('app').get('state');q.onsuccess=()=>{const t=q.result.transactions.filter(t=>t.description==='Conta de energia teste mensal');resolve(t.length===3&&t.filter(x=>x.status==='Realizado').length===1&&t.every(x=>x.recurrenceGroupId))}}})''')
  page.get_by_label('Filtrar tipo').select_option('Receita')
  assert page.get_by_text('Conta de energia teste mensal').count()==0
  page.get_by_label('Filtrar tipo').select_option('Despesa')
  page.get_by_text('Conta de energia teste mensal').first.wait_for(timeout=15000)
  page.get_by_label('Critério de data').select_option('due')
  page.get_by_label('Filtrar situação').select_option('Pendente')
  assert page.get_by_text('Conta de energia teste mensal').count()==0
  page.get_by_label('Filtrar situação').select_option('Realizado')
  page.get_by_text('Conta de energia teste mensal').first.wait_for(timeout=15000)
  page.reload()
  page.get_by_role('button',name='Movimentações',exact=True).last.click()
  page.get_by_text('Conta de energia teste mensal').first.wait_for(timeout=15000)
  assert not errors,errors
  print('PASSOU: recorrência mensal 3x, quitação rápida, filtros e persistência após reload')
  # Etapa 4: pagamento de entrada + parcelas sem debitar antes da quitação.
  page.get_by_role('button',name='Movimentações',exact=True).last.click()
  page.get_by_role('button',name='Novo parcelamento',exact=True).click()
  page.locator('input[name="description"]').fill('Notebook etapa quatro')
  page.locator('input[name="purchaseDate"]').fill('2026-10-01')
  page.locator('input[name="firstDueDate"]').fill('2026-11-05')
  page.locator('input[name="amount"]').fill('1200,00')
  page.locator('input[name="downPayment"]').fill('200,00')
  page.locator('input[name="fees"]').fill('50,00')
  page.locator('input[name="monthlyRate"]').fill('1,50')
  page.locator('input[name="installmentCount"]').fill('4')
  page.locator('select[name="category"]').select_option('Compras')
  page.get_by_text('Total a pagar (com entrada):').wait_for(timeout=15000)
  page.get_by_role('button',name='Salvar',exact=True).click()
  page.get_by_text('Notebook etapa quatro',exact=False).first.wait_for(timeout=15000)
  page.wait_for_function('''async () => new Promise(resolve=>{const r=indexedDB.open('clara-financas-local-v1');r.onsuccess=()=>{const q=r.result.transaction('app','readonly').objectStore('app').get('state');q.onsuccess=()=>{const t=q.result.transactions.filter(x=>x.installmentGroupId&&x.description.startsWith('Notebook etapa quatro'));resolve(t.length===5&&t.every(x=>x.status==='Pendente')&&new Set(t.map(x=>x.installmentGroupId)).size===1&&t.reduce((a,x)=>a+x.amountCents,0)>120000)}}})''')
  page.reload()
  page.get_by_role('button',name='Movimentações',exact=True).last.click()
  page.get_by_text('Notebook etapa quatro',exact=False).first.wait_for(timeout=15000)
  assert not errors,errors
  print('PASSOU: assistente Price 4x, entrada, juros, prévia, IndexedDB e persistência')
  # Etapa 5: categorias, arquivamento, meta mensal e persistência.
  page.get_by_role('button',name='Contas e cartões',exact=True).last.click()
  page.get_by_role('button',name='Nova categoria',exact=True).click()
  page.locator('input[name="name"]').fill('Projetos pessoais')
  page.locator('select[name="group"]').select_option('Despesa')
  page.get_by_role('button',name='Salvar',exact=True).click()
  row=page.locator('.catalog-row').filter(has_text='Projetos pessoais')
  row.wait_for(timeout=15000)
  row.get_by_role('button',name='Editar').click()
  page.locator('input[name="name"]').fill('Projetos e cursos')
  page.get_by_role('button',name='Salvar',exact=True).click()
  row=page.locator('.catalog-row').filter(has_text='Projetos e cursos')
  row.wait_for(timeout=15000)
  row.get_by_role('button',name='Arquivar',exact=True).click()
  row.get_by_role('button',name='Reativar',exact=True).wait_for(timeout=15000)
  page.get_by_role('button',name='Nova conta',exact=True).click()
  page.locator('input[name="name"]').fill('Conta secundária')
  page.locator('input[name="opening"]').fill('250,00')
  page.get_by_role('button',name='Salvar',exact=True).click()
  acc=page.locator('.account-card').filter(has_text='Conta secundária')
  acc.wait_for(timeout=15000)
  acc.get_by_role('button',name='Arquivar conta').click()
  acc.get_by_role('button',name='Reativar conta').wait_for(timeout=15000)
  page.get_by_role('button',name='Configurações',exact=True).last.click()
  page.get_by_label('Meta mensal de economia').fill('500,00')
  page.get_by_label('Dia do acompanhamento').fill('12')
  page.get_by_role('button',name='Salvar preferências financeiras').click()
  page.wait_for_function('''async () => new Promise(resolve=>{const r=indexedDB.open('clara-financas-local-v1');r.onsuccess=()=>{const q=r.result.transaction('app','readonly').objectStore('app').get('state');q.onsuccess=()=>{const d=q.result;resolve(d.settings.monthlySavingsCents===50000&&d.settings.reviewDay===12&&d.accounts.some(a=>a.name==='Conta secundária'&&a.archived)&&d.categories.some(c=>c.name==='Projetos e cursos'&&c.archived))}}})''')
  page.reload()
  page.get_by_role('button',name='Configurações',exact=True).last.click()
  assert page.get_by_label('Meta mensal de economia').input_value()=='500'
  assert page.get_by_label('Dia do acompanhamento').input_value()=='12'
  page.get_by_role('button',name='Planejamento',exact=True).last.click()
  page.get_by_text('Meta mensal de economia').first.wait_for(timeout=15000)
  assert not errors,errors
  print('PASSOU: categorias, renomeação, contas arquivadas, meta mensal e persistência')
  # Etapa 6: dívida com pagamento real, meta mensal e projeção persistente.
  page.get_by_role('button',name='Planejamento',exact=True).last.click()
  page.get_by_role('button',name='Nova dívida',exact=True).click()
  page.locator('input[name="name"]').fill('Financiamento de notebook')
  page.locator('input[name="creditor"]').fill('Banco de testes')
  page.locator('input[name="total"]').fill('1200,00')
  page.locator('input[name="openingPaid"]').fill('200,00')
  page.locator('input[name="monthly"]').fill('150,00')
  page.locator('input[name="dueDate"]').fill('2027-10-31')
  page.locator('select[name="category"]').select_option('Compras')
  page.get_by_role('button',name='Salvar',exact=True).click()
  card=page.locator('.debt-card').filter(has_text='Financiamento de notebook')
  card.wait_for(timeout=15000)
  card.get_by_role('button',name='Registrar pagamento').click()
  page.locator('input[name="paymentDate"]').fill('2026-10-20')
  page.locator('input[name="paymentAmount"]').fill('100,00')
  page.get_by_role('button',name='Salvar',exact=True).click()
  page.wait_for_function('''async () => new Promise(resolve => {const r=indexedDB.open('clara-financas-local-v1');r.onsuccess=()=>{const q=r.result.transaction('app','readonly').objectStore('app').get('state');q.onsuccess=()=>{const d=q.result;const debt=(d.debts||[]).find(x=>x.name==='Financiamento de notebook');const t=d.transactions.filter(x=>x.debtId===debt?.id);resolve(debt?.totalCents===120000&&debt?.openingPaidCents===20000&&t.length===1&&t[0].amountCents===10000&&t[0].status==='Realizado')}}})''')
  card.get_by_text('Restante:',exact=False).wait_for(timeout=15000)
  page.get_by_text('Projeção de fluxo de caixa',exact=False).first.wait_for(timeout=15000)
  page.reload()
  page.get_by_role('button',name='Planejamento',exact=True).last.click()
  page.locator('.debt-card').filter(has_text='Financiamento de notebook').wait_for(timeout=15000)
  assert page.get_by_text('Projeção de fluxo de caixa',exact=False).count()>0
  assert not errors,errors
  print('PASSOU: dívida cadastrada, pagamento vinculado, projeção e persistência após reload')
  # Regressão 6.1: corrigir pagamento, reabrir e excluir pela interface.
  page.get_by_role('button',name='Movimentações',exact=True).last.click()
  page.get_by_label('Pesquisar movimentações').fill('Pagamento: Financiamento de notebook')
  row=page.locator('.movement-mobile-card').filter(has_text='Pagamento: Financiamento de notebook')
  row.wait_for(timeout=15000)
  row.get_by_role('button',name='Editar').click()
  page.locator('input[name="amount"]').fill('150,00')
  page.get_by_role('button',name='Salvar',exact=True).click()
  page.wait_for_function('''async () => new Promise(resolve => {const r=indexedDB.open('clara-financas-local-v1');r.onsuccess=()=>{const q=r.result.transaction('app','readonly').objectStore('app').get('state');q.onsuccess=()=>{const d=q.result;const debt=(d.debts||[]).find(x=>x.name==='Financiamento de notebook');const t=d.transactions.filter(x=>x.debtId===debt?.id);resolve(t.length===1&&t[0].amountCents===15000&&t[0].status==='Realizado'&&t[0].debtId===debt.id)}}})''')
  row.get_by_role('button',name='Voltar a pendente').click()
  page.wait_for_function('''async () => new Promise(resolve => {const r=indexedDB.open('clara-financas-local-v1');r.onsuccess=()=>{const q=r.result.transaction('app','readonly').objectStore('app').get('state');q.onsuccess=()=>{const d=q.result;const debt=(d.debts||[]).find(x=>x.name==='Financiamento de notebook');const t=d.transactions.filter(x=>x.debtId===debt?.id);resolve(t.length===1&&t[0].status==='Pendente'&&!t[0].paidAt&&t[0].debtId===debt.id)}}})''')
  row.get_by_role('button',name='Excluir').click()
  page.wait_for_function('''async () => new Promise(resolve => {const r=indexedDB.open('clara-financas-local-v1');r.onsuccess=()=>{const q=r.result.transaction('app','readonly').objectStore('app').get('state');q.onsuccess=()=>{const d=q.result;const debt=(d.debts||[]).find(x=>x.name==='Financiamento de notebook');resolve(!!debt&&d.transactions.every(x=>x.debtId!==debt.id))}}})''')
  page.reload()
  page.get_by_role('button',name='Planejamento',exact=True).last.click()
  page.locator('.debt-card').filter(has_text='Financiamento de notebook').wait_for(timeout=15000)
  assert not errors,errors
  print('PASSOU: edição mantém debtId, reabertura e exclusão restauram dívida e saldo')
  # Etapa 7: saldo conciliado, auditoria e recarga.
  page.get_by_role('button',name='Contas e cartões',exact=True).last.click()
  page.get_by_label('Conta para conferência').select_option(index=0)
  page.get_by_label('Data do extrato').fill('2026-10-29')
  page.get_by_label('Saldo no extrato').fill('123456,78')
  page.get_by_role('button',name='Conferir saldo').click()
  page.get_by_text('Divergência:',exact=False).first.wait_for(timeout=15000)
  page.reload()
  page.get_by_role('button',name='Contas e cartões',exact=True).last.click()
  page.get_by_text('Extrato:',exact=False).first.wait_for(timeout=15000)
  assert not errors,errors
  print('PASSOU: conciliação, identificação de diferença e persistência')
  # Etapa 9: exportação CSV e PDF no navegador, sem backend.
  page.get_by_role('button',name='Relatórios',exact=True).last.click()
  page.get_by_role('heading',name='Demonstrativo anual').wait_for(timeout=15000)
  with page.expect_download() as csv_dl:
   page.get_by_role('button',name='CSV mensal').click()
  assert csv_dl.value.suggested_filename.endswith('.csv')
  with page.expect_download() as pdf_dl:
   page.get_by_role('button',name='Baixar PDF').click()
  assert pdf_dl.value.suggested_filename.endswith('.pdf')
  pdf_path=pdf_dl.value.path()
  assert pdf_path and Path(pdf_path).read_bytes()[:5]==b'%PDF-'
  assert not errors,errors
  print('PASSOU: relatórios mensais, anuais, CSV e PDF válido')
  # Etapa 10: backup criptografado, restauração e bloqueio de interface.
  page.get_by_role('button',name='Configurações',exact=True).last.click()
  page.get_by_label('Senha do backup').fill('Minha senha de teste protegida 2026')
  with page.expect_download() as encrypted_dl:
   page.get_by_role('button',name='Exportar backup protegido').click()
  encrypted_path=encrypted_dl.value.path()
  assert encrypted_dl.value.suggested_filename.endswith('.clara')
  encrypted_payload=Path(encrypted_path).read_bytes()
  assert b'clara-encrypted-backup' in encrypted_payload
  assert b'Financiamento de notebook' not in encrypted_payload
  page.get_by_label('Senha do backup').fill('Minha senha de teste protegida 2026')
  page.locator('input[accept=".clara,application/json"]').set_input_files({'name':'restaurar.clara','mimeType':'application/json','buffer':encrypted_payload})
  page.get_by_text('Backup restaurado.',exact=False).first.wait_for(timeout=15000)
  page.get_by_label('Senha do bloqueio').fill('Senha visual do Clara segura 2026')
  page.get_by_role('button',name='Ativar bloqueio').click()
  page.get_by_role('heading',name='Clara bloqueado').wait_for(timeout=15000)
  page.get_by_label('Senha de desbloqueio').fill('Senha visual do Clara segura 2026')
  page.get_by_role('button',name='Desbloquear').click()
  page.get_by_role('heading',name='Configurações',exact=True).first.wait_for(timeout=15000)
  assert not errors,errors
  print('PASSOU: AES-GCM exportado, restauração e senha local de interface')
  page.get_by_label('Senha do bloqueio').fill('Senha visual do Clara segura 2026')
  page.get_by_role('button',name='Desativar bloqueio').click()
  # RC2: cofre no IndexedDB real; ativar, bloquear, senha incorreta e recuperar.
  vault_secret='Minha senha de cofre segura RC2 2026'
  page.get_by_label('Senha do cofre local').fill(vault_secret)
  page.get_by_role('button',name='Ativar proteção do banco').click()
  print('COFRE ATIVACAO TELA:',page.locator('body').inner_text(timeout=10000)[-950:])
  print('COFRE ATIVACAO ALERTAS:',page.get_by_role('alert').all_text_contents())
  page.get_by_text('Protegido',exact=True).first.wait_for(timeout=15000)

  page.wait_for_function('''async () => new Promise(resolve=>{const r=indexedDB.open('clara-financas-local-v1');r.onsuccess=()=>{const s=r.result.transaction('app','readonly').objectStore('app');let open,locked;const a=s.get('state'),b=s.get('state-vault');a.onsuccess=()=>{open=a.result;if(locked!==undefined)resolve(open===undefined&&typeof locked==='string'&&locked.includes('clara-encrypted-backup'))};b.onsuccess=()=>{locked=b.result;if(open!==undefined)resolve(false);else if(a.readyState==='done')resolve(typeof locked==='string'&&locked.includes('clara-encrypted-backup'))}}})''')
  page.reload()
  print('COFRE DEBUG:',page.locator('body').inner_text(timeout=10000)[:650])
  print('COFRE ESTADO IDB:', page.evaluate("""async()=>new Promise(resolve=>{const r=indexedDB.open('clara-financas-local-v1');r.onsuccess=()=>{const s=r.result.transaction('app','readonly').objectStore('app');const a=s.get('state'),b=s.get('state-vault');let plain,crypt; a.onsuccess=()=>{plain=a.result;if(b.readyState==='done')resolve({plain:!!plain,encrypted:typeof crypt,hasCipher:typeof crypt==='string'})};b.onsuccess=()=>{crypt=b.result;if(a.readyState==='done')resolve({plain:!!plain,encrypted:typeof crypt,hasCipher:typeof crypt==='string'})}}})"""))

  print('ERROS JS:',errors[-3:])
  page.get_by_role('heading',name='Cofre financeiro protegido').wait_for(timeout=15000)
  page.get_by_label('Senha do cofre').fill('Senha incorreta bem longa')
  page.get_by_role('button',name='Abrir cofre').click()
  page.get_by_role('heading',name='Cofre financeiro protegido').wait_for(timeout=15000)
  page.get_by_label('Senha do cofre').fill(vault_secret)
  page.get_by_role('button',name='Abrir cofre').click()
  page.get_by_role('button',name='Planejamento',exact=True).last.click()
  page.locator('.debt-card').filter(has_text='Financiamento de notebook').wait_for(timeout=15000)
  page.get_by_role('button',name='Configurações',exact=True).last.click()
  page.get_by_label('Senha do cofre local').fill(vault_secret)
  page.get_by_role('button',name='Desativar proteção do banco').click()
  print('DEPOIS DE DESATIVAR:',page.locator('body').inner_text(timeout=10000)[-1200:])
  print('ALERTAS:',page.get_by_role('alert').all_text_contents())
  page.get_by_role('button',name='Ativar proteção do banco').wait_for(timeout=10000)
  page.wait_for_function('''async () => new Promise(resolve=>{const r=indexedDB.open('clara-financas-local-v1');r.onsuccess=()=>{const s=r.result.transaction('app','readonly').objectStore('app');const a=s.get('state'),b=s.get('state-vault');let plain,enc; a.onsuccess=()=>{plain=a.result;if(b.readyState==='done')resolve(!!plain&&!b.result)};b.onsuccess=()=>{enc=b.result;if(a.readyState==='done')resolve(!!plain&&!enc)}}})''')
  before_reload=page.evaluate("""async()=>new Promise(resolve=>{
   const req=indexedDB.open('clara-financas-local-v1');
   req.onsuccess=()=>{const tx=req.result.transaction('app','readonly');
    const store=tx.objectStore('app'),plain=store.get('state'),cipher=store.get('state-vault');
    tx.oncomplete=()=>resolve({hasPlain:!!plain.result,hasCipher:!!cipher.result,revision:plain.result?.revision||0});}
  })""")
  print('COFRE ANTES RELOAD:',before_reload)
  assert before_reload['hasPlain'] and not before_reload['hasCipher'],before_reload
  page.reload()
  print('COFRE REVERSAO TELA:',page.locator('body').inner_text(timeout=10000)[:1100])
  print('ERROS JS REVERSAO:',errors[-5:])
  after_reload=page.evaluate("""async()=>new Promise(resolve=>{
   const req=indexedDB.open('clara-financas-local-v1');
   req.onsuccess=()=>{const tx=req.result.transaction('app','readonly');const store=tx.objectStore('app');
    const plain=store.get('state'),cipher=store.get('state-vault');
    tx.oncomplete=()=>resolve({hasPlain:!!plain.result,hasCipher:!!cipher.result,revision:plain.result?.revision||0});}
  })""")
  print('COFRE DEPOIS RELOAD:',after_reload)
  assert after_reload['hasPlain'] and not after_reload['hasCipher'],after_reload
  page.locator('.clara-balance-hero').wait_for(timeout=15000)
  assert not errors,errors
  print('PASSOU: migração do IndexedDB criptografado, senha, recarga e reversão sem perda')
  browser.close()
 srv.shutdown()
worker=(ROOT/'dist/sw.js').read_text()
assert '__CLARA_PRECACHE_ASSETS__' not in worker and 'clara-shell-' in worker
assert './index.html' in worker and '.js' in worker and '.css' in worker
print('PASSOU: Service Worker contém assets de build versionados, inclusive JavaScript e CSS')
print('ACEITE: execução end-to-end do build de produção concluída')
