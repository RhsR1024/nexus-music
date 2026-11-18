import test from 'node:test';
import assert from 'node:assert/strict';
import {NeteasePlaylistDeleteClient} from '../src/providers/neteasePlaylistDelete.ts';
import type {AccountPlaylist} from '../src/providers/accountPlaylists.ts';
import type {MusicAccount,MusicSession} from '../src/providers/musicAccounts.ts';
import {HTTPResponseError,type HTTPRequest} from '../src/providers/http.ts';

const account:MusicAccount={id:'c'.repeat(64),platform:'wy',username:'netease:123456789',label:'网易云音乐',capabilities:[],updatedAt:1};
const session:MusicSession={version:1,platform:'wy',accountId:account.id,userId:'123456789',cookies:{MUSIC_U:'unit-only-key',__csrf:'unit-csrf'}};
const playlist:AccountPlaylist={id:'9100000000000000011',title:'合成目标歌单',count:2,coverUrl:'',kind:'created'};
const signal=()=>new AbortController().signal;
interface Call {path:string;data:Record<string,unknown>}

function client(handler:(path:string,data:Record<string,unknown>,signal:AbortSignal)=>Promise<unknown>,options:{accounts?:()=>readonly MusicAccount[];session?:()=>Promise<MusicSession>;wait?:(milliseconds:number)=>Promise<void>}={}){
  const calls:Call[]=[];
  const instance=new NeteasePlaylistDeleteClient({
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
const catalog=(entries:unknown[],more=false)=>({code:200,more,playlist:entries});
const entry=(id=playlist.id,name='合成目标歌单',owner='123456789')=>({id,name,privacy:10,trackCount:2,coverImgUrl:'',creator:{userId:owner}});

test('deleting a present playlist sends one JSON one-id array and confirms absence',async()=>{
  let present=true,reads=0,writes=0;
  const {client:target,calls}=client(async(path)=>{
    if(path==='user/playlist'){reads++;return catalog(present?[entry()]:[]);}
    writes++;present=false;return{code:200};
  });
  const result=await target.delete(account,playlist,signal());
  assert.deepEqual(result,{status:'deleted'});
  assert.equal(writes,1);assert.equal(reads,2);
  assert.deepEqual(calls[1]?.data,{ids:JSON.stringify([playlist.id])});
  assert.deepEqual(calls[0]?.data,{uid:'123456789',offset:0,limit:100,includeVideo:false});
  assert.doesNotMatch(JSON.stringify(result),/unit-only-key|unit-csrf/);
});

test('an absent playlist remains idempotent with zero writes',async()=>{
  let reads=0,writes=0;
  const {client:target}=client(async(path)=>{
    if(path==='user/playlist'){reads++;return catalog([entry('9100000000000000099')]);}
    writes++;return{code:200};
  });
  assert.deepEqual(await target.delete(account,playlist,signal()),{status:'absent'});
  assert.equal(reads,1);assert.equal(writes,0);
});

test('a rejected delete is explicit and never reads the catalog again',async()=>{
  let reads=0,writes=0;
  const {client:target}=client(async(path)=>{
    if(path==='user/playlist'){reads++;return catalog([entry()]);}
    writes++;return{code:500};
  });
  assert.deepEqual(await target.delete(account,playlist,signal()),{status:'rejected',code:500});
  assert.equal(writes,1);assert.equal(reads,1);
});

test('code 200 alone never confirms deletion; two delayed rereads are required',async()=>{
  let reads=0,writes=0,waits=0;
  const {client:target}=client(async(path)=>{
    if(path==='user/playlist'){reads++;return catalog([entry()]);}
    writes++;return{code:200};
  },{wait:async(milliseconds)=>{waits++;assert.equal(milliseconds,800);}});
  assert.deepEqual(await target.delete(account,playlist,signal()),{status:'unconfirmed'});
  assert.equal(writes,1);assert.equal(reads,3);assert.equal(waits,1);
});

test('a read failure after an accepted write stays unconfirmed instead of claiming success',async()=>{
  for(const failure of [{code:500},{code:301},new HTTPResponseError(403)] as const){
    let reads=0,writes=0;
    const {client:target}=client(async(path)=>{
      if(path==='user/playlist'){
        reads++;
        if(reads>1)throw failure;
        return catalog([entry()]);
      }
      writes++;return{code:200};
    });
    assert.deepEqual(await target.delete(account,playlist,signal()),{status:'unconfirmed'});
    assert.equal(writes,1);assert.equal(reads,2);
  }
});

test('a failed write response is rejected unless it is an explicit auth failure',async()=>{
  for(const [code,status] of [[500,'rejected'],[301,'login_required'],[401,'login_required']] as const){
    let reads=0,writes=0;
    const {client:target}=client(async(path)=>{
      if(path==='user/playlist'){reads++;return catalog([entry()]);}
      writes++;return{code};
    });
    assert.deepEqual(await target.delete(account,playlist,signal()),{status,code});
    assert.equal(writes,1);assert.equal(reads,1);
  }
});

test('an initial auth or HTTP failure is explicit and never writes',async()=>{
  for(const failure of [{code:301},{code:403},new HTTPResponseError(401)] as const){
    let writes=0;
    const {client:target}=client(async(path)=>{
      if(path==='user/playlist'){
        if(failure instanceof Error)throw failure;
        return failure;
      }
      writes++;return{code:200};
    });
    const result=await target.delete(account,playlist,signal());
    assert.equal(result.status,'login_required');
    assert.equal(writes,0);
  }
});

test('malformed catalogs or a mismatched playlist owner fail before writing',async()=>{
  for(const response of [
    {code:200,more:false},
    {code:200,more:false,playlist:'bad'},
    {code:200,more:false,playlist:[{...entry(),id:'bad'}]},
    {code:200,more:'maybe',playlist:[entry('9100000000000000099')]},
    {code:200,more:true,playlist:[]},
    catalog([entry(playlist.id,'合成目标歌单','987654321')]),
  ]){
    let writes=0;
    const {client:target}=client(async(path)=>{
      if(path==='user/playlist')return response;
      writes++;return{code:200};
    });
    assert.deepEqual(await target.delete(account,playlist,signal()),{status:'unavailable'});
    assert.equal(writes,0);
  }
});

test('identity or session mismatches fail before any request',async()=>{
  const cases:{account:MusicAccount;session:MusicSession}[]=[
    {account:{...account,platform:'tx'},session},
    {account,session:{...session,platform:'tx'}},
    {account,session:{...session,accountId:'d'.repeat(64)}},
    {account:{...account,username:'netease:999'},session},
    {account,session:{...session,userId:'999'}},
    {account,session:{...session,cookies:{__csrf:'unit-csrf'}}},
    {account,session:{...session,version:2}},
  ];
  for(const item of cases){
    let calls=0;
    const {client:target}=client(async()=>{calls++;return catalog([]);},{accounts:()=>[item.account],session:async()=>item.session});
    assert.deepEqual(await target.delete(item.account,playlist,signal()),{status:'login_required'});
    assert.equal(calls,0);
  }
});

test('cancellation before writing is cancelled while cancellation during or after the write stays unconfirmed',async()=>{
  let calls=0;
  const before=new AbortController();before.abort();
  const first=client(async()=>{calls++;return catalog([]);});
  assert.deepEqual(await first.client.delete(account,playlist,before.signal),{status:'cancelled'});
  assert.equal(calls,0);

  for(const phase of ['read','write','confirm'] as const){
    const controller=new AbortController();
    let reads=0,writes=0;
    const {client:target}=client(async(path,_data,currentSignal)=>{
      if(path==='user/playlist'){
        reads++;
        if(phase==='read'&&reads===1)return new Promise((_resolve,reject)=>{
          currentSignal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});
        });
        if(phase==='confirm'&&reads===2)return new Promise((_resolve,reject)=>{
          currentSignal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});
        });
        return catalog([entry()]);
      }
      writes++;
      if(phase==='write')return new Promise((_resolve,reject)=>{
        currentSignal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});
      });
      return{code:200};
    });
    const pending=target.delete(account,playlist,controller.signal);
    while(writes===0&&phase!=='read'||phase==='read'&&reads===0||phase==='confirm'&&reads<2)await new Promise(resolve=>setImmediate(resolve));
    controller.abort();
    assert.deepEqual(await pending,phase==='read'?{status:'cancelled'}:{status:'unconfirmed'});
    assert.equal(writes,phase==='read'?0:1);
  }
});

test('cancellation while waiting between delayed rereads stays unconfirmed',async()=>{
  const controller=new AbortController();
  let reads=0,writes=0,waits=0;
  const {client:target}=client(async(path)=>{
    if(path==='user/playlist'){reads++;return catalog([entry()]);}
    writes++;return{code:200};
  },{wait:async()=>{waits++;controller.abort();}});
  assert.deepEqual(await target.delete(account,playlist,controller.signal),{status:'unconfirmed'});
  assert.equal(writes,1);assert.equal(reads,2);assert.equal(waits,1);
});

test('account replacement before writing is account_changed while replacement after writing is unconfirmed',async()=>{
  for(const phase of ['read','write'] as const){
    let accounts:readonly MusicAccount[]=[account],reads=0,writes=0;
    const {client:target}=client(async(path)=>{
      if(path==='user/playlist'){
        reads++;
        if(phase==='read')accounts=[];
        return catalog([entry()]);
      }
      writes++;accounts=[];return{code:200};
    },{accounts:()=>accounts});
    assert.deepEqual(await target.delete(account,playlist,signal()),{status:phase==='read'?'account_changed':'unconfirmed'});
    assert.equal(writes,phase==='read'?0:1);
  }
});

test('invalid kinds and identifiers are unsupported before any request',async()=>{
  for(const item of [
    {...playlist,kind:'favorite' as const},
    {...playlist,id:'dir:201'},
    {...playlist,id:'0'},
    {...playlist,id:''},
    {...playlist,id:'12345678901234567890'},
  ]){
    let calls=0;
    const {client:target}=client(async()=>{calls++;return catalog([]);});
    assert.deepEqual(await target.delete(account,item,signal()),{status:'unsupported'});
    assert.equal(calls,0);
  }
});

test('19-digit identifiers stay opaque and pagination finds a playlist after the first page',async()=>{
  const owner='9000000000000000003',id='9100000000000000001';
  const bigAccount:MusicAccount={...account,username:`netease:${owner}`};
  const bigSession:MusicSession={...session,userId:owner};
  const bigPlaylist:AccountPlaylist={...playlist,id};
  const fillers=Array.from({length:100},(_,index)=>entry(`92000000000000${String(index).padStart(4,'0')}`,'已有歌单',owner));
  let reads=0,writes=0;
  const {client:target,calls}=client(async(path)=>{
    if(path==='user/playlist'){
      reads++;
      return reads===1?catalog(fillers,true):reads===2?catalog([entry(id,'合成目标歌单',owner)],false):catalog([],false);
    }
    writes++;return{code:200};
  },{accounts:()=>[bigAccount],session:async()=>bigSession});
  assert.deepEqual(await target.delete(bigAccount,bigPlaylist,signal()),{status:'deleted'});
  assert.equal(writes,1);assert.equal(reads,3);
  assert.deepEqual(calls.filter(call=>call.data.uid).map(call=>call.data.offset),[0,100,0]);
});

test('concurrent identical deletes share one operation while another playlist stays independent',async()=>{
  let writes=0,release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  const present=new Set([playlist.id,'9100000000000000012']);
  const {client:target}=client(async(path,data)=>{
    if(path==='user/playlist')return catalog([...present].map(id=>entry(id)));
    writes++;
    const id=JSON.parse(String(data.ids))[0];
    if(id===playlist.id)await held;
    present.delete(id);
    return{code:200};
  });
  const first=target.delete(account,playlist,signal()),second=target.delete(account,playlist,signal());
  assert.equal(first,second);
  const other=target.delete(account,{...playlist,id:'9100000000000000012'},signal());
  release();
  assert.deepEqual(await first,{status:'deleted'});
  assert.deepEqual(await other,{status:'deleted'});
  assert.equal(writes,2);
});

test('the delete request keeps the encrypted weapi envelope and no cookie material',async()=>{
  let present=true,calls=0;
  const instance=new NeteasePlaylistDeleteClient({
    http:async(url,request)=>{
      calls++;
      assert.match(url,/^https:\/\/music\.163\.com\/weapi\/(?:user\/playlist|playlist\/remove)$/);
      assert.equal(request.credentials,'omit');
      assert.match(String(request.body),/^params=[^&]+&encSecKey=[a-f0-9]{256}$/);
      assert.doesNotMatch(String(request.body),/unit-only-key|unit-csrf/);
      if(url.endsWith('/playlist/remove')){present=false;return{code:200};}
      return catalog(present?[entry()]:[]);
    },
    accounts:{getSnapshot:()=>[account],session:async()=>session},
  });
  assert.deepEqual(await instance.delete(account,playlist,signal()),{status:'deleted'});
  assert.equal(calls,3);
});

test('the pending operation is released after completion so a later call can verify absence again',async()=>{
  let present=true,reads=0,writes=0;
  const {client:target}=client(async(path)=>{
    if(path==='user/playlist'){reads++;return catalog(present?[entry()]:[]);}
    writes++;present=false;return{code:200};
  });
  assert.deepEqual(await target.delete(account,playlist,signal()),{status:'deleted'});
  assert.deepEqual(await target.delete(account,playlist,signal()),{status:'absent'});
  assert.equal(reads,3);assert.equal(writes,1);
});
