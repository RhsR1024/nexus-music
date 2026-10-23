import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseLyrics} from '../src/lyrics/parser.ts';
import {parseTTML} from '../src/lyrics/ttml.ts';
import {normalizeLyrics} from '../src/lyrics/normalize.ts';
const over=/歌词展开行或计时词数量过多/;
test('LRC bounds output after multiple timestamp expansion, preserving exact boundary',()=>{
 assert.equal(parseLyrics('[00:01]'.repeat(10000)+'line').lines.length,10000);
 assert.throws(()=>parseLyrics('[00:01]'.repeat(10001)+'line'),over);
});
for(const kind of ['lx','yrc','krc','qrc'])test(`${kind} counts timed words across the complete document`,()=>{
 const word=kind==='lx'?'<0,1>a':kind==='yrc'?'(1000,1,0)a':kind==='krc'?'<0,1,0>a':'a(1000,1)';
 const row=(kind==='lx'?'[00:01]':'[1000,100]')+word.repeat(2000);
 const valid=parseLyrics(Array(10).fill(row).join('\n'));
 assert.equal(valid.lines.reduce((n,line)=>n+(line.words?.length??0),0),20000);
 assert.throws(()=>parseLyrics(Array(11).fill(row).join('\n')),over);
});
const paragraph='<p begin="0s" end="1s">'+'<span begin="0s" end="1s">a</span>'.repeat(1000)+'</p>';
const ttml=(n:number)=>'<tt><body>'+paragraph.repeat(n)+'</body></tt>';
test('TTML applies the same global word budget to direct and detected parsing',()=>{
 assert.equal(parseTTML(ttml(20)).lines.reduce((n,l)=>n+(l.words?.length??0),0),20000);
 assert.throws(()=>parseTTML(ttml(21)),over);
 assert.throws(()=>parseLyrics(ttml(21)),over);
});
test('over-budget rich/optional lyrics retain established fallback behavior',()=>{
 const result=normalizeLyrics({ttml:ttml(21),lrc:'[00:01]main',tlyric:ttml(21)});
 assert.equal(result.document.lines[0]?.text,'main');
 assert.equal(result.document.lines[0]?.translation,undefined);
});

test('plain text over the line budget fails instead of silently discarding its tail',()=>{
 assert.equal(parseLyrics(Array(10000).fill('plain').join('\n')).plain.length,10000);
 assert.throws(()=>parseLyrics(Array(10001).fill('plain').join('\n')),over);
});
