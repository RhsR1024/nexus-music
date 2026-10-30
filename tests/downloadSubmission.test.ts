import test from 'node:test';
import assert from 'node:assert/strict';
import {createDownloadSubmission,downloadableTrack} from '../src/app/downloadSubmission.ts';
import type {Track} from '../src/domain/track.ts';
import type {OfflineDownloadRecord,OfflineDownloadStatus} from '../src/storage/offlineDownloads.ts';
const song=(id:string):Track=>({origin:{kind:'online',platform:'wy',id},title:'Public '+id,artist:'Public Artist',metadata:{},qualities:[]});
const record=(track:Track,status:OfflineDownloadStatus='queued'):OfflineDownloadRecord=>({id:track.origin.id,fileName:'aaaaaaaa.audio',track,status,bytes:0,updatedAt:1});
test('new foreground download commands schedule their owner without waiting for the transfer',async()=>{
 const started:string[]=[];
 const submit=createDownloadSubmission({enqueue:async t=>record(t),start:async id=>{started.push(id);await new Promise(()=>{});}});
 const result=await submit([song('1'),song('2')]);await Promise.resolve();assert.deepEqual(started,['1','2']);assert.deepEqual(result.entries.map(e=>e.disposition),['submitted','submitted']);
});
test('a task cannot start before its record is actually committed',async()=>{
 let commit:(r:OfflineDownloadRecord)=>void=()=>{};const started:string[]=[];
 const submit=createDownloadSubmission({enqueue:async()=>new Promise(r=>{commit=r;}),start:async id=>{started.push(id);}});
 const pending=submit([song('1')]);assert.deepEqual(started,[]);commit(record(song('1')));await pending;await Promise.resolve();assert.deepEqual(started,['1']);
});
test('paused, failed, cancelled and saved existing tasks keep their explicit intent',async()=>{
 const states:OfflineDownloadStatus[]=['paused','failed','cancelled','completed','downloading'],started:string[]=[];
 const submit=createDownloadSubmission({enqueue:async t=>record(t,states[Number(t.origin.id)]!),start:async id=>{started.push(id);}});
 const result=await submit(states.map((_,i)=>song(String(i))));assert.deepEqual(started,[]);assert.deepEqual(result.entries.map(e=>e.disposition),['existing','existing','existing','existing','submitted']);
});
test('one failed submission does not drop later songs or leak an upstream/storage message',async()=>{
 const started:string[]=[];const submit=createDownloadSubmission({enqueue:async t=>{if(t.origin.id==='bad')throw Error('private path /Users/person');return record(t);},start:async id=>{started.push(id);}});
 const result=await submit([song('1'),song('bad'),song('2')]);await Promise.resolve();assert.deepEqual(started,['1','2']);assert.equal(result.entries.length,3);assert.equal(result.entries[1]!.disposition,'failed');assert.equal(result.entries[1]!.reason?.includes('private'),false);
});
test('duplicate rows remain individually accounted for while scheduling one canonical task',async()=>{
 const started:string[]=[];const submit=createDownloadSubmission({enqueue:async t=>record(t),start:async id=>{started.push(id);}});
 const result=await submit([song('1'),song('1')]);await Promise.resolve();assert.equal(result.entries.length,2);assert.equal(new Set(result.entries.map(e=>e.id)).size,1);assert.deepEqual(started,['1']);
});
test('local files and device media do not acquire fake download tasks; transfer rejection is not acceptance failure',async()=>{
 const local:Track={...song('local'),origin:{kind:'local',id:'local'}},device:Track={...song('device'),origin:{kind:'device',libraryId:'public-test',id:'device'}};
 let enqueued=0;const submit=createDownloadSubmission({enqueue:async t=>{enqueued++;return record(t);},start:async()=>{throw Error('transport failed');}});
 assert.equal(downloadableTrack(local),false);const result=await submit([local,device,song('1')]);await Promise.resolve();await Promise.resolve();assert.equal(enqueued,1);assert.deepEqual(result.entries.map(e=>e.disposition),['failed','failed','submitted']);
});
