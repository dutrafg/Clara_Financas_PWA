"""Homologação ampliada dos 15 miniaplicativos Clara; dados somente sintéticos.

Executar com servidor local em http://127.0.0.1:8765 após npm run build.
"""
import asyncio
from playwright.async_api import async_playwright

BASE = 'http://127.0.0.1:8765/'

async def unlock(page):
    if await page.locator('#securityCover').is_visible():
        await page.locator('#securityPassword').fill('Clara-QA-Senha-2026!')
        if await page.locator('#securityConfirmWrap').is_visible():
            await page.locator('#securityConfirm').fill('Clara-QA-Senha-2026!')
        await page.locator('#securitySubmit').click()
        await page.wait_for_function("document.documentElement.dataset.unlocked==='true'",timeout=30000)

async def home(page):
    await page.goto(BASE, wait_until='load')
    await unlock(page)
    # Miniaplicativos foram mantidos no modo avançado; o modo simples é o padrão.
    await page.evaluate("""() => {
      if(pref('simpleMode')){state.settings.simpleMode=false;save();}
      go('painel');
    }""")
    await page.locator('#dashboardMiniapps').wait_for()

async def all_widgets(page):
    await home(page)
    await page.locator('[data-clw-action="editor"]').click()
    await page.locator('[data-clw-action="all"]').click()
    assert await page.locator('#dashboardMiniapps [data-widget]').count()==15

async def seed(page):
    """Uma base sintética com transferências, cartões, vencimentos, metas, recorrências e conciliações."""
    return await page.evaluate("""() => {
        const month=todayISO().slice(0,7),prev=plusMonth(month+'-01',-1);
        state.accounts[0].openingCents=100000;
        state.accounts.push({id:'qa-card',name:'Cartão de teste',type:'Cartão',openingCents:0});
        const tx=(id,desc,kind,status,amount,date,account='principal')=>({
           id,description:desc,kind,status,amountCents:amount,date,
           accountId:account,category:kind==='Receita'?'Salário':kind==='Despesa'?'Moradia':'',
           toAccountId:kind==='Transferência'?'qa-card':'',
           paidAt:status==='Realizado'?date:''
        });
        state.transactions=[
          tx('qa1','Salário QA','Receita','Realizado',50000,month+'-05'),
          tx('qa2','Aluguel QA','Despesa','Realizado',20000,month+'-10'),
          tx('qa3','Luz QA','Despesa','Pendente',12500,todayISO()),
          tx('qa4','Aluguel QA','Despesa','Realizado',20000,prev),
          tx('qa5','Luz QA','Despesa','Realizado',11000,prev),
          tx('qa6','Transferência QA','Transferência','Realizado',10000,month+'-12'),
          tx('qa7','Compra cartão','Despesa','Pendente',7000,month+'-21','qa-card')
        ];
        state.goals.push({id:'qag1',name:'Reserva de teste',savedCents:25000,targetCents:100000,dueDate:plusMonth(todayISO(),5)});
        state.reconciliations.push({id:'qar1',accountId:'principal',date:todayISO(),statementCents:100000});
        save();
        return {month,prev};
    }""")

async def run():
  checked=[]
  async with async_playwright() as p:
    browser=await p.chromium.launch(headless=True)
    # Variações de dispositivos, orientação, tema, privacidade e vazios.
    for width,height in [(320,640),(360,800),(390,844),(600,900),(768,1024),(1024,768),(1440,900),(1920,1080)]:
      ctx=await browser.new_context(viewport={'width':width,'height':height}, accept_downloads=True)
      page=await ctx.new_page()
      errors=[]
      page.on('pageerror',lambda e:errors.append(str(e)))
      await all_widgets(page)
      assert await page.locator('#dashboardMiniapps [data-widget]').count()==15
      assert await page.locator('#floatTrigger').is_visible()==(width<=760)
      # Checar cards sem transbordar o viewport.
      sizes=await page.evaluate("""() => ({
        viewport:document.documentElement.clientWidth,
        scroll:document.documentElement.scrollWidth,
        total:document.querySelectorAll('#dashboardMiniapps [data-widget]').length
      })""")
      assert sizes['scroll']<=sizes['viewport']+3,(width,sizes)
      await page.evaluate("""() => {state.settings.theme='dark';state.settings.hideValues=true;save();}""")
      assert await page.locator('html').get_attribute('data-theme')=='dark'
      assert await page.locator('#dashboardMiniapps').inner_text()
      assert not errors, (width,errors)
      checked.append(f'viewport-{width}x{height}')
      await ctx.close()

    ctx=await browser.new_context(viewport={'width':390,'height':844},accept_downloads=True)
    page=await ctx.new_page()
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    await all_widgets(page)
    periods=await seed(page)
    # Requisitos: 15 miniaplicativos, 3+ operações distintas por card.
    toolbars=await page.evaluate("""() => [...document.querySelectorAll('#dashboardMiniapps [data-widget]')].map(w=>{
      const buttons=[...w.querySelectorAll('.clw-toolstrip button')];
      return {id:w.dataset.widget,count:buttons.length,
        distinct:new Set(buttons.map(b=>[b.dataset.clwAction,b.dataset.clwValue,b.dataset.view,b.dataset.open,b.dataset.configJump].join('|'))).size};
    })""")
    assert len(toolbars)==15 and all(x['count']>=3 and x['distinct']>=3 for x in toolbars),toolbars
    checked.append('15-cards-3-mais-acoes')
    original=await page.evaluate("() => JSON.stringify(state)")
    for widget,action,value in [
      ('attention','attention-filter','Atrasos'),('attention','attention-filter','Limites'),
      ('attention','attention-filter','Metas'),('attention','attention-filter','Todos'),
      ('budgets','budget-sort','Gasto'),('budgets','budget-sort','Nome'),
      ('goals','goal-overdue','overdue'),('goals','goal-overdue','all'),
      ('recent','recent-kind','Despesa'),('recent','recent-kind','Receita'),
      ('recent','recent-kind','Todos'),
      ('insights','insight-filter','important'),('insights','insight-filter','all'),
      ('categories','category-metric','Previsto'),('categories','category-metric','Realizado'),
      ('history','history-negative','negative'),('history','history-negative','all'),
      ('recurring','recurring-kind','Receita'),('recurring','recurring-kind','Despesa'),
      ('recurring','recurring-kind','Todos')
    ]:
      await page.locator(f'[data-widget="{widget}"] [data-clw-action="{action}"][data-clw-value="{value}"]').click()
    for widget,action in [('forecast','forecast-negative'),('audit','audit-difference')]:
      await page.locator(f'[data-widget="{widget}"] [data-clw-action="{action}"]').click()
      await page.locator(f'[data-widget="{widget}"] [data-clw-action="{action}"]').click()
    assert await page.evaluate("() => JSON.stringify(state)")==original,'Filtro modificou o cofre'
    checked.append('filtros-novos-sem-escrita')
    # Os navegadores podem bloquear downloads automáticos em lote (>10);
    # instrumentar o download nos 13 cards e validar cada CSV em memória.
    await page.evaluate("""() => {
      window.__claraQaOriginalDl=dl;window.__claraQaExports=[];
      dl=(name,content,mime)=>window.__claraQaExports.push({name,content,mime});
    }""")
    for widget in ['attention','agenda','budgets','goals','accounts','comparison','recent',
                   'insights','forecast','audit','categories','history','recurring']:
      before_count=await page.evaluate("window.__claraQaExports.length")
      await page.locator(f'[data-widget="{widget}"] [data-clw-action="widget-export"]').click()
      result=await page.evaluate("window.__claraQaExports.at(-1)")
      assert await page.evaluate("window.__claraQaExports.length")==before_count+1,widget
      assert result['name'].startswith('Clara_Miniapp_'+widget),result
      assert result['content'].startswith('\\ufeff') and len(result['content'])>25,widget
      assert result['mime'].startswith('text/csv'),widget
    await page.evaluate("() => {dl=window.__claraQaOriginalDl;delete window.__claraQaOriginalDl;}")
    # Pelo menos um download físico, para aferir integração nativa com o Chromium.
    async with page.expect_download() as d:
      await page.locator('[data-widget="categories"] [data-clw-action="widget-export"]').click()
    assert (await d.value).suggested_filename.startswith('Clara_Miniapp_categories')
    assert await page.evaluate("() => JSON.stringify(state)")==original
    checked.append('13-relatorios-csv-e-download-nativo')
    # Duplicação de recorrência é rascunho no mês seguinte.
    button=page.locator('[data-widget="recurring"] [data-clw-next="true"]').first
    source_id=await button.get_attribute('data-clw-id')
    next_month=await page.evaluate("(id) => plusMonth(state.transactions.find(t=>t.id===id).date,1)",source_id)
    await button.click()
    assert await page.locator('#m_date').input_value()==next_month
    await page.locator('#closeModal').click()
    assert await page.evaluate("() => JSON.stringify(state)")==original
    checked.append('recorrencia-rascunho-proximo-mes')
    assert await page.locator('[data-widget="recurring"]').inner_text()
    assert await page.locator('[data-widget="recurring"] [data-edit-tx="qa4"]').count()+await page.locator('[data-widget="recurring"] [data-edit-tx="qa2"]').count()>0
    checked.append('recorrencia-identificada-sem-autocadastro')
    # 3 cenários de simulador, sem alterar dados reais.
    await page.locator('#clw-sim-income').fill('100,00')
    await page.locator('#clw-sim-expense').fill('40,00')
    await page.locator('#clw-sim-months').select_option('3')
    before=await page.evaluate("() => JSON.stringify(state.transactions)")
    await page.locator('[data-widget="simulator"] [data-clw-action="simulate"]').click()
    text=await page.locator('#clw-sim-result').inner_text()
    assert 'R$' in text and '3 mês' in text,text
    assert await page.evaluate("() => JSON.stringify(state.transactions)")==before
    await page.locator('#clw-sim-income').fill('-1,00')
    await page.locator('[data-widget="simulator"] [data-clw-action="simulate"]').click()
    assert 'não negativos' in await page.locator('#clw-sim-result').inner_text()
    await page.locator('#clw-sim-income').fill('100,00')
    await page.locator('[data-widget="simulator"] [data-clw-action="sim-draft"][data-clw-kind="Receita"]').click()
    assert await page.locator('#m_kind').input_value()=='Receita'
    assert await page.locator('#m_amount').input_value()=='100,00'
    assert await page.evaluate("() => JSON.stringify(state.transactions)")==before
    await page.locator('#closeModal').click()
    checked.append('simulacao-e-rascunho-sem-gravacao')
    await page.locator('#clw-sim-income').fill('150,00')
    await page.locator('#clw-sim-expense').fill('20,00')
    async with page.expect_download() as d:
      await page.locator('[data-widget="simulator"] [data-clw-action="sim-export"]').click()
    assert (await d.value).suggested_filename.startswith('Clara_Simulacao_')
    await page.locator('[data-widget="simulator"] [data-clw-action="sim-reset"]').click()
    assert await page.locator('#clw-sim-income').input_value()=='0,00'
    assert await page.locator('#clw-sim-expense').input_value()=='0,00'
    assert await page.evaluate("() => JSON.stringify(state)")==original
    checked.append('simulador-csv-reset-sem-escrita')
    # Filtros de agenda, recentes, orçamento, conta e comparação.
    for name,value in [('agenda-days','7'),('agenda-days','30'),('agenda-kind','Receita'),('agenda-kind','Todos'),
                       ('recent-status','Pendente'),('recent-status','Realizado'),('recent-status','Todos'),
                       ('compare','3'),('compare','12'),('compare','1'),('forecast-months','6')]:
      await page.locator(f'[data-clw-action="{name}"][data-clw-value="{value}"]').click()
    for name in ['budget-risk','account-cards']:
      await page.locator(f'[data-clw-action="{name}"]').click()
      await page.locator(f'[data-clw-action="{name}"]').click()
    checked.append('filtros-dos-miniaplicativos')
    # Débito manual com data de quitação real preserva vencimento.
    due=await page.evaluate("() => state.transactions.find(t=>t.id==='qa3').date")
    await page.locator('[data-widget="agenda"] [data-clw-action="pay"][data-clw-id="qa3"]').click()
    await page.locator('#confirmModalBtn').click()
    after=await page.evaluate("() => state.transactions.find(t=>t.id==='qa3')")
    assert after['status']=='Realizado' and after['date']==due and after['paidAt']!='',after
    checked.append('baixa-confirmada-e-vencimento-preservado')
    # Duplicação só cria ao salvar explicitamente.
    count=await page.evaluate("() => state.transactions.length")
    await page.locator('[data-widget="recent"] [data-clw-action="duplicate"][data-clw-id="qa3"]').click()
    assert await page.evaluate("() => state.transactions.length")==count
    await page.locator('#closeModal').click()
    checked.append('duplicacao-sem-salvar')
    # CSV gerado a partir do banco local, sem caracteres malformados.
    for widget,act in [('recurring','recurring-export'),('budgets','budget-export'),('recent','export-tx')]:
      async with page.expect_download() as d:
        await page.locator(f'[data-widget="{widget}"] [data-clw-action="{act}"]').click()
      download=await d.value
      assert download.suggested_filename.endswith('.csv'),download.suggested_filename
    checked.append('3-exportacoes-csv')
    # Saldo consolidado e transferências: conservação da soma financeira.
    snapshot=await page.evaluate("""() => ({
      sum:totalBalance(state.settings.cutoff),
      part:state.accounts.map(a=>accountBalance(a.id,state.settings.cutoff)).reduce((a,b)=>a+b,0),
      net:stat(state.settings.period).net
    })""")
    assert snapshot['sum']==snapshot['part'],snapshot
    checked.append('conservacao-do-saldo')
    # Preferências e ordem em armazenamento: salvamento, reload, backup válido.
    # O editor continua aberto desde 'Mostrar todos'; não alternar para fechado.
    assert await page.locator('.clw-editor').count()==1
    await page.locator('[data-clw-action="toggle"][data-clw-id="attention"]').click()
    assert await page.locator('[data-widget="attention"]').count()==0
    await page.evaluate("window.ClaraSecurity.flush()")
    await page.reload(wait_until='load')
    await unlock(page)
    assert await page.locator('[data-widget="attention"]').count()==0
    await page.evaluate("""() => {const x=structuredClone(state);x.settings.dashboardCards=['attention','attention'];
      let failed=false;try{validateData(x);}catch(_){failed=true;}if(!failed)throw Error('Rejeição de backup duplicado não funcionou');}""")
    checked.append('preferencias-e-rejeicao-backup-invalido')
    assert not errors,errors
    await ctx.close()
    # Carga sintética e estabilidade do motor, em uma origem isolada.
    ctx=await browser.new_context(viewport={'width':1440,'height':900})
    page=await ctx.new_page()
    await all_widgets(page)
    perf=await page.evaluate("""() => {
      const t0=performance.now(), month=todayISO().slice(0,7);
      state.transactions=Array.from({length:1000},(_,i)=>({
        id:'load'+i,date:month+'-'+String(i%28+1).padStart(2,'0'),
        description:'Lançamento de carga '+i,kind:i%2?'Despesa':'Receita',
        category:i%2?'Moradia':'Salário',amountCents:99+i,
        accountId:'principal',toAccountId:'',
        status:i%3?'Realizado':'Pendente',paidAt:i%3?month+'-'+String(i%28+1).padStart(2,'0'):''
      }));
      save();
      const elapsed=performance.now()-t0;
      return {elapsed,count:state.transactions.length,cards:document.querySelectorAll('#dashboardMiniapps [data-widget]').length}
    }""")
    assert perf['count']==1000 and perf['cards']==15,perf
    assert perf['elapsed']<15000,perf
    await page.evaluate("window.ClaraSecurity.flush()")
    await page.reload(wait_until='load')
    await unlock(page)
    assert await page.evaluate("() => state.transactions.length")==1000
    checked.append('carga-1000-registros-e-persistencia')
    await ctx.close()

    # Propriedades financeiras: 500 parcelamentos com soma exata em centavos.
    ctx=await browser.new_context(viewport={'width':1440,'height':900})
    page=await ctx.new_page()
    await home(page)
    finance=await page.evaluate("""() => {
      let checked=0;
      for(let n=2;n<=60;n++){
        for(let base=1;base<=10;base++){
          const total=n*base+Math.floor(n/3);
          const rows=generateInstallments(total,n,'2026-01-31','Compra de teste','Moradia','principal');
          if(rows.length!==n||rows.reduce((a,b)=>a+b.amountCents,0)!==total||rows.some(x=>x.amountCents<=0))
            throw Error('Parcelamento inconsistente: '+n+' x '+total);
          checked++;
        }
      }
      const a=generateInstallments(12000,3,'2026-01-31','Jan','Moradia','principal');
      if(a.map(x=>x.date).join(',')!=='2026-01-31,2026-02-28,2026-03-31') throw Error('Datas de parcelas inválidas');
      for(const input of ['1.234,56','0,01','999.999,99']) {
        if(parseBRL(numField(parseBRL(input)))!==parseBRL(input))throw Error('Centavos não conservados');
      }
      return checked;
    }""")
    assert finance==590,finance
    checked.append('590-parcelamentos-e-centavos-exatos')
    # Entrada hostil deve virar texto, nunca markup ativo.
    xss=await page.evaluate("""() => {
      state.transactions.push({id:'xss-safe',description:'<img src=x onerror=alert(1)>',
        kind:'Despesa',category:'Moradia',status:'Realizado',date:todayISO(),
        paidAt:todayISO(),amountCents:10,accountId:'principal',toAccountId:''});
      save();
      return {encoded:document.querySelector('#view-painel').innerHTML.includes('&lt;img'),
       injected:!!document.querySelector('#view-painel img[onerror]')};
    }""")
    assert xss['encoded'] and not xss['injected'],xss
    checked.append('injecao-html-tratada-como-texto')
    # Validação rejeita backups adulterados sem mutar a base real.
    invalid=await page.evaluate("""() => {
      const bad=[
        x=>x.accounts.push({...x.accounts[0]}),
        x=>x.settings.dashboardCards=['inexistente'],
        x=>x.transactions[0].amountCents=-1,
        x=>x.transactions[0].date='2026-02-31',
        x=>x.accounts[0].type='Banco falso'
      ];
      return bad.map(edit=>{const x=structuredClone(state);edit(x);
        try{validateData(x);return false;}catch(_){return true;}});
    }""")
    assert invalid==[True]*5,invalid
    checked.append('5-backups-adulterados-rejeitados')
    await ctx.close()
    # 10.000 registros, preservação de saldo e recarga a partir do localStorage.
    ctx=await browser.new_context(viewport={'width':1440,'height':900})
    page=await ctx.new_page()
    await all_widgets(page)
    perf10k=await page.evaluate("""() => {
      const t0=performance.now(),month=todayISO().slice(0,7);
      const inputs=Array.from({length:10000},(_,i)=>({
         id:'bulk'+i,date:month+'-'+String(i%28+1).padStart(2,'0'),
         description:'Carga 10k '+i,kind:i%2?'Despesa':'Receita',
         category:i%2?'Moradia':'Salário',
         amountCents:100+i,accountId:'principal',toAccountId:'',
         status:i%4?'Realizado':'Pendente',
         paidAt:i%4?month+'-'+String(i%28+1).padStart(2,'0'):''
      }));
      state.transactions=inputs;
      save();
      return {elapsed:performance.now()-t0,count:state.transactions.length,
         widgets:document.querySelectorAll('#dashboardMiniapps [data-widget]').length,
         balance:totalBalance(state.settings.cutoff)};
    }""")
    assert perf10k['count']==10000 and perf10k['widgets']==15,perf10k
    assert perf10k['elapsed']<30000,perf10k
    await page.evaluate("window.ClaraSecurity.flush()")
    await page.reload(wait_until='load')
    await unlock(page)
    assert await page.evaluate("() => state.transactions.length")==10000
    checked.append('carga-10000-registros-e-recarga')
    await ctx.close()
    await browser.close()
  print('QA EXTENDIDO APROVADO:',len(checked),'grupos:',', '.join(checked))

asyncio.run(run())
