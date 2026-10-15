import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DeviceMediaStore,type DeviceMediaNative,type DeviceMediaRow} from '../src/providers/deviceMedia.ts';
import {trackKey} from '../src/domain/track.ts';
import {cleanTrack} from '../src/storage/cleanTrack.ts';
const namespace='12345678-1234-1234-1234-123456789abc';
const row=(id:string):DeviceMediaRow=>({id,signature:'a'.repeat(64),title:'Synthetic media',artist:'Fixture artist',album:'Fixture album',durationMs:1000,reason:''});
function fixture(){
  const records=new Map<string,unknown>(),repository={get:async<T>(key:string)=>records.get(key) as T|undefined,put:async(key:string,value:unknown)=>{records.set(key,structuredClone(value));}};
  let status='authorized';const native:DeviceMediaNative={authorizationStatus:async()=>status,requestAuthorization:async()=>status,beginQuery:async()=>({token:'snapshot',total:1}),page:async()=>[row('18446744073709551615')],resolve:async()=> 'ipod-library://item/item.m4a?id=18446744073709551615',lyrics:async()=> '[00:00]Embedded fixture',artwork:async()=>null};
  return{records,repository,native,store:new DeviceMediaStore(repository,native,()=>namespace),setStatus:(value:string)=>{status=value;}};
}
test('device media keeps UInt64 IDs and device namespace, resolving URIs only on demand',async()=>{
  const f=fixture();await f.store.initialize();await f.store.search();const track=f.store.getSnapshot().tracks[0]!;
  assert.equal(track.origin.id,'18446744073709551615');assert.equal(trackKey(track.origin),JSON.stringify(['device',namespace,'18446744073709551615']));
  assert.equal((await f.store.resolve(track)).deviceMedia,true);assert.equal(await f.store.lyric(track),'[00:00]Embedded fixture');assert.equal(await f.store.cover(track),undefined);
  assert.equal(JSON.stringify([...f.records]).includes('ipod-library:'),false);assert.deepEqual(cleanTrack(track).origin,track.origin);
  const restored=new DeviceMediaStore(f.repository,f.native,()=>{throw new Error('must not regenerate namespace');});await restored.initialize();assert.match((await restored.resolve(track)).url,/ipod-library/);
});
test('device reference from another installation never resolves against a colliding numeric ID',async()=>{
  const f=fixture();await f.store.initialize();await f.store.search();const track=f.store.getSnapshot().tracks[0]!;
  await assert.rejects(f.store.resolve({...track,origin:{kind:'device',libraryId:'another-device',id:track.origin.id}}));
  f.setStatus('denied');await f.store.checkAuthorization();assert.equal(f.store.getSnapshot().tracks.length,0);await assert.rejects(f.store.resolve(track));
});
test('native permission denial and restricted access clear results without fabricating an empty authorized library',async()=>{
  const f=fixture();await f.store.initialize();await f.store.search();f.setStatus('restricted');await f.store.checkAuthorization(true);
  assert.equal(f.store.getSnapshot().authorization,'restricted');assert.equal(f.store.getSnapshot().tracks.length,0);
  f.setStatus('authorized');f.native.beginQuery=async()=>({token:'empty',total:0});f.native.page=async()=>[];await f.store.search();assert.equal(f.store.getSnapshot().authorization,'authorized');assert.equal(f.store.getSnapshot().total,0);
});
test('device pagination enforces snapshot completeness and rejects UInt64 overflow',async()=>{
  const f=fixture();await f.store.initialize();f.native.beginQuery=async()=>({token:'many',total:101});f.native.page=async(_,offset)=>offset===0?Array.from({length:100},(_,i)=>row(String(i+1))):[row('101')];
  await f.store.search();await f.store.loadMore();assert.equal(f.store.getSnapshot().tracks.length,101);
  f.native.beginQuery=async()=>({token:'bad',total:1});f.native.page=async()=>[row('18446744073709551616')];await f.store.search();assert.equal(f.store.getSnapshot().tracks.length,101);assert.equal(f.store.getSnapshot().stale,true);
});
test('late device query cannot overwrite newer selection, and revoked permission after resolution blocks playback',async()=>{
  const f=fixture();await f.store.initialize();let finish!:(value:{token:string;total:number})=>void;
  f.native.beginQuery=async text=>text==='old'?new Promise(resolve=>{finish=resolve;}):{token:'new',total:1};
  const old=f.store.search('old');await new Promise(resolve=>setImmediate(resolve));await f.store.search('new');finish({token:'old',total:0});await old;assert.equal(f.store.getSnapshot().tracks.length,1);
  const track=f.store.getSnapshot().tracks[0]!;f.native.resolve=async()=>{f.setStatus('denied');return 'ipod-library://item/test';};await assert.rejects(f.store.resolve(track));
});
test('device change invalidates pagination, and failed namespace writes never create exportable media URLs',async()=>{
  const f=fixture();await f.store.initialize();await f.store.search();f.store.invalidate();assert.equal(f.store.getSnapshot().stale,true);
  f.records.set('deviceMedia.namespace.v1','bad');await assert.rejects(new DeviceMediaStore(f.repository,f.native,()=>namespace).initialize());
  const cleaned=cleanTrack({...f.store.getSnapshot().tracks[0]!,metadata:{assetURL:'ipod-library://item/private',deviceSignature:'a'.repeat(64)}});assert.equal(cleaned.metadata.assetURL,undefined);
});

test('permission revoked during native page loading clears old browse results',async()=>{
  const f=fixture();await f.store.initialize();await f.store.search();
  f.native.page=async()=>{f.setStatus('denied');throw new Error('permission changed');};await f.store.search();
  assert.equal(f.store.getSnapshot().authorization,'denied');assert.equal(f.store.getSnapshot().tracks.length,0);
});
