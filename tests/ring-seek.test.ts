import test from 'node:test';
import assert from 'node:assert/strict';
import {RingSeekGesture,ringFraction} from '../src/domain/ringSeek.ts';

test('ring uses clockwise clock positions and rejects invalid/central coordinates',()=>{
  assert.equal(ringFraction(74,0,148),0);assert.equal(ringFraction(148,74,148),.25);
  assert.equal(ringFraction(74,148,148),.5);assert.equal(ringFraction(0,74,148),.75);
  assert.equal(ringFraction(74,74,148),undefined);assert.equal(ringFraction(NaN,0,148),undefined);
  assert.equal(ringFraction(0,0,0),undefined);assert.equal(ringFraction(74,65,148,26),undefined);
});
test('ring preview commits once for its original resolved recording and duration',()=>{
  const g=new RingSeekGesture();assert.equal(g.begin('recording-a',120,.25),.25);
  assert.equal(g.move('recording-a',120,.5),.5);assert.equal(g.preview('recording-a',120),.5);
  assert.equal(g.finish('recording-a',120),60);assert.equal(g.finish('recording-a',120),undefined);
  g.begin('recording-a',120,.5);assert.equal(g.finish('recording-b',120),undefined);
  g.begin('recording-a',120,.5);assert.equal(g.finish('recording-a',240),undefined);
  g.begin('recording-a',120,.5);assert.equal(g.preview(undefined,120),undefined);
});
test('ring cancellation, invalid starts and stale moves never produce a seek',()=>{
  const g=new RingSeekGesture();
  for(const [token,duration,fraction] of [[undefined,120,.5],['a',0,.5],['a',Infinity,.5],['a',120,NaN],['a',120,2]] as const){
    assert.equal(g.begin(token,duration,fraction),undefined);assert.equal(g.finish('a',120),undefined);
  }
  g.begin('a',120,.5);g.cancel();assert.equal(g.finish('a',120),undefined);
  g.begin('a',120,.5);assert.equal(g.move('b',120,.75),undefined);assert.equal(g.finish('b',120),undefined);
  g.begin('a',120,.5);assert.equal(g.move('a',120,undefined),.5);assert.equal(g.move('a',120,NaN),.5);
});
test('ring drag clamps across the seam and can reverse without a full-track jump',()=>{
  const g=new RingSeekGesture();g.begin('a',120,.98);
  assert.equal(g.move('a',120,.02),1);assert.equal(g.move('a',120,.98),.96);
  assert.ok(Math.abs(g.finish('a',120)!-115.2)<1e-10);
  g.begin('a',120,.02);assert.equal(g.move('a',120,.98),0);
  assert.ok(Math.abs(g.move('a',120,.02)!-.04)<1e-10);
});
