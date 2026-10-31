"""Leitura somente de valores-cache XLSX por zipfile/XML para verificar paridade.
Sem dependência de Excel instalado; nunca edita o arquivo original.
Os valores de comparação vêm das fórmulas calculadas salvas no arquivo Excel.
"""
from pathlib import Path
from subprocess import check_output
import zipfile, xml.etree.ElementTree as ET, json, re
ROOT=Path(__file__).resolve().parents[1]
XLSX=ROOT.parent/'Clara_Financas_Dashboard_Pro.xlsx'
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'

def parse_cached_sheets(path):
  with zipfile.ZipFile(path) as z:
    rel={r.attrib['Id']:r.attrib['Target'] for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    wb=ET.fromstring(z.read('xl/workbook.xml'))
    ss=[]
    if 'xl/sharedStrings.xml' in z.namelist():
      ss=[''.join(t.text or '' for t in si.findall('.//m:t',NS)) for si in ET.fromstring(z.read('xl/sharedStrings.xml'))]
    result={}
    for sheet in wb.findall('.//m:sheet',NS):
      target=rel[sheet.attrib[R]]
      xml=target.lstrip('/') if target.startswith('/') else 'xl/'+target
      dom=ET.fromstring(z.read(xml));entries={}
      for cell in dom.findall('.//m:sheetData/m:row/m:c',NS):
        v=cell.find('m:v',NS)
        if v is None or not v.text:continue
        value=v.text
        if cell.attrib.get('t')=='s':value=ss[int(value)]
        entries[cell.attrib['r']]=value
      result[sheet.attrib['name']]=entries
    return result

def cents(v):return int(round(float(v)*100))

if __name__=='__main__':
  book=parse_cached_sheets(XLSX)
  code="""import fs from 'node:fs';import {deriveDemo,periodStats,accountBalance,budgetStatus} from './src/core.mjs';
const raw=JSON.parse(fs.readFileSync('dados-demonstracao.json','utf8'));const d=deriveDemo(raw);const out={monthly:{},accounts:{},budgets:{}};
for(let m=1;m<=12;m++){let s=periodStats(d,'2026-'+String(m).padStart(2,'0'));out.monthly[m]=[s.income,s.expense,s.result];}
for(const a of d.accounts)out.accounts[a.name]=accountBalance(d,a.id);
for(const b of budgetStatus(d,'2026-10'))out.budgets[b.category]=[b.usedCents,b.projectedCents];
console.log(JSON.stringify(out));"""
  actual=json.loads(check_output(['node','--input-type=module','-e',code],cwd=ROOT,text=True));count=0
  def check(label,one,two):
    global count
    if one!=two:raise AssertionError(f'{label}: Excel={one}; PWA={two}')
    count+=1
  for m in range(1,13):
    row=m+5
    for col,i in [('L',0),('M',1),('N',2)]:
      check(f'Painel {col}{row}',cents(book['Painel'][f'{col}{row}']),actual['monthly'][str(m)][i])
  check('Painel G6 saldo consolidado',cents(book['Painel']['G6']),sum(actual['accounts'].values()))
  for r in range(5,9):
    name=book['Ajustes'][f'E{r}']
    check(f'Ajustes H{r} {name}',cents(book['Ajustes'][f'H{r}']),actual['accounts'][name])
  for r in range(6,26):
    name=book['Planejamento'].get(f'A{r}')
    group=book['Planejamento'].get(f'B{r}')
    if name and group=='Despesa':
      expected=cents(book['Planejamento'].get(f'D{r}','0'))
      projected=cents(book['Planejamento'].get(f'E{r}','0'))
      if name in actual['budgets']:
        check(f'Planejamento D{r} {name}',expected,actual['budgets'][name][0])
        check(f'Planejamento E{r} {name}',projected,actual['budgets'][name][1])
  print(f'OK: {count} valores-calculados confrontados com os caches das 6 abas da planilha (fluxo anual, saldos e orçamentos).')
