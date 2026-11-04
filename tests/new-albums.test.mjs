import test from 'node:test';
import assert from 'node:assert/strict';
import {AlbumProvider} from '../src/providers/albums.ts';
import {classifyDiscoveryFailure} from '../src/providers/discoveryFailure.ts';
const signal=()=>new AbortController().signal;
const album=id=>({id,name:`Album ${id}`,artist:{name:'Artist'},picUrl:'http://example.com/a.jpg',publishTime:1793721600000,size:2,paid:true});
const provider=http=>new AlbumProvider({http,md5:async()=>'',sha1:async()=>'',deviceId:()=>{throw Error('No identity needed');}});
test('new albums uses anonymous official offsets, sanitized metadata and catalog total',async()=>{
 const calls=[];const p=provider(async(url,request)=>{calls.push({url,request});return{code:200,total:3,albums:calls.length===1?[album('1'),album('2')]:[album('3')]};});
 const a=await p.newNetease(1,signal(),2),b=await p.newNetease(2,signal(),2);
 assert.deepEqual(a.items[0],{id:'1',title:'Album 1',author:'Artist',artwork:'https://example.com/a.jpg',released:'2026-11-04',count:2});
 assert.equal(a.hasMore,true);assert.equal(b.hasMore,false);assert.equal(b.total,3);
 assert.equal(calls[0].request.credentials,'omit');assert.equal(calls[0].request.headers.Cookie,undefined);
 const u=new URL(calls[1].url);assert.equal(u.origin+u.pathname,'https://music.163.com/api/album/new');assert.equal(u.searchParams.get('offset'),'2');assert.equal(u.searchParams.get('area'),'ALL');
});
test('new albums accepts empty terminal directory and full terminal page',async()=>{
 assert.deepEqual((await provider(async()=>({code:200,total:0,albums:[]})).newNetease(1,signal())).items,[]);
 assert.equal((await provider(async()=>({code:200,total:1,albums:[album('1')]})).newNetease(1,signal(),1)).hasMore,false);
});
test('new albums rejects missing totals, nonprogress, duplicate identity and malformed metadata',async()=>{
 for(const raw of [{code:500,total:0,albums:[]},{code:200,albums:[]},{code:200,total:-1,albums:[]},{code:200,total:2,albums:[]},{code:200,total:2,albums:[album('1')]},{code:200,total:2,albums:[album('1'),album('1')]},{code:200,total:1,albums:[album('bad/id')]},{code:200,total:1,albums:[{...album('1'),name:''}]},{code:200,total:1,albums:[{...album('1'),size:-1}]}]) await assert.rejects(provider(async()=>raw).newNetease(1,signal(),2));
});
test('new albums validates paging and cancellation before and after HTTP',async()=>{
 let calls=0;const p=provider(async()=>{calls++;return{};});
 for(const [page,limit] of [[0,30],[1.5,30],[10001,30],[1,0],[1,101]])await assert.rejects(p.newNetease(page,signal(),limit));
 const abort=new AbortController();abort.abort();await assert.rejects(p.newNetease(1,abort.signal));assert.equal(calls,0);
 const pendingAbort=new AbortController();let release;const pending=provider(()=>new Promise(r=>{release=r;})).newNetease(1,pendingAbort.signal);pendingAbort.abort();release({code:200,total:0,albums:[]});await assert.rejects(pending,/取消/);
});
test('new album catalog exposes only exact actionable safe errors',()=>{
 const message='新碟目录发生变化，请刷新后重试';assert.equal(classifyDiscoveryFailure(Error(message)).message,message);assert.equal(classifyDiscoveryFailure(Error(message+' token')).kind,'unknown');
});

test('ordinary album detail preserves official availability rejection as actionable safe text',async()=>{
 const p=provider(async()=>({code:-462}));
 await assert.rejects(p.detail('wy',{id:'1',title:'Public album'},1,signal()),error=>{
   assert.deepEqual(classifyDiscoveryFailure(error),{kind:'rejected',message:'此专辑暂不可公开读取，请到官方平台确认可用性',retryable:true});return true;
 });
 assert.equal(classifyDiscoveryFailure(Error('此专辑暂不可公开读取，请到官方平台确认可用性 https://private.invalid')).kind,'unknown');
});
