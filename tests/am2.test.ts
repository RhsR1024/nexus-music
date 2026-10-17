import test from 'node:test';
import assert from 'node:assert/strict';
import {AM2Presentation,am2Columns,type AM2Clock} from '../src/domain/am2.ts';
function fixture(){
  const jobs:{callback:()=>void;milliseconds:number;cancelled:boolean}[]=[];
  const clock:AM2Clock={schedule:(callback,milliseconds)=>{const job={callback,milliseconds,cancelled:false};jobs.push(job);return()=>{job.cancelled=true;};}};
  const model=new AM2Presentation(clock),context={identity:'song-a',active:true,automatic:true,delaySeconds:5};model.configure(context);
  return {model,jobs,context};
}
test('AM2 content is exclusive, same choice returns to cover and auto only applies to lyrics',()=>{
  const {model,jobs}=fixture();model.select('queue');model.select('comments');assert.deepEqual(model.getSnapshot(),{content:'comments',fullscreen:false});assert.equal(jobs.length,0);
  model.select('comments');assert.equal(model.getSnapshot().content,'cover');model.select('lyrics');assert.equal(jobs[0]!.milliseconds,5000);jobs[0]!.callback();assert.deepEqual(model.getSnapshot(),{content:'lyrics',fullscreen:true});
  model.select('queue');jobs[0]!.callback();assert.deepEqual(model.getSnapshot(),{content:'queue',fullscreen:false});model.dispose();
});
test('AM2 ignores delayed callbacks after song replacement, hidden page, disabled auto and disposal',()=>{
  for(const boundary of ['identity','hidden','disabled','disposed'] as const){
    const {model,jobs,context}=fixture();model.select('lyrics');const delayed=jobs[0]!;
    if(boundary==='disposed')model.dispose();else model.configure({...context,...(boundary==='identity'?{identity:'song-b'}:boundary==='hidden'?{active:false}:{automatic:false})});
    assert.equal(delayed.cancelled,true);delayed.callback();assert.equal(model.getSnapshot().fullscreen,false);if(boundary==='identity')assert.equal(model.getSnapshot().content,'cover');model.dispose();
  }
});
test('AM2 touch holds suspend auto and release starts a fresh full delay without intercepting controls',()=>{
  const {model,jobs}=fixture();model.select('lyrics');const old=jobs[0]!;model.setTouching(true);old.callback();assert.equal(model.getSnapshot().fullscreen,false);assert.equal(old.cancelled,true);
  model.setTouching(false);assert.equal(jobs[1]!.milliseconds,5000);old.callback();assert.equal(model.getSnapshot().fullscreen,false);jobs[1]!.callback();assert.equal(model.getSnapshot().fullscreen,true);model.dispose();
});
test('AM2 delay changes and background resume invalidate the previous deadline',()=>{
  const {model,jobs,context}=fixture();model.select('lyrics');model.configure({...context,delaySeconds:2});jobs[0]!.callback();assert.equal(model.getSnapshot().fullscreen,false);assert.equal(jobs[1]!.milliseconds,2000);
  model.configure({...context,active:false});jobs[1]!.callback();assert.equal(model.getSnapshot().fullscreen,false);model.configure({...context,delaySeconds:3});assert.equal(jobs[2]!.milliseconds,3000);jobs[2]!.callback();assert.equal(model.getSnapshot().fullscreen,true);model.dispose();
});
test('AM2 window policy keeps compact and accessibility layouts single-column',()=>{
  assert.equal(am2Columns(380,780,1),false);assert.equal(am2Columns(796,290,1),true);assert.equal(am2Columns(976,1150,1),true);
  assert.equal(am2Columns(620,290,1),false);assert.equal(am2Columns(976,1150,2),false);assert.equal(am2Columns(NaN,400,1),false);
});
