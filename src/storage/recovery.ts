import type {Repository} from './repository.ts';
// Preserve the exact original JSON, including malformed bytes, before allowing
// new snapshots to be written. Future versions must remain untouched.
export async function restoreRecord(repository:Pick<Repository,'get'|'quarantine'>,key:string,restore:()=>Promise<void>,uuid:()=>string):Promise<boolean>{
  try{
    const raw=await repository.get<unknown>(key);
    if(raw&&typeof raw==='object'&&!Array.isArray(raw)&&typeof (raw as {version?:unknown}).version==='number'&&(raw as {version:number}).version>1)throw new FutureRecordError();
  }catch(error){if(error instanceof FutureRecordError)throw error;if(!(error instanceof SyntaxError))throw error;await repository.quarantine(key,`recovery.${key}.${uuid()}`);return false;}
  try{await restore();return true;}catch(error){if(!(error instanceof InvalidRecordError))throw error;await repository.quarantine(key,`recovery.${key}.${uuid()}`);return false;}
}
export class FutureRecordError extends Error {constructor(){super('本地数据来自更新版本，请使用更新版本应用，原数据未修改');}}

export class InvalidRecordError extends Error {constructor(){super('本地记录格式无效');}}
