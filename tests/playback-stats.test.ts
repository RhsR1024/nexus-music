import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PlaybackStatsStore,cleanPlaybackStats,validatePlaybackStats} from '../src/storage/playbackStats.ts';
import type {Repository} from '../src/storage/repository.ts';
import {track} from './fixtures.ts';
import {MutationQueue} from '../src/storage/mutations.ts';
import {LibraryStore,emptyLibrary} from '../src/storage/library.ts';
import {decodeBackup,encodeBackup} from '../src/storage/backup.ts';
function setup(){let saved:unknown,fail=false;const repository:Pick<Repository,'get'|'put'>={get:async<T>()=>saved as T|undefined,put:async(_,value)=>{if(fail)throw Error('disk full');saved=JSON.parse(JSON.stringify(value));}};const stats=new PlaybackStatsStore(repository,()=>1000);return{stats,repository,setFail:(value:boolean)=>{fail=value;}};}
test('native cumulative statistics serialize concurrent samples and ignore duplicates or out of order values',async()=>{
 const {stats}=setup();const record=(ms:number)=>stats.record({track,session:'native-session',listenedMs:ms});
 await Promise.all([record(0),record(500),record(1000),record(500),record(1000),record(1500)]);
 assert.equal(stats.getSnapshot().items[0]!.playCount,1);assert.equal(stats.getSnapshot().items[0]!.listenedMs,1500);
 // Pausing/resuming or seeking does not create a session or alter the cumulative native clock.
 await record(1500);await record(2000);assert.equal(stats.getSnapshot().items[0]!.playCount,1);assert.equal(stats.getSnapshot().items[0]!.listenedMs,2000);
 await stats.record({track,session:'next-start',listenedMs:250});assert.equal(stats.getSnapshot().items[0]!.playCount,2);assert.equal(stats.getSnapshot().items[0]!.listenedMs,2250);
});
test('statistics preserve origin identity, sanitize credentials and survive reopen',async()=>{
 const {stats,repository}=setup();const other={...track,origin:{kind:'online' as const,platform:'tx' as const,id:track.origin.id},metadata:{password:'private',link:'file:///private/path'}};
 await stats.record({track,session:'a',listenedMs:100});await stats.record({track:other,session:'b',listenedMs:200});
 await assert.rejects(stats.record({track:other,session:'a',listenedMs:300}));
 const restored=new PlaybackStatsStore(repository);await restored.restore();assert.equal(restored.getSnapshot().items.length,2);assert.ok(!JSON.stringify(cleanPlaybackStats(restored.getSnapshot())).includes('private'));
});
test('failed persistence keeps counters and watermarks retryable without poisoning subsequent mutations',async()=>{
 const {stats,setFail}=setup();await stats.record({track,session:'a',listenedMs:500});setFail(true);await assert.rejects(stats.record({track,session:'a',listenedMs:1500}));assert.equal(stats.getSnapshot().items[0]!.listenedMs,500);
 setFail(false);await stats.record({track,session:'a',listenedMs:1500});assert.equal(stats.getSnapshot().items[0]!.listenedMs,1500);assert.equal(stats.getSnapshot().items[0]!.playCount,1);
 await stats.clear();assert.equal(stats.getSnapshot().items.length,0);await stats.record({track,session:'a',listenedMs:2000});assert.equal(stats.getSnapshot().items[0]!.listenedMs,500);
});
test('statistics validation rejects malformed totals and incompatible versions',()=>{
 for(const value of [null,{version:2,items:[]},{version:1,items:[{track,playCount:1,listenedMs:-1,firstPlayedAt:0,lastPlayedAt:1}]}])assert.throws(()=>validatePlaybackStats(value));
});
test('backup restores old files without statistics and filters private paths from new statistics',()=>{
 const privateTrack={...track,metadata:{password:'private-secret',url:'file:///private/path'}};
 const state={version:1 as const,items:[{track:privateTrack,playCount:1,listenedMs:500,firstPlayedAt:1,lastPlayedAt:1,password:"private-extra"}]};
 const text=encodeBackup(emptyLibrary,new Date(0),state);assert.ok(!text.includes('private'));assert.equal(decodeBackup(text).statistics!.items[0]!.listenedMs,500);
 const old=JSON.parse(text);delete old.statistics;assert.deepEqual(decodeBackup(JSON.stringify(old)).statistics,{version:1,items:[]});
});
test('shared mutation queue orders restore with concurrent history and listening writes, preserving native watermark',async()=>{
 const queue=new MutationQueue(),records=new Map<string,unknown>();let release!:()=>void;
 const barrier=new Promise<void>(resolve=>{release=resolve;});
 const repository={get:async<T>(key:string)=>records.get(key) as T|undefined,put:async(key:string,value:unknown)=>{records.set(key,value);}};
 const stats=new PlaybackStatsStore(repository,()=>1000,queue),library=new LibraryStore(repository,()=> 'playlist',()=>1000,queue);
 await stats.record({track,session:'a',listenedMs:500});
 const restoring=queue.run(async()=>{await barrier;records.set('library.v1',emptyLibrary);records.set('playbackStats.v1',{version:1,items:[]});await Promise.all([library.restore(),stats.restore(true)]);});
 const heard=stats.record({track,session:'a',listenedMs:750}),history=library.played(track);
 release();await Promise.all([restoring,heard,history]);
 assert.equal(stats.getSnapshot().items[0]!.listenedMs,250);assert.equal(library.getSnapshot().history.length,1);
 assert.equal((records.get('playbackStats.v1') as any).items[0].listenedMs,250);
});
