import test from 'node:test';
import assert from 'node:assert/strict';
import {exportLRC,exportAudioMetadata} from '../src/domain/downloadAttachments.ts';
import {parseLyrics} from '../src/lyrics/parser.ts';
import type {Track} from '../src/domain/track.ts';

test('LRC export preserves timestamps, translated lines and Unicode text without playback offsets',()=>{
 const text=exportLRC({synced:true,plain:[],lines:[{startMs:12345,text:'First\r\nline',translation:'翻译',romanization:'roman'},{startMs:60010,text:'زبان\u200cفارسی 👩‍👩‍👧'}]});
 assert.equal(text,'[00:12.35]First line\n[00:12.35]翻译\n[00:12.35]roman\n[01:00.01]زبان\u200cفارسی 👩‍👩‍👧\n');assert.equal(parseLyrics(text).lines[0]?.startMs,12350);
 assert.equal(exportLRC({synced:false,lines:[],plain:['Untimed lyric','第二行']}),'Untimed lyric\n第二行\n');assert.throws(()=>exportLRC({synced:false,lines:[],plain:[]}));assert.throws(()=>exportLRC({synced:true,plain:[],lines:[{startMs:NaN,text:'bad'}]}));
});
test('portable song information excludes every account/origin/metadata/URL and keeps actual container separate from quality',()=>{
 const track:Track={origin:{kind:'navidrome',accountId:'private-account',id:'private-server-path'},title:'Public song',artist:'Public artist',album:'Public album',durationMs:1000,metadata:{token:'private-token',url:'https://private/?token=secret',quality:'flac'},artwork:'https://private/cover',qualities:[{id:'flac'}]};
 const text=exportAudioMetadata(track,1234,'A'.repeat(32),'mp3'),json=JSON.parse(text);assert.doesNotMatch(text,/private|https:|flac|accountId|"metadata"|qualities|origin/);assert.equal(json.audio.container,'mp3');assert.equal(json.audio.md5,'a'.repeat(32));assert.equal(json.title,'Public song');assert.throws(()=>exportAudioMetadata({...track,title:'x'.repeat(70000)},123,'a'.repeat(32),'mp3'));
});
