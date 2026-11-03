"""Clara Simples: fluxo financeiro conciso, filtros e lançamento sem duplicar o motor."""
import asyncio
from playwright.async_api import async_playwright

BASE='http://127.0.0.1:8765/'
PASSWORD='Clara-Simples-QA-2026!'

async def setup(page):
    await page.goto(BASE,wait_until='load')
    if await page.locator('#securityCover').is_visible():
        await page.locator('#securityPassword').fill(PASSWORD)
        if await page.locator('#securityConfirmWrap').is_visible():
            await page.locator('#securityConfirm').fill(PASSWORD)
        await page.locator('#securitySubmit').click()
        await page.wait_for_function("window.ClaraSecurity.unlocked",timeout=30000)

async def main():
  async with async_playwright() as pw:
    browser=await pw.chromium.launch(headless=True)
    for width,height in [(320,700),(390,844),(768,1024),(1440,900)]:
      context=await browser.new_context(viewport={'width':width,'height':height})
      page=await context.new_page()
      errors=[]
      page.on('pageerror',lambda error:errors.append(str(error)))
      await setup(page)
      assert await page.evaluate("pref('simpleMode')") is True
      assert await page.locator('#view-painel .clara-balance').is_visible()
      assert await page.locator('#view-painel .clara-simple-stats article').count()==3
      assert await page.locator('#view-painel .clara-month-nav button').count()==2
      assert await page.locator('#view-painel [data-open="account"]').is_visible()
      before=await page.evaluate("state.settings.period")
      await page.locator('#view-painel [data-simple-month-dir="-1"]').click()
      prev=await page.evaluate("state.settings.period")
      assert prev!=before,(width,prev,before)
      await page.locator('#view-painel [data-simple-month-dir="1"]').click()
      assert await page.evaluate("state.settings.period")==before
      assert await page.evaluate("document.documentElement.scrollWidth<=innerWidth+2")

      await page.evaluate("""() => {
        const date=todayISO();
        state.accounts.push({id:'qa-other',name:'Outra conta',type:'Conta',openingCents:10000});
        const tx=(id,kind,amount,description,status)=>({
          id,kind,amountCents:amount,description,status,date,
          paidAt:status==='Realizado'?date:'',category:kind==='Receita'?'Salário':'Alimentação',
          accountId:'principal',toAccountId:''
        });
        state.transactions=[tx('qa-receita','Receita',25000,'Salário visual QA','Realizado'),
          tx('qa-despesa','Despesa',7500,'Almoço visual QA','Realizado'),
          tx('qa-pendente','Despesa',1200,'Pagamento futuro QA','Pendente')];
        save();go('mov');
      }""")
      assert await page.locator('#view-mov .clara-tx-summary>div').count()==3
      assert await page.locator('#view-mov .clara-month-nav').is_visible()
      assert await page.locator('#view-mov [data-simple-filter]').count()==5
      assert await page.locator('#view-mov .clara-simple-line').count()==3
      await page.locator('#view-mov [data-simple-filter="Receitas"]').click()
      assert await page.locator('#view-mov .clara-simple-line').count()==1
      assert 'Salário visual QA' in await page.locator('#view-mov .clara-simple-line').inner_text()
      await page.locator('#view-mov [data-simple-filter="Pendentes"]').click()
      assert await page.locator('#view-mov .clara-simple-line').count()==1
      assert 'Pagamento futuro' in await page.locator('#view-mov .clara-simple-line').inner_text()
      await page.locator('#claraSimpleTxSearch').fill('NÃO ENCONTRADO')
      assert await page.locator('#view-mov .clara-simple-empty').is_visible()
      await page.locator('#view-mov [data-simple-clear-filters]').click()
      assert await page.locator('#view-mov .clara-simple-line').count()==3
      assert await page.locator('#claraSimpleTxSearch').input_value()==''

      await page.locator('#view-mov [data-clw-kind="Receita"]').click()
      await page.wait_for_function("document.getElementById('modalBg').dataset.claraKind==='Receita'")
      assert await page.locator('#modalBg').is_visible()
      assert await page.locator('#m_description').get_attribute('required') is None
      assert not await page.locator('#m_destination').is_visible()
      assert await page.locator('#m_category').is_visible()
      assert await page.locator('[data-simple-date="yesterday"]').is_visible()
      await page.locator('[data-simple-date="yesterday"]').click()
      assert await page.evaluate("document.getElementById('m_date').value===addDays(todayISO(),-1)")
      await page.locator('[data-simple-date="today"]').click()
      assert await page.evaluate("document.getElementById('m_date').value===todayISO()")
      await page.locator('#m_amount').fill('22,90')
      await page.locator('#m_status').select_option('Realizado')
      await page.locator('#m_paidAt').fill(await page.evaluate("todayISO()"))
      await page.locator('#modalForm button[type="submit"]').click()
      assert await page.locator('#modalBg').is_hidden()
      await page.evaluate("window.ClaraSecurity.flush()")
      added=await page.evaluate("""() => state.transactions.find(x=>
        x.kind==='Receita'&&x.amountCents===2290)""")
      assert added and added['description'] and added['category']==added['description'],added

      await page.locator('#view-mov [data-clw-kind="Transferência"]').click()
      await page.wait_for_function("document.getElementById('modalBg').dataset.claraKind==='Transferência'")
      assert await page.locator('#m_destination').is_visible()
      assert not await page.locator('#m_category').is_visible()
      assert await page.locator('#modalBg #m_destination').count()==1
      await page.locator('#m_destination').select_option('qa-other')
      await page.locator('#m_amount').fill('100,00')
      await page.locator('#m_status').select_option('Realizado')
      await page.locator('#m_paidAt').fill(await page.evaluate("todayISO()"))
      previous=await page.evaluate("totalBalance(todayISO())")
      await page.locator('#modalForm button[type="submit"]').click()
      assert await page.locator('#modalBg').is_hidden()
      await page.evaluate("window.ClaraSecurity.flush()")
      result=await page.evaluate("""() => ({
        total:totalBalance(todayISO()),last:state.transactions.at(-1),
        cifrado:!localStorage.getItem('clara-financas-vault-aesgcm-v1').includes('Almoço visual QA'),
        width:document.documentElement.scrollWidth
      })""")
      assert result['total']==previous,result
      assert result['last']['kind']=='Transferência' and result['last']['toAccountId']=='qa-other',result
      assert result['cifrado'] and result['width']<=width+2,result
      # Etapa 2: quatro painéis em tamanho controlado, incluindo estados de
      # expansão, cartões corretamente classificados e links ao cadastro real.
      await page.evaluate("""() => {
        const month=state.settings.period+'-14';
        state.accounts.push(
          {id:'qa-bank-2',name:'Reserva adicional de teste',type:'Reserva',openingCents:5000},
          {id:'qa-card-1',name:'Cartão A QA',type:'Cartão',openingCents:0},
          {id:'qa-card-2',name:'Cartão B QA',type:'Cartão',openingCents:0},
          {id:'qa-card-3',name:'Cartão C QA',type:'Cartão',openingCents:0});
        state.transactions.push({
          id:'qa-card-pending',kind:'Despesa',amountCents:3600,
          description:'Fatura QA',date:month,status:'Pendente',paidAt:'',
          accountId:'qa-card-1',toAccountId:'',category:'Alimentação'
        });
        for(let i=0;i<4;i++)
          state.goals.push({id:'qa-goal-'+i,name:'Meta '+i,
            savedCents:1000*(i+1),targetCents:10000,dueDate:plusMonth(todayISO(),6)});
        state.categories.filter(c=>c.group==='Despesa').slice(0,4)
          .forEach((c,i)=>{c.limitCents=10000+i*1000;});
        save();go('painel');
      }""")
      panels=page.locator('#view-painel .clara-money-panel-grid>.clara-compact-panel')
      assert await panels.count()==4
      for title in ('Contas','Cartões','Metas','Limites'):
        assert await page.locator('#view-painel .clara-compact-panel header h3',has_text=title).count()==1
      assert 'Cartão A QA' in await panels.nth(1).inner_text()
      assert await page.evaluate("accountPendingCard('qa-card-1')")==3600
      shown=await page.evaluate("brl(accountPendingCard('qa-card-1'))")
      assert shown in await panels.nth(1).inner_text(),(width,shown)
      assert await page.evaluate("pref('hideValues')") is True or shown=='R$ 36,00'
      assert 'Cartão A QA' not in await panels.nth(0).inner_text()
      for idx in (0,1,2,3):
        details=panels.nth(idx).locator('details.clara-compact-more')
        assert await details.count()==1,(width,idx)
        assert await details.evaluate('(el)=>el.open') is False
        await details.locator('summary').click()
        assert await details.evaluate('(el)=>el.open') is True
        await details.locator('summary').click()
        assert await details.evaluate('(el)=>el.open') is False
      assert await panels.nth(2).locator('[role="progressbar"]').count()==4
      assert await panels.nth(3).locator('[role="progressbar"]').count()==4
      # O cartão abre o formulário original já com tipo Cartão, sem salvar.
      before_cards=await page.evaluate('state.accounts.length')
      await page.locator('#view-painel [data-simple-new-card]').click()
      assert await page.locator('#modalBg').is_visible()
      assert await page.locator('#m_type').input_value()=='Cartão'
      await page.locator('#closeModal').click()
      assert await page.evaluate('state.accounts.length')==before_cards
      # O planejamento mostra todos os itens, inicialmente somente três.
      await page.evaluate("go('plan')")
      assert await page.locator('#view-plan .clara-compact-panel').count()==3
      assert await page.locator('#view-plan .clara-compact-goal').count()>=8
      assert await page.locator('#view-plan details.clara-compact-more').count()==2
      assert await page.locator('#view-plan .clara-month-nav').is_visible()
      assert await page.evaluate("document.documentElement.scrollWidth<=innerWidth+2")
      await page.evaluate("() => {state.settings.simpleMode=false;render();modal('transaction');}")
      assert await page.locator('#modalBg').get_attribute('data-clara-kind') is None
      await page.locator('#closeModal').click()
      assert not errors,(width,errors)
      print('CLARA SIMPLES OK:',width,'px; resumo, contas, cartões, metas, limites, filtros e transferências')
      await context.close()
    await browser.close()

asyncio.run(main())
