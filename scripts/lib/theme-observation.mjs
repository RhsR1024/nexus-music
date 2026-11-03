const uuid=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/i.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const palette=value=>Array.isArray(value)&&value.length<=3&&value.every(color=>/^#[A-F0-9]{6}$/.test(color));
// One immutable response per explicit checkpoint. Old processes and duplicate
// deliveries cannot overwrite the evidence of a newer launch.
export class ThemeObservation {
  command;
  result;
  begin(boot,nonce){
    if(!uuid(boot)||!uuid(nonce))throw Error('Invalid observation checkpoint');
    this.command={boot,nonce};this.result=undefined;
  }
  poll(boot){return this.command?.boot===boot&&!this.result?this.command:{};}
  accept(value){
    if(!this.command||this.result||value?.boot!==this.command.boot||value?.nonce!==this.command.nonce)return false;
    if(value.error){this.result={boot:value.boot,nonce:value.nonce,error:'Observation failed'};return true;}
    const store=value.store;
    if(!store||typeof store.pending!=='boolean'||!hash(store.identityDigest)||!palette(store.palette))return false;
    if(!Array.isArray(value.native)||value.native.length>16||!value.native.every(view=>
      uuid(view.instanceID)&&hash(view.identityDigest)&&palette(view.palette)&&
      ['visible','pending','dark','installedScene','moving'].every(key=>typeof view[key]==='boolean')&&
      ['width','height','timelineTime','sceneColorCount','visibleX','visibleY','visibleWidth','visibleHeight'].every(key=>Number.isFinite(view[key])&&view[key]>=0)&&
      ((view.renderedPrimaryHueCounts===undefined&&view.renderedHueSamples===undefined)||
        Number.isInteger(view.renderedHueSamples)&&view.renderedHueSamples>0&&
        Array.isArray(view.renderedPrimaryHueCounts)&&view.renderedPrimaryHueCounts.length===3&&
        view.renderedPrimaryHueCounts.every(count=>Number.isInteger(count)&&count>=0&&count<=view.renderedHueSamples))&&
      (view.png===undefined||typeof view.png==='string'&&view.png.length<=3_000_000&&/^[A-Za-z0-9+/=]+$/.test(view.png))))return false;
    this.result=structuredClone(value);return true;
  }
}
