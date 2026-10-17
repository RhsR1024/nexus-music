import {isFlowPalette,type FlowPalette} from '../domain/appearance.ts';
import {InvalidRecordError} from './recovery.ts';
import type {Repository} from './repository.ts';
export type VisualSlot='background'|'photo';
export interface VisualAsset {id:string;name:string;width:number;height:number}
export interface VisualState {version:1;background:VisualAsset|null;photo:VisualAsset|null}
export interface VisualNative {importVisual(uri:string):Promise<{id:string;width:number;height:number}>;resolveVisual(id:string):Promise<string>;reconcileVisuals(ids:readonly string[]):Promise<void>;visualPalette(uri:string):Promise<string>;visualFlowPalette?(uri:string):Promise<readonly string[]>}
// Only stable stages cross the UI boundary; native errors may contain private paths.
export class VisualImportError extends Error {
  readonly stage:'read'|'validate'|'save';
  constructor(stage:'read'|'validate'|'save'){super(`Visual import failed: ${stage}`);this.name='VisualImportError';this.stage=stage;}
}
const empty:VisualState={version:1,background:null,photo:null};
function asset(value:unknown):VisualAsset|null{
  if(value===null)return null;
  const v=value as VisualAsset;
  if(!v||typeof v.id!=='string'||!/^[a-f0-9]{64}$/.test(v.id)||typeof v.name!=='string'||!v.name||v.name.length>240||!Number.isInteger(v.width)||v.width<1||v.width>1920||!Number.isInteger(v.height)||v.height<1||v.height>1920)throw new InvalidRecordError();
  return{id:v.id,name:v.name,width:v.width,height:v.height};
}
export class VisualAssetStore {
  private value:VisualState=empty;private listeners=new Set<()=>void>();private tail:Promise<unknown>=Promise.resolve();
  private repository:Pick<Repository,'get'|'put'>;private native:VisualNative;
  constructor(repository:Pick<Repository,'get'|'put'>,native:VisualNative){this.repository=repository;this.native=native;}
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private ids(){return [...new Set([this.value.background?.id,this.value.photo?.id].filter((id):id is string=>!!id))];}
  private cleanup(){return this.native.reconcileVisuals(this.ids()).catch(()=>{});}
  async restore(){const saved=await this.repository.get<VisualState>('visualAssets.v1');if(saved){if(saved.version!==1)throw new InvalidRecordError();this.value={version:1,background:asset(saved.background),photo:asset(saved.photo)};}await this.cleanup();}
  private run(action:()=>Promise<void>){const pending=this.tail.then(action);this.tail=pending.catch(()=>{});return pending;}
  import(slot:VisualSlot,uri:string,name:string){return this.run(async()=>{
    if(!['background','photo'].includes(slot)||!uri.startsWith('file:'))throw new Error('请选择本机图片');
    try{
      let imported:Awaited<ReturnType<VisualNative['importVisual']>>;
      try{imported=await this.native.importVisual(uri);}catch{throw new VisualImportError('read');}
      let image:VisualAsset|null;
      try{image=asset({...imported,name:name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,240)||'自定义图片'});}catch{throw new VisualImportError('validate');}
      try{await this.publish({...this.value,[slot]:image});}catch{throw new VisualImportError('save');}
    }
    finally{await this.cleanup();}
  });}
  remove(slot:VisualSlot){return this.run(async()=>{if(!['background','photo'].includes(slot))throw new Error('图片槽位无效');await this.publish({...this.value,[slot]:null});await this.cleanup();});}
  private async publish(value:VisualState){await this.repository.put('visualAssets.v1',value);this.value=value;for(const listener of this.listeners)listener();}
  async resolve(image:VisualAsset|null){if(!image)return;try{return await this.native.resolveVisual(image.id);}catch{return;}}
}
export class VisualColorCache {
  private cache=new Map<string,string|FlowPalette>();private pending=new Map<string,Promise<string|FlowPalette>>();private epoch=0;
  private native:Pick<VisualNative,'visualPalette'|'visualFlowPalette'>;
  constructor(native:Pick<VisualNative,'visualPalette'|'visualFlowPalette'>){this.native=native;}
  clear(){this.epoch++;this.cache.clear();this.pending.clear();}
  async color(uri:string):Promise<string>{
    return this.request('color:'+uri,()=>this.native.visualPalette(uri),value=>{
      if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))throw new Error('Invalid visual color');return value;
    });
  }
  async flowPalette(uri:string):Promise<FlowPalette>{
    if(!this.native.visualFlowPalette){const color=await this.color(uri);return Object.freeze([color,color,color]);}
    return this.request('flow:'+uri,()=>this.native.visualFlowPalette!(uri),value=>{
      if(!isFlowPalette(value))throw new Error('Invalid visual flow palette');return Object.freeze([value[0],value[1],value[2]]);
    });
  }
  private request<T extends string|FlowPalette>(key:string,load:()=>Promise<unknown>,validate:(value:unknown)=>T):Promise<T>{
    const cached=this.cache.get(key);if(cached){this.cache.delete(key);this.cache.set(key,cached);return Promise.resolve(cached as T);}
    const current=this.pending.get(key);if(current)return current as Promise<T>;
    if(this.pending.size>=32)return Promise.reject(new Error('Visual palette queue is full'));
    const epoch=this.epoch;
    const pending=load().then(value=>{const result=validate(value);if(epoch!==this.epoch)throw new Error('Visual palette cache changed');this.cache.set(key,result);if(this.cache.size>50)this.cache.delete(this.cache.keys().next().value!);return result;}).finally(()=>{if(this.pending.get(key)===pending)this.pending.delete(key);});
    this.pending.set(key,pending);return pending;
  }
}
