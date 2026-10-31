/* Clara Finanças — Etapa 1/10. Motor financeiro determinístico, valores em centavos.
   Regras de caixa compatíveis com colunas A/I/K/N de Movimentações da planilha.
   Não usa Date.parse para comparar datas no fuso local. */
export const VERSION='0.2.0';
export const SCHEMA_VERSION=2;
const DEFAULT_CATEGORIES=[
 ['Salário','Receita'],['Renda extra','Receita'],['Outros recebimentos','Receita'],
 ['Moradia','Despesa'],['Alimentação','Despesa'],['Transporte','Despesa'],['Contas fixas','Despesa'],['Saúde','Despesa'],['Educação','Despesa'],['Lazer','Despesa'],['Compras','Despesa'],['Assinaturas','Despesa'],['Outros','Despesa']
];
export function uid(prefix='id'){return `${prefix}-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;}
export function blankData(){return {schemaVersion:SCHEMA_VERSION,appVersion:VERSION,isDemo:false,revision:0,updatedAt:new Date().toISOString(),accounts:[{id:uid('acc'),name:'Conta principal',type:'Conta',openingCents:0}],categories:DEFAULT_CATEGORIES.map(([name,group])=>({id:uid('cat'),name,group})),budgets:[],transactions:[],goals:[],debts:[],settings:{theme:'light',accent:'petrol',hideValues:false,selectedPeriod:new Date().toISOString().slice(0,7),monthlySavingsCents:0,reviewDay:1}};}
export const brl=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(cents)||0)/100);
export const isISODate=iso=>{if(typeof iso!=='string'||!/^(19|20)\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(iso))return false;const [y,m,d]=iso.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,d));return dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;};
export const fmtDate=iso=>isISODate(iso)?`${iso.slice(8)}/${iso.slice(5,7)}/${iso.slice(0,4)}`:'—';
export function parseMoney(value){const raw=String(value??'').trim().replace(/\s|R\$/gi,'');if(!raw)return NaN;let canonical=raw;
 if(raw.includes(',')&&raw.includes('.'))canonical=raw.lastIndexOf(',')>raw.lastIndexOf('.')?raw.replace(/\./g,'').replace(',','.'):raw.replace(/,/g,'');
 else if(raw.includes(','))canonical=raw.replace(/\./g,'').replace(',','.');
 else if(/^\d{1,3}(\.\d{3})+$/.test(raw))canonical=raw.replace(/\./g,'');
 if(!/^\d+(\.\d{1,2})?$/.test(canonical))return NaN;
 const [whole,dec='']=canonical.split('.');const cents=Number(whole)*100+Number(dec.padEnd(2,'0'));return Number.isSafeInteger(cents)?cents:NaN;
}
export const inMonth=(date,month)=>typeof date==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(month||'')&&date.slice(0,7)===month;
export const realized=t=>t.status==='Realizado';
export const effectiveDate=t=>realized(t)?(t.paidAt||t.date):t.date;
export function signedMovement(t,accountId){if(!realized(t))return 0;const amount=t.amountCents;
 if(t.kind==='Receita')return t.accountId===accountId?amount:0;
 if(t.kind==='Despesa')return t.accountId===accountId?-amount:0;
 if(t.kind==='Transferência')return (t.accountId===accountId?-amount:0)+(t.toAccountId===accountId?amount:0);
 return 0;
}
export function accountBalance(data,id,asOfDate=null){const acc=data.accounts.find(a=>a.id===id);if(!acc)return 0;let sum=acc.openingCents;for(const t of data.transactions){if(asOfDate&&effectiveDate(t)>asOfDate)continue;sum+=signedMovement(t,id);}return sum;}
export function periodStats(data,month){let income=0,expense=0,pending=0,pendingIncome=0,cancelled=0,transfers=0;const categories=new Map(),daily=new Map(),recent=[];
 for(const t of data.transactions){const selected=inMonth(effectiveDate(t),month);if(!selected)continue;recent.push(t);
  if(t.status==='Cancelado'){cancelled++;continue;}
  if(!realized(t)){if(t.kind==='Despesa')pending+=t.amountCents;if(t.kind==='Receita')pendingIncome+=t.amountCents;continue;}
  if(t.kind==='Transferência'){transfers++;continue;}
  if(t.kind==='Receita')income+=t.amountCents;
  if(t.kind==='Despesa'){expense+=t.amountCents;categories.set(t.category,(categories.get(t.category)||0)+t.amountCents);}
  const day=effectiveDate(t),v=daily.get(day)||{income:0,expense:0};v[t.kind==='Receita'?'income':'expense']+=t.amountCents;daily.set(day,v);
 }
 const balances=data.accounts.map(a=>({...a,balanceCents:accountBalance(data,a.id)}));
 return {month,income,expense,result:income-expense,pending,pendingIncome,cancelled,transfers,accounts:balances,totalBalance:balances.reduce((s,a)=>s+a.balanceCents,0),expensesByCategory:[...categories].sort((a,b)=>b[1]-a[1]),daily,recent:recent.sort((a,b)=>effectiveDate(b).localeCompare(effectiveDate(a))).slice(0,100),transactionsCount:recent.length};
}
export function budgetStatus(data,month){const s=periodStats(data,month);return data.budgets.map(b=>{const usedCents=s.expensesByCategory.find(([cat])=>cat===b.category)?.[1]||0;const pendingCents=data.transactions.filter(t=>t.kind==='Despesa'&&t.status==='Pendente'&&t.category===b.category&&inMonth(t.date,month)).reduce((n,t)=>n+t.amountCents,0);const projectedCents=usedCents+pendingCents;return {...b,usedCents,pendingCents,projectedCents,remainingCents:b.limitCents-projectedCents,ratio:b.limitCents?projectedCents/b.limitCents:0};});}
export function validateTransaction(t,data){if(!t||typeof t!=='object')throw Error('Lançamento inválido.');if(!isISODate(t.date))throw Error('Informe uma data de vencimento válida.');if(t.paidAt&&!isISODate(t.paidAt))throw Error('Informe uma data de pagamento válida.');if(!String(t.description||'').trim())throw Error('Informe a descrição.');if(!Number.isSafeInteger(t.amountCents)||t.amountCents<=0)throw Error('O valor deve ser maior que zero.');if(!['Receita','Despesa','Transferência'].includes(t.kind))throw Error('Tipo de movimento inválido.');if(!['Realizado','Pendente','Cancelado'].includes(t.status))throw Error('Situação inválida.');if(!data.accounts.some(a=>a.id===t.accountId))throw Error('Selecione uma conta válida.');if(t.kind==='Transferência'&&(!data.accounts.some(a=>a.id===t.toAccountId)||t.toAccountId===t.accountId))throw Error('Selecione outra conta para receber a transferência.');if(t.kind!=='Transferência'&&!data.categories.some(c=>c.name===t.category&&c.group===t.kind))throw Error('Selecione uma categoria válida para o tipo.');if(t.status!=='Realizado'&&t.paidAt)throw Error('Apenas lançamentos realizados podem ter data de pagamento.');
 if(t.debtId!==undefined){
   if(typeof t.debtId!=='string'||!t.debtId.trim()||t.kind!=='Despesa'||!(data.debts||[]).some(x=>x.id===t.debtId&&x.category===t.category))throw Error('Vínculo de pagamento da dívida inválido.');
 }
 if(t.recurrenceGroupId||t.recurrenceIndex||t.recurrenceCount||t.recurrenceFrequency){
  if(typeof t.recurrenceGroupId!=='string'||!t.recurrenceGroupId.trim()||!Number.isInteger(t.recurrenceIndex)||!Number.isInteger(t.recurrenceCount)||t.recurrenceCount<2||t.recurrenceCount>24||t.recurrenceIndex<1||t.recurrenceIndex>t.recurrenceCount||!['weekly','monthly','yearly'].includes(t.recurrenceFrequency))throw Error('Dados de recorrência inválidos.');
 }
 // Metadados opcionais de parcelamento, compatíveis com backups v1/v2.
 // Índice 0 identifica exclusivamente a entrada; 1..N são prestações.
 if(t.installmentGroupId!==undefined||t.installmentIndex!==undefined||
    t.installmentCount!==undefined||t.installmentPrincipalCents!==undefined||
    t.installmentInterestCents!==undefined){
  if(t.kind!=='Despesa'||typeof t.installmentGroupId!=='string'||!t.installmentGroupId.trim()||
     !Number.isInteger(t.installmentIndex)||!Number.isInteger(t.installmentCount)||
     t.installmentCount<2||t.installmentCount>60||
     t.installmentIndex<0||t.installmentIndex>t.installmentCount||
     !Number.isSafeInteger(t.installmentPrincipalCents)||t.installmentPrincipalCents<=0||
     !Number.isSafeInteger(t.installmentInterestCents)||t.installmentInterestCents<0||
     t.installmentPrincipalCents+t.installmentInterestCents!==t.amountCents||
     (t.installmentIndex===0&&t.installmentInterestCents!==0)||
     t.recurrenceGroupId)throw Error('Metadados de parcelamento inválidos.');
 }return true;}
/* Migração explícita, sem alterar o backup original. O v1 não tinha contrato formal para paidAt:
   quando ausente, a data de vencimento é a data efetiva, como no Excel. */
export function migrateData(input){if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Backup inválido.');if(input.schemaVersion!==1&&input.schemaVersion!==2)throw Error('Versão do banco incompatível.');const data=structuredClone(input);
 if(data.schemaVersion===1){for(const t of (data.transactions||[])){t.paidAt=t.status==='Realizado'?(t.paidAt||t.date):'';}data.schemaVersion=SCHEMA_VERSION;}
 data.settings??={theme:'light',accent:'petrol',hideValues:false,selectedPeriod:new Date().toISOString().slice(0,7)};
 data.settings.monthlySavingsCents??=0;
 data.settings.reviewDay??=1;
 data.debts??=[];
 data.appVersion=VERSION;
 return data;
}
function uniqueSet(items,key,message){const set=new Set();for(const item of items){const v=item?.[key];if(typeof v!=='string'||!v||set.has(v))throw Error(message);set.add(v);}return set;}
export function validateBackup(d){if(!d||typeof d!=='object'||d.schemaVersion!==SCHEMA_VERSION||!Array.isArray(d.accounts)||!Array.isArray(d.transactions)||!Array.isArray(d.categories)||!Array.isArray(d.budgets)||!Array.isArray(d.goals)||(d.debts!==undefined&&!Array.isArray(d.debts)))throw Error('Arquivo não é um backup compatível do Clara Finanças.');
 if(d.accounts.length<1||d.accounts.length>10000||d.transactions.length>250000||d.categories.length>10000||d.budgets.length>10000||d.goals.length>10000||(d.debts||[]).length>10000)throw Error('Backup excede os limites ou não possui contas.');
 uniqueSet(d.accounts,'id','Contas inválidas ou duplicadas no backup.');uniqueSet(d.categories,'id','Categorias inválidas ou duplicadas no backup.');uniqueSet(d.transactions,'id','Movimentações duplicadas ou sem identificador.');uniqueSet(d.goals,'id','Metas duplicadas ou sem identificador.');if(d.debts)uniqueSet(d.debts,'id','Dívidas duplicadas ou sem identificador.');
 const names=new Set(),categories=new Set();for(const a of d.accounts){if(typeof a.name!=='string'||!a.name.trim()||!Number.isSafeInteger(a.openingCents)||(a.archived!==undefined&&typeof a.archived!=='boolean'))throw Error('Dados inválidos em conta.');const n=a.name.trim().toLocaleLowerCase('pt-BR');if(names.has(n))throw Error('Nomes de contas duplicados.');names.add(n);}
 for(const c of d.categories){if(typeof c.name!=='string'||!c.name.trim()||!['Receita','Despesa'].includes(c.group)||(c.archived!==undefined&&typeof c.archived!=='boolean'))throw Error('Categoria inválida.');const k=c.group+'|'+c.name.trim().toLocaleLowerCase('pt-BR');if(categories.has(k))throw Error('Categorias duplicadas.');categories.add(k);}
 for(const debt of (d.debts||[])){
  if(typeof debt.name!=='string'||debt.name.trim().length<2||typeof debt.creditor!=='string'||debt.creditor.trim().length<2||
   !Number.isSafeInteger(debt.totalCents)||debt.totalCents<=0||debt.totalCents>1_000_000_000_000||
   !Number.isSafeInteger(debt.openingPaidCents)||debt.openingPaidCents<0||debt.openingPaidCents>debt.totalCents||
   !Number.isSafeInteger(debt.monthlyCents)||debt.monthlyCents<0||debt.monthlyCents>1_000_000_000_000||
   (debt.dueDate&&!isISODate(debt.dueDate))||
   !d.categories.some(c=>c.group==='Despesa'&&c.name===debt.category))
   throw Error('Dívida inválida no backup.');
 }
 for(const t of d.transactions)validateTransaction(t,d);
 for(const debt of (d.debts||[])){
  const paid=d.transactions.filter(t=>t.debtId===debt.id&&t.status==='Realizado')
    .reduce((sum,t)=>sum+t.amountCents,debt.openingPaidCents);
  if(paid>debt.totalCents)throw Error('Pagamentos da dívida excedem o total.');
 }
 const budgetCats=new Set();for(const b of d.budgets){if(!Number.isSafeInteger(b.limitCents)||b.limitCents<=0||!d.categories.some(c=>c.name===b.category&&c.group==='Despesa')||budgetCats.has(b.category))throw Error('Orçamento inválido ou duplicado no backup.');budgetCats.add(b.category);}
 for(const g of d.goals){if(!String(g.name||'').trim()||!Number.isSafeInteger(g.targetCents)||g.targetCents<=0||!Number.isSafeInteger(g.savedCents)||g.savedCents<0||(g.dueDate&&!isISODate(g.dueDate)))throw Error('Meta inválida no backup.');}
 if(!d.settings||typeof d.settings!=='object'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(d.settings.selectedPeriod||''))throw Error('Período selecionado inválido.');
 if(d.settings.monthlySavingsCents!==undefined&&(!Number.isSafeInteger(d.settings.monthlySavingsCents)||d.settings.monthlySavingsCents<0||d.settings.monthlySavingsCents>1_000_000_000_000))throw Error('Meta mensal inválida.');
 if(d.settings.reviewDay!==undefined&&(!Number.isInteger(d.settings.reviewDay)||d.settings.reviewDay<1||d.settings.reviewDay>28))throw Error('Dia de acompanhamento inválido.');
 if(d.accounts.every(a=>a.archived===true))throw Error('Mantenha uma conta ativa.');
 if(!Number.isSafeInteger(d.revision)||d.revision<0)throw Error('Revisão de dados inválida.');
 return true;
}
export function deriveDemo(raw){const d=blankData();d.accounts=raw.accounts;d.categories=raw.categories;d.budgets=raw.budgets;d.transactions=raw.transactions.map(t=>({...t,paidAt:t.status==='Realizado'?(t.paidAt||t.date):''}));d.goals=raw.goals;d.isDemo=true;d.settings.selectedPeriod=raw.selectedPeriod||'2026-10';validateBackup(d);return d;}
function csvCell(v){let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
export function transactionsCSV(data){const hdr=['Data / vencimento','Data do pagamento','Data efetiva','Descrição','Tipo','Categoria','Valor (R$)','Conta','Conta de destino','Situação','Observações'];const rows=data.transactions.map(t=>[t.date,t.paidAt||'',effectiveDate(t),t.description,t.kind,t.category,(t.amountCents/100).toFixed(2).replace('.',','),data.accounts.find(a=>a.id===t.accountId)?.name||'',data.accounts.find(a=>a.id===t.toAccountId)?.name||'',t.status,t.note||'']);return '\uFEFF'+[hdr,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n');}
export function budgetInsight(data,month){const stats=budgetStatus(data,month);const over=stats.filter(b=>b.ratio>1);const warn=stats.filter(b=>b.ratio>=.8&&b.ratio<=1);return over.length?`${over.length} orçamento(s) ultrapassado(s) neste mês.`:warn.length?`${warn.length} orçamento(s) atingiram 80% do limite previsto.`:'Orçamentos dentro dos limites para o período selecionado.';}
