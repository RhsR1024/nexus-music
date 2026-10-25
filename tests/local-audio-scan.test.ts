import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LocalAudioStore,type LocalAudioNative,type NativeAudioScan,type ScannedAudio} from '../src/storage/localAudio.ts';
import {validateLocalScan,emptyLocalScan} from '../src/domain/localScan.ts';
const root={id:'root-1',name:'Public Music',recursive:true};
function audio(letter:string,path=''):ScannedAudio{return{id:letter.repeat(64),extension:'mp3',bytes:1000,durationMs:200000,title:letter,artist:'Unknown',album:'',lyric:'',created:true,modifiedAt:100,location:{rootId:root.id,rootName:root.name,path,fileName:letter+'.mp3'}};}
function setup(){
  const data=new Map<string,unknown>(),removed:string[]=[],retained:string[][]=[];let writeFailure=false,result:NativeAudioScan={files:[],folders:[],failed:[]};
  const repository={get:async<T>(key:string)=>data.get(key) as T|undefined,put:async(key:string,value:unknown)=>{if(writeFailure)throw Error('disk full');data.set(key,structuredClone(value));}};
  const native:LocalAudioNative={pickAudioFolder:async()=>({id:root.id,name:root.name}),retainAudioFolders:async ids=>{retained.push([...ids]);},scanAudioFolders:async()=>result,importAudio:async()=>audio('a'),resolveAudio:async(id,ext)=>`file:///owned/${id}.${ext}`,localArtwork:async()=>null,beginRemoval:async()=>'',finishRemoval:async()=>{},reconcile:async()=>{},removeAudio:async id=>{removed.push(id);}};
  const store=new LocalAudioStore(repository,native);
  return{store,native,repository,removed,retained,result:(value:NativeAudioScan)=>{result=value;},fail:(value=true)=>{writeFailure=value;}};
}
const rules={roots:[root],minimumSeconds:0,blocked:[]};
const scan=(files:ScannedAudio[]):NativeAudioScan=>({files,folders:[{rootId:root.id,rootName:root.name,path:''}],failed:[]});
test('saved roots do not change the index; rescan commits index and rule state together, including restart',async()=>{
  const f=setup();await f.store.saveScanRules(rules);assert.equal(f.store.getSnapshot().length,0);assert.equal(f.store.getScanSnapshot().dirty,true);
  f.result(scan([audio('a'),audio('b','Albums')]));await f.store.rescan();assert.equal(f.store.getSnapshot().length,2);assert.equal(f.store.getScanSnapshot().dirty,false);assert.equal(f.store.getSnapshot()[0]!.manualImport,false);
  await f.store.toggleFavorite('a'.repeat(64));const restored=new LocalAudioStore(f.repository,f.native);await restored.restore();assert.equal(restored.getScanSnapshot().roots[0]!.id,root.id);assert.equal(restored.getSnapshot()[0]!.favorite,true);assert.deepEqual(f.retained,[[root.id]]);
});
test('removing scan roots applies only at rescan, retains owned playback references and cannot be bypassed by index restoration',async()=>{
  const f=setup();await f.store.saveScanRules(rules);f.result(scan([audio('a')]));await f.store.rescan();const track=f.store.getSnapshot()[0]!.track;
  await f.store.saveScanRules({...rules,roots:[]});assert.equal(f.store.getSnapshot().length,1);f.result({files:[],folders:[],failed:[]});await f.store.rescan();assert.equal(f.store.getSnapshot().length,0);assert.equal(f.store.hiddenCount(),0);await f.store.restoreIndex();assert.equal(f.store.getSnapshot().length,0);assert.match((await f.store.resolve(track)).url,/owned/);assert.deepEqual(f.removed,[]);
});
test('manual imports survive root removal, while a successful rescan restores user-hidden scanned entries',async()=>{
  const f=setup();await f.store.import([{uri:'file:///input',name:'a.mp3'}]);await f.store.saveScanRules(rules);f.result(scan([audio('a'),audio('b')]));await f.store.rescan();
  await f.store.removeFromIndex(['b'.repeat(64)]);assert.equal(f.store.getSnapshot().length,1);await f.store.rescan();assert.equal(f.store.getSnapshot().length,2);
  await f.store.saveScanRules({...rules,roots:[]});f.result({files:[],folders:[],failed:[]});await f.store.rescan();assert.deepEqual(f.store.getSnapshot().map(file=>file.id),['a'.repeat(64)]);
});
test('unreadable files retain prior index references; missing files disappear and locations merge by content identity',async()=>{
  const f=setup();await f.store.saveScanRules(rules);const a=audio('a'),b=audio('b');f.result(scan([a,b]));await f.store.rescan();
  const second=audio('a','Other');f.result({...scan([second]),failed:[a.location]});const result=await f.store.rescan();assert.equal(result.unreadable,1);assert.equal(f.store.getSnapshot().length,1);assert.equal(f.store.getSnapshot()[0]!.locations!.length,2);assert.equal(f.store.getSnapshot()[0]!.id,a.id);
});
test('failed scan commits preserve both settings state and index, cleaning only newly created copies',async()=>{
  const f=setup();await f.store.saveScanRules(rules);f.result(scan([audio('a')]));await f.store.rescan();const old=f.store.getSnapshot(),settings=f.store.getScanSnapshot();
  f.result(scan([audio('a'),audio('b')]));f.fail();await assert.rejects(f.store.rescan());assert.equal(f.store.getSnapshot(),old);assert.equal(f.store.getScanSnapshot(),settings);assert.deepEqual(f.removed,['b'.repeat(64)]);
  await assert.rejects(f.store.saveScanRules({...rules,minimumSeconds:300}));assert.equal(f.store.getScanSnapshot(),settings);
});
test('scan calls use saved recursion, blocked directories and duration rules; native root failure is atomic',async()=>{
  const f=setup();const saved={roots:[{...root,recursive:false}],minimumSeconds:240,blocked:[root.id+'/Albums']};await f.store.saveScanRules(saved);
  f.native.scanAudioFolders=async(ids,recursive,blocked,minimum)=>{assert.deepEqual(ids,[root.id]);assert.deepEqual(recursive,[]);assert.deepEqual(blocked,saved.blocked);assert.equal(minimum,240);throw Error('authorization unavailable');};
  const before=f.store.getSnapshot();await assert.rejects(f.store.rescan(),/authorization/);assert.equal(f.store.getSnapshot(),before);assert.equal(f.store.getScanSnapshot().dirty,true);
});
test('scan records reject traversal, absolute locations and nonfinite settings',()=>{
  for(const blocked of [['root-1/../escape'],['/private/'],['root-1/C:\\x']])assert.throws(()=>validateLocalScan({...emptyLocalScan,roots:[root],blocked}));
  assert.throws(()=>validateLocalScan({...emptyLocalScan,minimumSeconds:NaN}));
});

test('bookmark maintenance failure cannot prevent restoration of owned audio',async()=>{
  const f=setup();await f.store.import([{uri:'file:///input',name:'a.mp3'}]);f.native.retainAudioFolders=async()=>{throw Error('source unavailable');};const restored=new LocalAudioStore(f.repository,f.native);await restored.restore();assert.equal(restored.getSnapshot().length,1);assert.match((await restored.resolve(restored.getSnapshot()[0]!.track)).url,/owned/);
});
