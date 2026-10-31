/* Etapa 5: catálogos e preferências. Operações puras sobre um rascunho
   de FinanceData; salvar somente após validateBackup + transação IndexedDB. */
import {uid,periodStats} from './core.mjs';
const cleanName=(value,label)=>{
 const name=String(value??'').trim().replace(/\s+/g,' ');
 if(name.length<2||name.length>60)throw Error(label+' deve conter de 2 a 60 caracteres.');
 return name;
};
const norm=value=>value.normalize('NFC').toLocaleLowerCase('pt-BR');
const accountTypes=['Conta','Dinheiro','Carteira','Cartão'];
function account(data,id){const a=data.accounts.find(x=>x.id===id);if(!a)throw Error('Conta não encontrada.');return a;}
function category(data,id){const c=data.categories.find(x=>x.id===id);if(!c)throw Error('Categoria não encontrada.');return c;}
function ensureAccountUnique(data,name,except){
 if(data.accounts.some(a=>a.id!==except&&norm(a.name)===norm(name)))throw Error('Já existe uma conta com esse nome.');
}
function ensureCategoryUnique(data,name,group,except){
 if(data.categories.some(c=>c.id!==except&&c.group===group&&norm(c.name)===norm(name)))
  throw Error('Já existe uma categoria com esse nome e tipo.');
}
const safeOpening=cents=>{if(!Number.isSafeInteger(cents)||Math.abs(cents)>1_000_000_000_000)throw Error('Saldo inicial inválido.');return cents;};
export function createAccount(data,{name,type='Conta',openingCents=0}){
 const cleaned=cleanName(name,'Nome da conta');
 if(!accountTypes.includes(type))throw Error('Tipo de conta inválido.');
 safeOpening(openingCents);ensureAccountUnique(data,cleaned);
 if(data.accounts.length>=10000)throw Error('Limite de contas atingido.');
 const a={id:uid('acc'),name:cleaned,type,openingCents,archived:false};data.accounts.push(a);return a;
}
export function updateAccount(data,id,{name,type,openingCents}){
 const a=account(data,id),cleaned=cleanName(name,'Nome da conta');
 if(!accountTypes.includes(type))throw Error('Tipo de conta inválido.');
 safeOpening(openingCents);ensureAccountUnique(data,cleaned,id);
 a.name=cleaned;a.type=type;a.openingCents=openingCents;return a;
}
export function archiveAccount(data,id,archived){
 const a=account(data,id);
 if(typeof archived!=='boolean')throw Error('Estado da conta inválido.');
 if(archived&&!a.archived&&data.accounts.filter(x=>!x.archived).length<=1)throw Error('É necessário manter uma conta ativa.');
 a.archived=archived;return a;
}
export function deleteAccount(data,id){
 account(data,id);
 if(data.accounts.length<=1)throw Error('É necessário manter ao menos uma conta.');
 if(data.transactions.some(t=>t.accountId===id||t.toAccountId===id))
  throw Error('Conta utilizada em lançamentos não pode ser excluída; arquive-a.');
 data.accounts=data.accounts.filter(a=>a.id!==id);
 if(!data.accounts.some(a=>!a.archived))throw Error('É necessário manter uma conta ativa.');
 return true;
}
export function createCategory(data,{name,group}){
 const cleaned=cleanName(name,'Nome da categoria');
 if(!['Receita','Despesa'].includes(group))throw Error('Tipo de categoria inválido.');
 ensureCategoryUnique(data,cleaned,group);
 if(data.categories.length>=10000)throw Error('Limite de categorias atingido.');
 const c={id:uid('cat'),name:cleaned,group,archived:false};data.categories.push(c);return c;
}
export function updateCategory(data,id,{name,group}){
 const c=category(data,id),cleaned=cleanName(name,'Nome da categoria');
 if(!['Receita','Despesa'].includes(group))throw Error('Tipo de categoria inválido.');
 ensureCategoryUnique(data,cleaned,group,id);
 const used=data.transactions.some(t=>t.kind===c.group&&t.category===c.name);
 const budgetUsed=data.budgets.some(b=>c.group==='Despesa'&&b.category===c.name);
 if(group!==c.group&&(used||budgetUsed))throw Error('Categoria em uso não pode mudar de tipo.');
 const oldName=c.name,oldGroup=c.group;
 for(const t of data.transactions)if(t.kind===oldGroup&&t.category===oldName)t.category=cleaned;
 if(oldGroup==='Despesa')for(const b of data.budgets)if(b.category===oldName)b.category=cleaned;
 c.name=cleaned;c.group=group;return c;
}
export function archiveCategory(data,id,archived){
 const c=category(data,id);
 if(typeof archived!=='boolean')throw Error('Estado da categoria inválido.');
 c.archived=archived;return c;
}
export function deleteCategory(data,id){
 const c=category(data,id);
 if(data.transactions.some(t=>t.kind===c.group&&t.category===c.name)||
    (c.group==='Despesa'&&data.budgets.some(b=>b.category===c.name)))
  throw Error('Categoria com lançamentos ou orçamentos não pode ser excluída; arquive-a.');
 data.categories=data.categories.filter(x=>x.id!==id);return true;
}
export function setFinancialPreferences(data,{monthlySavingsCents,reviewDay}){
 if(!Number.isSafeInteger(monthlySavingsCents)||monthlySavingsCents<0||monthlySavingsCents>1_000_000_000_000)
  throw Error('Meta mensal deve ser um valor válido em centavos.');
 if(!Number.isInteger(reviewDay)||reviewDay<1||reviewDay>28)
  throw Error('O acompanhamento deve ocorrer entre os dias 1 e 28.');
 data.settings.monthlySavingsCents=monthlySavingsCents;
 data.settings.reviewDay=reviewDay;return data.settings;
}
export function savingsOverview(data,month){
 const {income,expense,result}=periodStats(data,month);
 const targetCents=data.settings.monthlySavingsCents||0;
 const achievedCents=Math.max(0,result);
 return {incomeCents:income,expenseCents:expense,netCents:result,targetCents,
   achievedCents,remainingCents:Math.max(0,targetCents-achievedCents),
   ratio:targetCents?achievedCents/targetCents:0,reviewDay:data.settings.reviewDay||1};
}
