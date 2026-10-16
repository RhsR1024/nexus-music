import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VisualAssetStore,VisualColorCache,type VisualNative} from '../src/storage/visualAssets.ts';
import {PreferenceStore,defaults} from '../src/app/preferences.ts';
import {darkenCoverColor,playerBackgroundImage} from '../src/domain/appearance.ts';
import {deferred} from './fixtures.ts';
import type {Repository} from '../src/storage/repository.ts';
function rig(){let record:unknown,fail=false;const retained:string[][]=[];const native:VisualNative={importVisual:async uri=>({id:(uri.endsWith('a')?'a':'b').repeat(64),width:1920,height:1080}),resolveVisual:async id=>`file:///private/app/${id}.jpg`,reconcileVisuals:async ids=>{retained.push([...ids]);},visualPalette:async()=> '#FF2040'};
  const repository:Pick<Repository,'get'|'put'>={get:async<T>()=>record as T,put:async(_,value)=>{if(fail)throw new Error('fixture');record=structuredClone(value);}};
  return{native,repository,retained,store:new VisualAssetStore(repository,native),fail:(value:boolean)=>{fail=value;},set:(value:unknown)=>{record=value;}};
}
test('visual slots share an image safely and persist identities without temporary paths',async()=>{
  const r=rig();await r.store.import('background','file:///cache/a','photo.png');await r.store.import('photo','file:///cache/a','same.png');
  assert.deepEqual(r.retained.at(-1),['a'.repeat(64)]);await r.store.remove('background');assert.deepEqual(r.retained.at(-1),['a'.repeat(64)]);
  const restored=new VisualAssetStore(r.repository,r.native);await restored.restore();assert.equal(restored.getSnapshot().photo?.name,'same.png');assert.ok(!JSON.stringify(restored.getSnapshot()).includes('file:'));
  await restored.remove('photo');assert.deepEqual(r.retained.at(-1),[]);
});
test('failed image replacement or deletion preserves old slots and cleans only unreferenced files',async()=>{
  const r=rig();await r.store.import('photo','file:///cache/a','old.png');const original=r.store.getSnapshot();r.fail(true);
  await assert.rejects(r.store.import('photo','file:///cache/b','new.png'));assert.equal(r.store.getSnapshot(),original);assert.deepEqual(r.retained.at(-1),['a'.repeat(64)]);
  await assert.rejects(r.store.remove('photo'));assert.equal(r.store.getSnapshot(),original);r.fail(false);await r.store.import('photo','file:///cache/b','new.png');assert.deepEqual(r.retained.at(-1),['b'.repeat(64)]);
});
test('visual writes serialize imports and removal, reject invalid records and tolerate missing files',async()=>{
  const r=rig(),gate=deferred<{id:string;width:number;height:number}>();r.native.importVisual=async()=>gate.promise;
  const save=r.store.import('photo','file:///cache/a','a\u0000.png'),remove=r.store.remove('photo');await Promise.resolve();gate.resolve({id:'a'.repeat(64),width:100,height:200});await save;await remove;assert.equal(r.store.getSnapshot().photo,null);
  await assert.rejects(r.store.import('photo','https://example.test/a','url'));r.set({version:1,photo:{id:'../escape',name:'x',width:1,height:1},background:null});await assert.rejects(r.store.restore());
  r.native.resolveVisual=async()=>{throw new Error('missing');};assert.equal(await r.store.resolve({id:'a'.repeat(64),name:'a',width:1,height:1}),undefined);
});
test('native result corruption cannot publish image slots and previous state remains intact',async()=>{
  const r=rig();await r.store.import('photo','file:///cache/a','old.png');const old=r.store.getSnapshot();r.native.importVisual=async()=>({id:'../../escape',width:4000,height:1});await assert.rejects(r.store.import('photo','file:///cache/b','new'));assert.equal(r.store.getSnapshot(),old);
});
test('color requests coalesce, validate results and evict the oldest cache entry',async()=>{
  let calls=0;const gate=deferred<string>();const cache=new VisualColorCache({visualPalette:async()=>{calls++;return gate.promise;}});
  const a=cache.color('same'),b=cache.color('same');gate.resolve('#FF0000');assert.equal(await a,await b);assert.equal(calls,1);
  for(let i=0;i<50;i++)await cache.color(String(i));await cache.color('same');assert.equal(calls,52);
  const invalid=new VisualColorCache({visualPalette:async()=> 'url(private)'});await assert.rejects(invalid.color('file'));await assert.rejects(invalid.color('file'));
  assert.equal(darkenCoverColor('#FF0000'),'#480000');assert.equal(darkenCoverColor('#FFFFFF'),'#484848');assert.equal(darkenCoverColor('bad'),'#183647');
});
test('clearing color cache prevents a late palette result from repopulating it',async()=>{
  const first=deferred<string>(),calls:string[]=[];const cache=new VisualColorCache({visualPalette:async uri=>{calls.push(uri);return first.promise;}});
  const pending=cache.color('stale');cache.clear();first.resolve('#00FF00');await assert.rejects(pending);assert.equal(calls.length,1);
});
test('cleared in-flight palettes cannot block or remove a replacement request for the same URI',async()=>{
  const old=deferred<string>(),next=deferred<string>();let calls=0;const cache=new VisualColorCache({visualPalette:async()=>++calls===1?old.promise:next.promise});
  const stale=cache.color('file:///cover');cache.clear();const fresh=cache.color('file:///cover');old.resolve('#FF0000');await assert.rejects(stale);
  const shared=cache.color('file:///cover');assert.equal(calls,2);next.resolve('#0000FF');assert.equal(await fresh,'#0000FF');assert.equal(await shared,'#0000FF');
});
test('visual preferences migrate old settings and reject out of range updates atomically',async()=>{
  let value:unknown={quality:'128k'};const repository={get:async<T>()=>value as T,put:async(_:string,next:unknown)=>{value=structuredClone(next);}} as unknown as Repository;
  const preferences=new PreferenceStore(repository);await preferences.restore();assert.equal(preferences.getSnapshot().coverRadius,defaults.coverRadius);assert.equal(preferences.getSnapshot().dynamicBackground,false);
  await preferences.update({backgroundStyle:'image',backgroundOpacity:.6,playerBackground:'photo',coverRadius:48,coverColor:true,dynamicBackground:true});const saved=preferences.getSnapshot();
  for(const patch of [{playerBlur:81},{playerBlur:NaN},{backgroundOpacity:-1},{coverRadius:49},{playerDarkness:.1},{playerBackground:'unknown'}])await assert.rejects(preferences.update(patch as never));
  assert.equal(preferences.getSnapshot(),saved);const restored=new PreferenceStore(repository);await restored.restore();assert.equal(restored.getSnapshot().backgroundStyle,'image');assert.equal(restored.getSnapshot().coverColor,true);
});

test('solid player backgrounds never resurrect a loaded cover and failed photos fall back safely',()=>{
  assert.equal(playerBackgroundImage('solid',false,'photo','cover'),undefined);
  assert.equal(playerBackgroundImage('solid',true,'photo','cover',['photo']),undefined);
  assert.equal(playerBackgroundImage('artwork',false,'photo','cover'),'cover');
  assert.equal(playerBackgroundImage('artwork',true,'photo','cover'),'photo');
  assert.equal(playerBackgroundImage('photo',false,undefined,'cover'),'cover');
  assert.equal(playerBackgroundImage('photo',false,'photo','cover',['photo']),'cover');
  assert.equal(playerBackgroundImage('artwork',false,'photo','cover',['cover']),undefined);
  assert.equal(playerBackgroundImage('photo',false,undefined,undefined),undefined);
  assert.equal(playerBackgroundImage('photo',false,'photo','cover',['photo','cover']),undefined);
});
