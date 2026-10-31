import * as m from '../legacy/lock.mjs';
export const createLockRecord=m.createLockRecord as (password:string)=>Promise<string>;
export const verifyLockRecord=m.verifyLockRecord as (record:string,password:string)=>Promise<boolean>;
