import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PublicComments,CommentSession} from '../src/providers/comments.ts';
import type {Track} from '../src/domain/track.ts';
import {deferred} from './fixtures.ts';
const song:Track={origin:{kind:'online',platform:'kw',id:'26445261'},title:'Public song',artist:'Public artist',metadata:{headers:{Cookie:'private-marker'},url:'https://private.invalid/token'},qualities:[]};
const entry=(id='12345678901234567890',extra={})=>({id,msg:'Synthetic root\ntext',u_name:'Fixture reader',u_pic:'http://img.kuwo.cn/avatar.jpg?token=private',time:'1700000000',like_num:'7',...extra});
const response=(hot:boolean,rows:unknown[]=[entry()],total=41,offset=20)=>({code:'200',result:'ok',comments:hot?[]:rows,hot_comments:hot?rows:[],comments_counts:hot?999:total,hot_comments_counts:hot?total:0,offset});
const signal=()=>new AbortController().signal;

test('Kuwo reads anonymous HTTPS latest and hot with independent totals and child attribution',async()=>{
 const input=structuredClone(song),calls:string[]=[];
 const reader=new PublicComments(async(url,request)=>{const p=new URL(url);assert.equal(p.origin,'https://ncomment.kuwo.cn');assert.equal(p.pathname,'/com.s');assert.equal(p.searchParams.get('sid'),song.origin.id);assert.equal(p.searchParams.get('uid'),'0');assert.equal(request.credentials,'omit');assert.ok(!JSON.stringify(request).includes('private-marker'));const hot=p.searchParams.get('type')==='get_rec_comment';calls.push(p.searchParams.get('type')!);return response(hot,[entry(hot?'2':undefined,{child_comments:[{msg:'Preview reply',u_name:'Reply reader'}]})],hot?1:41);});
 const page=await reader.page(song,0,signal());assert.deepEqual(calls.sort(),['get_comment','get_rec_comment']);assert.equal(page.total,41);assert.equal(page.nextOffset,20);assert.equal(page.hasMore,true);assert.equal(page.hot[0]!.id,'kw:2');assert.equal(page.items[0]!.id,'kw:12345678901234567890');assert.equal(page.items[0]!.avatar,'https://img.kuwo.cn/avatar.jpg');assert.equal(page.items[0]!.time,1700000000000);assert.equal(page.items[0]!.likes,7);assert.deepEqual(page.items[0]!.reply,{userName:'Reply reader',content:'Preview reply'});assert.deepEqual(song,input);
});
test('Kuwo respects advancing server offsets and fetches hot only on the first page',async()=>{
 const starts:string[]=[];const reader=new PublicComments(async url=>{const p=new URL(url);starts.push(p.searchParams.get('start')!);assert.equal(p.searchParams.get('type'),'get_comment');return response(false,[entry('1'),entry('1')],50,47);});
 const page=await reader.page(song,20,signal());assert.deepEqual(starts,['20']);assert.equal(page.nextOffset,47);assert.equal(page.items.length,1);assert.equal(page.hot.length,0);assert.equal(page.hasMore,true);
});
test('Kuwo rejects service/schema and nonadvancing pages instead of successful empties',async()=>{
 for(const raw of [{...response(false),code:'503'},{...response(false),result:'failed'},{...response(false),comments_counts:'-1'},response(false,Array(21).fill(entry()),50),response(false,[{}]),response(false,[entry()],0),response(false,[entry()],41,0),{...response(false),offset:undefined}]){
  const reader=new PublicComments(async url=>new URL(url).searchParams.get('type')==='get_comment'?raw:response(true,[],0));await assert.rejects(reader.page(song,0,signal()));
 }
 const page=await new PublicComments(async url=>response(new URL(url).searchParams.get('type')==='get_rec_comment',[],0)).page(song,0,signal());assert.equal(page.total,0);assert.equal(page.hasMore,false);assert.deepEqual(page.items,[]);
});
test('Kuwo paging and refresh failures retain old content and retry the same start',async()=>{
 let fail=false;const starts:number[]=[];const reader=new PublicComments(async url=>{const p=new URL(url),hot=p.searchParams.get('type')==='get_rec_comment',start=Number(p.searchParams.get('start'));if(hot)return response(true,[],0);starts.push(start);if(fail)throw Error('private-token');return response(false,[entry(String(start+1))],45,start+20);});
 const session=new CommentSession(reader);session.select(song);while(session.getSnapshot().loading)await new Promise(r=>setImmediate(r));fail=true;await session.load();assert.equal(session.getSnapshot().items.length,1);assert.equal(session.getSnapshot().offset,20);assert.doesNotMatch(session.getSnapshot().error!,/private-token/);fail=false;await session.retry();assert.equal(session.getSnapshot().items.length,2);assert.deepEqual(starts,[0,20,20]);session.dispose();
});
test('Kuwo aborted parallel hot/latest responses cannot publish a late page',async()=>{
 const late=deferred<unknown>(),abort=new AbortController();let calls=0;const reader=new PublicComments(async()=>{calls++;return late.promise;});const pending=reader.page(song,0,abort.signal);await new Promise(r=>setImmediate(r));assert.equal(calls,2);abort.abort();late.resolve(response(false));await assert.rejects(pending);
});
test('Kuwo rejects private origins and injected identifiers before network',async()=>{
 let calls=0;const reader=new PublicComments(async()=>{calls++;return response(false);});
 for(const input of [{...song,origin:{kind:'local' as const,id:song.origin.id}},{...song,origin:{...song.origin,id:'1&sid=2'}}]){assert.equal(reader.supports(input),false);await assert.rejects(reader.page(input,0,signal()));}
 for(const offset of [-1,1.5,100001])await assert.rejects(reader.page(song,offset,signal()));assert.equal(calls,0);
});
