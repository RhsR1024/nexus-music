import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LibraryStore} from '../src/storage/library.ts';
import {decodeBackup,encodeBackup} from '../src/storage/backup.ts';
import {decodeQueue} from '../src/storage/queuePersistence.ts';
import {makeQueue,enqueueNext} from '../src/domain/queue.ts';
import {track,entry} from './fixtures.ts';
import type {Repository} from '../src/storage/repository.ts';
function setup(){let value:string|undefined,failed=false,counter=0;
  const repository:Pick<Repository,'get'|'put'>={get:async<T>()=>value?JSON.parse(value)as T:undefined,put:async(_,data)=>{if(failed)throw new Error('fixture');value=JSON.stringify(data);}};
  const library=new LibraryStore(repository,()=>String(++counter),()=>1000);
  return{library,repository,fail:()=>{failed=true;}};
}
test('library preserves duplicate playlist entries, unique entry IDs and explicit ordering',async()=>{
  const {library,repository}=setup();await library.restore();const id=await library.createPlaylist('Fixture',[track,track]);
  const initial=library.getSnapshot().playlists[0]!.entries;assert.notEqual(initial[0]!.id,initial[1]!.id);
  await library.moveEntry(id,initial[1]!.id,0);assert.equal(library.getSnapshot().playlists[0]!.entries[0]!.id,initial[1]!.id);
  const restored=new LibraryStore(repository,()=> 'unused');await restored.restore();assert.equal(restored.getSnapshot().playlists[0]!.entries[0]!.track.origin.id,'90071992547409931234');
});
test('favorites are identity-based and concurrent mutations cannot overwrite each other',async()=>{
  const {library}=setup();const other={...track,origin:{kind:'online' as const,platform:'tx' as const,id:track.origin.id}};
  await Promise.all([library.favorite(track),library.favorite(other)]);assert.equal(library.getSnapshot().favorites.length,2);
  await library.favorite(track);assert.equal(library.getSnapshot().favorites.length,1);
});
test('failed library persistence leaves the visible and stored old library intact',async()=>{
  const {library,fail}=setup();await library.favorite(track);const old=library.getSnapshot();fail();
  await assert.rejects(library.createPlaylist('Fixture'));assert.equal(library.getSnapshot(),old);
});
test('backup versions are checked and authentication metadata is excluded',async()=>{
  const {library}=setup();await library.favorite({...track,metadata:{...track.metadata,password:'private',token:'private',link:'https://example.test/audio?t=private',albumId:'keep'}});
  const encoded=encodeBackup(library.getSnapshot(),new Date(0));assert.ok(!encoded.includes('private'));
  const backup=decodeBackup(encoded);assert.equal(backup.library.favorites[0]!.metadata.albumId,'keep');
  assert.throws(()=>decodeBackup(encoded.replace('"version": 1','"version": 99')));
});
test('queue recovery preserves FIFO insertion order and rejects corrupted entry references',()=>{
  const queue=enqueueNext(makeQueue([entry('a'),entry('b')]),entry('next'));
  assert.deepEqual(decodeQueue({version:1,queue}),queue);
  assert.throws(()=>decodeQueue({version:1,queue:{...queue,currentId:'missing'}}));
  assert.throws(()=>decodeQueue({version:1,queue:{...queue,priorityIds:['b','next']}}));
});

test('bulk removal is one atomic library update and preserves duplicate entries not selected',async()=>{
  const {library}=setup();const id=await library.createPlaylist('Fixture',[track,track,{...track,origin:{...track.origin,id:'2'}}]);
  const first=library.getSnapshot().playlists[0]!.entries[0]!.id;
  await library.removeEntries(id,[first]);assert.equal(library.getSnapshot().playlists[0]!.entries.length,2);assert.equal(library.getSnapshot().playlists[0]!.entries[0]!.track.origin.id,track.origin.id);
});
