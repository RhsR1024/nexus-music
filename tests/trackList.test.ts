import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trackRows,viewTrackRows,selectedTrackRows} from '../src/domain/trackList.ts';
import {appendMany,makeQueue,enqueueNext} from '../src/domain/queue.ts';
import {LibraryStore} from '../src/storage/library.ts';
import type {Repository} from '../src/storage/repository.ts';
import {track,entry} from './fixtures.ts';

test('list filtering normalizes width and case, matches all tokens across fields and preserves input',()=>{
  const tracks=[{...track,title:'ＡＢＣ 10',artist:'测试歌手',album:'专辑'}, {...track,title:'ABC 2',artist:'其他'}];
  const rows=trackRows(tracks,['a','b']);const original=JSON.stringify(rows);
  assert.deepEqual(viewTrackRows(rows,'abc 歌手','title').map(row=>row.key),['a']);
  assert.deepEqual(viewTrackRows(rows,'','title').map(row=>row.key),['b','a']);
  assert.equal(JSON.stringify(rows),original);assert.equal(tracks[0]!.title,'ＡＢＣ 10');
});
test('duration sorting keeps unknown values last in both directions and ties stable',()=>{
  const rows=trackRows([track,{...track,durationMs:2000},{...track,durationMs:1000},{...track,durationMs:2000},{...track,durationMs:0}],['unknown','two','one','tie','zero']);
  assert.deepEqual(viewTrackRows(rows,'','durationAsc').map(row=>row.key),['one','two','tie','unknown','zero']);
  assert.deepEqual(viewTrackRows(rows,'','durationDesc').map(row=>row.key),['two','tie','one','unknown','zero']);
});
test('duplicate recording selection follows entry identity across sorting, insertion and deletion',()=>{
  const rows=trackRows([track,track,{...track,title:'A'}],['first','second','third']);const selected=new Set(['second']);
  assert.equal(selectedTrackRows(viewTrackRows(rows,'','title'),selected)[0]!.key,'second');
  const inserted=trackRows([{...track,title:'new'},track,track],['new','first','second']);
  assert.equal(selectedTrackRows(inserted,selected)[0]!.originalIndex,2);
  assert.deepEqual(selectedTrackRows(inserted.filter(row=>row.key!=='second'),selected),[]);
  assert.throws(()=>trackRows([track,track],['same','same']));assert.throws(()=>trackRows([track],[]));
  assert.notEqual(trackRows([track,track])[0]!.key,trackRows([track,track])[1]!.key);
});
test('ten thousand rows retain long IDs, distinct duplicates and deterministic views',()=>{
  const tracks=Array.from({length:10000},(_,i)=>({...track,title:`Song ${10000-i}`,durationMs:i%3?i*1000:undefined}));
  const rows=trackRows(tracks),view=viewTrackRows(rows,'song','title');
  assert.equal(new Set(view.map(row=>row.key)).size,10000);assert.equal(view[0]!.originalIndex,9999);
  assert.equal(view[0]!.track.origin.id,'90071992547409931234');assert.equal(rows[0]!.originalIndex,0);
});
test('sorted filtered removal deletes only the selected duplicate and persists the remaining original order',async()=>{
  let saved:unknown,counter=0,fail=false;
  const repository:Pick<Repository,'get'|'put'>={get:async<T>()=>saved as T,put:async(_,value)=>{if(fail)throw new Error('fixture');saved=structuredClone(value);}};
  const library=new LibraryStore(repository,()=>String(++counter));const id=await library.createPlaylist('Fixture',[track,{...track,title:'A'},track]);
  let playlist=library.getSnapshot().playlists[0]!;
  const rows=trackRows(playlist.entries.map(item=>item.track),playlist.entries.map(item=>item.id));
  const wanted=viewTrackRows(rows,'测试','title').filter(row=>row.originalIndex===2);const selected=new Set(wanted.map(row=>row.key));
  const before=library.getSnapshot();fail=true;await assert.rejects(library.removeEntries(id,[...selected]));assert.equal(library.getSnapshot(),before);assert.equal(selected.size,1);
  fail=false;await library.removeEntries(id,[...selected]);playlist=library.getSnapshot().playlists[0]!;
  assert.deepEqual(playlist.entries.map(item=>item.id),rows.slice(0,2).map(row=>row.key));
  const restored=new LibraryStore(repository,()=> 'unused');await restored.restore();assert.deepEqual(restored.getSnapshot().playlists[0]!.entries,playlist.entries);
});
test('bulk queue append preserves active playback and FIFO intent and validates atomically',()=>{
  const original=enqueueNext(makeQueue([entry('playing'),entry('tail')]),entry('next'));
  const result=appendMany(original,Array.from({length:10000},(_,i)=>entry(`bulk${i}`)));
  assert.equal(result.currentId,'playing');assert.deepEqual(result.priorityIds,['next']);assert.deepEqual(result.entries.slice(0,3),original.entries);
  assert.equal(result.entries.length,10003);assert.equal(original.entries.length,3);
  assert.throws(()=>appendMany(original,[entry('new'),entry('next')]));assert.throws(()=>appendMany(original,[entry('new'),entry('new')]));assert.equal(original.entries.length,3);
  assert.equal(appendMany(original,[]),original);assert.equal(appendMany(makeQueue([]),[entry('first')]).currentId,'first');
});
