import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ThemeObservation} from '../scripts/lib/theme-observation.mjs';
const boot='11111111-1111-1111-1111-111111111111',nonce='22222222-2222-2222-2222-222222222222';
test('theme checkpoint rejects stale processes, malformed state and duplicate results',()=>{
  const state=new ThemeObservation();state.begin(boot,nonce);
  assert.deepEqual(state.poll(nonce),{});
  const view={
    instanceID:'33333333-3333-3333-3333-333333333333',
    visible:true,pending:false,dark:true,installedScene:true,moving:false,
    width:430,height:932,timelineTime:0,sceneColorCount:3,
    visibleX:0,visibleY:0,visibleWidth:430,visibleHeight:932,
    identityDigest:'a'.repeat(64),palette:['#FF0000','#00FF00','#0000FF'],
    renderedHueSamples:86*186,renderedPrimaryHueCounts:[1000,2000,3000],
  };
  const payload={boot,nonce,store:{pending:false,identityDigest:'a'.repeat(64),palette:['#FF0000','#00FF00','#0000FF']},native:[view]};
  assert.equal(state.accept({...payload,boot:nonce}),false);
  assert.equal(state.accept({...payload,nonce:boot}),false);
  assert.equal(state.accept({...payload,store:{...payload.store,palette:['private/path']}}),false);
  assert.equal(state.accept({...payload,native:[{}]}),false);
  for(const invalid of [
    {renderedHueSamples:0},
    {renderedHueSamples:86*186,renderedPrimaryHueCounts:[1,2]},
    {renderedHueSamples:86*186,renderedPrimaryHueCounts:[1,2,-1]},
    {renderedHueSamples:86*186,renderedPrimaryHueCounts:[1,2,86*186+1]},
  ])assert.equal(state.accept({...payload,native:[{...view,...invalid}]}),false);
  assert.equal(state.accept(payload),true);
  payload.store.palette[0]='#FFFFFF';
  assert.equal(state.result.store.palette[0],'#FF0000');
  assert.deepEqual(state.poll(boot),{});
  assert.equal(state.accept(payload),false);
  state.begin(nonce,boot);assert.equal(state.result,undefined);
  assert.equal(state.accept({...payload,error:true}),false);
  assert.throws(()=>state.begin('bad',nonce));
});
