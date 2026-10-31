import * as m from '../legacy/security.mjs';
import type {FinanceData} from './types';
export const encryptBackup=m.encryptBackup as (data:FinanceData,password:string)=>Promise<string>;
export const decryptBackup=m.decryptBackup as (serialized:string,password:string)=>Promise<FinanceData>;
export const isEncryptedBackup=m.isEncryptedBackup as (serialized:string)=>boolean;
