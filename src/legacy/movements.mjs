/* Clara Finanças — Etapa 3/10. Operações determinísticas de movimentações.
   O esquema v2 e o armazenamento IndexedDB anteriores permanecem intactos.
   Recorrências são materializadas como ocorrências independentes e auditáveis,
   sem motor em segundo plano nem novas cobranças silenciosas. */
import {uid,validateTransaction,effectiveDate,isISODate} from './core.mjs';
export const FREQUENCIES=['none','weekly','monthly','yearly'];
const pad=n=>String(n).padStart(2,'0');
export function dateAtRecurrence(date,frequency,index){
 if(!isISODate(date))throw Error('Data inicial inválida.');
 if(!Number.isInteger(index)||index<0||index>1200)throw Error('Ocorrência inválida.');
 if(!FREQUENCIES.includes(frequency))throw Error('Periodicidade inválida.');
 if(frequency==='none'&&index!==0)throw Error('Movimentação sem recorrência.');
 const [year,month,day]=date.split('-').map(Number);
 if(frequency==='weekly'){
  const d=new Date(Date.UTC(year,month-1,day+7*index));return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
 }
 const span=frequency==='yearly'?index*12:frequency==='monthly'?index:0;
 const total=year*12+(month-1)+span;const y=Math.floor(total/12),m=total%12+1;
 const limit=new Date(Date.UTC(y,m,0)).getUTCDate();return `${y}-${pad(m)}-${pad(Math.min(day,limit))}`;
}
export function createMovements(base,data,{frequency='none',count=1}={}){
 if(!FREQUENCIES.includes(frequency))throw Error('Periodicidade inválida.');
 if(!Number.isInteger(count)||count<1||count>24||(frequency==='none'&&count!==1)||(frequency!=='none'&&count<2))throw Error('Quantidade de repetições inválida (2 a 24).');
 validateTransaction(base,data);
 if(data.transactions.length+count>250000)throw Error('Limite do banco atingido.');
 const group=frequency==='none'?'':uid('serie');
 const entries=Array.from({length:count},(_,i)=>{
  const next={...base,id:i===0?base.id:uid('tx'),date:dateAtRecurrence(base.date,frequency,i)};
  if(group){next.recurrenceGroupId=group;next.recurrenceIndex=i+1;next.recurrenceCount=count;next.recurrenceFrequency=frequency;}
  // Só a primeira ocorrência pode iniciar quitada. Futuras são previstas.
  if(i>0){next.status='Pendente';next.paidAt='';}
  validateTransaction(next,data);return next;
 });
 return entries;
}
export function changeMovementStatus(t,status,paidAt=''){
 if(!['Realizado','Pendente','Cancelado'].includes(status))throw Error('Situação inválida.');
 if(status==='Realizado'&&!isISODate(paidAt))throw Error('Informe a data efetiva.');
 return {...t,status,paidAt:status==='Realizado'?paidAt:''};
}
export function isOverdue(t,onDate){return t.status==='Pendente'&&isISODate(onDate)&&t.date<onDate;}
export function listMovements(data,{month='',basis='effective',search='',kind='',status='',account='',category='',from='',to='',overdue=false,onDate='',sort='newest'}={}){
 if(month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Mês inválido.');
 if(!['effective','due'].includes(basis))throw Error('Critério de data inválido.');
 if(from&&!isISODate(from)||to&&!isISODate(to)||from&&to&&from>to)throw Error('Intervalo inválido.');
 if(!['newest','oldest','amount-desc','amount-asc'].includes(sort))throw Error('Ordenação inválida.');
 const term=String(search).trim().toLocaleLowerCase('pt-BR');
 const arr=data.transactions.filter(t=>{
  const date=basis==='due'?t.date:effectiveDate(t);
  return (!month||date.slice(0,7)===month)&&(!from||date>=from)&&(!to||date<=to)
   &&(!kind||t.kind===kind)&&(!status||t.status===status)
   &&(!account||t.accountId===account||t.toAccountId===account)
   &&(!category||t.category===category)
   &&(!overdue||isOverdue(t,onDate))
   &&(!term||`${t.description} ${t.category} ${t.note||''} ${data.accounts.find(a=>a.id===t.accountId)?.name||''}`.toLocaleLowerCase('pt-BR').includes(term));
 });
 const dates=t=>basis==='due'?t.date:effectiveDate(t);
 return arr.sort((a,b)=>sort==='amount-desc'?b.amountCents-a.amountCents||a.id.localeCompare(b.id)
  :sort==='amount-asc'?a.amountCents-b.amountCents||a.id.localeCompare(b.id)
  :sort==='oldest'?dates(a).localeCompare(dates(b))||a.id.localeCompare(b.id)
  :dates(b).localeCompare(dates(a))||a.id.localeCompare(b.id));
}
export function movementTotals(list){
 return list.reduce((s,t)=>{s.count++;if(t.status==='Pendente'){s.pending++;if(t.kind==='Despesa')s.toPay+=t.amountCents;else if(t.kind==='Receita')s.toReceive+=t.amountCents;}
 else if(t.status==='Realizado'){if(t.kind==='Receita')s.income+=t.amountCents;if(t.kind==='Despesa')s.expense+=t.amountCents;}return s;
 },{count:0,pending:0,toPay:0,toReceive:0,income:0,expense:0});
}
/* Importação estrita do CSV que o próprio Clara exporta. O lote é atômico:
   erros de cabeçalho, aspas, contas ou valores impedem qualquer gravação. */
import {parseMoney} from './core.mjs';
function parseCsvRows(text){
 const rows=[];let row=[],cell='',quoted=false;const content=text.replace(/^\uFEFF/,'');
 for(let i=0;i<content.length;i++){
  const c=content[i];
  if(quoted){if(c==='"'&&content[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;continue;}
  if(c==='"'&&cell===''){quoted=true;continue;}
  if(c===';'){row.push(cell);cell='';continue;}
  if(c==='\n'||c==='\r'){if(c==='\r'&&content[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';continue;}
  if(c==='"')throw Error('Aspas inválidas em CSV.');
  cell+=c;
 }
 if(quoted)throw Error('CSV incompleto: aspas não fechadas.');
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 return rows;
}
const csvHeader=['Data / vencimento','Data do pagamento','Data efetiva','Descrição','Tipo','Categoria','Valor (R$)','Conta','Conta de destino','Situação','Observações'];
export function previewMovementsCSV(csv,data){
 if(typeof csv!=='string'||csv.length>5*1024*1024)throw Error('Arquivo CSV acima do limite (5 MB).');
 const rows=parseCsvRows(csv);if(rows.length<2)throw Error('CSV sem lançamentos.');
 if(rows[0].length!==csvHeader.length||rows[0].some((v,i)=>v.trim()!==csvHeader[i]))throw Error('Use o CSV exportado pelo Clara Finanças. Cabeçalho incompatível.');
 if(rows.length>10001)throw Error('Importe no máximo 10.000 linhas por vez.');
 const entries=[],seen=new Set(data.transactions.filter(t=>t.status!=='Cancelado').map(duplicateKey));let duplicates=0;
 for(let i=1;i<rows.length;i++){
  const row=rows[i];if(row.length!==csvHeader.length)throw Error(`Linha ${i+1}: quantidade de colunas inválida.`);
  const [date,paidAt,,description,kind,category,money,accountName,toAccountName,status,note]=row.map(x=>x.trim());
  const account=data.accounts.find(x=>x.name===accountName),target=toAccountName?data.accounts.find(x=>x.name===toAccountName):null;
  if(!account)throw Error(`Linha ${i+1}: conta não cadastrada: ${accountName}`);
  if(toAccountName&&!target)throw Error(`Linha ${i+1}: conta de destino não cadastrada.`);
  const tx={id:uid('tx'),date,paidAt,status,description,kind,category,amountCents:parseMoney(money),accountId:account.id,toAccountId:target?.id||'',note};
  try{validateTransaction(tx,data);}catch(e){throw Error(`Linha ${i+1}: ${e.message}`);}
  const key=duplicateKey(tx);
  if(seen.has(key)){duplicates++;continue;}seen.add(key);entries.push(tx);
 }
 if(!entries.length&&!duplicates)throw Error('Nenhum lançamento válido no CSV.');
 return {entries,duplicates,rows:rows.length-1};
}
function duplicateKey(t){return [t.date,t.kind,t.accountId,t.toAccountId||'',t.description.trim().toLocaleLowerCase('pt-BR'),t.amountCents].join('|');}
