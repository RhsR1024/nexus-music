import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LyricService,decodeBase64Text} from '../src/lyrics/service.ts';
import {SourceRegistry} from '../src/providers/sourceRegistry.ts';
import type {Track} from '../src/domain/track.ts';
import {normalizeLyrics} from '../src/lyrics/normalize.ts';
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
test('QRC XML extracts and unescapes actual word times and independent variants',async()=>{
  const registry=new SourceRegistry({initialize:async()=>[],destroy(){}});
  const tx:Track={...track,origin:{kind:'online',platform:'tx',id:'MID'},metadata:{id:'12345',songId:'MID'}};
  const service=new LyricService(registry,{request:async()=>''},async()=>'',async(url,request)=>{
    assert.match(url,/musicu/);assert.equal(JSON.parse(request.body!).req.param.songID,12345);
    return{code:0,req:{code:0,data:{lyric:'main-hex',trans:'broken',roma:'roman-hex'}}};
  },undefined,async hex=>{
    if(hex==='broken')throw Error('invalid');
    return hex==='main-hex'?'<QrcInfos><LyricInfo LyricContent="[1000,600]合(1000,100)成&amp;🎵(1100,500)&#10;"/></QrcInfos>':'[00:01]roman';
  });
  const value=await service.load(tx,new AbortController().signal),line=value.document.lines[0]!;
  assert.equal(line.text,'合成&🎵');assert.equal(line.words?.[1]?.startMs,1100);assert.equal(line.romanization,'roman');assert.equal(line.translation,undefined);
  assert.equal(normalizeLyrics('<LyricInfo LyricContent="[00:01]A &quot;quote&quot;"/>').document.lines[0]?.text,'A "quote"');
});
test('QRC failure falls back to line lyrics and cancellation cannot publish stale decode',async()=>{
  const registry=new SourceRegistry({initialize:async()=>[],destroy(){}});
  const tx:Track={...track,origin:{kind:'online',platform:'tx',id:'MID'},metadata:{id:'12345',songId:'MID'}};
  let calls=0;
  const service=new LyricService(registry,{request:async()=>''},async()=>'',async()=>++calls===1?{code:0,req:{code:0,data:{lyric:'bad'}}}:{lyric:'[00:01]Fallback'},undefined,async()=>{throw Error('invalid');});
  assert.equal((await service.load(tx,new AbortController().signal)).document.lines[0]?.text,'Fallback');assert.equal(calls,2);
  const controller=new AbortController();let started!:()=>void;const decoding=new Promise<void>(resolve=>{started=resolve;});
  const cancelled=new LyricService(registry,{request:async()=>''},async()=>'',async()=>({code:0,req:{code:0,data:{lyric:'valid'}}}),undefined,async()=>{started();await new Promise(resolve=>setTimeout(resolve,10));return '[00:01]Stale';});
  const pending=cancelled.load(tx,controller.signal);await decoding;controller.abort();await assert.rejects(pending);
});
test('clearing raw lyrics prevents an in-flight private response from repopulating cache',async()=>{
 const registry=new SourceRegistry({initialize:async()=>[],destroy(){}});let finish!:(value:unknown)=>void,calls=0;
 const service=new LyricService(registry,{request:async()=>''},async()=>{calls++;if(calls===1)return new Promise(resolve=>{finish=resolve;});return '[00:01]Fresh';});
 const privateTrack:Track={...track,origin:{kind:'navidrome',accountId:'fixture',id:'same'}};
 const pending=service.load(privateTrack,new AbortController().signal);service.clear();finish('[00:01]Old');await assert.rejects(pending);
 assert.equal((await service.load(privateTrack,new AbortController().signal)).document.lines[0]!.text,'Fresh');assert.equal(calls,2);
});
test('raw private lyric cache includes device recording signature as well as account identity',async()=>{
 const registry=new SourceRegistry({initialize:async()=>[],destroy(){}});let calls=0;
 const service=new LyricService(registry,{request:async()=>''},async()=>`[00:01]Revision ${++calls}`);
 const song:Track={...track,origin:{kind:'device',libraryId:'fixture',id:'1'},metadata:{deviceSignature:'a'.repeat(64)}};
 assert.equal((await service.load(song,new AbortController().signal)).document.lines[0]!.text,'Revision 1');
 assert.equal((await service.load({...song,metadata:{deviceSignature:'b'.repeat(64)}},new AbortController().signal)).document.lines[0]!.text,'Revision 2');assert.equal(calls,2);
});

test('a mixed-format LX response stays on its capable source and caches the usable fallback',async()=>{
  const registry=new SourceRegistry({initialize:async()=>[{platform:'wy',name:'Fixture',actions:['lyric'],qualities:[]}],destroy(){}});
  registry.register({id:'mixed',name:'Mixed fixture',script:'fixture'});await registry.setEnabled('mixed',true);let calls=0;
  const service=new LyricService(registry,{request:async()=>{calls++;return{ttml:'<tt>',lyric:' ',lrc:'[00:01]<0,500>A<500,500>B',tlyric:'',tlrc:'[00:01]Translated'};}},async()=>'',async()=>{throw Error('must not skip a valid source response');});
  const result=await service.load(track,new AbortController().signal);
  assert.equal(result.document.lines[0]!.text,'AB');assert.equal(result.document.lines[0]!.translation,'Translated');assert.equal(result.document.lines[0]!.words?.length,2);
  assert.equal(await service.load(track,new AbortController().signal),result);assert.equal(calls,1);
});
