import test from 'node:test';
import assert from 'node:assert/strict';
import {KugouQrPhoto} from '../src/providers/kugouQrPhoto.ts';
import {themeCovers} from '../scripts/fixtures/theme-covers.mjs';
const image='data:image/png;base64,'+themeCovers.red;
function setup(){
 let qr={status:'waiting',generation:1,image,expiresAt:120001},now=1,listener;
 let save=async()=>true;const saves=[],cancelled=[];
 const exporter=new KugouQrPhoto({login:{getSnapshot:()=>qr,allowSameDeviceHandoff:()=>{},subscribe:fn=>{listener=fn;return()=>{};}},native:{saveLoginQrPhoto:async(...args)=>{saves.push(args);return save();},cancelLoginQrPhoto:async id=>{cancelled.push(id);}},uuid:()=> '11111111-1111-4111-8111-111111111111',now:()=>now});
 return{exporter,saves,cancelled,set:(value)=>{qr={...qr,...value};listener();},save:(v)=>{save=v;},time:(n)=>{now=n;}};
}
test('QR photo save requires a current validated image and never publishes the image or nonce',async()=>{
 const s=setup();await s.exporter.save();assert.equal(s.saves.length,1);assert.equal(s.exporter.getSnapshot().status,'saved');assert.deepEqual(Object.keys(s.exporter.getSnapshot()).sort(),['generation','status']);assert.ok(!JSON.stringify(s.exporter.getSnapshot()).includes('base64'));
 for(const change of [{status:'loading'},{status:'cancelled'},{image:'bad-image'},{expiresAt:0}]){const x=setup();x.set(change);await x.exporter.save();assert.equal(x.saves.length,0);assert.equal(x.exporter.getSnapshot().status,'expired');}
});
test('QR photo denied and transport failures stay fixed states without raw errors',async()=>{
 for(const [error,status] of [[{code:'QR_PHOTO_PERMISSION',message:'private details'},'denied'],[new Error('private raw details'),'failed'],[{code:'QR_PHOTO_EXPIRED'},'expired']]){const s=setup();s.save(async()=>{throw error;});await s.exporter.save();assert.equal(s.exporter.getSnapshot().status,status);assert.ok(!JSON.stringify(s.exporter.getSnapshot()).includes('private'));}
});
test('QR photo duplicate taps cannot start multiple Photos requests',async()=>{
 const s=setup();let release;s.save(()=>new Promise(r=>{release=r;}));const first=s.exporter.save();await s.exporter.save();assert.equal(s.saves.length,1);assert.equal(s.exporter.getSnapshot().status,'saving');release(true);await first;assert.equal(s.exporter.getSnapshot().status,'saved');
});
test('QR cancellation and replacement revoke pending save without declaring a committed copy failed',async()=>{
 for(const change of [{status:'cancelled',image:undefined},{generation:2,image:undefined},{status:'succeeded',image:undefined}]){const s=setup();let release;s.save(()=>new Promise(r=>{release=r;}));const pending=s.exporter.save();s.set(change);assert.equal(s.cancelled.length,1);release(true);await pending;assert.equal(s.exporter.getSnapshot().status,'saved_stale');}
});
test('QR expiry or native cancellation cannot be presented as successful save',async()=>{
 const s=setup();let reject;s.save(()=>new Promise((_,r)=>{reject=r;}));const pending=s.exporter.save();s.time(120002);s.set({status:'expired',image:undefined});reject({code:'QR_PHOTO_CANCELLED'});await pending;assert.equal(s.exporter.getSnapshot().status,'cancelled');
});
test('scan transition keeps the same valid QR; a new QR resets previous feedback',async()=>{
 const s=setup();let release;s.save(()=>new Promise(r=>{release=r;}));const pending=s.exporter.save();s.set({status:'scanned'});assert.equal(s.cancelled.length,0);release(true);await pending;assert.equal(s.exporter.getSnapshot().status,'saved');s.set({generation:2});assert.equal(s.exporter.getSnapshot().status,'idle');
});
