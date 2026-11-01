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
