import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlaybackController,type PlaybackState} from '../src/playback/controller.ts';
import {playbackTimeline} from '../src/playback/timeline.ts';
import {makeQueue} from '../src/domain/queue.ts';
import {track} from './fixtures.ts';
function rig(){const loads:unknown[]=[],seeks:number[]=[];const original={...track,durationMs:233744};const queue=makeQueue([{id:'public-a',track:original}]);const controller=new PlaybackController({resolve:async()=>({url:'https://example.test/public'})},{load:media=>{loads.push(media);},play(){},pause(){},stop(){},seek:seconds=>{seeks.push(seconds);}},queue);return {controller,loads,seeks,queue};}
test('restored metadata presents duration and cursor without preparing or enabling native seek',()=>{
  const r=rig();r.controller.restoreCursor('public-a',8);const state=r.controller.getSnapshot(),timeline=playbackTimeline(state);assert.equal(timeline.duration,233.744);assert.equal(timeline.position,8);assert.equal(timeline.source,'metadata');assert.equal(timeline.seekable,false);assert.equal(state.duration,0);assert.equal(state.intent,'paused');assert.equal(r.controller.getSnapshot(),state);assert.equal(r.controller.getSnapshot().queue,r.queue);r.controller.seek(40);assert.deepEqual(r.seeks,[]);assert.deepEqual(r.loads,[]);
});
test('native duration replaces metadata and keeps seek bounded by the actual recording',async()=>{
  const r=rig();r.controller.restoreCursor('public-a',8);await r.controller.play();const token=r.controller.getSnapshot().token!;r.controller.onReady(token);r.controller.onProgress(token,10,180,false);const view=playbackTimeline(r.controller.getSnapshot());assert.equal(view.duration,180);assert.equal(view.source,'native');assert.equal(view.seekable,true);r.controller.seek(220);assert.deepEqual(r.seeks,[180]);r.controller.pause();assert.equal(playbackTimeline(r.controller.getSnapshot()).duration,180);assert.equal(playbackTimeline(r.controller.getSnapshot()).seekable,true);
});
test('matched recording metadata wins over original metadata and unknown matched duration stays unknown',()=>{
  const r=rig(),state=r.controller.getSnapshot(),matched={...track,origin:{kind:'online' as const,platform:'tx' as const,id:'another'},durationMs:120000};assert.equal(playbackTimeline({...state,media:{url:'https://example.test/public',matchedTrack:matched}}).duration,120);const {durationMs,...unknown}=matched;assert.equal(playbackTimeline({...state,media:{url:'https://example.test/public',matchedTrack:unknown}}).source,'unknown');
});
test('switching current queue entry cannot reuse the previous track duration or cursor',()=>{
  const r=rig();r.controller.restoreCursor('public-a',8);r.controller.setQueue(makeQueue([{id:'public-b',track:{...track,durationMs:54000}}]));const view=playbackTimeline(r.controller.getSnapshot());assert.equal(view.duration,54);assert.equal(view.position,0);assert.equal(view.seekable,false);assert.deepEqual(r.loads,[]);
});
test('invalid durations and positions cannot create invalid progress or phantom readiness',()=>{
  const r=rig(),state=r.controller.getSnapshot();for(const duration of [0,-1,NaN,Infinity]){const value:PlaybackState={...state,duration,position:NaN,queue:makeQueue([{id:'public-a',track:{...track}}])};const view=playbackTimeline(value);assert.equal(view.duration,0);assert.equal(view.position,0);assert.equal(view.progress,0);assert.equal(view.seekable,false);}
  const view=playbackTimeline({...state,position:999});assert.equal(view.position,233.744);assert.equal(view.progress,1);assert.equal(view.seekable,false);assert.equal(state.position,0);
});
