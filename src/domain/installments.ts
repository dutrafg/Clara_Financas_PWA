import * as installments from '../legacy/installments.mjs';
import type {FinanceData,Transaction} from './types';
export type InstallmentInput={
 description:string;category:string;accountId:string;purchaseDate:string;firstDueDate:string;
 purchaseCents:number;downPaymentCents:number;feesCents:number;monthlyRateBps:number;count:number;
};
export type InstallmentRow={index:number;dueDate:string;principalCents:number;interestCents:number;amountCents:number;balanceCents:number};
export type InstallmentPreview={financedCents:number;purchaseCents:number;downPaymentCents:number;feesCents:number;monthlyRateBps:number;count:number;totalInterestCents:number;totalInstallmentsCents:number;totalPayableCents:number;rows:InstallmentRow[]};
export type InstallmentGroup={id:string;count:number;entries:Transaction[];totalCents:number;paidCents:number;pendingCents:number;interestCents:number;overdueCents:number;completed:number;canceled:number};
export const installmentSchedule=installments.installmentSchedule as (params:Pick<InstallmentInput,'purchaseCents'|'downPaymentCents'|'feesCents'|'monthlyRateBps'|'count'|'firstDueDate'>)=>InstallmentPreview;
export const createInstallmentMovements=installments.createInstallmentMovements as (params:InstallmentInput,data:FinanceData)=>InstallmentPreview&{entries:Transaction[];groupId:string};
export const summarizeInstallmentGroups=installments.summarizeInstallmentGroups as (data:FinanceData)=>InstallmentGroup[];
