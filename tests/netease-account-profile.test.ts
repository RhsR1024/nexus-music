import test from 'node:test';
import assert from 'node:assert/strict';
import {HTTPResponseError} from '../src/providers/http.ts';
import {NeteaseAccountProfileClient,NeteaseAccountProfileError,parseNeteaseAccountProfile} from '../src/providers/neteaseAccountProfile.ts';

const session={platform:'wy' as const,cookies:{MUSIC_U:'synthetic-auth',__csrf:'synthetic-csrf'}};

test('official account profile validates numeric identity and bounded nickname',()=>{
  assert.deepEqual(parseNeteaseAccountProfile({code:200,profile:{userId:42,nickname:'Fixture listener'}}),{userId:'42',nickname:'Fixture listener'});
  assert.throws(()=>parseNeteaseAccountProfile({code:200,profile:null}),(error)=>error instanceof NeteaseAccountProfileError&&error.kind==='login_required');
  assert.throws(()=>parseNeteaseAccountProfile({code:200,profile:{userId:'not-an-id',nickname:'x'}}),(error)=>error instanceof NeteaseAccountProfileError&&error.kind==='login_required');
});

test('profile request sends only the bounded NetEase cookies to the official endpoint',async()=>{
  let captured:string[]=[];
  const client=new NeteaseAccountProfileClient({endpoint:'https://fixture.test/account',http:async(_url,request)=>{
    captured=[request.headers?.Cookie??'',request.headers?.Referer??'',request.headers?.Origin??''];
    return{code:200,profile:{userId:42,nickname:'Fixture listener'}};
  }});
  const profile=await client.fetch(session,new AbortController().signal);
  assert.equal(profile.userId,'42');
  assert.deepEqual(captured,['MUSIC_U=synthetic-auth; __csrf=synthetic-csrf','https://music.163.com/','https://music.163.com']);
});

test('expired, unavailable and cancelled profile reads do not expose protocol details',async()=>{
  for(const [error,kind] of [[new HTTPResponseError(403),'login_required'],[new Error('private upstream body'),'unavailable']] as const){
    const client=new NeteaseAccountProfileClient({endpoint:'https://fixture.test/account',http:async()=>{throw error;}});
    await assert.rejects(client.fetch(session,new AbortController().signal),(caught)=>caught instanceof NeteaseAccountProfileError&&caught.kind===kind&&!caught.message.includes('private'));
  }
  const controller=new AbortController();controller.abort();
  const client=new NeteaseAccountProfileClient();
  await assert.rejects(client.fetch(session,controller.signal),(error)=>error instanceof NeteaseAccountProfileError&&error.kind==='cancelled');
});
