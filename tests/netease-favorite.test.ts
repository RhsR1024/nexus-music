import test from 'node:test';
import assert from 'node:assert/strict';
import {NeteaseFavoriteClient} from '../src/providers/neteaseFavorite.ts';
import type {MusicAccount,MusicSession} from '../src/providers/musicAccounts.ts';
import type {HTTPRequest} from '../src/providers/http.ts';

const account:MusicAccount={id:'c'.repeat(64),platform:'wy',username:'netease:123456789',label:'网易云音乐',capabilities:[],updatedAt:1};
const session:MusicSession={version:1,platform:'wy',accountId:account.id,userId:'123456789',cookies:{MUSIC_U:'unit-only-key',__csrf:'unit-csrf'}};
const signal=()=>new AbortController().signal;

interface Call {path:string;data:Record<string,unknown>}
function client(handler:(path:string,data:Record<string,unknown>,signal:AbortSignal)=>Promise<unknown>,options:{accounts?:()=>readonly MusicAccount[];wait?:()=>Promise<void>}={}){
  const calls:Call[]=[];
  const instance=new NeteaseFavoriteClient({
    http:async(url,request:HTTPRequest,currentSignal)=>{
      assert.equal(request.credentials,'omit');
      assert.equal(request.headers?.Cookie,'MUSIC_U=unit-only-key; __csrf=unit-csrf');
      const path=url.replace('https://music.163.com/weapi/','');
      return handler(path,calls.at(-1)!.data,currentSignal);
    },
    accounts:{getSnapshot:options.accounts??(()=>[account])},
    wait:options.wait??(async()=>{}),
    weapi:(data)=>{
      calls.push({path:'',data:{...data}});
      return{method:'POST',headers:{Cookie:'MUSIC_U=unit-only-key; __csrf=unit-csrf'},body:'params=unit&encSecKey=unit'};
    },
  });
  return {client:instance,calls};
}

test('NetEase favorite reads first, writes once and only reports success after read-back',async()=>{
  let favorited=false,reads=0,writes=0;
  const {client:target,calls}=client(async(path,data)=>{
    if(path==='song/like/check'){
      reads++;assert.equal(data.trackIds,'["186016"]');
      return{code:200,data:{'186016':favorited?true:false}};
    }
    if(path==='song/like'){
      writes++;assert.deepEqual(data,{trackId:'186016',userid:'123456789',like:true});
      favorited=true;return{code:200};
    }
    throw new Error('unexpected request');
  });
  const result=await target.add(account,session,'186016',signal());
  assert.deepEqual(result,{status:'added'});
  assert.equal(reads,2);assert.equal(writes,1);
  assert.deepEqual(calls.map(call=>call.data),[
    {trackIds:'["186016"]'},
    {trackId:'186016',userid:'123456789',like:true},
    {trackIds:'["186016"]'},
  ]);
  assert.doesNotMatch(JSON.stringify(result),/unit-only-key|unit-csrf/);
});

test('an already favorited NetEase song is an idempotent read with no write',async()=>{
  let reads=0,writes=0;
  const {client:target}=client(async(path)=>{
    if(path==='song/like/check'){reads++;return{code:200,data:{'186016':1}};}
    writes++;return{code:200};
  });
  assert.deepEqual(await target.add(account,session,'186016',signal()),{status:'already'});
  assert.equal(reads,1);assert.equal(writes,0);
});

test('a liked-id array response is accepted without guessing absent entries',async()=>{
  for(const response of [
    {code:200,data:['186016','2058263032']},
    {code:200,ids:['186016']},
    {code:200,data:{liked:{'186016':'true'}}},
    {code:200,data:{'186016':{liked:true}}},
  ]){
    let writes=0;
    const {client:target}=client(async(path)=>{
      if(path==='song/like/check')return response;
      writes++;return{code:200};
    });
    assert.deepEqual(await target.add(account,session,'186016',signal()),{status:'already'});
    assert.equal(writes,0);
  }
  let writes=0;
  let favorited=false;
  const {client:target}=client(async(path)=>{
    if(path==='song/like/check')return{code:200,data:favorited?['186016']:['2058263032']};
    writes++;favorited=true;return{code:200};
  });
  assert.deepEqual(await target.add(account,session,'186016',signal()),{status:'added'});
  assert.equal(writes,1);
});

test('a rejected NetEase write is never reported as added and does not read back',async()=>{
  let reads=0;
  const {client:target}=client(async(path)=>{
    if(path==='song/like/check'){reads++;return{code:200,data:{'186016':false}};}
    if(path==='song/like')return{code:500};
    throw new Error('unexpected request');
  });
  assert.deepEqual(await target.add(account,session,'186016',signal()),{status:'rejected',code:500});
  assert.equal(reads,1);
});

test('NetEase authentication rejection during a write is explicit',async()=>{
  const {client:target}=client(async(path)=>{
    if(path==='song/like/check')return{code:200,data:{'186016':false}};
    if(path==='song/like')return{code:301};
    throw new Error('unexpected request');
  });
  assert.deepEqual(await target.add(account,session,'186016',signal()),{status:'login_required',code:301});
});

test('an authentication failure on the first NetEase read stays login_required',async()=>{
  let calls=0;
  const {client:target}=client(async()=>{calls++;return{code:301};});
  assert.deepEqual(await target.add(account,session,'186016',signal()),{status:'login_required',code:301});
  assert.equal(calls,1);
});

test('a successful NetEase write without a confirmed read-back stays unconfirmed after two checks',async()=>{
  let reads=0,writes=0,waits=0;
  const {client:target}=client(async(path)=>{
    if(path==='song/like/check'){reads++;return{code:200,data:{'186016':false}};}
    if(path==='song/like'){writes++;return{code:200};}
    throw new Error('unexpected request');
  },{wait:async()=>{waits++;}});
  assert.deepEqual(await target.add(account,session,'186016',signal()),{status:'unconfirmed'});
  assert.equal(reads,3);assert.equal(writes,1);assert.equal(waits,1);
});

test('the second NetEase read-back may confirm without another write',async()=>{
  let reads=0,writes=0;
  const {client:target}=client(async(path)=>{
    if(path==='song/like/check'){reads++;return{code:200,data:{'186016':reads===3}};}
    if(path==='song/like'){writes++;return{code:200};}
    throw new Error('unexpected request');
  });
  assert.deepEqual(await target.add(account,session,'186016',signal()),{status:'added'});
  assert.equal(reads,3);assert.equal(writes,1);
});

test('a read failure after writing is unknown rather than a failed or successful write',async()=>{
  let reads=0;
  const {client:target}=client(async(path)=>{
    if(path==='song/like/check'){reads++;return reads===1?{code:200,data:{'186016':false}}:{code:503};}
    if(path==='song/like')return{code:200};
    throw new Error('unexpected request');
  });
  assert.deepEqual(await target.add(account,session,'186016',signal()),{status:'unknown',code:503});
});

test('malformed NetEase read responses are unavailable and never trigger a write',async()=>{
  for(const response of [
    {code:200},
    {code:200,data:{}},
    {code:200,data:[{id:'186016'}]},
    {code:200,data:['not-an-id']},
    {code:200,data:{'186016':'maybe'}},
  ]){
    let writes=0;
    const {client:target}=client(async(path)=>{
      if(path==='song/like/check')return response;
      writes++;return{code:200};
    });
    assert.deepEqual(await target.add(account,session,'186016',signal()),{status:'unavailable'});
    assert.equal(writes,0);
  }
});

test('identity or session mismatches fail before any NetEase request',async()=>{
  const cases:{account:MusicAccount;session:MusicSession}[]=[
    {account:{...account,platform:'tx'},session},
    {account,session:{...session,accountId:'d'.repeat(64)}},
    {account:{...account,username:'netease:999'},session},
    {account,session:{...session,userId:'999'}},
    {account,session:{...session,cookies:{__csrf:'unit-csrf'}}},
  ];
  for(const {account:target,session:current} of cases){
    let calls=0;
    const {client:instance}=client(async()=>{calls++;return{code:200};},{accounts:()=>[target]});
    assert.deepEqual(await instance.add(target,current,'186016',signal()),{status:'login_required'});
    assert.equal(calls,0);
  }
});

test('invalid NetEase track identifiers are unsupported before any request',async()=>{
  for(const id of ['', '0', 'abc', '-1', '90071992547409931234']){
    let calls=0;
    const {client:target}=client(async()=>{calls++;return{code:200};});
    assert.deepEqual(await target.add(account,session,id,signal()),{status:'unsupported'});
    assert.equal(calls,0);
  }
});

test('19-digit NetEase identifiers stay opaque strings rather than unsafe numbers',async()=>{
  const bigAccount:MusicAccount={...account,username:'netease:9000000000000000003'};
  const bigSession:MusicSession={...session,userId:'9000000000000000003'};
  let writes=0;
  const {client:target}=client(async(path)=>{
    if(path==='song/like/check')return{code:200,data:{'9000000000000000003':true}};
    writes++;return{code:200};
  },{accounts:()=>[bigAccount]});
  assert.deepEqual(await target.add(bigAccount,bigSession,'9000000000000000003',signal()),{status:'already'});
  assert.equal(writes,0);
});

test('cancellation before the first NetEase request never writes',async()=>{
  let calls=0;
  const controller=new AbortController();
  const {client:target}=client(async()=>{calls++;return{code:200};});
  controller.abort();
  assert.deepEqual(await target.add(account,session,'186016',controller.signal),{status:'cancelled'});
  assert.equal(calls,0);
});

test('cancellation after a NetEase write request cannot publish a late success',async()=>{
  let writes=0;
  const controller=new AbortController();
  const {client:target}=client(async(path,_data,currentSignal)=>{
    if(path==='song/like/check')return{code:200,data:{'186016':false}};
    if(path==='song/like'){
      writes++;
      return new Promise((_resolve,reject)=>{
        const abort=()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'}));
        currentSignal.addEventListener('abort',abort,{once:true});
      });
    }
    throw new Error('unexpected request');
  });
  const pending=target.add(account,session,'186016',controller.signal);
  while(!writes)await new Promise(resolve=>setImmediate(resolve));
  controller.abort();
  assert.deepEqual(await pending,{status:'cancelled'});
  assert.equal(writes,1);
});

test('NetEase account removal while a write is in flight prevents a late success',async()=>{
  let accounts:readonly MusicAccount[]=[account],writes=0;
  const {client:target}=client(async(path)=>{
    if(path==='song/like/check')return{code:200,data:{'186016':false}};
    if(path==='song/like'){writes++;accounts=[];return{code:200};}
    throw new Error('unexpected request');
  },{accounts:()=>accounts});
  assert.deepEqual(await target.add(account,session,'186016',signal()),{status:'account_changed'});
  assert.equal(writes,1);
});

test('concurrent duplicate NetEase favorite requests share one write',async()=>{
  let writes=0,release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  let reads=0;
  const {client:target}=client(async(path)=>{
    if(path==='song/like/check'){reads++;if(reads===1)await held;return{code:200,data:{'186016':false}};}
    if(path==='song/like'){writes++;return{code:200};}
    throw new Error('unexpected request');
  });
  const first=target.add(account,session,'186016',signal()),second=target.add(account,session,'186016',signal());
  assert.equal(first,second);
  release();
  assert.deepEqual(await first,{status:'unconfirmed'});
  assert.equal(writes,1);
});

test('a NetEase HTTP authentication failure after writing is unknown rather than failed',async()=>{
  let writes=0;
  const {HTTPResponseError}=await import('../src/providers/http.ts');
  const {client:strict}=client(async(path)=>{
    if(path==='song/like/check')return{code:200,data:{'186016':false}};
    if(path==='song/like'){writes++;throw new HTTPResponseError(403);}
    throw new Error('unexpected request');
  });
  assert.deepEqual(await strict.add(account,session,'186016',signal()),{status:'unknown'});
  assert.equal(writes,1);
});

test('the NetEase request body keeps the encrypted weapi envelope and no cookie material',async()=>{
  let seen:'read'|'write'|undefined;
  const instance=new NeteaseFavoriteClient({
    http:async(url,request)=>{
      assert.match(url,/^https:\/\/music\.163\.com\/weapi\/song\/like(?:\/check)?$/);
      assert.equal(request.credentials,'omit');
      assert.match(String(request.body),/^params=[^&]+&encSecKey=[a-f0-9]{256}$/);
      assert.doesNotMatch(String(request.body),/unit-only-key|unit-csrf/);
      if(url.endsWith('/check')){seen??='read';return{code:200,data:{'186016':seen==='write'}};}
      seen='write';return{code:200};
    },
    accounts:{getSnapshot:()=>[account]},
    wait:async()=>{},
  });
  assert.deepEqual(await instance.add(account,session,'186016',signal()),{status:'added'});
});
