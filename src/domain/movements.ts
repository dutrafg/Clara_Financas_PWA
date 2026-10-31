import * as movements from '../legacy/movements.mjs';
import type {FinanceData,Transaction,Status} from './types';
export type Frequency='none'|'weekly'|'monthly'|'yearly';
export type FilterBasis='effective'|'due';
export type MovementFilters={month?:string;basis?:FilterBasis;search?:string;kind?:string;status?:string;account?:string;category?:string;from?:string;to?:string;overdue?:boolean;onDate?:string;sort?:'newest'|'oldest'|'amount-desc'|'amount-asc'};
export const dateAtRecurrence=movements.dateAtRecurrence as (date:string,frequency:Frequency,index:number)=>string;
export const createMovements=movements.createMovements as (base:Transaction,data:FinanceData,params:{frequency:Frequency;count:number})=>Transaction[];
export const changeMovementStatus=movements.changeMovementStatus as (tx:Transaction,status:Status,paidAt:string)=>Transaction;
export const isOverdue=movements.isOverdue as (tx:Transaction,onDate:string)=>boolean;
export const listMovements=movements.listMovements as (data:FinanceData,filters:MovementFilters)=>Transaction[];
export const movementTotals=movements.movementTotals as (items:Transaction[])=>{count:number;pending:number;toPay:number;toReceive:number;income:number;expense:number};

export const previewMovementsCSV=movements.previewMovementsCSV as (csv:string,data:FinanceData)=>{entries:Transaction[];duplicates:number;rows:number};
