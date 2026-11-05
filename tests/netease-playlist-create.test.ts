import test from 'node:test';
import assert from 'node:assert/strict';
import {NeteasePlaylistCreateClient} from '../src/providers/neteasePlaylistCreate.ts';
import type {MusicAccount,MusicSession} from '../src/providers/musicAccounts.ts';
import type {HTTPRequest} from '../src/providers/http.ts';

const account:MusicAccount={id:'c'.repeat(64),platform:'wy',username:'netease:123456789',label:'网易云音乐',capabilities:[],updatedAt:1};
const session:MusicSession={version:1,platform:'wy',accountId:account.id,userId:'123456789',cookies:{MUSIC_U:'unit-only-key',__csrf:'unit-csrf'}};
const signal=()=>new AbortController().signal;
interface Call {path:string;data:Record<string,unknown>}

function client(handler:(path:string,data:Record<string,unknown>,signal:AbortSignal)=>Promise<unknown>,options:{accounts?:()=>readonly MusicAccount[];session?:()=>Promise<MusicSession>}={}){
  const calls:Call[]=[];
  const instance=new NeteasePlaylistCreateClient({
    http:async(url,request:HTTPRequest,currentSignal)=>{
      assert.equal(request.credentials,'omit');
      assert.equal(request.headers?.Cookie,'MUSIC_U=unit-only-key; __csrf=unit-csrf');
      const path=url.replace('https://music.163.com/weapi/','');
      return handler(path,calls.at(-1)!.data,currentSignal);
    },
    accounts:{
      getSnapshot:options.accounts??(()=>[account]),
      session:options.session??(async()=>session),
    },
    weapi:(data)=>{
      calls.push({path:'',data:{...data}});
      return{method:'POST',headers:{Cookie:'MUSIC_U=unit-only-key; __csrf=unit-csrf'},body:'params=unit&encSecKey=unit'};
    },
  });
  return {client:instance,calls};
}
const catalog=(entries:unknown[],more=false)=>({code:200,more,playlist:entries});
const created=(id='9100000000000000001',name='合成公益歌单')=>({code:200,playlist:{id,name}});
const entry=(id='9100000000000000001',name='合成公益歌单',owner='123456789')=>({id,name,privacy:10,trackCount:0,coverImgUrl:'https://p1.music.126.net/cover.jpg',creator:{userId:owner}});

test('creating a NetEase playlist reads the same id and name back before success',async()=>{
  let writes=0,reads=0;
  const {client:target,calls}=client(async(path)=>{
    if(path==='playlist/create'){writes++;return created();}
    reads++;return catalog([entry()]);
  });
  const result=await target.create(account,'合成公益歌单',10,signal());
  assert.deepEqual(result,{status:'created',playlist:{id:'9100000000000000001',title:'合成公益歌单',count:0,coverUrl:'https://p1.music.126.net/cover.jpg',kind:'created'}});
  assert.equal(writes,1);assert.equal(reads,1);
  assert.deepEqual(calls[0]?.data,{name:'合成公益歌单',privacy:'10',type:'NORMAL'});
  assert.deepEqual(calls[1]?.data,{uid:'123456789',offset:0,limit:100,includeVideo:false});
  assert.doesNotMatch(JSON.stringify(result),/unit-only-key|unit-csrf/);
});

test('a successful create response without a read-back match stays unconfirmed and never retries',async()=>{
  let writes=0,reads=0;
  const {client:target}=client(async(path)=>{
    if(path==='playlist/create'){writes++;return created();}
    reads++;return catalog([]);
  });
  assert.deepEqual(await target.create(account,'合成公益歌单',0,signal()),{status:'unconfirmed',id:'9100000000000000001'});
  assert.equal(writes,1);assert.equal(reads,1);
});

test('a read-back title or owner mismatch is not reported as created',async()=>{
  for(const value of [entry(undefined,'另一个名称'),entry(undefined,undefined,'987654321')]){
    let writes=0;
    const {client:target}=client(async(path)=>{
      if(path==='playlist/create'){writes++;return created();}
      return catalog([value]);
    });
    assert.deepEqual(await target.create(account,'合成公益歌单',10,signal()),{status:'unconfirmed',id:'9100000000000000001'});
    assert.equal(writes,1);
  }
});

test('malformed create and malformed read-back shapes are unconfirmed rather than success',async()=>{
  const malformedCreate=[{code:200},{code:200,playlist:{}},{code:200,playlist:{id:'0',name:'合成公益歌单'}}];
  for(const response of malformedCreate){
    let reads=0;
    const {client:target}=client(async(path)=>{
      if(path==='playlist/create')return response;
      reads++;return catalog([entry()]);
    });
    assert.deepEqual(await target.create(account,'合成公益歌单',10,signal()),{status:'unconfirmed'});
    assert.equal(reads,0);
  }
  for(const response of [
    {code:200,more:false},
    {code:200,more:false,playlist:[{id:'bad',name:'合成公益歌单'}]},
    {code:200,more:false,playlist:[{...entry(),trackCount:-1}]},
  ]){
    let writes=0;
    const {client:target}=client(async(path)=>{
      if(path==='playlist/create'){writes++;return created();}
      return response;
    });
    assert.deepEqual(await target.create(account,'合成公益歌单',10,signal()),{status:'unconfirmed',id:'9100000000000000001'});
    assert.equal(writes,1);
  }
});

test('a rejected create is explicit and never reads the catalog',async()=>{
  let reads=0;
  const {client:target}=client(async(path)=>{
    if(path==='playlist/create')return{code:500};
    reads++;return catalog([]);
  });
  assert.deepEqual(await target.create(account,'合成公益歌单',10,signal()),{status:'rejected',code:500});
  assert.equal(reads,0);
});

test('read-back rejects an explicit privacy mismatch but tolerates an omitted field',async()=>{
  for(const actual of [undefined,0,10]){
    const {client:target}=client(async(path)=>path==='playlist/create'?created():catalog([{...entry(),privacy:actual}]));
    assert.equal((await target.create(account,'合成公益歌单',10,signal())).status,actual===0?'unconfirmed':'created');
  }
  const {client:target}=client(async(path)=>path==='playlist/create'?created():catalog([{...entry(),privacy:0}]));
  assert.equal((await target.create(account,'合成公益歌单',0,signal())).status,'created');
});

test('cancellation and account changes while opening the session preserve their status without writing',async()=>{
  for(const changed of [false,true]){
    let accounts:readonly MusicAccount[]=[account],calls=0;
    const controller=new AbortController();
    const {client:target}=client(async()=>{calls++;return created();},{
      accounts:()=>accounts,
      session:async()=>{if(changed)accounts=[];else controller.abort();return session;},
    });
    assert.deepEqual(await target.create(account,'合成公益歌单',10,controller.signal),{status:changed?'account_changed':'cancelled'});
    assert.equal(calls,0);
  }
});

test('NetEase authentication failures during create are explicit',async()=>{
  const {client:target}=client(async()=>({code:301}));
  assert.deepEqual(await target.create(account,'合成公益歌单',10,signal()),{status:'login_required',code:301});
});

test('invalid playlist names and privacy values are unsupported before any request',async()=>{
  for(const name of ['','   ','\n','x'.repeat(41),'name\u0000control']){
    let calls=0;
    const {client:target}=client(async()=>{calls++;return created();});
    assert.deepEqual(await target.create(account,name,10,signal()),{status:'unsupported'});
    assert.equal(calls,0);
  }
  let calls=0;
  const {client:target}=client(async()=>{calls++;return created();});
  assert.deepEqual(await target.create(account,'合成公益歌单',1 as 0,signal()),{status:'unsupported'});
  assert.equal(calls,0);
});

test('identity or session mismatches fail before creating',async()=>{
  const cases:{account:MusicAccount;session:MusicSession}[]=[
    {account:{...account,platform:'tx'},session},
    {account,session:{...session,accountId:'d'.repeat(64)}},
    {account:{...account,username:'netease:999'},session},
    {account,session:{...session,userId:'999'}},
    {account,session:{...session,cookies:{__csrf:'unit-csrf'}}},
  ];
  for(const item of cases){
    let calls=0;
    const {client:target}=client(async()=>{calls++;return created();},{accounts:()=>[item.account],session:async()=>item.session});
    assert.deepEqual(await target.create(item.account,'合成公益歌单',10,signal()),{status:'login_required'});
    assert.equal(calls,0);
  }
});

test('cancellation before a request does not create',async()=>{
  let calls=0;
  const controller=new AbortController();
  const {client:target}=client(async()=>{calls++;return created();});
  controller.abort();
  assert.deepEqual(await target.create(account,'合成公益歌单',10,controller.signal),{status:'cancelled'});
  assert.equal(calls,0);
});

test('cancellation during create or read-back is unconfirmed because the write may exist',async()=>{
  for(const phase of ['create','read'] as const){
    let writes=0,reads=0;
    const controller=new AbortController();
    const {client:target}=client(async(path,_data,currentSignal)=>{
      if(path==='playlist/create'){
        writes++;
        if(phase==='create')return new Promise((_resolve,reject)=>{
          currentSignal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});
        });
        return created();
      }
      reads++;
      if(phase==='read')return new Promise((_resolve,reject)=>{
        currentSignal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});
      });
      return catalog([entry()]);
    });
    const pending=target.create(account,'合成公益歌单',10,controller.signal);
    while(writes===0||phase==='read'&&reads===0)await new Promise(resolve=>setImmediate(resolve));
    controller.abort();
    assert.deepEqual(await pending,phase==='create'?{status:'unconfirmed'}:{status:'unconfirmed',id:'9100000000000000001'});
  }
});

test('account removal after create prevents a late success',async()=>{
  let accounts:readonly MusicAccount[]=[account],writes=0;
  const {client:target}=client(async(path)=>{
    if(path==='playlist/create'){writes++;accounts=[];return created();}
    return catalog([entry()]);
  },{accounts:()=>accounts});
  assert.deepEqual(await target.create(account,'合成公益歌单',10,signal()),{status:'account_changed'});
  assert.equal(writes,1);
});

test('concurrent identical creates share one request while different names do not',async()=>{
  let writes=0,release!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;});
  const createdIds=new Map<string,string>();
  const {client:target}=client(async(path,data)=>{
    if(path==='playlist/create'){
      writes++;
      const name=String(data.name),id=`910000000000000000${writes}`;
      createdIds.set(name,id);
      if(data.name==='合成公益歌单')await held;
      return created(id,name);
    }
    return catalog([...createdIds].map(([name,id])=>entry(id,name)));
  });
  const first=target.create(account,'合成公益歌单',10,signal()),second=target.create(account,'合成公益歌单',10,signal());
  assert.equal(first,second);
  const other=target.create(account,'另一歌单',10,signal());
  release();
  assert.equal((await first).status,'created');
  assert.equal((await other).status,'created');
  assert.equal(writes,2);
});

test('19-digit owner and playlist identifiers stay opaque strings',async()=>{
  const bigAccount:MusicAccount={...account,username:'netease:9000000000000000003'};
  const bigSession:MusicSession={...session,userId:'9000000000000000003'};
  const id='9100000000000000001';
  const {client:target}=client(async(path)=>{
    if(path==='playlist/create')return created(id);
    return catalog([entry(id,undefined,'9000000000000000003')]);
  },{accounts:()=>[bigAccount],session:async()=>bigSession});
  assert.equal((await target.create(bigAccount,'合成公益歌单',10,signal())).status,'created');
});

test('read-back follows strict catalog pages when a new playlist is not on the first page',async()=>{
  let reads=0;
  const {client:target}=client(async(path)=>{
    if(path==='playlist/create')return created();
    reads++;
    return reads===1?catalog(Array.from({length:100},(_,index)=>entry(`92000000000000${String(index).padStart(4,'0')}`,'已有歌单')),true):catalog([entry()],false);
  });
  assert.equal((await target.create(account,'合成公益歌单',10,signal())).status,'created');
  assert.equal(reads,2);
});

test('the create request keeps the encrypted weapi envelope and no cookie material',async()=>{
  const instance=new NeteasePlaylistCreateClient({
    http:async(url,request)=>{
      assert.match(url,/^https:\/\/music\.163\.com\/weapi\/(?:playlist\/create|user\/playlist)$/);
      assert.equal(request.credentials,'omit');
      assert.match(String(request.body),/^params=[^&]+&encSecKey=[a-f0-9]{256}$/);
      assert.doesNotMatch(String(request.body),/unit-only-key|unit-csrf/);
      return url.endsWith('/playlist/create')?created():catalog([entry()]);
    },
    accounts:{getSnapshot:()=>[account],session:async()=>session},
  });
  assert.equal((await instance.create(account,'合成公益歌单',10,signal())).status,'created');
});
