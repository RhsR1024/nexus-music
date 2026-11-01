import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DeadlineError} from '../src/providers/async.ts';
import {parsePlaylistLink,resolvePlaylistLink,type PlaylistLinkExpander} from '../src/providers/playlistLink.ts';
test('public playlist links preserve long IDs and identify official platform domains',()=>{
  for(const [link,platform,id] of [
    ['https://music.163.com/#/playlist?id=9007199254740993123','wy','9007199254740993123'],
    ['分享 https://y.qq.com/n/ryqq/playlist/1234567','tx','1234567'],
    ['https://m.kuwo.cn/h5app/playlist/1234?t=qqfriend','kw','1234'],
    ['https://www.kugou.com/yy/special/single/1234.html','kg','1234'],
    ['https://h5.nf.migu.cn/app/v4/p/share/playlist/index.html?id=1234','mg','1234'],
  ]as const)assert.deepEqual(parsePlaylistLink(link),{platform,id});
});
test('playlist links reject spoofed hosts, credentials, mismatched platform and arbitrary URLs',()=>{
  for(const value of ['https://music.163.com.attacker.invalid/playlist?id=123','https://user:secret@music.163.com/playlist?id=123','file:///playlist/123','https://localhost:8000/playlist/123'])assert.throws(()=>parsePlaylistLink(value));
  assert.throws(()=>parsePlaylistLink('https://music.163.com/playlist?id=123','tx'));
  assert.deepEqual(parsePlaylistLink('9007199254740993123','wy'),{platform:'wy',id:'9007199254740993123'});
});
test('playlist input cleanup handles escaped ampersands, invisible characters and copied punctuation',()=>{
  assert.deepEqual(parsePlaylistLink('\u200b分享 https://music.163.com/#/playlist?foo=1&amp;id=123\u2060，。'),{platform:'wy',id:'123'});
  assert.deepEqual(parsePlaylistLink('（https://y.qq.com/n/ryqq/playlist/1234），'),{platform:'tx',id:'1234'});
});
test('direct playlist identities resolve without a short-link request',async()=>{
  let calls=0;const controller=new AbortController();
  const result=await resolvePlaylistLink('https://www.kugou.com/yy/special/single/1234.html','kg',controller.signal,async()=>{calls++;return''});
  assert.deepEqual(result,{platform:'kg',id:'1234'});assert.equal(calls,0);
});
test('official NetEase short links expand once with credentials omitted by the production transport contract',async()=>{
  const calls:string[]=[];
  const result=await resolvePlaylistLink('分享 https://163cn.tv/AbCd，','wy',new AbortController().signal,async(url,signal)=>{
    assert.equal(signal.aborted,false);calls.push(url);
    return'https://music.163.com/#/playlist?id=9007199254740993123';
  });
  assert.deepEqual(calls,['https://163cn.tv/AbCd']);
  assert.deepEqual(result,{platform:'wy',id:'9007199254740993123'});
});
test('short links reject spoofed domains, credentials, ports, mismatch and invalid expansion',async()=>{
  let calls=0;
  for(const value of ['https://163cn.tv.attacker.invalid/AbCd','https://user:secret@163cn.tv/AbCd','https://163cn.tv:443/AbCd'])assert.throws(()=>parsePlaylistLink(value));
  await assert.rejects(()=>resolvePlaylistLink('https://163cn.tv/AbCd','tx',new AbortController().signal,async()=>{calls++;return'https://music.163.com/#/playlist?id=123';}),/分享链接与所选平台不同/);
  await assert.rejects(()=>resolvePlaylistLink('https://163cn.tv/AbCd','wy',new AbortController().signal,async()=>{calls++;return'https://attacker.invalid/#/playlist?id=123';}));
  assert.equal(calls,2);
});
test('short-link expansion is bounded even when its transport ignores cancellation',async()=>{
  let childSignal:AbortSignal|undefined;
  const expand:PlaylistLinkExpander=(_url,signal)=>{childSignal=signal;return new Promise(resolve=>setTimeout(()=>resolve('https://music.163.com/#/playlist?id=123'),100));};
  await assert.rejects(()=>resolvePlaylistLink('https://163cn.tv/AbCd','wy',new AbortController().signal,expand,5),(error:unknown)=>error instanceof DeadlineError);
  assert.equal(childSignal?.aborted,true);
});
test('cancelled short-link reads reject promptly and ignore a late result',async()=>{
  const controller=new AbortController();let release:(value:string)=>void=()=>{};
  const expand:PlaylistLinkExpander=(_url,signal)=>new Promise((resolve,reject)=>{
    release=resolve;
    signal.addEventListener('abort',()=>reject(Object.assign(new Error('读取已取消'),{name:'AbortError'})),{once:true});
  });
  const pending=resolvePlaylistLink('https://163cn.tv/AbCd','wy',controller.signal,expand,1000);
  controller.abort();
  await assert.rejects(pending,(error:unknown)=>error instanceof Error&&error.name==='AbortError');
  release('https://music.163.com/#/playlist?id=123');
  assert.equal(controller.signal.aborted,true);
});
test('a failed short-link read can be retried successfully',async()=>{
  let calls=0;
  const expand:PlaylistLinkExpander=async()=>{calls++;if(calls===1)throw new TypeError('Network request failed');return'https://music.163.com/#/playlist?id=123';};
  await assert.rejects(()=>resolvePlaylistLink('https://163cn.tv/AbCd','wy',new AbortController().signal,expand));
  assert.deepEqual(await resolvePlaylistLink('https://163cn.tv/AbCd','wy',new AbortController().signal,expand),{platform:'wy',id:'123'});
  assert.equal(calls,2);
});
