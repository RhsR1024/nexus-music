import test from 'node:test';
import assert from 'node:assert/strict';
import {OfflineDownloadStore,type OfflineDownloadFiles} from '../src/storage/offlineDownloads.ts';
import type {Repository} from '../src/storage/repository.ts';
import type {Track} from '../src/domain/track.ts';

const track=(id='song'):Track=>({origin:{kind:'online',platform:'wy',id},title:'Song',artist:'Artist',metadata:{},qualities:[]});
function rig(saved:unknown=undefined){
  let value=saved;const files=new Map<string,{bytes:number;exists:boolean}>();let sequence=0;let fail=false;
  const adapter:OfflineDownloadFiles={
    async download(_url,name){if(fail)throw Error('network');files.set(name,{bytes:12,exists:true});return 12;},
    async remove(name){if(name)files.delete(name);},exists:name=>files.get(name)?.exists===true,size:name=>files.get(name)?.bytes??0,uri:name=>`file:///offline/${name}`,
  };
  const repository:Pick<Repository,'get'|'put'>={get:async<T>()=>value as T|undefined,put:async(_,next)=>{value=structuredClone(next);}};
  const store=new OfflineDownloadStore(repository,{resolve:async()=>({url:'https://audio.example/song.mp3',quality:'320k'}),files:adapter,uuid:()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`,now:()=>1000+sequence});
  return{store,files,setFail:(value:boolean)=>{fail=value;},saved:()=>value};
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
