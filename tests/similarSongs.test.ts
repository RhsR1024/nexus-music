import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readSimilarSongs,supportsSimilarSongs} from '../src/providers/similarSongs.ts';
import {SimilarSongsSession} from '../src/app/similarSongs.ts';
import {onlineTrack} from '../src/providers/online.ts';
const song=(id:string)=>onlineTrack('wy',{id,name:`Song ${id}`,artists:[{name:'Public artist'}]});
const signal=()=>new AbortController().signal;
test('similar songs uses a credential-free bounded metadata request and canonical deduplication',async()=>{
 let calls=0;
 const result=await readSimilarSongs(song('1'),signal(),async(url,request)=>{calls++;assert.equal(url,'https://music.163.com/api/v1/discovery/simiSong');assert.equal(request.credentials,'omit');assert.equal(request.body,'songid=1&limit=50&offset=0');assert.equal(request.method,'POST');assert.equal(request.headers?.Cookie,undefined);return{code:200,songs:[{id:1,name:'Anchor'},{id:2,name:'Second'},{id:2,name:'Duplicate'},{id:'90071992547409931234',name:'Large'},{name:'Broken'}]};});
 assert.equal(calls,1);assert.deepEqual(result.map(x=>x.origin.id),['2','90071992547409931234']);assert.ok(!JSON.stringify(result).includes('mp3Url'));
});
test('unsupported identity and pre-cancelled reads never contact a platform or private client',async()=>{
 let calls=0;const http=async()=>{calls++;return{};};
 assert.equal(supportsSimilarSongs({...song('1'),origin:{kind:'online',platform:'tx',id:'1'}}),false);
 await assert.rejects(readSimilarSongs({...song('1'),origin:{kind:'online',platform:'tx',id:'1'}},signal(),http));
 await assert.rejects(readSimilarSongs({...song('1'),origin:{kind:'online',platform:'wy',id:'1&token=x'}},signal(),http));
 const abort=new AbortController();abort.abort();await assert.rejects(readSimilarSongs(song('1'),abort.signal,http));assert.equal(calls,0);
});
test('similar empty success differs from authorization, malformed and oversized responses',async()=>{
 assert.deepEqual(await readSimilarSongs(song('1'),signal(),async()=>({code:200,songs:[]})),[]);
 for(const raw of [{code:301,songs:[]},{code:200},{code:200,songs:[{}]},{code:200,songs:Array(201).fill({id:2,name:'Song'})}])await assert.rejects(readSimilarSongs(song('1'),signal(),async()=>raw));
});
test('similar session isolates a late response from the previous anchor',async()=>{
 const calls:{resolve:(items:readonly ReturnType<typeof song>[])=>void;signal:AbortSignal}[]=[];
 const session=new SimilarSongsSession((_track,signal)=>new Promise(resolve=>calls.push({resolve,signal})));
 const first=session.load(song('1'));const second=session.load(song('2'));assert.equal(calls[0]!.signal.aborted,true);
 calls[0]!.resolve([song('3')]);await first;assert.equal(session.getSnapshot().status,'loading');assert.equal(session.getSnapshot().anchor!.origin.id,'2');
 calls[1]!.resolve([song('4')]);await second;assert.equal(session.getSnapshot().items[0]!.origin.id,'4');
});
test('similar refresh preserves prior rows on failure and exposes only a safe retry message',async()=>{
 let count=0;const session=new SimilarSongsSession(async()=>{if(count++)throw new Error('https://private.invalid/?token=secret');return[song('2')];});
 await session.load(song('1'));await session.load(song('1'),true);assert.equal(session.getSnapshot().status,'error');assert.equal(session.getSnapshot().items[0]!.origin.id,'2');assert.ok(!JSON.stringify(session.getSnapshot()).includes('secret'));
});
test('similar cancellation prevents publication even when an underlying reader ignores abort',async()=>{
 let resolve!:(items:readonly ReturnType<typeof song>[])=>void;const session=new SimilarSongsSession(()=>new Promise(done=>{resolve=done;}));let published=0;const off=session.subscribe(()=>published++);
 const pending=session.load(song('1'));const before=session.getSnapshot();session.cancel();resolve([song('2')]);await pending;assert.equal(session.getSnapshot(),before);assert.equal(published,1);off();
});
test('refreshing a different anchor clears the previous result immediately',async()=>{
 const session=new SimilarSongsSession(async track=>track.origin.id==='1'?[song('2')]:[]);await session.load(song('1'));const pending=session.load(song('3'),true);assert.deepEqual(session.getSnapshot().items,[]);await pending;assert.equal(session.getSnapshot().status,'ready');
});
