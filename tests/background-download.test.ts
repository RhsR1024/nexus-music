import test from 'node:test';
import assert from 'node:assert/strict';
import {createBackgroundDownload,type BackgroundDownloadNative,type BackgroundDownloadState} from '../src/storage/backgroundDownload.ts';
import {OfflineDownloadInterrupted,type OfflineDownloadFiles} from '../src/storage/offlineDownloads.ts';

// The adapter only observes the native journal: pause/cancel intents must
// reach native.stop with the right direction, a missing journal must fail
// loudly, and partial sizes merge the owned file store with observed bytes.
function rig(options:{autoBegin?:boolean}={}){
  const states=new Map<string,BackgroundDownloadState>();
  const calls:{stop:[string,boolean][];discard:string[];acknowledge:string[];begins:string[]}={stop:[],discard:[],acknowledge:[],begins:[]};
  const native:BackgroundDownloadNative={
    configure:async()=>{},
    snapshot:async name=>states.get(name)??null,
    async begin(_url,name,_headers,resume){
      calls.begins.push(name);
      if(options.autoBegin!==false)states.set(name,{fileName:name,state:'running',received:resume?states.get(name)?.received??0:0,expected:0});
      return states.get(name)??{fileName:name,state:'running',received:0,expected:0};
    },
    async stop(name,pause){calls.stop.push([name,pause]);},
    async discard(name){calls.discard.push(name);},
    async acknowledge(name){calls.acknowledge.push(name);},
  };
  const removed:string[]=[],base={partial:0};
  const files={
    async remove(name:string){removed.push(name);},
    partialSize:()=>base.partial,
  };
  const adapter=createBackgroundDownload(native,files as unknown as OfflineDownloadFiles,async()=>{await new Promise(resolve=>setImmediate(resolve));});
  return {adapter,native,states,calls,removed,base,set:(state:BackgroundDownloadState)=>states.set(state.fileName,state),forget:(name:string)=>states.delete(name)};
}

const tick=async(times=2)=>{for(let index=0;index<times;index+=1)await new Promise(resolve=>setImmediate(resolve));};

test('background download resolves completed bytes and acknowledges the journal entry',async()=>{
  const r=rig();
  const run=r.adapter.download('https://audio.example/a','a.audio',{},{});
  await tick();r.set({fileName:'a.audio',state:'completed',received:3740360,expected:3740360});
  assert.equal(await run,3740360);
  assert.deepEqual(r.calls.begins,['a.audio']);
  await r.adapter.acknowledge!('a.audio');
  assert.deepEqual(r.calls.acknowledge,['a.audio']);
});

test('pause and cancel aborts stop the native transfer in the requested direction and keep received bytes',async()=>{
  for(const [reason,pause,state] of [['pause',true,'paused'],['cancel',false,'cancelled']] as const){
    const r=rig();
    const controller=new AbortController();
    const run=r.adapter.download('https://audio.example/a','a.audio',undefined,{signal:controller.signal});
    await tick();
    controller.abort(reason);
    await tick(4);
    r.set({fileName:'a.audio',state,received:262144,expected:4215580});
    await assert.rejects(run,(error:unknown)=>error instanceof OfflineDownloadInterrupted&&error.bytes===262144);
    assert.deepEqual(r.calls.stop,[['a.audio',pause]]);
  }
});

test('pre-aborted downloads never start a native transfer',async()=>{
  const r=rig();
  const controller=new AbortController();controller.abort();
  await assert.rejects(r.adapter.download('https://audio.example/a','a.audio',undefined,{signal:controller.signal}),(error:unknown)=>error instanceof OfflineDownloadInterrupted&&error.bytes===0);
  assert.deepEqual(r.calls.begins,[]);
});

test('a transfer that fails while observed surfaces the capacity rule and a retryable message',async()=>{
  const r=rig();
  const first=r.adapter.download('https://audio.example/a','a.audio',{},{});
  await tick();r.set({fileName:'a.audio',state:'failed',received:0,expected:0,error:'capacity'});
  await assert.rejects(first,/离线容量已满/);
  const second=r.adapter.download('https://audio.example/a','a.audio',{},{});
  await tick();r.set({fileName:'a.audio',state:'failed',received:0,expected:0,error:'network'});
  await assert.rejects(second,/后台下载失败，请重试/);
});

test('a vanished journal entry fails instead of waiting forever',async()=>{
  const r=rig({autoBegin:false});
  await assert.rejects(r.adapter.download('https://audio.example/a','gone.audio'),/后台下载状态已缺失/);
  assert.deepEqual(r.calls.begins,['gone.audio']);
});

test('recoverState reports only durable paused or cancelled states',async()=>{
  const r=rig();
  for(const [state,expected] of [['paused','paused'],['pausing','paused'],['cancelled','cancelled'],['cancelling','cancelled'],['running',undefined]] as const){
    r.set({fileName:'a.audio',state,received:0,expected:0});
    assert.equal(await r.adapter.recoverState!('a.audio'),expected,state);
    r.forget('a.audio');
  }
  assert.equal(await r.adapter.recoverState!('missing.audio'),undefined);
});

test('recoverDownload adopts a live transfer and ignores settled records',async()=>{
  const r=rig();
  r.set({fileName:'a.audio',state:'running',received:1000,expected:4000});
  const run=r.adapter.recoverDownload!('a.audio',{});
  await tick();r.set({fileName:'a.audio',state:'completed',received:4000,expected:4000});
  assert.equal(await run,4000);
  r.set({fileName:'b.audio',state:'paused',received:5,expected:9});
  assert.equal(await r.adapter.recoverDownload!('b.audio',{}),undefined);
  assert.equal(await r.adapter.recoverDownload!('missing.audio',{}),undefined);
});

test('stopDownload waits until the native journal leaves an active state',async()=>{
  const r=rig();
  r.set({fileName:'a.audio',state:'running',received:1,expected:2});
  const stopped=r.adapter.stopDownload!('a.audio',true);
  await tick();
  assert.deepEqual(r.calls.stop,[['a.audio',true]]);
  r.set({fileName:'a.audio',state:'pausing',received:1,expected:2});
  await tick();
  r.set({fileName:'a.audio',state:'paused',received:1,expected:2});
  await stopped;
  assert.deepEqual(r.calls.stop,[['a.audio',true]]);
});

test('remove discards the journal first and partial size merges file and observed bytes',async()=>{
  const r=rig();
  r.base.partial=10;
  r.set({fileName:'a.audio',state:'running',received:50,expected:100});
  await r.adapter.recoverState!('a.audio');
  assert.equal(r.adapter.partialSize('a.audio'),50);
  r.base.partial=70;
  assert.equal(r.adapter.partialSize('a.audio'),70);
  await r.adapter.remove('a.audio');
  assert.deepEqual(r.calls.discard,['a.audio']);
  assert.deepEqual(r.removed,['a.audio']);
});
