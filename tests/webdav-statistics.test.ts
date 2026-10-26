import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {WebDAVStatistics,decodeStatisticsFile,encodeStatisticsFile} from '../src/storage/webdavStatistics.ts';
import {PlaybackStatsStore} from '../src/storage/playbackStats.ts';
import {WebDAVError,type WebDAVAccount} from '../src/providers/webdav.ts';
import type {Repository} from '../src/storage/repository.ts';
const track={origin:{kind:'local' as const,id:'a'.repeat(64)},title:'Public track',artist:'',metadata:{},qualities:[]};
function rig(){
  const records=new Map<string,unknown>(),repository:Pick<Repository,'get'|'put'>={get:async<T>(key:string)=>records.get(key) as T,put:async(key,value)=>{records.set(key,structuredClone(value));}};
  const statistics=new PlaybackStatsStore(repository,()=>1000);let accounts:readonly WebDAVAccount[]=[{id:'a'.repeat(64),url:'https://dav.example/',label:'Public',username:'public'}];const listeners=new Set<()=>void>();let remote:string|undefined,etag='',hold:(()=>Promise<void>)|undefined,missingDirectory=true,corruptRead=false;
  const calls:{operation:string;etag:string;body:string}[]=[];
  const transport={async backup(_root:string,_path:string,_credentials:unknown,operation:'GET'|'PUT'|'MKCOL',body:string,condition:string,_signal:AbortSignal){calls.push({operation,etag:condition,body});if(hold)await hold();
    if(operation==='MKCOL'){missingDirectory=false;return {status:201,body:'',etag:'',bytes:0};}
    if(operation==='PUT'){if((remote===undefined&&condition)||(remote!==undefined&&condition!==etag))return {status:412,body:'',etag,bytes:0};remote=body;etag='"'+createHash('sha256').update(body).digest('hex')+'"';return {status:201,body:'',etag,bytes:0};}
    return {status:remote===undefined?404:condition&&condition!==etag?412:200,body:corruptRead?'{}':remote??'',etag,bytes:remote?.length??0};
  }};
  const store=new WebDAVStatistics({repository,statistics,accounts:{getSnapshot:()=>accounts,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},credentials:async()=>({username:'public',password:'non-private-test'}),client:async()=>({stat:async()=>{if(missingDirectory)throw new WebDAVError('missing');return {directory:true,path:'stats/',name:'stats'};}})},transport,hash:async text=>createHash('sha256').update(text).digest('hex'),now:()=>new Date(1000)});
  return {store,statistics,calls,records,remote:()=>remote,setRemote:(value:string,tag='"other"')=>{remote=value;etag=tag;},hold:(value:typeof hold)=>{hold=value;},corruptRead:()=>{corruptRead=true;},removeAccount:()=>{accounts=[];listeners.forEach(listener=>listener());}};
}
test('upload requires a frozen preview, creates directories, conditionally writes and verifies readback',async()=>{
  const r=rig();await r.statistics.record({track,session:'a',listenedMs:1000});await r.store.configure('a'.repeat(64),'stats/');await assert.rejects(r.store.uploadPrepared());
  await r.store.prepareUpload();assert.equal(r.calls.filter(x=>x.operation==='PUT').length,0);assert.equal(r.store.getSnapshot().preview!.local.playCount,1);
  await r.statistics.record({track,session:'a',listenedMs:1800});await r.store.uploadPrepared();assert.equal(decodeStatisticsFile(r.remote()!).statistics.items[0]!.listenedMs,1000,'confirmation uploads its frozen snapshot');
  assert.equal(r.calls.find(x=>x.operation==='PUT')!.etag,'');assert(r.store.getSnapshot().message.includes('回读验证'));assert(r.calls.some(x=>x.operation==='MKCOL'));
});
test('remote revision races and weak ETags cannot silently overwrite statistics',async()=>{
  const r=rig();await r.store.configure('a'.repeat(64),'stats/');await r.statistics.record({track,session:'a',listenedMs:1000});const body=encodeStatisticsFile(await r.statistics.snapshotForSync(),1,new Date(0));r.setRemote(body,'W/"weak"');await assert.rejects(r.store.prepareUpload(),/强版本/);
  r.setRemote(body);await r.store.prepareUpload();r.setRemote(body,'"concurrent"');await assert.rejects(r.store.uploadPrepared(),/已变化/);assert.equal(r.remote(),body);
});
test('download merge is idempotent, never changes the library, and empty cloud data keeps local statistics',async()=>{
  const r=rig();await r.store.configure('a'.repeat(64),'stats/');await r.store.downloadAndMerge();assert(r.store.getSnapshot().message.includes('本机数据保留'));
  await r.statistics.record({track,session:'a',listenedMs:1000});await r.store.prepareUpload();await r.store.uploadPrepared();await r.statistics.clear();await r.store.downloadAndMerge();await r.store.downloadAndMerge();assert.equal(r.statistics.getSnapshot().items[0]!.playCount,1);assert.equal(r.statistics.getSnapshot().items[0]!.listenedMs,1000);assert(!r.records.has('library.v1'));
});
test('cancelled requests and account replacement cannot publish a late result or merge it',async()=>{
  const r=rig();await r.store.configure('a'.repeat(64),'stats/');await r.statistics.record({track,session:'a',listenedMs:1000});const cloud=encodeStatisticsFile(await r.statistics.snapshotForSync(),1,new Date(0));r.setRemote(cloud);
  let release!:()=>void;r.hold(()=>new Promise<void>(resolve=>{release=resolve;}));const job=r.store.refresh();while(!release)await new Promise(resolve=>setImmediate(resolve));r.store.cancel();release();await assert.rejects(job);assert.equal(r.store.getSnapshot().cloud,undefined);
  r.hold(undefined);r.removeAccount();await assert.rejects(r.store.downloadAndMerge());assert.equal(r.statistics.getSnapshot().items[0]!.playCount,1);
});
test('invalid payloads, wrong derived counters, unrelated backups and failed readback are rejected',async()=>{
  assert.throws(()=>decodeStatisticsFile('{"format":"nexus-music","version":1}'));
  const r=rig();await r.store.configure('a'.repeat(64),'stats/');await r.statistics.record({track,session:'a',listenedMs:1000});const body=encodeStatisticsFile(await r.statistics.snapshotForSync(),1,new Date(0)),bad=JSON.parse(body);bad.statistics.items[0].playCount=7;assert.throws(()=>decodeStatisticsFile(JSON.stringify(bad)));
  await r.store.prepareUpload();r.corruptRead();await assert.rejects(r.store.uploadPrepared(),/回读/);assert(!r.store.getSnapshot().message.includes('已上传'));
});

test('cancelling a prepared upload clears confirmation and explicitly reports no cloud write',async()=>{
  const r=rig();await r.statistics.record({track,session:'a',listenedMs:1000});await r.store.configure('a'.repeat(64),'stats/');await r.store.prepareUpload();r.store.cancel();assert.equal(r.store.getSnapshot().preview,undefined);assert.match(r.store.getSnapshot().message,/预览已取消，云端未写入/);assert.equal(r.remote(),undefined);await assert.rejects(r.store.uploadPrepared());
});
