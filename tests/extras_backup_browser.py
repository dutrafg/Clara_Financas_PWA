"""QA de lembretes, notas e backup criptografado em 2 larguras de tela."""
import asyncio
from playwright.async_api import async_playwright

URL='http://127.0.0.1:8765/'
PASSWORD='Clara-Teste-Cofre-2026!'

async def run():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True)
        for width in (390,1440):
            context=await browser.new_context(viewport={'width':width,'height':920},timezone_id='America/Sao_Paulo',accept_downloads=True)
            page=await context.new_page()
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            async def confirm_dialog(dialog):
                await dialog.accept(PASSWORD if dialog.type=='prompt' else None)
            page.on('dialog',lambda d:asyncio.create_task(confirm_dialog(d)))
            await page.goto(URL,wait_until='load')
            await page.locator('#securityGuest').click()
            assert await page.evaluate('window.ClaraGuest.active') is True
            assert await page.locator('#claraExtras').is_visible()
            assert await page.locator('#claraBackupCard').is_visible()
            assert await page.evaluate('state.quickNotes.length')==1
            assert await page.evaluate('state.reminders.length')==1
            await page.locator('#clxReminderList [data-clx="edit-reminder"]').click()
            assert await page.locator('#claraExtrasModal').count()==0
            await page.locator('#clxNotesList [data-clx="view-note"]').click()
            assert await page.locator('#claraExtrasModal').is_visible()
            await page.locator('[data-clx="close"]').click()
            assert await page.evaluate('window.ClaraSecurity.unlocked') is False
            assert await page.evaluate('window.ClaraBackups.entries.length')==0
            await page.locator('#claraGuestCreate').click()
            await page.locator('#securityPassword').fill(PASSWORD)
            await page.locator('#securityConfirm').fill(PASSWORD)
            await page.locator('#securitySubmit').click()
            await page.wait_for_function('window.ClaraSecurity.unlocked',timeout=30000)
            assert await page.evaluate('state.reminders.length')==0
            assert await page.evaluate('state.quickNotes.length')==0
            await page.locator('#claraExtras [data-clx="new-reminder"]').click()
            await page.locator('#claraExtrasForm [name="title"]').fill('Pagar conta fictícia')
            await page.locator('#claraExtrasForm [name="dueDate"]').fill(await page.evaluate('todayISO()'))
            await page.locator('#claraExtrasForm [name="time"]').fill('23:59')
            await page.locator('#claraExtrasForm [name="priority"]').select_option('high')
            await page.locator('#claraExtrasForm [name="detail"]').fill('Lembrete do teste automatizado')
            await page.locator('#claraExtrasForm [type="submit"]').click()
            assert await page.evaluate('state.reminders.length')==1
            assert await page.evaluate('state.reminders[0].priority')=='high'
            assert await page.evaluate("window.ClaraAgenda.notifications.some(n=>n.kind==='reminder')")
            assert await page.locator('#claraCalendar [data-ca-reminder]').count()>=1
            await page.locator('#claraExtras [data-clx="new-note"]').click()
            await page.locator('#claraExtrasForm [name="title"]').fill('Nota de exemplo')
            await page.locator('#claraExtrasForm [name="content"]').fill('Conteúdo privado e protegido')
            await page.locator('#claraExtrasForm [name="pinned"]').check()
            await page.locator('#claraExtrasForm [type="submit"]').click()
            assert await page.evaluate('state.quickNotes.length')==1
            assert await page.evaluate('state.quickNotes[0].pinned') is True
            await page.locator('#clxNoteSearch').fill('exemplo')
            assert await page.locator('#clxNotesList .clx-item').count()==1
            await page.locator('#clxNoteSearch').fill('inexistente')
            assert await page.locator('#clxNotesList .clx-item').count()==0
            await page.locator('#clxNoteSearch').fill('')
            await page.evaluate('window.ClaraSecurity.flush()')
            vault=await page.evaluate("localStorage.getItem('clara-financas-vault-aesgcm-v1')")
            assert vault and 'Pagar conta fictícia' not in vault and 'Conteúdo privado' not in vault
            assert await page.evaluate("pref('autoBackup')") is True
            assert await page.evaluate("window.ClaraBackups.next.getHours()")==2
            await page.evaluate("window.ClaraBackups.create('manual')")
            await page.evaluate("window.ClaraBackups.create('daily')")
            names=await page.evaluate("window.ClaraBackups.entries.map(x=>x.name)")
            assert any(x.startswith('daily-') for x in names),names
            assert any(x.startswith('manual-') for x in names),names
            backup=await page.evaluate("""async()=>{
               const root=await navigator.storage.getDirectory();
               const folder=await root.getDirectoryHandle('ClaraFinancas');
               const dir=await folder.getDirectoryHandle('Backups');
               const filenames=[];
               for await(const [filename,handle] of dir.entries()){
                 if(handle.kind!=='file')continue;
                 const raw=await (await handle.getFile()).text();
                 filenames.push({name:filename,encrypted:!raw.includes('Conteúdo privado')&&raw.includes('CLARA-VAULT-1')});
               }
               return filenames;
            }""")
            assert backup and all(x['encrypted'] for x in backup),backup
            await page.locator('#clxNotesList [data-clx="delete-note"]').click()
            assert await page.evaluate('state.quickNotes.length')==0
            await page.evaluate('window.ClaraSecurity.flush()')
            name=next(x for x in names if x.startswith('manual-'))
            await page.evaluate("""async name=>{
              const raw=await (await (await (await navigator.storage.getDirectory())
                .getDirectoryHandle('ClaraFinancas')).getDirectoryHandle('Backups')).getFileHandle(name);
              await window.ClaraSecurity.restoreLocalEncrypted(await (await raw.getFile()).text(), 'Clara-Teste-Cofre-2026!');
            }""",name)
            await page.evaluate('window.ClaraSecurity.flush()')
            assert await page.evaluate('state.quickNotes.length')==1
            await page.reload(wait_until='load')
            if await page.locator('#securityCover').is_visible():
                await page.locator('#securityPassword').fill(PASSWORD)
                await page.locator('#securitySubmit').click()
                await page.wait_for_function('window.ClaraSecurity.unlocked',timeout=30000)
            assert await page.evaluate('state.quickNotes[0].title')=='Nota de exemplo'
            assert await page.evaluate('state.reminders[0].title')=='Pagar conta fictícia'
            assert not errors,errors
            print('LEMBRETES + NOTAS + BACKUP QA OK',width)
            await context.close()
        await browser.close()

asyncio.run(run())
