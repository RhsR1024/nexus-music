import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scoreCandidate} from '../src/domain/matching.ts';
import {CrossPlatformMatcher} from '../src/providers/crossPlatformMatcher.ts';
import {MatchedResolver} from '../src/providers/matchedResolver.ts';
import {trackKey,type Track} from '../src/domain/track.ts';
import {LibraryStore} from '../src/storage/library.ts';
import {decodeBackup,encodeBackup} from '../src/storage/backup.ts';
import type {Quality} from '../src/domain/quality.ts';
import type {RoutedMedia} from '../src/providers/multiSourceResolver.ts';
const original:Track={origin:{kind:'imported',platform:'qishui',id:'12345678901234567890'},title:'Synthetic',artist:'Fixture',durationMs:100000,metadata:{},qualities:[]};
const target=(platform:'wy'|'tx'='wy'):Track=>({...original,origin:{kind:'online',platform,id:'1'}});
const library=()=>new LibraryStore({get:async()=>undefined,put:async()=>{}},()=> 'uuid');
test('automatic matching requires title, artist, version and real duration agreement',()=>{
  assert.equal(scoreCandidate(original,target()).automatic,true);
  for(const value of [{title:'Synthetic (Live)'},{artist:'Another artist'},{durationMs:150000},{durationMs:undefined},{artist:''}])assert.equal(scoreCandidate(original,{...target(),...value}).automatic,false);
  assert.equal(scoreCandidate({...original,title:'Ｓｙｎｔｈｅｔｉｃ',artist:'A / B'},{...target(),artist:'B、A'}).automatic,true);
});
test('matching keeps other providers usable after one outage and never caches partial failures',async()=>{
  let calls=0;
  const matcher=new CrossPlatformMatcher({search:async platform=>{calls++;if(platform==='wy')throw Error('outage');return{items:[target('tx')],page:1,hasMore:false};}});
  const value=await matcher.candidates(original,new AbortController().signal,['wy','tx']);assert.equal(value.items[0]?.automatic,true);assert.deepEqual(value.failedPlatforms,['wy']);
  await matcher.candidates(original,new AbortController().signal,['wy','tx']);assert.equal(calls,4);
});
test('cancelled matching cannot publish a late provider response',async()=>{
  let finish!:(value:{items:Track[];page:number;hasMore:boolean})=>void;
  const matcher=new CrossPlatformMatcher({search:async()=>await new Promise(resolve=>{finish=resolve;}) as {items:Track[];page:number;hasMore:boolean}});
  const controller=new AbortController(),pending=matcher.candidates(original,controller.signal,['wy']);controller.abort();finish({items:[target()],page:1,hasMore:false});await assert.rejects(pending);
});
test('match records retain original identity, clean secrets and survive backup restore',async()=>{
  const store=library();await store.setMatch(original,{...target(),metadata:{token:'private',songId:'1'}},'manual');
  const copy=decodeBackup(encodeBackup(store.getSnapshot()));assert.equal(copy.library.matches?.[0]?.original.origin.kind,'imported');assert.equal(copy.library.matches?.[0]?.target.origin.kind,'online');assert.doesNotMatch(JSON.stringify(copy),/private/);
  assert.equal(store.matchFor({...original,title:'Changed title'}),undefined);assert.equal(store.matchFor(original)?.method,'manual');
});
test('cross-platform playback tries preferred quality globally and isolates decoder exclusions by target',async()=>{
  const store=library(),attempts:string[]=[],base=JSON.stringify(['source',1,'flac']);
  const media=(quality:Quality):RoutedMedia=>({url:'https://example.test/audio',routeKey:base,sourceId:'source',sourceRevision:1,sourceFingerprint:'fingerprint',requestedQuality:'flac',quality,scriptQuality:quality});
  const router={resolve:async(track:Track,_signal:AbortSignal,excluded?:ReadonlySet<string>,scope?:readonly Quality[])=>{
    const platform=track.origin.kind==='online'?track.origin.platform:'',quality=scope![0]!;attempts.push(`${platform}:${quality}`);
    if(platform==='tx'&&quality==='flac'&&!excluded?.has(base))return media(quality);
    if(platform==='wy'&&quality==='320k'){assert.equal(excluded?.has(base),false);return media(quality);}
    throw Error('no audio');
  }};
  const resolver=new MatchedResolver({router,library:store,matcher:{candidates:async()=>({items:[{track:target('wy'),...scoreCandidate(original,target('wy'))},{track:target('tx'),...scoreCandidate(original,target('tx'))}],failedPlatforms:[]})},available:()=>['wy','tx'],quality:()=> 'flac',hash:async value=>value});
  const result=await resolver.resolve(original,new AbortController().signal);assert.deepEqual(attempts,['wy:flac','tx:flac']);assert.equal(store.matchFor(original)?.target.origin.kind,'online');
  attempts.length=0;const next=await resolver.resolve(original,new AbortController().signal,new Set([result.routeKey!]));assert.equal(next.quality,'320k');assert.equal(JSON.parse(next.cacheKey!)[1],trackKey(target('wy').origin));assert.equal(original.origin.kind,'imported');
});
test('explicit manual version selection does not silently switch to automatic candidates',async()=>{
  const store=library(),chosen={...target('tx'),title:'Explicit live version'};await store.setMatch(original,chosen,'manual');
  const resolver=new MatchedResolver({library:store,matcher:{candidates:async()=>{throw Error('must not search');}},available:()=>['tx'],quality:()=> '128k',hash:async value=>value,router:{resolve:async track=>{assert.equal(track.title,chosen.title);return{url:'https://example.test/audio',routeKey:'manual',sourceId:'source',sourceRevision:1,requestedQuality:'128k',quality:'128k',scriptQuality:'128k'};}}});
  await resolver.resolve(original,new AbortController().signal);assert.equal(store.matchFor(original)?.method,'manual');
});
