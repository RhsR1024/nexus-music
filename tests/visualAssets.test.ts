import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VisualAssetStore,VisualColorCache,VisualImportError,type VisualNative} from '../src/storage/visualAssets.ts';
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
test('visual import failures report safe stages and preserve both slots for retry',async()=>{
  const r=rig();await r.store.import('background','file:///cache/a','old.png');const old=r.store.getSnapshot();
  const nativeImport=r.native.importVisual;
  r.native.importVisual=async()=>{throw new Error('file:///private/personal-photo.png secret-token');};
  await assert.rejects(r.store.import('photo','file:///cache/b','new.png'),error=>error instanceof VisualImportError&&error.stage==='read'&&!/personal|secret|file:/.test(String(error)));
  assert.equal(r.store.getSnapshot(),old);assert.deepEqual(r.retained.at(-1),['a'.repeat(64)]);
  r.native.importVisual=async()=>({id:'bad',width:1,height:1});
  await assert.rejects(r.store.import('photo','file:///cache/b','new.png'),error=>error instanceof VisualImportError&&error.stage==='validate');
  r.native.importVisual=nativeImport;r.fail(true);
  await assert.rejects(r.store.import('photo','file:///cache/b','new.png'),error=>error instanceof VisualImportError&&error.stage==='save');
  assert.equal(r.store.getSnapshot(),old);r.fail(false);await r.store.import('photo','file:///cache/b','new.png');
  assert.equal(r.store.getSnapshot().photo?.id,'b'.repeat(64));assert.equal(r.store.getSnapshot().background?.id,'a'.repeat(64));
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

test('old effective global motion migrates once and separate global/player choices persist atomically',async()=>{
  for(const coverColor of [false,true])for(const dynamicBackground of [false,true]){
    let record:unknown={coverColor,dynamicBackground};let fail=false;
    const repository={get:async<T>()=>record as T,put:async(_:string,value:unknown)=>{if(fail)throw new Error('disk full');record=structuredClone(value);}} as unknown as Repository;
    const store=new PreferenceStore(repository);await store.restore();assert.equal(store.getSnapshot().globalBackgroundMotion,coverColor&&dynamicBackground);
    await store.update({globalBackgroundMotion:true,dynamicBackground:false});const saved=store.getSnapshot();
    fail=true;await assert.rejects(store.update({globalBackgroundMotion:false}));assert.equal(store.getSnapshot(),saved);fail=false;
    const restarted=new PreferenceStore(repository);await restarted.restore();assert.equal(restarted.getSnapshot().globalBackgroundMotion,true);assert.equal(restarted.getSnapshot().dynamicBackground,false);
    await restarted.update({globalBackgroundMotion:false,dynamicBackground:true});const again=new PreferenceStore(repository);await again.restore();assert.equal(again.getSnapshot().globalBackgroundMotion,false);assert.equal(again.getSnapshot().dynamicBackground,true);
    await assert.rejects(again.update({globalBackgroundMotion:'true'} as never));
    record={...saved,globalBackgroundMotion:null};await assert.rejects(new PreferenceStore(repository).restore());
  }
});

test('pre-flip preference records upgrade to the cover palette default once',async()=>{
  let record:unknown={coverColor:false,dynamicBackground:false,globalBackgroundMotion:false};
  const repository={get:async<T>()=>record as T,put:async(_:string,value:unknown)=>{record=structuredClone(value);}} as unknown as Repository;
  const store=new PreferenceStore(repository);await store.restore();assert.equal(store.getSnapshot().coverColor,true,'records written before the default flip follow the cover palette');
  await store.update({coverColor:false});
  const restarted=new PreferenceStore(repository);await restarted.restore();assert.equal(restarted.getSnapshot().coverColor,false,'a manual off chosen after the upgrade survives restart');
  const fresh=new PreferenceStore({get:async<T>()=>undefined as T,put:async()=>{}} as unknown as Repository);await fresh.restore();assert.equal(fresh.getSnapshot().coverColor,true,'fresh installs default to the cover palette');
});

test('flow palettes coalesce independently, validate three colors and protect cached arrays',async()=>{
  const gate=deferred<readonly string[]>();let calls=0;const samples=['#FF0000','#00FF00','#0000FF'];
  const cache=new VisualColorCache({visualPalette:async()=> '#112233',visualFlowPalette:async()=>{calls++;return gate.promise;}});
  const first=cache.flowPalette('same'),second=cache.flowPalette('same');gate.resolve(samples);
  const palette=await first;assert.deepEqual(palette,await second);assert.equal(calls,1);assert.ok(Object.isFrozen(palette));samples[0]='#FFFFFF';assert.equal(palette[0],'#FF0000');
  assert.equal(await cache.color('same'),'#112233');assert.equal((await cache.flowPalette('same'))[0],'#FF0000');assert.equal(calls,1);
  const oldPlatform=new VisualColorCache({visualPalette:async()=> '#123456'});assert.deepEqual(await oldPlatform.flowPalette('same'),['#123456','#123456','#123456']);
  let invalidCalls=0;const invalid=new VisualColorCache({visualPalette:async()=> '#112233',visualFlowPalette:async()=>{invalidCalls++;return ['#FFFFFF','private/file.png'];}});
  await assert.rejects(invalid.flowPalette('same'),/Invalid visual flow palette/);await assert.rejects(invalid.flowPalette('same'));assert.equal(invalidCalls,2);assert.equal(await invalid.color('same'),'#112233');
});
test('flow and single-color requests share the 32 pending and 50 cached item budgets',async()=>{
  let colors=0,flows=0;
  const cached=new VisualColorCache({visualPalette:async()=>{colors++;return '#123456';},visualFlowPalette:async()=>{flows++;return ['#FF0000','#00FF00','#0000FF'];}});
  for(let i=0;i<20;i++)await cached.color(String(i));for(let i=0;i<30;i++)await cached.flowPalette(String(i));
  await cached.color('0');await cached.flowPalette('30');await cached.color('0');assert.equal(colors,20);await cached.color('1');assert.equal(colors,21);assert.equal(flows,31);
  const gates=Array.from({length:32},()=>deferred<string>());let requests=0,nativeFlow=0;
  const bounded=new VisualColorCache({visualPalette:async()=>gates[requests++]!.promise,visualFlowPalette:async()=>{nativeFlow++;return ['#000000','#000000','#000000'];}});
  const pending=Array.from({length:32},(_,i)=>bounded.color(String(i)));await assert.rejects(bounded.flowPalette('over'),/queue is full/);assert.equal(nativeFlow,0);
  gates[0]!.resolve('#000000');await pending[0];assert.deepEqual(await bounded.flowPalette('over'),['#000000','#000000','#000000']);assert.equal(nativeFlow,1);
  for(const gate of gates)gate.resolve('#000000');await Promise.all(pending);
});
test('clearing flow palettes rejects old results without removing a replacement request',async()=>{
  const old=deferred<readonly string[]>(),next=deferred<readonly string[]>();let calls=0;
  const cache=new VisualColorCache({visualPalette:async()=> '#000000',visualFlowPalette:async()=>++calls===1?old.promise:next.promise});
  const first=cache.flowPalette('same');cache.clear();const second=cache.flowPalette('same');old.resolve(['#FF0000','#FF0000','#FF0000']);await assert.rejects(first,/cache changed/);
  const third=cache.flowPalette('same');assert.equal(calls,2);next.resolve(['#0000FF','#00FF00','#FF0000']);assert.deepEqual(await second,await third);assert.equal((await cache.flowPalette('same'))[0],'#0000FF');
});
