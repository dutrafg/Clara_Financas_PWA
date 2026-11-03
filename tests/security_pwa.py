"""QA do cadastro obrigatório, migração e persistência criptografada."""
import asyncio
from playwright.async_api import async_playwright

BASE='http://127.0.0.1:8765/'
PWD='Clara-QA-Senha-2026!'

async def main():
  async with async_playwright() as p:
    browser=await p.chromium.launch(headless=True)
    context=await browser.new_context(viewport={'width':390,'height':844})
    page=await context.new_page()
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    await page.goto(BASE,wait_until='load')
    assert await page.locator('#securityCover').is_visible()
    assert not await page.locator('.shell').is_visible()
    await page.evaluate("""() => {
      const legacy=structuredClone(state);
      legacy.accounts[0].openingCents=123456;
      legacy.transactions.push({
        id:'mig-qa',description:'QA-SEGREDO-NAO-PLAIN',
        kind:'Receita',category:'Salário',amountCents:9001,
        accountId:'principal',toAccountId:'',status:'Realizado',
        date:todayISO(),paidAt:todayISO()
      });
      localStorage.setItem('clara-html-preview-planilha-optio-v2',JSON.stringify(legacy));
    }""")
    await page.reload(wait_until='load')
    assert await page.locator('#securityCover').is_visible()
    await page.locator('#securityPassword').fill(PWD)
    await page.locator('#securityConfirm').fill(PWD)
    await page.locator('#securitySubmit').click()
    await page.wait_for_function("document.documentElement.dataset.unlocked==='true'",timeout=30000)
    saved=await page.evaluate("""() => ({
      plain:localStorage.getItem('clara-html-preview-planilha-optio-v2'),
      vault:localStorage.getItem('clara-financas-vault-aesgcm-v1'),
      record:state.transactions.find(t=>t.id==='mig-qa')
    })""")
    assert saved['plain'] is None,saved
    assert saved['vault'] and 'QA-SEGREDO-NAO-PLAIN' not in saved['vault']
    assert saved['record']['amountCents']==9001
    await page.reload(wait_until='load')
    assert await page.locator('#securityCover').is_visible()
    assert not await page.locator('.shell').is_visible()
    await page.locator('#securityPassword').fill('Senha-Incorreta-2026!')
    await page.locator('#securitySubmit').click()
    await page.wait_for_function("!document.getElementById('securitySubmit').disabled && document.getElementById('securityStatus').textContent.length>0",timeout=30000)
    assert await page.locator('#securityCover').is_visible()
    await page.locator('#securityPassword').fill(PWD)
    await page.locator('#securitySubmit').click()
    await page.wait_for_function("document.documentElement.dataset.unlocked==='true'",timeout=30000)
    assert await page.evaluate("state.transactions.some(t=>t.id==='mig-qa')")
    await page.evaluate("""() => {state.accounts[0].openingCents=77777;save();}""")
    await page.evaluate('window.ClaraSecurity.flush()')
    await page.reload(wait_until='load')
    await page.locator('#securityPassword').fill(PWD)
    await page.locator('#securitySubmit').click()
    await page.wait_for_function("document.documentElement.dataset.unlocked==='true'",timeout=30000)
    assert await page.evaluate("state.accounts[0].openingCents===77777")
    audit=await page.evaluate("""() => {
      const period=todayISO(),item={id:'audit-qa',date:period,
        description:'Registro auditável QA',kind:'Despesa',category:'Moradia',
        amountCents:1200,accountId:'principal',toAccountId:'',
        status:'Realizado',paidAt:period};
      state.transactions.push(item);save();
      state.transactions.find(t=>t.id==='audit-qa').amountCents=1500;save();
      state.transactions=state.transactions.filter(t=>t.id!=='audit-qa');save();
      const ev=state.auditLog.filter(e=>e.ref==='audit-qa');
      return {actions:ev.map(e=>e.action),before:ev[1]?.before,after:ev[1]?.after,
        year:ev[0]?.month,current:period.slice(0,7),total:state.auditLog.length};
    }""")
    assert audit['actions']==['Criado','Editado','Excluído'],audit
    assert '12,00' in audit['before'] and '15,00' in audit['after'],audit
    assert audit['year']==audit['current']
    await page.evaluate('window.ClaraSecurity.flush()')
    encrypted=await page.evaluate("localStorage.getItem('clara-financas-vault-aesgcm-v1')")
    assert 'Registro auditável QA' not in encrypted
    await page.reload(wait_until='load')
    await page.locator('#securityPassword').fill(PWD)
    await page.locator('#securitySubmit').click()
    await page.wait_for_function("document.documentElement.dataset.unlocked==='true'",timeout=30000)
    assert await page.evaluate("state.auditLog.filter(e=>e.ref==='audit-qa').length===3")
    # Importação de arquivo .clara externo deve criar snapshot ANTES de substituir.
    # Uma falha no snapshot precisa impedir a restauração por completo.
    backup_raw=await page.evaluate("localStorage.getItem('clara-financas-vault-aesgcm-v1')")
    await page.evaluate("() => {state.accounts[0].openingCents=22222;save();}")
    await page.evaluate('window.ClaraSecurity.flush()')
    await page.evaluate("() => {configTab='dados';go('ajustes');}")
    page.on('dialog',lambda dialog:asyncio.create_task(dialog.accept(PWD if dialog.type=='prompt' else None)))
    await page.evaluate("() => {window.__originalSafety=window.ClaraBackups.beforeUpdate;window.ClaraBackups.beforeUpdate=async()=>{throw Error('QA: snapshot indisponível');};}")
    await page.locator('#importClara').set_input_files({
      'name':'clara-recuperacao-qa.clara','mimeType':'application/octet-stream','buffer':backup_raw.encode('utf-8')
    })
    await page.locator('#confirmModalBtn').wait_for(timeout=30000)
    await page.locator('#confirmModalBtn').click()
    await page.wait_for_function("document.getElementById('toast').textContent.includes('QA: snapshot indisponível')",timeout=30000)
    assert await page.evaluate("state.accounts[0].openingCents===22222"),'Restauração ocorreu sem snapshot'
    await page.evaluate("() => {window.ClaraBackups.beforeUpdate=window.__originalSafety;delete window.__originalSafety;}")
    # Segundo teste: backup externo autenticado substitui o cofre, mantendo
    # ponto de recuperação cifrado com o saldo imediatamente anterior.
    await page.locator('#importClara').set_input_files({
      'name':'clara-recuperacao-qa.clara','mimeType':'application/octet-stream','buffer':backup_raw.encode('utf-8')
    })
    await page.locator('#confirmModalBtn').wait_for(timeout=30000)
    await page.locator('#confirmModalBtn').click()
    await page.wait_for_function("state.accounts[0].openingCents===77777",timeout=30000)
    await page.evaluate('window.ClaraSecurity.flush()')
    before=await page.evaluate("""async() => {
      const entry=window.ClaraBackups.entries.find(x=>x.name.startsWith('safety-'));
      if(!entry)return null;
      const root=await navigator.storage.getDirectory();
      const dir=await (await root.getDirectoryHandle('ClaraFinancas')).getDirectoryHandle('Backups');
      const raw=await (await (await dir.getFileHandle(entry.name)).getFile()).text();
      const v=validateVault(raw),k=await deriveKey('Clara-QA-Senha-2026!',b64Bytes(v.salt));
      const restored=await decryptState(v,k);
      return {name:entry.name,oldCents:restored.accounts[0].openingCents,encrypted:!raw.includes('QA-SEGREDO-NAO-PLAIN')};
    }""")
    assert before and before['oldCents']==22222 and before['encrypted'],before
    assert not errors,errors
    print('COFRE APROVADO: senha, persistência, restauração externa segura e snapshot anterior')
    await context.close()
    await browser.close()
asyncio.run(main())
