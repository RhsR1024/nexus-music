import assert from 'node:assert/strict';
import {test} from 'node:test';
import {buildSyncState,canonical,decodeSync,encodeSync,libraryFromSync,planSync,resolveSync,SyncError,validateSyncState,type SyncState} from '../src/storage/multiDeviceSync.ts';
import {emptyLibrary,type LibraryState} from '../src/storage/library.ts';
const account='a'.repeat(64),directory='nexus-music-sync/',a='a'.repeat(32),b='b'.repeat(32);
const song=(id:string,title=id)=>({title,artist:'Fixture',origin:{kind:'online' as const,platform:'wy' as const,id},metadata:{},qualities:[]});
const playlist=(id:string,title=id)=>({id,title,createdAt:1,updatedAt:2,entries:[{id:'one',track:song('90071992547409931234')},{id:'two',track:song('90071992547409931234')}]});
const library=(title='One'):LibraryState=>({version:1,favorites:[song('fav')],history:[{track:song('hist'),playedAt:10}],playlists:[playlist('playlist',title)]});
const state=(value:LibraryState=library(),base?:SyncState,device=a)=>buildSyncState(value,device,account,directory,base);
const confirmed=(value:LibraryState=library())=>resolveSync(planSync(state(value)));
const isError=(kind:SyncError['kind'])=>(error:unknown)=>error instanceof SyncError&&error.kind===kind;

test('sync uses a baseline, not wall-clock ordering, and preserves duplicate entry IDs and long track IDs',()=>{
  const base=confirmed(),local=state(library('Local'),base),remote=resolveSync(planSync(state({...library(),favorites:[song('remote')]},base,b),base,base));
  const plan=planSync(local,remote,base);assert.equal(plan.conflicts.length,0);const result=libraryFromSync(resolveSync(plan),library());
  assert.equal(result.playlists[0]!.title,'Local');assert.deepEqual(result.playlists[0]!.entries.map(value=>value.id),['one','two']);assert.equal(result.playlists[0]!.entries[0]!.track.origin.id,'90071992547409931234');assert.equal(result.favorites[0]!.origin.id,'remote');assert.deepEqual(result.history,library().history);
});
test('independent first connections merge collections without replacing cloud with an empty device',()=>{
  const remote=confirmed();assert.equal(planSync(state(emptyLibrary),remote).conflicts.length,0);assert.equal(libraryFromSync(resolveSync(planSync(state(emptyLibrary),remote)),emptyLibrary).playlists.length,1);
  const local=state({...emptyLibrary,playlists:[playlist('new')]});const merged=resolveSync(planSync(local,remote));assert.equal(merged.records.filter(value=>value.kind==='playlist').length,2);
});
test('concurrent playlist rename or reorder requires an explicit choice and preserves the selected whole sequence',()=>{
  const base=confirmed(),local=state(library('Left'),base),right=library('Right');right.playlists=[{...right.playlists[0]!,entries:[...right.playlists[0]!.entries].reverse()}];const remote=resolveSync(planSync(state(right,base,b),base,base));
  const plan=planSync(local,remote,base);assert.equal(plan.conflicts.length,1);assert.throws(()=>resolveSync(plan),isError('choices'));
  const chosen=resolveSync(plan,{[plan.conflicts[0]!.id]:'remote'});assert.deepEqual(libraryFromSync(chosen,emptyLibrary).playlists[0]!.entries.map(value=>value.id),['two','one']);
});
test('remote deletion propagates to an offline unchanged client without resurrecting items',()=>{
  const base=confirmed(),remote=resolveSync(planSync(state({...library(),favorites:[],playlists:[]},base,b),base,base));
  const merged=resolveSync(planSync(state(library(),base),remote,base));assert.ok(merged.records.filter(value=>value.kind==='playlist'||value.kind==='favorite').every(value=>value.deleted));assert.equal(libraryFromSync(merged,library()).playlists.length,0);
  const next=buildSyncState(libraryFromSync(merged,library()),a,account,directory,merged);assert.deepEqual(next.records,merged.records);
});
test('initial connection or deliberate re-addition against a cloud tombstone is an explicit conflict',()=>{
  const base=confirmed(),deleted=resolveSync(planSync(state({...emptyLibrary},base,b),base,base));
  const plan=planSync(state(library()),deleted);assert.equal(plan.conflicts.length,2);assert.throws(()=>resolveSync(plan),isError('choices'));
  const restored=resolveSync(plan,Object.fromEntries(plan.conflicts.map(value=>[value.id,'local'])));assert.equal(libraryFromSync(restored,emptyLibrary).playlists.length,1);
});
test('delete versus modify conflicts never silently choose a timestamp winner',()=>{
  const base=confirmed(),remote=resolveSync(planSync(state(library('Remote'),base,b),base,base)),local=state({...library(),playlists:[]},base),plan=planSync(local,remote,base);
  assert.equal(plan.conflicts.length,1);assert.equal(plan.conflicts[0]!.local!.deleted,true);assert.equal(libraryFromSync(resolveSync(plan,{[plan.conflicts[0]!.id]:'local'}),emptyLibrary).playlists.length,0);
});
test('same concurrent edits converge and independent merge is symmetric',()=>{
  const base=confirmed(),local=state(library('Same'),base),remote=resolveSync(planSync(state(library('Same'),base,b),base,base));assert.equal(planSync(local,remote,base).conflicts.length,0);
  const left=state({...library(),favorites:[song('new')]},base),right=state(library('Right'),base,b);assert.deepEqual(planSync(left,right,base).records,planSync(right,left,base).records);
});
test('missing or rolled-back cloud revision after a known baseline is rejected',()=>{
  const base=confirmed();assert.throws(()=>planSync(state(library(),base),undefined,base),isError('conflict'));assert.throws(()=>planSync(state(library(),base),{...base,revision:0},base),isError('conflict'));
});
test('acknowledged live records and tombstones cannot silently disappear from the server',()=>{
  const base=confirmed(),deleted=resolveSync(planSync(state(emptyLibrary,base,b),base,base));
  for(const baseline of [base,deleted]){
    const incomplete={...baseline,revision:baseline.revision+1,records:baseline.records.slice(1)};
    assert.throws(()=>planSync(state(library(),baseline),incomplete,baseline),isError('conflict'));
  }
});
test('sync preserves surviving local collection order and appends remote additions without reordering playlist entries',()=>{
  const current:LibraryState={...emptyLibrary,favorites:[song('z'),song('b'),song('removed')],playlists:[playlist('z'),playlist('b')]};
  const remote=confirmed({...emptyLibrary,favorites:[song('a'),song('b','Updated'),song('z')],playlists:[playlist('a'),{...playlist('z'),entries:[...playlist('z').entries].reverse()},playlist('b')]});
  const result=libraryFromSync(remote,current);
  assert.deepEqual(result.favorites.map(value=>value.origin.id),['z','b','a']);assert.equal(result.favorites[1]!.title,'Updated');
  assert.deepEqual(result.playlists.map(value=>value.id),['z','b','a']);assert.deepEqual(result.playlists[0]!.entries.map(value=>value.id),['two','one']);
});
test('account and directory are both isolation boundaries',()=>{
  const base=confirmed();for(const other of [{...base,accountId:'b'.repeat(64)},{...base,directory:'other/'}]){assert.throws(()=>planSync(state(),other),isError('account'));assert.throws(()=>buildSyncState(library(),a,account,directory,other),isError('account'));}
});
test('strict validation rejects malformed payloads, mismatched keys, unknown kinds and duplicate IDs',()=>{
  const base=confirmed(),record=base.records.find(value=>value.kind==='playlist')!;
  for(const change of [{records:[{...record,payload:{bad:true}}]},{records:[{...record,id:'playlist:other'}]},{records:[{...record,kind:'statistics'}]},{records:[record,record]},{records:[{...record,deleted:true}]},{version:2},{revision:NaN},{deviceId:'wrong'}])assert.throws(()=>validateSyncState({...base,...change}),isError('format'));
});
test('sync strips credentials, scripts, authenticated URLs and local URIs from all payloads and unknown fields',()=>{
  const track={...song('safe'),metadata:{token:'fixture-secret',uri:'file:///private/file',songId:'safe',url:'https://fixture.invalid/a?token=fixture-secret'},artwork:'https://user:fixture-secret@fixture.invalid/a'};
  const value:LibraryState={...emptyLibrary,favorites:[track],playlists:[{...playlist('safe'),entries:[{id:'entry',track}]}],matches:[{original:track,target:song('target'),method:'manual',updatedAt:1}],lyricChoices:[{original:track,mode:'manual',target:song('target'),updatedAt:1}]};
  const text=encodeSync(state(value));assert.doesNotMatch(text,/fixture-secret|file:\/\/\/private/);const result=decodeSync(JSON.stringify({...JSON.parse(text),password:'fixture-secret'}));assert.equal('password' in result,false);assert.equal(libraryFromSync(result,emptyLibrary).favorites[0]!.metadata.songId,'safe');
});
test('bounded decoding and invalid JSON do not partially recover a malformed cloud document',()=>{
  assert.throws(()=>decodeSync('{broken'),isError('format'));assert.throws(()=>decodeSync('音'.repeat(12*1024*1024)),isError('capacity'));
  const base=confirmed();assert.throws(()=>validateSyncState({...base,records:Array.from({length:20001},(_,index)=>({id:`playlist:${index}`,kind:'playlist',deleted:true}))}),isError('capacity'));
});
test('canonical comparison is independent of object key insertion order, not collection order',()=>{
  assert.equal(canonical({b:1,a:2}),canonical({a:2,b:1}));assert.notEqual(canonical(['a','b']),canonical(['b','a']));
});
