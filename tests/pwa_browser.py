import asyncio
import json
from pathlib import Path
from playwright.async_api import async_playwright

PASSWORD = 'Clara-QA-Senha-2026!'
APP_VERSION = json.loads(Path('version.json').read_text(encoding='utf-8'))['version']

async def unlock(page):
    if await page.locator('#securityCover').is_visible():
        await page.locator('#securityPassword').fill(PASSWORD)
        if await page.locator('#securityConfirmWrap').is_visible():
            await page.locator('#securityConfirm').fill(PASSWORD)
        await page.locator('#securitySubmit').click()
        await page.wait_for_function("document.documentElement.dataset.unlocked==='true'", timeout=30000)

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for width in (390,768,1440):
            context = await browser.new_context(viewport={'width':width,'height':844})
            page = await context.new_page()
            errors = []
            page.on('pageerror', lambda ex:errors.append(str(ex)))
            await page.goto('http://127.0.0.1:8765/',wait_until='load')
            page.on('dialog', lambda dialog:asyncio.create_task(dialog.accept()))
            await unlock(page)
            await page.wait_for_function('navigator.serviceWorker.controller!==null',timeout=30000)
            assert await page.evaluate("window.ClaraSimple?.enabled") is True

            assert await page.evaluate("pref('reloadLock')") is True
            assert await page.evaluate("window.ClaraReloadGuard?.enabled") is True
            blocked=await page.evaluate("""() => {
              const f5=new KeyboardEvent('keydown',{key:'F5',cancelable:true,bubbles:true});
              document.dispatchEvent(f5);
              const ctrl=new KeyboardEvent('keydown',{key:'r',ctrlKey:true,cancelable:true,bubbles:true});
              document.dispatchEvent(ctrl);
              const cmd=new KeyboardEvent('keydown',{key:'R',metaKey:true,cancelable:true,bubbles:true});
              document.dispatchEvent(cmd);
              const leave=new Event('beforeunload',{cancelable:true});
              window.dispatchEvent(leave);
              return {f5:f5.defaultPrevented,ctrl:ctrl.defaultPrevented,cmd:cmd.defaultPrevented,leave:leave.defaultPrevented};
            }""")
            assert all(blocked.values()),blocked
            await page.evaluate("""() => {state.settings.reloadLock=false;save();}""")
            await page.evaluate("window.ClaraSecurity.flush()")
            assert await page.evaluate("window.ClaraReloadGuard.enabled") is False
            allowed=await page.evaluate("""() => {
              const shortcut=new KeyboardEvent('keydown',{key:'F5',cancelable:true,bubbles:true});
              document.dispatchEvent(shortcut);
              const leaving=new Event('beforeunload',{cancelable:true});
              window.dispatchEvent(leaving);
              return !shortcut.defaultPrevented && !leaving.defaultPrevented;
            }""")
            assert allowed
            await page.evaluate("""() => {state.settings.reloadLock=true;save();}""")
            await page.evaluate("window.ClaraSecurity.flush()")
            assert await page.evaluate("window.ClaraReloadGuard.enabled") is True
            await page.evaluate("window.ClaraReloadGuard.allowOfficialUpdate()")
            assert await page.evaluate("window.ClaraReloadGuard.enabled") is False

            await page.wait_for_function("document.querySelectorAll('#claraDesktopDock [data-view]').length===8",timeout=10000)
            assert await page.locator('#sideNav').count()==0
            assert await page.locator('.sidebar').count()==0
            assert await page.locator('#claraDesktopDock [data-view]').count()==8
            if width>760:
                assert await page.locator('#claraDesktopDock').is_visible()
            else:
                assert not await page.locator('#claraDesktopDock').is_visible()
            assert await page.locator('#view-painel .clara-balance').is_visible()
            assert await page.locator('#dashboardMiniapps').count()==0
            assert await page.evaluate("CLARA_WIDGETS.length")==15
            assert await page.locator('html').get_attribute('data-simple')=='true'
            v=await page.evaluate("({tx:state.transactions.length,acct:state.accounts.length,mode:pref('simpleMode')})")
            assert v=={'tx':0,'acct':1,'mode':True},v
            assert not errors,errors

            # O formulário de despesas é o formulário contábil original.
            await page.locator('#view-painel [data-clw-kind="Despesa"]').first.click()
            assert await page.locator('#modalBg').get_attribute('data-kind')=='transaction'
            assert await page.locator('#m_kind').input_value()=='Despesa'
            await page.locator('#closeModal').click()

            # QA dos motores avançados não perde dados nem altera o modo simples.
            qa=await page.evaluate('window.ClaraQA.run()')
            assert qa['passed']==qa['total'],[x for x in qa['results'] if x['status']!='APROVADO']
            await page.evaluate("go('painel')")
            assert await page.locator('.clara-balance').is_visible()

            if width<=760:
                await page.locator('#floatTrigger').click()
            else:
                await page.locator('#claraDesktopDock [data-view="mais"]').click()
            assert await page.locator('#view-mais').is_visible()
            assert await page.locator('#view-mais .clara-more-item').count()==7
            await page.locator('#view-mais [data-config-jump="dados"]').click()
            assert await page.locator('#pageTitle').inner_text()=='Configurações'
            assert await page.locator('#claraUpdateInstalled').inner_text()==APP_VERSION
            assert await page.locator('#exportJson').is_visible()
            assert await page.locator('#importClara').count()==1
            assert await page.locator('#claraAdvancedSettings').count()==1
            assert await page.locator('#view-ajustes [data-config-tab]:visible').count()==3
            await page.locator('[data-config-tab="aparencia"]').click()
            assert await page.locator('#themeSelect').is_visible()
            assert await page.locator('.palette-choice').count()==0

            # Trocar de modo não apaga as transações.
            await page.evaluate("""() => {
                state.transactions.push({id:'simple-qa',description:'Compra de teste',kind:'Despesa',
                  category:'Alimentação',amountCents:12500,accountId:'principal',
                  date:todayISO(),status:'Pendente',paidAt:''});
                save();
            }""")
            await page.evaluate("go('painel')")
            assert await page.locator('#view-painel .clara-simple-line').count()>=1
            await page.locator('#view-painel [data-toggle="simple-qa"]').click()
            tx=await page.evaluate("state.transactions.find(t=>t.id==='simple-qa')")
            assert tx['status']=='Realizado' and tx['paidAt']==tx['date'],tx
            await page.evaluate("go('mais')")
            await page.locator('[data-mode-toggle="advanced"]').click()
            assert await page.evaluate("pref('simpleMode')") is False
            assert await page.locator('#claraExitAdvanced').is_visible()
            assert await page.locator('#dashboardMiniapps [data-widget]').count()>=7
            await page.get_by_role('button',name='Editar painel').click()
            await page.get_by_role('button',name='Mostrar todos').click()
            assert await page.locator('#dashboardMiniapps [data-widget]').count()==15
            await page.locator('#claraExitAdvanced').click()
            assert await page.evaluate("pref('simpleMode')") is True
            await page.evaluate("go('painel')")
            assert await page.locator('#dashboardMiniapps [data-widget]').count()==0

            
            # 10 MB: arquivo PNG pequeno com payload adicional, convertido em JPEG compacto.
            outcome=await page.evaluate("""async () => {
              const original=new File([new Uint8Array(8*1024*1024)],'perfil.png',{type:'image/png'});
              const draw=document.createElement('canvas');draw.width=32;draw.height=32;
              draw.getContext('2d').fillRect(0,0,32,32);
              const native=window.createImageBitmap;
              window.createImageBitmap=async()=>({width:32,height:32,close(){},...{
                // Canvas é CanvasImageSource e pode ser desenhado diretamente.
              }});
              // Usar um Canvas real como retorno para testar o redimensionamento.
              window.createImageBitmap=async()=>draw;
              let photo;
              try{photo=await loadProfilePhoto(original);}finally{window.createImageBitmap=native;}
              const rejected=await loadProfilePhoto(new File([new Uint8Array(10*1024*1024+1)],'maior.png',{type:'image/png'}))
                .then(()=>false,()=>true);
              return {size:original.size,decoded:photo.startsWith('data:image/jpeg;base64,'),small:photo.length<120000,rejected};
            }""")
            assert outcome['size']>2*1024*1024 and outcome['decoded'] and outcome['small'] and outcome['rejected'],outcome

            # O banco cifrado deve existir no OPFS, sem dados financeiros em claro.
            storage=await page.evaluate("""async()=>{
              if(!window.ClaraPrivateFolder?.active)return {supported:false};
              await window.ClaraSecurity.flush();
              const root=await navigator.storage.getDirectory(),dir=await root.getDirectoryHandle('ClaraFinancas');
              const files=[];
              for await(const [name,entry] of dir.entries()){
                if(entry.kind!=='file')continue;
                const data=await (await entry.getFile()).text();
                files.push({name,envelope:data.includes('CLARA-OPFS-1'),encrypted:!data.includes('Compra de teste')});
              }
              return {supported:true,files};
            }""")
            if storage['supported']:
                assert storage['files'] and all(x['encrypted'] and x['envelope'] for x in storage['files']),storage
            assert await page.locator('#securityBiometric').count()==1
            assert await page.evaluate("window.ClaraBiometric?.enabled") is False
            # Dados continuam cifrados e o modo persiste após fechar o app.
            await page.evaluate("window.ClaraSecurity.flush()")
            raw=await page.evaluate("localStorage.getItem('clara-financas-vault-aesgcm-v1')")
            assert raw and 'Compra de teste' not in raw
            await page.reload(wait_until='load')
            await unlock(page)
            assert await page.evaluate("pref('simpleMode')") is True
            assert await page.evaluate("state.transactions.find(t=>t.id==='simple-qa').status")=='Realizado'
            assert await page.evaluate("pref('reloadLock')") is True
            assert await page.locator('.clara-balance').is_visible()
            assert not errors,errors
            await context.set_offline(True)
            await page.reload(wait_until='load')
            await unlock(page)
            assert await page.locator('#pageTitle').is_visible()
            assert await page.locator('.clara-balance').is_visible()
            assert not errors,errors
            # Regressão do aviso: o botão não deve desaparecer enquanto o pacote é preparado.
            await context.set_offline(False)
            await page.route("**/version.json?fresh=*",lambda route:route.fulfill(
                status=200,content_type='application/json',
                body='{"version":"9.9.9-rc","notes":["Atualização simulada para QA."]}'))
            await page.evaluate("window.ClaraUpdate.check(true)")
            await page.wait_for_function("window.ClaraUpdate.remoteVersion==='9.9.9-rc'",timeout=15000)
            assert await page.locator('#claraUpdateNotice').is_visible()
            assert await page.locator('#claraUpdateNoticeInstall').is_visible()
            assert await page.locator('#claraUpdateNoticeInstall').inner_text()=='Atualizar agora'
            assert await page.locator('#claraUpdateNoticeInstall').is_enabled()
            await page.locator('#claraUpdateNoticeInstall').click()
            await page.wait_for_function("document.getElementById('claraUpdateNoticeInstall').textContent==='Preparando…'",timeout=15000)
            assert await page.locator('#claraUpdateNoticeInstall').is_disabled()
            assert await page.evaluate("window.ClaraSecurity.unlocked") is True
            assert await page.evaluate("window.ClaraUpdate.installedVersion")==APP_VERSION
            await page.locator('#claraUpdateNoticeLater').click()
            assert not await page.locator('#claraUpdateNotice').is_visible()
            await page.unroute("**/version.json?fresh=*")
            assert not errors,errors
            print('QA Clara 4.0 OK:',width,'px — modo simples, avançado, cofre e offline')
            await context.close()
        await browser.close()

asyncio.run(run())
