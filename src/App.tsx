import * as React from 'react';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Account,Budget,FinanceData,FolderInfo,Goal,Kind,Status,Transaction,View} from './domain/types';
import {VERSION,uid,blankData,brl,fmtDate,parseMoney,periodStats,budgetStatus,budgetInsight,accountBalance,validateTransaction,validateBackup,migrateData,effectiveDate,deriveDemo,transactionsCSV} from './domain/finance';
import {initData,saveData,chooseFolder,clearDirectoryHandle,folderPermission,askFolderPermission,writeFolderCopy,readFolderCopy,persistentStorage} from './domain/storage';
import {Icon} from './components/icons';
import {createMovements,changeMovementStatus,isOverdue,listMovements,movementTotals,previewMovementsCSV} from './domain/movements';
import type {Frequency,MovementFilters} from './domain/movements';
import {installmentSchedule,createInstallmentMovements,summarizeInstallmentGroups} from './domain/installments';
import {createAccount,updateAccount,archiveAccount,deleteAccount,createCategory,updateCategory,archiveCategory,deleteCategory,setFinancialPreferences,savingsOverview} from './domain/catalogs';
import {addDebt,updateDebt,deleteDebt,recordDebtPayment,allDebtSummaries,cashflowForecast,goalPace} from './domain/planning';

const sections:{id:View;name:string;short:string}[]=[
 {id:'dashboard',name:'Dashboard',short:'Início'},{id:'transactions',name:'Movimentações',short:'Lançamentos'},
 {id:'accounts',name:'Contas e cartões',short:'Contas'},{id:'planning',name:'Planejamento',short:'Planejar'},
 {id:'reports',name:'Relatórios',short:'Relatórios'},{id:'settings',name:'Configurações',short:'Ajustes'}];
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const monthText=(value:string)=>{const [y,m]=value.split('-');return `${months[Number(m)-1]} de ${y}`};
const percent=(x:number)=>`${Math.round(x*100)}%`;
const emptyFilter:MovementFilters={search:'',kind:'',status:'',account:'',category:'',from:'',to:'',basis:'effective',sort:'newest',overdue:false};
type ModalKind='transaction'|'account'|'budget'|'goal'|'installment'|'category'|'debt'|'debtPayment';
type ModalState={type:ModalKind;id?:string};
function Pane({children,className='',title,detail,actions}:{children:React.ReactNode;className?:string;title?:string;detail?:string;actions?:React.ReactNode}){
 return <section className={`surface ${className}`}>
 {(title||actions)&&<header className="surface-head"><div>{title&&<h2>{title}</h2>}{detail&&<p>{detail}</p>}</div>{actions&&<div className="head-actions">{actions}</div>}</header>}{children}</section>;
}
function Button({children,onClick,variant='default',icon,disabled,type='button',title}:{children?:React.ReactNode;onClick?:()=>void;variant?:'default'|'primary'|'ghost'|'danger';icon?:string;disabled?:boolean;type?:'button'|'submit';title?:string}){
 return <button type={type} className={`button ${variant}`} onClick={onClick} disabled={disabled} title={title}>{icon&&<Icon name={icon} size={17}/>} {children}</button>;
}
function Kpi({title,value,description,icon,tone='neutral'}:{title:string;value:string;description:string;icon:string;tone?:'neutral'|'success'|'danger'|'blue'}){
 return <div className={`surface kpi tone-${tone}`}><div className="kpi-label">{title}<span className="metric-icon"><Icon name={icon} size={19}/></span></div><div className="kpi-value">{value}</div><p>{description}</p></div>;
}
function StatusChip({status}:{status:Status}){return <span className={`status-chip status-${status.toLowerCase()}`}>{status}</span>}
function Empty({text,action}:{text:string;action?:React.ReactNode}){return <div className="empty-state"><Icon name="info" size={26}/><p>{text}</p>{action}</div>}
function Progress({ratio}:{ratio:number}){return <div className="progress"><div className={ratio>1?'over':ratio>=.8?'warn':''} style={{width:`${Math.min(100,Math.max(0,ratio*100))}%`}}/></div>}
function YearChart({data,month,mask}:{data:FinanceData;month:string;mask:(x:number)=>string}){
 const year=month.slice(0,4), rows=months.map((_,i)=>periodStats(data,`${year}-${String(i+1).padStart(2,'0')}`));
 const peak=Math.max(1,...rows.flatMap(s=>[s.income,s.expense]));
 return <div className="chart-wrap"><div className="chart-key"><span><i className="key income"/> Receitas</span><span><i className="key expense"/> Despesas</span></div>
 <svg viewBox="0 0 730 230" role="img" aria-label={`Receitas e despesas por mês de ${year}`}>
 {[0,1,2,3].map(i=><line key={i} x1="34" x2="711" y1={28+i*48} y2={28+i*48} stroke="currentColor" opacity=".095" strokeDasharray="5 5"/>)}
 {rows.map((s,i)=>{const x=45+i*55, hIn=Math.max(0,144*s.income/peak),hOut=Math.max(0,144*s.expense/peak);
 return <g key={i}><rect x={x} y={172-hIn} width="16" height={hIn} fill="var(--accent)" rx="4"><title>{months[i]}: receitas {mask(s.income)}</title></rect><rect x={x+20} y={172-hOut} width="16" height={hOut} rx="4" fill="var(--expense)"><title>{months[i]}: despesas {mask(s.expense)}</title></rect><text x={x+18} y="197" textAnchor="middle" fontSize="11" fill="currentColor" opacity=".6">{months[i]}</text></g>})}
 </svg></div>;
}
function useFinance(){
 const [data,setData]=useState<FinanceData|null>(null);
 const [error,setError]=useState('');const [saving,setSaving]=useState(false);const [folder,setFolder]=useState<FolderInfo>({state:'none',name:''});
 const [notice,setNotice]=useState<{text:string;danger:boolean}|null>(null);
 const noticeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const notify=(text:string,danger=false)=>{setNotice({text,danger});if(noticeTimer.current)clearTimeout(noticeTimer.current);noticeTimer.current=setTimeout(()=>setNotice(null),4900);};
 useEffect(()=>{let active=true;initData().then(async d=>{if(!active)return;setData(d);setFolder(await folderPermission());persistentStorage().catch(()=>{});}).catch(e=>{if(active)setError(e.message||String(e));});return()=>{active=false;if(noticeTimer.current)clearTimeout(noticeTimer.current)}},[]);
 async function commit(next:FinanceData,message='Alteração salva.'){
  setSaving(true);
  try{next.appVersion=VERSION;const saved=await saveData(next);setData(saved);let warning='';
   try{const copied=await writeFolderCopy(saved);const info=await folderPermission();if(!copied&&info.state!=='none')warning='Salvo no navegador, mas a pasta perdeu permissão de gravação.';}catch(e){warning=`Salvo no navegador; a cópia na pasta falhou: ${(e as Error).message}`}
   try{setFolder(await folderPermission())}catch{}
   notify(warning||message,!!warning);return saved;
  }catch(e){notify(`Não foi possível salvar: ${(e as Error).message}`,true);throw e;}finally{setSaving(false)}
 }
 async function modify(mutator:(draft:FinanceData)=>void,message?:string){if(!data)throw Error('Banco indisponível');const next=structuredClone(data);mutator(next);return commit(next,message)}
 return {data,error,saving,folder,setFolder,notice,notify,commit,modify};
}
function Modal({data,modal,onClose,onSave,saving}:{data:FinanceData;modal:ModalState;onClose:()=>void;onSave:(type:ModalKind,id:string|undefined,values:Record<string,string>)=>Promise<void>;saving:boolean}){
 const item:any=modal.type==='transaction'?data.transactions.find(t=>t.id===modal.id):modal.type==='account'?data.accounts.find(t=>t.id===modal.id):modal.type==='category'?data.categories.find(t=>t.id===modal.id):(modal.type==='debt'||modal.type==='debtPayment')?(data.debts||[]).find(t=>t.id===modal.id):modal.type==='budget'?data.budgets.find(t=>t.category===modal.id):data.goals.find(t=>t.id===modal.id);
 const [kind,setKind]=useState<Kind>(item?.kind||'Despesa'),[status,setStatus]=useState<Status>(item?.status||'Realizado');
 const [values,setValues]=useState<Record<string,string>>(()=>({
 date:item?.date||today(),paidAt:item?.paidAt||'',description:item?.description||'',kind:item?.kind||'Despesa',category:item?.category||'',amount:item?.amountCents!=null?String(item.amountCents/100).replace('.',','):'',
 accountId:item?.accountId||data.accounts[0]?.id||'',toAccountId:item?.toAccountId||'',status:item?.status||'Realizado',note:item?.note||'',
 name:item?.name||'',type:item?.type||'Conta',group:item?.group||'Despesa',opening:item?.openingCents!=null?String(item.openingCents/100).replace('.',','):'0',
 limit:item?.limitCents!=null?String(item.limitCents/100).replace('.',','):'',target:item?.targetCents!=null?String(item.targetCents/100).replace('.',','):'',
 saved:item?.savedCents!=null?String(item.savedCents/100).replace('.',','):'0',dueDate:item?.dueDate||'',recurrence:'none',occurrences:'3',
 purchaseDate:today(),firstDueDate:today(),downPayment:'0',fees:'0',monthlyRate:'0',installmentCount:'6',
 creditor:item?.creditor||'',total:item?.totalCents!=null?String(item.totalCents/100).replace('.',','):'',
 openingPaid:item?.openingPaidCents!=null?String(item.openingPaidCents/100).replace('.',','):'0',
 monthly:item?.monthlyCents!=null?String(item.monthlyCents/100).replace('.',','):'0',
 paymentDate:today(),paymentAmount:'',paymentAccountId:data.accounts.find(a=>!a.archived)?.id||''}));
 const change=(name:string,value:string)=>{setValues(current=>({...current,[name]:value}));if(name==='kind'){setKind(value as Kind);setValues(c=>({...c,kind:value,category:''}))}if(name==='status'){setStatus(value as Status);if(value!=='Realizado')setValues(c=>({...c,status:value,paidAt:''}))}};
 const field=(name:string,label:string,el:React.ReactNode,full=false)=><label className={`form-field ${full?'full':''}`} key={name}><span>{label}</span>{el}</label>;
 const input=(name:string,type='text',required=false,placeholder='')=><input name={name} id={`f-${name}`} type={type} required={required} value={values[name]||''} placeholder={placeholder} onChange={e=>change(name,e.currentTarget.value)}/>;
 const select=(name:string,options:{value:string;label:string}[],disabled=false)=><select id={`f-${name}`} name={name} disabled={disabled} value={values[name]||''} onChange={e=>change(name,e.currentTarget.value)}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>;
 const accts=data.accounts.filter(a=>!a.archived||a.id===item?.accountId||a.id===item?.toAccountId).map(a=>({value:a.id,label:a.name+(a.archived?' (arquivada)':'')}));
 const cats=data.categories.filter(c=>c.group===kind&&(!c.archived||c.name===item?.category)).map(c=>({value:c.name,label:c.name+(c.archived?' (arquivada)':'')}));
 const expenseCats=data.categories.filter(c=>c.group==='Despesa'&&(!c.archived||c.name===item?.category)).map(c=>({value:c.name,label:c.name+(c.archived?' (arquivada)':'')}));
 const rateBps=(text:string)=>{const trimmed=text.trim().replace(',','.');if(!/^(?:\d{1,2}|100)(?:\.\d{1,2})?$/.test(trimmed))throw Error('Taxa mensal inválida; use até duas casas decimais.');return Math.round(Number(trimmed)*100);};
 const buildInstallmentParams=()=>({
  description:values.description.trim(),category:values.category,accountId:values.accountId,
  purchaseDate:values.purchaseDate,firstDueDate:values.firstDueDate,
  purchaseCents:parseMoney(values.amount),downPaymentCents:parseMoney(values.downPayment),
  feesCents:parseMoney(values.fees),monthlyRateBps:rateBps(values.monthlyRate),count:Number(values.installmentCount)
 });
 let preview:null|ReturnType<typeof installmentSchedule>=null;
 let previewError='';
 if(modal.type==='installment'&&values.amount.trim())try{preview=installmentSchedule(buildInstallmentParams());}catch(e){previewError=(e as Error).message}
 const form=modal.type==='debt'?<>
 {field('name','Descrição da dívida',input('name','text',true,'Ex.: Financiamento do veículo'),true)}
 {field('creditor','Credor',input('creditor','text',true,'Banco ou pessoa'))}
 {field('total','Total da dívida (R$)',input('total','text',true,'0,00'))}
 {field('openingPaid','Valor pago anteriormente (R$)',<input name="openingPaid" type="text" required value={values.openingPaid} disabled={!!item} onChange={e=>change('openingPaid',e.currentTarget.value)}/>)}
 {field('monthly','Prestação de referência (R$)',input('monthly','text',true,'0,00'))}
 {field('dueDate','Vencimento final (opcional)',input('dueDate','date'))}
 {field('category','Categoria da despesa',select('category',[{value:'',label:'Selecione'},...expenseCats]))}
 <p className="fine full">A dívida é um controle de obrigação. Seu valor não reduz o saldo bancário; somente os pagamentos confirmados geram despesas e afetam o caixa.</p>
 </>:modal.type==='debtPayment'?<>
 <p className="fine full">Dívida: <b>{item?.name}</b>. O pagamento será registrado imediatamente como despesa realizada.</p>
 {field('paymentDate','Data do pagamento',input('paymentDate','date',true))}
 {field('paymentAmount','Valor pago (R$)',input('paymentAmount','text',true,'0,00'))}
 {field('paymentAccountId','Conta de origem',select('paymentAccountId',data.accounts.filter(a=>!a.archived).map(a=>({value:a.id,label:a.name}))))}
 </>:modal.type==='installment'?<>
 {field('description','Descrição da compra',input('description','text',true,'Ex.: Notebook'),true)}
 {field('purchaseDate','Data da compra',input('purchaseDate','date',true))}
 {field('firstDueDate','Primeiro vencimento',input('firstDueDate','date',true))}
 {field('amount','Valor da compra em R$',input('amount','text',true,'0,00'))}
 {field('downPayment','Entrada em R$',input('downPayment','text',true,'0,00'))}
 {field('fees','Encargos financiados em R$',input('fees','text',true,'0,00'))}
 {field('monthlyRate','Juros ao mês (%)',input('monthlyRate','text',true,'Ex.: 1,50'))}
 {field('installmentCount','Quantidade de parcelas (2–60)',<input name="installmentCount" type="number" min="2" max="60" step="1" required value={values.installmentCount} onChange={e=>change('installmentCount',e.currentTarget.value)}/>)}
 {field('accountId','Conta de pagamento',select('accountId',accts))}
 {field('category','Categoria de despesa',select('category',[{value:'',label:'Selecione a categoria'},...expenseCats]))}
 <div className="installment-preview full" aria-live="polite">
  <strong>Simulação antes de salvar</strong>
  {preview?<><div className="installment-preview-metrics">
   <span>Financiado: <b>{brl(preview.financedCents)}</b></span>
   <span>Juros totais: <b>{brl(preview.totalInterestCents)}</b></span>
   <span>Total a pagar (com entrada): <b>{brl(preview.totalPayableCents)}</b></span>
  </div><div className="installment-preview-scroll"><table><thead><tr><th>Parcela</th><th>Vencimento</th><th>Principal</th><th>Juros</th><th>Valor</th></tr></thead><tbody>
   {preview.rows.map(row=><tr key={row.index}><td>{row.index}/{preview.count}</td><td>{fmtDate(row.dueDate)}</td><td>{brl(row.principalCents)}</td><td>{brl(row.interestCents)}</td><td><b>{brl(row.amountCents)}</b></td></tr>)}
  </tbody></table></div>
  <p>Ao salvar, todas as parcelas serão lançadas como <b>pendentes</b>. Somente pagamentos confirmados alteram o saldo.</p></>:
  <p className="fine">{previewError||'Informe o valor da compra para simular.'}</p>}
 </div>
 </>:modal.type==='transaction'?<>
 {field('date','Data / vencimento',input('date','date',true))}
 {field('paidAt','Data de pagamento',<input name="paidAt" type="date" value={status==='Realizado'?values.paidAt||'':''} disabled={status!=='Realizado'} onChange={e=>change('paidAt',e.currentTarget.value)}/>)}
 {field('kind','Tipo',select('kind',[{value:'Despesa',label:'Despesa'},{value:'Receita',label:'Receita'},{value:'Transferência',label:'Transferência'}]))}
 {field('status','Situação',select('status',[{value:'Realizado',label:'Realizado'},{value:'Pendente',label:'Pendente'},{value:'Cancelado',label:'Cancelado'}]))}
 {field('description','Descrição',input('description','text',true,'Ex.: Supermercado'),true)}
 {field('amount','Valor em R$',input('amount','text',true,'0,00'))}
 {kind!=='Transferência'&&field('category','Categoria',select('category',[{value:'',label:'Selecione uma categoria'},...cats]))}
 {field('accountId','Conta',select('accountId',accts))}
 {kind==='Transferência'&&field('toAccountId','Conta de destino',select('toAccountId',[{value:'',label:'Selecione uma conta'},...accts]))}
 {field('note','Observações',<textarea name="note" rows={2} value={values.note} onChange={e=>change('note',e.currentTarget.value)} placeholder="Opcional"/>,true)}
 {!item&&field('recurrence','Repetição',select('recurrence',[{value:'none',label:'Não repetir'},{value:'weekly',label:'Semanal'},{value:'monthly',label:'Mensal'},{value:'yearly',label:'Anual'}]))}
 {!item&&values.recurrence!=='none'&&field('occurrences','Total de ocorrências (2 a 24)',<input name="occurrences" aria-label="Total de ocorrências" type="number" min="2" max="24" step="1" required value={values.occurrences} onChange={e=>change('occurrences',e.currentTarget.value)}/>)}
 {item?.installmentGroupId&&<p className="recurring-hint">Parcela {item.installmentIndex===0?'de entrada':item.installmentIndex+'/'+item.installmentCount}. Para preservar a amortização, o valor é fixo; altere apenas data, situação, conta ou observação.</p>}
 {item?.recurrenceGroupId&&<p className="recurring-hint">Ocorrência {item.recurrenceIndex} de {item.recurrenceCount}. Esta edição altera apenas este lançamento.</p>}
 </>:modal.type==='category'?<>
 {field('name','Nome da categoria',input('name','text',true),true)}
 {field('group','Tipo da categoria',select('group',[{value:'Despesa',label:'Despesa'},{value:'Receita',label:'Receita'}]))}
 {item&&<p className="fine full">Renomear esta categoria atualizará as movimentações e os orçamentos vinculados. A troca de tipo só é permitida se não estiver em uso.</p>}
 </>:modal.type==='account'?<>
 {field('name','Nome da conta',input('name','text',true),true)}
 {field('type','Tipo',select('type',[{value:'Conta',label:'Conta bancária'},{value:'Dinheiro',label:'Dinheiro'},{value:'Carteira',label:'Carteira digital'},{value:'Cartão',label:'Cartão'}]))}
 {field('opening','Saldo inicial em R$',input('opening','text',true))}
 {item&&<p className="fine full">A alteração do saldo inicial recalcula o histórico. Faça um backup antes de corrigir valores antigos.</p>}
 </>:modal.type==='budget'?<>
 {field('category','Categoria de despesa',select('category',[{value:'',label:'Selecione uma categoria'},...expenseCats],!!item),true)}
 {field('limit','Limite mensal em R$',input('limit','text',true))}
 </>:<>
 {field('name','Nome da meta',input('name','text',true),true)}
 {field('target','Valor desejado em R$',input('target','text',true))}
 {field('saved','Valor já reservado em R$',input('saved','text',true))}
 {field('dueDate','Prazo (opcional)',input('dueDate','date'))}
 </>;
 const names:{[k in ModalKind]:string}={transaction:'lançamento',account:'conta',budget:'orçamento',goal:'meta',installment:'parcelamento',category:'categoria',debt:'dívida',debtPayment:'pagamento da dívida'};
 return <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="dialog" role="dialog" aria-modal="true" aria-label={`${item?'Editar':'Adicionar'} ${names[modal.type]}`}>
 <div className="dialog-heading"><div><div className="eyebrow">CLARA / CADASTRO</div><h2>{item?'Editar':'Adicionar'} {names[modal.type]}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><Icon name="close"/></button></div>
 <form onSubmit={async e=>{e.preventDefault();await onSave(modal.type,modal.id,values)}}><div className="fields">{form}</div><div className="dialog-actions"><Button onClick={onClose}>Cancelar</Button><Button type="submit" variant="primary" disabled={saving} icon="check">{saving?'Salvando…':'Salvar'}</Button></div></form>
 </div></div>;
}
export default function App(){
 const {data,error,saving,folder,setFolder,notice,notify,commit,modify}=useFinance();
 const [view,setView]=useState<View>('dashboard');
 const [modal,setModal]=useState<ModalState|null>(null);
 const [filters,setFilters]=useState<MovementFilters>(emptyFilter);
 const [showAllMonths,setShowAllMonths]=useState(false);
 const [collapsed,setCollapsed]=useState(()=>{try{return localStorage.getItem('clara-sidebar')==='1'}catch{return false}});
 const [installPrompt,setInstallPrompt]=useState<any>(null);
 const importRef=useRef<HTMLInputElement>(null);
 const movementImportRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{const handler=(e:any)=>{e.preventDefault();setInstallPrompt(e)};window.addEventListener('beforeinstallprompt',handler);return()=>window.removeEventListener('beforeinstallprompt',handler)},[]);
 useEffect(()=>{if(!modal)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setModal(null)};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey)},[modal]);
 useEffect(()=>{document.body.dataset.theme=data?.settings.theme||'light';document.body.dataset.accent=data?.settings.accent||'petrol'},[data?.settings.theme,data?.settings.accent]);
 useEffect(()=>{
  if(view!=='settings'||!importRef.current)return;
  const element=importRef.current;
  const onFileChange=async()=>{const file=element.files?.[0];if(!file)return;
   try{if(file.size>20*1024*1024)throw Error('Backup muito grande (máximo 20 MB).');await restore(JSON.parse(await file.text()),'o arquivo selecionado');}
   catch(e){notify('Não foi possível ler o backup: '+(e as Error).message,true)}
   finally{element.value=''}
  };
  element.addEventListener('change',onFileChange);
  return ()=>element.removeEventListener('change',onFileChange);
 },[view,data]);
 const show=(v:View)=>{setView(v);setModal(null);setFilters(emptyFilter);setShowAllMonths(false);window.scrollTo({top:0,behavior:'instant'})};
 const mask=(c:number)=>data?.settings.hideValues?'••••••':brl(c);
 const month=data?.settings.selectedPeriod||today().slice(0,7);
 const summary=useMemo(()=>data?periodStats(data,month):null,[data,month]);
 const budgets=useMemo(()=>data?budgetStatus(data,month):[],[data,month]);
 const debtSummaries=useMemo(()=>data?allDebtSummaries(data):[],[data]);
 const forecast=useMemo(()=>data?cashflowForecast(data,month,6):[],[data,month]);
 const savings=useMemo(()=>data?savingsOverview(data,month):null,[data,month]);
 const [savingsDraft,setSavingsDraft]=useState('');
 const [reviewDraft,setReviewDraft]=useState('1');
 useEffect(()=>{if(!data)return;setSavingsDraft(String((data.settings.monthlySavingsCents||0)/100).replace('.',','));setReviewDraft(String(data.settings.reviewDay||1));},[data?.settings.monthlySavingsCents,data?.settings.reviewDay]);
 const submitModal=async(type:ModalKind,id:string|undefined,v:Record<string,string>)=>{
  if(!data)return;
  try{
   await modify(d=>{
    if(type==='debt'){
     const form={name:v.name,creditor:v.creditor,totalCents:parseMoney(v.total),
      openingPaidCents:parseMoney(v.openingPaid),monthlyCents:parseMoney(v.monthly),
      dueDate:v.dueDate,category:v.category};
     if(id)updateDebt(d,id,form);else addDebt(d,form);
    }else if(type==='debtPayment'){
     if(!id)throw Error('Dívida não encontrada.');
     recordDebtPayment(d,{debtId:id,accountId:v.paymentAccountId,amountCents:parseMoney(v.paymentAmount),date:v.paymentDate});
    }else if(type==='installment'){
     const rate=v.monthlyRate.trim().replace(',','.');
     if(!/^(?:\d{1,2}|100)(?:\.\d{1,2})?$/.test(rate))throw Error('Taxa mensal inválida. Use até duas casas decimais.');
     const plan=createInstallmentMovements({
      description:v.description.trim(),category:v.category,accountId:v.accountId,
      purchaseDate:v.purchaseDate,firstDueDate:v.firstDueDate,purchaseCents:parseMoney(v.amount),
      downPaymentCents:parseMoney(v.downPayment),feesCents:parseMoney(v.fees),
      monthlyRateBps:Math.round(Number(rate)*100),count:Number(v.installmentCount)
     },d);
     d.transactions.push(...plan.entries);
    }else if(type==='transaction'){
     const old=d.transactions.find(t=>t.id===id);
     const tx:Transaction={id:old?.id||uid('tx'),date:v.date,paidAt:v.status==='Realizado'?v.paidAt:'',description:v.description.trim(),kind:v.kind as Kind,category:v.kind==='Transferência'?'':v.category,amountCents:parseMoney(v.amount),accountId:v.accountId,toAccountId:v.kind==='Transferência'?v.toAccountId:'',status:v.status as Status,note:v.note.trim(),
      ...(old?.recurrenceGroupId?{recurrenceGroupId:old.recurrenceGroupId,recurrenceIndex:old.recurrenceIndex,recurrenceCount:old.recurrenceCount,recurrenceFrequency:old.recurrenceFrequency}:{}),
      ...(old?.installmentGroupId?{installmentGroupId:old.installmentGroupId,installmentIndex:old.installmentIndex,installmentCount:old.installmentCount,installmentPrincipalCents:old.installmentPrincipalCents,installmentInterestCents:old.installmentInterestCents}:{})};
     if(old?.installmentGroupId&&tx.amountCents!==old.amountCents)throw Error('O valor de uma parcela já gerada não pode ser alterado. Ajuste somente data, conta ou situação.');
     validateTransaction(tx,d);
     const idx=d.transactions.findIndex(t=>t.id===id);
     if(idx>=0)d.transactions[idx]=tx;
     else{
      const frequency=(v.recurrence||'none') as Frequency;
      const count=frequency==='none'?1:Number(v.occurrences);
      const fresh=createMovements(tx,d,{frequency,count});
      const duplicates=fresh.filter(candidate=>d.transactions.some(t=>t.status!=='Cancelado'&&t.date===candidate.date&&t.kind===candidate.kind&&t.accountId===candidate.accountId&&t.toAccountId===candidate.toAccountId&&t.description.toLocaleLowerCase('pt-BR')===candidate.description.toLocaleLowerCase('pt-BR')&&t.amountCents===candidate.amountCents));
      if(duplicates.length)throw Error(`Possível duplicidade: ${duplicates.length} lançamento(s) com descrição, data, conta e valor iguais. Revise antes de salvar.`);
      d.transactions.push(...fresh);
     }
    }else if(type==='category'){
     const form={name:v.name,group:v.group as 'Receita'|'Despesa'};
     if(id)updateCategory(d,id,form);else createCategory(d,form);
    }else if(type==='account'){
     const negative=v.opening.trim().startsWith('-');const positive=parseMoney(v.opening.trim().replace(/^-/,''));
     if(!Number.isSafeInteger(positive))throw Error('Informe um saldo inicial válido.');
     const form={name:v.name,type:v.type||'Conta',openingCents:negative?-positive:positive};
     if(id)updateAccount(d,id,form);else createAccount(d,form);
    }else if(type==='budget'){
     const lim=parseMoney(v.limit);if(!Number.isSafeInteger(lim)||lim<=0)throw Error('Defina um limite válido.');
     const cat=id||v.category;if(!cat)throw Error('Escolha uma categoria.');
     const b:Budget={category:cat,limitCents:lim};const i=d.budgets.findIndex(x=>x.category===cat);if(i>=0)d.budgets[i]=b;else d.budgets.push(b);
    }else{
     const target=parseMoney(v.target),saved=parseMoney(v.saved);
     if(!v.name.trim()||!Number.isSafeInteger(target)||target<=0||!Number.isSafeInteger(saved)||saved<0)throw Error('Informe os valores válidos para a meta.');
     const g:Goal={id:id||uid('goal'),name:v.name.trim(),targetCents:target,savedCents:saved,dueDate:v.dueDate||''};const i=d.goals.findIndex(x=>x.id===id);if(i>=0)d.goals[i]=g;else d.goals.push(g);
    }
   },'Registro salvo.');setModal(null);
  }catch(e){notify((e as Error).message,true)}
 };
 const remove=async(type:Exclude<ModalKind,'installment'|'debtPayment'>,id:string)=>{
  if(!data)return;const label=type==='transaction'?'lançamento':type==='account'?'conta':type==='category'?'categoria':type==='debt'?'dívida':type==='budget'?'orçamento':'meta';
  if(!window.confirm(`Excluir ${label}? Esta operação não pode ser desfeita.`))return;
  try{await modify(d=>{
   if(type==='transaction')d.transactions=d.transactions.filter(x=>x.id!==id);
   if(type==='account')deleteAccount(d,id);
   if(type==='category')deleteCategory(d,id);
   if(type==='debt')deleteDebt(d,id);
   if(type==='budget')d.budgets=d.budgets.filter(x=>x.category!==id);
   if(type==='goal')d.goals=d.goals.filter(x=>x.id!==id);
  },'Registro excluído.')}catch(e){notify((e as Error).message,true)}
 };
 async function importMovements(file:File){
  if(!data)return;
  try{
   if(file.size>5*1024*1024)throw Error('CSV excede 5 MB.');
   const csv=await file.text();const preview=previewMovementsCSV(csv,data);
   if(!preview.entries.length){notify(`Nenhum novo lançamento. ${preview.duplicates} registro(s) já existente(s).`);return;}
   if(!window.confirm(`Importar ${preview.entries.length} lançamento(s) do CSV? ${preview.duplicates} coincidência(s) serão ignoradas. As contas e categorias devem existir no Clara.`))return;
   await modify(d=>{const validated=previewMovementsCSV(csv,d);d.transactions.push(...validated.entries);},`${preview.entries.length} lançamento(s) importados.`);
  }catch(e){notify(`Importação não realizada: ${(e as Error).message}`,true)}
 }
 async function updatePayment(tx:Transaction,target:Status){
  try{await modify(d=>{const idx=d.transactions.findIndex(t=>t.id===tx.id);if(idx<0)throw Error('Lançamento não encontrado.');
   const next=changeMovementStatus(d.transactions[idx],target,target==='Realizado'?today():'');validateTransaction(next,d);d.transactions[idx]=next;
  },target==='Realizado'?'Lançamento confirmado.':'Lançamento voltou a ficar pendente.');}
  catch(e){notify((e as Error).message,true)}
 }
 function download(filename:string,content:string,mime:string){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000)}
 async function restore(raw:unknown,context='backup'){if(!data)return;try{
  const migrated=migrateData(raw);validateBackup(migrated);
  if(!window.confirm(`Restaurar ${context}? Isso substituirá TODOS os seus dados atuais. Faça um backup antes de prosseguir.`))return;
  await commit(migrated,'Backup restaurado.');setModal(null);
 }catch(e){notify(`Não foi possível restaurar: ${(e as Error).message}`,true)}}
 async function demonstration(){if(!data)return;if(!window.confirm('Carregar demonstração? Os dados atuais serão substituídos. Exporte um backup antes.'))return;
  try{const response=await fetch('./dados-demonstracao.json');if(!response.ok)throw Error('Não foi possível carregar o arquivo de exemplo.');const sample=deriveDemo(await response.json());await clearDirectoryHandle();setFolder(await folderPermission());await commit(sample,'Exemplos carregados.')}catch(e){notify((e as Error).message,true)}
 }
 async function reset(){if(!window.confirm('Começar do zero? Todos os registros locais serão substituídos. Baixe um backup antes. A pasta vinculada será preservada sem alterações e desvinculada.'))return;try{await clearDirectoryHandle();setFolder(await folderPermission());await commit(blankData(),'Nova base criada.')}catch(e){notify((e as Error).message,true)}}
 async function pickFolder(){if(!data)return;try{
  // showDirectoryPicker é chamado diretamente no evento de clique, preservando a ativação exigida pelo navegador.
  const handle=await chooseFolder();setFolder(await folderPermission());
  let exists=false;try{await handle.getFileHandle('clara-financas-dados.json');exists=true}catch(e){if((e as Error).name!=='NotFoundError')throw e}
  if(exists){
   if(window.confirm('A pasta já contém um backup do Clara. Deseja RESTAURAR esse arquivo?'))await restore(await readFolderCopy(),'os dados desta pasta');
   else if(window.confirm('Manter dados atuais e SUBSTITUIR o arquivo de backup existente na pasta?')){await writeFolderCopy(data);notify('Cópia atualizada na pasta.');}
   else notify('Pasta vinculada. O backup existente não foi alterado.',false);
  }else{await writeFolderCopy(data);notify('Pasta selecionada e cópia inicial criada.');}
 }catch(e){if((e as Error).name!=='AbortError')notify((e as Error).message,true)}
 }
 async function saveFolder(){if(!data)return;try{let ok=await writeFolderCopy(data);if(!ok)ok=(await askFolderPermission())&&await writeFolderCopy(data);setFolder(await folderPermission());notify(ok?'Backup da pasta atualizado.':'Pasta sem permissão; use Exportar backup.',!ok)}catch(e){notify((e as Error).message,true)}}
 const action=(fn:()=>Promise<unknown>)=>()=>{fn().catch(e=>notify((e as Error).message,true))};
 if(error)return <main className="boot-error"><div className="brand-sign">C</div><h1>Não foi possível abrir o banco local</h1><p>{error}</p><p>Não limpe os dados do navegador: seus registros podem estar armazenados nesta origem. Verifique permissões e o modo privado.</p></main>;
 if(!data||!summary)return <div className="boot"><div className="brand-sign">C</div><h2>Preparando Clara Finanças…</h2><p>Etapa 4 / 10 · Movimentações completas</p></div>;
 const results=listMovements(data,{...filters,month:showAllMonths?'':month,onDate:today()});
 const totals=movementTotals(results);
 const overdueCount=data.transactions.filter(t=>isOverdue(t,today())).length;
 const patchFilter=(update:Partial<MovementFilters>)=>setFilters(f=>{
  const next={...f,...update};if(next.from&&next.to&&next.from>next.to){if('from' in update)next.to='';else next.from='';}
  return next;
 });
 const toggleArchive=async(type:'account'|'category',id:string,archived:boolean)=>{
  try{await modify(d=>{if(type==='account')archiveAccount(d,id,archived);else archiveCategory(d,id,archived);},archived?'Item arquivado.':'Item reativado.')}
  catch(e){notify((e as Error).message,true)}
 };
 const savePreferences=async()=>{
  try{const cents=parseMoney(savingsDraft);const day=Number(reviewDraft);
   await modify(d=>setFinancialPreferences(d,{monthlySavingsCents:cents,reviewDay:day}),'Preferências financeiras salvas.');
  }catch(e){notify((e as Error).message,true)}
 };
 const actions=(type:Exclude<ModalKind,'installment'|'debtPayment'>,id:string)=><div className="row-actions"><button aria-label="Editar" title="Editar" onClick={()=>setModal({type,id})}><Icon name="edit" size={16}/></button><button aria-label="Excluir" title="Excluir" onClick={()=>remove(type,id)}><Icon name="trash" size={16}/></button></div>;
 const smallTx=(items:Transaction[])=><div className="recent-list">{items.length?items.slice(0,6).map(t=><div className="recent-item" key={t.id}><div className={`transaction-symbol ${t.kind==='Receita'?'in':'out'}`}><Icon name={t.kind==='Receita'?'arrowup':t.kind==='Despesa'?'arrowdown':'transactions'} size={18}/></div><div className="recent-desc"><b>{t.description}</b><span>{t.category||'Transferência'} · {fmtDate(effectiveDate(t))}</span></div><div className="recent-amount"><b>{mask((t.kind==='Despesa'?-1:1)*t.amountCents)}</b><StatusChip status={t.status}/></div></div>):<Empty text="Nenhum lançamento neste período." action={<Button onClick={()=>setModal({type:'transaction'})} icon="plus">Adicionar lançamento</Button>}/>}</div>;
 const dashboard=<div className="vertical">
 {data.isDemo&&<div className="demo-notice"><Icon name="info" size={18}/> Dados fictícios importados da planilha. <Button variant="ghost" onClick={reset}>Iniciar minha base</Button></div>}
 <div className="intro"><div><div className="eyebrow">SEU CONTROLE FINANCEIRO EM UM SÓ LUGAR</div><h2>Visão geral <span>do seu dinheiro.</span></h2><p>Indicadores do período selecionado · {monthText(month)}</p></div><Button variant="primary" icon="plus" onClick={()=>setModal({type:'transaction'})}>Novo lançamento</Button></div>
 <div className="metrics"><Kpi title="Receitas realizadas" value={mask(summary.income)} icon="arrowup" tone="success" description="Entradas confirmadas no mês"/><Kpi title="Despesas realizadas" value={mask(summary.expense)} icon="arrowdown" tone="danger" description="Saídas confirmadas no mês"/><Kpi title="Resultado do mês" value={mask(summary.result)} icon="reports" tone={summary.result<0?'danger':'blue'} description="Receitas menos despesas"/><Kpi title="Saldo total em contas" value={mask(summary.totalBalance)} icon="wallet" description="Saldo inicial + movimentações"/></div>
 <div className="dashboard-grid"><Pane title="Fluxo financeiro" detail={`Receitas e despesas em ${month.slice(0,4)}`} actions={<span className="subtle-tag">Ano completo</span>}><YearChart data={data} month={month} mask={mask}/></Pane>
 <Pane title="Despesas por categoria" detail="Principais categorias do período"><div className="category-list">{summary.expensesByCategory.length?summary.expensesByCategory.slice(0,6).map(([name,value])=><div className="category-item" key={name}><div><b>{name}</b><span>{mask(value)}</span></div><Progress ratio={value/(summary.expense||1)}/></div>):<Empty text="Ainda não há despesas realizadas no período."/>}</div></Pane></div>
 <div className="dashboard-grid"><Pane title="Últimas movimentações" detail="Lançamentos e status no período" actions={<Button variant="ghost" onClick={()=>show('transactions')}>Ver todas <Icon name="chevron" size={14}/></Button>}>{smallTx(summary.recent)}</Pane>
 <div className="vertical"><Pane title="Acompanhamento financeiro" detail="Indicadores essenciais"><div className="highlight-row"><span>Despesas pendentes</span><strong>{mask(summary.pending)}</strong></div><div className="highlight-row"><span>Receitas pendentes</span><strong>{mask(summary.pendingIncome)}</strong></div><div className="highlight-row"><span>Contas cadastradas</span><strong>{data.accounts.length}</strong></div><div className="tip"><Icon name="info" size={18}/>{budgetInsight(data,month)}</div></Pane><Pane title="Atalhos" detail="Acesse seus recursos"><div className="quick-actions"><Button onClick={()=>show('accounts')} icon="wallet">Contas</Button><Button onClick={()=>show('planning')} icon="target">Orçamentos</Button><Button onClick={()=>show('reports')} icon="reports">Relatórios</Button></div></Pane></div></div>
 </div>;
 const installmentGroups=summarizeInstallmentGroups(data);
 const transactions=<div className="vertical"><div className="section-top"><div><h2>Movimentações</h2><p>Receitas, despesas, transferências e lançamentos recorrentes · {showAllMonths?'todos os meses':monthText(month)}</p></div><div className="head-actions"><Button icon="download" onClick={()=>download(`clara-movimentacoes-${today()}.csv`,transactionsCSV(data),'text/csv;charset=utf-8')}>Exportar CSV</Button><Button icon="upload" onClick={()=>movementImportRef.current?.click()}>Importar CSV</Button><input ref={movementImportRef} type="file" hidden accept=".csv,text/csv" onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)importMovements(file)}}/><Button icon="plus" onClick={()=>setModal({type:'installment'})}>Novo parcelamento</Button><Button variant="primary" icon="plus" onClick={()=>setModal({type:'transaction'})}>Novo lançamento</Button></div></div>
 {installmentGroups.length>0&&<Pane title="Assistente de parcelamentos" detail="Compras parceladas · entradas, juros, pagamentos e valores pendentes"><div className="installment-summary-grid">
  {installmentGroups.slice(0,8).map(g=><div key={g.id} className="installment-summary-card">
   <b>{g.entries.find(t=>t.installmentIndex===1)?.description.split(' — ')[0]||'Compra parcelada'}</b>
   <small>{g.completed} de {g.count} parcelas pagas · {g.canceled} canceladas</small>
   <div><span>Pendente</span><strong>{mask(g.pendingCents)}</strong></div>
   <div><span>Pago</span><strong>{mask(g.paidCents)}</strong></div>
   <div><span>Juros previstos</span><strong>{mask(g.interestCents)}</strong></div>
  </div>)}
 </div></Pane>}
 <div className="movement-overview"><div className="surface"><small>Selecionados</small><b>{totals.count}</b></div><div className="surface"><small>Despesas realizadas</small><b>{mask(totals.expense)}</b></div><div className="surface"><small>A pagar</small><b>{mask(totals.toPay)}</b></div><div className="surface"><small>A receber</small><b>{mask(totals.toReceive)}</b></div></div>
 <Pane><div className="movement-toolbar"><label className="check-wrap"><input type="checkbox" checked={showAllMonths} onChange={e=>setShowAllMonths(e.target.checked)}/> Todos os meses</label><label className="check-wrap"><input type="checkbox" checked={!!filters.overdue} onChange={e=>patchFilter({overdue:e.target.checked})}/> Somente atrasados ({overdueCount})</label><Button variant="ghost" onClick={()=>{setFilters(emptyFilter);setShowAllMonths(false)}}>Limpar filtros</Button></div>
 <div className="filters movement-filters">
 <input aria-label="Pesquisar movimentações" placeholder="Pesquisar descrição, categoria, conta ou observação" value={filters.search||''} onChange={e=>patchFilter({search:e.target.value})}/>
 <select aria-label="Filtrar tipo" value={filters.kind||''} onChange={e=>patchFilter({kind:e.target.value})}><option value="">Todos os tipos</option><option>Receita</option><option>Despesa</option><option>Transferência</option></select>
 <select aria-label="Filtrar situação" value={filters.status||''} onChange={e=>patchFilter({status:e.target.value})}><option value="">Todas as situações</option><option>Realizado</option><option>Pendente</option><option>Cancelado</option></select>
 <select aria-label="Filtrar conta" value={filters.account||''} onChange={e=>patchFilter({account:e.target.value})}><option value="">Todas as contas</option>{data.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
 <select aria-label="Filtrar categoria" value={filters.category||''} onChange={e=>patchFilter({category:e.target.value})}><option value="">Todas as categorias</option>{data.categories.map(c=><option key={c.id} value={c.name}>{c.name} · {c.group}</option>)}</select>
 <select aria-label="Critério de data" value={filters.basis} onChange={e=>patchFilter({basis:e.target.value as 'due'|'effective'})}><option value="effective">Data efetiva / prevista</option><option value="due">Data do vencimento</option></select>
 <label className="range-field">De <input aria-label="Data inicial" type="date" value={filters.from||''} onChange={e=>patchFilter({from:e.target.value})}/></label>
 <label className="range-field">Até <input aria-label="Data final" type="date" min={filters.from||undefined} value={filters.to||''} onChange={e=>patchFilter({to:e.target.value})}/></label>
 <select aria-label="Ordenar movimentações" value={filters.sort} onChange={e=>patchFilter({sort:e.target.value as MovementFilters['sort']})}><option value="newest">Mais recentes</option><option value="oldest">Mais antigas</option><option value="amount-desc">Maior valor</option><option value="amount-asc">Menor valor</option></select>
 </div>
 <div className="movement-mobile-list">{results.map(t=><article className="movement-mobile-card" key={t.id}>
   <div className="movement-mobile-title"><div><b>{t.description}</b><small>{t.category||'Transferência'} · {data.accounts.find(a=>a.id===t.accountId)?.name||'—'}{t.toAccountId?' → '+(data.accounts.find(a=>a.id===t.toAccountId)?.name||'—'):''}</small></div><strong className={t.kind==='Despesa'?'value-negative':t.kind==='Receita'?'value-positive':''}>{mask(t.amountCents)}</strong></div>
   <div className="movement-mobile-meta"><span>Vence {fmtDate(t.date)}</span><StatusChip status={t.status}/>{isOverdue(t,today())&&<small className="overdue-label">Atrasado</small>}</div>
   {t.installmentGroupId&&<small className="series-tag">{t.installmentIndex===0?'Entrada':'Parcela '+t.installmentIndex+'/'+t.installmentCount} · Assistente</small>}
   {t.recurrenceGroupId&&<small className="series-tag">Série {t.recurrenceIndex}/{t.recurrenceCount} · {t.recurrenceFrequency==='weekly'?'Semanal':t.recurrenceFrequency==='monthly'?'Mensal':'Anual'}</small>}
   <div className="movement-mobile-buttons">{t.status==='Pendente'&&<button aria-label="Confirmar hoje" className="confirm-action" onClick={()=>updatePayment(t,'Realizado')}>Confirmar pagamento</button>}{t.status==='Realizado'&&<button aria-label="Voltar a pendente" className="undo-action" onClick={()=>updatePayment(t,'Pendente')}>Reabrir</button>}{actions('transaction',t.id)}</div>
  </article>)}{!results.length&&<Empty text="Nenhum lançamento encontrado."/>}</div>
 <div className="table-scroller"><table><thead><tr><th>Descrição</th><th>Vencimento</th><th>Pagamento</th><th>Categoria</th><th>Valor</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{results.map(t=><tr key={t.id}><td><b>{t.description}</b><small>{t.kind} · {data.accounts.find(a=>a.id===t.accountId)?.name||'—'}{t.toAccountId?' → '+(data.accounts.find(a=>a.id===t.toAccountId)?.name||'—'):''}</small>{t.installmentGroupId&&<small>{t.installmentIndex===0?'Entrada':'Parcela '+t.installmentIndex+'/'+t.installmentCount} · Assistente</small>}{t.recurrenceGroupId&&<small>Série {t.recurrenceIndex}/{t.recurrenceCount} · {t.recurrenceFrequency==='weekly'?'semanal':t.recurrenceFrequency==='monthly'?'mensal':'anual'}</small>}</td><td>{fmtDate(t.date)}</td><td>{fmtDate(t.paidAt|| (t.status==='Realizado'?t.date:''))}</td><td>{t.category||'Transferência'}</td><td className={t.kind==='Receita'?'value-positive':t.kind==='Despesa'?'value-negative':''}>{mask(t.amountCents)}</td><td><StatusChip status={t.status}/>{isOverdue(t,today())&&<small className="overdue-label">Atrasado</small>}</td><td><div className="movement-actions">{t.status==='Pendente'&&<button title="Confirmar hoje" aria-label="Confirmar hoje" className="confirm-action" onClick={()=>updatePayment(t,'Realizado')}>Confirmar</button>}{t.status==='Realizado'&&<button title="Voltar a pendente" aria-label="Voltar a pendente" className="undo-action" onClick={()=>updatePayment(t,'Pendente')}>Reabrir</button>}{actions('transaction',t.id)}</div></td></tr>)}</tbody></table>{!results.length&&<Empty text="Nenhum lançamento encontrado para os filtros selecionados."/>}</div>
 </Pane><div className="footnote">{results.length} lançamento(s) filtrados · {totals.pending} pendente(s) · Somente realizados afetam os saldos. Transferências não alteram o resultado. Recorrências e parcelas futuras ficam pendentes; somente a quitação afeta o saldo.</div></div>;
 const accounts=<div className="vertical">
 <div className="section-top"><div><h2>Contas e categorias</h2><p>Organize seu dinheiro e mantenha o histórico financeiro consistente.</p></div><Button variant="primary" icon="plus" onClick={()=>setModal({type:'account'})}>Nova conta</Button></div>
 <div className="account-grid">{data.accounts.map(a=><Pane key={a.id} className="account-card">
  <div className="account-top"><div className="account-icon"><Icon name="wallet" size={21}/></div>{actions('account',a.id)}</div>
  <h3>{a.name}{a.archived&&<span className="catalog-inactive"> Arquivada</span>}</h3>
  <div className="secondary-text">{a.type}</div><div className="account-balance">{mask(accountBalance(data,a.id))}</div>
  <p>Saldo inicial: {mask(a.openingCents)}</p>
  <div className="catalog-actions"><Button variant="ghost" onClick={()=>toggleArchive('account',a.id,!a.archived)}>{a.archived?'Reativar conta':'Arquivar conta'}</Button></div>
 </Pane>)}</div>
 <div className="tip"><Icon name="info" size={17}/>Arquivar oculta a conta de novos lançamentos, mas preserva saldos e históricos. Contas utilizadas não podem ser excluídas.</div>
 <Pane title="Categorias financeiras" detail="Edite e organize suas categorias. Arquivar preserva os lançamentos antigos."
   actions={<Button icon="plus" onClick={()=>setModal({type:'category'})}>Nova categoria</Button>}>
  <div className="catalog-columns">{(['Despesa','Receita'] as const).map(group=><div key={group}>
   <h3 className="catalog-heading">{group==='Despesa'?'Despesas':'Receitas'}</h3>
   <div className="catalog-rows">{data.categories.filter(c=>c.group===group).map(c=><div className="catalog-row" key={c.id}>
    <span className={c.archived?'catalog-muted':''}>{c.name}{c.archived&&<small>Arquivada</small>}</span>
    <div className="catalog-row-actions"><Button variant="ghost" onClick={()=>toggleArchive('category',c.id,!c.archived)}>{c.archived?'Reativar':'Arquivar'}</Button>{actions('category',c.id)}</div>
   </div>)}</div>
  </div>)}</div>
 </Pane>
 </div>;
 const planning=<div className="vertical"><div className="section-top"><div><h2>Planejamento</h2><p>Acompanhe limites e metas para manter o controle.</p></div><Button variant="primary" icon="plus" onClick={()=>setModal({type:'budget'})}>Novo orçamento</Button></div>
 {savings&&<Pane title="Meta mensal de economia" detail="Receitas realizadas menos despesas realizadas no período escolhido"><div className="savings-overview">
  <div><small>Resultado do mês</small><strong>{mask(savings.netCents)}</strong></div>
  <div><small>Meta definida</small><strong>{mask(savings.targetCents)}</strong></div>
  <div><small>Falta atingir</small><strong>{mask(savings.remainingCents)}</strong></div>
 </div><Progress ratio={savings.ratio}/><p className="fine">Dia de acompanhamento: {savings.reviewDay} de cada mês. Configure a meta em Configurações. O resultado financeiro não equivale necessariamente a dinheiro reservado.</p></Pane>}
 <Pane title="Orçamentos por categoria" detail="Despesas realizadas + pendentes · acompanhamento mensal"><div className="budgets-list">{budgets.length?budgets.map(b=><div className="budget-item" key={b.category}><div className="budget-name"><b>{b.category}</b><span>{mask(b.projectedCents)} de {mask(b.limitCents)}</span></div><div><Progress ratio={b.ratio}/><small>{mask(b.remainingCents)} disponível{b.ratio>1?' · excedido':''}</small></div><div className="budget-percent">{percent(b.ratio)}</div>{actions('budget',b.category)}</div>):<Empty text="Ainda não há orçamentos definidos." action={<Button icon="plus" onClick={()=>setModal({type:'budget'})}>Criar orçamento</Button>}/>}</div></Pane>
 <div className="section-top"><div><h2>Metas de economia</h2><p>Registre seus objetivos e acompanhe o progresso.</p></div><Button onClick={()=>setModal({type:'goal'})} icon="plus">Nova meta</Button></div>
 <div className="account-grid">{data.goals.length?data.goals.map(g=><Pane key={g.id} className="goal-card"><div className="account-top"><span className="account-icon"><Icon name="target"/></span>{actions('goal',g.id)}</div><h3>{g.name}</h3><strong className="goal-total">{mask(g.savedCents)} <span>/ {mask(g.targetCents)}</span></strong><Progress ratio={g.savedCents/g.targetCents}/><p>{g.dueDate?'Prazo: '+fmtDate(g.dueDate):'Sem prazo definido'}</p></Pane>):<div className="surface"><Empty text="Nenhuma meta cadastrada." action={<Button icon="plus" onClick={()=>setModal({type:'goal'})}>Criar meta</Button>}/></div>}</div>
 </div>;
 const reports=<div className="vertical"><div className="section-top"><div><h2>Relatórios</h2><p>Síntese do período financeiro selecionado.</p></div><div className="head-actions"><Button icon="download" onClick={()=>download(`clara-movimentacoes-${month}.csv`,transactionsCSV(data),'text/csv;charset=utf-8')}>Exportar CSV</Button><Button icon="print" variant="primary" onClick={()=>window.print()}>Imprimir / PDF</Button></div></div>
 <div className="metrics"><Kpi title="Entradas" value={mask(summary.income)} icon="arrowup" tone="success" description={monthText(month)}/><Kpi title="Saídas" value={mask(summary.expense)} icon="arrowdown" tone="danger" description={monthText(month)}/><Kpi title="Resultado" value={mask(summary.result)} icon="reports" tone="blue" description={monthText(month)}/><Kpi title="Pendências" value={mask(summary.pending)} icon="calendar" description="Despesas não realizadas"/></div>
 <Pane title="Resumo anual"><YearChart data={data} month={month} mask={mask}/></Pane><Pane title="Contas e saldos"><div className="summary-list">{summary.accounts.map(a=><div key={a.id} className="highlight-row"><span>{a.name}</span><strong>{mask(a.balanceCents)}</strong></div>)}</div></Pane>
 <div className="tip"><Icon name="info" size={17}/>O PDF usa a impressão do navegador. Relatórios avançados de conciliação e análise serão implementados nas Etapas 7 e 9.</div></div>;
 const settings=<div className="vertical"><div className="section-top"><div><h2>Configurações</h2><p>Privacidade, aparência e armazenamento local.</p></div><span className="version-chip">Etapa 5 / 10 · v{VERSION}</span></div>
 <div className="settings-grid"><Pane title="Aparência" detail="Identidade visual do Clara, inspirada na navegação do EvoluFísico2"><div className="setting-row"><div><b>Tema</b><p>Claro ou escuro</p></div><select aria-label="Tema" value={data.settings.theme} onChange={e=>modify(d=>{d.settings.theme=e.target.value as 'light'|'dark'})}><option value="light">Claro</option><option value="dark">Escuro</option></select></div><div className="setting-row"><div><b>Cor de destaque</b><p>Verde-petróleo ou azul</p></div><select aria-label="Cor de destaque" value={data.settings.accent} onChange={e=>modify(d=>{d.settings.accent=e.target.value as 'petrol'|'blue'})}><option value="petrol">Petróleo</option><option value="blue">Azul</option></select></div><div className="setting-row"><div><b>Ocultar valores</b><p>Proteção visual na tela</p></div><input aria-label="Ocultar valores" type="checkbox" checked={data.settings.hideValues} onChange={e=>modify(d=>{d.settings.hideValues=e.target.checked})}/></div></Pane>
 <Pane title="Preferências financeiras" detail="Acompanhamento da economia e metas da planilha original">
 <div className="settings-finance-form">
  <label className="form-field"><span>Meta mensal de economia (R$)</span><input aria-label="Meta mensal de economia" value={savingsDraft} onChange={e=>setSavingsDraft(e.target.value)} placeholder="0,00"/></label>
  <label className="form-field"><span>Dia do acompanhamento (1 a 28)</span><input aria-label="Dia do acompanhamento" type="number" min="1" max="28" value={reviewDraft} onChange={e=>setReviewDraft(e.target.value)}/></label>
  <Button icon="check" onClick={savePreferences}>Salvar preferências financeiras</Button>
 </div><p className="fine">A meta é calculada sobre receitas e despesas realizadas. Ajustes permanecem no banco local e são incluídos nos backups.</p></Pane>
 <Pane title="Pasta de dados local" detail="O IndexedDB é o banco principal. A pasta recebe um espelho JSON quando o navegador permitir."><div className="folder-info"><Icon name="folder" size={23}/><div><b>{folder.name||'Nenhuma pasta vinculada'}</b><span>{folder.state==='granted'?'Acesso concedido':folder.state==='none'?'Backup em pasta opcional':`Permissão: ${folder.state}`}</span></div></div><div className="wrap-actions"><Button icon="folder" onClick={pickFolder}>Escolher pasta</Button><Button icon="upload" onClick={saveFolder}>Atualizar cópia</Button><Button icon="download" onClick={action(async()=>restore(await readFolderCopy(),'a cópia da pasta'))}>Restaurar pasta</Button><Button variant="ghost" onClick={action(async()=>{if(window.confirm('Desvincular a pasta? O arquivo externo será preservado.')){await clearDirectoryHandle();setFolder(await folderPermission());notify('Pasta desvinculada.')}})}>Desvincular</Button></div><p className="fine">A seleção direta de pasta exige navegador compatível e contexto seguro (HTTPS ou localhost). No celular, utilize exportação e importação de backup quando esta opção não estiver disponível.</p></Pane>
 <Pane title="Instalação do PWA" detail="Instale o Clara na tela inicial após publicá-lo em HTTPS ou executar no localhost."><div className="wrap-actions"><Button icon="download" disabled={!installPrompt} onClick={action(async()=>{if(!installPrompt)return;await installPrompt.prompt();await installPrompt.userChoice;setInstallPrompt(null)})}>Instalar Clara</Button></div><p className="fine">Caso o botão esteja desativado, use o menu do navegador → Instalar aplicativo / Adicionar à tela inicial, quando disponível.</p></Pane>
 <Pane title="Backup e recuperação" detail="Seus dados permanecem neste dispositivo e não são enviados a um servidor."><div className="wrap-actions"><Button icon="download" onClick={()=>download(`clara-backup-${today()}.json`,JSON.stringify(data,null,2),'application/json')}>Exportar backup JSON</Button><Button icon="upload" onClick={()=>importRef.current?.click()}>Restaurar arquivo</Button></div><input ref={importRef} hidden type="file" accept=".json,application/json"/><p className="fine">Exportações não são criptografadas. Guarde-as em local protegido. Backups regulares são essenciais para evitar perda de dados ao limpar o navegador.</p></Pane>
 <Pane title="Demonstração e manutenção" detail="Ambiente de exemplos separado do uso real"><div className="wrap-actions"><Button icon="info" onClick={demonstration}>Carregar demonstração</Button><Button variant="danger" icon="trash" onClick={reset}>Começar do zero</Button></div><div className="diagnostics"><div><span>Registros</span><b>{data.transactions.length}</b></div><div><span>Contas</span><b>{data.accounts.length}</b></div><div><span>Esquema</span><b>v{data.schemaVersion}</b></div><div><span>Revisão</span><b>{data.revision}</b></div></div></Pane></div></div>;
 const current:{[k in View]:React.ReactNode}={dashboard,transactions,accounts,planning,reports,settings};
 return <div className={`shell ${collapsed?'is-collapsed':''}`}>
 <aside className="side"><div className="brand"><div className="brand-sign">C</div><div className="brand-name"><strong>Clara<span>.</span></strong><small>FINANÇAS</small></div></div><div className="menu-title">ÁREA DE TRABALHO</div><nav className="side-links" aria-label="Navegação principal">{sections.map(s=><button key={s.id} className={`side-link ${view===s.id?'active':''}`} onClick={()=>show(s.id)} title={s.name} aria-current={view===s.id?'page':undefined}><Icon name={s.id} size={19}/><span>{s.name}</span></button>)}</nav><div className="side-bottom"><div className="storage-bullet"/> <span>Dados armazenados localmente</span><small>Arquitetura A · Offline</small></div></aside>
 <main className="main"><header className="header"><div className="header-title"><button aria-label="Recolher ou expandir menu" title="Recolher / expandir menu" className="icon-button collapse-toggle" onClick={()=>{setCollapsed(v=>{try{localStorage.setItem('clara-sidebar',!v?'1':'0')}catch{}return !v})}}><Icon name="menu" size={21}/></button><div><div className="header-overline">CLARA / GESTÃO FINANCEIRA</div><h1>{sections.find(s=>s.id===view)?.name}</h1></div></div><div className="header-actions">{view!=='settings'&&<label className="period-box"><Icon name="calendar" size={17}/><input aria-label="Mês de referência" type="month" value={month} onChange={e=>{const value=e.currentTarget.value;if(/^\d{4}-(0[1-9]|1[0-2])$/.test(value))modify(d=>{d.settings.selectedPeriod=value}).catch(err=>notify(err.message,true))}}/></label>}<button className="icon-button" title={data.settings.hideValues?'Mostrar valores':'Ocultar valores'} aria-label={data.settings.hideValues?'Mostrar valores':'Ocultar valores'} onClick={()=>modify(d=>{d.settings.hideValues=!d.settings.hideValues})}><Icon name={data.settings.hideValues?'hide':'eye'} size={20}/></button><span className="step-pill">05 / 10</span></div></header>{current[view]}<footer className="footer">Clara Finanças · Local-first · Etapa 4 de 10 · Sem conexão bancária</footer></main>
 <nav className="mobile-nav" aria-label="Navegação inferior">{(['dashboard','transactions','accounts','planning','reports','settings'] as View[]).map(id=><button key={id} className={view===id?'active':''} onClick={()=>show(id)} aria-label={sections.find(s=>s.id===id)?.name}><Icon name={id} size={21}/><span>{sections.find(s=>s.id===id)?.short}</span></button>)}</nav>
 {modal&&<Modal key={`${modal.type}-${modal.id||'new'}`} data={data} modal={modal} onClose={()=>setModal(null)} onSave={submitModal} saving={saving}/>}
 {notice&&<div role="status" className={`toast ${notice.danger?'danger':''}`}>{notice.text}</div>}
 </div>;
}
