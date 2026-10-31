/* Adaptador TypeScript com contratos estáticos para o motor financeiro homologado na etapa 01.
   Mantém os algoritmos sem modificações para evitar regressão de cálculos. */
import * as source from '../legacy/core.mjs';
import type {FinanceData, Transaction, FinancialStats, Budget} from './types';
export const VERSION = '0.3.0';
export const blankData = source.blankData as () => FinanceData;
export const uid = source.uid as (prefix?:string) => string;
export const brl = source.brl as (cents:number) => string;
export const fmtDate = source.fmtDate as (date:string) => string;
export const parseMoney = source.parseMoney as (text:string) => number;
export const effectiveDate = source.effectiveDate as (transaction:Transaction) => string;
export const periodStats = source.periodStats as (data:FinanceData,month:string) => FinancialStats;
export const budgetStatus = source.budgetStatus as (data:FinanceData,month:string) => (Budget & {usedCents:number;pendingCents:number;projectedCents:number;remainingCents:number;ratio:number})[];
export const budgetInsight = source.budgetInsight as (data:FinanceData,month:string)=>string;
export const accountBalance = source.accountBalance as (data:FinanceData,id:string,asOfDate?:string|null)=>number;
export const validateTransaction = source.validateTransaction as (tx:Transaction,data:FinanceData)=>true;
export const validateBackup = source.validateBackup as (data:FinanceData)=>true;
export const migrateData = source.migrateData as (input:unknown)=>FinanceData;
export const deriveDemo = source.deriveDemo as (raw:unknown)=>FinanceData;
export const transactionsCSV = source.transactionsCSV as (data:FinanceData)=>string;
