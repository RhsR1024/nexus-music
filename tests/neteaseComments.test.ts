import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NeteasePublicComments} from '../src/providers/neteaseComments.ts';
import {PublicComments,CommentSession} from '../src/providers/comments.ts';
import {deferred,track} from './fixtures.ts';
import type {HTTPClient} from '../src/providers/http.ts';

const song={...track,origin:{kind:'online' as const,platform:'wy' as const,id:'12345678901234567890'}};
const signal=()=>new AbortController().signal;
const rootRow={commentId:'90000000000000000001',content:'Public root',user:{nickname:'Root'}};
const rootPage={code:200,comments:[rootRow],hotComments:[],total:1,more:false};
const reply=(id:string,parent=rootRow.commentId)=>({commentId:id,parentCommentId:parent,content:`Reply ${id}`,user:{nickname:'Reply author',avatarUrl:'http://cdn.example/reply.jpg?token=private'},ipLocation:{location:'上海'},time:1500,likedCount:2,beReplied:[{content:'Quoted reply',user:{nickname:'Quoted author'}}]});
const floor=(comments:unknown[],more=false,time=2000,total=comments.length)=>({code:200,data:{ownerComment:rootRow,comments,bestComments:[],hasMore:more,time,totalCount:total}});
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('Netease unknown reply counts stay unknown and only loaded original-song roots can expand',async()=>{
 let calls=0;const provider=new NeteasePublicComments(async()=>{calls++;return rootPage;});
 assert.equal(provider.canExpand(song,{id:rootRow.commentId,content:'x',userName:'x'}),false);
 const page=await provider.page(song,0,signal()),root=page.items[0]!;
 assert.equal(root.replyCount,undefined);assert.equal(provider.canExpand(song,root),true);
 assert.equal(provider.canExpand({...song,origin:{...song.origin,id:'2'}},root),false);
 await assert.rejects(provider.replies({...song,origin:{...song.origin,id:'2'}},root,0,signal()));
 await assert.rejects(provider.replies(song,{...root,id:'1&other=2'},0,signal()));
 await assert.rejects(provider.replies(song,root,1,signal()));
 assert.equal(calls,1);
});
test('Netease explicit floor counts distinguish zero from unknown',async()=>{
 for(const n of [0,4]){
  const provider=new NeteasePublicComments(async()=>({...rootPage,comments:[{...rootRow,showFloorComment:{replyCount:n}}]}));
  const root=(await provider.page(song,0,signal())).items[0]!;
  assert.equal(root.replyCount,n);assert.equal(provider.canExpand(song,root),n>0);
 }
});
test('Netease floor follows returned time cursors, keeps first total across later zero and retries identical cursor',async()=>{
 const calls:URL[]=[];let fail=false;
 const provider=new NeteasePublicComments(async(url,init)=>{
  assert.equal(init?.credentials,'omit');const u=new URL(url);calls.push(u);
  if(u.pathname.includes('/v1/'))return rootPage;
  assert.equal(u.searchParams.get('threadId'),`R_SO_4_${song.origin.id}`);
  assert.equal(u.searchParams.get('parentCommentId'),rootRow.commentId);
  assert.equal(u.searchParams.get('limit'),'20');
  if(fail)throw Error('private endpoint detail');
  return u.searchParams.get('time')==='-1'?floor([reply('90000000000000000002')],true,1500,3):floor([reply('90000000000000000003')],false,2000,0);
 });
 const root=(await provider.page(song,0,signal())).items[0]!;
 const first=await provider.replies(song,root,0,signal());
 assert.equal(first.nextOffset,1);assert.equal(first.total,3);assert.equal(first.hasMore,true);
 assert.equal(first.items[0]!.avatar,'https://cdn.example/reply.jpg');assert.equal(first.items[0]!.region,'上海');
 assert.equal(first.items[0]!.reply?.userName,'Quoted author');assert.equal(first.items[0]!.time,1500);assert.equal(first.items[0]!.likes,2);
 fail=true;await assert.rejects(provider.replies(song,root,1,signal()));fail=false;
 const second=await provider.replies(song,root,1,signal());
 assert.equal(second.total,3);assert.equal(second.hasMore,false);
 assert.deepEqual(calls.filter(u=>u.pathname.endsWith('/floor/get')).map(u=>u.searchParams.get('time')),['-1','1500','1500']);
});
test('Netease floor validates owner, child binding, schema, limits and cursor progress before accepting a page',async()=>{
 const good=floor([reply('2')],true,2000,3);
 const invalid=[
  {...good,code:301},
  {...good,data:{...good.data,ownerComment:{...rootRow,commentId:'other'}}},
  {...good,data:{...good.data,comments:[reply('2','different-root')]}},
  {...good,data:{...good.data,comments:[reply(rootRow.commentId)]}},
  {...good,data:{...good.data,comments:Array(21).fill(reply('2'))}},
  {...good,data:{...good.data,bestComments:{}}},
  {...good,data:{...good.data,totalCount:'3'}},
  {...good,data:{...good.data,time:Infinity}},
  {...good,data:{...good.data,hasMore:'true'}},
  {...good,data:{...good.data,comments:[]}},
  {...good,data:{...good.data,comments:[{...reply('2'),content:''}]}},
  {...good,data:{...good.data,totalCount:0}},
 ];
 for(const response of invalid){
  const provider=new NeteasePublicComments(async url=>url.includes('/v1/')?rootPage:response);
  const root=(await provider.page(song,0,signal())).items[0]!;
  await assert.rejects(provider.replies(song,root,0,signal()));
  await assert.rejects(provider.replies(song,root,1,signal()));
 }
 let call=0;const provider=new NeteasePublicComments(async url=>url.includes('/v1/')?rootPage:++call===1?good:floor([reply('3')],true,2000,0));
 const root=(await provider.page(song,0,signal())).items[0]!;await provider.replies(song,root,0,signal());await assert.rejects(provider.replies(song,root,1,signal()));
});
test('Netease empty successful floor is explicit and best replies merge once by identity',async()=>{
 let response:unknown=floor([]);
 const provider=new NeteasePublicComments(async url=>url.includes('/v1/')?rootPage:response);
 const root=(await provider.page(song,0,signal())).items[0]!;
 assert.deepEqual(await provider.replies(song,root,0,signal()),{items:[],total:0,nextOffset:0,hasMore:false});
 response={code:200,data:{...floor([reply('2')],false,2000,2).data,bestComments:[reply('2'),reply('3')]}};
 const page=await provider.replies(song,root,0,signal());assert.deepEqual(page.items.map(c=>c.id),['2','3']);assert.equal(page.nextOffset,1);
});
test('Netease aborted floor never installs cursor state, even when the HTTP client ignores cancellation',async()=>{
 const late=deferred<unknown>();let active:AbortSignal|undefined;
 const http:HTTPClient=async(url,_init,s)=>{if(url.includes('/v1/'))return rootPage;active=s;return late.promise;};
 const provider=new NeteasePublicComments(http),root=(await provider.page(song,0,signal())).items[0]!,abort=new AbortController();
 const pending=provider.replies(song,root,0,abort.signal);while(!active)await tick();abort.abort();
 await assert.rejects(pending);assert.equal(active.aborted,true);late.resolve(floor([reply('2')],true,2000,5));await tick();
 await assert.rejects(provider.replies(song,root,1,signal()));
});
test('PublicComments sessions isolate WY roots and unknown-count reply expansion without adding QQ capabilities',async()=>{
 const provider=new PublicComments(async url=>url.includes('/v1/')?rootPage:floor([reply('2')]));
 const session=new CommentSession(provider);session.select(song);while(session.getSnapshot().loading)await tick();
 const root=session.getSnapshot().items[0]!;assert.equal(session.canExpand(root),true);
 session.toggleReplies(root);while(session.getSnapshot().threads[root.id]!.loading)await tick();
 assert.equal(session.getSnapshot().threads[root.id]!.items[0]!.id,'2');
 await assert.rejects(provider.replies(song,root,0,signal()));
 assert.equal(provider.canExpand({...song,origin:{...song.origin,platform:'tx',id:'1234567890'}},{...root,replyCount:10}),false);
 session.dispose();
});
test('Netease earliest displayed roots remain expandable after 1000 recent plus first-page hot roots',async()=>{
 let first:import('../src/providers/comments.ts').SongComment|undefined;
 const provider=new NeteasePublicComments(async url=>{
  if(!url.includes('/v1/'))return floor([]);
  const offset=Number(new URL(url).searchParams.get('offset'));
  const rows=Array.from({length:20},(_,i)=>({...rootRow,commentId:String(offset+i+1)}));
  return{...rootPage,comments:rows,hotComments:rows.map(r=>({...r,commentId:String(Number(r.commentId)+1000)}))};
 });
 for(let offset=0;offset<1000;offset+=20){const p=await provider.page(song,offset,signal());first??=p.items[0];}
 assert.equal(provider.canExpand(song,first!),true);
});
