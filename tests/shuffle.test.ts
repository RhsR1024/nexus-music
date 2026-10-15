import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ShuffleNavigator} from '../src/domain/shuffle.ts';
import {makeQueue,select,remove} from '../src/domain/queue.ts';
const queue=()=>makeQueue(['a','b','c'].map(id=>({id,track:{origin:{kind:'online' as const,platform:'wy' as const,id:'same-song'},title:'Fixture',artist:'Fixture',metadata:{},qualities:[]}})));
test('shuffle visits each queue entry once before stopping or starting another cycle',()=>{
  const shuffle=new ShuffleNavigator(()=>0);let value=queue();const ids=[value.currentId];
  value=shuffle.next(value,false);ids.push(value.currentId);value=shuffle.next(value,false);ids.push(value.currentId);
  assert.deepEqual(ids,['a','b','c']);assert.equal(shuffle.next(value,false).currentId,null);
  const loop=new ShuffleNavigator(()=>0);value=queue();value=loop.next(value,true);value=loop.next(value,true);assert.notEqual(loop.next(value,true).currentId,value.currentId);
});
test('shuffle previous follows actual playback history and forward resumes it',()=>{
  const shuffle=new ShuffleNavigator(()=>0);let value=queue();value=shuffle.next(value,false);value=shuffle.next(value,false);
  value=shuffle.next(value,false,-1);assert.equal(value.currentId,'b');value=shuffle.next(value,false,-1);assert.equal(value.currentId,'a');value=shuffle.next(value,false);assert.equal(value.currentId,'b');
});
test('manual selection and removed entries do not leave dangling shuffle candidates',()=>{
  const shuffle=new ShuffleNavigator(()=>0);let value=queue();shuffle.observe(value);value=select(value,'c');shuffle.observe(value);value=remove(value,'b');assert.equal(shuffle.next(value,false).currentId,null);
});
