import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parsePlaylistLink} from '../src/providers/playlistLink.ts';
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
