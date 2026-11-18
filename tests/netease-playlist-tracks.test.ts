import test from 'node:test';
import assert from 'node:assert/strict';
import {NeteasePlaylistTracksClient} from '../src/providers/neteasePlaylistTracks.ts';
import type {AccountPlaylist} from '../src/providers/accountPlaylists.ts';
import type {MusicAccount,MusicSession} from '../src/providers/musicAccounts.ts';
import type {HTTPRequest} from '../src/providers/http.ts';

const account:MusicAccount={id:'c'.repeat(64),platform:'wy',username:'netease:123456789',label:'网易云音乐',capabilities:[],updatedAt:1};
const session:MusicSession={version:1,platform:'wy',accountId:account.id,userId:'123456789',cookies:{MUSIC_U:'unit-only-key',__csrf:'unit-csrf'}};
const playlist:AccountPlaylist={id:'9100000000000000011',title:'合成目标歌单',count:2,coverUrl:'',kind:'created'};
const signal=()=>new AbortController().signal;
interface Call {path:string;data:Record<string,unknown>}

function client(handler:(path:string,data:Record<string,unknown>,signal:AbortSignal)=>Promise<unknown>,options:{accounts?:()=>readonly MusicAccount[];session?:()=>Promise<MusicSession>;wait?:()=>Promise<void>}={}){
  const calls:Call[]=[];
  const instance=new NeteasePlaylistTracksClient({
    http:async(url,request:HTTPRequest,currentSignal)=>{
      assert.equal(request.credentials,'omit');
      assert.equal(request.headers?.Cookie,'MUSIC_U=unit-only-key; __csrf=unit-csrf');
      const path=url.replace('https://music.163.com/weapi/',''),data=calls.at(-1)?.data??{};
      return handler(path,data,currentSignal);
    },
    accounts:{
      getSnapshot:options.accounts??(()=>[account]),
      session:options.session??(async()=>session),
    },
    wait:options.wait??(async()=>{}),
    weapi:(data)=>{
      calls.push({path:'',data:{...data}});
      return{method:'POST',headers:{Cookie:'MUSIC_U=unit-only-key; __csrf=unit-csrf'},body:'params=unit&encSecKey=unit'};
    },
  });
  return {client:instance,calls};
}
const detail=(ids:readonly string[],trackCount=ids.length,owner='123456789')=>({code:200,playlist:{id:playlist.id,creator:{userId:owner},trackIds:ids.map(id=>({id})),trackCount}});

test('adding a track reads before and after one write before reporting success',async()=>{
  const ids=new Set(['1002','1003']);
  let reads=0,writes=0;
  const {client:target,calls}=client(async(path)=>{
    if(path==='v6/playlist/detail'){reads++;return detail([...ids]);}
    if(path==='playlist/manipulate/tracks'){writes++;ids.add('1001');return{code:200};}
    throw new Error(path);
  });
  assert.deepEqual(await target.update(account,playlist,'1001','add',signal()),{status:'added'});
  assert.equal(writes,1);assert.equal(reads,2);
  assert.deepEqual(calls[1]?.data,{op:'add',pid:playlist.id,trackIds:'["1001"]',imme:'true'});
  assert.doesNotMatch(JSON.stringify(await target.update(account,playlist,'1001','add',signal())),/unit-only-key|unit-csrf/);
});

test('an already present track is idempotent and never writes',async()=>{
  let writes=0;
  const {client:target}=client(async(path)=>{
    if(path==='v6/playlist/detail')return detail(['1001','1002']);
    writes++;return{code:200};
  });
  assert.deepEqual(await target.update(account,playlist,'1001','add',signal()),{status:'already'});
  assert.equal(writes,0);
});

test('duplicate playlist membership does not hide an already present track',async()=>{
  let writes=0;
  const {client:target}=client(async(path)=>{
    if(path==='v6/playlist/detail')return detail(['1001','1002','1001']);
    writes++;return{code:200};
  });
  assert.deepEqual(await target.update(account,playlist,'1001','add',signal()),{status:'already'});
  assert.equal(writes,0);
});

test('removing a present track uses one delete write and confirms absence',async()=>{
  const ids=new Set(['1001','1002']);
  let writes=0;
  const {client:target,calls}=client(async(path)=>{
    if(path==='v6/playlist/detail')return detail([...ids]);
    writes++;ids.delete('1001');return{code:200};
  });
  assert.deepEqual(await target.update(account,playlist,'1001','del',signal()),{status:'removed'});
  assert.equal(writes,1);
  assert.deepEqual(calls[1]?.data,{op:'del',pid:playlist.id,trackIds:'["1001"]',imme:'true'});
});

test('removing an absent track is idempotent and never writes',async()=>{
  let writes=0;
  const {client:target}=client(async(path)=>{
    if(path==='v6/playlist/detail')return detail(['1002']);
    writes++;return{code:200};
  });
  assert.deepEqual(await target.update(account,playlist,'1001','del',signal()),{status:'absent'});
  assert.equal(writes,0);
});

test('removing a duplicated membership still writes once and requires absence',async()=>{
  let ids=['1001','1002','1001'];
  let writes=0;
  const {client:target}=client(async(path)=>{
    if(path==='v6/playlist/detail')return detail(ids);
    writes++;ids=ids.filter(id=>id!=='1001');return{code:200};
  });
  assert.deepEqual(await target.update(account,playlist,'1001','del',signal()),{status:'removed'});
  assert.equal(writes,1);
});

test('a code 200 write without a matching read-back stays unconfirmed',async()=>{
  let reads=0,writes=0;
  const {client:target}=client(async(path)=>{
    if(path==='v6/playlist/detail'){reads++;return detail(['1002','1003']);}
    writes++;return{code:200};
  });
  assert.deepEqual(await target.update(account,playlist,'1001','add',signal()),{status:'unconfirmed'});
  assert.equal(writes,1);assert.equal(reads,3);
});

test('a write response error is rejected and does not gate on a second read',async()=>{
  let reads=0,writes=0;
  const {client:target}=client(async(path)=>{
    if(path==='v6/playlist/detail'){reads++;return detail(['1002']);}
    writes++;return{code:500};
  });
  assert.deepEqual(await target.update(account,playlist,'1001','add',signal()),{status:'rejected',code:500});
  assert.equal(writes,1);assert.equal(reads,1);
});

test('a rejected remove is explicit and does not claim absence',async()=>{
  let reads=0,writes=0;
  const {client:target}=client(async(path)=>{
    if(path==='v6/playlist/detail'){reads++;return detail(['1001','1002']);}
    writes++;return{code:500};
  });
  assert.deepEqual(await target.update(account,playlist,'1001','del',signal()),{status:'rejected',code:500});
  assert.equal(writes,1);assert.equal(reads,1);
});

test('a read failure after writing is unknown, not success or rejection',async()=>{
  let writes=0,reads=0;
  const {client:target}=client(async(path)=>{
    if(path==='v6/playlist/detail'){reads++;return reads===1?detail(['1002']):{code:500};}
    writes++;return{code:200};
  });
  assert.deepEqual(await target.update(account,playlist,'1001','add',signal()),{status:'unknown',code:500});
  assert.equal(writes,1);assert.equal(reads,2);
});

test('malformed ownership or membership data fails before writing',async()=>{
  for(const response of [
    {code:200,playlist:{id:'9100000000000000012',trackIds:[{id:'1002'}],trackCount:1}},
    detail([],0,'999'),
    detail(['1002'],2),
    {code:200,playlist:{id:playlist.id,trackIds:'1002',trackCount:1}},
  ]){
    let writes=0;
    const {client:target}=client(async(path)=>{if(path==='v6/playlist/detail')return response;writes++;return{code:200};});
    assert.deepEqual(await target.update(account,playlist,'1001','add',signal()),{status:'unavailable'});
    assert.equal(writes,0);
  }
});

test('authentication failures are explicit and do not write',async()=>{
  let writes=0;
  const {client:target}=client(async()=>({code:301}));
  assert.deepEqual(await target.update(account,playlist,'1001','add',signal()),{status:'login_required',code:301});
  assert.equal(writes,0);
});

test('identity mismatches fail before any request',async()=>{
  const cases:{account:MusicAccount;session:MusicSession}[]=[
    {account:{...account,platform:'tx'},session},
    {account,session:{...session,accountId:'d'.repeat(64)}},
    {account:{...account,username:'netease:999'},session},
    {account,session:{...session,userId:'999'}},
    {account,session:{...session,cookies:{__csrf:'unit-csrf'}}},
  ];
  for(const item of cases){
    let calls=0;
    const {client:target}=client(async()=>{calls++;return detail(['1002']);},{accounts:()=>[item.account],session:async()=>item.session});
    assert.deepEqual(await target.update(item.account,playlist,'1001','add',signal()),{status:'login_required'});
    assert.equal(calls,0);
  }
});

test('cancellation before writing is cancelled, while cancellation after writing stays unconfirmed',async()=>{
  let calls=0;
  const before=new AbortController();before.abort();
  const first=client(async()=>{calls++;return detail(['1002']);},{});
  assert.deepEqual(await first.client.update(account,playlist,'1001','add',before.signal),{status:'cancelled'});
  assert.equal(calls,0);

  const controller=new AbortController();
  let reads=0,writes=0;
  const {client:target}=client(async(path)=>{
    if(path==='v6/playlist/detail'){reads++;return detail(['1002']);}
    writes++;controller.abort();return{code:200};
  });
  assert.deepEqual(await target.update(account,playlist,'1001','add',controller.signal),{status:'unconfirmed'});
  assert.equal(writes,1);assert.equal(reads,1);
});

test('account replacement after writing is explicit and never reported as success',async()=>{
  let accounts:readonly MusicAccount[]=[account],writes=0;
  const {client:target}=client(async(path)=>{
    if(path==='v6/playlist/detail')return detail(['1002']);
    writes++;accounts=[];return{code:200};
  },{accounts:()=>accounts});
  assert.deepEqual(await target.update(account,playlist,'1001','add',signal()),{status:'account_changed'});
  assert.equal(writes,1);
});

test('invalid playlist kinds and ids are unsupported before any request',async()=>{
  for(const pair of [
    {...playlist,kind:'favorite' as const},
    {...playlist,id:'dir:201'},
    {...playlist,id:'0'},
  ]){
    let calls=0;
    const {client:target}=client(async()=>{calls++;return detail([]);});
    assert.deepEqual(await target.update(account,pair,'1001','add',signal()),{status:'unsupported'});
    assert.equal(calls,0);
  }
  for(const trackId of ['','0','bad','12345678901234567890']){
    let calls=0;
    const {client:target}=client(async()=>{calls++;return detail([]);});
    assert.deepEqual(await target.update(account,playlist,trackId,'add',signal()),{status:'unsupported'});
    assert.equal(calls,0);
  }
});
