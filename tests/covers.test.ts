import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CoverService} from '../src/providers/covers.ts';
import {SourceRegistry} from '../src/providers/sourceRegistry.ts';
import type {Track} from '../src/domain/track.ts';
test('cover cache identities isolate private accounts and never use signed URLs as keys',async()=>{
  const keys:string[]=[];const registry=new SourceRegistry({initialize:async()=>[],destroy(){}});
  const service=new CoverService({fetchCover:async(key)=>{keys.push(key);return'file:///fixture.jpg';},clearCovers:async()=>{},coverStatistics:async()=>({bytes:0,files:0})},async identity=>identity,registry,{request:async()=>''},async(account,id)=>`https://server.invalid/cover?id=${id}&token=private`);
  await service.loadPrivate('account-a','123',new AbortController().signal);await service.loadPrivate('account-b','123',new AbortController().signal);
  assert.notEqual(keys[0],keys[1]);assert.ok(keys.every(key=>!key.includes('token')&&!key.includes('https')));
});
test('cancelled image results cannot become visible and optional LX pic respects enabled capabilities',async()=>{
  const registry=new SourceRegistry({initialize:async()=>[{platform:'wy',name:'fixture',actions:['pic'],qualities:[]}],destroy(){}});registry.register({id:'a',name:'a',script:'fixture',fingerprint:'digest'});await registry.setEnabled('a',true);
  const abort=new AbortController();let finish!:(value:string)=>void;
  const service=new CoverService({fetchCover:()=>new Promise(resolve=>{finish=resolve;}),clearCovers:async()=>{},coverStatistics:async()=>({bytes:0,files:0})},async x=>x,registry,{request:async(_,payload)=>{assert.equal(payload.action,'pic');return'https://images.invalid/fixture.jpg';}},async()=> '');
  const track:Track={origin:{kind:'online',platform:'wy',id:'1'},title:'Fixture',artist:'Fixture',metadata:{},qualities:[]};
  const pending=service.loadTrack(track,abort.signal);await new Promise(resolve=>setTimeout(resolve,0));abort.abort();finish('file:///fixture.jpg');await assert.rejects(pending,{name:'AbortError'});
});

test('legacy public cover CDNs use HTTPS while private and unknown endpoints keep their transport',async()=>{
  const requests:{key:string;url:string}[]=[];const registry=new SourceRegistry({initialize:async()=>[],destroy(){}});
  const service=new CoverService({fetchCover:async(key,url)=>{requests.push({key,url});return'file:///fixture.jpg';},clearCovers:async()=>{},coverStatistics:async()=>({bytes:0,files:0})},async value=>value,registry,{request:async()=>''},async()=> 'http://192.0.2.1/cover?id=fixture');
  const signal=new AbortController().signal;
  await service.loadURL('http://p1.music.126.net/fixture.jpg',signal);await service.loadURL('https://p1.music.126.net/fixture.jpg',signal);
  assert.equal(requests[0]!.url,'https://p1.music.126.net/fixture.jpg');assert.equal(requests[0]!.key,requests[1]!.key);
  await service.loadURL('http://192.0.2.1/fixture.jpg',signal);assert.equal(requests[2]!.url,'http://192.0.2.1/fixture.jpg');
  await service.loadURL('http://p1.music.126.net.evil.invalid/fixture.jpg',signal);assert.ok(requests[3]!.url.startsWith('http:'));
  await service.loadPrivate('fixture-account','fixture-cover',signal);assert.ok(requests[4]!.url.startsWith('http:'));
});

test('cover grid bounds native concurrency and cancelled queued work never starts',async()=>{
  let active=0,peak=0;const started:string[]=[],finish:(()=>void)[]=[];
  const registry=new SourceRegistry({initialize:async()=>[],destroy(){}});
  const service=new CoverService({fetchCover:async(_,url)=>{started.push(url);peak=Math.max(peak,++active);await new Promise<void>(resolve=>finish.push(resolve));active--;return'file:///fixture.jpg';},clearCovers:async()=>{},coverStatistics:async()=>({bytes:0,files:0})},async value=>value,registry,{request:async()=>''},async()=> '');
  const controllers=Array.from({length:7},()=>new AbortController());
  const jobs=controllers.map((controller,index)=>service.loadURL(`https://images.invalid/${index}.jpg`,controller.signal).then(()=>true,()=>false));
  await new Promise(resolve=>setTimeout(resolve,0));assert.equal(started.length,4);
  controllers[4]!.abort();finish.splice(0).forEach(resolve=>resolve());
  await new Promise(resolve=>setTimeout(resolve,0));assert.equal(started.length,6);assert.ok(!started.some(url=>url.endsWith('/4.jpg')));
  finish.splice(0).forEach(resolve=>resolve());assert.deepEqual(await Promise.all(jobs),[true,true,true,true,false,true,true]);assert.equal(peak,4);
});

test('clearing covers invalidates queued and active image results',async()=>{
  const finish:(()=>void)[]=[];let starts=0;const registry=new SourceRegistry({initialize:async()=>[],destroy(){}});
  const service=new CoverService({fetchCover:async()=>{starts++;await new Promise<void>(resolve=>finish.push(resolve));return'file:///fixture.jpg';},clearCovers:async()=>{},coverStatistics:async()=>({bytes:0,files:0})},async value=>value,registry,{request:async()=>''},async()=> '');
  const jobs=Array.from({length:6},(_,i)=>service.loadURL(`https://images.invalid/${i}.jpg`,new AbortController().signal,i%2?1024:512).then(()=>true,()=>false));
  await new Promise(resolve=>setTimeout(resolve,0));await service.clear();finish.forEach(resolve=>resolve());
  assert.deepEqual(await Promise.all(jobs),Array(6).fill(false));assert.equal(starts,4);
});

test('player and thumbnail variants bind request size and cache identity without signed credentials',async()=>{
  const calls:{key:string;url:string;size:number}[]=[];const sizes:number[]=[];
  const registry=new SourceRegistry({initialize:async()=>[],destroy(){}});
  const service=new CoverService({fetchCover:async(key,url,size)=>{calls.push({key,url,size});return'file:///fixture.jpg';},clearCovers:async()=>{},coverStatistics:async()=>({bytes:0,files:0})},async value=>value,registry,{request:async()=>''},async(_account,_id,_signal,size)=>{sizes.push(size);return`https://server.invalid/cover?size=${size}&token=private`;});
  const signal=new AbortController().signal;
  await service.loadPrivate('account','cover',signal);await service.loadPrivate('account','cover',signal,1024);await service.loadPrivate('account','cover',signal,1024);
  assert.deepEqual(sizes,[512,1024,1024]);assert.notEqual(calls[0]!.key,calls[1]!.key);assert.equal(calls[1]!.key,calls[2]!.key);
  assert.deepEqual(calls.map(x=>x.size),sizes);assert.ok(calls.every(x=>!x.key.includes('token')&&!x.key.includes('https')));
  assert.deepEqual(JSON.parse(calls[1]!.key),['cover-v2',1024,['navidrome','account','cover']]);
  await service.loadURL('https://images.invalid/cover',signal);await service.loadURL('https://images.invalid/cover',signal,1024);
  assert.notEqual(calls[3]!.key,calls[4]!.key);assert.equal(calls[3]!.url,calls[4]!.url);
});

test('LX resolution variants retain revision identity and local artwork keeps its extraction boundary',async()=>{
  const registry=new SourceRegistry({initialize:async()=>[{platform:'wy',name:'fixture',actions:['pic'],qualities:[]}],destroy(){}});registry.register({id:'a',name:'a',script:'fixture',fingerprint:'digest'});await registry.setEnabled('a',true);
  const calls:{key:string;size:number}[]=[];let localCalls=0;
  const service=new CoverService({fetchCover:async(key,_url,size)=>{calls.push({key,size});return'file:///fixture.jpg';},clearCovers:async()=>{},coverStatistics:async()=>({bytes:0,files:0})},async value=>value,registry,{request:async()=> 'https://images.invalid/cover'},async()=>'',async()=>{localCalls++;return'file:///local-original.jpg';});
  const track:Track={origin:{kind:'online',platform:'wy',id:'1'},title:'Fixture',artist:'Fixture',metadata:{},qualities:[]},signal=new AbortController().signal;
  await service.loadTrack(track,signal);await service.loadTrack(track,signal,1024);
  assert.deepEqual(JSON.parse(calls[1]!.key),['cover-v2',1024,['lx','digest','wy','1']]);assert.notEqual(calls[0]!.key,calls[1]!.key);
  assert.equal(await service.loadTrack({...track,origin:{kind:'local',id:'local'}},signal,1024),'file:///local-original.jpg');assert.equal(localCalls,1);assert.equal(calls.length,2);
});


test('failed large covers fall back after releasing slots; clear never refills them',async()=>{
  const registry=new SourceRegistry({initialize:async()=>[],destroy(){}}),requested:number[]=[];
  const service=new CoverService({fetchCover:async(_key,_url,size)=>{if(size===1024)throw Error('offline');return'file:///thumbnail.jpg';},clearCovers:async()=>{},coverStatistics:async()=>({bytes:0,files:0})},async value=>value,registry,{request:async()=>''},async(_a,_id,_s,size)=>{requested.push(size);return`https://server.invalid/cover?size=${size}`;});
  const jobs=Array.from({length:6},(_,i)=>service.loadPrivate('account',String(i),new AbortController().signal,1024));
  assert.deepEqual(await Promise.all(jobs),Array(6).fill('file:///thumbnail.jpg'));assert.equal(requested.filter(x=>x===512).length,6);
  const finish:(()=>void)[]=[];let starts=0;
  const delayed=new CoverService({fetchCover:async()=>{starts++;await new Promise<void>(resolve=>finish.push(resolve));throw Error('cleared');},clearCovers:async()=>{},coverStatistics:async()=>({bytes:0,files:0})},async value=>value,registry,{request:async()=>''},async()=> 'https://server.invalid/cover');
  const pending=delayed.loadURL('https://images.invalid/cover',new AbortController().signal,1024);const outcome=pending.then(()=>true,()=>false);
  await new Promise(resolve=>setTimeout(resolve,0));await delayed.clear();finish.forEach(resolve=>resolve());assert.equal(await outcome,false);assert.equal(starts,1);
});

test('missing artwork can use public metadata without requiring an LX pic action',async()=>{
  const registry=new SourceRegistry({initialize:async()=>[],destroy(){}});let metadataCalls=0;
  const service=new CoverService({fetchCover:async(_key,url)=>{assert.equal(url,'https://p1.music.126.net/public.jpg');return'file:///cover.jpg';},clearCovers:async()=>{},coverStatistics:async()=>({bytes:0,files:0})},async x=>x,registry,{request:async()=>{throw new Error('No LX picture action');}},async()=>'',undefined,async()=>{metadataCalls++;return'http://p1.music.126.net/public.jpg';});
  const track:Track={origin:{kind:'online',platform:'wy',id:'1'},title:'Public fixture',artist:'Fixture',metadata:{},qualities:[]};
  assert.equal(await service.loadTrack(track,new AbortController().signal),'file:///cover.jpg');assert.equal(metadataCalls,1);
});

test('clearing covers rejects late public metadata before it can fetch a stale image',async()=>{
  const registry=new SourceRegistry({initialize:async()=>[],destroy(){}});let complete!:(url:string)=>void,started!:()=>void;const ready=new Promise<void>(resolve=>{started=resolve;});let fetched=0;
  const service=new CoverService({fetchCover:async()=>{fetched++;return'file:///cover.jpg';},clearCovers:async()=>{},coverStatistics:async()=>({bytes:0,files:0})},async x=>x,registry,{request:async()=>''},async()=>'',undefined,async()=>{started();return new Promise<string>(resolve=>{complete=resolve;});});
  const track:Track={origin:{kind:'online',platform:'wy',id:'1'},title:'Public fixture',artist:'Fixture',metadata:{},qualities:[]};
  const result=service.loadTrack(track,new AbortController().signal);await ready;await service.clear();complete('https://images.invalid/stale.jpg');
  await assert.rejects(result,/过期/);assert.equal(fetched,0);
});
