import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PreferenceStore,defaults} from '../src/app/preferences.ts';
import {miniPlayerDefaults,normalizeMiniActions} from '../src/domain/miniPlayer.ts';
import {lyricSignature} from '../src/domain/matching.ts';
import {LyricPreview,miniLyricText} from '../src/lyrics/preview.ts';
import {parseLyrics,type LyricDocument} from '../src/lyrics/parser.ts';
import type {Track} from '../src/domain/track.ts';
import type {Repository} from '../src/storage/repository.ts';
import {deferred,track} from './fixtures.ts';
function store(){
  let saved:unknown,fail=false;
  const repository={get:async<T>()=>saved as T,put:async(_:string,value:unknown)=>{if(fail)throw new Error('synthetic write failure');saved=structuredClone(value);}} as unknown as Repository;
  return {repository,preferences:new PreferenceStore(repository),set:(value:unknown)=>{saved=value;},fail:(value:boolean)=>{fail=value;}};
}
test('mini defaults migrate old preferences without changing sound or requesting lyrics',async()=>{
  const r=store(),{miniActions,miniLyrics,...old}=defaults;r.set({...old,quality:'128k',volume:.35});await r.preferences.restore();
  assert.deepEqual(r.preferences.getSnapshot().miniActions,['toggle','next']);assert.equal(r.preferences.getSnapshot().miniLyrics,false);assert.equal(r.preferences.getSnapshot().quality,'128k');assert.equal(r.preferences.getSnapshot().volume,.35);
  await r.preferences.update({miniLyrics:true,miniActions:['favorite','toggle','queue','next']});const restored=new PreferenceStore(r.repository);await restored.restore();assert.equal(restored.getSnapshot().miniLyrics,true);assert.deepEqual(restored.getSnapshot().miniActions,['favorite','toggle','queue','next']);
});
test('invalid mini configurations and failed writes preserve the previous settings',async()=>{
  const r=store(),before=r.preferences.getSnapshot();
  for(const miniActions of [[],['next'],['toggle','toggle'],['toggle','previous','next','queue','favorite'],['toggle','toString'],['toggle',1],null])await assert.rejects(r.preferences.update({miniActions} as never));
  await assert.rejects(r.preferences.update({miniLyrics:'true'} as never));assert.equal(r.preferences.getSnapshot(),before);
  r.fail(true);await assert.rejects(r.preferences.toggleMiniAction('favorite'));assert.equal(r.preferences.getSnapshot(),before);r.fail(false);await r.preferences.toggleMiniAction('favorite');assert.deepEqual(r.preferences.getSnapshot().miniActions,['toggle','next','favorite']);
});
test('rapid selection and reorder serialize, enforce four buttons and retain audio preferences',async()=>{
  const r=store();await Promise.all([r.preferences.toggleMiniAction('favorite'),r.preferences.toggleMiniAction('previous'),r.preferences.update({volume:.4})]);
  assert.deepEqual(r.preferences.getSnapshot().miniActions,['toggle','next','favorite','previous']);await assert.rejects(r.preferences.toggleMiniAction('queue'));await assert.rejects(r.preferences.toggleMiniAction('toggle'));
  await Promise.all([r.preferences.toggleMiniAction('previous'),r.preferences.toggleMiniAction('queue'),r.preferences.moveMiniAction('favorite',-1)]);
  assert.deepEqual(r.preferences.getSnapshot().miniActions,['toggle','favorite','next','queue']);assert.equal(r.preferences.getSnapshot().volume,.4);
  const input=['toggle','next'];const normalized=normalizeMiniActions(input);input.reverse();assert.deepEqual(normalized,['toggle','next']);
  await r.preferences.update({...miniPlayerDefaults});assert.deepEqual(r.preferences.getSnapshot().miniActions,['toggle','next']);assert.equal(r.preferences.getSnapshot().volume,.4);
});
test('lyric preview cancels old requests and rejects late results across recording versions',async()=>{
  const first=deferred<{document:LyricDocument}>(),second=deferred<{document:LyricDocument}>(),signals:AbortSignal[]=[];
  const preview=new LyricPreview(async(_,signal)=>{signals.push(signal);return signals.length===1?first.promise:second.promise;});
  const a:Track={...track,origin:{kind:'webdav',accountId:'fixture',id:'song.mp3'},metadata:{davVersion:'one'}},b={...a,metadata:{davVersion:'two'}};
  const old=preview.load(a),next=preview.load(b);assert.equal(signals[0]!.aborted,true);second.resolve({document:parseLyrics('[00:00.000]new version')});await next;
  first.resolve({document:parseLyrics('[00:00.000]old version')});await old;assert.equal(preview.getSnapshot().identity,lyricSignature(b));assert.equal(miniLyricText(preview.getSnapshot().document,0),'new version');
});
test('same-track choice changes and closing a preview discard late success or private errors',async()=>{
  const old=deferred<{document:LyricDocument}>(),current=deferred<{document:LyricDocument}>();let calls=0;
  const preview=new LyricPreview(()=>++calls===1?old.promise:current.promise),a=preview.load(track),b=preview.load(track);
  current.resolve({document:parseLyrics('[00:00.000]chosen lyrics')});await b;old.resolve({document:parseLyrics('[00:00.000]previous choice')});await a;assert.equal(miniLyricText(preview.getSnapshot().document,0),'chosen lyrics');
  const error=deferred<{document:LyricDocument}>(),closed=new LyricPreview(()=>error.promise),pending=closed.load(track);closed.clear();error.reject(new Error('https://private.invalid/song?token=private'));await pending;assert.deepEqual(closed.getSnapshot(),{identity:'',loading:false,failed:false});
  const failed=new LyricPreview(async()=>{throw new Error('https://private.invalid/?password=secret');});await failed.load(track);assert.equal(failed.getSnapshot().failed,true);assert.ok(!JSON.stringify(failed.getSnapshot()).includes('password'));
});
test('mini lyric timing shares offsets, ignores background voices, bounds text and clears ended gaps',()=>{
  const document:LyricDocument={synced:true,plain:[],lines:[{startMs:1000,endMs:2000,text:'first'},{startMs:3000,endMs:4000,text:'second'},{startMs:3200,endMs:3600,text:'background',background:true}]};
  assert.equal(miniLyricText(document,500),'first');assert.equal(miniLyricText(document,2200,500),'first');assert.equal(miniLyricText(document,2500),undefined);assert.equal(miniLyricText(document,3400),'second');assert.equal(miniLyricText(document,5000),undefined);
  assert.equal(miniLyricText({synced:false,lines:[],plain:['','plain text']},0),'plain text');assert.equal(miniLyricText(undefined,0),undefined);
  const long=miniLyricText({synced:false,lines:[],plain:['x'.repeat(279)+'😀'+'x'.repeat(500)]},0)!;assert.ok(long.length<=281);assert.ok(!/[\uD800-\uDBFF]…$/.test(long));
});
