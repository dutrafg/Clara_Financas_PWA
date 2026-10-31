import {periodStats,accountBalance,brl,effectiveDate} from './core.mjs';
const monthRegex=/^20\d{2}-(0[1-9]|1[0-2])$/;
export function monthlyReport(data,month){
 if(!monthRegex.test(month||''))throw Error('Mês do relatório inválido.');
 const s=periodStats(data,month),tx=data.transactions.filter(t=>effectiveDate(t).slice(0,7)===month)
  .sort((a,b)=>effectiveDate(a).localeCompare(effectiveDate(b))||a.id.localeCompare(b.id));
 const categories=s.expensesByCategory.map(([name,cents])=>({name,cents,share:s.expense?cents/s.expense:0}));
 return {month,summary:{income:s.income,expense:s.expense,net:s.result,toPay:s.pending,toReceive:s.pendingIncome,
  canceled:s.cancelled,transferCount:s.transfers,count:tx.length,consolidatedCents:s.totalBalance},
  categories,accounts:data.accounts.map(a=>({name:a.name,archived:!!a.archived,balanceCents:accountBalance(data,a.id)})),
  transactions:tx};
}
export function annualReport(data,year){
 if(!/^20\d{2}$/.test(year||''))throw Error('Ano inválido.');
 const months=Array.from({length:12},(_,i)=>monthlyReport(data,`${year}-${String(i+1).padStart(2,'0')}`));
 return {year,months:months.map(m=>({month:m.month,...m.summary})),
  income:months.reduce((s,m)=>s+m.summary.income,0),
  expense:months.reduce((s,m)=>s+m.summary.expense,0),
  net:months.reduce((s,m)=>s+m.summary.net,0)};
}
function safeCell(value){
 let text=String(value??'').replace(/\r\n?/g,'\n');
 if(/^[\s]*[=+@-]/.test(text)&&typeof value==='string')text="'"+text;
 return '"'+text.replace(/"/g,'""')+'"';
}
function csv(rows){
 return '\uFEFF'+rows.map(r=>r.map(safeCell).join(';')).join('\r\n')+'\r\n';
}
export function monthlyReportCSV(data,month){
 const r=monthlyReport(data,month);
 return csv([['Relatório financeiro Clara',month],['Receitas',r.summary.income/100],['Despesas',r.summary.expense/100],
 ['Resultado',r.summary.net/100],['Pendências a pagar',r.summary.toPay/100],[],
 ['Categoria','Despesa (R$)','Participação (%)'],...r.categories.map(c=>[c.name,c.cents/100,(c.share*100).toFixed(2)]),
 [],['Data efetiva','Descrição','Tipo','Categoria','Conta','Valor (R$)','Situação'],
 ...r.transactions.map(t=>[effectiveDate(t),t.description,t.kind,t.category,
 data.accounts.find(a=>a.id===t.accountId)?.name||'',t.amountCents/100,t.status])]);
}
export function annualReportCSV(data,year){
 const r=annualReport(data,year);
 return csv([['Clara Finanças - anual',year],['Mês','Receitas (R$)','Despesas (R$)','Resultado (R$)','Pendências a pagar (R$)'],
 ...r.months.map(m=>[m.month,m.income/100,m.expense/100,m.net/100,m.toPay/100]),
 ['TOTAL',r.income/100,r.expense/100,r.net/100,'']]);
}
