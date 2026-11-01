import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PublicComments} from '../src/providers/comments.ts';
import type {Track} from '../src/domain/track.ts';
import {deferred} from './fixtures.ts';

const song:Track={origin:{kind:'online',platform:'tx',id:'001yhApD1cXC5w'},title:'Public song',artist:'Public artist',metadata:{id:'9068436',url:'https://private.invalid/?token=marker',headers:{Cookie:'marker'}},qualities:[]};
const rootID='1!root';
const rootRow=(id=rootID,extra={})=>({CmId:id,RootCmId:null,Content:'Root\\ntext [em]e400823[/em]',Nick:'Original',Avatar:'http://y.gtimg.cn/music/photo/avatar.jpg?sign=private',Location:'广东',PubTime:1700000000,PraiseNum:3,ReplyCnt:41,SeqNo:'100',...extra});
const list=(values:unknown[]=[rootRow()],total=41,more=1)=>({Total:total,HasMore:more,Comments:values,HotType:1,sortType:0});
const pageResponse=(latest=list(),hot=list([rootRow('1!hot',{ReplyCnt:0})],1,0),extra={})=>({code:0,req_0:{code:0,data:{SubCode:0,CommentList:latest,CommentList2:hot,CommentList3:list([],0,0),TotalVer:'v1',...extra}}});
const reply=(id='1!reply',extra={})=>({CmId:id,RootCmId:null,Content:`Reply ${id}`,Nick:'Responder',Avatar:'https://y.gtimg.cn/music/photo/reply.jpg',Location:'上海',PubTime:1700000100,PraiseNum:2,RankScore:'9',SeqNo:'201',RepliedComments:[{CmId:rootID,Nick:'Original',Content:'Quoted root'}],...extra});
const floor=(values:unknown[]=[reply()],total=values.length,more=false)=>({code:0,req_0:{code:0,data:{SubCode:0,CommentList:{Total:total,HasMore:more,Comments:values}}}});
const signal=()=>new AbortController().signal;
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('QQ roots use the anonymous modern public list with counts, identity, song binding and cursor state',async()=>{
 let calls=0;const before=structuredClone(song),reader=new PublicComments(async(url,request)=>{
  calls++;assert.equal(url,'https://u.y.qq.com/cgi-bin/musicu.fcg');assert.equal(request.credentials,'omit');assert.ok(!JSON.stringify(request).includes('marker'));
  const body=JSON.parse(request.body!);assert.equal(body.req_0.module,'music.globalComment.CommentRead');assert.equal(body.req_0.method,'GetNewCommentList');assert.equal(body.req_0.param.BizId,'9068436');assert.equal(body.req_0.param.WithHot,1);
  return pageResponse();
 });
 const page=await reader.page(song,0,signal()),root=page.items[0]!;
 assert.equal(calls,1);assert.equal(root.id,'tx:1!root:1!root');assert.equal(root.content,'Root\ntext [表情]');assert.equal(root.userName,'Original');assert.equal(root.replyCount,41);assert.equal(root.time,1700000000000);assert.equal(page.hot[0]!.id,'tx:1!hot:1!hot');assert.equal(page.total,41);assert.equal(reader.canExpand(song,root),true);assert.deepEqual(song,before);
});

test('QQ subsequent list pages reuse the returned service cursor and keep hot rows only on the first page',async()=>{
 const bodies:Array<Record<string,any>>=[];let pageNumber=0;
 const reader=new PublicComments(async(_url,request)=>{
  const body=JSON.parse(request.body!);bodies.push(body);
  if(body.req_0.param.PageNum===0)return pageResponse();
  assert.equal(body.req_0.param.LastCommentSeqNo,'100');assert.equal(body.req_0.param.LastTotal,41);assert.equal(body.req_0.param.LastTotalVer,'v1');assert.equal(body.req_0.param.WithHot,0);
  return pageResponse(list([rootRow('1!page2')],43,0),list([],0,0));
 });
 await reader.page(song,0,signal());const second=await reader.page(song,20,signal());pageNumber=2;
 assert.equal(pageNumber,2);assert.equal(bodies.length,2);assert.equal(second.items[0]!.id,'tx:1!page2:1!page2');assert.equal(second.hot.length,0);assert.equal(second.total,43);
});

test('QQ resolves missing numeric IDs by bound public song detail and caches only identity',async()=>{
 const input={...song,metadata:{songmid:'different-mid'}},before=structuredClone(input);let lookups=0,comments=0;
 const reader=new PublicComments(async(url,request)=>{
  if(url.includes('musicu.fcg')&&JSON.parse(request.body!).req?.module==='music.pf_song_detail_svr'){lookups++;assert.equal(JSON.parse(request.body!).req.param.song_mid,song.origin.id);return{code:0,req:{code:0,data:{track_info:{id:9068436,mid:song.origin.id}}}};}
  comments++;return pageResponse();
 });
 await reader.page(input,0,signal());await reader.page(input,20,signal());assert.equal(lookups,1);assert.equal(comments,2);assert.deepEqual(input,before);
});

test('QQ rejects mismatched detail, foreign cursors, malformed pages and response totals before use',async()=>{
 let calls=0,raw:unknown={code:0,req:{code:0,data:{track_info:{id:9068436,mid:'another-mid'}}}};
 await assert.rejects(new PublicComments(async()=>{calls++;return raw;}).page({...song,metadata:{}},0,signal()));assert.equal(calls,1);
 const initialized=new PublicComments(async()=>pageResponse());await initialized.page(song,0,signal());
 await assert.rejects(initialized.page(song,40,signal()));
 for(const invalid of [{...pageResponse(),code:1},{...pageResponse(),req_0:{code:1}},{...pageResponse(),req_0:{code:0,data:{SubCode:1,CommentList:list(),CommentList2:list([],0,0),TotalVer:'v1'}}},{...pageResponse(),req_0:{code:0,data:{SubCode:0,CommentList:{Total:41,HasMore:1,Comments:Array(21).fill(rootRow())},CommentList2:list([],0,0),TotalVer:'v1'}}},{...pageResponse(),req_0:{code:0,data:{SubCode:0,CommentList:{Total:1,HasMore:1,Comments:[{}]},CommentList2:list([],0,0),TotalVer:'v1'}}}])await assert.rejects(new PublicComments(async()=>invalid).page(song,0,signal()));
});

test('QQ only expands roots observed under the same original song',async()=>{
 const reader=new PublicComments(async()=>pageResponse()),root=(await reader.page(song,0,signal())).items[0]!;
 assert.equal(reader.canExpand({...song,origin:{...song.origin,id:'001yhApD1cXC5x'}},root),false);
 assert.equal(reader.canExpand(song,{...root,id:'tx:1!foreign:1!foreign'}),false);
 await assert.rejects(reader.replies({...song,origin:{...song.origin,id:'001yhApD1cXC5x'}},root,0,signal()));
 await assert.rejects(reader.replies(song,{...root,id:'tx:1!foreign:1!foreign'},0,signal()));
});

test('QQ full replies bind the selected root, preserve identities and quotes, and follow rank plus sequence cursors',async()=>{
 let calls=0;const before=structuredClone(song),reader=new PublicComments(async(_url,request)=>{
  calls++;const body=JSON.parse(request.body!);
  if(body.req_0.method==='GetNewCommentList')return pageResponse();
  assert.equal(body.req_0.module,'music.globalComment.CommentRead');assert.equal(body.req_0.method,'GetReplyCommentList');assert.equal(body.req_0.param.RootCmId,rootID);assert.equal(body.req_0.param.RankType,0);
  if(body.req_0.param.PageNum===0){assert.equal(body.req_0.param.LastRankScore,'');assert.equal(body.req_0.param.LastCommentSeqNo,'');return floor([reply('1!reply1',{RankScore:'9',SeqNo:'201'})],41,true);}
  assert.equal(body.req_0.param.LastRankScore,'9');assert.equal(body.req_0.param.LastCommentSeqNo,'201');return floor([reply('1!reply2',{RankScore:'4',SeqNo:'202'})],0,false);
 });
 const root=(await reader.page(song,0,signal())).items[0]!,first=await reader.replies(song,root,0,signal()),second=await reader.replies(song,root,20,signal());
 assert.equal(calls,3);assert.equal(first.total,41);assert.equal(first.nextOffset,20);assert.equal(first.hasMore,true);assert.equal(first.items[0]!.id,'tx:1!root:1!reply1');assert.equal(first.items[0]!.content,'Reply 1!reply1');assert.equal(first.items[0]!.userName,'Responder');assert.equal(first.items[0]!.avatar,'https://y.gtimg.cn/music/photo/reply.jpg');assert.equal(first.items[0]!.region,'上海');assert.deepEqual(first.items[0]!.reply,{userName:'Original',content:'Quoted root'});assert.equal(second.total,41);assert.equal(second.hasMore,false);assert.deepEqual(song,before);
});

test('QQ reply retries preserve the same cursor and failures do not advance or cache late state',async()=>{
 let calls=0,replyCalls=0,fail=false;const entered=deferred<void>(),late=deferred<unknown>(),reader=new PublicComments(async(_url,request)=>{calls++;const body=JSON.parse(request.body!);if(body.req_0.method==='GetNewCommentList')return pageResponse();replyCalls++;const param=body.req_0.param;if(param.PageNum===0)return floor([reply('1!reply1',{RankScore:'9',SeqNo:'201'})],41,true);if(fail){fail=false;throw Error('offline');}if(replyCalls===4){entered.resolve();return late.promise;}return floor([reply('1!reply2',{RankScore:'4',SeqNo:'202'})],0,false);});
 const root=(await reader.page(song,0,signal())).items[0]!;await reader.replies(song,root,0,signal());fail=true;await assert.rejects(reader.replies(song,root,20,signal()));const retry=await reader.replies(song,root,20,signal());assert.equal(retry.items[0]!.id,'tx:1!root:1!reply2');assert.equal(calls,4);
 const abort=new AbortController();const pending=reader.replies(song,root,20,abort.signal);await entered.promise;abort.abort();await assert.rejects(pending);late.resolve(floor([reply('1!late',{RankScore:'2',SeqNo:'203'})],0,false));await tick();
});

test('QQ rejects invalid reply totals, rows and cursors without transport side effects',async()=>{
 let calls=0,replyCalls=0,raw:any=floor([reply()],41,true),reader=new PublicComments(async(_url,request)=>{calls++;if(JSON.parse(request.body!).req_0.method==='GetNewCommentList')return pageResponse();replyCalls++;return raw;}),root=(await reader.page(song,0,signal())).items[0]!;
 for(const offset of [-1,1,1.5,100020])await assert.rejects(reader.replies(song,root,offset,signal()));
 assert.equal(replyCalls,0);
 for(const invalid of [floor([reply()],40,false),floor(Array(21).fill(reply()),41,true),floor([{}],41,false),{...floor([reply()],41,true),req_0:{code:1}},{req_0:{code:0,data:{SubCode:0,CommentList:{Total:41,HasMore:1,Comments:[reply('1!reply3',{SeqNo:''})]}}}}]){raw=invalid;await assert.rejects(reader.replies(song,root,0,signal()));}
 assert.equal(calls,6);assert.equal(replyCalls,5);
});

test('QQ cancellation during initial list lookup cannot fetch comments or cache a late identity',async()=>{
 const late=deferred<unknown>();let calls=0;const reader=new PublicComments(async(_url,request)=>{calls++;if(calls===1)return late.promise;const body=JSON.parse(request.body!);if(body.req?.module==='music.pf_song_detail_svr')return{code:0,req:{code:0,data:{track_info:{id:9068436,mid:song.origin.id}}}};return pageResponse();}),abort=new AbortController(),input={...song,metadata:{}};
 const pending=reader.page(input,0,abort.signal);await new Promise(resolve=>setImmediate(resolve));abort.abort();await assert.rejects(pending);late.resolve({code:0,req:{code:0,data:{track_info:{id:9068436,mid:song.origin.id}}}});await tick();const page=await reader.page(input,0,signal());assert.equal(calls,3);assert.equal(page.items[0]!.content,'Root\ntext [表情]');
});

test('QQ blocks private origins and invalid list cursors before transport',async()=>{
 let calls=0;const reader=new PublicComments(async()=>{calls++;return pageResponse();});
 for(const input of [{...song,origin:{kind:'local' as const,id:song.origin.id}},{...song,origin:{...song.origin,id:'../private?token=marker'}}]){assert.equal(reader.supports(input),false);await assert.rejects(reader.page(input,0,signal()));}
 for(const offset of [-1,1,1.5,100020])await assert.rejects(reader.page(song,offset,signal()));assert.equal(calls,0);
});
