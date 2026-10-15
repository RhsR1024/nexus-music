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
