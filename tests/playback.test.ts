import {PlaybackMessageError} from '../src/playback/errors.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackController, type ResolvedMedia, type PlaybackBackend } from '../src/playback/controller.ts';
import { advance, makeQueue, select, appendMany } from '../src/domain/queue.ts';
import { deferred, entry } from './fixtures.ts';

function rig() {
  const requests: Array<ReturnType<typeof deferred<ResolvedMedia>> & { signal: AbortSignal }> = [];
  const calls: string[] = [];
  const backend: PlaybackBackend = {
    stop: () => { calls.push('stop'); }, pause: () => { calls.push('pause'); },
    load: media => { calls.push(`load:${media.url}`); }, play: () => { calls.push('play'); },
  };
  const queue = makeQueue([entry('a'), entry('b')]);
  const controller = new PlaybackController({ resolve: (_, signal) => {
    const request = { ...deferred<ResolvedMedia>(), signal }; requests.push(request); return request.promise;
  } }, backend, queue);
  return { controller, requests, calls, queue };
}

test('pause aborts resolution; late URL cannot load or start playback', async () => {
  const { controller, requests, calls } = rig();
  const pending = controller.play();
  controller.pause();
  assert.equal(requests[0]?.signal.aborted, true);
  requests[0]!.resolve({ url: 'https://example.test/late.mp3' });
  await pending;
  assert.deepEqual(calls, ['stop', 'pause']);
  assert.equal(controller.getSnapshot().intent, 'paused');
});

test('new selection wins even when old resolver ignores cancellation', async () => {
  const { controller, requests, calls, queue } = rig();
  const old = controller.play();
  const latest = controller.play(select(queue, 'b'));
  requests[1]!.resolve({ url: 'https://example.test/new.mp3' }); await latest;
  requests[0]!.resolve({ url: 'https://example.test/old.mp3' }); await old;
  assert.deepEqual(calls, ['stop', 'stop', 'load:https://example.test/new.mp3', 'play']);
  assert.equal(controller.getSnapshot().queue.currentId, 'b');
});

test('late rejection cannot overwrite successful selection or leak resolver secrets', async () => {
  const { controller, requests, queue } = rig();
  const old = controller.play(); const current = controller.play(select(queue, 'b'));
  requests[1]!.resolve({ url: 'https://example.test/new.mp3' }); await current;
  requests[0]!.reject(new Error('PRIVATE_TOKEN')); await old;
  assert.equal(controller.getSnapshot().phase, 'ready');
  assert.equal(controller.getSnapshot().error, null);
});

test('resolver failure pauses and shows a safe actionable error', async () => {
  const { controller, requests } = rig();
  const pending = controller.play(); requests[0]!.reject(new Error('PRIVATE_TOKEN')); await pending;
  assert.equal(controller.getSnapshot().intent, 'paused');
  assert.equal(controller.getSnapshot().phase, 'error');
  assert.ok(!controller.getSnapshot().error?.includes('PRIVATE_TOKEN'));
});

test('ended events advance once; stale callbacks do not skip the next song', async () => {
  const { controller, requests } = rig();
  const initial = controller.play(); requests[0]!.resolve({ url: 'https://example.test/a.mp3' }); await initial;
  const oldToken = controller.getSnapshot().token!;
  const next = controller.onEnded(oldToken);
  await controller.onEnded(oldToken);
  assert.equal(requests.length, 2);
  assert.equal(controller.getSnapshot().queue.currentId, 'b');
  requests[1]!.resolve({ url: 'https://example.test/b.mp3' }); await next;
});

test('paused or disposed controller ignores native end events and late results', async () => {
  const { controller, requests, calls } = rig();
  const pending = controller.play(); const token = controller.getSnapshot().token!;
  controller.dispose(); requests[0]!.resolve({ url: 'https://example.test/a.mp3' }); await pending;
  await controller.onEnded(token);
  assert.deepEqual(calls, ['stop', 'stop']);
  assert.equal(requests.length, 1);
});

test('replacing current entry aborts old work and waits for explicit play', async () => {
  const { controller, requests, queue, calls } = rig();
  const pending = controller.play(); controller.setQueue(select(queue, 'b'));
  requests[0]!.resolve({ url: 'https://example.test/a.mp3' }); await pending;
  assert.equal(controller.getSnapshot().intent, 'paused');
  assert.deepEqual(calls, ['stop', 'stop']);
});

test('ready media resumes in place after pause without resolving or resetting position', async () => {
  const { controller, requests, calls } = rig();
  const pending = controller.play(); requests[0]!.resolve({ url: 'https://example.test/a.mp3' }); await pending;
  const old = controller.getSnapshot().token!;
  controller.onReady(old); controller.onProgress(old, 32, 100, false);
  controller.pause(); await controller.play();
  assert.equal(requests.length, 1);
  assert.equal(controller.getSnapshot().position, 32);
  assert.ok(controller.getSnapshot().token!.generation > old.generation);
  assert.equal(calls.at(-1), 'play');
  await controller.onEnded(old); assert.equal(requests.length, 1);
});

test('native decode failure retries resolver with only the failed route excluded', async () => {
  const calls: ReadonlySet<string>[] = [];
  const controller = new PlaybackController({ resolve: async (_, __, excluded) => {
    calls.push(new Set(excluded)); return { url: 'https://example.test/audio', routeKey: calls.length === 1 ? 'a:flac' : 'b:flac' };
  } }, { load() {}, stop() {}, pause() {}, play() {} }, makeQueue([entry('a')]));
  await controller.play(); const old = controller.getSnapshot().token!;
  await controller.onError(old);
  assert.equal(calls.length, 2); assert.deepEqual([...calls[1]!], ['a:flac']);
  await controller.onError(old); assert.equal(calls.length, 2);
  controller.pause(); await controller.onError(controller.getSnapshot().token ?? old);
  assert.equal(calls.length, 2);
});

test('restored cursor stays paused and is passed to native only after explicit play',async()=>{
  const loads:ResolvedMedia[]=[];
  const controller=new PlaybackController({resolve:async()=>({url:'https://example.test/audio'})},{load:media=>{loads.push(media);},play(){},stop(){},pause(){}},makeQueue([entry('a')]));
  controller.restoreCursor('a',32);assert.equal(controller.getSnapshot().intent,'paused');assert.equal(loads.length,0);
  await controller.play();assert.equal(loads[0]!.startPosition,32);
});

test('player shows only explicitly safe application messages for unavailable device or local files',async()=>{
  const {controller,requests}=rig();const pending=controller.play();requests[0]!.reject(new PlaybackMessageError('请重新导入此设备的音频文件'));await pending;
  assert.equal(controller.getSnapshot().intent,'paused');assert.equal(controller.getSnapshot().error,'请重新导入此设备的音频文件');
});
test('controller admits ipod-library only for a device track with an explicit device media resolution',async()=>{
  for(const trusted of [false,true]){
    const f=rig(),song=entry('a');f.controller.setQueue(makeQueue([{...song,track:{...song.track,origin:{kind:'device',libraryId:'local-fixture',id:'1'}}}]));
    const pending=f.controller.play();f.requests[0]!.resolve({url:'ipod-library://item/fixture.m4a',...(trusted?{deviceMedia:true}:{})});await pending;
    assert.equal(f.calls.some(call=>call.startsWith('load:')),trusted);
  }
  const f=rig(),pending=f.controller.play();f.requests[0]!.resolve({url:'ipod-library://item/fixture.m4a',deviceMedia:true});await pending;assert.equal(f.calls.some(call=>call.startsWith('load:')),false);
});
test('resolver metadata updates the authoritative queue before load without changing identity or paused resume',async()=>{
  const f=rig(),song=f.queue.entries[0]!.track,pending=f.controller.play();
  f.requests[0]!.resolve({url:'https://example.test/audio',resolvedTrack:{...song,title:'Enriched fixture'}});await pending;
  assert.equal(f.controller.getSnapshot().queue.entries[0]!.track.title,'Enriched fixture');assert.deepEqual(f.controller.getSnapshot().queue.entries[0]!.track.origin,song.origin);
  assert.equal(f.controller.getSnapshot().media?.resolvedTrack,undefined);f.controller.onReady(f.controller.getSnapshot().token!);f.controller.pause();await f.controller.play();assert.equal(f.requests.length,1);
  const bad=rig(),rejected=bad.controller.play();bad.requests[0]!.resolve({url:'https://example.test/audio',resolvedTrack:{...song,origin:{kind:'local',id:'another'}}});await rejected;assert.equal(bad.calls.some(call=>call.startsWith('load:')),false);
});
test('a pause triggered by metadata publication still prevents the resolved media from loading',async()=>{
  const f=rig();let paused=false;f.controller.subscribe(()=>{if(!paused&&f.controller.getSnapshot().queue.entries[0]!.track.title==='Enriched'){paused=true;f.controller.pause();}});
  const pending=f.controller.play();f.requests[0]!.resolve({url:'https://example.test/audio',resolvedTrack:{...f.queue.entries[0]!.track,title:'Enriched'}});await pending;
  assert.equal(f.calls.some(call=>call.startsWith('load:')),false);assert.equal(f.controller.getSnapshot().intent,'paused');
});

test('manual match edits invalidate loaded media without losing original queue or resume position',async()=>{
  const {LibraryStore}=await import('../src/storage/library.ts'),{bindManualMatches}=await import('../src/playback/matchBinding.ts');
  const f=rig(),store=new LibraryStore({get:async()=>undefined,put:async()=>{}},()=> 'uuid'),song=f.queue.entries[0]!.track,target={...song,origin:{kind:'online' as const,platform:'tx' as const,id:'matched'}};
  const unbind=bindManualMatches(store,f.controller),pending=f.controller.play();f.requests[0]!.resolve({url:'https://example.test/old'});await pending;
  const old=f.controller.getSnapshot().token!;f.controller.onReady(old);f.controller.onProgress(old,32,100,false);const queue=f.controller.getSnapshot().queue;
  await store.setMatch(song,target,'manual');assert.equal(f.controller.getSnapshot().media,null);assert.equal(f.controller.getSnapshot().intent,'paused');assert.equal(f.controller.getSnapshot().queue,queue);assert.equal(f.controller.getSnapshot().position,32);
  const replay=f.controller.play();assert.equal(f.requests.length,2);f.requests[1]!.resolve({url:'https://example.test/new',matchedTrack:target});await replay;assert.equal(f.controller.getSnapshot().media?.startPosition,32);
  f.controller.onReady(f.controller.getSnapshot().token!);await store.removeMatch(song);assert.equal(f.controller.getSnapshot().media,null);assert.equal(f.controller.getSnapshot().intent,'paused');await f.controller.onEnded(old);assert.equal(f.requests.length,2);unbind();
});
test('automatic match publication does not cancel its own resolve; another track manual edit does not stop current',async()=>{
  const {LibraryStore}=await import('../src/storage/library.ts'),{bindManualMatches}=await import('../src/playback/matchBinding.ts');
  const f=rig(),store=new LibraryStore({get:async()=>undefined,put:async()=>{}},()=> 'uuid'),song=f.queue.entries[0]!.track,target={...song,origin:{kind:'online' as const,platform:'tx' as const,id:'matched'}};
  const unbind=bindManualMatches(store,f.controller),pending=f.controller.play();await store.setMatch(song,target,'automatic');assert.equal(f.requests[0]!.signal.aborted,false);
  await store.setMatch({...song,origin:{kind:'online',platform:'wy',id:'another'}},target,'manual');assert.equal(f.requests[0]!.signal.aborted,false);
  f.requests[0]!.resolve({url:'https://example.test/audio',matchedTrack:target});await pending;assert.equal(f.controller.getSnapshot().phase,'ready');unbind();
});
test('manual match edit aborts pending resolution and stale completion cannot load',async()=>{
  const {LibraryStore}=await import('../src/storage/library.ts'),{bindManualMatches}=await import('../src/playback/matchBinding.ts');
  const f=rig(),store=new LibraryStore({get:async()=>undefined,put:async()=>{}},()=> 'uuid'),song=f.queue.entries[0]!.track;
  const unbind=bindManualMatches(store,f.controller),pending=f.controller.play();await store.setMatch(song,{...song,origin:{kind:'online',platform:'tx',id:'matched'}},'manual');assert.equal(f.requests[0]!.signal.aborted,true);
  f.requests[0]!.resolve({url:'https://example.test/stale'});await pending;assert.equal(f.calls.some(call=>call.startsWith('load:')),false);unbind();
});
test('clearing a saved automatic match invalidates already loaded media instead of resuming the removed binding',async()=>{
  const {LibraryStore}=await import('../src/storage/library.ts'),{bindManualMatches}=await import('../src/playback/matchBinding.ts');const f=rig(),store=new LibraryStore({get:async()=>undefined,put:async()=>{}},()=> 'uuid'),song=f.queue.entries[0]!.track,target={...song,origin:{kind:'online' as const,platform:'tx' as const,id:'matched'}};
  await store.setMatch(song,target,'automatic');const unbind=bindManualMatches(store,f.controller),play=f.controller.play();f.requests[0]!.resolve({url:'https://example.test/old',matchedTrack:target});await play;const token=f.controller.getSnapshot().token!;f.controller.onReady(token);f.controller.onProgress(token,20,100,false);
  await store.removeMatch(song);assert.equal(f.controller.getSnapshot().media,null);assert.equal(f.controller.getSnapshot().intent,'paused');const next=f.controller.play();assert.equal(f.requests.length,2);f.requests[1]!.resolve({url:'https://example.test/new'});await next;assert.equal(f.controller.getSnapshot().media?.startPosition,20);unbind();
});

test('bulk list append leaves an active native session and paused cursor unchanged',async()=>{
  const {controller,requests,calls}=rig();const loading=controller.play();requests[0]!.resolve({url:'https://example.test/a.mp3'});await loading;
  const token=controller.getSnapshot().token!;controller.onProgress(token,42,120,false);const before=calls.slice();
  controller.setQueue(appendMany(controller.getSnapshot().queue,[entry('extra1'),entry('extra2')]));
  assert.deepEqual(calls,before);assert.equal(controller.getSnapshot().token,token);assert.equal(controller.getSnapshot().position,42);assert.equal(controller.getSnapshot().intent,'playing');
  controller.pause();const paused=controller.getSnapshot();controller.setQueue(appendMany(paused.queue,[entry('extra3')]));
  assert.equal(controller.getSnapshot().token,paused.token);assert.equal(controller.getSnapshot().position,42);assert.equal(controller.getSnapshot().intent,'paused');
});

test('resolution failures skip forward along the queue while playing', async () => {
  const calls:string[]=[];
  const backend:PlaybackBackend={stop:()=>{},pause:()=>{},load:()=>{},play:()=>{}};
  const queue=makeQueue([entry('a'),entry('b'),entry('c')]);
  const controller=new PlaybackController({resolve:()=>{calls.push('resolve');return calls.length<3?Promise.reject(new Error('fixture offline')):Promise.resolve({url:'https://example.test/ok.mp3'});}},backend,queue);
  controller.setResolveFailureHandler(current=>{
    const next=advance(current);
    if(!next.currentId)return false;
    void controller.play(next);
    return true;
  });
  const started=controller.play();
  const deadline=Date.now()+5000;
  while(controller.getSnapshot().phase!=='ready'){if(Date.now()>deadline)throw new Error('skip chain did not settle');await new Promise(resolve=>setTimeout(resolve,10));}
  await started;await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(controller.getSnapshot().queue.currentId,'c');
  assert.equal(controller.getSnapshot().media?.url,'https://example.test/ok.mp3');
  assert.equal(calls.length,3);
});

test('single-track failures surface the error without skipping', async () => {
  const backend:PlaybackBackend={stop:()=>{},pause:()=>{},load:()=>{},play:()=>{}};
  const controller=new PlaybackController({resolve:()=>Promise.reject(new Error('offline'))},backend,makeQueue([entry('a')]));
  await controller.play();
  const state=controller.getSnapshot();
  assert.equal(state.phase,'error');assert.match(state.error??'',/无法获取或加载歌曲/);
  assert.equal(state.queue.currentId,'a');
});

test('runaway skipping is capped and ends in a visible error', async () => {
  const backend:PlaybackBackend={stop:()=>{},pause:()=>{},load:()=>{},play:()=>{}};
  const queue=makeQueue(Array.from({length:20},(_,index)=>entry(`a${index}`)));
  const controller=new PlaybackController({resolve:()=>Promise.reject(new Error('offline'))},backend,queue);
  let skips=0;
  controller.setResolveFailureHandler(current=>{
    if(skips>=15){return false;}
    const next=advance(current);
    if(!next.currentId)return false;
    skips++;void controller.play(next);
    return true;
  });
  const started=controller.play();
  const deadline=Date.now()+8000;
  while(controller.getSnapshot().phase!=='error'){if(Date.now()>deadline)throw new Error('runaway chain did not settle');await new Promise(resolve=>setTimeout(resolve,10));}
  await started;await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(skips,15);
  assert.equal(controller.getSnapshot().queue.currentId,'a15');
  assert.match(controller.getSnapshot().error??'',/无法获取或加载歌曲/);
});

test('queue lock survives advancement and in-queue selection, resets on rebuild', async () => {
  const backend:PlaybackBackend={stop:()=>{},pause:()=>{},load:()=>{},play:()=>{}};
  const queue=makeQueue([entry('a'),entry('b')]);
  const controller=new PlaybackController({resolve:()=>Promise.resolve({url:'https://example.test/ok.mp3'})},backend,queue);
  controller.setQueueLocked(true);
  await controller.play();
  assert.equal(controller.getSnapshot().queueLocked,true);
  const token=controller.getSnapshot().token!;
  await controller.onEnded(token);
  assert.equal(controller.getSnapshot().queue.currentId,'b');
  assert.equal(controller.getSnapshot().queueLocked,true);
  await controller.play(select(queue,'a'));
  assert.equal(controller.getSnapshot().queue.currentId,'a');
  assert.equal(controller.getSnapshot().queueLocked,true);
  await controller.play(makeQueue([entry('x'),entry('y')]));
  assert.equal(controller.getSnapshot().queueLocked,false);
});
