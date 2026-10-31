from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
preview=R.parent/'Clara_Financas_Preview_Etapa_02_Android.html'
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-web-security'])
 page=browser.new_page(viewport={'width':1420,'height':920},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 try:
  page.evaluate('''() => {
 const tables=new Map(); const db={createObjectStore(name){tables.set(name,new Map())},transaction(name){const table=tables.get(name); const tx={error:null,abort(){queueMicrotask(()=>this.onabort?.())},objectStore(){return{get(key){return req(()=>table.get(key))},put(value,key){return req(()=>{table.set(key, key==='folder'?value:structuredClone(value));return key})},delete(key){return req(()=>table.delete(key))}}}};function req(run){const r={};queueMicrotask(()=>{try{r.result=run();r.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.())}catch(e){tx.error=e;tx.onerror?.()}});return r;}return tx;}};
 Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){const r={result:db};queueMicrotask(()=>{if(!tables.size)r.onupgradeneeded?.();r.onsuccess?.()});return r;}}});
 }''')
  page.set_content(preview.read_text(encoding='utf-8'), wait_until='load')
  page.on('dialog',lambda d:d.accept())
  page.get_by_role('button',name='Configurações',exact=True).first.click()
  page.get_by_role('button',name='Carregar demonstração').click()
  page.get_by_role('button',name='Dashboard',exact=True).first.click()
  page.wait_for_timeout(400)
  print('URL',page.url)
  print('BODY',page.locator('body').inner_text()[:600])
  print('JS_ERRORS',errors)
  page.screenshot(path=str(R/'tests/dashboard-stage2-desktop.png'),full_page=True)
  page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(200)
  page.screenshot(path=str(R/'tests/dashboard-stage2-mobile.png'),full_page=True)
 finally:browser.close()
