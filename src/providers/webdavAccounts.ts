import type {Repository} from '../storage/repository.ts';
import {InvalidRecordError} from '../storage/recovery.ts';
import {CredentialStorageError,type SecretStore} from './navidromeAccounts.ts';
import {normalizeDAVRoot,WebDAVClient,WebDAVError,type WebDAVAccount,type WebDAVCredentials,type DAVTransport} from './webdav.ts';
export class WebDAVAccounts {
  private repository:Pick<Repository,'get'|'put'>;private secrets:SecretStore;private hash:(text:string)=>Promise<string>;private transport:DAVTransport;
  private value:readonly WebDAVAccount[]=[];private clients=new Map<string,WebDAVClient>();private listeners=new Set<()=>void>();private tail:Promise<unknown>=Promise.resolve();
  constructor(repository:Pick<Repository,'get'|'put'>,secrets:SecretStore,hash:(text:string)=>Promise<string>,transport:DAVTransport){this.repository=repository;this.secrets=secrets;this.hash=hash;this.transport=transport;}
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(value:readonly WebDAVAccount[]){this.value=value;for(const listener of this.listeners)listener();}
  private mutate<T>(run:()=>Promise<T>){const next=this.tail.then(run);this.tail=next.catch(()=>{});return next;}
  async restore(){
    const value=await this.repository.get<WebDAVAccount[]>('webdav.accounts.v1')??[];
    try{
      if(!Array.isArray(value)||value.length>32||new Set(value.map(item=>item.id)).size!==value.length)throw new Error();
      for(const item of value)if(!item||!/^[a-f0-9]{64}$/.test(item.id)||typeof item.username!=='string'||!item.username||typeof item.label!=='string'||item.label.length>64||normalizeDAVRoot(item.url)!==item.url)throw new Error();
    }catch{throw new InvalidRecordError();}
    // Reconstruct fields: even a stale/foreign record must not retain embedded secrets.
    this.publish(value.map(({id,url,username,label})=>({id,url,username,label})));
  }
  connect(rawURL:string,username:string,password:string,label='',signal=new AbortController().signal){
    return this.mutate(async()=>{
      const url=normalizeDAVRoot(rawURL),user=username.trim(),name=label.trim()||user;
      if(!user||user.includes(':')||/[\u0000-\u001f\u007f]/.test(user)||!password||name.length>64)throw new WebDAVError('configuration');
      const id=await this.hash(JSON.stringify([url,user]));if(!/^[a-f0-9]{64}$/.test(id))throw new Error('Invalid account identity');
      if(this.value.length>=32&&!this.value.some(item=>item.id===id))throw new WebDAVError('configuration');
      const account={id,url,username:user,label:name},credentials={username:user,password},client=new WebDAVClient(account,credentials,this.transport);
      const entries=await client.list('',signal);if(signal.aborted)throw signal.reason;
      const key=`nexus.webdav.${id}`,old=await this.secrets.get(key),accounts=[...this.value.filter(item=>item.id!==id),account];
      try{await this.secrets.set(key,JSON.stringify(credentials));}catch{throw new CredentialStorageError();}
      try{await this.repository.put('webdav.accounts.v1',accounts);}catch(error){if(old===null)await this.secrets.remove(key);else await this.secrets.set(key,old);throw error;}
      this.clients.set(id,client);this.publish(accounts);return{account,entries};
    });
  }
  async credentials(id:string):Promise<WebDAVCredentials>{
    const account=this.value.find(item=>item.id===id);if(!account)throw new WebDAVError('missing');
    const raw=await this.secrets.get(`nexus.webdav.${id}`);let value:WebDAVCredentials;
    try{value=JSON.parse(raw??'null') as WebDAVCredentials;if(!value||value.username!==account.username||typeof value.password!=='string'||!value.password)throw new Error();}catch{throw new WebDAVError('authorization');}
    if(!this.value.includes(account))throw new WebDAVError('missing');return{username:value.username,password:value.password};
  }
  async client(id:string){
    const account=this.value.find(item=>item.id===id);if(!account)throw new WebDAVError('missing');
    const cached=this.clients.get(id);if(cached)return cached;
    const credentials=await this.credentials(id);if(!this.value.includes(account))throw new WebDAVError('missing');
    const client=new WebDAVClient(account,credentials,this.transport);this.clients.set(id,client);return client;
  }
  remove(id:string){return this.mutate(async()=>{
    const key=`nexus.webdav.${id}`,old=await this.secrets.get(key),accounts=this.value.filter(item=>item.id!==id);
    await this.secrets.remove(key);try{await this.repository.put('webdav.accounts.v1',accounts);}catch(error){if(old!==null)await this.secrets.set(key,old);throw error;}
    this.clients.delete(id);this.publish(accounts);
  });}
}
