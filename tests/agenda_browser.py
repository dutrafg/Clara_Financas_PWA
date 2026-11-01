"""Clara Finanças 4.0.6: calendário/agenda, sino e integração financeira em três viewports."""
import asyncio
from playwright.async_api import async_playwright

URL='http://127.0.0.1:8765/'
PASS='Clara-QA-Senha-2026!'

async def unlock(page):
    if await page.locator('#securityCover').is_visible():
        await page.locator('#securityPassword').fill(PASS)
        if await page.locator('#securityConfirmWrap').is_visible():
            await page.locator('#securityConfirm').fill(PASS)
        await page.locator('#securitySubmit').click()
        await page.wait_for_function("document.documentElement.dataset.unlocked==='true'", timeout=30000)

async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(headless=True)
        for width in (390,768,1440):
            context=await browser.new_context(viewport={'width':width,'height':900})
            page=await context.new_page()
            errors=[]
            page.on('pageerror', lambda x:errors.append(str(x)))
            page.on('dialog',lambda d:asyncio.create_task(d.accept()))
            await page.goto(URL,wait_until='load')
            await unlock(page)
            await page.locator('#claraCalendar').wait_for(timeout=12000)
            # Relógio local controlado: uma hora, véspera, atraso e eventos sem hora.
            reminder=await page.evaluate("""() => {
              const day='2026-11-01',next='2026-11-02';
              const ev=(date,time,reminder)=>({date,time,reminder,done:false});
              const at=t=>new Date(t);
              const fn=window.ClaraAgenda.reminderFor;
              return {
                hour:fn(ev(day,'09:30','both'),at(day+'T08:45:00')),
                today:fn(ev(day,'09:30','both'),at(day+'T07:00:00')),
                late:fn(ev(day,'09:30','both'),at(day+'T10:00:00')),
                day:fn(ev(next,'09:30','both'),at(day+'T12:00:00')),
                noDay:fn(ev(next,'09:30','hour'),at(day+'T12:00:00')),
                withoutClock:fn(ev(day,'','none'),at(day+'T07:00:00')),
                nextDayHour:fn(ev(next,'00:30','both'),at(day+'T23:45:00')),
                done:fn({...ev(day,'09:30','both'),done:true},at(day+'T08:45:00'))
              };
            }""")
            assert reminder=={
              'hour':'Compromisso em até 1 hora',
              'today':'Compromisso de hoje',
              'late':'Compromisso atrasado',
              'day':'Compromisso amanhã',
              'noDay':'',
              'withoutClock':'Compromisso de hoje',
              'nextDayHour':'Compromisso em até 1 hora',
              'done':''
            },reminder

            assert await page.locator('#claraCalendar [data-ca-day]').count() in (28,30,35,42)
            assert await page.locator('#claraNotificationButton').is_visible()
            bell=await page.evaluate("""() => {
                const el=document.getElementById('claraNotificationButton'),r=el.getBoundingClientRect();
                return {position:getComputedStyle(el).position,right:innerWidth-r.right,top:r.top,
                        inBody:el.parentElement===document.body,styled:!!el.querySelector('.ca-apple-bell')};
            }""")
            assert bell['position']=='fixed' and bell['inBody'] and bell['styled'],bell
            assert 7<=bell['right']<=35 and 7<=bell['top']<=50,bell
            dock=await page.evaluate("""() => {
                const sidebarRemoved=!document.querySelector('.sidebar,#sideNav'),
                      wide=document.getElementById('claraDesktopDock'),
                      mobile=document.querySelector('.mobile-dock'),
                      r=wide.getBoundingClientRect(),
                      styles=getComputedStyle(wide);
                return {sidebarHidden:sidebarRemoved,
                        wideVisible:styles.display!=='none'&&r.height>0,
                        desktopCount:wide.querySelectorAll('button[data-view]').length,
                        mobileVisible:getComputedStyle(mobile).display!=='none'};
            }""")
            assert dock['sidebarHidden'] and dock['desktopCount']==8,dock
            if width>760:
                assert dock['wideVisible'] and not dock['mobileVisible'],dock
                assert await page.locator('#claraDesktopDock [data-view="conf"]').is_visible()
                assert await page.locator('#claraDesktopDock [data-view="historico"]').is_visible()
                assert await page.locator('#claraDesktopDock [data-view="ajustes"]').is_visible()
                await page.locator('#claraDesktopDock [data-view="conf"]').click()
                assert await page.locator('#view-conf').is_visible()
                await page.locator('#claraDesktopDock [data-view="historico"]').click()
                assert await page.locator('#view-historico').is_visible()
                await page.locator('#claraDesktopDock [data-view="painel"]').click()
            else:
                assert not dock['wideVisible'] and dock['mobileVisible'],dock
            await page.evaluate("""() => {
                const e=document.createElement('div');e.id='claraScrollProbe';
                e.style.height='1700px';e.setAttribute('aria-hidden','true');
                document.body.appendChild(e);
                window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});
            }""")
            await page.wait_for_function("window.scrollY>100",timeout=6000)
            moved=await page.evaluate("""() => {
                const e=document.getElementById('claraNotificationButton'),r=e.getBoundingClientRect();
                return {right:innerWidth-r.right,top:r.top,scroll:scrollY};
            }""")
            assert moved['scroll']>100 and abs(moved['right']-bell['right'])<2 and abs(moved['top']-bell['top'])<2,(bell,moved)
            await page.evaluate("""() => {
                document.getElementById('claraScrollProbe').remove();
                window.scrollTo({top:0,behavior:'instant'});
            }""")

            assert await page.locator('#claraCalendar .ca-agenda').is_visible()
            assert await page.evaluate('window.ClaraAgenda?.entries.length') == 0
            await page.locator('[data-ca-new]').first.click()
            assert await page.locator('#claraAgendaForm').is_visible()
            await page.locator('#claraAgendaForm [name="title"]').fill('Consulta de teste')
            await page.locator('#claraAgendaForm [name="date"]').fill(await page.evaluate('todayISO()'))
            await page.locator('#claraAgendaForm [name="time"]').fill('23:59')
            await page.locator('#claraAgendaForm [name="notes"]').fill('Compromisso fictício para QA')
            await page.locator('#claraAgendaForm [type="submit"]').click()
            assert await page.locator('#claraAgendaForm').count()==0
            assert await page.evaluate('state.calendarEvents.length')==1
            assert await page.locator('#claraCalendar .ca-item').count()>=1
            assert await page.evaluate('window.ClaraAgenda.notifications.some(n=>n.kind==="appointment")')
            await page.locator('#claraNotificationButton').click()
            assert await page.locator('#claraNotificationPanel').is_visible()
            assert await page.evaluate("getComputedStyle(document.getElementById('claraNotificationPanel')).position")=='fixed'
            assert await page.locator('#claraNotificationPanel .ca-notification').count()>=1
            await page.locator('#claraNotificationPanel [data-ca-readall]').click()
            assert await page.evaluate('state.notificationsRead.length')>=1
            await page.locator('#claraNotificationPanel [data-ca-close-bell]').click()

            # Lançamento, meta e compromisso alimentam a mesma agenda.
            await page.evaluate("""() => {
                const dt=todayISO(),account=state.accounts[0].id,category=state.categories.find(c=>c.group==='Despesa').name;
                state.transactions.push({id:'qacaltx',description:'Boleto fictício',kind:'Despesa',
                    category,amountCents:12500,date:dt,status:'Pendente',paidAt:'',accountId:account,toAccountId:''});
                state.goals.push({id:'qacalgoal',name:'Objetivo fictício',savedCents:100,targetCents:10000,dueDate:dt});
                persistSuccess('Itens de teste registrados.');
            }""")
            assert await page.locator('#claraCalendar .ca-item').count()>=3
            assert await page.evaluate('window.ClaraAgenda.notifications.some(n=>n.kind==="tx")')
            assert await page.evaluate('window.ClaraAgenda.notifications.some(n=>n.kind==="goal")')
            assert await page.locator('#claraCalendar [data-ca-tx="qacaltx"]').is_visible()
            assert await page.locator('#claraCalendar [data-ca-goal="qacalgoal"]').is_visible()

            # Edição e conclusão em um único cofre.
            await page.locator('#claraCalendar [data-ca-edit]').first.click()
            await page.locator('#claraAgendaForm [name="title"]').fill('Consulta alterada')
            await page.locator('#claraAgendaForm [type="submit"]').click()
            assert await page.evaluate("state.calendarEvents[0].title")=='Consulta alterada'
            await page.locator('#claraCalendar [data-ca-toggle]').first.click()
            assert await page.evaluate("state.calendarEvents[0].done") is True
            await page.evaluate("window.ClaraSecurity.flush()")
            raw=await page.evaluate("localStorage.getItem('clara-financas-vault-aesgcm-v1')")
            assert raw and 'Consulta alterada' not in raw and 'Boleto fictício' not in raw
            # Modo avançado compartilha exatamente a mesma agenda.
            await page.evaluate("go('mais')")
            await page.locator('[data-mode-toggle="advanced"]').click()
            assert await page.evaluate("pref('simpleMode')") is False
            assert await page.locator('#claraCalendar').is_visible()
            assert await page.locator('#claraNotificationButton').is_visible()
            assert await page.evaluate("state.calendarEvents.length")==1
            await page.locator('#claraExitAdvanced').click()
            assert await page.evaluate("pref('simpleMode')") is True
            assert await page.locator('#claraCalendar').is_visible()
            await page.evaluate("window.ClaraSecurity.flush()")
            await page.reload(wait_until='load')
            await unlock(page)
            await page.locator('#claraCalendar').wait_for()
            assert await page.evaluate("state.calendarEvents[0].title")=='Consulta alterada'
            assert await page.evaluate("state.calendarEvents[0].done") is True
            assert await page.evaluate("state.notificationsRead.length")>=1

            # Avisos de nova versão devem ser observáveis pelo sino.
            notice=await page.evaluate("""() => {
                Object.defineProperty(window.ClaraUpdate,'remoteVersion',{get:()=> '99.0.0',configurable:true});
                window.ClaraAgenda.render();
                return window.ClaraAgenda.notifications.find(n=>n.kind==='update')?.title||'';
            }""")
            assert notice,notice
            await page.locator('#claraNotificationButton').click()
            assert await page.locator('#claraNotificationPanel .ca-notification').count()>=1
            await page.locator('#claraNotificationPanel [data-ca-alert^="update:"]').click()
            assert await page.locator('#pageTitle').inner_text()=='Configurações'
            assert not errors,errors
            await context.close()
            print('AGENDA + SINO QA OK:',width,'px')
        await browser.close()

asyncio.run(main())
