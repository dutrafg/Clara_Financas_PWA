/* Etapa 6: projeções determinísticas por vencimento e dívidas acompanhadas.
   Os valores são inteiros em centavos. Projeções NÃO representam previsão
   de salário ou novas despesas não cadastradas. Sem chamada a serviços externos. */
import {uid,isISODate,accountBalance,validateTransaction,effectiveDate} from './core.mjs';

const money=(value,label,{allowZero=false}={})=>{
 if(!Number.isSafeInteger(value)||value<(allowZero?0:1)||value>1_000_000_000_000)
  throw Error(label+' inválido: informe um valor em centavos.');
 return value;
};
const name=(value,label)=>{
 const cleaned=String(value??'').trim().replace(/\s+/g,' ');
 if(cleaned.length<2||cleaned.length>100)throw Error(label+' precisa conter de 2 a 100 caracteres.');
 return cleaned;
};
const monthPattern=/^20\d{2}-(0[1-9]|1[0-2])$/;
const checkMonth=month=>{if(!monthPattern.test(month||''))throw Error('Informe mês de referência válido.');return month;};
const moveMonth=(month,offset)=>{
 checkMonth(month);
 const [year,m]=month.split('-').map(Number);
 const dt=new Date(Date.UTC(year,m-1+offset,1));
 const result=dt.toISOString().slice(0,7);
 if(!monthPattern.test(result))throw Error('Período fora do intervalo permitido.');
 return result;
};
const group=(d,id)=>{const debt=(d.debts||[]).find(x=>x.id===id);if(!debt)throw Error('Dívida não encontrada.');return debt;};
export function addDebt(data,{name:label,creditor,totalCents,openingPaidCents=0,monthlyCents=0,dueDate='',category='Outros'}){
 const title=name(label,'Descrição da dívida'),payee=name(creditor,'Credor');
 money(totalCents,'Total da dívida');money(openingPaidCents,'Valor já pago',{allowZero:true});
 money(monthlyCents,'Pagamento mensal',{allowZero:true});
 if(openingPaidCents>totalCents)throw Error('Valor já pago excede a dívida.');
 if(dueDate&&!isISODate(dueDate))throw Error('Vencimento inválido.');
 if(!(data.debts||[]).length&&data.debts===undefined)data.debts=[];
 if(data.debts.length>=10000)throw Error('Limite de dívidas atingido.');
 if(!data.categories.some(c=>c.name===category&&c.group==='Despesa'))
  throw Error('Selecione uma categoria de despesa existente.');
 const debt={id:uid('debt'),name:title,creditor:payee,totalCents,openingPaidCents,
  monthlyCents,dueDate,category};
 data.debts.push(debt);return debt;
}
export function updateDebt(data,id,form){
 const debt=group(data,id);
 const changes={name:name(form.name,'Descrição da dívida'),creditor:name(form.creditor,'Credor'),
  totalCents:money(form.totalCents,'Total da dívida'),
  monthlyCents:money(form.monthlyCents,'Pagamento mensal',{allowZero:true}),
  dueDate:form.dueDate||'',category:form.category};
 if(changes.dueDate&&!isISODate(changes.dueDate))throw Error('Vencimento inválido.');
 if(!data.categories.some(c=>c.name===changes.category&&c.group==='Despesa'))
  throw Error('Categoria de despesa inválida.');
 if(changes.totalCents<debtSummary(data,debt).paidCents)throw Error('O total não pode ficar abaixo do valor já pago.');
 Object.assign(debt,changes);return debt;
}
export function debtSummary(data,debt){
 const installments=data.transactions.filter(t=>t.debtId===debt.id);
 const paidTransactions=installments.filter(t=>t.kind==='Despesa'&&t.status==='Realizado');
 const paidCents=debt.openingPaidCents+paidTransactions.reduce((sum,t)=>sum+t.amountCents,0);
 const pendingCents=installments.filter(t=>t.kind==='Despesa'&&t.status==='Pendente').reduce((sum,t)=>sum+t.amountCents,0);
 return {...debt,paidCents,remainingCents:Math.max(0,debt.totalCents-paidCents),
  scheduledCents:pendingCents,ratio:Math.min(1,paidCents/debt.totalCents),
  settled:paidCents>=debt.totalCents,payments:paidTransactions.length};
}
export function allDebtSummaries(data){return (data.debts||[]).map(d=>debtSummary(data,d));}
export function deleteDebt(data,id){
 group(data,id);
 if(data.transactions.some(t=>t.debtId===id))throw Error('Dívida vinculada a pagamentos não pode ser excluída; mantenha seu histórico.');
 data.debts=data.debts.filter(d=>d.id!==id);return true;
}
export function recordDebtPayment(data,{debtId,accountId,amountCents,date,description}){
 const debt=group(data,debtId);
 const amount=money(amountCents,'Pagamento');
 if(!isISODate(date))throw Error('Data de pagamento inválida.');
 const acc=data.accounts.find(a=>a.id===accountId);
 if(!acc||acc.archived)throw Error('Selecione uma conta ativa.');
 const remaining=debtSummary(data,debt).remainingCents;
 if(amount>remaining)throw Error('Pagamento excede o saldo da dívida.');
 const tx={id:uid('tx'),date,paidAt:date,description:(description||'Pagamento: '+debt.name).trim(),
  kind:'Despesa',category:debt.category,amountCents:amount,accountId,
  toAccountId:'',status:'Realizado',note:'Pagamento vinculado ao controle de dívidas',debtId};
 validateTransaction(tx,data);
 data.transactions.push(tx);return tx;
}
export function setGoalSaved(data,id,savedCents){
 money(savedCents,'Total reservado',{allowZero:true});
 const goal=data.goals.find(g=>g.id===id);
 if(!goal)throw Error('Meta não encontrada.');
 goal.savedCents=savedCents;return goal;
}
export function goalPace(goal,referenceMonth){
 checkMonth(referenceMonth);
 const remainingCents=Math.max(0,goal.targetCents-goal.savedCents);
 if(!goal.dueDate)return {remainingCents,monthsLeft:null,monthlyRequiredCents:null,overdue:false,achieved:remainingCents===0};
 if(!isISODate(goal.dueDate))throw Error('Prazo da meta inválido.');
 const end=goal.dueDate.slice(0,7);
 const [y1,m1]=referenceMonth.split('-').map(Number),[y2,m2]=end.split('-').map(Number);
 const monthsLeft=Math.max(0,(y2-y1)*12+m2-m1+1);
 return {remainingCents,monthsLeft,monthlyRequiredCents:monthsLeft?Math.ceil(remainingCents/monthsLeft):remainingCents,
  overdue:monthsLeft===0&&remainingCents>0,achieved:remainingCents===0};
}
export function cashflowForecast(data,fromMonth,count=6){
 checkMonth(fromMonth);
 if(!Number.isInteger(count)||count<1||count>12)throw Error('Projeção deve abranger de 1 a 12 meses.');
 const cutoff=fromMonth+'-01';
 const prevDay=new Date(Date.UTC(Number(fromMonth.slice(0,4)),Number(fromMonth.slice(5,7))-1,0)).toISOString().slice(0,10);
 let balance=data.accounts.reduce((sum,a)=>sum+accountBalance(data,a.id,prevDay),0);
 return Array.from({length:count},(_,offset)=>{
  const month=moveMonth(fromMonth,offset);
  let incomeCents=0,expenseCents=0,transfersCents=0,plannedCents=0,realizedCents=0;
  for(const tx of data.transactions){
   if(tx.status==='Cancelado')continue;
   const assigned=tx.status==='Realizado'?effectiveDate(tx):tx.date;
   if(assigned.slice(0,7)!==month)continue;
   if(tx.kind==='Transferência'){transfersCents+=tx.amountCents;continue;}
   if(tx.kind==='Receita')incomeCents+=tx.amountCents;
   if(tx.kind==='Despesa')expenseCents+=tx.amountCents;
   if(tx.status==='Pendente')plannedCents+=tx.amountCents;
   else realizedCents+=tx.amountCents;
  }
  const openingCents=balance;balance+=incomeCents-expenseCents;
  return {month,openingCents,incomeCents,expenseCents,netCents:incomeCents-expenseCents,
   closingCents:balance,plannedCents,realizedCents,transfersCents};
 });
}
