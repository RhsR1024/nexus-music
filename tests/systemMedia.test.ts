import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SystemMediaSession} from '../src/playback/systemMedia.ts';
import {LibraryStore} from '../src/storage/library.ts';
import {MutationQueue} from '../src/storage/mutations.ts';
import {track,deferred} from './fixtures.ts';
import type {Track} from '../src/domain/track.ts';
const other:Track={...track,origin:{kind:'online',platform:'tx',id:'matched'},title:'Actual recording'};
const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
function setup(){
  let failed=false;
  const mutations=new MutationQueue();
  const library=new LibraryStore({get:async()=>undefined,put:async()=>{if(failed)throw new Error('fixture');}},()=> 'uuid',Date.now,mutations);
  const artwork:{file:string;id:string}[]=[],favorites:{favorite:boolean;id:string}[]=[],covers:{track:Track;signal:AbortSignal;pending:ReturnType<typeof deferred<string|undefined>>}[]=[];
  const session=new SystemMediaSession({setSystemArtwork:async(file,id)=>{artwork.push({file,id});},setSystemFavorite:async(favorite,id)=>{favorites.push({favorite,id});}},{loadTrack:async(track,signal)=>{const pending=deferred<string|undefined>();covers.push({track,signal,pending});return pending.promise;}},library);
  return{session,library,artwork,favorites,covers,mutations,fail:()=>{failed=true;}};
}
test('system media displays the matched recording but favorites the original identity',async()=>{
  const f=setup();f.session.load(track,other,'a',Promise.resolve());await flush();
  assert.equal(f.covers[0]!.track,other);f.covers[0]!.pending.resolve('file:///fixture.jpg');await flush();
  assert.deepEqual(f.artwork,[{file:'file:///fixture.jpg',id:'a'}]);
  await f.session.favorite({itemID:'a',favorite:true});assert.equal(f.library.isFavorite(track),true);assert.equal(f.library.isFavorite(other),false);
  assert.deepEqual(f.favorites.at(-1),{favorite:true,id:'a'});f.session.dispose();
});
test('late artwork and unresolved native load cannot publish over a newer media item',async()=>{
  const f=setup();f.session.load(track,track,'a',Promise.resolve());await flush();
  f.session.load(other,other,'b',Promise.resolve());await flush();assert.equal(f.covers[0]!.signal.aborted,true);
  f.covers[0]!.pending.resolve('file:///wrong.jpg');f.covers[1]!.pending.resolve('file:///right.jpg');await flush();
  assert.deepEqual(f.artwork,[{file:'file:///right.jpg',id:'b'}]);
  const late=deferred<void>();f.session.load(track,track,'c',late.promise);f.session.clear();late.resolve();await flush();assert.equal(f.covers.length,2);f.session.dispose();
});
test('no artwork and cover failure keep media commands and favorites working',async()=>{
  const f=setup();f.session.load(track,track,'a',Promise.resolve());await flush();f.covers[0]!.pending.reject(new Error('offline'));await flush();
  await f.session.favorite({itemID:'a',favorite:true});assert.equal(f.library.isFavorite(track),true);assert.equal(f.artwork.length,0);
  f.session.load(other,other,'b',Promise.resolve());await flush();f.covers[1]!.pending.resolve(undefined);await flush();assert.equal(f.artwork.length,0);f.session.dispose();
});
test('feedback uses desired state, duplicates do not toggle and external changes refresh it',async()=>{
  const f=setup();f.session.load(track,track,'a',Promise.resolve());await flush();
  await Promise.all([f.session.favorite({itemID:'a',favorite:true}),f.session.favorite({itemID:'a',favorite:true})]);
  assert.equal(f.library.getSnapshot().favorites.length,1);
  await f.library.favorite(track);assert.deepEqual(f.favorites.at(-1),{favorite:false,id:'a'});
  await Promise.all([f.session.favorite({itemID:'a',favorite:false}),f.session.favorite({itemID:'a',favorite:false})]);assert.equal(f.library.isFavorite(track),false);f.session.dispose();
});
test('feedback waiting behind other mutations is rejected after switching songs',async()=>{
  const f=setup(),gate=deferred<void>();f.session.load(track,track,'a',Promise.resolve());await flush();
  const hold=f.mutations.run(()=>gate.promise);const request=f.session.favorite({itemID:'a',favorite:true});
  f.session.load(other,other,'b',Promise.resolve());await flush();gate.resolve();await hold;await assert.rejects(request);
  assert.equal(f.library.getSnapshot().favorites.length,0);
  await f.session.favorite({itemID:'a',favorite:true});assert.equal(f.library.getSnapshot().favorites.length,0);f.session.dispose();
});
test('failed persistence restores actual command state and malformed or stopped feedback is ignored',async()=>{
  const f=setup();f.session.load(track,track,'a',Promise.resolve());await flush();f.fail();
  await assert.rejects(f.session.favorite({itemID:'a',favorite:true}));assert.equal(f.library.isFavorite(track),false);assert.deepEqual(f.favorites.at(-1),{favorite:false,id:'a'});
  await f.session.favorite({itemID:'a',favorite:'true'});f.session.clear();await f.session.favorite({itemID:'a',favorite:true});assert.equal(f.library.isFavorite(track),false);f.session.dispose();
});
test('feedback and artwork cannot start before the native media item has loaded',async()=>{
  const f=setup(),loaded=deferred<void>();f.session.load(track,track,'a',loaded.promise);
  await f.session.favorite({itemID:'a',favorite:true});assert.equal(f.covers.length,0);assert.equal(f.favorites.length,0);
  loaded.resolve();await flush();assert.equal(f.covers.length,1);assert.deepEqual(f.favorites.at(-1),{favorite:false,id:'a'});f.session.dispose();
});
