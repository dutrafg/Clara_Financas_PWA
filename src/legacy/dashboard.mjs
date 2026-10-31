import {periodStats,budgetStatus,accountBalance} from './core.mjs';
import {cashflowForecast,allDebtSummaries} from './planning.mjs';
import {financeAudit} from './reconciliation.mjs';
export function dashboardInsights(data,month,{today=new Date().toISOString().slice(0,10)}={}){
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw Error('Mês inválido no painel.');
 const current=periodStats(data,month),limits=budgetStatus(data,month);
 const debts=allDebtSummaries(data),audit=financeAudit(data,{today});
 const forecast=cashflowForecast(data,month,3);
 const totalDebtCents=debts.reduce((n,d)=>n+d.remainingCents,0);
 const exhausted=limits.filter(x=>x.ratio>=1).sort((a,b)=>b.ratio-a.ratio);
 const nearLimit=limits.filter(x=>x.ratio>=0.8&&x.ratio<1);
 const goals=data.goals.map(x=>({...x,remainingCents:Math.max(0,x.targetCents-x.savedCents),
  percentage:x.targetCents?Math.min(1,x.savedCents/x.targetCents):0}));
 const alerts=[
  ...audit.findings.filter(x=>x.code==='OVERDUE').slice(0,4),
  ...exhausted.slice(0,3).map(x=>({code:'BUDGET_OVER',level:'attention',label:'Orçamento atingido: '+x.category})),
  ...audit.findings.filter(x=>x.code==='BALANCE_MISMATCH').slice(0,3),
  ...nearLimit.slice(0,2).map(x=>({code:'BUDGET_NEAR',level:'warning',label:'Orçamento próximo do limite: '+x.category}))
 ].slice(0,8);
 return {current,totalDebtCents,goals,alerts,nearLimitCount:nearLimit.length,exhaustedCount:exhausted.length,
  forecast,netRate:current.income?current.result/current.income:null,
  spendingRate:current.income?current.expense/current.income:null,
  pendingNetCents:current.pendingIncome-current.pending,
  accountCount:data.accounts.filter(a=>!a.archived).length,
  compromisedCents:current.pending+totalDebtCents,
  accountBalances:data.accounts.map(a=>({id:a.id,name:a.name,balanceCents:accountBalance(data,a.id)})),
  auditCount:audit.findings.length};
}
