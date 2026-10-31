/* Conciliação manual de saldos de extrato, sem acesso bancário remoto. */
import {uid,isISODate,accountBalance,effectiveDate} from './core.mjs';
const safeMoney=(x)=>Number.isSafeInteger(x)&&Math.abs(x)<=1_000_000_000_000;
export function reconcileAccount(data,{accountId,asOfDate,statementCents,note=''}) {
 if(!data.accounts.some(a=>a.id===accountId))throw Error('Conta não encontrada.');
 if(!isISODate(asOfDate))throw Error('Data de referência inválida.');
 if(!safeMoney(statementCents))throw Error('Saldo informado inválido.');
 if(typeof note!=='string'||note.length>300)throw Error('Observação excede 300 caracteres.');
 data.reconciliations??=[];
 if(data.reconciliations.length>=10000)throw Error('Limite de conferências atingido.');
 if(data.reconciliations.some(r=>r.accountId===accountId&&r.asOfDate===asOfDate))
  throw Error('Já existe conferência dessa conta nesta data. Exclua a anterior para refazer.');
 const calculatedCents=accountBalance(data,accountId,asOfDate);
 const entry={id:uid('rec'),accountId,asOfDate,statementCents,calculatedCents,
   differenceCents:statementCents-calculatedCents,note:note.trim(),createdAt:new Date().toISOString()};
 data.reconciliations.push(entry);return entry;
}
export function deleteReconciliation(data,id){
 const index=(data.reconciliations||[]).findIndex(r=>r.id===id);
 if(index<0)throw Error('Conferência não encontrada.');
 return data.reconciliations.splice(index,1)[0];
}
export function reconciliationHistory(data){
 return (data.reconciliations||[]).map(r=>{
  const currentCents=accountBalance(data,r.accountId,r.asOfDate);
  return {...r,currentCents,currentDifferenceCents:r.statementCents-currentCents,
    stale:currentCents!==r.calculatedCents,matched:r.statementCents===currentCents};
 }).sort((a,b)=>b.asOfDate.localeCompare(a.asOfDate)||b.createdAt.localeCompare(a.createdAt));
}
export function financeAudit(data,{today=new Date().toISOString().slice(0,10)}={}){
 if(!isISODate(today))throw Error('Data da auditoria inválida.');
 const findings=[];const seen=new Map();
 for(const t of data.transactions){
  const key=[t.kind,t.accountId,t.toAccountId||'',t.date,t.description.trim().toLocaleLowerCase('pt-BR'),t.amountCents].join('|');
  if(t.status!=='Cancelado'){
   if(seen.has(key))findings.push({code:'DUPLICATE',level:'warning',ids:[seen.get(key),t.id],label:'Possível lançamento duplicado: '+t.description});
   else seen.set(key,t.id);
  }
  if(t.status==='Pendente'&&t.date<today)
   findings.push({code:'OVERDUE',level:'attention',ids:[t.id],label:'Lançamento vencido: '+t.description});
  if(t.status==='Realizado'&&t.paidAt&&t.paidAt>today)
   findings.push({code:'FUTURE_PAYMENT',level:'warning',ids:[t.id],label:'Pagamento datado no futuro: '+t.description});
 }
 for(const r of reconciliationHistory(data)){
  if(!r.matched)findings.push({code:'BALANCE_MISMATCH',level:'attention',ids:[r.id],
    label:'Divergência na conta '+(data.accounts.find(a=>a.id===r.accountId)?.name||'desconhecida')});
  if(r.stale)findings.push({code:'STALE_RECONCILIATION',level:'warning',ids:[r.id],label:'Histórico alterado após conciliação'});
 }
 return {findings,duplicates:findings.filter(f=>f.code==='DUPLICATE').length,
  overdue:findings.filter(f=>f.code==='OVERDUE').length,
  mismatches:findings.filter(f=>f.code==='BALANCE_MISMATCH').length};
}
