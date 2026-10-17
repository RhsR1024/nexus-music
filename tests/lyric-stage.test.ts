import test from 'node:test';
import assert from 'node:assert/strict';
import {parseLyrics,type LyricDocument} from '../src/lyrics/parser.ts';
import {buildStageTimeline,activeStageGroup} from '../src/lyrics/stage.ts';
const fixture=parseLyrics('[1000,6000](1000,1000,0)春(2000,1000,0)天(3000,1000,0)的(4000,1000,0)风(6000,1000,0)来了\n[9000,1000](9000,1000,0)结束');
test('stage preserves actual words, short-group budget and original document',()=>{
  const before=JSON.stringify(fixture),timeline=buildStageTimeline(fixture);
  assert.deepEqual(timeline[0]!.groups.map(group=>group.line.text),['春天的风','来了']);
  assert.deepEqual(timeline[0]!.groups.flatMap(group=>group.line.words??[]),fixture.lines[0]!.words);
  assert.equal(JSON.stringify(fixture),before);
});
test('stage uses half-open rows, blank gaps and onset-held groups with positive delay',()=>{
  const timeline=buildStageTimeline(fixture);
  assert.equal(activeStageGroup(timeline,999),undefined);
  const first=activeStageGroup(timeline,1000)!;
  assert.equal(activeStageGroup(timeline,5999),first);
  assert.equal(activeStageGroup(timeline,6000)!.line.text,'来了');
  assert.equal(activeStageGroup(timeline,7000),undefined);
  assert.equal(activeStageGroup(timeline,8999),undefined);
  assert.equal(activeStageGroup(timeline,9000)!.line.text,'结束');
  assert.equal(activeStageGroup(timeline,10000),undefined);
  assert.equal(activeStageGroup(timeline,6200,500),first);
  assert.equal(activeStageGroup(timeline,6200,-500)!.line.text,'来了');
  assert.equal(activeStageGroup(timeline,NaN),undefined);
});
test('stage keeps emoji clusters and long tokens whole and does not manufacture word timing',()=>{
  const document:LyricDocument={synced:true,plain:[],lines:[{startMs:0,endMs:5000,text:'👩🏽‍💻é family',words:[{startMs:0,endMs:1000,text:'👩🏽‍💻'},{startMs:1000,endMs:2000,text:'é '},{startMs:2000,endMs:5000,text:'family'}]}]};
  const timeline=buildStageTimeline(document);
  assert.equal(timeline[0]!.groups.map(group=>group.line.text).join(''),document.lines[0]!.text);
  assert.ok(timeline[0]!.groups.some(group=>group.line.text==='👩🏽‍💻'));
  const lrc=buildStageTimeline(parseLyrics('[00:01]没有逐字数据\n[00:05]下一行'),8000);
  assert.equal(lrc[0]!.groups.length,1);assert.equal(lrc[0]!.groups[0]!.line.words,undefined);
  assert.equal(activeStageGroup(lrc,8000),undefined);
});
test('invalid words safely fall back to line timing; backgrounds do not replace lead text',()=>{
  const document:LyricDocument={synced:true,plain:[],lines:[{startMs:1000,endMs:4000,text:'lead',words:[{text:'wrong',startMs:0,endMs:9000}]},{startMs:1000,endMs:4000,text:'background',background:true},{startMs:4000,endMs:5000,text:'next'}]};
  const timeline=buildStageTimeline(document);assert.equal(timeline.length,2);
  assert.equal(activeStageGroup(timeline,2000)!.line.text,'lead');
  assert.equal(activeStageGroup(timeline,2000)!.line.words,undefined);
  assert.equal(activeStageGroup(timeline,4000)!.line.text,'next');
  assert.deepEqual(buildStageTimeline({synced:false,plain:['plain'],lines:[]}),[]);
});


test('stage does not put a group boundary inside a split combining or ZWJ sequence',()=>{
  const parts=['abcd','e','́','👩','🏽','\u200d','💻','next'];
  const document:LyricDocument={synced:true,plain:[],lines:[{startMs:0,endMs:8000,text:parts.join(''),words:parts.map((text,index)=>({text,startMs:index*1000,endMs:(index+1)*1000}))}]};
  const groups=buildStageTimeline(document)[0]!.groups.map(group=>group.line.text);
  assert.ok(groups.some(text=>text.includes('é')));assert.ok(groups.some(text=>text.includes('👩🏽‍💻')));
  assert.equal(groups.join(''),parts.join(''));
});


test('stage waits for the first actual word onset inside an earlier line interval',()=>{
  const document:LyricDocument={synced:true,plain:[],lines:[{startMs:0,endMs:4000,text:'late',words:[{startMs:1500,endMs:3000,text:'late'}]}]};
  const timeline=buildStageTimeline(document);assert.equal(activeStageGroup(timeline,1499),undefined);
  assert.equal(activeStageGroup(timeline,1500)!.line.text,'late');assert.equal(activeStageGroup(timeline,3999)!.line.text,'late');
  assert.equal(activeStageGroup(timeline,4000),undefined);
});
