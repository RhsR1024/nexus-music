import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localSortFields,viewLocalAudio} from '../src/domain/localAudioSort.ts';
import {PreferenceStore} from '../src/app/preferences.ts';
import type {Repository} from '../src/storage/repository.ts';
import type {Track} from '../src/domain/track.ts';
const file=(id:string,title:string,artist:string,album:string,durationMs:number,addedAt?:number,modifiedAt?:number)=>({id,addedAt,modifiedAt,track:{origin:{kind:'local',id},title,artist,album,durationMs,metadata:{},qualities:[]} as Track});
// Six distinct permutations ensure no field can accidentally reuse another key.
const rows=[file('b','Beta','A artist','Z album',2000,300,1000),file('a','Alpha','Z artist','A album',3000,200,2000),file('c','Gamma','M artist','M album',1000,100,3000)];
const ascending={title:['a','b','c'],duration:['c','b','a'],modifiedAt:['b','a','c'],addedAt:['c','a','b'],artist:['b','c','a'],album:['a','c','b']};
test('all six local sort fields support both directions without changing the source list',()=>{
  for(const field of localSortFields){
    assert.deepEqual(viewLocalAudio(rows,'',field,'asc').map(f=>f.id),ascending[field],field);
    assert.deepEqual(viewLocalAudio(rows,'',field,'desc').map(f=>f.id),[...ascending[field]].reverse(),field);
  }
  assert.deepEqual(rows.map(f=>f.id),['b','a','c']);
});
test('direction reverses title tie breaks; missing historical times remain last',()=>{
  const tied=[file('b','Beta','same','',1000,100,1000),file('a','Alpha','same','',1000,100,1000),file('u','A unknown','same','',1000)];
  for(const field of ['modifiedAt'] as const){
    assert.deepEqual(viewLocalAudio(tied,'',field,'asc').map(f=>f.id),['a','b','u']);
    assert.deepEqual(viewLocalAudio(tied,'',field,'desc').map(f=>f.id),['b','a','u']);
  }
  assert.deepEqual(viewLocalAudio(tied,'','addedAt','asc').map(f=>f.id),['b','a','u']);
  assert.deepEqual(viewLocalAudio(tied,'','addedAt','desc').map(f=>f.id),['a','b','u']);
  for(const field of ['artist','album','duration'] as const)assert.deepEqual(viewLocalAudio(tied.slice(0,2),'',field,'desc').map(f=>f.id),['b','a']);
});
test('local filtering retains matching missing tags and sorts the filtered rows',()=>{
  const input=[...rows,file('u','Ｓｏｎｇ 2','未知艺术家','',1000)];
  assert.deepEqual(viewLocalAudio(input,'song 2','title','asc').map(f=>f.id),['u']);
  assert.deepEqual(viewLocalAudio(input,'Alpha artist','title','desc').map(f=>f.id),['a']);
});
test('sort preferences migrate, persist across restarts and reject failed writes atomically',async()=>{
  const data=new Map<string,unknown>();let fail=false;
  const repository={get:async(key:string)=>data.get(key),put:async(key:string,value:unknown)=>{if(fail)throw Error('disk full');data.set(key,structuredClone(value));}} as unknown as Repository;
  data.set('preferences.v1',{theme:'dark'});
  const store=new PreferenceStore(repository);await store.restore();assert.equal(store.getSnapshot().localAudioSortField,'title');
  await store.update({localAudioSortField:'addedAt',localAudioSortDirection:'desc'});
  const restored=new PreferenceStore(repository);await restored.restore();assert.equal(restored.getSnapshot().localAudioSortField,'addedAt');assert.equal(restored.getSnapshot().localAudioSortDirection,'desc');
  const before=restored.getSnapshot();fail=true;await assert.rejects(restored.update({localAudioSortField:'duration'}));assert.equal(restored.getSnapshot(),before);
  fail=false;await assert.rejects(restored.update({localAudioSortField:'invalid' as never}));assert.equal(restored.getSnapshot(),before);
});
