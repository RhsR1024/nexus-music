import test from 'node:test';
import assert from 'node:assert/strict';
import {parseQQCookiePayload,qqWebIdentity,QQAccountProfileClient,QQAccountProfileError} from '../src/providers/qqAccountProfile.ts';
import {HTTPResponseError} from '../src/providers/http.ts';

const cookies={qqmusic_key:'synthetic-qq-key',qqmusic_uin:'o000042',login_type:'1'};
const session={platform:'tx',userId:'42',cookies};
const profile={code:0,data:{creator:{nick:'Fixture listener'}}};
const authorized={code:0,status:{code:0,data:{}}};

test('QQ web cookies require a music key and numeric QQ identity; retain no unrelated cookies',()=>{
  assert.deepEqual(parseQQCookiePayload(JSON.stringify({...cookies,unrelated:'drop'})),cookies);
  assert.deepEqual(qqWebIdentity(cookies),{uin:'42',authst:'synthetic-qq-key',tmeLoginType:2});
  assert.equal(qqWebIdentity({...cookies,qqmusic_key:'Q_H_L-synthetic',musickey:'synthetic-music-key'}).authst,'Q_H_L-synthetic');
  for(const value of [{uin:'42',skey:'generic-qq-key'},{...cookies,qqmusic_uin:'0'},{...cookies,qqmusic_key:'bad\r\nX: value'},
    {...cookies,login_type:'2',wxuin:'99'},{...cookies,login_type:undefined,wxuin:'99'},
    {...cookies,login_type:undefined,qqmusic_key:'W_X-synthetic'}])assert.throws(()=>parseQQCookiePayload(JSON.stringify(value)));
});

test('QQ public profile is insufficient when the official music authorization check rejects the session',async()=>{
  for(const raw of [{code:0,status:{code:1000,data:{}}},{code:0,status:{data:{}}},{code:0,status:{code:0}},{status:{code:0,data:{}}}]){
    let calls=0;
    const client=new QQAccountProfileClient({http:async()=>++calls===1?profile:raw});
    await assert.rejects(client.fetch(session,new AbortController().signal),error=>error instanceof QQAccountProfileError&&error.kind==='login_required');
    assert.equal(calls,2);
  }
});

test('QQ requests bind both official checks to the music identity and discard returned playlist content',async()=>{
  let count=0;
  const client=new QQAccountProfileClient({http:async(url,request)=>{
    count++;
    assert.equal(request.credentials,'omit');
    assert.equal(request.headers?.Cookie,'qqmusic_key=synthetic-qq-key; qqmusic_uin=o000042; login_type=1');
    if(count===1){assert.equal(url,'https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?ct=20&cv=4747474&cid=205360838&userid=42');return profile;}
    assert.equal(url,'https://u.y.qq.com/cgi-bin/musicu.fcg');
    assert.deepEqual(JSON.parse(request.body??''),{comm:{uin:'42',authst:'synthetic-qq-key',ct:24,cv:0,format:'json',tmeAppID:'qqmusic',tmeLoginType:2},status:{module:'music.musicasset.PlaylistBaseRead',method:'GetPlaylistByUin',param:{uin:'42'}}});
    return{code:0,status:{code:0,data:{list:[{name:'synthetic list must not be exposed'}]}}};
  }});
  assert.deepEqual(await client.fetch(session,new AbortController().signal),{userId:'42',nickname:'Fixture listener'});
  assert.equal(count,2);
});

test('QQ validation rejects missing profile, wrong platform and raw service errors without leaking details',async()=>{
  for(const raw of [{code:0,data:{creator:{}}},{code:0,data:{creator:{nick:'bad\nname'}}},{code:401}]){
    const client=new QQAccountProfileClient({http:async()=>raw});
    await assert.rejects(client.fetch(session,new AbortController().signal),error=>error instanceof QQAccountProfileError);
  }
  for(const [error,kind] of [[new HTTPResponseError(403),'login_required'],[new Error('private raw response'),'unavailable']] as const){
    const client=new QQAccountProfileClient({http:async()=>{throw error;}});
    await assert.rejects(client.fetch(session,new AbortController().signal),caught=>caught instanceof QQAccountProfileError&&caught.kind===kind&&!caught.message.includes('private'));
  }
  const client=new QQAccountProfileClient({http:async()=>{assert.fail('wrong-platform request');}});
  await assert.rejects(client.fetch({...session,platform:'wy'},new AbortController().signal),error=>error instanceof QQAccountProfileError&&error.kind==='login_required');
  await assert.rejects(client.fetch({...session,userId:'99'},new AbortController().signal),error=>error instanceof QQAccountProfileError&&error.kind==='login_required');
});

test('QQ cancellation after either response prevents a successful profile result',async()=>{
  for(const cancelAt of [1,2]){
    const controller=new AbortController();let calls=0;
    const client=new QQAccountProfileClient({http:async()=>{calls++;if(calls===cancelAt)controller.abort();return calls===1?profile:authorized;}});
    await assert.rejects(client.fetch(session,controller.signal),error=>error instanceof QQAccountProfileError&&error.kind==='cancelled');
    assert.equal(calls,cancelAt);
  }
});

test('QQ encrypted playlist owner is exposed only after authorization and remains optional and bounded',async()=>{
  for(const value of ['unit-only-encrypted-owner','x'.repeat(1025),'bad\nowner',42]){
    let count=0;const client=new QQAccountProfileClient({http:async()=>++count===1?{code:0,data:{creator:{nick:'Public listener',encrypt_uin:value}}}:authorized});
    const result=await client.fetch(session,new AbortController().signal);assert.equal(count,2);
    assert.equal(result.encryptedUin,typeof value==='string'&&value==='unit-only-encrypted-owner'?value:undefined);
  }
});
