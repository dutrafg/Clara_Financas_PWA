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
    make('qa-pending','Despesa',7000,'history-account2','Pendente'),
    make('qa-await-income','Receita',11000,'principal','Pendente'),
    make('qa-await-transfer','Transferência',9000,'principal','Pendente','history-account2')
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
  assert data['previous']==dict(start=150000,end=163000,income=25000,expense=12000,pending=7000,count=6,recs=1),data
  assert data['reserve']==dict(start=50000,end=55000,income=5000,expense=0,pending=7000),data
  before=await page.evaluate("state.settings.period")
  # Histórico técnico pertence ao modo avançado; no simples a rota fica
  # deliberadamente oculta. A regressão contábil não depende do menu móvel.
  await page.evaluate("() => {state.settings.simpleMode=false;save();go('historico');}")
  assert await page.locator('#view-historico').is_visible()
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
  assert 'Despesas pendentes' in await page.locator('#view-historico').inner_text()

  # Propriedades independentes do motor: 1.000 movimentações determinísticas.
  # Transferências são soma zero; pendências não alteram saldos; todas as
  # operações permanecem inteiras em centavos.
  properties=await page.evaluate("""() => {
    const original=structuredClone(state);
    try{
      const month=todayISO().slice(0,7),date=month+'-10';
      state.accounts=[
        {id:'qa-a',name:'Conta A',type:'Corrente',openingCents:125000},
        {id:'qa-b',name:'Conta B',type:'Corrente',openingCents:-1500},
        {id:'qa-c',name:'Conta C',type:'Reserva',openingCents:23000}
      ];
      state.transactions=[];
      const ids=state.accounts.map(a=>a.id);
      const expected=Object.fromEntries(state.accounts.map(a=>[a.id,a.openingCents]));
      let seed=0x4f3a1bc;
      const rnd=max=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%max;};
      let income=0,expense=0,unpaid=0,transfers=0;
      for(let i=0;i<1000;i++){
        const amount=1+rnd(1_000_000),kind=['Receita','Despesa','Transferência'][rnd(3)];
        const status=['Realizado','Pendente','Cancelado'][rnd(3)];
        const accountId=ids[rnd(ids.length)];
        let toAccountId=ids[rnd(ids.length)];
        if(toAccountId===accountId)toAccountId=ids[(ids.indexOf(accountId)+1)%ids.length];
        const entry={id:'property-'+i,kind,amountCents:amount,accountId,
          toAccountId:kind==='Transferência'?toAccountId:'',
          description:'Propriedade QA '+i,category:kind==='Receita'?'Salário':kind==='Despesa'?'Moradia':'',
          status,date,paidAt:status==='Realizado'?date:''};
        state.transactions.push(entry);
        if(status==='Pendente'&&kind==='Despesa')unpaid+=amount;
        if(status!=='Realizado')continue;
        if(kind==='Receita'){income+=amount;expected[accountId]+=amount;}
        else if(kind==='Despesa'){expense+=amount;expected[accountId]-=amount;}
        else {expected[accountId]-=amount;expected[toAccountId]+=amount;transfers++;}
      }
      const actual=Object.fromEntries(ids.map(id=>[id,accountBalance(id,date)]));
      const stats=stat(month),summary=historicalSummary(month,'Todas');
      const total=totalBalance(date);
      return {expected,actual,total,expectedTotal:125000-1500+23000+income-expense,
        stats:{income:stats.income,expense:stats.expense},
        expectedStats:{income,expense},pending:summary.outstanding,unpaid,
        transferCount:transfers,transactions:state.transactions.length,
        lastCentsAreIntegers:Object.values(actual).every(Number.isSafeInteger)};
    }finally{state=original;render();}
  }""")
  assert properties['expected']==properties['actual'],properties
  assert properties['total']==properties['expectedTotal'],properties
  assert properties['stats']==properties['expectedStats'],properties
  assert properties['pending']==properties['unpaid'],properties
  assert properties['lastCentsAreIntegers'] and properties['transactions']==1000,properties
  assert not errors,errors
  print('HISTÓRICO APROVADO: 1.000 movimentações, conciliação, saldo, transferências e pendências')
  await context.close()
  await browser.close()
asyncio.run(main())
