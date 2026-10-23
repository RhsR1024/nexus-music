import {appendMany,makeQueue,type QueueState} from '../domain/queue.ts';
import {trackKey,type Track} from '../domain/track.ts';
import {AccountFmError,type AccountFmClient} from '../providers/accountFm.ts';
import type {MusicAccount,MusicAccounts} from '../providers/musicAccounts.ts';

export interface FmPlaybackState {readonly queue:QueueState}
export interface FmPlayback {
  getSnapshot():FmPlaybackState;
  subscribe(listener:()=>void):()=>void;
  play(queue:QueueState):void|Promise<void>;
  setQueue(queue:QueueState):void;
}

export interface AccountFmStationOptions {
  readonly client:Pick<AccountFmClient,'load'>;
  readonly playback:FmPlayback;
  readonly accounts?:Pick<MusicAccounts,'getSnapshot'>;
  readonly lowWatermark?:number;
  readonly retryDelay?:number;
  readonly uuid:()=>string;
  readonly now?:()=>number;
}

interface Station {
  account:MusicAccount;
  session:Readonly<Record<string,unknown>>;
  signal:AbortController;
  entryIds:Set<string>;
  keys:Set<string>;
  loading:boolean;
  exhausted:boolean;
  retryAt:number;
  appendedFor:string|null;
}

/** Feeds personal FM batches into the authoritative playback queue. It only
 * appends owned entries, keeps at most one prefetch in flight, and stops when
 * the account, queue ownership or current selection no longer matches. */
export class AccountFmStation {
  private readonly client:Pick<AccountFmClient,'load'>;
  private readonly playback:FmPlayback;
  private readonly accounts?:Pick<MusicAccounts,'getSnapshot'>;
  private readonly lowWatermark:number;
  private readonly retryDelay:number;
  private readonly uuid:()=>string;
  private readonly now:()=>number;
  private revision=0;
  private station:Station|null=null;
  private unsubscribe:(()=>void)|null=null;
  constructor(options:AccountFmStationOptions){
    this.client=options.client;this.playback=options.playback;this.accounts=options.accounts;
    this.lowWatermark=options.lowWatermark??2;this.retryDelay=options.retryDelay??60_000;
    this.uuid=options.uuid;this.now=options.now??Date.now;
  }
  private assertAccount(account:MusicAccount,session:Readonly<Record<string,unknown>>){
    if(this.accounts&&this.accounts.getSnapshot().find(item=>item.id===account.id)!==account)throw new AccountFmError('account_changed');
    if(session.accountId!==account.id||session.platform!==account.platform)throw new AccountFmError('account_changed');
  }
  private remaining(station:Station):number|undefined {
    const queue=this.playback.getSnapshot().queue,current=queue.currentId;
    if(!current||queue.entries.some(entry=>!station.entryIds.has(entry.id)))return undefined;
    const index=queue.entries.findIndex(entry=>entry.id===current);
    return index<0||!station.entryIds.has(current)?undefined:queue.entries.length-index-1;
  }
  stop(){
    const station=this.station;
    this.revision++;
    this.unsubscribe?.();this.unsubscribe=null;this.station=null;
    station?.signal.abort();
  }
  async start(account:MusicAccount,session:Readonly<Record<string,unknown>>,tracks?:readonly Track[],index=0,signal?:AbortSignal):Promise<readonly Track[]> {
    this.stop();
    const token=++this.revision;
    this.assertAccount(account,session);
    let batch=tracks;
    if(!batch){
      batch=await this.client.load(account,session,signal??new AbortController().signal,true);
      if(token!==this.revision)return[];
    }
    const list:Track[]=[];
    for(const track of batch){try{trackKey(track.origin);list.push(track);}catch{/* One bad station row must not block the batch. */}}
    if(!list.length)return[];
    const entries=list.map(track=>({id:this.uuid(),track}));
    const position=Number.isInteger(index)&&index>=0&&index<entries.length?index:0;
    const station:Station={account,session,signal:new AbortController(),entryIds:new Set(entries.map(entry=>entry.id)),keys:new Set(list.map(track=>trackKey(track.origin))),loading:false,exhausted:false,retryAt:0,appendedFor:null};
    this.station=station;
    this.unsubscribe=this.playback.subscribe(()=>this.evaluate(station));
    try{
      const pending=this.playback.play(makeQueue(entries,entries[position]!.id));
      if(pending&&typeof pending.then==='function')void pending.catch(()=>{if(this.station===station)this.stop();});
    }catch(error){
      if(this.station===station)this.stop();
      throw error;
    }
    this.evaluate(station);
    return list;
  }
  private evaluate(station:Station){
    if(station!==this.station)return;
    const remaining=this.remaining(station);
    if(!this.sameAccount(station)||remaining===undefined){this.stop();return;}
    if(remaining>=this.lowWatermark||station.exhausted||station.loading||station.appendedFor===this.playback.getSnapshot().queue.currentId||this.now()<station.retryAt)return;
    void this.prefetch(station);
  }
  private sameAccount(station:Station):boolean {
    try{this.assertAccount(station.account,station.session);return true;}catch{return false;}
  }
  private async prefetch(station:Station){
    station.loading=true;
    try{
      const batch=await this.client.load(station.account,station.session,station.signal.signal,true);
      if(station!==this.station)return;
      if(!this.sameAccount(station)||this.remaining(station)===undefined){this.stop();return;}
      const keys=new Set(station.keys),fresh:Track[]=[];
      for(const track of batch){
        let key:string;
        try{key=trackKey(track.origin);}catch{continue;}
        if(keys.has(key))continue;
        keys.add(key);fresh.push(track);
      }
      if(!fresh.length){station.exhausted=true;return;}
      const entries=fresh.map(track=>({id:this.uuid(),track}));
      for(const entry of entries)station.entryIds.add(entry.id);
      for(const track of fresh)station.keys.add(trackKey(track.origin));
      this.playback.setQueue(appendMany(this.playback.getSnapshot().queue,entries));
      station.appendedFor=this.playback.getSnapshot().queue.currentId;
    }catch(error){
      if(station!==this.station)return;
      if(error instanceof AccountFmError){
        if(error.kind==='cancelled')return;
        if(error.kind==='account_changed'||error.kind==='login_required'){this.stop();return;}
      }
      station.retryAt=this.now()+this.retryDelay;
    }finally{
      if(station===this.station)station.loading=false;
    }
  }
}
