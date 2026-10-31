import * as m from '../legacy/dashboard.mjs';
import type {FinanceData,FinancialStats} from './types';
export type DashboardInsight={current:FinancialStats;totalDebtCents:number;alerts:{code:string;level:string;label:string}[];nearLimitCount:number;exhaustedCount:number;forecast:{month:string;closingCents:number;netCents:number}[];netRate:number|null;spendingRate:number|null;pendingNetCents:number;accountCount:number;compromisedCents:number;auditCount:number;goals:{id:string;name:string;remainingCents:number;percentage:number}[]};
export const dashboardInsights=m.dashboardInsights as (d:FinanceData,month:string,opts?:{today:string})=>DashboardInsight;
