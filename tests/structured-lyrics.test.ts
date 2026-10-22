import {activeLyric} from '../src/lyrics/parser.ts';
import {activeStageGroup,buildStageTimeline} from '../src/lyrics/stage.ts';
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
const document=(value:unknown)=>normalizeLyrics({structuredLyrics:[value]}).document;
const cue=(start:number,end:number|undefined,byteStart:number,byteEnd:number)=>({start,...(end===undefined?{}:{end}),byteStart,byteEnd});

test('structured offsets and line starts reject non-finite, coercible and out-of-range timing without losing text',()=>{
  for(const offset of [Infinity,NaN,'100',null,86400001,-86400001]){
    assert.deepEqual(document({synced:true,offset,line:[{start:1000,value:'Readable'}]}),{lines:[],plain:['Readable'],synced:false});
  }
  for(const start of [Infinity,NaN,null,'1000',-1,86400001])assert.deepEqual(document({synced:true,line:[{start,value:'Readable'}]}).plain,['Readable']);
  assert.equal(document({synced:true,offset:-100,line:[{start:1000,value:'Later'}]}).lines[0]!.startMs,1100);
  assert.deepEqual(document({synced:true,offset:-100,line:[{start:86400000,value:'Readable'}]}).plain,['Readable']);
});

test('bad word order, bounds or partial ends fall back once to the combined parent text',()=>{
  const cases=[
    [cue(1200,1300,0,0),cue(1100,1400,1,1)],
    [cue(900,1300,0,0),cue(1300,1400,1,1)],
    [cue(1000,2200,0,0),cue(1300,1400,1,1)],
    [cue(1000,1200,0,0),cue(1300,undefined,1,1)],
    [{...cue(1000,1200,0,0),end:null},cue(1300,1400,1,1)],
  ];
  for(const words of cases){const d=document({synced:true,line:[{start:1000,value:'Combined'},{start:3000,value:'Next'}],cueLine:[{index:0,start:1000,end:2000,value:'AB',cue:words}]});assert.equal(d.lines[0]!.text,'Combined');assert.equal(d.lines[0]!.words,undefined);assert.equal(d.lines[0]!.endMs,3000);}
  const overlapping=document({synced:true,line:[{start:1000,value:'AB'}],cueLine:[{index:0,start:1000,end:2000,value:'AB',cue:[cue(1000,1700,0,0),cue(1500,2000,1,1)]}]});assert.equal(overlapping.lines[0]!.words,undefined,'overlap within one cueLine must degrade');assert.equal(overlapping.lines[0]!.timingFallback,'invalid_cues');
});

test('optional line and cue ends infer only from known boundaries, retaining start-only syllables',()=>{
  const d=document({synced:true,line:[{start:1000,value:'AB'},{start:3000,value:'Next'}],cueLine:[{index:0,value:'AB',cue:[cue(900,undefined,0,0),cue(1500,undefined,1,1)]}]});
  assert.equal(d.lines[0]!.startMs,900);assert.deepEqual(d.lines[0]!.words?.map(w=>[w.startMs,w.endMs]),[[900,1500],[1500,3000]]);
  const final=document({synced:true,line:[{start:1000,value:'AB'}],cueLine:[{index:0,value:'AB',cue:[cue(1000,undefined,0,0),cue(1500,undefined,1,1)]}]});assert.equal(final.lines[0]!.endMs,undefined);assert.equal(final.lines[0]!.words?.at(-1)!.endMs,1500,'unknown final duration remains a point');
});

test('same-start lines share the next distinct ending, keeping sorted stable order',()=>{
  const d=document({synced:true,line:[{start:3000,value:'Next'},{start:1000,value:'A'},{start:1000,value:'B'}]});
  assert.deepEqual(d.lines.map(l=>[l.text,l.startMs,l.endMs]),[['A',1000,3000],['B',1000,3000],['Next',3000,undefined]]);
});

test('agent layers retain attribution/background and bad enhanced layers preserve combined fallback once',()=>{
  const value={synced:true,agents:[{id:'back',role:'bg'},{id:'lead',role:'main'}],line:[{start:1000,value:'A B'}],cueLine:[{index:0,start:1000,end:2000,value:'B',agentId:'back',cue:[cue(1000,2000,0,0)]},{index:0,start:1000,end:2000,value:'A',agentId:'lead',cue:[cue(1000,2000,0,0)]}]};
  assert.deepEqual(document(value).lines.map(l=>[l.text,l.agent,!!l.background]),[['A','lead',false],['B','back',true]]);
  for(const agents of [[],[{id:'x',role:'main'},{id:'x',role:'bg'}],[{id:'back',role:'bg'}],[{id:'lead',role:['main']}]] ){const d=document({...value,agents});assert.deepEqual(d.lines.map(l=>l.text),['A B']);}
  assert.equal(document({...value,cueLine:[{...value.cueLine[0],agentId:'missing'}]}).lines[0]!.text,'A B');
});

test('structured budgets cover all variants, output lines and processed words',()=>{
  const rows=Array.from({length:10000},(_,i)=>({start:i,value:'A'}));
  assert.equal(normalizeLyrics({structuredLyrics:[{synced:true,line:rows},{synced:true,line:rows}]}).variants.reduce((n,v)=>n+v.document.lines.length,0),20000);
  assert.throws(()=>normalizeLyrics({structuredLyrics:[{synced:true,line:rows},{synced:true,line:rows},{synced:true,line:[{start:0,value:'A'}]}]}),/数量过多/);
  assert.throws(()=>document({synced:false,line:[...rows,{value:'Extra'}]}),/条目过多/);
  assert.throws(()=>normalizeLyrics({structuredLyrics:Array.from({length:17},()=>({line:[]}))}),/版本过多/);
  const build=(count:number)=>({synced:true,line:Array.from({length:count},(_,i)=>({start:i*2000,value:'A'})),cueLine:Array.from({length:count},(_,i)=>({index:i,start:i*2000,end:(i+1)*2000,value:'A'.repeat(2000),cue:Array.from({length:2000},(_,j)=>cue(i*2000+j,i*2000+j+1,j,j))}))});
  assert.equal(document(build(10)).lines.reduce((n,l)=>n+(l.words?.length??0),0),20000);
  assert.throws(()=>document(build(11)),/数量过多/);
});

test('late background onset cannot terminate an unknown lead ending',()=>{
  const d=document({synced:true,agents:[{id:'lead',role:'main'},{id:'bg',role:'bg'}],line:[{start:1000,value:'A B'}],cueLine:[{index:0,value:'A',agentId:'lead',cue:[cue(1000,undefined,0,0)]},{index:0,value:'B',agentId:'bg',cue:[cue(1500,undefined,0,0)]}]});
  assert.equal(d.lines[0]!.endMs,undefined);assert.equal(d.lines[1]!.endMs,undefined);
  assert.equal(activeStageGroup(buildStageTimeline(d,5000),2000)?.line.text,'A');
});

test('same-onset main is selected consistently by scrolling/classic and stage consumers',()=>{
  const d=document({synced:true,agents:[{id:'lead',role:'main'},{id:'guest',role:'voice'}],line:[{start:1000,value:'A B'}],cueLine:[{index:0,start:1000,end:3000,value:'A',agentId:'lead',cue:[cue(1000,2000,0,0)]},{index:0,start:1000,end:3000,value:'B',agentId:'guest',cue:[cue(1000,2500,0,0)]}]});
  assert.equal(d.lines[activeLyric(d.lines,1500)]!.agent,'lead');assert.equal(activeStageGroup(buildStageTimeline(d,5000),1500)?.line.agent,'lead');
});

test('partial timed text preserves exact full line and sparse UTF8 cues without inventing timing for untimed text',()=>{
  const d=document({synced:true,line:[{start:0,value:'Oh love love me tonight'}],cueLine:[{index:0,start:0,end:2400,value:'Oh love love me tonight',cue:[{...cue(0,300,0,1),value:'Oh'},{...cue(900,1300,8,11),value:'love'},cue(1300,1600,13,14),cue(1600,2400,16,22)]}]});
  assert.equal(d.lines[0]!.text,'Oh love love me tonight');assert.equal(d.lines[0]!.words,undefined);assert.equal(d.lines[0]!.timingFallback,'untimed_text');assert.deepEqual(d.lines[0]!.timedCues?.map(c=>[c.text,c.startMs,c.byteStart]),[['Oh',0,0],['love',900,8],['me',1300,13],['tonight',1600,16]]);
  const emoji=document({synced:true,line:[{start:0,value:'音🎵尾'}],cueLine:[{index:0,start:0,end:1000,value:'音🎵尾',cue:[cue(100,500,3,6)]}]});
  assert.equal(emoji.lines[0]!.timedCues?.[0]!.text,'🎵');assert.equal(emoji.lines[0]!.text,'音🎵尾');
});

test('one expanded document stops at the stage renderer limit instead of silently losing its tail',()=>{
  const build=(count:number)=>({synced:true,agents:[{id:'lead',role:'main'},{id:'bg',role:'bg'}],line:Array.from({length:count},(_,i)=>({start:i,value:`Row ${i}`})),cueLine:[{index:0,start:0,end:1,value:'A',agentId:'lead',cue:[cue(0,1,0,0)]},{index:0,start:0,end:1,value:'B',agentId:'bg',cue:[cue(0,1,0,0)]}]});
  const d=document(build(9999));assert.equal(d.lines.length,10000);assert.equal(buildStageTimeline(d,20000).at(-1)!.groups[0]!.line.text,'Row 9998');
  assert.throws(()=>document(build(10000)),/展开行过多/);
});

test('a later guest in the same structured parent cannot displace its active main layer',()=>{
  const d=document({synced:true,agents:[{id:'lead',role:'main'},{id:'guest',role:'voice'}],line:[{start:1000,value:'A B'}],cueLine:[{index:0,start:1000,end:3000,value:'A',agentId:'lead',cue:[cue(1000,3000,0,0)]},{index:0,start:1500,end:3000,value:'B',agentId:'guest',cue:[cue(1500,3000,0,0)]}]});
  assert.equal(d.lines[activeLyric(d.lines,2000)]!.agent,'lead');assert.equal(activeStageGroup(buildStageTimeline(d,5000),2000)?.line.agent,'lead');
});

test('stage uses guest before the later main onset then agrees with activeLyric when main enters',()=>{
  const d=document({synced:true,agents:[{id:'lead',role:'main'},{id:'guest',role:'voice'}],line:[{start:1000,value:'Guest Lead'}],cueLine:[{index:0,start:1000,end:3000,value:'Guest',agentId:'guest',cue:[cue(1000,3000,0,4)]},{index:0,start:1500,end:3000,value:'Lead',agentId:'lead',cue:[cue(1500,3000,0,3)]}]});
  const stage=buildStageTimeline(d,5000);
  for(const [position,agent] of [[1200,'guest'],[2000,'lead']] as const){assert.equal(d.lines[activeLyric(d.lines,position)]!.agent,agent);assert.equal(activeStageGroup(stage,position)?.line.agent,agent);}
});
