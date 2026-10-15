import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LyricService,decodeBase64Text} from '../src/lyrics/service.ts';
import {SourceRegistry} from '../src/providers/sourceRegistry.ts';
import type {Track} from '../src/domain/track.ts';
const track:Track={origin:{kind:'online',platform:'wy',id:'123'},title:'Synthetic',artist:'Fixture',metadata:{songId:'123'},qualities:[]};
test('lyrics try enabled capable sources in order and cache only successful results',async()=>{
  const registry=new SourceRegistry({initialize:async()=>[{platform:'wy',name:'Fixture',actions:['lyric'],qualities:[]}],destroy(){}});
  for(const id of ['a','b'])registry.register({id,name:id,script:'fixture'});
  await registry.setManyEnabled(['a','b'],true);
  const calls:string[]=[];
  const service=new LyricService(registry,{request:async(source,payload)=>{calls.push(source.id);assert.equal(payload.action,'lyric');assert.equal(payload.info.musicInfo.meta.songId,'123');if(source.id==='a')throw Error();return{lyric:'[00:01]Synthetic line'};}},async()=>'',async()=>{throw Error('unexpected HTTP');});
  const value=await service.load(track,new AbortController().signal);assert.equal(value.document.lines[0]?.text,'Synthetic line');
  await service.load(track,new AbortController().signal);assert.deepEqual(calls,['a','b']);
  await registry.setEnabled('b',false);
  await assert.rejects(service.load(track,new AbortController().signal));assert.deepEqual(calls,['a','b','a']);
});
test('disabled or replaced source cannot publish a late lyric response',async()=>{
  const registry=new SourceRegistry({initialize:async()=>[{platform:'wy',name:'fixture',actions:['lyric'],qualities:[]}],destroy(){}});
  registry.register({id:'a',name:'a',script:'fixture'});await registry.setEnabled('a',true);
  let finish!:(value:unknown)=>void;
  const service=new LyricService(registry,{request:()=>new Promise(resolve=>{finish=resolve;})},async()=>'',async()=>({lrc:{lyric:'[00:01]Fallback'}}));
  const pending=service.load(track,new AbortController().signal);await new Promise(resolve=>setTimeout(resolve,0));await registry.setEnabled('a',false);finish('[00:01]Stale');
  assert.equal((await pending).document.lines[0]?.text,'Fallback');
});
test('private lyrics stay scoped to account and cache clears on account change',async()=>{
  const registry=new SourceRegistry({initialize:async()=>[],destroy(){}});let calls=0;
  const service=new LyricService(registry,{request:async()=>''},async()=>{calls++;return{value:'Synthetic plain text'};});
  const privateTrack=(accountId:string):Track=>({...track,origin:{kind:'navidrome',accountId,id:'123'}});
  await service.load(privateTrack('a'),new AbortController().signal);await service.load(privateTrack('b'),new AbortController().signal);assert.equal(calls,2);
  service.clear();await service.load(privateTrack('a'),new AbortController().signal);assert.equal(calls,3);
});
test('base64 lyric decoding preserves UTF8 and rejects malformed payloads',()=>{
  assert.equal(decodeBase64Text(Buffer.from('合成😀').toString('base64')),'合成😀');
  assert.throws(()=>decodeBase64Text('%%%='));assert.throws(()=>decodeBase64Text('/w=='));
});
