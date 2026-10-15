import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseLyrics,activeLyric,mergeLyrics} from '../src/lyrics/parser.ts';
test('LRC preserves multiple timestamps, blank timed lines and millisecond precision',()=>{
  const parsed=parseLyrics('[ar:fixture]\n[00:01.2][00:05.123]Repeated\n[00:03.00]\n[00:99.00]bad');
  assert.deepEqual(parsed.lines.map(line=>[line.startMs,line.text]),[[1200,'Repeated'],[3000,''],[5123,'Repeated']]);
  assert.equal(activeLyric(parsed.lines,1000),-1);assert.equal(activeLyric(parsed.lines,3500),1);
});
test('embedded offset and user offset apply without modifying lyric timestamps each frame',()=>{
  const parsed=parseLyrics('[offset:500]\n[00:02.00]Fixture');assert.equal(parsed.lines[0]!.startMs,1500);
  assert.equal(activeLyric(parsed.lines,1600,200),-1);assert.equal(activeLyric(parsed.lines,1700,200),0);
});
test('LX and YRC word timing uses supplied times instead of equal subdivision',()=>{
  const lx=parseLyrics('[00:02.000]<0,100>A<100,700>B');
  assert.deepEqual(lx.lines[0]!.words?.map(word=>[word.startMs,word.endMs]),[[2000,2100],[2100,2800]]);
  const yrc=parseLyrics('[2000,800](2000,100,0)A(2100,700,0)B');
  assert.deepEqual(yrc.lines[0]!.words,lx.lines[0]!.words);
});
test('KRC/QRC timing and malformed word fallback retain readable text',()=>{
  const krc=parseLyrics('[2000,800]<0,100,0>A<100,700,0>B');assert.equal(krc.lines[0]!.words?.[1]!.startMs,2100);
  const qrc=parseLyrics('[2000,800]A(2000,100)B(2100,700)');assert.equal(qrc.lines[0]!.text,'AB');assert.equal(qrc.lines[0]!.words?.[0]!.startMs,2000);
  const bad=parseLyrics('[00:02.000]<500,100>A<0,100>B');assert.equal(bad.lines[0]!.text,'AB');assert.equal(bad.lines[0]!.words,undefined);
});
test('plain text never pretends to be synchronized and extras require real timestamp alignment',()=>{
  const plain=parseLyrics('First\nSecond');assert.equal(plain.synced,false);assert.equal(plain.lines.length,0);assert.deepEqual(plain.plain,['First','Second']);
  const merged=mergeLyrics(parseLyrics('[00:01]A'),'[00:01]Translated','[00:01]Roman');assert.equal(merged.lines[0]!.translation,'Translated');assert.equal(merged.lines[0]!.romanization,'Roman');
});
