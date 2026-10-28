import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountPlaylists,AccountPlaylistError} from '../src/providers/accountPlaylists.ts';
import {QQPlaylists} from '../src/providers/qqPlaylists.ts';
import {LibraryStore} from '../src/storage/library.ts';
import type {MusicAccount} from '../src/providers/musicAccounts.ts';
import type {Repository} from '../src/storage/repository.ts';
import type {HTTPClient} from '../src/providers/http.ts';
const account:MusicAccount={id:'b'.repeat(64),platform:'tx',username:'qq:2:123',label:'协议测试',capabilities:[],updatedAt:1};
const song=(mid='song1')=>({mid,title:mid==='song1'?'Shape of You':'Perfect',singer:[{name:'Ed Sheeran'}],album:{mid:'album1',name:'÷'},file:{media_mid:mid,size_128mp3:3740360},interval:233});
const entry=(id='10')=>({tid:id,dirName:'公开曲目协议样本',songNum:2,picUrl:'https://y.gtimg.cn/public.jpg'});
const signal=()=>new AbortController().signal;
const reject=(p:Promise<unknown>,kind:AccountPlaylistError['kind'])=>assert.rejects(p,e=>e instanceof AccountPlaylistError&&e.kind===kind&&!e.message.includes('unit-only'));
function setup(){
  let current:readonly MusicAccount[]=[account],serial=0,stored:unknown,session:Record<string,unknown>={version:1,platform:'tx',accountId:account.id,userId:'123',cookies:{login_type:'1',uin:'123',qqmusic_key:'unit-only'}};
  let profile={userId:'123',nickname:'协议测试',encryptedUin:'unit-only-encrypted-owner'};
  const calls:Record<string,any>[]=[];
  let serve:(calls:Record<string,any>)=>Promise<Record<string,any>>=async body=>Object.fromEntries(Object.keys(body).filter(k=>k!=='comm').map(k=>[k,k==='created'?{v_playlist:[entry()],hasmore:0}:k==='favorite'?{v_list:[entry('11')],hasmore:0}:k==='liked'?{total_song_num:2}:{total_song_num:2,songlist:[song(),{track_info:song('song2')}],hasmore:0}]));
  let write:((v:unknown)=>Promise<void>)|undefined;
  const repo:Pick<Repository,'get'|'put'>={get:async<T>()=>stored as T,put:async(_,v)=>{if(write)await write(v);stored=structuredClone(v);}};
  const library=new LibraryStore(repo,()=>String(++serial));
  const http:HTTPClient=async(url,request)=>{
    assert.equal(url,'https://u.y.qq.com/cgi-bin/musicu.fcg');assert.equal(request.credentials,'omit');assert.equal(request.method,'POST');assert.equal(request.headers!.Cookie,'qqmusic_key=unit-only; uin=123; login_type=1');
    const body=JSON.parse(request.body!);assert.deepEqual(body.comm,{uin:'123',authst:'unit-only',ct:24,cv:0,format:'json',tmeAppID:'qqmusic',tmeLoginType:2});calls.push(body);
    return{code:0,...Object.fromEntries(Object.entries(await serve(body)).map(([k,data])=>[k,{code:0,data}]))};
  };
  const qq=new QQPlaylists({http,profile:{fetch:async()=>profile}});
  const client=new AccountPlaylists({http,accounts:{getSnapshot:()=>current,session:async()=>session},profile:{fetch:async()=>{throw new Error('WY must not be called');}},qq,library});
  return{client,library,repo,calls,serve:(v:typeof serve)=>{serve=v;},session:(v:typeof session)=>{session=v;},profile:(v:typeof profile)=>{profile=v;},accounts:(v:typeof current)=>{current=v;},write:(v:typeof write)=>{write=v;}};
}

test('QQ catalog and complete copy use authenticated fixed calls and keep secrets out of local playlists',async()=>{
  const s=setup(),list=await s.client.list(account,signal());
  assert.deepEqual(list.map(x=>[x.id,x.kind]),[['dir:201','created'],['10','created'],['11','favorite']]);
  assert.equal(s.calls[0]!.created.module,'music.musicasset.PlaylistBaseRead');assert.equal(s.calls[0]!.favorite.param.uin,'unit-only-encrypted-owner');assert.equal(s.calls[0]!.liked.param.dirid,201);
  const preview=await s.client.preview(account,list[1]!,signal());assert.deepEqual(preview.tracks.map(t=>t.title),['Shape of You','Perfect']);
  assert.equal(s.calls[1]!.detail.param.disstid,10);assert.equal(s.calls[1]!.detail.param.enc_host_uin,'unit-only-encrypted-owner');
  await s.client.importPreview(account,preview,signal());const restored=new LibraryStore(s.repo,()=> 'unused');await restored.restore();
  assert.equal(restored.getSnapshot().playlists[0]!.entries.length,2);assert.ok(!JSON.stringify(restored.getSnapshot()).includes('unit-only'));await reject(s.client.importPreview(account,preview,signal()),'account_changed');
});
test('QQ favorite pagination advances raw offset, preserves created entries, and rejects stalled pages',async()=>{
  const s=setup();let page=0;
  s.serve(async()=>page++===0?{created:{v_playlist:[entry()],hasmore:0},liked:{total_song_num:0},favorite:{v_list:[entry('11')],hasmore:1}}:{favorite:{v_list:[entry('12')],hasmore:0}});
  assert.equal((await s.client.list(account,signal())).length,4);assert.equal(s.calls[1]!.favorite.param.offset,1);
  const stuck=setup();stuck.serve(async()=>({created:{v_playlist:[],hasmore:0},liked:{total_song_num:0},favorite:{v_list:[],hasmore:1}}));await reject(stuck.client.list(account,signal()),'incomplete');
});
test('QQ catalog refuses truncated created lists, missing favorite termination, unsafe IDs or counts',async()=>{
  for(const change of [{created:{v_playlist:[],hasmore:1}},{created:{v_playlist:[entry('9007199254740993')],hasmore:0}},{favorite:{v_list:[]}},{liked:{total_song_num:10001}}]){
    const s=setup();s.serve(async()=>({created:{v_playlist:[],hasmore:0},liked:{total_song_num:0},favorite:{v_list:[],hasmore:0},...change}));await reject(s.client.list(account,signal()),'incomplete');
  }
});
test('QQ identity mismatch and unsupported WX fail without playlist requests',async()=>{
  for(const change of [{userId:'456'},{platform:'wy'},{version:0},{cookies:{uin:'123',qqmusic_key:'unit-only',login_type:'2'}}]){
    const s=setup();s.session({version:1,platform:'tx',accountId:account.id,userId:'123',cookies:{uin:'123',qqmusic_key:'unit-only'},...change});await reject(s.client.list(account,signal()),'login_required');assert.equal(s.calls.length,0);
  }
  const s=setup();s.profile({userId:'456',nickname:'协议测试',encryptedUin:'abc'});await reject(s.client.list(account,signal()),'login_required');assert.equal(s.calls.length,0);
});
test('QQ paged details preserve song order and validate all total/termination conditions',async()=>{
  const s=setup(),list=await s.client.list(account,signal());let page=0;s.serve(async()=>({detail:{total_song_num:2,songlist:[song(page++===0?'song1':'song2')],hasmore:page===1?1:0}}));
  const p=await s.client.preview(account,list[0]!,signal());assert.deepEqual(p.tracks.map(t=>t.origin.id),['song1','song2']);assert.deepEqual(s.calls.slice(1).map(c=>c.detail.param.song_begin),[0,1]);
  for(const response of [{total_song_num:2,songlist:[song()],hasmore:0},{total_song_num:0,songlist:[song()],hasmore:0},{total_song_num:1,songlist:[song()],hasmore:1},{songlist:[]},{total_song_num:2,songlist:[song(),song()],hasmore:0},{total_song_num:1,songlist:[{...song(),file:{}}],hasmore:0},{total_song_num:1,songlist:[{...song(),album:'broken'}],hasmore:0}]){
    const x=setup(),lists=await x.client.list(account,signal());x.serve(async()=>({detail:response}));await reject(x.client.preview(account,lists[0]!,signal()),'incomplete');
  }
});
test('QQ changed or forgotten totals and repeated songs never yield a partial preview',async()=>{
  for(const next of [{total_song_num:3,songlist:[song('song2')],hasmore:0},{songlist:[song('song2')],hasmore:0},{total_song_num:2,songlist:[song()],hasmore:0}]){
    const s=setup(),lists=await s.client.list(account,signal());let page=0;s.serve(async()=>({detail:page++===0?{total_song_num:2,songlist:[song()],hasmore:1}:next}));await reject(s.client.preview(account,lists[0]!,signal()),'incomplete');
  }
});
test('QQ actual empty liked snapshot is distinct from incomplete or unavailable results',async()=>{
  const s=setup();s.serve(async b=>b.detail?{detail:{total_song_num:0,songlist:[],hasmore:0}}:{created:{v_playlist:[],hasmore:0},favorite:{v_list:[],hasmore:0},liked:{total_song_num:0}});
  const lists=await s.client.list(account,signal());assert.deepEqual(lists.map(x=>x.id),['dir:201']);const p=await s.client.preview(account,lists[0]!,signal());assert.equal(p.tracks.length,0);await s.client.importPreview(account,p,signal());assert.equal(s.library.getSnapshot().playlists[0]!.entries.length,0);
});
test('QQ late responses cannot survive logout and cancelled writes roll back the same LibraryStore',async()=>{
  const s=setup(),lists=await s.client.list(account,signal()),p=await s.client.preview(account,lists[1]!,signal()),controller=new AbortController();
  let enter!:()=>void,release!:()=>void;const started=new Promise<void>(r=>{enter=r;});let writes=0;s.write(async()=>{if(++writes===1){enter();await new Promise<void>(r=>{release=r;});}});
  const pending=s.client.importPreview(account,p,controller.signal);await started;controller.abort();release();await reject(pending,'cancelled');assert.equal(s.library.getSnapshot().playlists.length,0);
  const late=setup();let resolve!:(value:Record<string,any>)=>void;late.serve(()=>new Promise(r=>{resolve=r;}));const reading=late.client.list(account,signal());while(!resolve)await new Promise(r=>setImmediate(r));late.accounts([]);resolve({});await reject(reading,'account_changed');
});
test('QQ transport errors are redacted and tokens in covers are omitted',async()=>{
  const s=setup();s.serve(async()=>{throw new Error('unit-only-private-body');});await reject(s.client.list(account,signal()),'unavailable');
  s.serve(async()=>({created:{v_playlist:[{...entry(),picUrl:'https://y.gtimg.cn/x?token=unit-only'}]},favorite:{v_list:[],hasmore:0},liked:{total_song_num:0}}));assert.equal((await s.client.list(account,signal()))[1]!.coverUrl,'');
});

test('QQ existing liked directory uses the dedicated detail total even when catalog omits the count',async()=>{
  const s=setup();s.serve(async()=>({created:{v_playlist:[{dirId:201,dirName:'我喜欢'}]},favorite:{v_list:[],hasmore:0},liked:{total_song_num:2}}));
  const lists=await s.client.list(account,signal());assert.equal(lists.length,1);assert.equal(lists[0]!.id,'dir:201');assert.equal(lists[0]!.count,2);
});
