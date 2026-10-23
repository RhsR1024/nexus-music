import test from 'node:test';
import assert from 'node:assert/strict';
import {append,emptyQueue,makeQueue,type QueueState} from '../src/domain/queue.ts';
import type {Track} from '../src/domain/track.ts';
import {onlineTrack} from '../src/providers/online.ts';
import {AccountFmError} from '../src/providers/accountFm.ts';
import {AccountFmStation,type FmPlayback,type FmPlaybackState} from '../src/playback/accountFmStation.ts';
import type {MusicAccount} from '../src/providers/musicAccounts.ts';

const account=(overrides:Partial<MusicAccount>={}):MusicAccount=>({id:'a'.repeat(64),platform:'wy',label:'网易云',username:'u',capabilities:['fm'],updatedAt:1,...overrides});
const session=(value:MusicAccount=account()) => ({accountId:value.id,platform:value.platform,cookies:{MUSIC_U:'synthetic'}});
const track=(id:string):Track=>onlineTrack('wy',{id,name:`Synthetic FM ${id}`,artists:[{name:'Fixture'}],album:{name:'Fixture album'},duration:1000});
const batch=(ids:string[])=>ids.map(track);
const ids=(queue:QueueState)=>queue.entries.map(entry=>entry.track.origin.id);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:unknown)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}

class FakePlayback implements FmPlayback {
  queue:QueueState=emptyQueue;
  private listeners=new Set<()=>void>();
  getSnapshot=():FmPlaybackState=>({queue:this.queue});
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  play=async(queue:QueueState)=>{this.queue=queue;this.emit();};
  setQueue=(queue:QueueState)=>{this.queue=queue;this.emit();};
  emit(){for(const listener of [...this.listeners])listener();}
  select(id:string){this.queue={...this.queue,currentId:id};this.emit();}
}

test('FM station appends a deduplicated batch at low watermark without replacing the user queue',async()=>{
  const playback=new FakePlayback(),a=account();let calls=0;const forced:boolean[]=[];
  const station=new AccountFmStation({accounts:{getSnapshot:()=>[a]},playback,uuid:(()=>{let id=0;return()=>`entry-${++id}`;})(),now:()=>1000,
    client:{load:async(_account,_session,_signal,force)=>{calls++;forced.push(force===true);return batch(['c','d','d','e']);}}});
  assert.deepEqual((await station.start(a,session(a),batch(['a','b','c']))).map(item=>item.origin.id),['a','b','c']);
  assert.equal(calls,0);
  assert.deepEqual(ids(playback.queue),['a','b','c']);
  playback.select(playback.queue.entries[1]!.id);
  await tick();
  assert.equal(calls,1);assert.deepEqual(forced,[true]);
  assert.deepEqual(ids(playback.queue),['a','b','c','d','e']);
  assert.equal(playback.queue.currentId,playback.queue.entries[1]!.id);
  assert.equal(new Set(playback.queue.entries.map(entry=>entry.id)).size,5);
  playback.emit();await tick();assert.equal(calls,1);
});

test('FM station keeps one prefetch in flight and marks an all-duplicate batch exhausted',async()=>{
  const playback=new FakePlayback(),a=account(),first=deferred<readonly Track[]>();let calls=0;
  const station=new AccountFmStation({accounts:{getSnapshot:()=>[a]},playback,uuid:(()=>{let id=0;return()=>`entry-${++id}`;})(),client:{load:async()=>{calls++;return calls===1?first.promise:[];}}});
  await station.start(a,session(a),batch(['a','b','c']));
  playback.select(playback.queue.entries[1]!.id);
  playback.emit();playback.emit();
  assert.equal(calls,1);
  first.resolve(batch(['d','e']));
  await tick();
  assert.deepEqual(ids(playback.queue),['a','b','c','d','e']);
  playback.emit();await tick();assert.equal(calls,1);
  playback.select(playback.queue.entries[3]!.id);
  await tick();
  assert.equal(calls,2);
  playback.select(playback.queue.entries.at(-1)!.id);
  playback.emit();await tick();
  assert.equal(calls,2);
  assert.deepEqual(ids(playback.queue),['a','b','c','d','e']);
});

test('FM station discards an in-flight batch after account replacement and refuses the stale account',async()=>{
  const playback=new FakePlayback(),a=account(),pending=deferred<readonly Track[]>();const snapshot=[a];
  const station=new AccountFmStation({accounts:{getSnapshot:()=>snapshot},playback,uuid:(()=>{let id=0;return()=>`entry-${++id}`;})(),client:{load:()=>pending.promise}});
  await station.start(a,session(a),batch(['a','b','c']));
  playback.select(playback.queue.entries[1]!.id);
  snapshot[0]={...a,updatedAt:2};
  pending.resolve(batch(['d']));
  await tick();
  assert.deepEqual(ids(playback.queue),['a','b','c']);
  await assert.rejects(station.start(a,session(a),batch(['x'])),(error:unknown)=>error instanceof AccountFmError&&error.kind==='account_changed');
  assert.deepEqual(ids(playback.queue),['a','b','c']);
});

test('FM station stops when the user replaces or extends the queue',async()=>{
  const playback=new FakePlayback(),a=account();let calls=0;
  const station=new AccountFmStation({accounts:{getSnapshot:()=>[a]},playback,uuid:(()=>{let id=0;return()=>`entry-${++id}`;})(),client:{load:async()=>{calls++;return batch(['d']);}}});
  await station.start(a,session(a),batch(['a','b','c']));
  playback.setQueue(append(playback.queue,{id:'user-entry',track:track('x')}));
  await tick();
  playback.select(playback.queue.entries.at(-1)!.id);
  playback.emit();await tick();
  assert.equal(calls,0);
  assert.deepEqual(ids(playback.queue),['a','b','c','x']);
});

test('FM station keeps the queue on a failed prefetch and retries after the bounded delay',async()=>{
  const playback=new FakePlayback(),a=account();let calls=0,now=1000;
  const station=new AccountFmStation({accounts:{getSnapshot:()=>[a]},playback,uuid:(()=>{let id=0;return()=>`entry-${++id}`;})(),now:()=>now,retryDelay:60_000,
    client:{load:async()=>{calls++;if(calls===1)throw new Error('network');return batch(['d']);}}});
  await station.start(a,session(a),batch(['a','b','c']));
  playback.select(playback.queue.entries[1]!.id);
  await tick();
  assert.equal(calls,1);assert.deepEqual(ids(playback.queue),['a','b','c']);
  playback.emit();await tick();
  assert.equal(calls,1);
  now=62_000;playback.emit();await tick();
  assert.equal(calls,2);assert.deepEqual(ids(playback.queue),['a','b','c','d']);
});

test('FM station loads its own first batch and leaves playback untouched for empty or mismatched starts',async()=>{
  const playback=new FakePlayback(),a=account();let calls=0;const forced:boolean[]=[];
  const station=new AccountFmStation({accounts:{getSnapshot:()=>[a]},playback,uuid:(()=>{let id=0;return()=>`entry-${++id}`;})(),
    client:{load:async(_account,_session,_signal,force)=>{calls++;forced.push(force===true);return calls===1?batch(['a','b','c']):[];}}});
  await station.start(a,session(a));
  assert.deepEqual(ids(playback.queue),['a','b','c']);assert.deepEqual(forced,[true]);
  const current=playback.queue.currentId;
  assert.deepEqual(await station.start(a,session(a)),[]);
  assert.equal(playback.queue.currentId,current);assert.deepEqual(ids(playback.queue),['a','b','c']);
  await assert.rejects(station.start(a,{accountId:'b'.repeat(64),platform:'wy'},batch(['x'])),(error:unknown)=>error instanceof AccountFmError&&error.kind==='account_changed');
  assert.equal(calls,2);
});

test('FM station stop cancels an in-flight prefetch without publishing it',async()=>{
  const playback=new FakePlayback(),a=account(),pending=deferred<readonly Track[]>();let calls=0;
  const station=new AccountFmStation({accounts:{getSnapshot:()=>[a]},playback,uuid:(()=>{let id=0;return()=>`entry-${++id}`;})(),client:{load:()=>{calls++;return pending.promise;}}});
  await station.start(a,session(a),batch(['a','b','c']));
  playback.select(playback.queue.entries[1]!.id);
  station.stop();pending.resolve(batch(['d']));await tick();
  assert.equal(calls,1);assert.deepEqual(ids(playback.queue),['a','b','c']);
  playback.emit();await tick();assert.equal(calls,1);
});
