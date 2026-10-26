import test from 'node:test';
import assert from 'node:assert/strict';
import {PlaybackStatsStore,cleanPlaybackStats,type PlaybackStatsState} from '../src/storage/playbackStats.ts';
import {aggregateStatisticsReplicas,mergeStatisticsReplicas} from '../src/domain/statisticsReplicas.ts';
import {encodeBackup,decodeBackup} from '../src/storage/backup.ts';
import {emptyLibrary} from '../src/storage/library.ts';
import type {Repository} from '../src/storage/repository.ts';
const track={origin:{kind:'local' as const,id:'a'.repeat(64)},title:'Public track',artist:'',metadata:{},qualities:[]};
function rig(seed:number,saved:unknown=undefined){let value=saved,fail=false,index=seed;const uuid=()=>`00000000-0000-4000-8000-${String(++index).padStart(12,'0')}`;
  const repository:Pick<Repository,'get'|'put'>={get:async<T>()=>value as T,put:async(_,next)=>{if(fail)throw Error('disk');value=structuredClone(next);}};
  const store=new PlaybackStatsStore(repository,()=>new Date(2026,9,26,14).getTime(),undefined,uuid);return {store,repository,uuid,saved:()=>value,setFail:(v:boolean)=>{fail=v;}};
}
test('distinct replicas add, duplicate downloads do not, and an active cumulative session only adds its next delta',async()=>{
  const a=rig(100),b=rig(200);await a.store.record({track,session:'a',listenedMs:1000});await b.store.record({track,session:'b',listenedMs:2000});
  const remote=await b.store.snapshotForSync();await a.store.merge(remote);await a.store.merge(remote);
  assert.equal(a.store.getSnapshot().items[0]!.playCount,2);assert.equal(a.store.getSnapshot().items[0]!.listenedMs,3000);
  await a.store.record({track,session:'a',listenedMs:1500});assert.equal(a.store.getSnapshot().items[0]!.playCount,2);assert.equal(a.store.getSnapshot().items[0]!.listenedMs,3500);
  await b.store.merge(await a.store.snapshotForSync());assert.equal(b.store.getSnapshot().items[0]!.listenedMs,3500);
  const combined=b.store.getSnapshot().items[0]!;assert.equal(combined.activity!.reduce((n,x)=>n+x.listenedMs,0),3500);
});
test('restoring local persistence keeps the active replica; backup restores do not adopt its private pointer',async()=>{
  const a=rig(100);await a.store.record({track,session:'a',listenedMs:1000});const snapshot=await a.store.snapshotForSync();
  const restarted=new PlaybackStatsStore(a.repository,()=>1e12,undefined,a.uuid);await restarted.restore();await restarted.record({track,session:'restart',listenedMs:500});assert.equal(restarted.getSnapshot().replicas!.length,1);
  const text=encodeBackup(emptyLibrary,new Date(0),snapshot);assert(!text.includes('localReplicaId'));
  const restored=rig(500,decodeBackup(text).statistics);await restored.store.restore();await restored.store.record({track,session:'other-device',listenedMs:300});
  assert.equal(restored.store.getSnapshot().replicas!.length,2);assert.equal(restored.store.getSnapshot().items[0]!.listenedMs,1300);
});
test('clear rotates identity so explicitly merging an older cloud snapshot can retain new post-clear listening',async()=>{
  const a=rig(100);await a.store.record({track,session:'a',listenedMs:1000});const cloud=await a.store.snapshotForSync(),oldId=cloud.replicas![0]!.id;
  await a.store.clear();await a.store.record({track,session:'a',listenedMs:1500});assert.notEqual(a.store.getSnapshot().replicas![0]!.id,oldId);
  await a.store.merge(cloud);assert.equal(a.store.getSnapshot().items[0]!.listenedMs,1500);assert.equal(a.store.getSnapshot().items[0]!.playCount,2);
  await a.store.merge(cloud);assert.equal(a.store.getSnapshot().items[0]!.listenedMs,1500);
});
test('legacy counters use conservative maxima and lose ambiguous distribution rather than doubling history',async()=>{
  const legacy=(ms:number,plays:number):PlaybackStatsState=>({version:1,items:[{track,listenedMs:ms,playCount:plays,firstPlayedAt:1,lastPlayedAt:2,activity:[{day:'2026-10-26',hour:1,listenedMs:ms,playCount:plays}]}]});
  const a=rig(100,legacy(5000,3)),b=rig(200,legacy(4000,4));await a.store.restore();await b.store.restore();await a.store.record({track,session:'new',listenedMs:1000});
  await a.store.merge(await b.store.snapshotForSync());const value=a.store.getSnapshot();assert.equal(value.items[0]!.listenedMs,6000);assert.equal(value.items[0]!.playCount,5);assert.equal(value.replicas!.find(x=>x.id==='legacy')!.legacyUncertain,true);
  assert.equal(value.items[0]!.activity!.reduce((n,x)=>n+x.listenedMs,0),1000);
});
test('replica merge counters are commutative/idempotent and a lower source revision cannot roll back its owner',async()=>{
  const a=rig(100),b=rig(200);await a.store.record({track,session:'a',listenedMs:1000});const old=await a.store.snapshotForSync();await a.store.record({track,session:'a',listenedMs:1800});await b.store.record({track,session:'b',listenedMs:300});
  const latest=await a.store.snapshotForSync(),other=await b.store.snapshotForSync();
  const ab=mergeStatisticsReplicas(latest.replicas!,other.replicas!),ba=mergeStatisticsReplicas(other.replicas!,latest.replicas!);assert.deepEqual(ab,ba);
  assert.deepEqual(mergeStatisticsReplicas(ab,ab),ab);assert.equal(aggregateStatisticsReplicas(mergeStatisticsReplicas(ab,old.replicas!))[0]!.listenedMs,2100);
});
test('failed writes preserve revision/watermark; malformed derived totals and flat-only remote data are rejected',async()=>{
  const a=rig(100);await a.store.record({track,session:'a',listenedMs:1000});const before=a.store.getSnapshot();a.setFail(true);await assert.rejects(a.store.record({track,session:'a',listenedMs:2000}));assert.deepEqual(a.store.getSnapshot(),before);
  a.setFail(false);await a.store.record({track,session:'a',listenedMs:2000});assert.equal(a.store.getSnapshot().replicas![0]!.revision,2);
  const bad=structuredClone(await a.store.snapshotForSync());(bad.items[0] as any).playCount=100;assert.throws(()=>cleanPlaybackStats(bad));
  assert.throws(()=>a.store.merge({version:1,items:[]}));const count=a.store.getSnapshot().items[0]!.playCount;await assert.rejects(a.store.merge(await a.store.snapshotForSync(),()=>false));assert.equal(a.store.getSnapshot().items[0]!.playCount,count);
});
