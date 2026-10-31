/* Clara Finanças — Etapa 4: parcelamentos determinísticos em centavos.
   Sem lançamentos automáticos em segundo plano. Parcelas são independentes e
   pendentes até confirmação explícita do pagamento. */
import {uid,validateTransaction,isISODate} from './core.mjs';
import {dateAtRecurrence} from './movements.mjs';

const checkCents=(value,label,allowZero=true)=>{
 if(!Number.isSafeInteger(value)||value<(allowZero?0:1)||value>1_000_000_000_000)
  throw Error(label+' inválido (valor em centavos).');
 return value;
};
export function installmentSchedule({purchaseCents,downPaymentCents=0,feesCents=0,monthlyRateBps=0,count,firstDueDate}){
 checkCents(purchaseCents,'Valor da compra',false);
 checkCents(downPaymentCents,'Entrada');checkCents(feesCents,'Encargos');
 if(downPaymentCents>purchaseCents)throw Error('A entrada não pode exceder a compra.');
 if(!Number.isInteger(count)||count<2||count>60)throw Error('Informe entre 2 e 60 parcelas.');
 if(!Number.isInteger(monthlyRateBps)||monthlyRateBps<0||monthlyRateBps>2500)
  throw Error('Juros mensais inválidos: máximo 25% ao mês, duas casas decimais.');
 if(!isISODate(firstDueDate))throw Error('Informe um primeiro vencimento válido.');
 const financedCents=purchaseCents-downPaymentCents+feesCents;
 checkCents(financedCents,'Saldo financiado',false);
 if(financedCents<count)throw Error('O saldo financiado deve permitir pelo menos R$ 0,01 por parcela.');
 let balance=financedCents;const rows=[];
 if(monthlyRateBps===0){
  const base=Math.floor(financedCents/count),extra=financedCents%count;
  for(let i=0;i<count;i++){
   const amountCents=base+(i<extra?1:0);
   balance-=amountCents;
   rows.push({index:i+1,dueDate:dateAtRecurrence(firstDueDate,'monthly',i),
    principalCents:amountCents,interestCents:0,amountCents,balanceCents:balance});
  }
 }else{
  const rate=monthlyRateBps/10000;
  const fixedPayment=Math.round(financedCents*rate/(1-Math.pow(1+rate,-count)));
  checkCents(fixedPayment,'Prestação calculada',false);
  for(let i=0;i<count;i++){
   const interestCents=Number((BigInt(balance)*BigInt(monthlyRateBps)+5000n)/10000n);
   const amountCents=i===count-1?balance+interestCents:fixedPayment;
   const principalCents=amountCents-interestCents;
   if(principalCents<=0||principalCents>balance||!Number.isSafeInteger(amountCents))
    throw Error('Não foi possível amortizar esta operação. Ajuste taxa, valor ou prazo.');
   balance-=principalCents;
   rows.push({index:i+1,dueDate:dateAtRecurrence(firstDueDate,'monthly',i),
    principalCents,interestCents,amountCents,balanceCents:balance});
  }
 }
 if(balance!==0)throw Error('Erro de arredondamento no saldo final.');
 const totalInterestCents=rows.reduce((sum,r)=>sum+r.interestCents,0);
 const totalInstallmentsCents=rows.reduce((sum,r)=>sum+r.amountCents,0);
 if(totalInstallmentsCents!==financedCents+totalInterestCents)
  throw Error('Conferência de parcelas não fechou em centavos.');
 return {financedCents,purchaseCents,downPaymentCents,feesCents,monthlyRateBps,count,
  totalInterestCents,totalInstallmentsCents,totalPayableCents:totalInstallmentsCents+downPaymentCents,rows};
}
export function createInstallmentMovements(params,data){
 const {description,category,accountId,purchaseDate,firstDueDate}=params;
 if(!String(description||'').trim())throw Error('Informe a descrição da compra.');
 if(!isISODate(purchaseDate))throw Error('Data da compra inválida.');
 if(!isISODate(firstDueDate)||firstDueDate<purchaseDate)
  throw Error('O primeiro vencimento não pode ser anterior à compra.');
 if(!data.accounts.some(a=>a.id===accountId))throw Error('Conta inválida.');
 if(!data.categories.some(c=>c.name===category&&c.group==='Despesa'))
  throw Error('Categoria de despesa inválida.');
 const plan=installmentSchedule(params);
 if(data.transactions.length+plan.count+(plan.downPaymentCents>0?1:0)>250000)
  throw Error('Limite de movimentações do banco atingido.');
 const groupId=uid('parcel');const common={kind:'Despesa',category,accountId,toAccountId:'',
  paidAt:'',status:'Pendente',note:'Gerado pelo assistente de parcelamento',installmentGroupId:groupId,
  installmentCount:plan.count};
 const entries=[];
 if(plan.downPaymentCents>0)entries.push({...common,id:uid('tx'),date:purchaseDate,
  description:description.trim()+' — entrada',amountCents:plan.downPaymentCents,
  installmentIndex:0,installmentPrincipalCents:plan.downPaymentCents,installmentInterestCents:0});
 for(const row of plan.rows){
  entries.push({...common,id:uid('tx'),date:row.dueDate,
   description:description.trim()+' — '+row.index+'/'+plan.count,
   amountCents:row.amountCents,installmentIndex:row.index,
   installmentPrincipalCents:row.principalCents,installmentInterestCents:row.interestCents});
 }
 entries.forEach(tx=>validateTransaction(tx,data));
 return {...plan,groupId,entries};
}
export function summarizeInstallmentGroups(data){
 const groups=new Map();
 for(const tx of data.transactions){
  if(!tx.installmentGroupId)continue;
  let g=groups.get(tx.installmentGroupId);
  if(!g){g={id:tx.installmentGroupId,count:tx.installmentCount,entries:[],totalCents:0,
   paidCents:0,pendingCents:0,interestCents:0,overdueCents:0};groups.set(g.id,g);}
  g.entries.push(tx);
  if(tx.status!=='Cancelado'){
   g.totalCents+=tx.amountCents;g.interestCents+=(tx.installmentInterestCents||0);
   if(tx.status==='Realizado')g.paidCents+=tx.amountCents;
   if(tx.status==='Pendente')g.pendingCents+=tx.amountCents;
  }
 }
 return [...groups.values()].map(g=>({...g,entries:g.entries.sort((a,b)=>a.installmentIndex-b.installmentIndex),
  completed:g.entries.filter(x=>x.installmentIndex>0&&x.status==='Realizado').length,
  canceled:g.entries.filter(x=>x.status==='Cancelado').length}))
  .sort((a,b)=>(b.entries[0]?.date||'').localeCompare(a.entries[0]?.date||''));
}
