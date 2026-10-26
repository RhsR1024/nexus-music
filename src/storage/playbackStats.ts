import {cleanTrack} from './cleanTrack.ts';
import {trackKey,validateTrack,type Track} from '../domain/track.ts';
import type {Repository} from './repository.ts';
import {InvalidRecordError} from './recovery.ts';
import {MutationQueue} from './mutations.ts';
import {addActivity,boundActivity,maximumTotalListeningBuckets,validateActivity,type ListeningBucket} from '../domain/listeningActivity.ts';
import {aggregateStatisticsReplicas,compactReplicas,mergeStatisticsReplicas,replicaID,statisticsReplicas,type StatisticsReplica} from '../domain/statisticsReplicas.ts';
export interface PlaybackStat {track:Track;playCount:number;listenedMs:number;firstPlayedAt:number;lastPlayedAt:number;activity?:readonly ListeningBucket[]}
export interface PlaybackStatsState {version:1;items:readonly PlaybackStat[];replicas?:readonly StatisticsReplica[]}
export const emptyPlaybackStats:PlaybackStatsState={version:1,items:[]};
function validateItems(items:readonly PlaybackStat[]){
  if(!Array.isArray(items)||items.length>1000)throw new Error('播放统计格式无效');
  const keys=new Set<string>();let buckets=0;
  for(const item of items){
    validateTrack(item.track);const key=trackKey(item.track.origin);
    if(keys.has(key)||!Number.isSafeInteger(item.playCount)||item.playCount<1||!Number.isFinite(item.listenedMs)||item.listenedMs<0||!Number.isFinite(item.firstPlayedAt)||item.firstPlayedAt<0||!Number.isFinite(item.lastPlayedAt)||item.lastPlayedAt<item.firstPlayedAt)throw new Error('播放统计条目无效');keys.add(key);
    if(item.listenedMs>Number.MAX_SAFE_INTEGER)throw Error('播放统计时长超出可用范围');
    if(item.activity!==undefined){validateActivity(item.activity,item.listenedMs,item.playCount);buckets+=item.activity.length;}
  }
  if(buckets>maximumTotalListeningBuckets)throw Error('分时统计超过保留上限');
}
const cleanItems=(items:readonly PlaybackStat[])=>items.map(item=>({track:cleanTrack(item.track),playCount:item.playCount,listenedMs:item.listenedMs,firstPlayedAt:item.firstPlayedAt,lastPlayedAt:item.lastPlayedAt,...(item.activity?{activity:validateActivity(item.activity,item.listenedMs,item.playCount)}:{})}));
export function validatePlaybackStats(value:unknown):PlaybackStatsState {
  if(!value||typeof value!=='object'||(value as PlaybackStatsState).version!==1)throw Error('播放统计格式无效');const state=value as PlaybackStatsState;validateItems(state.items);
  if(state.replicas!==undefined){
    if(!Array.isArray(state.replicas)||state.replicas.length>64)throw Error('统计副本格式无效');const ids=new Set<string>();let buckets=0;
    for(const replica of state.replicas){
      if(!replica||ids.has(replica.id)||!(replica.id==='legacy'?replica.revision===0&&(replica.legacyUncertain===undefined||replica.legacyUncertain===true):replicaID(replica.id)&&Number.isSafeInteger(replica.revision)&&replica.revision>=1&&replica.legacyUncertain===undefined))throw Error('统计副本身份无效');
      ids.add(replica.id);validateItems(replica.items);for(const item of replica.items){buckets+=item.activity?.length??0;if(replica.legacyUncertain&&item.activity?.length)throw Error('旧统计分时无法确认');}
    }
    if(buckets>maximumTotalListeningBuckets)throw Error('统计副本明细超过上限');
    const aggregate=aggregateStatisticsReplicas(state.replicas);validateItems(aggregate);if(aggregate.length!==state.items.length)throw Error('统计副本累计不一致');
    const items=new Map(state.items.map(item=>[trackKey(item.track.origin),item]));
    for(const expected of aggregate){const actual=items.get(trackKey(expected.track.origin));if(!actual||actual.playCount!==expected.playCount||Math.abs(actual.listenedMs-expected.listenedMs)>1||actual.firstPlayedAt!==expected.firstPlayedAt||actual.lastPlayedAt!==expected.lastPlayedAt)throw Error('统计副本累计不一致');}
  }
  return state;
}
export function cleanPlaybackStats(value:PlaybackStatsState):PlaybackStatsState {
  validatePlaybackStats(value);const replicas=value.replicas?.map(replica=>({id:replica.id,revision:replica.revision,items:cleanItems(replica.items),...(replica.legacyUncertain?{legacyUncertain:true}:{})}));
  return {version:1,items:replicas?aggregateStatisticsReplicas(replicas):cleanItems(value.items),...(replicas?{replicas}:{})};
}
export interface ListeningSample {session:string;listenedMs:number;track:Track}
export class PlaybackStatsStore {
  private value:PlaybackStatsState=emptyPlaybackStats;
  private listeners=new Set<()=>void>();private tail:Promise<unknown>=Promise.resolve();
  private sessions=new Map<string,{key:string;ms:number;counted:boolean}>();
  private repository:Pick<Repository,'get'|'put'>;private now:()=>number;
  private mutations:MutationQueue;
  private replica:string;private uuid:()=>string;
  constructor(repository:Pick<Repository,'get'|'put'>,now:()=>number=Date.now,mutations=new MutationQueue(),uuid:()=>string=()=>globalThis.crypto.randomUUID()){this.repository=repository;this.now=now;this.mutations=mutations;this.uuid=uuid;this.replica=uuid();if(!replicaID(this.replica))throw Error('统计本机身份无效');}
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  async restore(preserveSessions=false){const saved=await this.repository.get<unknown>('playbackStats.v1');if(!preserveSessions)this.sessions.clear();else for(const [id,state] of this.sessions)this.sessions.set(id,{...state,counted:false});if(saved){try{this.value=cleanPlaybackStats(validatePlaybackStats(saved));this.replica=replicaID((saved as {localReplicaId?:unknown}).localReplicaId)?(saved as {localReplicaId:string}).localReplicaId:this.uuid();}catch{throw new InvalidRecordError();}}else this.value=emptyPlaybackStats;for(const listener of this.listeners)listener();}
  private change(run:(current:PlaybackStatsState,identity:string)=>PlaybackStatsState,committed?:()=>void,rotate=false){
    const write=this.mutations.run(async()=>{const identity=rotate?this.uuid():this.replica;if(!replicaID(identity))throw Error('统计本机身份无效');const result=run(this.value,identity);if(result===this.value)return;const next=cleanPlaybackStats(result);await this.repository.put('playbackStats.v1',{...next,localReplicaId:identity});this.value=next;this.replica=identity;committed?.();for(const listener of this.listeners)listener();});this.tail=write.catch(()=>{});return write;
  }
  record(sample:ListeningSample){
    validateTrack(sample.track);if(!sample.session||sample.session.length>128||!Number.isFinite(sample.listenedMs)||sample.listenedMs<=0)return Promise.resolve();
    sample={...sample,track:cleanTrack(sample.track)};
    // Read the cumulative native counter inside the serialized operation: retries and
    // out-of-order delivery cannot double-count, nor can a seek increase this counter.
    return this.change((current,identity)=>{
      const key=trackKey(sample.track.origin),previous=this.sessions.get(sample.session);
      if(previous&&previous.key!==key)throw new Error('播放统计会话身份改变');
      const before=previous?.ms??0;if(sample.listenedMs<=before)return current;
      const delta=sample.listenedMs-before,time=this.now(),counted=previous?.counted??false;
      const replicas=statisticsReplicas(current),own=replicas.find(replica=>replica.id===identity),old=own?.items.find(item=>trackKey(item.track.origin)===key);
      const item:PlaybackStat={track:cleanTrack(sample.track),playCount:(old?.playCount??0)+(counted?0:1),listenedMs:(old?.listenedMs??0)+delta,firstPlayedAt:old?.firstPlayedAt??time,lastPlayedAt:Math.max(old?.lastPlayedAt??0,time),activity:addActivity(old?.activity??[],time,delta,counted?0:1)};
      // Commit the session watermark only after persistence succeeds (see below).
      const items=boundActivity([item,...(own?.items??[]).filter(value=>trackKey(value.track.origin)!==key)].slice(0,1000));
      const next=compactReplicas([...replicas.filter(replica=>replica.id!==identity),{id:identity,revision:(own?.revision??0)+1,items}]);
      return{version:1,items:aggregateStatisticsReplicas(next),replicas:next};
    },()=>{const key=trackKey(sample.track.origin),previous=this.sessions.get(sample.session);if(!previous||sample.listenedMs>previous.ms)this.sessions.set(sample.session,{key,ms:sample.listenedMs,counted:true});while(this.sessions.size>128)this.sessions.delete(this.sessions.keys().next().value!);});
  }
  clear(){
    // Native playback reports a cumulative counter for each live session. Keep
    // its watermark when clearing persisted rows so the next event contributes
    // only time since the last committed sample. A live emission interval can
    // straddle the clear operation; this is not a sample-accurate reset.
    return this.change(()=>emptyPlaybackStats,()=>{
      for(const [session,state] of this.sessions) this.sessions.set(session,{...state,counted:false});
    },true);
  }
  replace(value:PlaybackStatsState){const clean=cleanPlaybackStats(value);return this.change(()=>clean,()=>this.sessions.clear(),true);}
  async snapshotForSync(){await this.change(current=>current.replicas?current:{version:1,items:aggregateStatisticsReplicas(statisticsReplicas(current)),replicas:statisticsReplicas(current)});return cleanPlaybackStats(this.value);}
  merge(value:PlaybackStatsState,canCommit:()=>boolean=()=>true){const remote=cleanPlaybackStats(value);if(!remote.replicas)throw Error('远端统计缺少副本身份');return this.change(current=>{if(!canCommit())throw Error('统计连接已变化');const replicas=mergeStatisticsReplicas(statisticsReplicas(current),remote.replicas!);return {version:1,items:aggregateStatisticsReplicas(replicas),replicas};});}
  settled(){return this.tail;}
}
