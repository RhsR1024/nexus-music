import {normalizeLyrics} from '../src/lyrics/normalize.ts';
import {parseTTML} from '../src/lyrics/ttml.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseLyrics,activeLyric,mergeLyrics,lyricSpokenText} from '../src/lyrics/parser.ts';
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
test('TTML sequential containers start each child after the previous active end',()=>{
  const parsed=parseLyrics('<tt><body begin="1s"><div timeContainer="seq"><p dur="3s"><span timeContainer="seq"><span dur="1s">A</span><span begin="500ms" end="900ms">B</span></span></p><p begin="250ms" dur="1s"><span dur="2s">C</span></p></div></body></tt>');
  assert.deepEqual(parsed.lines.map(line=>line.words?.map(word=>[word.text,word.startMs,word.endMs])),[
    [['A',1000,2000],['B',2500,2900]],
    [['C',4250,5250]],
  ]);
});
test('TTML nested sequence and parallel containers retain their own sibling timing',()=>{
  const parsed=parseLyrics('<tt><body><p timeContainer="seq"><span dur="1s">A</span><span timeContainer="par" dur="2s"><span dur="1s">B</span><span begin="500ms" dur="1s">C</span></span><span dur="1s">D</span></p></body></tt>');
  assert.deepEqual(parsed.lines[0]!.words?.map(word=>[word.text,word.startMs,word.endMs]),[
    ['A',0,1000],['B',1000,2000],['C',1500,2500],['D',3000,4000],
  ]);
});
test('TTML sequence keeps background, translation and romanization payloads',()=>{
  const parsed=parseLyrics('<tt><body><p timeContainer="seq" ttm:agent="v1" xmlns:ttm="urn:test"><span dur="1s">Main</span><span ttm:role="x-bg" dur="1s">Echo</span><span ttm:role="x-translation">译</span><span ttm:role="x-roman">roma</span></p></body></tt>');
  assert.deepEqual(parsed.lines.map(line=>[line.text,line.background??false,line.startMs,line.endMs]),[
    ['Main',false,0,1000],['Echo',true,1000,2000],
  ]);
  assert.equal(parsed.lines[0]!.translation,'译');assert.equal(parsed.lines[0]!.romanization,'roma');assert.equal(parsed.lines[0]!.agent,'v1');
});
test('TTML sequential parent bounds clamp child timing and advance from the clamped end',()=>{
  const parsed=parseLyrics('<tt><body><div timeContainer="seq"><p dur="2s"><span dur="3s">A</span></p><p dur="1s">B</p></div></body></tt>');
  assert.deepEqual(parsed.lines.map(line=>[line.text,line.startMs,line.endMs]),[['A',0,2000],['B',2000,3000]]);
});
test('TTML sequential content inherits root whitespace preservation',()=>{
  const parsed=parseTTML('<tt xml:space="preserve"><body><p timeContainer="seq"><span dur="1s"> A </span><span dur="1s"> B </span></p></body></tt>');
  assert.equal(parsed.lines[0]!.text,' A  B ');
  assert.deepEqual(parsed.lines[0]!.words?.map(word=>[word.startMs,word.endMs]),[[0,1000],[1000,2000]]);
});
test('TTML text-only paragraphs keep their own parallel anonymous-span duration',()=>{
  const parsed=parseTTML('<tt><body dur="3s"><div timeContainer="seq"><p>Held text</p></div></body></tt>');
  assert.deepEqual(parsed.lines.map(line=>[line.text,line.startMs,line.endMs]),[['Held text',0,3000]]);
  const rich=normalizeLyrics({ttml:'<tt><body><p timeContainer="seq"><span dur="1s">First</span><span dur="2s">Second</span></p></body></tt>',lrc:'[00:00]Fallback'});
  assert.equal(rich.document.lines[0]!.text,'FirstSecond');
  assert.deepEqual(rich.document.lines[0]!.words?.map(word=>[word.startMs,word.endMs]),[[0,1000],[1000,3000]]);
});
test('TTML rejects DTDs, unknown entities, malformed XML, unsupported timing and excessive depth',()=>{
  const bad=['<tt><body></tt>','<!DOCTYPE tt [<!ENTITY x SYSTEM "file:///private">]><tt/>','<tt><body><p begin="1s">&unknown;</p></body></tt>', '<tt><body><p begin="bad">text</p></body></tt>', '<tt><body timeContainer="excl"><p>text</p></body></tt>', '<tt><body timeContainer="seq"><p begin="-1s">text</p></body></tt>', '<tt>'+ '<div>'.repeat(33)+'</div>'.repeat(33)+'</tt>', '<tt><body><p begin="2s" end="1s">bad</p></body></tt>', '<tt><body><p a="1" a="2">bad</p></body></tt>'];
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

const amll=(content:string)=>`<tt xmlns:a="http://www.example.com/ns/amll"><body dur="120s">${content}</body></tt>`;
test('standard TTML background auxiliary text stays on the background voice',()=>{
  const parsed=parseTTML('<tt><body><p begin="10s" end="20s"><span begin="1s" end="2s">Main</span><span ttm:role="x-bg" begin="3s" end="4s">Echo<span ttm:role="x-translation">背景译</span></span><span ttm:role="x-translation">主译</span></p></body></tt>');
  assert.deepEqual(parsed.lines.map(line=>[line.startMs,line.endMs,line.translation]),[[11000,12000,'主译'],[13000,14000,'背景译']]);
});
test('AMLL profile media clocks do not accumulate paragraph or section offsets',()=>{
  const parsed=parseTTML(amll('<div begin="10" end="70"><p begin="00:12.1" end="15"><span begin="12.1" end="00:13.12">A</span><span begin="00:13.12" end="00:15.000">B</span></p><p begin="01:01.123" end="01:02">C</p></div>'));
  assert.deepEqual(parsed.lines.map(line=>[line.startMs,line.endMs]),[[12100,15000],[61123,62000]]);
  assert.deepEqual(parsed.lines[0]!.words?.map(word=>[word.startMs,word.endMs]),[[12100,13120],[13120,15000]]);
  const suffix=parseTTML(amll('<p begin="10s" end="12s"><span begin="10s" end="11s">D</span></p>'));
  assert.equal(suffix.lines[0]!.startMs,10000);
  const standard=parseTTML('<tt><body><p begin="10s" end="15s"><span begin="1s" end="2s">D</span></p></body></tt>');
  assert.equal(standard.lines[0]!.startMs,11000,'Standard TTML stays parent-relative');
});
test('AMLL profile background keeps independent timing and its own auxiliary text',()=>{
  const parsed=parseTTML(amll('<div begin="10" end="20"><p begin="12" end="14" ttm:agent="v1"><span begin="12" end="14">Main</span><span ttm:role="x-translation">主译</span><span ttm:role="x-roman">main</span><span ttm:role="x-bg" begin="15" end="18"><span begin="15" end="18">Echo</span><span ttm:role="x-translation">背景译</span><span ttm:role="x-roman">echo</span></span></p></div>'));
  assert.deepEqual(parsed.lines.map(line=>[line.text,line.startMs,line.endMs,line.background??false,line.translation,line.romanization]),[['Main',12000,14000,false,'主译','main'],['Echo',15000,18000,true,'背景译','echo']]);
  assert.equal(parsed.lines[1]!.agent,'v1');
  assert.throws(()=>parseTTML(amll('<div end="20"><p begin="12" end="14"><span ttm:role="x-bg" begin="21" end="22">Bad</span></p></div>')));
});
test('AMLL profile zero-timed whitespace joins words without a zero-second lyric',()=>{
  const parsed=parseTTML(amll('<p begin="12" end="14"><span begin="12" end="13">A</span><span begin="00:00.000" end="00:00.000"> </span><span begin="13" end="14">B</span></p>'));
  assert.equal(parsed.lines[0]!.text,'A B');assert.equal(parsed.lines[0]!.startMs,12000);assert.equal(parsed.lines[0]!.words?.length,2);
});
test('AMLL profile detection and bounds never relax standard TTML or XML budgets',()=>{
  for(const value of ['01:60','60:01','00:01.1234','-1','NaN','90000','1f']){
    assert.throws(()=>parseTTML(amll(`<p begin="${value}" end="120">Bad</p>`)),value);
  }
  assert.throws(()=>parseTTML(amll('<p timeContainer="seq" dur="1s">Unsupported mixed profile</p>')));
  assert.throws(()=>parseTTML(amll('<div begin="10"><p begin="9" end="12">Outside section</p></div>')));
  assert.throws(()=>parseTTML('<tt xmlns:a="wrong"><body><p begin="12.1" end="14">Bad</p></body></tt>'));
  assert.throws(()=>parseTTML('<!DOCTYPE tt><tt xmlns:a="http://www.example.com/ns/amll"/>'));
  const rich=normalizeLyrics({ttml:amll('<p begin="12" end="14">Selected</p>'),lrc:'[00:00]Fallback'});
  assert.equal(rich.document.lines[0]!.text,'Selected');assert.equal(rich.document.lines[0]!.startMs,12000);
  const ruby=amll('<p begin="12" end="14"><span tts:ruby="container"><span tts:ruby="base">字</span><span tts:ruby="textContainer"><span tts:ruby="text" begin="12" end="13.5">zi</span></span></span><span tts:ruby="container"><span tts:ruby="base">音</span><span tts:ruby="textContainer"><span tts:ruby="text" begin="13.5" end="14">yin</span></span></span></p>');
  const parsedRuby=parseTTML(ruby);
  assert.equal(parsedRuby.lines[0]!.text,'字音');
  assert.deepEqual(parsedRuby.lines[0]!.words?.map(word=>[word.text,word.startMs,word.endMs,word.ruby]),[
    ['字',12000,13500,'zi'],['音',13500,14000,'yin'],
  ]);
  assert.equal(lyricSpokenText(parsedRuby.lines[0]!),'字音，注音：zi，yin');
  assert.equal(normalizeLyrics({ttml:ruby,lrc:'[00:12]Readable fallback'}).document.lines[0]!.text,'字音');
});
test('TTML standard ruby keeps annotations separate from sung text and rejects malformed structure',()=>{
  const parsed=parseTTML('<tt><body><p begin="2s" end="4s"><span begin="0s" end="1s">A</span><ruby begin="1s" end="2s"><rb>漢</rb><rp>(</rp><rt>kan</rt><rp>)</rp></ruby><span begin="1s" end="2s">B</span></p></body></tt>');
  assert.equal(parsed.lines[0]!.text,'A漢B');
  assert.deepEqual(parsed.lines[0]!.words?.map(word=>[word.text,word.ruby]),[['A',undefined],['漢','kan'],['B',undefined]]);
  assert.equal(lyricSpokenText(parsed.lines[0]!),'A漢B，注音：kan');
  for(const input of [
    '<tt><body><p><span tts:ruby="base">字</span></p></body></tt>',
    '<tt><body><p><span tts:ruby="container"><span tts:ruby="base">字</span></span></p></body></tt>',
    '<tt><body><p><ruby><rb>漢</rb></ruby></p></body></tt>',
  ])assert.throws(()=>parseTTML(input),/注音/);
});
test('TTML standard ruby accepts an unambiguous one-base one-annotation rtc group',()=>{
  const parsed=parseTTML('<tt><body><p begin="2s" end="7s"><ruby begin="1s" end="4s"><rb>漢字</rb><rp>(</rp><rtc begin="1s" end="3s"><rp>(</rp><rt begin="0.5s" end="1s">kanji</rt><rp>)</rp></rtc><rp>)</rp></ruby><span begin="4s" end="5s"> tail</span></p></body></tt>');
  assert.equal(parsed.lines[0]!.text,'漢字 tail');
  assert.deepEqual(parsed.lines[0]!.words?.map(word=>[word.text,word.startMs,word.endMs,word.ruby]),[
    ['漢字',4500,5000,'kanji'],[' tail',6000,7000,undefined],
  ]);
  const textBase=parseTTML('<tt><body><p begin="1s" end="3s"><ruby>漢字<rtc><rt begin="1s" end="2s">kanji</rt></rtc></ruby></p></body></tt>');
  assert.deepEqual(textBase.lines[0]!.words?.map(word=>[word.text,word.startMs,word.endMs,word.ruby]),[
    ['漢字',2000,3000,'kanji'],
  ]);
  for(const input of [
    '<tt><body><p><ruby><rb>漢</rb><rtc/></ruby></p></body></tt>',
    '<tt><body><p><ruby><rtc><rt>kan</rt></rtc><rb>漢</rb></ruby></p></body></tt>',
    '<tt><body><p><ruby><rb>漢</rb><rtc><rt>kan</rt><rt>ji</rt></rtc></ruby></p></body></tt>',
    '<tt><body><p><ruby><rb>漢</rb><rtc><rt>kan</rt></rtc>字</ruby></p></body></tt>',
    '<tt><body><p><ruby><rb>漢</rb><rt>kan</rt><rtc><rt>ji</rt></rtc></ruby></p></body></tt>',
    '<tt><body><p><ruby><rb> </rb><rtc><rt>kan</rt></rtc></ruby></p></body></tt>',
  ])assert.throws(()=>parseTTML(input),/注音/);
});
test('TTML rbc maps equal base and annotation containers pairwise with explicit timing',()=>{
  const parsed=parseTTML('<tt><body><p begin="2s" end="12s"><ruby begin="1s" end="9s"><rbc><rb begin="0.5s" end="1s">漢</rb><rb>字</rb></rbc><rtc begin="0.25s"><rp>(</rp><rt begin="1s" end="2s">kan</rt><rt begin="2s" end="3s">ji</rt><rp>)</rp></rtc></ruby><span begin="4s" end="5s"> tail</span></p></body></tt>');
  assert.equal(parsed.lines[0]!.text,'漢字 tail');
  assert.deepEqual(parsed.lines[0]!.words?.map(word=>[word.text,word.startMs,word.endMs,word.ruby]),[
    ['漢',3500,4000,'kan'],['字',5250,6250,'ji'],[' tail',6000,7000,undefined],
  ]);
  assert.equal(lyricSpokenText(parsed.lines[0]!),'漢字 tail，注音：kan，ji');
  const explicitBase=parseTTML('<tt><body><p begin="1s" end="4s"><ruby><rbc begin="1s" end="3s"><rb begin="0.5s" end="1s">音</rb></rbc><rtc><rt>yin</rt></rtc></ruby></p></body></tt>');
  assert.deepEqual(explicitBase.lines[0]!.words?.map(word=>[word.text,word.startMs,word.endMs,word.ruby]),[
    ['音',2500,3000,'yin'],
  ]);
  for(const input of [
    '<tt><body><p><ruby><rbc><rb>漢</rb><rb>字</rb></rbc><rtc><rt>kan</rt></rtc></ruby></p></body></tt>',
    '<tt><body><p><ruby><rbc><rb>漢</rb></rbc><rtc><rt>kan</rt><rt>ji</rt></rtc></ruby></p></body></tt>',
    '<tt><body><p><ruby><rbc><rb>漢</rb><rp>(</rp></rbc><rtc><rt>kan</rt></rtc></ruby></p></body></tt>',
    '<tt><body><p><ruby><rbc><rb> </rb></rbc><rtc><rt>kan</rt></rtc></ruby></p></body></tt>',
    '<tt><body><p><ruby><rbc><rb>漢</rb></rbc><rtc>fallback<rt>kan</rt></rtc></ruby></p></body></tt>',
    '<tt><body><p><ruby><rtc><rt>kan</rt></rtc><rbc><rb>漢</rb></rbc></ruby></p></body></tt>',
    '<tt><body><p><ruby><rbc><rb>漢</rb></rbc><rtc><rt>kan</rt></rtc><rtc><rt>ji</rt></rtc></ruby></p></body></tt>',
    '<tt><body><p><ruby><rbc><rb>漢</rb></rbc><rtc><rt>kan</rt></rtc>tail</ruby></p></body></tt>',
  ])assert.throws(()=>parseTTML(input),/注音/);
});
test('TTML double-sided ruby requires one base and unique before and after annotation tracks',()=>{
  const amllRuby=amll('<p begin="12" end="15"><span tts:ruby="container"><span tts:ruby="base" begin="12" end="13">東</span><span tts:ruby="textContainer" tts:rubyPosition="before"><span tts:ruby="text">とう</span></span><span tts:ruby="textContainer" tts:rubyPosition="after"><span tts:ruby="text" begin="13" end="14">たつ</span></span></span></p>');
  const parsedAmll=parseTTML(amllRuby);
  assert.deepEqual(parsedAmll.lines[0]!.words?.map(word=>[word.text,word.startMs,word.endMs,word.ruby,word.rubyAfter]),[
    ['東',12000,13000,'とう','たつ'],
  ]);
  assert.equal(lyricSpokenText(parsedAmll.lines[0]!),'東，注音：とう，たつ');

  const afterOnly=parseTTML(amll('<p begin="12" end="14"><span tts:ruby="container"><span tts:ruby="base">字</span><span tts:ruby="textContainer" tts:rubyPosition="after"><span tts:ruby="text" begin="12" end="13">ji</span></span></span></p>'));
  assert.deepEqual(afterOnly.lines[0]!.words?.map(word=>[word.text,word.startMs,word.endMs,word.ruby,word.rubyAfter]),[
    ['字',12000,13000,undefined,'ji'],
  ]);

  const grouped=parseTTML('<tt xmlns:tts="http://www.w3.org/ns/ttml#styling"><body><p begin="2s" end="8s"><ruby begin="1s" end="6s"><rbc><rb begin="0.5s" end="1s">東</rb><rb begin="1s" end="2s">南</rb></rbc><rtc tts:rubyPosition="before"><rt>とう</rt><rt>なん</rt></rtc><rtc tts:rubyPosition="after"><rt>たつ</rt><rt>み</rt></rtc></ruby></p></body></tt>');
  assert.deepEqual(grouped.lines[0]!.words?.map(word=>[word.text,word.startMs,word.endMs,word.ruby,word.rubyAfter]),[
    ['東',3500,4000,'とう','たつ'],['南',4000,5000,'なん','み'],
  ]);
  assert.equal(lyricSpokenText(grouped.lines[0]!),'東南，注音：とう，たつ，なん，み');

  const directTracks=parseTTML('<tt xmlns:tts="http://www.w3.org/ns/ttml#styling"><body><p begin="2s" end="5s"><ruby><rb>東</rb><rt tts:rubyPosition="before">とう</rt></ruby><ruby><rb>東</rb><rt tts:rubyPosition="after">たつ</rt></ruby></p></body></tt>');
  assert.deepEqual(directTracks.lines[0]!.words?.map(word=>[word.text,word.startMs,word.endMs,word.ruby,word.rubyAfter]),[
    ['東',2000,5000,'とう',undefined],['東',2000,5000,undefined,'たつ'],
  ]);
});
test('TTML double-sided ruby rejects duplicate, missing, unsupported and mismatched positions',()=>{
  for(const input of [
    amll('<p begin="12" end="14"><span tts:ruby="container"><span tts:ruby="base">字</span><span tts:ruby="textContainer" tts:rubyPosition="before"><span tts:ruby="text">zi</span></span><span tts:ruby="textContainer" tts:rubyPosition="before"><span tts:ruby="text">ji</span></span></span></p>'),
    amll('<p begin="12" end="14"><span tts:ruby="container"><span tts:ruby="base">字</span><span tts:ruby="textContainer"><span tts:ruby="text">zi</span></span><span tts:ruby="textContainer" tts:rubyPosition="after"><span tts:ruby="text">ji</span></span></span></p>'),
    amll('<p begin="12" end="14"><span tts:ruby="container"><span tts:ruby="base">字</span><span tts:ruby="textContainer" tts:rubyPosition="both"><span tts:ruby="text">zi</span></span></span></p>'),
    amll('<p begin="12" end="14"><span tts:ruby="container"><span tts:ruby="base">字</span><span tts:ruby="base">音</span><span tts:ruby="textContainer" tts:rubyPosition="before"><span tts:ruby="text">zi</span></span></span></p>'),
    amll('<p begin="12" end="14"><span tts:ruby="container"><span tts:ruby="base">字</span><span tts:ruby="textContainer" tts:rubyPosition="before"><span tts:ruby="text">zi</span></span><span tts:ruby="textContainer" tts:rubyPosition="after"></span></span></p>'),
    '<tt><body><p><ruby><rbc><rb>東</rb></rbc><rtc tts:rubyPosition="before"><rt>とう</rt></rtc><rtc tts:rubyPosition="before"><rt>たつ</rt></rtc></ruby></p></body></tt>',
    '<tt><body><p><ruby><rbc><rb>東</rb></rbc><rtc><rt>とう</rt></rtc><rtc><rt>たつ</rt></rtc></ruby></p></body></tt>',
    '<tt><body><p><ruby><rbc><rb>東</rb></rbc><rtc tts:rubyPosition="before"><rt>とう</rt></rtc><rtc><rt>たつ</rt></rtc></ruby></p></body></tt>',
    '<tt><body><p><ruby><rbc><rb>東</rb><rb>南</rb></rbc><rtc tts:rubyPosition="before"><rt>とう</rt><rt>なん</rt></rtc><rtc tts:rubyPosition="after"><rt>たつ</rt></rtc></ruby></p></body></tt>',
    '<tt><body><p><ruby><rbc><rb>東</rb></rbc><rtc tts:rubyPosition="before"><rt>とう</rt></rtc><rtc tts:rubyPosition="after"><rt>たつ</rt></rtc><rtc tts:rubyPosition="after"><rt>み</rt></rtc></ruby></p></body></tt>',
    '<tt><body><p><ruby><rbc><rb>東</rb></rbc><rtc tts:rubyPosition="before"><rt>とう</rt></rtc><rtc tts:rubyPosition="after"><rt>たつ</rt><rp>.</rp><rt>み</rt></rtc></ruby></p></body></tt>',
  ])assert.throws(()=>parseTTML(input),/注音/);
});
