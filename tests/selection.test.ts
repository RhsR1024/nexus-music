import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  selectionNone,selectionEnter,selectionToggle,selectionAll,selectionToggleAll,selectionExit,
  selectionHas,selectionCount,selectionByTapOrder,selectionByListOrder,
} from '../src/domain/selection.ts';

// Sollin §4 contract: 已选 N / 总数 counts against the loaded collection, and the
// two action families read different orders (favorite = tap order, play-next =
// list order). The model must keep both observable.

const rows=[{id:'a'},{id:'b'},{id:'c'},{id:'d'}];
const idOf=(row:{id:string})=>row.id;

test('long press enters selection with the pressed row and toggle keeps tap order',()=>{
  let model=selectionEnter('c');
  assert.equal(selectionCount(model),1);
  model=selectionToggle(model,'a');
  model=selectionToggle(model,'d');
  assert.deepEqual(model.ids,['c','a','d']);
  model=selectionToggle(model,'a');
  assert.deepEqual(model.ids,['c','d']);
  assert.equal(selectionHas(model,'a'),false);
  assert.equal(selectionHas(model,'c'),true);
});

test('select all adopts the loaded order so both action orders agree',()=>{
  const model=selectionAll(selectionEnter('c'),['a','b','c','d']);
  assert.deepEqual(model.ids,['a','b','c','d']);
  assert.deepEqual(selectionByTapOrder(model,rows,idOf).map(idOf),['a','b','c','d']);
  assert.deepEqual(selectionByListOrder(model,rows,idOf).map(idOf),['a','b','c','d']);
});

test('a partial selection keeps the tap order and the list order separately',()=>{
  let model=selectionEnter('d');
  model=selectionToggle(model,'b');
  assert.deepEqual(selectionByTapOrder(model,rows,idOf).map(idOf),['d','b']);
  assert.deepEqual(selectionByListOrder(model,rows,idOf).map(idOf),['b','d']);
});

test('selection stays scoped to the loaded collection and exits cleanly',()=>{
  let model=selectionAll(selectionEnter('a'),['a','b']);
  // Rows outside the current collection never leak into the action payload.
  const narrowed=selectionByTapOrder(model,[{id:'a'}],idOf);
  assert.deepEqual(narrowed.map(idOf),['a']);
  model=selectionExit();
  assert.equal(model.active,false);
  assert.equal(selectionCount(model),0);
  assert.equal(selectionHas(selectionToggle(model,'a'),'a'),true,'toggling outside selection starts a new one');
});

test('an empty loaded collection cannot be fully selected',()=>{
  const model=selectionAll(selectionEnter('a'),[]);
  assert.deepEqual(model.ids,[]);
  assert.equal(selectionCount(model),0);
  assert.equal(selectionNone.active,false);
});

test('select-all control clears a full selection, stays active and selects again in list order',()=>{
  let model=selectionToggleAll(selectionEnter('c'),['a','b','c']);
  assert.deepEqual(model,{active:true,ids:['a','b','c']});
  model=selectionToggleAll(model,['a','b','c']);
  assert.deepEqual(model,{active:true,ids:[]});
  model=selectionToggleAll(model,['c','a']);
  assert.deepEqual(model,{active:true,ids:['c','a']});
});

test('select-all control compares current page identities rather than stale selection counts',()=>{
  assert.deepEqual(selectionToggleAll({active:true,ids:['a','stale']},['a','b']),{active:true,ids:['a','b']});
  assert.deepEqual(selectionToggleAll({active:true,ids:['a','b','stale']},['b','a']),{active:true,ids:[]});
  assert.deepEqual(selectionToggleAll(selectionEnter('stale'),[]),{active:true,ids:[]});
  assert.equal(selectionToggleAll(selectionNone,['a']),selectionNone,'the control cannot enter an inactive page');
});
