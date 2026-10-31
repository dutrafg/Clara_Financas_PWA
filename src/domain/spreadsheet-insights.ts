import * as model from '../legacy/spreadsheet-insights.mjs';
import type {FinanceData} from './types';
export type SpreadsheetInsights={
 month:string;cutoff:string;closingCents:number;pendingNext30Cents:number;availableAfter30Cents:number;reserveCents:number;
 budgets:{category:string;limitCents:number;usedCents:number;pendingCents:number;projectedCents:number;ratio:number}[];
 goals:{id:string;name:string;targetCents:number;savedCents:number;ratio:number;missingCents:number}[];
 flow4:{month:string;openingCents:number;incomingCents:number;outgoingCents:number;closingCents:number}[];
 budgetTotalCents:number;budgetUsedCents:number;budgetProjectedCents:number;budgetOverLimit:number;
};
export const spreadsheetInsights=model.spreadsheetInsights as (data:FinanceData,month:string,cutoff:string)=>SpreadsheetInsights;
