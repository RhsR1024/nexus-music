import test from 'node:test';
import assert from 'node:assert/strict';
import {parseQQCookiePayload,qqWebIdentity,qqMusicIdentity,QQAccountProfileClient,QQAccountProfileError} from '../src/providers/qqAccountProfile.ts';
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


test('imported WX identity never falls back to a residual QQ uin or QQ web credentials',()=>{
  const wx={qqmusic_key:'Q_H_L-residual',musickey:'W_X-unit-only',wxuin:'o000099',qqmusic_uin:'99',uin:'42',login_type:'2'};
  assert.deepEqual(qqMusicIdentity(wx),{uin:'99',authst:'W_X-unit-only',tmeLoginType:1});
  assert.throws(()=>parseQQCookiePayload(JSON.stringify(wx)));
  assert.deepEqual(parseQQCookiePayload(JSON.stringify(wx),'music'),wx);
  for(const value of [{login_type:'2',uin:'42',qqmusic_key:'W_X-unit-only'},{login_type:'2',wxuin:'99',qqmusic_key:'Q_H_L-residual'},
    {...wx,login_type:undefined},{...wx,login_type:'3'}])assert.throws(()=>qqMusicIdentity(JSON.parse(JSON.stringify(value))));
  assert.equal(qqMusicIdentity(cookies).tmeLoginType,2);
});

test('WX official profile and music authorization use its own ID and tmeLoginType',async()=>{
  const wx={login_type:'2',wxuin:'99',qqmusic_uin:'99',uin:'42',qqmusic_key:'W_X-unit-only'};let calls=0;
  const client=new QQAccountProfileClient({http:async(url,request)=>{
    if(++calls===1){assert.ok(url.endsWith('userid=99'));return profile;}
    const body=JSON.parse(request.body??'{}');assert.equal(body.comm.tmeLoginType,1);assert.equal(body.comm.uin,'99');assert.equal(body.comm.authst,'W_X-unit-only');assert.equal(body.status.param.uin,'99');return authorized;
  }});
  assert.deepEqual(await client.fetch({platform:'tx',userId:'99',cookies:wx},new AbortController().signal),{userId:'99',nickname:'Fixture listener'});
  await assert.rejects(client.fetch({platform:'tx',userId:'42',cookies:wx},new AbortController().signal));assert.equal(calls,2);
});
