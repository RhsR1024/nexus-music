import {normalizeLyrics} from '../src/lyrics/normalize.ts';
import {parseTTML} from '../src/lyrics/ttml.ts';
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

test('TTML preserves word boundaries, agents, background vocals and optional translations',()=>{
  const parsed=parseLyrics(`<?xml version="1.0"?><tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata"><body><div><p begin="2s" end="6s" ttm:agent="v1"><span begin="0s" end="1s">Hello &amp; </span><span begin="1s" end="3s">世界</span><span ttm:role="x-bg" begin=".5s" end="2s">Echo</span><span ttm:role="x-translation">你好</span></p></div></body></tt>`.replace('begin=".5s"','begin="0.5s"'));
  assert.equal(parsed.lines.length,2);const main=parsed.lines[0]!,bg=parsed.lines[1]!;
  assert.equal(main.text,'Hello & 世界');assert.equal(main.agent,'v1');assert.equal(main.translation,'你好');
  assert.deepEqual(main.words?.map(word=>[word.startMs,word.endMs]),[[2000,3000],[3000,5000]]);assert.equal(bg.background,true);assert.equal(bg.startMs,2500);
  assert.equal(activeLyric(parsed.lines,2800),0);assert.equal(activeLyric(parsed.lines,4500),0);assert.equal(activeLyric(parsed.lines,5500),-1);
});
test('TTML uses nested relative times, parent duration bounds, frames and ticks',()=>{
  const parsed=parseLyrics('<tt xmlns:ttp="urn:test" ttp:frameRate="25" ttp:tickRate="100"><body begin="1s"><div begin="2s"><p begin="1s" dur="3s"><span begin="25f" end="250t">A</span><span begin="00:00:02:00" end="4s">B</span></p></div></body></tt>');
  assert.deepEqual(parsed.lines[0]!.words?.map(word=>[word.startMs,word.endMs]),[[5000,6500],[6000,7000]]);
  assert.equal(parsed.lines[0]!.text,'AB');
});
test('TTML rejects DTDs, unknown entities, malformed XML, unsupported timing and excessive depth',()=>{
  const bad=['<tt><body></tt>','<!DOCTYPE tt [<!ENTITY x SYSTEM "file:///private">]><tt/>','<tt><body><p begin="1s">&unknown;</p></body></tt>', '<tt><body><p begin="bad">text</p></body></tt>', '<tt><body timeContainer="seq"><p>text</p></body></tt>', '<tt>'+ '<div>'.repeat(33)+'</div>'.repeat(33)+'</tt>', '<tt><body><p begin="2s" end="1s">bad</p></body></tt>', '<tt><body><p a="1" a="2">bad</p></body></tt>'];
  // Explicit parser is also used for malformed declarations before format sniffing.
  for(const input of bad)assert.throws(()=>parseTTML(input));
});

test('TTML string and rich-provider field keep XML entities through normalization',()=>{
  const xml='<tt><body><p begin="1s" end="3s"><span begin="0s" end="2s">A &amp; B &#x1f3b5;</span></p></body></tt>';
  assert.equal(normalizeLyrics(xml).document.lines[0]!.text,'A & B 🎵');assert.deepEqual(normalizeLyrics({ttml:xml}).document,normalizeLyrics(xml).document);
});

test('pretty printed TTML retains timed words rather than losing timing to indentation',()=>{
  const parsed=parseTTML('<tt><body><p begin="1s" end="4s">\n  <span begin="0s" end="1s">First</span>\n  <span begin="1s" end="2s">second</span>\n</p></body></tt>');
  assert.equal(parsed.lines[0]!.text,'First second');assert.equal(parsed.lines[0]!.words?.length,2);assert.equal(parsed.lines[0]!.words?.[1]!.startMs,2000);
});

test('TTML default tick rate follows an explicitly provided effective frame rate',()=>{
  const parsed=parseTTML('<tt xmlns:ttp="urn:test" ttp:frameRate="25" ttp:frameRateMultiplier="2 1"><body><p begin="50t" end="100t">test</p></body></tt>');
  assert.equal(parsed.lines[0]!.startMs,1000);assert.equal(parsed.lines[0]!.endMs,2000);
});
