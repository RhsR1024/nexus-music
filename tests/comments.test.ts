import {test} from 'node:test';import assert from 'node:assert/strict';
import {PublicComments,CommentSession,type CommentPage,type SongComment} from '../src/providers/comments.ts';
import {parseProviderJSON} from '../src/providers/http.ts';
import {deferred,track} from './fixtures.ts';
const song={...track,origin:{kind:'online' as const,platform:'wy' as const,id:'12345678901234567890'}};
const comment=(id:string):SongComment=>({id,content:`Text ${id}`,userName:'Fixture'});
const page=(items:SongComment[],nextOffset:number,hasMore=false):CommentPage=>({hot:[],items,nextOffset,hasMore});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('public comments use exact original WY identity, preserve long IDs and separate hot rows from pagination',async()=>{
 let called='';const provider=new PublicComments(async url=>{called=url;return parseProviderJSON('{"code":200,"total":100,"more":true,"hotComments":[{"commentId":99999999999999999999,"content":"Hot","user":{"nickname":"Reader"}}],"comments":[{"commentId":12345678901234567890,"content":"Text","user":{"nickname":"Visitor"},"likedCount":3,"time":1000,"beReplied":[{"user":{"nickname":"Reply"},"content":"Reply text"}]},{"commentId":2,"content":""},{"commentId":12345678901234567890,"content":"Duplicate"}]}');});
 const result=await provider.page(song,0,new AbortController().signal);assert.match(called,/R_SO_4_12345678901234567890\?/);assert.equal(result.hot[0]!.id,'99999999999999999999');assert.equal(result.items[0]!.id,song.origin.id);assert.equal(result.nextOffset,3);assert.equal(result.items.length,1);assert.equal(result.hasMore,true);assert.equal(result.items[0]!.reply!.content,'Reply text');
 for(const origin of [{kind:'online',platform:'tx',id:'123'},{kind:'online',platform:'wy',id:'wy_123'},{kind:'imported',platform:'qishui',id:'123'}]){const other={...song,origin}as typeof song;assert.equal(provider.supports(other),false);await assert.rejects(provider.page(other,0,new AbortController().signal));}
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
