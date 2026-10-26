import {historyTimestamp} from './historyPresentation.ts';

export interface ListeningBucket {day:string;hour:number;listenedMs:number;playCount:number}
export const maximumListeningBuckets=2048;
export const maximumTotalListeningBuckets=8192;
export function listeningPeriod(time:number){
  const {day}=historyTimestamp(time),hour=new Date(time).getHours();
  if(day==='日期未知'||!Number.isInteger(hour))throw Error('统计时间无效');
  return {day,hour};
}
export function validateActivity(value:unknown,totalMs:number,totalPlays:number):readonly ListeningBucket[]{
  if(!Array.isArray(value)||value.length>maximumListeningBuckets)throw Error('分时统计格式无效');
  const keys=new Set<string>();let ms=0,plays=0;
  for(const item of value){
    if(!item||typeof item.day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(item.day)||!Number.isInteger(item.hour)||item.hour<0||item.hour>23||!Number.isFinite(item.listenedMs)||item.listenedMs<0||!Number.isSafeInteger(item.playCount)||item.playCount<0||(item.listenedMs===0&&item.playCount===0))throw Error('分时统计条目无效');
    const date=new Date(item.day+'T00:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==item.day)throw Error('分时统计日期无效');
    const key=JSON.stringify([item.day,item.hour]);if(keys.has(key))throw Error('分时统计重复');keys.add(key);ms+=item.listenedMs;plays+=item.playCount;
  }
  if(ms>totalMs+1||plays>totalPlays)throw Error('分时统计超过累计值');
  return value.map(item=>({day:item.day,hour:item.hour,listenedMs:item.listenedMs,playCount:item.playCount}));
}
export function boundActivity<T extends {activity?:readonly ListeningBucket[]}>(items:readonly T[]):readonly T[]{
  const bins=items.flatMap((item,index)=>(item.activity??[]).map(bucket=>({index,bucket})));
  if(bins.length<=maximumTotalListeningBuckets)return items;
  bins.sort((a,b)=>b.bucket.day.localeCompare(a.bucket.day)||b.bucket.hour-a.bucket.hour||a.index-b.index);
  const kept=new Set(bins.slice(0,maximumTotalListeningBuckets).map(x=>JSON.stringify([x.index,x.bucket.day,x.bucket.hour])));
  return items.map((item,index)=>item.activity?{...item,activity:item.activity.filter(x=>kept.has(JSON.stringify([index,x.day,x.hour])))}:item);
}
export function addActivity(previous:readonly ListeningBucket[],time:number,ms:number,plays:number):readonly ListeningBucket[]{
  const period=listeningPeriod(time),old=previous.find(item=>item.day===period.day&&item.hour===period.hour);
  return [...previous.filter(item=>item!==old),{...period,listenedMs:(old?.listenedMs??0)+ms,playCount:(old?.playCount??0)+plays}]
    .sort((a,b)=>b.day.localeCompare(a.day)||b.hour-a.hour).slice(0,maximumListeningBuckets);
}
