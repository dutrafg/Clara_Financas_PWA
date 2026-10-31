export type Kind = 'Receita' | 'Despesa' | 'Transferência';
export type Status = 'Realizado' | 'Pendente' | 'Cancelado';
export type Theme = 'light' | 'dark';
export type Accent = 'petrol' | 'blue';
export type View = 'dashboard'|'transactions'|'accounts'|'planning'|'reports'|'settings';
export interface Account { id:string; name:string; type:string; openingCents:number; }
export interface Category { id:string; name:string; group:'Receita'|'Despesa' }
export interface Transaction { id:string; date:string; paidAt?:string; description:string; kind:Kind; category:string; amountCents:number; accountId:string; toAccountId?:string; status:Status; note?:string; recurrenceGroupId?:string; recurrenceIndex?:number; recurrenceCount?:number; recurrenceFrequency?:'weekly'|'monthly'|'yearly'; }
export interface Budget { category:string; limitCents:number }
export interface Goal { id:string; name:string; targetCents:number; savedCents:number; dueDate?:string }
export interface FinanceSettings { theme:Theme; accent:Accent; hideValues:boolean; selectedPeriod:string; }
export interface FinanceData { schemaVersion:2; appVersion:string; isDemo:boolean; revision:number; updatedAt:string; accounts:Account[]; categories:Category[]; budgets:Budget[]; transactions:Transaction[]; goals:Goal[]; settings:FinanceSettings }
export interface FinancialStats { month:string; income:number; expense:number; result:number; pending:number; pendingIncome:number; cancelled:number; transfers:number; accounts:(Account&{balanceCents:number})[]; totalBalance:number; expensesByCategory:[string,number][]; daily:Map<string,{income:number;expense:number}>; recent:Transaction[]; transactionsCount:number; }
export type FolderInfo = {state:string;name:string};
