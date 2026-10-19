import test from 'node:test';
import assert from 'node:assert/strict';
import {PhotoActions} from '../src/domain/photoPlayer.ts';
function fixture(){
  const jobs:{callback:()=>void;ms:number;cancelled:boolean}[]=[];
  const model=new PhotoActions({schedule:(callback,ms)=>{const job={callback,ms,cancelled:false};jobs.push(job);return()=>{job.cancelled=true;};}});
  model.configure('a',true);return {model,jobs};
}
test('photo starts hidden and expires five seconds after opening without media commands',()=>{
  const {model,jobs}=fixture();assert.equal(model.getSnapshot(),false);assert.equal(jobs.length,0);
  model.toggle();assert.equal(model.getSnapshot(),true);assert.equal(jobs[0]!.ms,5000);jobs[0]!.callback();assert.equal(model.getSnapshot(),false);
});
test('photo interaction replaces deadline and ignores callbacks already queued for delivery',()=>{
  const {model,jobs}=fixture();model.toggle();model.interact();assert.equal(jobs[0]!.cancelled,true);jobs[0]!.callback();assert.equal(model.getSnapshot(),true);
  jobs[1]!.callback();assert.equal(model.getSnapshot(),false);model.interact();assert.equal(jobs.length,2);
});
test('photo drag holds actions until release; canceled expiry cannot interrupt a held gesture',()=>{
  const {model,jobs}=fixture();model.toggle();model.touch(true);assert.equal(jobs[0]!.cancelled,true);jobs[0]!.callback();assert.equal(model.getSnapshot(),true);
  model.touch(false);assert.equal(jobs[1]!.ms,5000);jobs[1]!.callback();assert.equal(model.getSnapshot(),false);
});
test('photo navigation, hidden page, foreground restoration and identity replacement clear presentation',()=>{
  const {model,jobs}=fixture();model.toggle();model.configure('a',false);jobs[0]!.callback();model.toggle();assert.equal(model.getSnapshot(),false);
  model.configure('a',true);assert.equal(model.getSnapshot(),false);model.toggle();model.configure('b',true);jobs[1]!.callback();assert.equal(model.getSnapshot(),false);
  model.toggle();model.configure('b',false);model.configure('b',true);jobs[2]!.callback();assert.equal(model.getSnapshot(),false);
});
test('photo disposal cancels pending work and prevents stale listener publication',()=>{
  const {model,jobs}=fixture();let emissions=0;model.subscribe(()=>emissions++);model.toggle();model.dispose();jobs[0]!.callback();assert.equal(jobs[0]!.cancelled,true);assert.equal(emissions,1);
});
