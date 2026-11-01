import {test} from 'node:test';import assert from 'node:assert/strict';
import {PublicComments,CommentSession,type CommentPage,type SongComment} from '../src/providers/comments.ts';
import {commentMediaURL,commentRegion} from '../src/providers/commentFields.ts';
import {parseProviderJSON} from '../src/providers/http.ts';
import {deferred,track} from './fixtures.ts';
const song={...track,origin:{kind:'online' as const,platform:'wy' as const,id:'12345678901234567890'}};
const comment=(id:string):SongComment=>({id,content:`Text ${id}`,userName:'Fixture'});
const page=(items:SongComment[],nextOffset:number,hasMore=false):CommentPage=>({hot:[],items,nextOffset,hasMore});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('public comments use exact original WY identity, preserve long IDs and separate hot rows from pagination',async()=>{
 let called='';const provider=new PublicComments(async url=>{called=url;return parseProviderJSON('{"code":200,"total":100,"more":true,"hotComments":[{"commentId":99999999999999999999,"content":"Hot","user":{"nickname":"Reader"}}],"comments":[{"commentId":12345678901234567890,"content":"Text","user":{"nickname":"Visitor","avatarUrl":"http://cdn.example/avatar.jpg?token=private"},"ipLocation":{"location":"上海"},"likedCount":3,"time":1000,"beReplied":[{"user":{"nickname":"Reply"},"content":"Reply text"}]},{"commentId":2,"content":""},{"commentId":12345678901234567890,"content":"Duplicate"}]}');});
 const result=await provider.page(song,0,new AbortController().signal);assert.match(called,/R_SO_4_12345678901234567890\?/);assert.equal(result.hot[0]!.id,'99999999999999999999');assert.equal(result.items[0]!.id,song.origin.id);assert.equal(result.items[0]!.avatar,'https://cdn.example/avatar.jpg');assert.equal(result.items[0]!.region,'上海');assert.equal(result.nextOffset,3);assert.equal(result.items.length,1);assert.equal(result.hasMore,true);assert.equal(result.items[0]!.reply!.content,'Reply text');
 for(const origin of [{kind:'online',platform:'tx',id:'123'},{kind:'online',platform:'wy',id:'wy_123'},{kind:'imported',platform:'qishui',id:'123'}]){const other={...song,origin}as typeof song;assert.equal(provider.supports(other),false);await assert.rejects(provider.page(other,0,new AbortController().signal));}
});
test('comment identity fields accept only bounded public media URLs and plain regions',()=>{
 assert.equal(commentMediaURL('//cdn.example/a.jpg?token=private#fragment'),'https://cdn.example/a.jpg');
 assert.equal(commentMediaURL('https://cdn.example/a.jpg'),'https://cdn.example/a.jpg');
 for(const value of ['javascript:alert(1)','https://user:pass@cdn.example/a.jpg','https://cdn.example/\nheader',`https://cdn.example/${'a'.repeat(2050)}`,42])assert.equal(commentMediaURL(value),undefined);
 assert.equal(commentRegion('  Shanghai\u0000\n\u0001 Pudong\u0002  '),'Shanghai Pudong');
 assert.equal(commentRegion('   '),undefined);
 assert.equal(commentRegion('x'.repeat(100))!.length,80);
});
test('comments reject broken schema/service errors and never represent a failed response as an empty success',async()=>{
 for(const response of [{code:301,comments:[]},{code:200},{code:200,comments:[],more:'true'},{code:200,comments:Array(51).fill({})}]){const provider=new PublicComments(async()=>response);await assert.rejects(provider.page(song,0,new AbortController().signal));}
 const provider=new PublicComments(async()=>({code:200,comments:[],more:true,total:0}));assert.equal((await provider.page(song,0,new AbortController().signal)).hasMore,false);
});
test('comment pagination deduplicates IDs and stops a repeated page while keeping previously loaded content',async()=>{
 const offsets:number[]=[];const session=new CommentSession({supports:()=>true,page:async(_t,offset)=>{offsets.push(offset);return offset===0?page([comment('1')],1,true):page([comment('1')],2,true);}});session.select(song);while(session.getSnapshot().loading)await tick();await session.load();assert.deepEqual(offsets,[0,1]);assert.equal(session.getSnapshot().items.length,1);assert.equal(session.getSnapshot().hasMore,false);assert.equal(session.getSnapshot().limited,true);session.dispose();
});
test('failed paging and refresh preserve loaded rows and retry the same cursor',async()=>{
 let fails=false;const offsets:number[]=[];const session=new CommentSession({supports:()=>true,page:async(_t,offset)=>{offsets.push(offset);if(fails)throw Error('PRIVATE');return page([comment(String(offset+1))],offset+1,true);}});session.select(song);while(session.getSnapshot().loading)await tick();fails=true;await session.load();assert.equal(session.getSnapshot().items[0]!.id,'1');assert.equal(session.getSnapshot().offset,1);assert.ok(session.getSnapshot().error);assert.doesNotMatch(session.getSnapshot().error!,/PRIVATE/);fails=false;await session.load();assert.deepEqual(offsets,[0,1,1]);fails=true;await session.load(true);assert.deepEqual(session.getSnapshot().items.map(v=>v.id),['1','2']);assert.equal(session.getSnapshot().offset,2);session.dispose();
});
test('switching songs and closing cancel only comment requests; late old results cannot replace the new selection',async()=>{
 const late=deferred<CommentPage>();let oldSignal:AbortSignal|undefined;const session=new CommentSession({supports:()=>true,page:async(t,_offset,signal)=>{if(t.origin.id===song.origin.id){oldSignal=signal;return late.promise;}return page([comment('new')],1);}});session.select(song);while(!oldSignal)await tick();session.select({...song,origin:{...song.origin,id:'2'}});while(session.getSnapshot().loading)await tick();assert.equal(oldSignal.aborted,true);late.resolve(page([comment('old')],1));await tick();assert.equal(session.getSnapshot().items[0]!.id,'new');session.close();assert.equal(session.getSnapshot().key,'');assert.deepEqual(session.getSnapshot().items,[]);session.dispose();
});
test('comment session enforces a bounded displayed list and does not issue duplicate concurrent page requests',async()=>{
 let calls=0;const session=new CommentSession({supports:()=>true,page:async(_t,offset)=>{calls++;await tick();return page(Array.from({length:50},(_,i)=>comment(String(offset+i))),offset+50,true);}});session.select(song);await session.load(true);while(session.getSnapshot().loading)await tick();assert.equal(calls,1);while(session.getSnapshot().hasMore)await session.load();assert.equal(session.getSnapshot().items.length,1000);assert.equal(session.getSnapshot().limited,true);assert.equal(calls,20);session.dispose();
});

test('refresh failure with a fully loaded page retries refresh, without losing the old page',async()=>{
 let fail=false,calls=0;const session=new CommentSession({supports:()=>true,page:async(_t,offset)=>{calls++;assert.equal(offset,0);if(fail)throw Error('unavailable');return page([comment(String(calls))],1);}});session.select(song);while(session.getSnapshot().loading)await tick();fail=true;await session.load(true);assert.equal(session.getSnapshot().items[0]!.id,'1');assert.equal(session.getSnapshot().hasMore,false);fail=false;await session.retry();assert.equal(calls,3);assert.equal(session.getSnapshot().items[0]!.id,'3');session.dispose();
});
test('comment session expands only supported reply roots, pages without duplicates, and preserves replies on failure',async()=>{
 const root={...comment('root'),replyCount:3},replies=[{...comment('r1'),content:'Reply one'},{...comment('r2'),content:'Reply two'}];let fail=false,offsets:number[]=[];const session=new CommentSession({supports:()=>true,page:async()=>page([root],1),replies:async(_track,_root,offset)=>{offsets.push(offset);if(fail)throw Error('private reply failure');return{items:offset===0?replies:[{...comment('r1'),content:'Duplicate'},{...comment('r3'),content:'Reply three'}],total:3,nextOffset:offset+2,hasMore:offset===0};}});
 session.select(song);while(session.getSnapshot().loading)await tick();assert.equal(session.canExpand(root),true);session.toggleReplies(root);while(session.getSnapshot().threads.root!.loading)await tick();assert.deepEqual(session.getSnapshot().threads.root!.items.map(item=>item.id),['r1','r2']);assert.equal(session.getSnapshot().threads.root!.hasMore,true);
 fail=true;await session.loadReplies(root);assert.equal(session.getSnapshot().threads.root!.items.length,2);assert.match(session.getSnapshot().threads.root!.error!,/已显示的回复已保留/);fail=false;await session.loadReplies(root);assert.deepEqual(session.getSnapshot().threads.root!.items.map(item=>item.id),['r1','r2','r3']);assert.equal(session.getSnapshot().threads.root!.limited,false);assert.deepEqual(offsets,[0,2,2]);
 session.toggleReplies(root);assert.equal(session.getSnapshot().threads.root!.expanded,false);session.dispose();
});
test('switching songs cancels reply work and a stale reply cannot replace the new thread state',async()=>{
 const rootA={...comment('root-a'),replyCount:1},rootB={...comment('root-b'),replyCount:1},late=deferred<import('../src/providers/comments.ts').CommentThreadPage>();let signalA:AbortSignal|undefined;
 const session=new CommentSession({supports:()=>true,page:async track=>page([track.origin.id==='1'?rootA:rootB],1),replies:async(track,_root,_offset,signal)=>{if(track.origin.id==='1'){signalA=signal;return late.promise;}return{items:[comment('new-reply')],nextOffset:1,hasMore:false};}});
 session.select({...song,origin:{...song.origin,id:'1'}});while(session.getSnapshot().loading)await tick();session.toggleReplies(rootA);while(!signalA)await tick();session.select({...song,origin:{...song.origin,id:'2'}});while(session.getSnapshot().loading)await tick();assert.equal(signalA!.aborted,true);late.resolve({items:[comment('old-reply')],nextOffset:1,hasMore:false});await tick();assert.equal(session.getSnapshot().threads['root-a'],undefined);assert.equal(session.getSnapshot().items[0]!.id,'root-b');session.dispose();
});
test('collapsing a loading reply thread cancels it and a late result cannot reopen it',async()=>{
 const root={...comment('root'),replyCount:1},late=deferred<import('../src/providers/comments.ts').CommentThreadPage>();let signal:AbortSignal|undefined;
 const session=new CommentSession({supports:()=>true,page:async()=>page([root],1),replies:async(_track,_root,_offset,nextSignal)=>{signal=nextSignal;return late.promise;}});
 session.select(song);while(session.getSnapshot().loading)await tick();session.toggleReplies(root);while(!signal)await tick();session.toggleReplies(root);assert.equal(signal!.aborted,true);assert.equal(session.getSnapshot().threads.root!.expanded,false);assert.equal(session.getSnapshot().threads.root!.loading,false);
 late.resolve({items:[comment('late')],nextOffset:1,hasMore:false});await tick();assert.equal(session.getSnapshot().threads.root!.expanded,false);assert.equal(session.getSnapshot().threads.root!.items.length,0);session.dispose();
});
test('comment paging preserves concurrent thread results in either completion order',async()=>{
 for(const repliesFirst of [true,false]){
  const root={...comment('root'),replyCount:2},paging=deferred<CommentPage>(),replying=deferred<import('../src/providers/comments.ts').CommentThreadPage>();
  const session=new CommentSession({supports:()=>true,page:async(_t,offset)=>offset===0?page([root],1,true):paging.promise,replies:async()=>replying.promise});
  session.select(song);while(session.getSnapshot().loading)await tick();session.toggleReplies(root);const pending=session.load();
  const replyPage={items:[comment('reply'),comment('reply')],nextOffset:2,hasMore:false};
  if(repliesFirst){replying.resolve(replyPage);await tick();paging.resolve(page([comment('next')],2));}else{paging.resolve(page([comment('next')],2));await pending;replying.resolve(replyPage);}
  await pending;while(session.getSnapshot().threads.root!.loading)await tick();assert.deepEqual(session.getSnapshot().threads.root!.items.map(row=>row.id),['reply']);assert.equal(session.getSnapshot().items.length,2);session.dispose();
 }
});
test('failed refresh cancels pending replies without leaving the retained thread loading',async()=>{
 const root={...comment('root'),replyCount:2},replying=deferred<import('../src/providers/comments.ts').CommentThreadPage>();let fail=false,signal:AbortSignal|undefined;
 const session=new CommentSession({supports:()=>true,page:async()=>{if(fail)throw Error('offline');return page([root],1);},replies:async(_t,_r,_o,s)=>{signal=s;return replying.promise;}});
 session.select(song);while(session.getSnapshot().loading)await tick();session.toggleReplies(root);while(!signal)await tick();fail=true;await session.load(true);assert.equal(signal.aborted,true);assert.equal(session.getSnapshot().threads.root!.loading,false);assert.ok(session.getSnapshot().error);
 replying.resolve({items:[comment('stale')],nextOffset:1,hasMore:false});await tick();assert.equal(session.getSnapshot().threads.root!.items.length,0);await session.loadReplies(root,true);assert.equal(session.getSnapshot().threads.root!.items[0]!.id,'stale');session.dispose();
});
test('reply threads stop at 500 rows and closing cancels in-flight replies',async()=>{
 const root={...comment('root'),replyCount:1000};let calls=0;
 const session=new CommentSession({supports:()=>true,page:async()=>page([root],1),replies:async(_t,_r,offset)=>{calls++;return{items:Array.from({length:20},(_,i)=>comment(String(offset+i))),nextOffset:offset+20,hasMore:true};}});
 session.select(song);while(session.getSnapshot().loading)await tick();session.toggleReplies(root);while(session.getSnapshot().threads.root!.loading)await tick();while(session.getSnapshot().threads.root!.hasMore)await session.loadReplies(root);
 assert.equal(session.getSnapshot().threads.root!.items.length,500);assert.equal(session.getSnapshot().threads.root!.limited,true);await session.loadReplies(root);assert.equal(calls,25);session.dispose();
 const late=deferred<import('../src/providers/comments.ts').CommentThreadPage>();let signal:AbortSignal|undefined;
 const closing=new CommentSession({supports:()=>true,page:async()=>page([root],1),replies:async(_t,_r,_o,s)=>{signal=s;return late.promise;}});closing.select(song);while(closing.getSnapshot().loading)await tick();closing.toggleReplies(root);while(!signal)await tick();closing.close();assert.equal(signal.aborted,true);late.resolve({items:[comment('late')],nextOffset:1,hasMore:false});await tick();assert.deepEqual(closing.getSnapshot().threads,{});closing.dispose();
});
