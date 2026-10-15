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
  const jobs=Array.from({length:6},(_,i)=>service.loadURL(`https://images.invalid/${i}.jpg`,new AbortController().signal).then(()=>true,()=>false));
  await new Promise(resolve=>setTimeout(resolve,0));await service.clear();finish.forEach(resolve=>resolve());
  assert.deepEqual(await Promise.all(jobs),Array(6).fill(false));assert.equal(starts,4);
});
