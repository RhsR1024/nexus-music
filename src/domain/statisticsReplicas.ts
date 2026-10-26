import type {PlaybackStat,PlaybackStatsState} from '../storage/playbackStats.ts';
import {trackKey} from './track.ts';
import {boundActivity,maximumListeningBuckets} from './listeningActivity.ts';
export interface StatisticsReplica {id:string;revision:number;items:readonly PlaybackStat[];legacyUncertain?:boolean}
export const replicaID=(value:unknown):value is string=>typeof value==='string'&&/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
export function statisticsReplicas(state:PlaybackStatsState):readonly StatisticsReplica[]{return state.replicas??(state.items.length?[{id:'legacy',revision:0,items:state.items}]:[]);}
const signature=(replica:StatisticsReplica)=>JSON.stringify({...replica,items:[...replica.items].sort((a,b)=>trackKey(a.track.origin).localeCompare(trackKey(b.track.origin)))});
function mergeLegacy(a:StatisticsReplica,b:StatisticsReplica):StatisticsReplica{
  if(signature(a)===signature(b))return a;
  const rows=new Map(a.items.map(item=>[trackKey(item.track.origin),item]));
  for(const item of b.items){const key=trackKey(item.track.origin),old=rows.get(key);if(!old){rows.set(key,item);continue;}
    const winner=item.lastPlayedAt>old.lastPlayedAt||item.lastPlayedAt===old.lastPlayedAt&&JSON.stringify(item.track)>JSON.stringify(old.track)?item:old;
    rows.set(key,{track:winner.track,playCount:Math.max(item.playCount,old.playCount),listenedMs:Math.max(item.listenedMs,old.listenedMs),firstPlayedAt:Math.min(item.firstPlayedAt,old.firstPlayedAt),lastPlayedAt:Math.max(item.lastPlayedAt,old.lastPlayedAt)});
  }
  // Pre-identity snapshots cannot prove that two dated intervals are distinct.
  // Keep conservative cumulative maxima and never invent their distribution.
  return {id:'legacy',revision:0,legacyUncertain:true,items:[...rows.values()].sort((a,b)=>b.lastPlayedAt-a.lastPlayedAt||trackKey(a.track.origin).localeCompare(trackKey(b.track.origin))).slice(0,1000).map(({activity,...item})=>item)};
}
export function compactReplicas(replicas:readonly StatisticsReplica[]):readonly StatisticsReplica[]{
  const bounded=boundActivity(replicas.flatMap(replica=>replica.items));let offset=0;
  return [...replicas].map(replica=>{const items=bounded.slice(offset,offset+replica.items.length);offset+=replica.items.length;return {...replica,items};}).sort((a,b)=>a.id.localeCompare(b.id));
}
export function mergeStatisticsReplicas(a:readonly StatisticsReplica[],b:readonly StatisticsReplica[]):readonly StatisticsReplica[]{
  const values=new Map(a.map(replica=>[replica.id,replica]));
  for(const incoming of b){const current=values.get(incoming.id);if(!current)values.set(incoming.id,incoming);
    else if(incoming.id==='legacy')values.set(incoming.id,mergeLegacy(current,incoming));
    else if(incoming.revision>current.revision||incoming.revision===current.revision&&signature(incoming)>signature(current))values.set(incoming.id,incoming);
  }
  if(values.size>64)throw Error('统计副本超过保留上限，请先导出备份');
  return compactReplicas([...values.values()]);
}
export function aggregateStatisticsReplicas(replicas:readonly StatisticsReplica[]):readonly PlaybackStat[]{
  const values=new Map<string,PlaybackStat>();
  for(const replica of [...replicas].sort((a,b)=>a.id.localeCompare(b.id)))for(const item of replica.items){
    const key=trackKey(item.track.origin),previous=values.get(key);if(!previous){values.set(key,{...item,activity:item.activity??[]});continue;}
    const bins=new Map((previous.activity??[]).map(bucket=>[JSON.stringify([bucket.day,bucket.hour]),{...bucket}]));
    for(const bucket of item.activity??[]){const id=JSON.stringify([bucket.day,bucket.hour]),old=bins.get(id);bins.set(id,old?{...bucket,listenedMs:old.listenedMs+bucket.listenedMs,playCount:old.playCount+bucket.playCount}:{...bucket});}
    const track=item.lastPlayedAt>previous.lastPlayedAt||item.lastPlayedAt===previous.lastPlayedAt&&JSON.stringify(item.track)>JSON.stringify(previous.track)?item.track:previous.track;
    values.set(key,{track,playCount:previous.playCount+item.playCount,listenedMs:previous.listenedMs+item.listenedMs,firstPlayedAt:Math.min(previous.firstPlayedAt,item.firstPlayedAt),lastPlayedAt:Math.max(previous.lastPlayedAt,item.lastPlayedAt),activity:[...bins.values()]});
  }
  return boundActivity([...values.values()].sort((a,b)=>b.lastPlayedAt-a.lastPlayedAt||trackKey(a.track.origin).localeCompare(trackKey(b.track.origin))).slice(0,1000).map(item=>({...item,activity:[...(item.activity??[])].sort((a,b)=>b.day.localeCompare(a.day)||b.hour-a.hour).slice(0,maximumListeningBuckets)})));
}
