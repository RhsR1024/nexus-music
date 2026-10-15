import type { Repository } from '../storage/repository.ts';
import { NavidromeClient, normalizeServerURL, type NavidromeAccount, type NavidromeCredentials } from './navidrome.ts';
export interface SecretStore {get(key:string):Promise<string|null>;set(key:string,value:string):Promise<void>;remove(key:string):Promise<void>}
export class CredentialStorageError extends Error {
  constructor(){super('本机凭据存储不可用，请检查应用签名后重试');}
}
export class NavidromeAccounts {
  private repository:Pick<Repository,'get'|'put'>; private secrets:SecretStore;
  private hash:(value:string)=>Promise<string>; private create:(account:NavidromeAccount,credentials:NavidromeCredentials)=>NavidromeClient;
  private value:readonly NavidromeAccount[]=[]; private clients=new Map<string,NavidromeClient>(); private listeners=new Set<()=>void>();
  private tail:Promise<unknown>=Promise.resolve();
  constructor(repository:Pick<Repository,'get'|'put'>,secrets:SecretStore,hash:(value:string)=>Promise<string>,create:(account:NavidromeAccount,credentials:NavidromeCredentials)=>NavidromeClient) {
    this.repository=repository;this.secrets=secrets;this.hash=hash;this.create=create;
  }
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(value:readonly NavidromeAccount[]) {this.value=value;for(const listener of this.listeners)listener();}
  private mutate<T>(run:()=>Promise<T>) {const next=this.tail.then(run);this.tail=next.catch(()=>{});return next;}
  async restore() {
    const value=await this.repository.get<NavidromeAccount[]>('navidrome.accounts.v1')??[];
    if(!Array.isArray(value)||value.some(item=>!item||typeof item.id!=='string'||typeof item.username!=='string'||normalizeServerURL(item.url)!==item.url)) throw new Error('连接数据损坏');
    this.publish(value);
  }
  connect(url:string,username:string,password:string) {
    return this.mutate(async()=>{
      const base=normalizeServerURL(url),user=username.trim();if(!user||!password)throw new Error('请输入账号密码');
      const id=await this.hash(JSON.stringify([base,user])),account={id,url:base,username:user};
      const credentials={username:user,password},client=this.create(account,credentials);
      const info=await client.connect();
      const key=`nexus.navidrome.${id}`,old=await this.secrets.get(key);
      const accounts=[...this.value.filter(item=>item.id!==id),account];
      try{await this.secrets.set(key,JSON.stringify(credentials));}catch{throw new CredentialStorageError();}
      try {await this.repository.put('navidrome.accounts.v1',accounts);}
      catch(error) {if(old!==null)await this.secrets.set(key,old);else await this.secrets.remove(key);throw error;}
      this.clients.set(id,client);this.publish(accounts);return {account,info};
    });
  }
  async client(id:string):Promise<NavidromeClient> {
    const account=this.value.find(item=>item.id===id);if(!account)throw new Error('请先连接此Navidrome账号');
    const cached=this.clients.get(id);if(cached)return cached;
    const raw=await this.secrets.get(`nexus.navidrome.${id}`);if(!raw)throw new Error('凭据已失效，请重新连接');
    const credentials=JSON.parse(raw) as NavidromeCredentials;
    if(!this.value.includes(account))throw new Error('连接已更改，请重试');
    if(typeof credentials.username!=='string'||typeof credentials.password!=='string')throw new Error('凭据不可用');
    const client=this.create(account,credentials);this.clients.set(id,client);return client;
  }
  remove(id:string) {
    return this.mutate(async()=>{
      const key=`nexus.navidrome.${id}`,old=await this.secrets.get(key),accounts=this.value.filter(item=>item.id!==id);
      await this.secrets.remove(key);
      try {await this.repository.put('navidrome.accounts.v1',accounts);}
      catch(error) {if(old!==null)await this.secrets.set(key,old);throw error;}
      this.clients.delete(id);this.publish(accounts);
    });
  }
}
