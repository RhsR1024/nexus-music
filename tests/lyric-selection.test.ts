import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LyricSelection,lyricRank} from '../src/lyrics/selection.ts';
import {normalizeLyrics} from '../src/lyrics/normalize.ts';
import {LibraryStore,validateLibrary} from '../src/storage/library.ts';
import {encodeBackup,decodeBackup} from '../src/storage/backup.ts';
import {CrossPlatformMatcher} from '../src/providers/crossPlatformMatcher.ts';
import {scoreCandidate} from '../src/domain/matching.ts';
import {trackKey,type Track} from '../src/domain/track.ts';
import {PlaybackController} from '../src/playback/controller.ts';
import {bindManualMatches} from '../src/playback/matchBinding.ts';
import {emptyQueue} from '../src/domain/queue.ts';
import {track,deferred} from './fixtures.ts';
const original:Track={...track,durationMs:120000},target:Track={...original,origin:{kind:'online',platform:'tx',id:'target'}};
const plain=normalizeLyrics('[00:01]Synthetic line'),rich=normalizeLyrics('[00:01.000]<0,500>Synthetic <500,500>line');
function setup(){let saved:unknown,fail=false;const repository={get:async<T>()=>saved as T|undefined,put:async(_:string,value:unknown)=>{if(fail)throw Error('disk');saved=JSON.parse(JSON.stringify(value));}};return{library:new LibraryStore(repository,()=> 'uuid',()=>1000),repository,fail:()=>{fail=true;}};}
const candidate=(value:Track)=>({track:value,...scoreCandidate(original,value)});
test('default lyrics preserve original, and automatic selection uses only reliable richer candidates with valid timeline',async()=>{
 const {library}=setup();let searches=0;const calls:string[]=[];
 const live={...target,title:target.title+' (Live)',origin:{kind:'online' as const,platform:'tx' as const,id:'live'}},bad={...target,origin:{kind:'online' as const,platform:'kg' as const,id:'bad'}},unknown={...target,durationMs:undefined,origin:{kind:'online' as const,platform:'kw' as const,id:'unknown'}};
 const service=new LyricSelection({load:async value=>{calls.push(value.origin.id);return value===bad?normalizeLyrics('[10:00]Out of timeline'):value===original?plain:rich;}},{candidates:async()=>{searches++;return{items:[candidate(live),candidate(unknown),candidate(bad),candidate(target)],failedPlatforms:[]};}},library);
 assert.equal((await service.load(original,new AbortController().signal)).source,original);assert.equal(searches,0);
 await service.choose(original,'automatic');const result=await service.load(original,new AbortController().signal);
 assert.equal(result.source,target);assert.ok(result.document.lines[0]!.words);assert.ok(!calls.includes('live'));assert.ok(!calls.includes('unknown'));assert.equal(searches,1);
 assert.equal(lyricRank(normalizeLyrics('[10:00]Bad'),120000),0);
});
test('automatic ties retain original and stable candidate order despite response timing',async()=>{
 const {library}=setup(),first=deferred<typeof rich>(),second=deferred<typeof rich>(),started=deferred<void>();let requested=0;await library.setLyricChoice(original,'automatic');
 const other={...target,origin:{kind:'online' as const,platform:'kg' as const,id:'second'}};
 const service=new LyricSelection({load:async value=>{if(value===original)return plain;if(++requested===2)started.resolve();return value===target?first.promise:second.promise;}},{candidates:async()=>({items:[candidate(target),candidate(other)],failedPlatforms:[]})},library);
 const result=service.load(original,new AbortController().signal);await started.promise;second.resolve(rich);await new Promise(resolve=>setTimeout(resolve,0));first.resolve(rich);assert.equal((await result).source,target);
 const tie=new LyricSelection({load:async()=>rich},{candidates:async()=>({items:[candidate(target)],failedPlatforms:[]})},library);assert.equal((await tie.load(original,new AbortController().signal)).source,original);
});
test('manual candidate failure keeps original lyrics and saved choice, while retry can recover selected words',async()=>{
 const {library}=setup();await library.setLyricChoice(original,'manual',target);let failed=true;
 const service=new LyricSelection({load:async value=>{if(value.origin.id===target.origin.id&&failed)throw Error('private url');return value.origin.id===target.origin.id?rich:plain;}},{candidates:async()=>{throw Error('manual must not search');}},library);
 const fallback=await service.load(original,new AbortController().signal);assert.equal(fallback.source,original);assert.ok(fallback.warning);assert.ok(!JSON.stringify(fallback).includes('private url'));assert.equal(library.lyricChoiceFor(original)?.mode,'manual');
 failed=false;assert.equal(trackKey((await service.load(original,new AbortController().signal)).source.origin),trackKey(target.origin));
});
test('private tracks never automatically search; public lyric search requires explicit allowPrivate',async()=>{
 const {library}=setup(),privateTrack:Track={...original,origin:{kind:'navidrome',accountId:'fixture',id:'private'}};let searches=0;
 const matcher=new CrossPlatformMatcher({search:async()=>{searches++;return{items:[],hasMore:false,page:1};}});
 const service=new LyricSelection({load:async()=>plain},matcher,library);
 await service.load(privateTrack,new AbortController().signal);assert.equal(searches,0);
 await assert.rejects(service.choose(privateTrack,'automatic'));assert.equal(library.lyricChoiceFor(privateTrack),undefined);
 await assert.rejects(service.candidates(privateTrack,new AbortController().signal));assert.equal(searches,0);
 await service.candidates(privateTrack,new AbortController().signal,{allowPrivate:true});assert.equal(searches,5);
 await service.choose(privateTrack,'manual',target);assert.equal((await service.load(privateTrack,new AbortController().signal)).source.origin.kind,'online');assert.equal(searches,5);
});
test('changed recording invalidates old lyric choice and backup preserves only clean selection data',async()=>{
 const {library,repository}=setup(),privateTarget={...target,metadata:{password:'private-secret',url:'file:///private/path'}};
 await library.setLyricChoice(original,'manual',privateTarget);assert.equal(library.lyricChoiceFor({...original,durationMs:200000}),undefined);
 const restored=new LibraryStore(repository,()=> 'uuid');await restored.restore();assert.equal(restored.lyricChoiceFor(original)?.mode,'manual');
 const text=encodeBackup(library.getSnapshot());assert.ok(!text.includes('private-secret'));assert.ok(!text.includes('file:///'));assert.equal(decodeBackup(text).library.lyricChoices![0]!.target!.origin.id,'target');
 const duplicate={...library.getSnapshot(),lyricChoices:[...library.getSnapshot().lyricChoices!,...library.getSnapshot().lyricChoices!]};assert.throws(()=>validateLibrary(duplicate));
});
test('stale or cancelled lyric results cannot win after selection changes or cache clear',async()=>{
 for(const action of ['choice','clear','abort']){
  const {library}=setup(),pending=deferred<typeof plain>(),started=deferred<void>();
  const service=new LyricSelection({load:async()=>{started.resolve();return pending.promise;}},{candidates:async()=>({items:[],failedPlatforms:[]})},library),abort=new AbortController();
  const result=service.load(original,abort.signal);await started.promise;
  if(action==='choice')await service.choose(original,'manual',target);else if(action==='clear')service.clear();else abort.abort();
  pending.resolve(plain);await assert.rejects(result);
 }
});
test('failed or cancelled writes preserve selection and lyric-only changes leave authoritative playback untouched',async()=>{
 const {library,fail}=setup();let stops=0;
 const controller=new PlaybackController({resolve:async()=>({url:'https://example.com/audio'})},{stop(){stops++;},load(){},play(){},pause(){}},emptyQueue);
 await controller.play({...emptyQueue,entries:[{id:'entry',track:original}],currentId:'entry'});controller.onReady(controller.getSnapshot().token!);const playing=controller.getSnapshot(),before=stops;
 const dispose=bindManualMatches(library,controller);
 await library.setLyricChoice(original,'manual',target);assert.equal(controller.getSnapshot(),playing);controller.pause();const state=controller.getSnapshot();await library.setLyricChoice(original,'original');assert.equal(stops,before);assert.equal(controller.getSnapshot(),state);
 const abort=new AbortController();abort.abort();await assert.rejects(library.setLyricChoice(original,'manual',target,abort.signal));assert.equal(library.lyricChoiceFor(original)?.mode,'original');
 fail();await assert.rejects(library.setLyricChoice(original,'automatic'));assert.equal(library.lyricChoiceFor(original)?.mode,'original');dispose();
});
test('automatic search and candidate failures preserve valid original lyrics without exposing transport errors',async()=>{
 const {library}=setup();await library.setLyricChoice(original,'automatic');
 for(const failSearch of [true,false]){
  const service=new LyricSelection({load:async value=>{if(value!==original)throw Error('https://private.invalid?token=secret');return plain;}},{candidates:async()=>{if(failSearch)throw Error('https://private.invalid?token=secret');return{items:[candidate(target)],failedPlatforms:['kg']};}},library);
  const result=await service.load(original,new AbortController().signal);assert.equal(result.source,original);assert.equal(result.document.lines[0]!.text,'Synthetic line');assert.ok(result.warning);assert.ok(!JSON.stringify(result).includes('token=secret'));
 }
});
test('automatic selection considers every reliable platform instead of spending its budget on duplicate platform results',async()=>{
 const {library}=setup();await library.setLyricChoice(original,'automatic');const calls:string[]=[];
 const duplicates=Array.from({length:6},(_,index)=>({...target,origin:{kind:'online' as const,platform:'tx' as const,id:`duplicate-${index}`}}));
 const distant={...target,origin:{kind:'online' as const,platform:'kg' as const,id:'rich-other-platform'}};
 const service=new LyricSelection({load:async value=>{calls.push(value.origin.id);return value===distant?rich:plain;}},{candidates:async()=>({items:[...duplicates,distant].map(candidate),failedPlatforms:[]})},library);
 assert.equal((await service.load(original,new AbortController().signal)).source,distant);assert.deepEqual(calls,[original.origin.id,'duplicate-0','rich-other-platform']);
});
test('private file revisions invalidate lyric choices even when titles artists and durations are unchanged',async()=>{
 const {library}=setup();
 for(const [kind,metadata] of [['webdav',{davVersion:'etag-one'}],['device',{deviceSignature:'a'.repeat(64)}]] as const){
  const source:Track={...original,origin:kind==='webdav'?{kind,accountId:'fixture',id:'file.mp3'}:{kind,libraryId:'fixture',id:'1'},metadata};
  await library.setLyricChoice(source,'manual',target);assert.ok(library.lyricChoiceFor(source));
  const changed={...source,metadata:kind==='webdav'?{davVersion:'etag-two'}:{deviceSignature:'b'.repeat(64)}};assert.equal(library.lyricChoiceFor(changed),undefined);
 }
});
