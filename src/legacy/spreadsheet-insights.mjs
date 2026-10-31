/* Visão financeira baseada nos indicadores adicionais da planilha Clara Optio.
   Não altera o armazenamento; opera somente sobre centavos e datas dos lançamentos. */
import {accountBalance,budgetStatus,periodStats,isISODate} from './core.mjs';
const oneDay=86400000;
const addDays=(iso,n)=>{
 const [year,month,day]=iso.split('-').map(Number);
 return new Date(Date.UTC(year,month-1,day+n)).toISOString().slice(0,10);
};
const monthPlus=(month,n)=>{
 const [y,m]=month.split('-').map(Number);
 return new Date(Date.UTC(y,m-1+n,1)).toISOString().slice(0,7);
};
const totalAsOf=(d,date)=>d.accounts.reduce((sum,a)=>sum+accountBalance(d,a.id,date),0);
export function spreadsheetInsights(data,month,cutoff){
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw Error('Mês inválido.');
 if(!isISODate(cutoff))throw Error('Data de corte inválida.');
 const closingCents=totalAsOf(data,cutoff);
 const horizon=addDays(cutoff,30);
 const pendingNext30Cents=data.transactions
  .filter(t=>t.status==='Pendente'&&t.kind==='Despesa'&&t.date<=horizon)
  .reduce((sum,t)=>sum+t.amountCents,0);
 const reserveCents=data.accounts
  .filter(a=>a.type==='Reserva')
  .reduce((sum,a)=>sum+accountBalance(data,a.id,cutoff),0);
 const budgets=budgetStatus(data,month).sort((a,b)=>b.usedCents-a.usedCents).slice(0,5);
 const goals=data.goals.slice(0,5).map(g=>({
  id:g.id,name:g.name,targetCents:g.targetCents,savedCents:g.savedCents,
  ratio:g.targetCents>0?Math.min(1,g.savedCents/g.targetCents):0,
  missingCents:Math.max(0,g.targetCents-g.savedCents)
 }));
 let projected=closingCents;
 const flow4=Array.from({length:4},(_,n)=>{
  const period=monthPlus(cutoff.slice(0,7),n);
  let incomingCents=0,outgoingCents=0;
  for(const t of data.transactions){
   if(t.status!=='Pendente'||t.date<=cutoff||t.date.slice(0,7)!==period)continue;
   if(t.kind==='Receita')incomingCents+=t.amountCents;
   else if(t.kind==='Despesa')outgoingCents+=t.amountCents;
  }
  const openingCents=projected;
  projected+=incomingCents-outgoingCents;
  return {month:period,openingCents,incomingCents,outgoingCents,closingCents:projected};
 });
 const allBudgets=budgetStatus(data,month);
 return {month,cutoff,closingCents,pendingNext30Cents,
  availableAfter30Cents:closingCents-pendingNext30Cents,
  reserveCents,budgets,goals,flow4,
  budgetTotalCents:allBudgets.reduce((sum,b)=>sum+b.limitCents,0),
  budgetUsedCents:allBudgets.reduce((sum,b)=>sum+b.usedCents,0),
  budgetProjectedCents:allBudgets.reduce((sum,b)=>sum+b.projectedCents,0),
  budgetOverLimit:allBudgets.filter(b=>b.limitCents>0&&b.projectedCents>b.limitCents).length};
}
