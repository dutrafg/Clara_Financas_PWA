"""Auditoria mensal: saldos, transferências, conciliações e isolamento do período corrente."""
import asyncio
from playwright.async_api import async_playwright

BASE='http://127.0.0.1:8765/'
PWD='Clara-QA-Senha-2026!'
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  context=await browser.new_context(viewport={'width':390,'height':844},accept_downloads=True)
  page=await context.new_page()
  errors=[]
  page.on('pageerror',lambda ex:errors.append(str(ex)))
  await page.goto(BASE,wait_until='load')
  assert await page.locator('#securityCover').is_visible()
  await page.locator('#securityPassword').fill(PWD)
  await page.locator('#securityConfirm').fill(PWD)
  await page.locator('#securitySubmit').click()
  await page.wait_for_function("document.documentElement.dataset.unlocked==='true'",timeout=30000)
  data=await page.evaluate("""() => {
   const past=plusMonth(todayISO().slice(0,7)+'-01',-1).slice(0,7);
   const current=todayISO().slice(0,7);
   state.accounts[0].openingCents=100000;
   state.accounts.push({id:'history-account2',name:'Conta de reserva QA',type:'Reserva',openingCents:50000});
   const make=(id,kind,amount,acc,status='Realizado',dest='')=>({
     id,kind,amountCents:amount,accountId:acc,toAccountId:dest,
     description:'Auditoria QA '+id,category:kind==='Receita'?'Salário':kind==='Despesa'?'Moradia':'',
     status,date:past+'-10',paidAt:status==='Realizado'?past+'-10':''
   });
   state.transactions=[
    make('qa-inc','Receita',25000,'principal'),
    make('qa-out','Despesa',12000,'principal'),
    make('qa-tr','Transferência',5000,'principal','Realizado','history-account2'),
    make('qa-pending','Despesa',7000,'history-account2','Pendente')
   ];
   state.reconciliations=[{id:'qa-recon',accountId:'principal',date:past+'-20',statementCents:108000}];
   save();
   const previous=historicalSummary(past,'Todas');
   const reserve=historicalSummary(past,'history-account2');
   return {past,current,previous:{
     start:previous.start,end:previous.end,income:previous.income,expense:previous.expense,
     pending:previous.outstanding,count:previous.entries.length,recs:previous.reconciliations.length
   },reserve:{start:reserve.start,end:reserve.end,income:reserve.income,expense:reserve.expense,pending:reserve.outstanding}};
  }""")
  assert data['previous']==dict(start=150000,end=163000,income=25000,expense=12000,pending=7000,count=4,recs=1),data
  assert data['reserve']==dict(start=50000,end=55000,income=5000,expense=0,pending=7000),data
  before=await page.evaluate("state.settings.period")
  await page.locator('#floatTrigger').click()
  await page.locator('#mobileNav [data-view="historico"]').click()
  assert await page.locator('#historyMonth').input_value()==data['past']
  assert 'Saldo inicial' in await page.locator('#view-historico').inner_text()
  await page.locator('#historyAccount').select_option('history-account2')
  assert await page.locator('#historyAccount').input_value()=='history-account2'
  await page.locator('#historyPrev').click()
  assert await page.locator('#historyMonth').input_value()!=data['past']
  await page.locator('#historyNext').click()
  assert await page.locator('#historyMonth').input_value()==data['past']
  async with page.expect_download() as dl:
   await page.locator('#historyCsv').click()
  file=await dl.value
  assert file.suggested_filename.startswith('Clara_Historico_'+data['past'])
  after=await page.evaluate("state.settings.period")
  assert before==after==data['current'],(before,after,data)
  assert not errors,errors
  print('HISTÓRICO APROVADO: saldos, transferências, conciliações, CSV e isolamento de mês')
  await context.close()
  await browser.close()
asyncio.run(main())
