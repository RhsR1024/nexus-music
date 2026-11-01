import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PublicComments,CommentSession} from '../src/providers/comments.ts';
import type {Track} from '../src/domain/track.ts';
import {deferred} from './fixtures.ts';

const song=(id='1104719773'):Track=>({origin:{kind:'online',platform:'mg',id},title:'Public song',artist:'Public artist',metadata:{copyrightId:'6005753HF0D',url:'https://private.invalid/?token=marker',headers:{Cookie:'marker'}},qualities:[]});
const entry=(id='137166572',extra={})=>({commentId:id,commentInfo:`Synthetic comment ${id}`,commentTime:'2024-01-02 03:04',opNumItem:{thumbNum:3},user:{nickName:'Fixture reader'},replyTotalCount:0,replyComments:[],...extra});
const response=(comments:unknown[],total=41,hot:unknown[]=[entry('98654722')])=>({code:'000000',data:{commentNums:String(total),cfgHotCount:String(hot.length),comments,hotComments:hot,targetInfo:{title:'Public song',subTitle:'Public artist'}}});
const signal=()=>new AbortController().signal;

test('Migu comments use anonymous HTTPS, separate hot rows and preserve replies and time',async()=>{
 const input=song(),before=structuredClone(input);let calls=0;
 const reader=new PublicComments(async(url,request)=>{
  calls++;const parsed=new URL(url);assert.equal(parsed.origin,'https://app.c.nf.migu.cn');assert.equal(parsed.pathname,'/MIGUM3.0/user/comment/stack/v1.0');assert.equal(parsed.searchParams.get('resourceId'),input.origin.id);assert.equal(parsed.searchParams.get('commentId'),'');assert.equal(parsed.searchParams.get('queryType'),'1');assert.equal(request.credentials,'omit');assert.ok(!JSON.stringify(request).includes('marker'));
  return response([entry('1',{commentInfo:'Root\ncomment',opNumItem:{thumbNum:7},replyComments:[{replyInfo:'Synthetic reply',user:{nickName:'Reply reader'}}]})]);
 });
 const page=await reader.page(input,0,signal());assert.equal(calls,1);assert.equal(page.items.length,1);assert.equal(page.items[0]!.id,'mg:1');assert.equal(page.items[0]!.content,'Root\ncomment');assert.equal(page.items[0]!.time,Date.UTC(2024,0,1,19,4));assert.equal(page.items[0]!.likes,7);assert.deepEqual(page.items[0]!.reply,{userName:'Reply reader',content:'Synthetic reply'});assert.equal(page.hot.length,1);assert.equal(page.total,41);assert.equal(page.hasMore,true);assert.deepEqual(input,before);
});

test('Migu cursor pages are isolated by original song and remain bound to the previous page',async()=>{
 const first=song(),second=song('1106906417'),cursors:string[]=[];
 const reader=new PublicComments(async(url,request)=>{const parsed=new URL(url),resource=parsed.searchParams.get('resourceId'),cursor=parsed.searchParams.get('commentId')??'';assert.equal(request.credentials,'omit');cursors.push(`${resource}:${cursor}`);const base=resource==='1104719773'?100:200;return response([entry(String(base+Number(cursor||0)+1))],41);});
 await reader.page(first,0,signal());await reader.page(second,0,signal());await reader.page(first,1,signal());await reader.page(second,1,signal());
 assert.deepEqual(cursors,['1104719773:','1106906417:','1104719773:101','1106906417:201']);
});

test('Migu rejects malformed pages and an invalidated cursor without turning errors into empty lists',async()=>{
 const invalid=[
  {code:'500',data:{}},
  {...response([entry()]),data:{commentNums:'41',comments:[entry()]}},
  {...response([entry()]),data:{commentNums:'0',comments:[entry()],hotComments:[]}},
  response(Array(21).fill(entry())),
  response([{}],1),
  {...response([],0),data:{commentNums:'0',comments:[],hotComments:[],cfgHotCount:'0'}},
 ];
 for(const raw of invalid.slice(0,5))await assert.rejects(new PublicComments(async()=>raw).page(song(),0,signal()));
 const empty=await new PublicComments(async()=>invalid[5]).page(song(),0,signal());assert.equal(empty.items.length,0);assert.equal(empty.hasMore,false);
 let calls=0;const reader=new PublicComments(async()=>{calls++;return response([entry()]);});await assert.rejects(reader.page(song(),20,signal()));assert.equal(calls,0);
 const stale=new PublicComments(async(_url,_request,abort)=>abort.aborted?Promise.reject(Error('cancelled')):response([],0,[]));await stale.page(song(),0,signal());await assert.rejects(stale.page(song(),20,signal()));
});

test('Migu cancellation cannot publish a late response or overwrite cursor state',async()=>{
 const late=deferred<unknown>(),reader=new PublicComments(async()=>late.promise),controller=new AbortController(),pending=reader.page(song(),0,controller.signal);
 await new Promise(resolve=>setImmediate(resolve));controller.abort();late.resolve(response([entry()]));await assert.rejects(pending);
 await assert.rejects(reader.page(song(),20,signal()),/分页状态/);
});

test('Migu accepts only numeric online song identities before requesting',async()=>{
 let calls=0;const reader=new PublicComments(async()=>{calls++;return response([entry()]);});
 assert.equal(reader.supports(song()),true);
 for(const input of [{...song(),origin:{kind:'local' as const,id:'1104719773'}},{...song(),origin:{...song().origin,id:'../private?token=marker'}}]){assert.equal(reader.supports(input),false);await assert.rejects(reader.page(input,0,signal()));}
 assert.equal(calls,0);
});

test('two comment sessions keep independent Migu cursors for the same song',async()=>{
 let firstPages=0;const cursors:string[]=[];
 const reader=new PublicComments(async url=>{const cursor=new URL(url).searchParams.get('commentId')!;if(!cursor)return response([entry(String(++firstPages))]);cursors.push(cursor);return response([entry(cursor+'0')]);});
 const a=new CommentSession(reader),b=new CommentSession(reader),tick=()=>new Promise(resolve=>setImmediate(resolve));
 a.select(song());while(a.getSnapshot().loading)await tick();
 b.select(song());while(b.getSnapshot().loading)await tick();
 await a.load();await b.load();assert.deepEqual(cursors,['1','2']);
 assert.equal(a.getSnapshot().items[1]!.id,'mg:10');assert.equal(b.getSnapshot().items[1]!.id,'mg:20');a.dispose();b.dispose();
});

const replyEntry=(id='reply_1',extra={})=>({replyId:id,replyInfo:'Synthetic full reply',replyTime:'2024-01-03 04:05:06',opNumItem:{thumbNum:4},user:{nickName:'Reply author'},targetComment:'Synthetic quoted target',targetUser:{nickName:'Target author'},...extra});
const threadResponse=(values:unknown[]=[replyEntry()],total=41,extra={})=>({code:'000000',data:{replyTotalCount:total,mainCommentItem:{commentId:'137166572',targetResourceId:'1104719773',targetResourceType:'2',replyTotalCount:total,replyComments:values,...extra}}});

test('Migu full replies use public root binding, real reply fields and anonymous service paging',async()=>{
 let calls=0;const input=song(),before=structuredClone(input),reader=new PublicComments(async(url,request)=>{
  calls++;const u=new URL(url);assert.equal(u.origin,'https://app.c.nf.migu.cn');assert.equal(request.credentials,'omit');assert.ok(!JSON.stringify(request).includes('marker'));
  if(u.pathname.endsWith('/stack/v1.0'))return response([entry(undefined,{replyTotalCount:'41'})]);
  assert.equal(u.pathname,'/MIGUM3.0/user/comment/stack/137166572/v1.0');assert.equal(u.searchParams.get('resourceId'),input.origin.id);assert.equal(u.searchParams.get('resourceType'),'2');assert.equal(u.searchParams.get('queryType'),'2');assert.equal(u.searchParams.get('pageSize'),'20');assert.equal(u.searchParams.get('start'),'20');return threadResponse([replyEntry(),replyEntry()]);
 });
 const root=(await reader.page(input,0,signal())).items[0]!;assert.equal(root.replyCount,41);const page=await reader.replies(input,root,20,signal());assert.equal(page.total,41);assert.equal(page.nextOffset,40);assert.equal(page.hasMore,true);assert.equal(page.items.length,1);assert.equal(page.items[0]!.id,'mg:137166572:reply:reply_1');assert.equal(page.items[0]!.time,Date.UTC(2024,0,2,20,5,6));assert.equal(page.items[0]!.likes,4);assert.deepEqual(page.items[0]!.reply,{userName:'Target author',content:'Synthetic quoted target'});assert.deepEqual(input,before);assert.equal(calls,2);
});
test('Migu rejects foreign or unobserved reply roots, private origins and invalid starts without transport',async()=>{
 let calls=0;const reader=new PublicComments(async()=>{calls++;return response([entry(undefined,{replyTotalCount:2})]);}),root=(await reader.page(song(),0,signal())).items[0]!;
 for(const offset of [-1,1,1.5,100020])await assert.rejects(reader.replies(song(),root,offset,signal()));
 for(const invalid of [{...root,id:'mg:../private'},{...root,id:'mg:unobserved'}])await assert.rejects(reader.replies(song(),invalid,0,signal()));
 await assert.rejects(reader.replies(song('1106906417'),root,0,signal()));assert.throws(()=>reader.replies({...song(),origin:{kind:'local',id:song().origin.id}},root,0,signal()));assert.equal(calls,1);
});
test('Migu reply errors, wrong root or song, malformed arrays and count disagreement cannot become empty success',async()=>{
 let raw:unknown=threadResponse();const reader=new PublicComments(async url=>new URL(url).pathname.endsWith('/stack/v1.0')?response([entry(undefined,{replyTotalCount:41})]):raw),root=(await reader.page(song(),0,signal())).items[0]!;
 const invalid=[{...threadResponse(),code:'500'},threadResponse([],0,{commentId:'other'}),threadResponse([],0,{targetResourceId:'2'}),threadResponse([],0,{targetResourceType:'1'}),threadResponse([],1,{replyTotalCount:2}),threadResponse(Array(21).fill(replyEntry()),41),threadResponse([{}],1),threadResponse([replyEntry()],0),{code:'000000',data:{replyTotalCount:'0'}}];
 for(const value of invalid){raw=value;await assert.rejects(reader.replies(song(),root,0,signal()));}
 raw=threadResponse([],0);const empty=await reader.replies(song(),root,0,signal());assert.deepEqual(empty.items,[]);assert.equal(empty.hasMore,false);
});
test('Migu reply parsing preserves plain text, ignores invalid time, bounds fields and keeps anonymous authors',async()=>{
 const reader=new PublicComments(async url=>new URL(url).pathname.endsWith('/stack/v1.0')?response([entry(undefined,{replyTotalCount:2})]):threadResponse([replyEntry('r1',{replyInfo:'X'.repeat(11000)+'\0',replyTime:'2024-01-03 04:05:60',user:{},targetComment:'',opNumItem:{thumbNum:-1}})],1)),root=(await reader.page(song(),0,signal())).items[0]!,reply=(await reader.replies(song(),root,0,signal())).items[0]!;
 assert.equal(reply.content.length,10000);assert.equal(reply.userName,'匿名用户');assert.equal(reply.time,undefined);assert.equal(reply.likes,undefined);assert.equal(reply.reply,undefined);
});
test('Migu reply cancellation rejects a late response without disturbing the independent comment cursor',async()=>{
 const late=deferred<unknown>();const reader=new PublicComments(async url=>new URL(url).pathname.endsWith('/stack/v1.0')?response([entry(undefined,{replyTotalCount:41})]):late.promise),root=(await reader.page(song(),0,signal())).items[0]!,abort=new AbortController();
 const pending=reader.replies(song(),root,0,abort.signal);await new Promise(resolve=>setImmediate(resolve));abort.abort();late.resolve(threadResponse());await assert.rejects(pending);const next=await reader.page(song(),1,signal());assert.equal(next.nextOffset,2);
});

test('Migu retains hot and first latest reply roots after all 1000 visible latest comments',async()=>{
 let replyCalls=0;const reader=new PublicComments(async url=>{
  const u=new URL(url);
  if(u.pathname.endsWith('/stack/v1.0')){
   const first=Number(u.searchParams.get('commentId')||0)+1;
   return response(Array.from({length:20},(_,i)=>entry(String(first+i))),1000,[entry('hot')]);
  }
  replyCalls++;const id=u.pathname.split('/').at(-2)!;
  return threadResponse([],0,{commentId:id});
 });
 const initial=await reader.page(song(),0,signal());
 for(let offset=20;offset<1000;offset+=20)await reader.page(song(),offset,signal());
 for(const root of [initial.hot[0]!,initial.items[0]!])assert.equal((await reader.replies(song(),root,0,signal())).items.length,0);
 assert.equal(replyCalls,2);
});
