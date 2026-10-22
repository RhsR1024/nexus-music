import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLyrics} from '../src/lyrics/normalize.ts';
const lrc='[00:01.000]可读歌词';

test('empty preferred lyric fields do not hide timed alternatives or wrapped lyric text',()=>{
  for(const preferred of ['', '  \n ',{lyric:''},{lyric:'  '}]){
    const result=normalizeLyrics({ttml:preferred,lxlyric:preferred,yrc:'[1000,500](1000,500,0)可读歌词'});
    assert.equal(result.document.lines[0]!.text,'可读歌词');assert.equal(result.document.lines[0]!.words?.length,1);
    assert.equal(normalizeLyrics({lyric:preferred,lrc:{lyric:lrc}}).document.lines[0]!.startMs,1000);
  }
});

test('malformed or empty rich documents fall through to the next timed format',()=>{
  for(const ttml of ['<tt><body>', '<tt><body/></tt>']){
    const result=normalizeLyrics({ttml,yrc:'[1000,500](1000,500,0)可读歌词',lyric:'[00:02]Fallback'});
    assert.equal(result.document.lines[0]!.startMs,1000);assert.equal(result.document.lines[0]!.words?.length,1);
  }
  assert.equal(normalizeLyrics({ttml:'<tt>',qrc:'not timed',lyric:'',lrc}).document.lines[0]!.text,'可读歌词');
});

test('timed alternatives precede plain fallback; readable plain fields survive failed rich input',()=>{
  assert.equal(normalizeLyrics({yrc:'plain rich',lyric:'plain lyric',lrc}).document.synced,true);
  assert.deepEqual(normalizeLyrics({ttml:'<tt>',qrc:'plain rich',lyric:'plain lyric'}).document.plain,['plain lyric']);
  assert.deepEqual(normalizeLyrics({qrc:'plain rich'}).document.plain,['plain rich']);
  assert.deepEqual(normalizeLyrics({ttml:' ',lyric:''}).document,{lines:[],plain:[],synced:false});
  assert.throws(()=>normalizeLyrics({ttml:'<tt>'}),/XML/);
});

test('empty or malformed optional translations and romanizations cannot discard usable main lyrics',()=>{
  for(const preferred of ['', '  ',{lyric:''},'<tt>']){
    const result=normalizeLyrics({lyric:lrc,tlyric:preferred,tlrc:'[00:01]Translated',rlyric:preferred,romalrc:'[00:01]Romanized'});
    assert.equal(result.document.lines[0]!.translation,'Translated');assert.equal(result.document.lines[0]!.romanization,'Romanized');
  }
  assert.equal(normalizeLyrics({lyric:lrc,tlyric:'<tt>'}).document.lines[0]!.text,'可读歌词');
});
