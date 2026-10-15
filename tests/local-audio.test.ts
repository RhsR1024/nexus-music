import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LocalAudioStore,type ImportedAudio,type LocalAudioNative} from '../src/storage/localAudio.ts';
import {trackKey} from '../src/domain/track.ts';
import {cleanTrack} from '../src/storage/cleanTrack.ts';
function fixture() {
  const data=new Map<string,unknown>(),removed:string[]=[];let failure=false;
  const repository={get:async<T>(key:string)=>data.get(key) as T|undefined,put:async(key:string,value:unknown)=>{if(failure)throw new Error('disk full');data.set(key,structuredClone(value));}};
  const native:LocalAudioNative={beginRemoval:async id=>id,finishRemoval:async()=>{},reconcile:async()=>{},importAudio:async(uri,name)=>{if(uri==='bad')throw new Error('invalid audio');return{id:uri.repeat(64),extension:'wav',bytes:100,durationMs:1000,title:name,artist:'fixture',album:'album',lyric:'[00:00]fixture',created:true};},resolveAudio:async(id,ext)=>`file:///current-container/${id}.${ext}`,localArtwork:async id=>`file:///current-container/${id}.jpg`,removeAudio:async id=>{removed.push(id);}};
  return{store:new LocalAudioStore(repository,native),repository,native,data,removed,setFailure:()=>{failure=true;}};
}
test('local audio uses content identities, preserves equal names with different content and restores references',async()=>{
  const f=fixture();assert.deepEqual(await f.store.import([{uri:'a',name:'same.wav'},{uri:'b',name:'same.wav'}]),{added:2,duplicates:0});
  const first=f.store.getSnapshot()[0]!.track;assert.equal(trackKey(first.origin),'["local","files","'+'a'.repeat(64)+'"]');
  const restored=new LocalAudioStore(f.repository,f.native);await restored.restore();assert.equal(restored.getSnapshot().length,2);assert.match((await restored.resolve(first)).url,/current-container/);assert.equal(restored.lyric(first),'[00:00]fixture');
  assert.equal(JSON.stringify(f.data.get('localAudio.v1')).includes('file:///'),false);assert.deepEqual(cleanTrack(first).origin,first.origin);
});
test('local import rolls back all newly created files on native or database failure',async()=>{
  const f=fixture();await f.store.import([{uri:'a',name:'a.wav'}]);const old=f.store.getSnapshot();
  await assert.rejects(f.store.import([{uri:'b',name:'b.wav'},{uri:'bad',name:'bad.wav'}]));assert.equal(f.store.getSnapshot(),old);assert.deepEqual(f.removed,['b'.repeat(64)]);
  f.setFailure();await assert.rejects(f.store.import([{uri:'c',name:'c.wav'}]));assert.equal(f.store.getSnapshot(),old);assert.ok(f.removed.includes('c'.repeat(64)));
});
test('same content is deduplicated and imports serialize rather than overwrite each other',async()=>{
  const f=fixture();await Promise.all([f.store.import([{uri:'a',name:'one.wav'}]),f.store.import([{uri:'b',name:'two.wav'}])]);
  f.native.importAudio=async()=>({id:'a'.repeat(64),extension:'wav',bytes:100,durationMs:1000,title:'renamed',artist:'fixture',album:'',lyric:'',created:false});
  assert.deepEqual(await f.store.import([{uri:'a',name:'renamed.wav'}]),{added:0,duplicates:1});assert.equal(f.store.getSnapshot().length,2);assert.equal(f.store.getSnapshot()[0]!.track.title,'one.wav');assert.equal(f.removed.length,0);
});
test('invalid local records are rejected and no missing file silently matches an online song',async()=>{
  const f=fixture();await assert.rejects(f.store.import([]));await assert.rejects(f.store.import(Array(51).fill({uri:'a',name:'a.wav'})));
  await assert.rejects(f.store.resolve({origin:{kind:'local',id:'a'.repeat(64)},title:'A',artist:'B',metadata:{},qualities:[]}));
  f.data.set('localAudio.v1',{version:1,files:[{id:'../escape'}]});await assert.rejects(f.store.restore());
});

test('local deletion stages files before commit, rolls back failed writes and records pending cleanup',async()=>{
  const f=fixture();await f.store.import([{uri:'a',name:'a.wav'}]);const calls:boolean[]=[];f.native.finishRemoval=async(_,restore)=>{calls.push(restore);};
  f.setFailure();await assert.rejects(f.store.remove('a'.repeat(64)));assert.deepEqual(calls,[true]);assert.equal(f.store.getSnapshot().length,1);
  const g=fixture();await g.store.import([{uri:'a',name:'a.wav'}]);g.native.finishRemoval=async()=>{throw new Error('IO failure');};
  assert.deepEqual(await g.store.remove('a'.repeat(64)),{pendingCleanup:true});assert.equal(g.store.getSnapshot().length,0);
});

test('reimport keeps a recovered missing file that already has a catalog reference',async()=>{
  const f=fixture();await f.store.import([{uri:'a',name:'a.wav'}]);
  assert.deepEqual(await f.store.import([{uri:'a',name:'renamed.wav'}]),{added:0,duplicates:1});assert.equal(f.removed.length,0);
  await assert.rejects(f.store.import([{uri:'a',name:'restored.wav'},{uri:'bad',name:'bad.wav'}]));
  assert.equal(f.removed.length,0);assert.equal(f.store.getSnapshot().length,1);
});

test('local backup metadata never exports absolute sandbox file URIs',()=>{
  const clean=cleanTrack({origin:{kind:'local',id:'a'.repeat(64)},title:'fixture',artist:'fixture',metadata:{localFormat:'mp3',fileUri:'file:///old-container/Documents/audio.mp3',nested:{path:'file:///old-container/cover.jpg'}},qualities:[]});
  assert.equal(JSON.stringify(clean).includes('file:///'),false);assert.equal(clean.metadata.localFormat,'mp3');
});
