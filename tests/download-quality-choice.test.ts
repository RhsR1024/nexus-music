import test from 'node:test';
import assert from 'node:assert/strict';
import {OfflineDownloadStore,type OfflineDownloadFiles} from '../src/storage/offlineDownloads.ts';
import {createDownloadQualityProbe} from '../src/app/downloadQualityProbe.ts';
import {createDownloadSubmission} from '../src/app/downloadSubmission.ts';
import type {Track} from '../src/domain/track.ts';
const track:Track={origin:{kind:'online',platform:'wy',id:'public-contract'},title:'Public contract',artist:'Domain',metadata:{},qualities:[]};
test('online quality detection cannot call a private client or local media route',async()=>{
 let calls=0;const probe=createDownloadQualityProbe({resolve:async()=>{calls++;return{url:'https://private.example/original'};}});
 await assert.rejects(probe({...track,origin:{kind:'navidrome',accountId:'owned-contract',id:'1'}},'320k',new AbortController().signal));assert.equal(calls,0);
});
test('a task captures its one-time quality before queuing and keeps it across restart and retry',async()=>{
 let saved:unknown,sequence=0,fail=true;const selected:unknown[]=[],files=new Map<string,number>();
 const repository={get:async<T>()=>saved as T|undefined,put:async(_key:string,value:unknown)=>{saved=structuredClone(value);}};
 const adapter:OfflineDownloadFiles={download:async(_url,name)=>{files.set(name,24);return 24;},remove:async name=>{files.delete(name);},exists:name=>files.has(name),size:name=>files.get(name)??0,partialSize:()=>0,digest:name=>files.has(name)?'a'.repeat(32):undefined,uri:name=>'file:///owned/'+name};
 const options={files:adapter,uuid:()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`,now:()=>sequence,resolve:async(_track:Track,_signal:AbortSignal,quality?:string)=>{selected.push(quality);if(fail)throw Error('Unavailable');return{url:'https://audio.example/public.mp3',quality:'128k',requestedQuality:quality};}};
 const first=new OfflineDownloadStore(repository,options),input={preferredQuality:'320k' as const};const item=await first.enqueue(track,input);assert.equal(item.preferredQuality,'320k');assert.equal(selected.length,0);
 const restarted=new OfflineDownloadStore(repository,options);await restarted.restore();await restarted.start(item.id);assert.equal(restarted.find(track)?.status,'failed');assert.equal(restarted.find(track)?.preferredQuality,'320k');
 fail=false;await restarted.retry(item.id);assert.deepEqual(selected,['320k','320k']);assert.equal(restarted.find(track)?.requestedQuality,'320k');assert.equal(restarted.find(track)?.quality,'128k');
 assert.equal((await restarted.enqueue(track,{preferredQuality:'flac'})).preferredQuality,'320k','An existing canonical task must not silently change policy');
 assert.equal(JSON.stringify(saved).includes('https://audio.example'),false);
});
test('submission forwards per-command quality without mutating the track or requiring playback state',async()=>{
 let options:unknown;const submit=createDownloadSubmission({enqueue:async(_t,choice)=>{options=choice;return{id:'owned',track,fileName:'aaaaaaaa.audio',status:'paused',bytes:0,updatedAt:1};},start:async()=>{throw Error('Paused intent must remain');}});
 const before=JSON.stringify(track);await submit([track],{preferredQuality:'flac'});assert.deepEqual(options,{preferredQuality:'flac'});assert.equal(JSON.stringify(track),before);
});
test('quality probing reports fallback metadata and excludes addresses, headers and playback routes',async()=>{
 let selected:unknown;const probe=createDownloadQualityProbe({resolve:async(_t,_s,_excluded,q)=>{selected=q;return{url:'https://audio.example/recording?secret=not-public',headers:{Authorization:'private'},quality:'128k',cacheKey:'not-a-playback-write'};}});
 const result=await probe(track,'320k',new AbortController().signal);assert.equal(selected,'320k');assert.deepEqual(result,{requestedQuality:'320k',reportedQuality:'128k'});assert.equal(JSON.stringify(result).includes('private'),false);assert.equal(JSON.stringify(result).includes('secret'),false);
});
test('a cancelled probe cannot publish a late route even if its transport ignores cancellation',async()=>{
 let release!:(value:{url:string})=>void;const controller=new AbortController(),probe=createDownloadQualityProbe({resolve:async()=>new Promise(resolve=>{release=resolve;})});
 const pending=probe(track,'128k',controller.signal);controller.abort();release({url:'https://audio.example/public.mp3'});await assert.rejects(pending);
});
test('probe failures and malformed or private local routes give a fixed safe diagnostic',async()=>{
 for(const url of ['file:///private/local.audio','not-a-url-with-secret']){
  const probe=createDownloadQualityProbe({resolve:async()=>({url})});await assert.rejects(probe(track,'128k',new AbortController().signal),error=>error instanceof Error&&error.message==='未检测到可用解析，请检查音源或更换档位后重试');
 }
 const probe=createDownloadQualityProbe({resolve:async()=>{throw Error('private credential');}});await assert.rejects(probe(track,'128k',new AbortController().signal),error=>error instanceof Error&&!error.message.includes('private'));
});
