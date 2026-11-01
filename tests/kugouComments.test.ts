import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PublicComments,CommentSession} from '../src/providers/comments.ts';
import type {Track} from '../src/domain/track.ts';
import {deferred} from './fixtures.ts';
const hash='B6A303C9CDA8E6C4C0B2FB0B23A570C6',song:Track={origin:{kind:'online',platform:'kg',id:'24748592_'+hash},title:'Public song',artist:'Public artist',metadata:{hash,url:'https://private.invalid/token',headers:{Cookie:'private-marker'}},qualities:[]};
const crypto={md5:async(v:string)=>createHash('md5').update(v).digest('hex'),nonce:()=> 'a'.repeat(32),now:()=>1700000000000};
const entry=(id='12345678901234567890',extra={})=>({id,content:'Synthetic &amp; root',user_name:'Fixture reader',addtimestamp:1700000000,like:{likenum:7},reply_num:2,...extra});
const response=(rows:unknown[]=[entry()],page=1,total=41)=>({err_code:0,current_page:page,childrenid:24748592,list:rows,count:total});
const replyResponse=(rows:unknown[]=[entry('200')],page=1,total=41)=>({err_code:0,current_page:page,childrenid:24748592,tid:'12345678901234567890',list:rows,comments_num:total});
const signal=()=>new AbortController().signal;
test('Kugou uses signed anonymous official HTTPS gateway with temporary nonce and original identity',async()=>{
 let calls=0;const before=structuredClone(song);const reader=new PublicComments(async(url,request)=>{calls++;const u=new URL(url);assert.equal(u.origin,'https://gateway.kugou.com');assert.equal(request.headers?.['x-router'],'m.comment.service.kugou.com');assert.equal(request.credentials,'omit');assert.ok(!JSON.stringify(request).includes('private-marker'));assert.equal(u.searchParams.get('schash'),hash);assert.equal(u.searchParams.get('extdata'),hash);assert.equal(u.searchParams.get('mid'),'a'.repeat(32));assert.equal(u.searchParams.get('kugouid'),'0');assert.equal(u.searchParams.get('clienttoken'),'');const signature=u.searchParams.get('signature');u.searchParams.delete('signature');const salt='OIlwieks28dk2k092lksi2UIkp';assert.equal(signature,await crypto.md5(salt+u.searchParams.toString().split('&').sort().join('')+salt));return response([entry(u.pathname.endsWith('topliked')?'2':undefined,{content:'Hi [at=9]',atlist:[{id:9,name:'Public name'}],pcontent:'Original &lt;text&gt;',puser:'Root reader'})]);},crypto);
 const p=await reader.page(song,0,signal());assert.equal(calls,2);assert.equal(p.items[0]!.id,'kg:12345678901234567890');assert.equal(p.items[0]!.content,'Hi @Public name');assert.deepEqual(p.items[0]!.reply,{userName:'Root reader',content:'Original <text>'});assert.equal(p.items[0]!.time,1700000000000);assert.equal(p.items[0]!.likes,7);assert.equal(p.hot.length,1);assert.deepEqual(song,before);
});
test('Kugou full replies use anonymous HTTPS and bind the original song and root comment',async()=>{
 const rootId='12345678901234567890',reader=new PublicComments(async(url,request)=>{
  const u=new URL(url);assert.equal(request.credentials,'omit');assert.ok(!JSON.stringify(request).includes('private-marker'));
  if(u.pathname.startsWith('/r/v1/rank/'))return response();
  assert.equal(u.origin,'https://gateway.kugou.com');assert.equal(u.pathname,'/index.php');assert.equal(u.searchParams.get('r'),'commentsv2/getReplyWithLike');assert.equal(u.searchParams.get('childrenid'),'24748592');assert.equal(u.searchParams.get('tid'),rootId);assert.equal(u.searchParams.get('p'),'1');assert.equal(u.searchParams.get('pagesize'),'20');
  return replyResponse([entry('200',{content:'Synthetic full reply'})]);
 },crypto);
 const page=await reader.page(song,0,signal()),root=page.items[0]!;assert.equal(root.replyCount,2);
 const replies=await reader.replies(song,root,0,signal());assert.equal(replies.total,41);assert.equal(replies.nextOffset,20);assert.equal(replies.hasMore,true);assert.equal(replies.items[0]!.id,'kg:200');assert.equal(replies.items[0]!.content,'Synthetic full reply');
});
test('Kugou reply paging rejects broken schemas, foreign roots and non-advancing cursors',async()=>{
 let calls=0,raw:unknown=replyResponse();const reader=new PublicComments(async url=>{calls++;if(new URL(url).pathname.startsWith('/r/v1/rank/'))return response();return raw;},crypto);
 const root=(await reader.page(song,0,signal())).items[0]!;
 for(const invalid of [{...replyResponse(),err_code:1},{...replyResponse(),current_page:2},{...replyResponse(),childrenid:42},{...replyResponse(),tid:9},{...replyResponse(),comments_num:-1},replyResponse(Array(21).fill(entry('2')))]){raw=invalid;await assert.rejects(reader.replies(song,root,0,signal()));}
 await assert.rejects(reader.replies(song,{...root,id:'kg:900'},0,signal()));
 for(const offset of [-1,1,1.5,100020])await assert.rejects(reader.replies(song,root,offset,signal()));
 assert.equal(calls,8);
});
test('Kugou cached reply roots remain bound to the song that produced them',async()=>{
 let calls=0,replyCalls=0;const reader=new PublicComments(async url=>{calls++;const u=new URL(url);if(u.pathname.startsWith('/r/v1/rank/'))return response();replyCalls++;return replyResponse();},crypto);
 const root=(await reader.page(song,0,signal())).items[0]!;
 const sameHashOtherAudio={...song,origin:{...song.origin,id:'999_'+hash},metadata:{...song.metadata,hash}};
 await assert.rejects(reader.replies(sameHashOtherAudio,root,0,signal()),/暂不支持/);
 assert.equal(replyCalls,0);assert.equal(calls,2);
});
test('Kugou reply cancellation during transport cannot publish or consume a later page',async()=>{
 const late=deferred<unknown>(),abort=new AbortController(),reader=new PublicComments(async url=>new URL(url).pathname.startsWith('/r/v1/rank/')?response():late.promise,crypto),root=(await reader.page(song,0,signal())).items[0]!;
 const pending=reader.replies(song,root,0,abort.signal);await new Promise(resolve=>setImmediate(resolve));abort.abort();late.resolve(replyResponse());await assert.rejects(pending);
});
test('Kugou filtered short pages advance by server page size and validate returned page',async()=>{
 const paths:string[]=[];const reader=new PublicComments(async url=>{const u=new URL(url);paths.push(u.pathname);assert.equal(u.searchParams.get('p'),'2');return response([entry('1'),entry('1')],2,41);},crypto);const p=await reader.page(song,20,signal());assert.equal(paths.length,1);assert.equal(p.nextOffset,40);assert.equal(p.items.length,1);assert.equal(p.hot.length,0);assert.equal(p.hasMore,true);
});
test('Kugou malformed schema, foreign recording, service errors and false empty pages fail',async()=>{
 for(const raw of [{...response(),err_code:1},{...response(),childrenid:42},response([entry()],2),response(Array(21).fill(entry()),1,50),response([{}]),response([entry()],1,0),{...response(),count:-1}])await assert.rejects(new PublicComments(async()=>raw,crypto).page(song,0,signal()));
 const p=await new PublicComments(async()=>response([],1,0),crypto).page(song,0,signal());assert.equal(p.hasMore,false);assert.equal(p.total,0);assert.deepEqual(p.items,[]);
});
test('Kugou signing cancellation and invalid crypto cannot issue requests',async()=>{
 const late=deferred<string>();let calls=0;const abort=new AbortController(),reader=new PublicComments(async()=>{calls++;return response();},{...crypto,md5:()=>late.promise});const pending=reader.page(song,0,abort.signal);await new Promise(r=>setImmediate(r));abort.abort();late.resolve('a'.repeat(32));await assert.rejects(pending);assert.equal(calls,0);
 for(const options of [{...crypto,nonce:()=> 'bad'},{...crypto,md5:async()=> 'bad'}])await assert.rejects(new PublicComments(async()=>{calls++;return response();},options).page(song,0,signal()));assert.equal(calls,0);
});
test('Kugou rejects foreign metadata, private sources, injection and invalid page offsets',async()=>{
 let calls=0;const reader=new PublicComments(async()=>{calls++;return response();},crypto);
 for(const t of [{...song,metadata:{hash:'f'.repeat(32)}},{...song,origin:{kind:'local' as const,id:hash}},{...song,origin:{...song.origin,id:hash+'&p=2'}}]){assert.equal(reader.supports(t),false);await assert.rejects(reader.page(t,0,signal()));}
 for(const offset of [-1,1,1.5,100020])await assert.rejects(reader.page(song,offset,signal()));assert.equal(calls,0);assert.equal(reader.supports({...song,origin:{...song.origin,id:hash.toLowerCase()},metadata:{}}),true);
});
test('Kugou failed paging retains old rows and retries the same page in a scoped session',async()=>{
 let fail=false;const pages:number[]=[];const reader=new PublicComments(async url=>{const u=new URL(url),p=Number(u.searchParams.get('p'));if(u.pathname.endsWith('topliked'))return response([],p,0);pages.push(p);if(fail)throw Error('private-marker');return response([entry(String(p))],p,45);},crypto),session=new CommentSession(reader);session.select(song);while(session.getSnapshot().loading)await new Promise(r=>setImmediate(r));fail=true;await session.load();assert.equal(session.getSnapshot().items.length,1);assert.doesNotMatch(session.getSnapshot().error!,/private-marker/);fail=false;await session.retry();assert.equal(session.getSnapshot().items.length,2);assert.deepEqual(pages,[1,2,2]);session.dispose();
});
