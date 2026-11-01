import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Track} from '../src/domain/track.ts';
import {publicSongURL,songShareText} from '../src/domain/songShare.ts';
const track=(platform:'wy'|'tx'|'kw'|'kg'|'mg',id:string,metadata:Record<string,unknown>={}):Track=>({origin:{kind:'online',platform,id},title:'Public song',artist:'Public artist',metadata,qualities:[]});
test('public sharing builds five platform detail links from the correct identity namespace',()=>{
 assert.equal(publicSongURL(track('wy','28692519')),'https://music.163.com/#/song?id=28692519');
 assert.equal(publicSongURL(track('tx','003aAYrm3GE0Ac')),'https://y.qq.com/n/yqq/song/003aAYrm3GE0Ac.html');
 assert.equal(publicSongURL(track('kw','123456789')),'https://www.kuwo.cn/play_detail/123456789');
 assert.equal(publicSongURL(track('kg','999_ABC',{hash:'a'.repeat(32),albumId:'123'})),`https://www.kugou.com/song/#hash=${'A'.repeat(32)}&album_id=123`);
 assert.equal(publicSongURL(track('mg','internal-song-id',{copyrightId:'60012345678'})),'https://music.migu.cn/v3/music/song/60012345678');
});
test('sharing never forwards arbitrary playback URLs or authentication metadata',()=>{
 const input=track('wy','28692519',{url:'https://private.invalid/?token=private-marker',headers:{Authorization:'Bearer private-marker'},cookie:'private-marker'}),before=structuredClone(input),text=songShareText(input);
 assert.equal(text,'Public song — Public artist\nhttps://music.163.com/#/song?id=28692519');assert.ok(!text.includes('private-marker'));assert.deepEqual(input,before);
});
test('private and local sources share visible names without account, path or media identifiers',()=>{
 const origins:Track['origin'][]=[{kind:'navidrome',accountId:'private-account',id:'private-id'},{kind:'webdav',accountId:'private-account',id:'private-id'},{kind:'local',id:'private-path'},{kind:'device',libraryId:'private-library',id:'private-id'},{kind:'imported',platform:'qishui',id:'private-id'}];
 for(const origin of origins){const item={...track('wy','1'),origin,metadata:{url:'https://private.invalid/?token=secret'}};assert.equal(publicSongURL(item),undefined);assert.equal(songShareText(item),'Public song — Public artist');}
});
test('malformed identities and route injection fall back to name-only content',()=>{
 for(const item of [track('wy','1&token=secret'),track('tx','../private'),track('kw','0'),track('kg','bad',{hash:'https://private.invalid',albumId:'1&token=secret'}),track('mg','123',{copyrightId:'../private'})]){assert.equal(publicSongURL(item),undefined);assert.equal(songShareText(item),'Public song — Public artist');}
 const kg=track('kg','a'.repeat(32),{albumId:'1&token=secret'});assert.ok(!songShareText(kg).includes('token'));
});
test('share text bounds visible metadata, removes hidden controls and handles missing names',()=>{
 const item=track('wy','1');item.title=' A\n B\u0000 C ';item.artist=' Artist\t Name ';assert.equal(songShareText(item),'A B C — Artist Name\nhttps://music.163.com/#/song?id=1');
 item.title='x'.repeat(1000);item.artist='';assert.equal(songShareText(item).split('\n')[0]!.length,160);item.title='';assert.ok(songShareText(item).startsWith('未命名歌曲'));
});
