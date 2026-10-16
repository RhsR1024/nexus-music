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
  const controller=new AbortController(),pending=matcher.candidates(original,controller.signal,['wy']);await new Promise(resolve=>setImmediate(resolve));controller.abort();finish({items:[target()],page:1,hasMore:false});await assert.rejects(pending);
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
const platformOf=(song:Track|undefined)=>song?.origin.kind==='online'?song.origin.platform:undefined;
const onlineOriginal:Track={...original,origin:{kind:'online',platform:'wy',id:'original'}};
const routed=(quality:Quality='flac'):RoutedMedia=>({url:'https://example.test/audio',routeKey:'raw-route',sourceId:'source',sourceRevision:1,sourceFingerprint:'fingerprint',requestedQuality:'flac',quality,scriptQuality:quality});
const candidateResult=(song:Track)=>({items:[{track:song,...scoreCandidate(onlineOriginal,song)}],failedPlatforms:[]});
test('ordinary online playback defers matching until original preferred quality fails, then tries matched quality before downgrade',async()=>{
  const store=library(),attempts:string[]=[];let searches=0,originalWorks=true;
  const resolver=new MatchedResolver({library:store,available:()=>['wy','tx'],quality:()=> 'flac',hash:async value=>value,
    matcher:{candidates:async()=>{searches++;return candidateResult(target('tx'));}},router:{resolve:async(song,_signal,_excluded,scope)=>{
      const quality=scope![0]!;attempts.push(`${song.origin.id}:${quality}`);if(song.origin.id==='original'&&!originalWorks&&quality==='flac')throw Error('not available');return routed(quality);
    }}});
  const first=await resolver.resolve(onlineOriginal,new AbortController().signal);assert.equal(searches,0);assert.equal(first.matchedTrack,undefined);assert.deepEqual(JSON.parse(first.routeKey!),[trackKey(onlineOriginal.origin),'raw-route']);
  originalWorks=false;attempts.length=0;const next=await resolver.resolve(onlineOriginal,new AbortController().signal);
  assert.deepEqual(attempts,['original:flac','1:flac']);assert.equal(platformOf(next.matchedTrack),'tx');assert.equal(store.matchFor(onlineOriginal)?.method,'automatic');assert.equal(onlineOriginal.origin.id,'original');
});
test('automatic matching disabled keeps original quality order; manual binding overrides policy without searching',async()=>{
  const store=library(),attempts:string[]=[];
  const resolver=new MatchedResolver({library:store,autoMatch:()=>false,available:()=>['wy','tx'],quality:()=> 'flac',hash:async value=>value,matcher:{candidates:async()=>{throw Error('must not search');}},router:{resolve:async(song,_signal,_excluded,scope)=>{
    const quality=scope![0]!;attempts.push(`${song.origin.id}:${quality}`);if(song.origin.id==='original'&&quality!=='128k')throw Error('unavailable');return routed(quality);
  }}});
  const first=await resolver.resolve(onlineOriginal,new AbortController().signal);assert.equal(first.quality,'128k');assert.deepEqual(attempts,['original:flac','original:320k','original:192k','original:128k']);
  await store.setMatch(onlineOriginal,target('tx'),'manual');attempts.length=0;const second=await resolver.resolve(onlineOriginal,new AbortController().signal);assert.deepEqual(attempts,['1:flac']);assert.equal(platformOf(second.matchedTrack),'tx');
});
test('manual unavailable version reports safe failure and never uses original or other targets',async()=>{
  const store=library();await store.setMatch(onlineOriginal,target('tx'),'manual');let searches=0;const attempts:string[]=[];
  const resolver=new MatchedResolver({library:store,available:()=>['wy','tx'],quality:()=> 'flac',hash:async value=>value,matcher:{candidates:async()=>{searches++;return candidateResult(target('wy'));}},router:{resolve:async(song,_signal,_excluded,scope)=>{assert.equal(platformOf(song),'tx');attempts.push(scope![0]!);throw Error('PRIVATE_TOKEN');}}});
  await assert.rejects(resolver.resolve(onlineOriginal,new AbortController().signal),/指定版本/);assert.equal(searches,0);assert.deepEqual(attempts,['flac','320k','192k','128k']);
});
test('candidate cache separates manual keywords and pages, excludes original and wrong-platform results',async()=>{
  const calls:Array<[string,string,number,number|undefined]>=[];
  const matcher=new CrossPlatformMatcher({search:async(platform,query,page,_signal,limit)=>{calls.push([platform,query,page,limit]);return {items:[onlineOriginal,target('tx'),target('wy')],page,hasMore:true};}});
  const signal=new AbortController().signal;const first=await matcher.candidates(onlineOriginal,signal,['wy'],{query:'first',limit:25});assert.deepEqual(first.items.map(item=>platformOf(item.track)),['wy']);
  await matcher.candidates(onlineOriginal,signal,['wy'],{query:'first',limit:25});assert.equal(calls.length,1);
  await matcher.candidates(onlineOriginal,signal,['wy'],{query:'second',page:2,limit:25});assert.deepEqual(calls[1],['wy','second',2,25]);
  await assert.rejects(matcher.candidates(onlineOriginal,signal,['wy'],{page:11}));
});
test('normal online matches persist in backups, reject self-binding, and target bindings are resolved only one hop',async()=>{
  const store=library(),a=onlineOriginal,b=target('tx');await assert.rejects(store.setMatch(a,a,'manual'));
  await store.setMatch(a,b,'manual');await store.setMatch(b,a,'manual');const copy=decodeBackup(encodeBackup(store.getSnapshot()));assert.equal(copy.library.matches?.length,2);
  const seen:Track[]=[];const resolver=new MatchedResolver({library:store,available:()=>['wy','tx'],quality:()=> '128k',hash:async value=>value,matcher:{candidates:async()=>{throw Error('not needed');}},router:{resolve:async track=>{seen.push(track);return routed('128k');}}});
  await resolver.resolve(a,new AbortController().signal);assert.deepEqual(seen.map(song=>trackKey(song.origin)),[trackKey(b.origin)]);
});
test('automatic write compare guard cannot overwrite a queued manual choice; aborted guards cannot write',async()=>{
  const store=library(),signal=new AbortController();const manual=store.setMatch(onlineOriginal,target('tx'),'manual');
  const automatic=store.setMatch(onlineOriginal,target('wy'),'automatic',{signal:signal.signal,previous:undefined});await manual;await assert.rejects(automatic);assert.equal(store.matchFor(onlineOriginal)?.method,'manual');assert.equal(platformOf(store.matchFor(onlineOriginal)?.target),'tx');
  signal.abort();await assert.rejects(store.setMatch(onlineOriginal,target('wy'),'automatic',{signal:signal.signal,previous:store.matchFor(onlineOriginal)}));assert.equal(platformOf(store.matchFor(onlineOriginal)?.target),'tx');
});
test('manual change during an in-flight URL attempt prevents automatic playback and preserves chosen version',async()=>{
  const store=library();let finish!:(value:RoutedMedia)=>void,started!:()=>void;const waiting=new Promise<void>(resolve=>{started=resolve;});
  const resolver=new MatchedResolver({library:store,available:()=>['wy','tx'],quality:()=> 'flac',hash:async value=>value,matcher:{candidates:async()=>candidateResult(target('tx'))},router:{resolve:async()=>{started();return new Promise<RoutedMedia>(resolve=>{finish=resolve;});}}});
  const pending=resolver.resolve(onlineOriginal,new AbortController().signal);await waiting;await store.setMatch(onlineOriginal,target('tx'),'manual');finish(routed());await assert.rejects(pending,/匹配设置已更改/);assert.equal(store.matchFor(onlineOriginal)?.method,'manual');
});
test('fresh reliable platform result replaces stale automatic ID; uncertain versions are never automatically tried',async()=>{
  const store=library(),stale={...target('tx'),origin:{kind:'online' as const,platform:'tx' as const,id:'stale'}};await store.setMatch(onlineOriginal,stale,'automatic');const attempts:string[]=[];
  const resolver=new MatchedResolver({library:store,available:()=>['wy','tx'],quality:()=> 'flac',hash:async value=>value,matcher:{candidates:async()=>candidateResult(target('tx'))},router:{resolve:async(song)=>{attempts.push(song.origin.id);if(song.origin.id!=='1')throw Error('unavailable');return routed();}}});
  await resolver.resolve(onlineOriginal,new AbortController().signal);assert.deepEqual(attempts,['original','1']);assert.equal(store.matchFor(onlineOriginal)?.target.origin.id,'1');
  const empty=library();attempts.length=0;const uncertain={...target('tx'),durationMs:undefined};const strict=new MatchedResolver({library:empty,available:()=>['wy','tx'],quality:()=> '128k',hash:async value=>value,matcher:{candidates:async()=>candidateResult(uncertain)},router:{resolve:async(song)=>{attempts.push(song.origin.id);throw Error('private');}}});await assert.rejects(strict.resolve(onlineOriginal,new AbortController().signal),/可靠匹配/);assert.deepEqual(attempts,['original']);assert.equal(empty.matchFor(onlineOriginal),undefined);
});
test('decode exclusion of the wrapped original route is unwrapped only for that original identity',async()=>{
  const store=library();let blocked:ReadonlySet<string>|undefined;
  const resolver=new MatchedResolver({library:store,autoMatch:()=>false,available:()=>['wy'],quality:()=> '128k',hash:async value=>value,matcher:{candidates:async()=>{throw Error('not needed');}},router:{resolve:async(_song,_signal,excluded)=>{blocked=excluded;return routed('128k');}}});
  const result=await resolver.resolve(onlineOriginal,new AbortController().signal);await resolver.resolve(onlineOriginal,new AbortController().signal,new Set([result.routeKey!,JSON.stringify([trackKey(target('tx').origin),'other'])]));assert.deepEqual([...blocked!],['raw-route']);
});
test('a verified saved automatic target remains usable during a search outage',async()=>{
  const store=library();await store.setMatch(onlineOriginal,target('tx'),'automatic');const attempts:string[]=[];
  const resolver=new MatchedResolver({library:store,available:()=>['wy','tx'],quality:()=> '128k',hash:async value=>value,matcher:{candidates:async()=>{throw Error('offline search');}},router:{resolve:async song=>{attempts.push(song.origin.id);if(song.origin.id==='original')throw Error('unavailable');return routed('128k');}}});const media=await resolver.resolve(onlineOriginal,new AbortController().signal);assert.equal(platformOf(media.matchedTrack),'tx');assert.deepEqual(attempts,['original','1']);
});
