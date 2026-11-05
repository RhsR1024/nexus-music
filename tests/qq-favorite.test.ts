import test from 'node:test';
import assert from 'node:assert/strict';
import {QQFavoriteClient} from '../src/providers/qqFavorite.ts';
import type {MusicAccount,MusicSession} from '../src/providers/musicAccounts.ts';

const account:MusicAccount={id:'b'.repeat(64),platform:'tx',username:'qq:2:123456',label:'QQ 音乐',capabilities:[],updatedAt:1};
const session={version:1,platform:'tx',accountId:account.id,userId:'123456',cookies:{qqmusic_key:'unit-only-key',qqmusic_uin:'123456',login_type:'1'}};
const signal=()=>new AbortController().signal;
const value=(awaitRead:unknown):Record<string,unknown>=>awaitRead as Record<string,unknown>;
const bodyOf=(request:{body?:string})=>JSON.parse(request.body??'{}') as Record<string,Record<string,unknown>>;

function client(handler:(url:string,request:{method?:string;body?:string;headers?:Readonly<Record<string,string>>;credentials?:'omit'},signal:AbortSignal)=>Promise<unknown>,options:{accounts?:()=>readonly MusicAccount[];wait?:()=>Promise<void>}={}){
  return new QQFavoriteClient({
    http:handler,
    sha1:async payload=>{assert.match(payload,/AddSonglist/);return 'a'.repeat(40);},
    accounts:{getSnapshot:options.accounts??(()=>[account])},
    wait:options.wait??(async()=>{}),
  });
}

test('QQ favorite reads first, writes once and only reports success after read-back',async()=>{
  let favorited=false;
  const calls:{url:string;request:{method?:string;body?:string;headers?:Readonly<Record<string,string>>;credentials?:'omit'}}[]=[];
  const clientWith=client(async(url,request)=>{
    calls.push({url,request});
    const body=bodyOf(request);
    if(body.verify){assert.equal(body.verify.module,'music.musicasset.SongFavRead');return{code:0,verify:{code:0,data:{m_fan:{unitmid01:favorited?1:0}}}};}
    if(body.detail){assert.equal(body.detail.module,'music.pf_song_detail_svr');return{code:0,detail:{code:0,data:{track_info:{mid:'unitmid01',id:'123456',type:0}}}};}
    if(body.favorite){assert.equal(body.favorite.method,'AddSonglist');favorited=true;return{code:0,favorite:{code:0,data:{retCode:0}}};}
    throw new Error('unexpected request');
  });
  const result=await clientWith.add(account,session,'unitmid01',signal());
  assert.deepEqual(result,{status:'added'});
  assert.equal(calls.length,4);
  assert.equal(calls.filter(call=>bodyOf(call.request).favorite).length,1);
  const write=calls.find(call=>bodyOf(call.request).favorite)!;
  assert.match(write.url,/^https:\/\/u\.y\.qq\.com\/cgi-bin\/musics\.fcg\?sign=zzc[a-z0-9]+$/);
  const writeBody=bodyOf(write.request),writeComm=value(writeBody.comm),writeFavorite=value(writeBody.favorite);
  assert.equal(writeComm.uin,'123456');assert.equal(writeComm.authst,undefined);
  assert.equal(typeof writeComm.g_tk,'number');assert.equal(typeof writeComm.g_tk_new_20200303,'number');
  assert.deepEqual(writeFavorite.param,{dirId:201,v_songInfo:[{songId:'123456',songType:0}]});
  assert.equal(write.request.credentials,'omit');
  assert.equal(write.request.headers?.Cookie,'qqmusic_key=unit-only-key; qqmusic_uin=123456; login_type=1');
  assert.doesNotMatch(JSON.stringify(result),/unit-only-key/);
});

test('an already favorited QQ song is an idempotent read with no write',async()=>{
  let reads=0,writes=0;
  const clientWith=client(async(_url,request)=>{
    const body=bodyOf(request);assert.ok(body.verify);reads++;
    return{code:0,verify:{code:0,data:{m_fan:{unitmid01:true}}}};
  });
  assert.deepEqual(await clientWith.add(account,session,'unitmid01',signal()),{status:'already'});
  assert.equal(reads,1);assert.equal(writes,0);
});

test('a rejected QQ write is never reported as added and does not read back',async()=>{
  let reads=0;
  const clientWith=client(async(_url,request)=>{
    const body=bodyOf(request);
    if(body.verify){reads++;return{code:0,verify:{code:0,data:{m_fan:{unitmid01:0}}}};}
    if(body.detail)return{code:0,detail:{code:0,data:{track_info:{mid:'unitmid01',id:'123456',type:0}}}};
    if(body.favorite)return{code:0,favorite:{code:1001,data:{}}};
    throw new Error('unexpected request');
  });
  assert.deepEqual(await clientWith.add(account,session,'unitmid01',signal()),{status:'rejected',code:1001});
  assert.equal(reads,1);
});

test('authentication rejection during a QQ write is explicit',async()=>{
  const clientWith=client(async(_url,request)=>{
    const body=bodyOf(request);
    if(body.verify)return{code:0,verify:{code:0,data:{m_fan:{unitmid01:0}}}};
    if(body.detail)return{code:0,detail:{code:0,data:{track_info:{mid:'unitmid01',id:'123456',type:0}}}};
    if(body.favorite)return{code:0,favorite:{code:401,data:{}}};
    throw new Error('unexpected request');
  });
  assert.deepEqual(await clientWith.add(account,session,'unitmid01',signal()),{status:'login_required',code:401});
});

test('a successful write without a confirmed read-back stays unconfirmed after two checks',async()=>{
  let reads=0,writes=0,waits=0;
  const clientWith=client(async(_url,request)=>{
    const body=bodyOf(request);
    if(body.verify){reads++;return{code:0,verify:{code:0,data:{m_fan:{unitmid01:0}}}};}
    if(body.detail)return{code:0,detail:{code:0,data:{track_info:{mid:'unitmid01',id:'123456',type:0}}}};
    if(body.favorite){writes++;return{code:0,favorite:{code:0,data:{retCode:0}}};}
    throw new Error('unexpected request');
  },{wait:async()=>{waits++;}});
  assert.deepEqual(await clientWith.add(account,session,'unitmid01',signal()),{status:'unconfirmed'});
  assert.equal(reads,3);assert.equal(writes,1);assert.equal(waits,1);
});

test('the second QQ read-back may confirm without another write',async()=>{
  let reads=0,writes=0;
  const clientWith=client(async(_url,request)=>{
    const body=bodyOf(request);
    if(body.verify){reads++;return{code:0,verify:{code:0,data:{m_fan:{unitmid01:reads===3}}}};}
    if(body.detail)return{code:0,detail:{code:0,data:{track_info:{mid:'unitmid01',id:'123456',type:0}}}};
    if(body.favorite){writes++;return{code:0,favorite:{code:0,data:{retCode:0}}};}
    throw new Error('unexpected request');
  });
  assert.deepEqual(await clientWith.add(account,session,'unitmid01',signal()),{status:'added'});
  assert.equal(reads,3);assert.equal(writes,1);
});

test('a read failure after writing is unknown rather than a failed or successful write',async()=>{
  let reads=0;
  const clientWith=client(async(_url,request)=>{
    const body=bodyOf(request);
    if(body.verify){reads++;return reads===1?{code:0,verify:{code:0,data:{m_fan:{unitmid01:0}}}}:{code:503,verify:{code:0}};}
    if(body.detail)return{code:0,detail:{code:0,data:{track_info:{mid:'unitmid01',id:'123456',type:0}}}};
    if(body.favorite)return{code:0,favorite:{code:0,data:{retCode:0}}};
    throw new Error('unexpected request');
  });
  assert.deepEqual(await clientWith.add(account,session,'unitmid01',signal()),{status:'unknown',code:503});
});

test('unconfirmed action results do not claim failure or success when the session is already invalid',async()=>{
  for(const [response,code] of [
    [{code:0,verify:{code:0,data:{m_fan:{unitmid01:'yes'}}}},undefined],
    [{code:0,verify:{code:1,data:{m_fan:{unitmid01:true}}}},1],
  ]) {
    const clientWith=client(async(_url,request)=>{
      const body=bodyOf(request);assert.ok(body.verify);return response;
    });
    assert.deepEqual(await clientWith.add(account,session,'unitmid01',signal()),code===undefined?{status:'unavailable'}:{status:'unavailable',code});
  }
});

test('QQ detail must match the requested MID and use a safe numeric song ID',async()=>{
  const details=[
    {mid:'different',id:'123456',type:0},
    {mid:'unitmid01',id:'123456',type:1},
    {mid:'unitmid01',id:'0',type:0},
    {mid:'unitmid01',id:'abc',type:0},
    {mid:'unitmid01',id:'90071992547409931234',type:0},
  ];
  for(const track of details){
    let writes=0;
    const clientWith=client(async(_url,request)=>{
      const body=bodyOf(request);
      if(body.verify)return{code:0,verify:{code:0,data:{m_fan:{unitmid01:0}}}};
      if(body.detail)return{code:0,detail:{code:0,data:{track_info:track}}};
      if(body.favorite){writes++;return{code:0,favorite:{code:0,data:{}}};}
      throw new Error('unexpected request');
    });
    assert.deepEqual(await clientWith.add(account,session,'unitmid01',signal()),{status:'unsupported'});
    assert.equal(writes,0);
  }
});

test('identity or session mismatches fail before any QQ request',async()=>{
  const cases:{account:MusicAccount;session:MusicSession}[]=[
    {account:{...account,platform:'wy'},session},
    {account,session:{...session,accountId:'c'.repeat(64)}},
    {account:{...account,username:'qq:2:999'},session},
    {account,session:{...session,cookies:{qqmusic_key:'unit-only-key'}}},
  ];
  for(const [index,{account:target,session:current}] of cases.entries()){
    let calls=0;
    const clientWith=client(async()=>{calls++;return{code:0};},{accounts:()=>[target]});
    assert.deepEqual(await clientWith.add(target,current,`unitmid0${index}`,signal()),{status:'login_required'});
    assert.equal(calls,0);
  }
});

test('cancellation before the first request never writes',async()=>{
  let calls=0;
  const controller=new AbortController();
  const clientWith=client(async()=>{calls++;return{code:0};});
  controller.abort();
  assert.deepEqual(await clientWith.add(account,session,'unitmid01',controller.signal),{status:'cancelled'});
  assert.equal(calls,0);
});

test('cancellation after a write request cannot publish a late success',async()=>{
  let writes=0;
  const controller=new AbortController();
  const clientWith=client(async(_url,request,currentSignal)=>{
    const body=bodyOf(request);
    if(body.verify)return{code:0,verify:{code:0,data:{m_fan:{unitmid01:0}}}};
    if(body.detail)return{code:0,detail:{code:0,data:{track_info:{mid:'unitmid01',id:'123456',type:0}}}};
    if(body.favorite){
      writes++;
      return new Promise((_resolve,reject)=>{
        const abort=()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'}));
        currentSignal.addEventListener('abort',abort,{once:true});
      });
    }
    throw new Error('unexpected request');
  });
  const pending=clientWith.add(account,session,'unitmid01',controller.signal);
  while(!writes)await new Promise(resolve=>setImmediate(resolve));
  controller.abort();
  assert.deepEqual(await pending,{status:'cancelled'});
  assert.equal(writes,1);
});

test('account removal while a write is in flight prevents a late success',async()=>{
  let accounts:readonly MusicAccount[]=[account],writes=0;
  const clientWith=client(async(_url,request)=>{
    const body=bodyOf(request);
    if(body.verify)return{code:0,verify:{code:0,data:{m_fan:{unitmid01:0}}}};
    if(body.detail)return{code:0,detail:{code:0,data:{track_info:{mid:'unitmid01',id:'123456',type:0}}}};
    if(body.favorite){writes++;accounts=[];return{code:0,favorite:{code:0,data:{retCode:0}}};}
    throw new Error('unexpected request');
  },{accounts:()=>accounts});
  assert.deepEqual(await clientWith.add(account,session,'unitmid01',signal()),{status:'account_changed'});
  assert.equal(writes,1);
});

test('concurrent duplicate QQ favorite requests share one write',async()=>{
  let writes=0,release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  let reads=0;
  const clientWith=client(async(_url,request)=>{
    const body=bodyOf(request);
    if(body.verify){reads++;if(reads===1)await held;return{code:0,verify:{code:0,data:{m_fan:{unitmid01:reads>1}}}};}
    if(body.detail)return{code:0,detail:{code:0,data:{track_info:{mid:'unitmid01',id:'123456',type:0}}}};
    if(body.favorite){writes++;return{code:0,favorite:{code:0,data:{retCode:0}}};}
    throw new Error('unexpected request');
  });
  const first=clientWith.add(account,session,'unitmid01',signal());
  const second=clientWith.add(account,session,'unitmid01',signal());
  assert.equal(first,second);
  release();
  assert.deepEqual(await first,{status:'added'});
  assert.equal(writes,1);
});

test('invalid song MIDs are rejected before any identity or network work',async()=>{
  let calls=0;
  const clientWith=client(async()=>{calls++;return{code:0};});
  for(const mid of ['','with space','a'.repeat(65),'../../../x']){
    assert.deepEqual(await clientWith.add(account,session,mid,signal()),{status:'unsupported'});
  }
  assert.equal(calls,0);
});
