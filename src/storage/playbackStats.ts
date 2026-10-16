import {cleanTrack} from './cleanTrack.ts';
import {trackKey,validateTrack,type Track} from '../domain/track.ts';
import type {Repository} from './repository.ts';
import {InvalidRecordError} from './recovery.ts';
import {MutationQueue} from './mutations.ts';
export interface PlaybackStat {track:Track;playCount:number;listenedMs:number;firstPlayedAt:number;lastPlayedAt:number}
export interface PlaybackStatsState {version:1;items:readonly PlaybackStat[]}
export const emptyPlaybackStats:PlaybackStatsState={version:1,items:[]};
export function validatePlaybackStats(value:unknown):PlaybackStatsState {
  if(!value||typeof value!=='object'||(value as PlaybackStatsState).version!==1||!Array.isArray((value as PlaybackStatsState).items)||(value as PlaybackStatsState).items.length>1000)throw new Error('播放统计格式无效');
  const state=value as PlaybackStatsState,keys=new Set<string>();
  for(const item of state.items){
    validateTrack(item.track);const key=trackKey(item.track.origin);
    if(keys.has(key)||!Number.isSafeInteger(item.playCount)||item.playCount<1||!Number.isFinite(item.listenedMs)||item.listenedMs<0||!Number.isFinite(item.firstPlayedAt)||item.firstPlayedAt<0||!Number.isFinite(item.lastPlayedAt)||item.lastPlayedAt<item.firstPlayedAt)throw new Error('播放统计条目无效');keys.add(key);
  }
  return state;
}
export function cleanPlaybackStats(value:PlaybackStatsState):PlaybackStatsState {validatePlaybackStats(value);return{version:1,items:value.items.map(item=>({track:cleanTrack(item.track),playCount:item.playCount,listenedMs:item.listenedMs,firstPlayedAt:item.firstPlayedAt,lastPlayedAt:item.lastPlayedAt}))};}
export interface ListeningSample {session:string;listenedMs:number;track:Track}
export class PlaybackStatsStore {
  private value:PlaybackStatsState=emptyPlaybackStats;
  private listeners=new Set<()=>void>();private tail:Promise<unknown>=Promise.resolve();
  private sessions=new Map<string,{key:string;ms:number;counted:boolean}>();
  private repository:Pick<Repository,'get'|'put'>;private now:()=>number;
  private mutations:MutationQueue;
  constructor(repository:Pick<Repository,'get'|'put'>,now:()=>number=Date.now,mutations=new MutationQueue()){this.repository=repository;this.now=now;this.mutations=mutations;}
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  async restore(preserveSessions=false){const saved=await this.repository.get<unknown>('playbackStats.v1');if(!preserveSessions)this.sessions.clear();else for(const [id,state] of this.sessions)this.sessions.set(id,{...state,counted:false});if(saved){try{this.value=cleanPlaybackStats(validatePlaybackStats(saved));}catch{throw new InvalidRecordError();}}else this.value=emptyPlaybackStats;for(const listener of this.listeners)listener();}
  private change(run:(current:PlaybackStatsState)=>PlaybackStatsState,committed?:()=>void){
    const write=this.mutations.run(async()=>{const result=run(this.value);if(result===this.value)return;const next=cleanPlaybackStats(result);await this.repository.put('playbackStats.v1',next);this.value=next;committed?.();for(const listener of this.listeners)listener();});this.tail=write.catch(()=>{});return write;
  }
  record(sample:ListeningSample){
    validateTrack(sample.track);if(!sample.session||sample.session.length>128||!Number.isFinite(sample.listenedMs)||sample.listenedMs<=0)return Promise.resolve();
    sample={...sample,track:cleanTrack(sample.track)};
    // Read the cumulative native counter inside the serialized operation: retries and
    // out-of-order delivery cannot double-count, nor can a seek increase this counter.
    return this.change(current=>{
      const key=trackKey(sample.track.origin),previous=this.sessions.get(sample.session);
      if(previous&&previous.key!==key)throw new Error('播放统计会话身份改变');
      const before=previous?.ms??0;if(sample.listenedMs<=before)return current;
      const delta=sample.listenedMs-before,time=this.now(),counted=previous?.counted??false;
      const old=current.items.find(item=>trackKey(item.track.origin)===key);
      const item:PlaybackStat={track:cleanTrack(sample.track),playCount:(old?.playCount??0)+(counted?0:1),listenedMs:(old?.listenedMs??0)+delta,firstPlayedAt:old?.firstPlayedAt??time,lastPlayedAt:Math.max(old?.lastPlayedAt??0,time)};
      // Commit the session watermark only after persistence succeeds (see below).
      return{version:1,items:[item,...current.items.filter(value=>trackKey(value.track.origin)!==key)].slice(0,1000)};
    },()=>{const key=trackKey(sample.track.origin),previous=this.sessions.get(sample.session);if(!previous||sample.listenedMs>previous.ms)this.sessions.set(sample.session,{key,ms:sample.listenedMs,counted:true});while(this.sessions.size>128)this.sessions.delete(this.sessions.keys().next().value!);});
  }
  clear(){
    // Native playback reports a cumulative counter for each live session. Keep
    // its watermark when clearing persisted rows so the next event contributes
    // only time since the last committed sample. A live emission interval can
    // straddle the clear operation; this is not a sample-accurate reset.
    return this.change(()=>emptyPlaybackStats,()=>{
      for(const [session,state] of this.sessions) this.sessions.set(session,{...state,counted:false});
    });
  }
  replace(value:PlaybackStatsState){const clean=cleanPlaybackStats(value);return this.change(()=>clean,()=>this.sessions.clear());}
  settled(){return this.tail;}
}
