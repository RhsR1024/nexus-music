import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAccountAvatar,validAccountAvatar} from '../src/domain/accountAvatar.ts';

test('account avatars keep a bounded public image URL and drop transient query data',()=>{
  assert.equal(normalizeAccountAvatar(' https://p1.music.126.net/avatar.jpg?param=200y200#fragment '),'https://p1.music.126.net/avatar.jpg');
  assert.equal(normalizeAccountAvatar('http://imgsrc.kugou.com/avatar.jpg?signature=private'),'https://imgsrc.kugou.com/avatar.jpg');
  assert.equal(normalizeAccountAvatar('//thirdqq.qlogo.cn/g?b=qq&k=synthetic&s=140'),'https://thirdqq.qlogo.cn/g');
});

test('account avatars permit loopback HTTP only for local fixtures',()=>{
  assert.equal(normalizeAccountAvatar('http://127.0.0.1:18439/account-avatar.png'),'http://127.0.0.1:18439/account-avatar.png');
  assert.equal(normalizeAccountAvatar('http://localhost:18439/account-avatar.png'),'http://localhost:18439/account-avatar.png');
  assert.equal(normalizeAccountAvatar('http://[::1]:18439/account-avatar.png'),'http://[::1]:18439/account-avatar.png');
  assert.equal(normalizeAccountAvatar('http://public.example/avatar.png'),'https://public.example/avatar.png');
});

test('account avatars reject credentials, non-image schemes, controls and unbounded values',()=>{
  for(const value of ['','   ','javascript:alert(1)','data:image/png;base64,AAAA','ftp://example.test/a.png',
    'https://user:secret@example.test/a.png','https://example.test/a\nb.png','https://'+'a'.repeat(2048),null,42]){
    assert.equal(normalizeAccountAvatar(value),undefined);
  }
});

test('stored avatars must already be in normalized form',()=>{
  assert.equal(validAccountAvatar('https://p1.music.126.net/avatar.jpg'),true);
  assert.equal(validAccountAvatar('http://127.0.0.1:18439/account-avatar.png'),true);
  assert.equal(validAccountAvatar('https://p1.music.126.net/avatar.jpg?param=200y200'),false);
  assert.equal(validAccountAvatar('http://public.example/avatar.png'),false);
});
