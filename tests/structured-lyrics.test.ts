import{test}from'node:test';import assert from'node:assert/strict';import{normalizeLyrics}from'../src/lyrics/normalize.ts';
test('OpenSubsonic offset and true UTF8 cue byte offsets preserve Chinese and emoji',()=>{
  const result=normalizeLyrics({structuredLyrics:[{kind:'main',lang:'zh',synced:true,offset:100,line:[{start:1000,value:'音 🎵'}],cueLine:[{index:0,start:1000,end:2000,value:'音 🎵',cue:[{start:1000,end:1200,byteStart:0,byteEnd:2},{start:1500,end:2000,byteStart:4,byteEnd:7}]}]}]});
  assert.equal(result.document.lines[0]!.startMs,900);assert.deepEqual(result.document.lines[0]!.words?.map(word=>word.text),['音',' 🎵']);assert.equal(result.document.lines[0]!.words?.[1]!.startMs,1400);
});
test('independent lyric variants retain their own timing instead of forced word alignment',()=>{
  const result=normalizeLyrics({structuredLyrics:[{kind:'main',lang:'zh',synced:true,line:[{start:100,value:'A'},{start:500,value:'B'}]},{kind:'translation',lang:'en',synced:true,line:[{start:200,value:'Translated'}]}]});
  assert.equal(result.variants.length,2);assert.equal(result.document.lines.length,2);assert.equal(result.variants[1]!.document.lines[0]!.startMs,200);
});
test('bad UTF8 boundaries fall back to readable line-level lyrics',()=>{
  const result=normalizeLyrics({structuredLyrics:[{synced:true,line:[{start:1000,value:'音'}],cueLine:[{index:0,start:1000,end:2000,value:'音',cue:[{start:1000,end:2000,byteStart:0,byteEnd:1}]}]}]});
  assert.equal(result.document.lines[0]!.text,'音');assert.equal(result.document.lines[0]!.words,undefined);
});
