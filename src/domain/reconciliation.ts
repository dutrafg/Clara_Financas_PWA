import * as m from '../legacy/reconciliation.mjs';
import type {FinanceData,Reconciliation} from './types';
export type ReconcileInput={accountId:string;asOfDate:string;statementCents:number;note?:string};
export type Reconciled=Reconciliation&{currentCents:number;currentDifferenceCents:number;stale:boolean;matched:boolean};
export type AuditFinding={code:string;level:'warning'|'attention';ids:string[];label:string};
export const reconcileAccount=m.reconcileAccount as (data:FinanceData,entry:ReconcileInput)=>Reconciliation;
export const deleteReconciliation=m.deleteReconciliation as (data:FinanceData,id:string)=>Reconciliation;
export const reconciliationHistory=m.reconciliationHistory as (data:FinanceData)=>Reconciled[];
export const financeAudit=m.financeAudit as (data:FinanceData,opts?:{today:string})=>{findings:AuditFinding[];duplicates:number;overdue:number;mismatches:number};
