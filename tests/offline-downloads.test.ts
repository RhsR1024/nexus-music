import test from 'node:test';
import assert from 'node:assert/strict';
import {OfflineDownloadInUse,OfflineDownloadInterrupted,OfflineDownloadStore,type OfflineDownloadFiles} from '../src/storage/offlineDownloads.ts';
import type {Repository} from '../src/storage/repository.ts';
import type {Track} from '../src/domain/track.ts';

const track=(id='song'):Track=>({origin:{kind:'online',platform:'wy',id},title:'Song',artist:'Artist',metadata:{},qualities:[]});
function rig(saved:unknown=undefined){
  let value=saved;const files=new Map<string,{bytes:number;exists:boolean}>();let sequence=0;let fail=false;
  const adapter:OfflineDownloadFiles={
    async download(_url,name){if(fail)throw Error('network');files.set(name,{bytes:12,exists:true});return 12;},
    async remove(name){if(name)files.delete(name);},exists:name=>files.get(name)?.exists===true,size:name=>files.get(name)?.bytes??0,partialSize:()=>0,digest:name=>files.get(name)?.exists?'a'.repeat(32):undefined,uri:name=>`file:///offline/${name}`,
  };
  const repository:Pick<Repository,'get'|'put'>={get:async<T>()=>value as T|undefined,put:async(_,next)=>{value=structuredClone(next);}};
  const store=new OfflineDownloadStore(repository,{resolve:async()=>({url:'https://audio.example/song.mp3',quality:'320k'}),files:adapter,uuid:()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`,now:()=>1000+sequence});
  return{store,files:adapter,setFail:(value:boolean)=>{fail=value;},saved:()=>value};
}

test('offline downloads deduplicate by source identity and resolve only complete files',async()=>{
  const r=rig(),first=await r.store.enqueue(track()),second=await r.store.enqueue(track());assert.equal(first.id,second.id);assert.equal(first.status,'queued');
  await r.store.start(first.id);assert.equal(r.store.getSnapshot()[0]!.status,'completed');assert.deepEqual(await r.store.resolve(track()),{url:`file:///offline/${first.fileName}`,quality:'320k'});
  const saved=JSON.stringify(r.saved());assert(!saved.includes('https://audio.example'),'signed or remote URLs must not be persisted');
});

test('failed downloads keep a retryable record and never resolve a partial file',async()=>{
  const r=rig();r.setFail(true);const item=await r.store.enqueue(track('bad'));await r.store.start(item.id);assert.equal(r.store.getSnapshot()[0]!.status,'failed');assert.equal(await r.store.resolve(track('bad')),undefined);
  r.setFail(false);await r.store.retry(item.id);assert.equal(r.store.getSnapshot()[0]!.status,'completed');
});

test('restore downgrades missing completed files and interrupted work to queued',async()=>{
  const saved={version:1,items:[
    {id:'a',track:track('a'),fileName:'00000000.audio',status:'completed',bytes:10,updatedAt:1},
    {id:'b',track:track('b'),fileName:'00000001.audio',status:'downloading',bytes:0,updatedAt:1},
  ]};const r=rig(saved);await r.store.restore();assert.deepEqual(r.store.getSnapshot().map(item=>item.status),['failed','queued']);
});

test('offline quota rejects a completed file without deleting existing files',async()=>{
  const r=rig();const first=await r.store.enqueue(track('one'));await r.store.start(first.id);
  const limited=new OfflineDownloadStore({get:async()=>r.saved() as never,put:async()=>{}},{resolve:async()=>({url:'https://audio.example/two.mp3'}),files:r.files,uuid:()=>`00000000-0000-4000-8000-000000000099`,now:()=>2000,maxTotalBytes:()=>12});
  await limited.restore();const second=await limited.enqueue(track('two'));await limited.start(second.id);assert.equal(limited.getSnapshot()[1]!.status,'failed');assert.match(limited.getSnapshot()[1]!.error??'',/容量/);assert.equal(limited.getStatistics().files,1);
});

test('pause preserves partial bytes and resume requests the saved offset',async()=>{
  let mode:'pause'|'resume'='pause';let partial=0;let startedResolve:()=>void=()=>{};const started=new Promise<void>(resolve=>{startedResolve=resolve});const files:OfflineDownloadFiles={
    async download(_url,name,_headers,options){if(mode==='pause'){startedResolve();return new Promise((_,reject)=>options?.signal?.addEventListener('abort',()=>{partial=4;reject(new OfflineDownloadInterrupted(4));},{once:true}));}assert.equal(options?.offset,4);partial=12;return 12;},
    async remove(){partial=0;},exists:()=>partial>0,size:()=>0,partialSize:()=>partial,digest:()=>partial>0?'b'.repeat(32):undefined,uri:name=>`file:///offline/${name}`,
  };
  const repository:Pick<Repository,'get'|'put'>={get:async()=>undefined,put:async()=>{}};
  const store=new OfflineDownloadStore(repository,{resolve:async()=>({url:'https://audio.example/song.mp3'}),files,uuid:()=>`00000000-0000-4000-8000-000000000010`,now:()=>1});
  const item=await store.enqueue(track('pause'));const running=store.start(item.id);await started;await store.pause(item.id);await running;assert.equal(store.getSnapshot()[0]!.status,'paused');assert.equal(store.getSnapshot()[0]!.partialBytes,4);
  mode='resume';await store.resume(item.id);assert.equal(store.getSnapshot()[0]!.status,'completed');assert.equal(store.getSnapshot()[0]!.bytes,12);
});

test('queued pause can resume without starting a second task',async()=>{
  let calls=0;const files:OfflineDownloadFiles={
    async download(){calls+=1;return 8;},async remove(){},exists:()=>true,size:()=>8,partialSize:()=>0,digest:()=>'c'.repeat(32),uri:name=>`file:///offline/${name}`,
  };
  const store=new OfflineDownloadStore({get:async()=>undefined,put:async()=>{}},{resolve:async()=>({url:'https://audio.example/queued.mp3'}),files,uuid:()=>`00000000-0000-4000-8000-000000000020`,now:()=>1});
  const item=await store.enqueue(track('queued'));await store.pause(item.id);assert.equal(store.getSnapshot()[0]!.status,'paused');
  await store.resume(item.id);assert.equal(calls,1);assert.equal(store.getSnapshot()[0]!.status,'completed');
});

test('in-use completed files are protected from remove and bulk cleanup',async()=>{
  const r=rig(),first=await r.store.enqueue(track('playing')),second=await r.store.enqueue(track('other'));
  await r.store.start(first.id);await r.store.start(second.id);
  const guarded=new OfflineDownloadStore({get:async()=>r.saved() as never,put:async()=>{}},{resolve:async()=>({url:'https://audio.example/song.mp3'}),files:r.files,uuid:()=>`00000000-0000-4000-8000-000000000030`,now:()=>3,isInUse:item=>item.origin.id==='playing'});
  await guarded.restore();await assert.rejects(guarded.remove(first.id),OfflineDownloadInUse);
  await guarded.clearCompleted();assert.deepEqual(guarded.getSnapshot().map(item=>item.track.origin.id),['playing']);
});

test('restore rejects a changed completed file by digest before playback',async()=>{
  const saved={version:1,items:[{id:'digest',track:track('digest'),fileName:'00000000.audio',status:'completed',bytes:8,digest:'a'.repeat(32),updatedAt:1}]};
  const files:OfflineDownloadFiles={async download(){return 8;},async remove(){},exists:()=>true,size:()=>8,partialSize:()=>0,digest:()=>'b'.repeat(32),uri:name=>`file:///offline/${name}`};
  const store=new OfflineDownloadStore({get:async()=>saved as never,put:async()=>{}},{resolve:async()=>({url:'https://audio.example/digest.mp3'}),files,uuid:()=>`00000000-0000-4000-8000-000000000040`,now:()=>1});
  await store.restore();assert.equal(store.getSnapshot()[0]!.status,'failed');assert.match(store.getSnapshot()[0]!.error??'',/完整性/);assert.equal(await store.resolve(track('digest')),undefined);
});
