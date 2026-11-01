import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PublicComments} from '../src/providers/comments.ts';
import type {Track} from '../src/domain/track.ts';
import {deferred} from './fixtures.ts';
const song:Track={origin:{kind:'online',platform:'tx',id:'001yhApD1cXC5w'},title:'Public song',artist:'Public artist',metadata:{id:'9068436',url:'https://private.invalid/?token=marker',headers:{Cookie:'marker'}},qualities:[]};
const entry=(commentid='1!thread-A*',rootcommentid=commentid)=>({commentid,rootcommentid,rootcommentcontent:'Root\\ntext [em]e400823[/em]',rootcommentnick:'Original',nick:'Latest',time:1700000000,praisenum:3,avatarurl:'http://y.gtimg.cn/music/photo/avatar.jpg?sign=private',Location:'广东'});
const response=(rows:unknown[]=[entry()],total=41)=>({code:0,topid:9068436,comment:{commenttotal:total,commentlist:rows},hot_comment:{commenttotal:1,commentlist:[entry('1!hot')]}});
const signal=()=>new AbortController().signal;
test('QQ comments use numeric song identity anonymously, preserve opaque IDs and attribute replies separately',async()=>{
 const before=structuredClone(song);let calls=0;
 const reader=new PublicComments(async(url,request)=>{calls++;assert.equal(url,'https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg');assert.equal(request.credentials,'omit');assert.ok(!JSON.stringify(request).includes('marker'));const p=new URLSearchParams(request.body);assert.equal(p.get('topid'),'9068436');assert.equal(p.get('uin'),'0');assert.equal(p.get('pagenum'),'0');return response([{...entry('1!reply','1!root'),middlecommentcontent:[{subcommentid:'1!reply',subcommentcontent:'Reply',replynick:'@Responder',avatarurl:'https://y.gtimg.cn/music/photo/reply.jpg',location:'上海'}]}]);});
 const page=await reader.page(song,0,signal());assert.equal(calls,1);assert.equal(page.items[0]!.id,'tx:1!root:1!reply');assert.equal(page.items[0]!.content,'Reply');assert.equal(page.items[0]!.userName,'Responder');assert.equal(page.items[0]!.avatar,'https://y.gtimg.cn/music/photo/reply.jpg');assert.equal(page.items[0]!.region,'上海');assert.equal(page.items[0]!.reply!.userName,'Original');assert.equal(page.items[0]!.reply!.content,'Root\ntext [表情]');assert.equal(page.items[0]!.time,1700000000000);assert.equal(page.hot.length,1);assert.equal(page.hasMore,true);assert.deepEqual(song,before);
});
test('QQ partial pages advance by page size, deduplicate rows and omit repeated hot sections',async()=>{
 const reader=new PublicComments(async(_url,request)=>{assert.equal(new URLSearchParams(request.body).get('pagenum'),'1');return response([entry(),entry()],41);});
 const page=await reader.page(song,20,signal());assert.equal(page.items.length,1);assert.equal(page.nextOffset,40);assert.equal(page.hasMore,true);assert.deepEqual(page.hot,[]);
});
test('QQ resolves missing numeric IDs by bound public song detail, caches only identity and leaves the track unchanged',async()=>{
 const input={...song,metadata:{songmid:'different-mid'}},before=structuredClone(input);let lookups=0,comments=0;
 const reader=new PublicComments(async(url,request)=>{if(url.includes('musicu.fcg')){lookups++;assert.equal(request.credentials,'omit');assert.equal(JSON.parse(request.body!).req.param.song_mid,song.origin.id);return {code:0,req:{code:0,data:{track_info:{id:9068436,mid:song.origin.id}}}};}comments++;return response();});
 await reader.page(input,0,signal());await reader.page(input,20,signal());assert.equal(lookups,1);assert.equal(comments,2);assert.deepEqual(input,before);
});
test('QQ rejects mismatched detail before fetching another song comments',async()=>{
 let calls=0;const reader=new PublicComments(async()=>{calls++;return {code:0,req:{code:0,data:{track_info:{id:9068436,mid:'another-mid'}}}};});
 await assert.rejects(reader.page({...song,metadata:{}},0,signal()));assert.equal(calls,1);
});
test('QQ errors and malformed pages are not converted to empty comments',async()=>{
 const invalid=[{...response(),code:1},{...response(),topid:2},{...response(),comment:{commentlist:[],commenttotal:-1}},{...response(),comment:{commentlist:Array(21).fill(entry()),commenttotal:50}},{...response(),hot_comment:{commentlist:'bad'}},{...response(),comment:{commentlist:[{}],commenttotal:1}},{...response(),comment:{commentlist:[entry()],commenttotal:0}}];
 for(const raw of invalid)await assert.rejects(new PublicComments(async()=>raw).page(song,0,signal()));
 const empty=await new PublicComments(async()=>response([],0)).page(song,0,signal());assert.equal(empty.items.length,0);assert.equal(empty.hasMore,false);
});
test('QQ cancellation during detail lookup cannot fetch comments or cache a late detail response',async()=>{
 const late=deferred<unknown>();let calls=0;const reader=new PublicComments(async()=>{calls++;return calls===1?late.promise:Promise.reject(Error('lookup expected again'));}),abort=new AbortController(),input={...song,metadata:{}};
 const pending=reader.page(input,0,abort.signal);await new Promise(resolve=>setImmediate(resolve));abort.abort();await assert.rejects(pending);late.resolve({code:0,req:{code:0,data:{track_info:{id:9068436,mid:song.origin.id}}}});await new Promise(resolve=>setImmediate(resolve));await assert.rejects(reader.page(input,0,signal()));assert.equal(calls,2);
});
test('QQ blocks private origins, route injection and invalid cursors before issuing requests',async()=>{
 let calls=0;const reader=new PublicComments(async()=>{calls++;return response();});
 for(const input of [{...song,origin:{kind:'local' as const,id:song.origin.id}},{...song,origin:{...song.origin,id:'../private?token=marker'}}]){assert.equal(reader.supports(input),false);await assert.rejects(reader.page(input,0,signal()));}
 for(const offset of [-1,1,1.5,100020])await assert.rejects(reader.page(song,offset,signal()));assert.equal(calls,0);
});
test('QQ retains a surviving reply to a removed root and omits unbound root time and likes',async()=>{
 const reader=new PublicComments(async()=>response([{...entry('1!reply','1!root'),rootcommentcontent:'',middlecommentcontent:[{subcommentid:'1!reply',subcommentcontent:'Surviving reply',replynick:'Reply author'}]},{...entry('1!unmatched','1!root'),rootcommentnick:''}],2));
 const page=await reader.page(song,0,signal());assert.equal(page.items[0]!.content,'Surviving reply');assert.equal(page.items[0]!.reply,undefined);assert.equal(page.items[1]!.userName,'匿名用户');assert.equal(page.items[1]!.time,undefined);assert.equal(page.items[1]!.likes,undefined);
});

test('QQ reply identity never inherits root avatar or location',async()=>{
 const reader=new PublicComments(async()=>response([{...entry('1!reply','1!root'),middlecommentcontent:[{subcommentid:'1!reply',subcommentcontent:'Reply',replynick:'Responder'}]}]));
 const page=await reader.page(song,0,signal());assert.equal(page.items[0]!.userName,'Responder');assert.equal(page.items[0]!.avatar,undefined);assert.equal(page.items[0]!.region,undefined);
});
