import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rawPlaybackStatus} from '../src/ui/usePlaybackStatus.ts';

test('rawPlaybackStatus prioritizes error, then resolving, then active buffering, else idle',()=>{
  assert.equal(rawPlaybackStatus({phase:'resolving',buffering:true,error:'失败',intent:'playing',position:0}),'error');
  assert.equal(rawPlaybackStatus({phase:'resolving',buffering:false,error:null,intent:'playing',position:0}),'resolving');
  assert.equal(rawPlaybackStatus({phase:'ready',buffering:true,error:null,intent:'playing',position:1}),'buffering');
  assert.equal(rawPlaybackStatus({phase:'ready',buffering:true,error:null,intent:'paused',position:1}),'idle');
  assert.equal(rawPlaybackStatus({phase:'ready',buffering:false,error:null,intent:'playing',position:5}),'idle');
});
