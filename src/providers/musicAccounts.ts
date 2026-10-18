import {InvalidRecordError} from '../storage/recovery.ts';
import type {Repository} from '../storage/repository.ts';

export type MusicPlatform='wy'|'tx'|'kg';
export type MusicAccountCapability='playlist'|'favorite'|'daily'|'fm';
export interface MusicAccount {
  id:string;
  platform:MusicPlatform;
  label:string;
  username:string;
  capabilities:readonly MusicAccountCapability[];
  updatedAt:number;
}
export interface MusicSession {readonly [key:string]:unknown}
export interface MusicSecretStore {get(key:string):Promise<string|null>;set(key:string,value:string):Promise<void>;remove(key:string):Promise<void>}

const platforms=new Set<MusicPlatform>(['wy','tx','kg']);
const capabilities=new Set<MusicAccountCapability>(['playlist','favorite','daily','fm']);
const validAccount=(value:unknown):value is MusicAccount=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const item=value as Record<string,unknown>;
  return typeof item.id==='string'&&/^[a-f0-9]{64}$/.test(item.id)&&platforms.has(item.platform as MusicPlatform)&&
    typeof item.label==='string'&&item.label.length>0&&item.label.length<=120&&typeof item.username==='string'&&
    item.username.length<=256&&Array.isArray(item.capabilities)&&item.capabilities.every(value=>capabilities.has(value as MusicAccountCapability))&&
    Number.isSafeInteger(item.updatedAt)&&Number(item.updatedAt)>=0;
};
const safeSession=(value:unknown):value is MusicSession=>!!value&&typeof value==='object'&&!Array.isArray(value);

/** Account metadata is recoverable; session material is always kept in the platform keychain entry. */
export class MusicAccounts {
  private readonly repository:Pick<Repository,'get'|'put'>;
  private readonly secrets:MusicSecretStore;
  private readonly hash:(value:string)=>Promise<string>;
  private value:readonly MusicAccount[]=[];
  private readonly listeners=new Set<()=>void>();
  private tail:Promise<unknown>=Promise.resolve();
  constructor(repository:Pick<Repository,'get'|'put'>,secrets:MusicSecretStore,hash:(value:string)=>Promise<string>){this.repository=repository;this.secrets=secrets;this.hash=hash;}
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  private publish(value:readonly MusicAccount[]){this.value=value;for(const listener of this.listeners)listener();}
  private mutate<T>(run:()=>Promise<T>){const next=this.tail.then(run);this.tail=next.catch(()=>{});return next;}
  async restore(){
    const saved=await this.repository.get<unknown>('music.accounts.v1')??[];
    if(!Array.isArray(saved)||saved.some(item=>!validAccount(item)))throw new InvalidRecordError();
    this.publish(saved);
  }
  async save(account:Omit<MusicAccount,'id'|'updatedAt'>,session:MusicSession){
    return this.mutate(async()=>{
      if(!platforms.has(account.platform)||!account.label.trim()||!account.username.trim()||!safeSession(session))throw new Error('平台账号资料无效');
      const now=Date.now(),id=await this.hash(JSON.stringify([account.platform,account.username.trim()]));
      const record:MusicAccount={...account,id,label:account.label.trim(),username:account.username.trim(),updatedAt:now};
      if(!validAccount(record))throw new Error('平台账号资料无效');
      const key=`nexus.music.${record.id}`,old=await this.secrets.get(key),next=[...this.value.filter(item=>item.id!==id),record];
      await this.secrets.set(key,JSON.stringify(session));
      try{await this.repository.put('music.accounts.v1',next);}catch(error){if(old===null)await this.secrets.remove(key);else await this.secrets.set(key,old);throw error;}
      this.publish(next);return record;
    });
  }
  async session(id:string):Promise<MusicSession>{
    if(!this.value.some(item=>item.id===id))throw new Error('平台账号不存在');
    const raw=await this.secrets.get(`nexus.music.${id}`);if(!raw)throw new Error('平台会话已失效，请重新登录');
    let parsed:unknown;try{parsed=JSON.parse(raw);}catch{throw new Error('平台会话不可用');}
    if(!safeSession(parsed))throw new Error('平台会话不可用');return parsed;
  }
  remove(id:string){
    return this.mutate(async()=>{
      const old=await this.secrets.get(`nexus.music.${id}`),next=this.value.filter(item=>item.id!==id);
      await this.secrets.remove(`nexus.music.${id}`);
      try{await this.repository.put('music.accounts.v1',next);}catch(error){if(old!==null)await this.secrets.set(`nexus.music.${id}`,old);throw error;}
      this.publish(next);
    });
  }
}
