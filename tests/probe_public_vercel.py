"""Leitura pública das duas URLs do Clara em navegador limpo. Não acessa o cofre."""
import asyncio
import json
from playwright.async_api import async_playwright

HOSTS=[
 "https://clarafinancaspwa-eosin.vercel.app/",
 "https://clarafinancaspwa-contatodutragf-8183.vercel.app/"
]

async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True)
  try:
   for host in HOSTS:
    for mobile in (False,True):
     context=await browser.new_context(
      viewport={"width":390 if mobile else 1280,"height":844 if mobile else 800},
      user_agent=("Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36")
                 if mobile else None,
      ignore_https_errors=False)
     page=await context.new_page()
     errors=[]
     requests=[]
     page.on("pageerror",lambda e:errors.append("JS: "+str(e)))
     page.on("requestfailed",lambda req:requests.append(
       {"url":req.url,"failure":str(req.failure)}))
     page.on("response",lambda res:requests.append(
       {"url":res.url,"status":res.status}) if res.status>=400 else None)
     try:
      response=await page.goto(host,wait_until="domcontentloaded",timeout=25000)
      await page.wait_for_timeout(3500)
      print("PROBE",json.dumps({
       "url":host,"mobile":mobile,"status":response.status if response else None,
       "finalUrl":page.url,"title":await page.title(),
       "appVersion":await page.evaluate(
        "typeof CLARA_APP_VERSION==='string'?CLARA_APP_VERSION:null"),
       "errors":errors[:10],"requests":requests[:20],
       "htmlStart":(await page.content())[:120]
      },ensure_ascii=False),flush=True)
     except Exception as exc:
      print("PROBE_ERROR",json.dumps({
       "url":host,"mobile":mobile,"exception":str(exc)[:650],
       "finalUrl":page.url,"errors":errors[:10],"requests":requests[:20]
      },ensure_ascii=False),flush=True)
     finally:
      await context.close()
  finally:
   await browser.close()

asyncio.run(main())
