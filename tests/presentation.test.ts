import test from 'node:test';
import assert from 'node:assert/strict';
import {PresentationRegistry,coversPresentation,rootPresentation as root} from '../src/appearance/presentation.ts';

test('nested full screens restore the immediate visible parent before the root',()=>{
  const registry=new PresentationRegistry(),player=Symbol(),queue=Symbol();
  const closePlayer=registry.activate(player,root),closeQueue=registry.activate(queue,player);
  assert.equal(registry.getSnapshot(),queue);
  closeQueue();assert.equal(registry.getSnapshot(),player);
  closePlayer();assert.equal(registry.getSnapshot(),root);
});
test('a late child effect in a covered sibling never steals the visible branch',()=>{
  const registry=new PresentationRegistry(),player=Symbol(),discovery=Symbol(),lyrics=Symbol();
  const closePlayer=registry.activate(player,root),closeDiscovery=registry.activate(discovery,root);
  const closeLyrics=registry.activate(lyrics,player);
  assert.equal(registry.getSnapshot(),discovery);
  closeDiscovery();assert.equal(registry.getSnapshot(),lyrics);
  closeLyrics();assert.equal(registry.getSnapshot(),player);closePlayer();
});
test('child-before-parent effects and hidden-parent cleanup remain rooted',()=>{
  const registry=new PresentationRegistry(),parent=Symbol(),child=Symbol();
  const closeChild=registry.activate(child,parent);assert.equal(registry.getSnapshot(),root);
  const closeParent=registry.activate(parent,root);assert.equal(registry.getSnapshot(),child);
  closeParent();assert.equal(registry.getSnapshot(),root);
  closeChild();assert.equal(registry.getSnapshot(),root);
});
test('stale cleanup cannot dismiss a reopened presentation or another instance',()=>{
  const registry=new PresentationRegistry(),id=Symbol();
  const oldClose=registry.activate(id,root),otherId=Symbol(),closeOther=registry.activate(otherId,root);
  const newClose=registry.activate(id,root);
  oldClose();assert.equal(registry.getSnapshot(),id);
  newClose();newClose();assert.equal(registry.getSnapshot(),otherId);
  closeOther();assert.equal(registry.getSnapshot(),root);
  const other=new PresentationRegistry();other.activate(id,root);
  assert.equal(registry.getSnapshot(),root);assert.equal(other.getSnapshot(),id);
});
test('only changed visible ownership notifies and disposed listeners stay detached',()=>{
  const registry=new PresentationRegistry(),parent=Symbol(),child=Symbol();let notifications=0;
  const unsubscribe=registry.subscribe(()=>notifications++);
  const closeChild=registry.activate(child,parent);assert.equal(notifications,0);
  const closeParent=registry.activate(parent,root);assert.equal(notifications,1);
  closeParent();assert.equal(notifications,2);closeChild();assert.equal(notifications,2);
  unsubscribe();registry.activate(Symbol(),root);assert.equal(notifications,2);
});
test('page/form sheets and transparent overlays preserve the visible background',()=>{
  for(const props of [{presentationStyle:'pageSheet' as const},{presentationStyle:'formSheet' as const},{transparent:true},{transparent:true,presentationStyle:'overFullScreen' as const}])assert.equal(coversPresentation(props),false);
  for(const props of [{},{transparent:false},{presentationStyle:'fullScreen' as const},{presentationStyle:'overFullScreen' as const}])assert.equal(coversPresentation(props),true);
});
test('invalid root/self/cyclic parents are rejected without changing ownership',()=>{
  const registry=new PresentationRegistry(),parent=Symbol(),child=Symbol();
  registry.activate(parent,root);registry.activate(child,parent);
  assert.throws(()=>registry.activate(root,child));assert.throws(()=>registry.activate(child,child));assert.throws(()=>registry.activate(parent,child));
  assert.equal(registry.getSnapshot(),child);
});
