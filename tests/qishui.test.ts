import {test} from 'node:test';
import assert from 'node:assert/strict';
import {QishuiProvider,qishuiID} from '../src/providers/qishui.ts';
const media=(id:string)=>({entity:{track_wrapper:{track:{id,name:'Synthetic',artists:[{name:'Fixture'}],duration:10000}}}});
test('Qishui public playlist preserves long IDs, order and duplicates across all pages',async()=>{
  const id='12345678901234567890',cursors:string[]=[];
  const provider=new QishuiProvider(async(_url,request)=>{
    const body=JSON.parse(request.body!);assert.equal(body.playlist_id,id);cursors.push(body.cursor);
    return{playlist:{id,title:'Fixture',count_tracks:3},media_resources:body.cursor==='0'?[media('1'),media('2')]:[media('1')],has_more:body.cursor==='0',next_cursor:'next'};
  });
  const result=await provider.complete(id,new AbortController().signal);assert.deepEqual(cursors,['0','next']);assert.deepEqual(result.tracks.map(t=>t.origin.id),['1','2','1']);assert.equal(result.tracks[0]?.origin.kind,'imported');
});
test('Qishui incomplete lists, changed count and repeated cursor cannot be imported as complete',async()=>{
  for(const mode of ['missing','cursor','changed']){
    let calls=0;const p=new QishuiProvider(async()=>({playlist:{id:'123',count_tracks:mode==='changed'&&++calls>1?3:2},media_resources:[media('1')],has_more:mode!=='missing',next_cursor:mode==='cursor'?'0':'next'}));
    await assert.rejects(p.complete('123',new AbortController().signal),/不完整|分页|改变/);
  }
});
test('Qishui short links stay on official hosts and secrets or arbitrary URLs are rejected',async()=>{
  assert.equal(qishuiID('分享 https://music.douyin.com/qishui/share/playlist?playlist_id=12345678901234567890'),'12345678901234567890');
  assert.throws(()=>qishuiID('https://evil.test/?playlist_id=1'));assert.throws(()=>qishuiID('https://user:password@music.douyin.com/?playlist_id=1'));
  const provider=new QishuiProvider(async()=>({playlist:{id:'123',title:'Empty',count_tracks:0},media_resources:[],has_more:false}),async()=> 'https://music.douyin.com/qishui/share/playlist?playlist_id=123');
  assert.equal((await provider.complete('https://qishui.douyin.com/s/fixture',new AbortController().signal)).id,'123');
  const bad=new QishuiProvider(async()=>{throw Error('must not request');},async()=> 'https://evil.test/?playlist_id=123');
  await assert.rejects(bad.complete('https://qishui.douyin.com/s/fixture',new AbortController().signal),/官方/);
});
