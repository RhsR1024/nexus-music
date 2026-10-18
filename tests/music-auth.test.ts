import test from 'node:test';
import assert from 'node:assert/strict';
import {MusicAuthError,MusicAuthFlow} from '../src/providers/musicAuth.ts';

test('authorization resolves once and ignores callbacks after success',async()=>{
  const flow=new MusicAuthFlow<string>();let emit:(event:any)=>void=()=>{};let stopped=0;
  const promise=flow.start(callback=>{emit=callback;return()=>{stopped++;}});emit({type:'success',value:'session'});emit({type:'success',value:'late'});
  assert.equal(await promise,'session');assert.equal(stopped,1);assert.equal(flow.getSnapshot().status,'succeeded');
});

test('cancellation tears down the native attempt and rejects exactly once',async()=>{
  const flow=new MusicAuthFlow<string>();let emit:(event:any)=>void=()=>{};let stopped=0;
  const promise=flow.start(callback=>{emit=callback;return()=>{stopped++;}});flow.cancel();emit({type:'success',value:'late'});
  await assert.rejects(promise,(error)=>error instanceof MusicAuthError&&error.kind==='cancelled');assert.equal(stopped,1);assert.equal(flow.getSnapshot().status,'cancelled');
});

test('a new attempt invalidates callbacks from the previous generation',async()=>{
  const flow=new MusicAuthFlow<string>(),callbacks:((event:any)=>void)[]=[];
  const old=flow.start(callback=>{callbacks.push(callback);return()=>{} });const current=flow.start(callback=>{callbacks.push(callback);return()=>{} });
  callbacks[0]!({type:'success',value:'old'});callbacks[1]!({type:'success',value:'new'});
  await assert.rejects(old,(error)=>error instanceof MusicAuthError&&error.kind==='cancelled');assert.equal(await current,'new');
});

test('expiry and launcher failure expose bounded user-facing states',async()=>{
  const flow=new MusicAuthFlow<string>();let emit:(event:any)=>void=()=>{};
  const expired=flow.start(callback=>{emit=callback;return()=>{}});emit({type:'expired'});await assert.rejects(expired,(error)=>error instanceof MusicAuthError&&error.kind==='expired');
  const failed=flow.start(()=>{throw new Error('private protocol detail')});await assert.rejects(failed,(error)=>error instanceof MusicAuthError&&error.kind==='failed');assert.equal(flow.getSnapshot().error,'授权失败，请重试');assert.doesNotMatch(JSON.stringify(flow.getSnapshot()),/private protocol/);
});

test('cleanup errors never leave an authorization promise pending',async()=>{
  const flow=new MusicAuthFlow<string>();let emit:(event:any)=>void=()=>{};
  const promise=flow.start(callback=>{emit=callback;return()=>{throw new Error('native teardown failed');}});emit({type:'success',value:'session'});
  assert.equal(await promise,'session');assert.equal(flow.getSnapshot().status,'succeeded');
});
