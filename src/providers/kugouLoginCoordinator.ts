import type {MusicAccounts} from './musicAccounts.ts';
import {KugouLoginError,type KugouLoginClient} from './kugouLogin.ts';

export type KugouLoginStatus='idle'|'loading'|'waiting'|'scanned'|'saving'|'succeeded'|'cancelled'|'expired'|'failed';
export interface KugouLoginSnapshot {readonly status:KugouLoginStatus;readonly generation:number;readonly image?:string;readonly expiresAt?:number;readonly sameDevice?:boolean}
export const kugouLoginBusy=(status:KugouLoginStatus)=>['loading','waiting','scanned','saving'].includes(status);

/** The UI snapshot never contains a QR key, device nonce or account token. */
export class KugouLoginCoordinator {
  private value:KugouLoginSnapshot={status:'idle',generation:0};
  private readonly listeners=new Set<()=>void>();
  private controller?:AbortController;
  private deadline?:ReturnType<typeof setTimeout>;
  private foreground=true;private handoff?:number;private wake?:()=>void;
  private readonly options:{client:Pick<KugouLoginClient,'create'|'poll'>;accounts:Pick<MusicAccounts,'save'>;pollMs?:number;now?:()=>number};
  constructor(options:KugouLoginCoordinator['options']){this.options=options;}
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  private publish(value:KugouLoginSnapshot){if(this.handoff===value.generation&&['waiting','scanned'].includes(value.status))value={...value,sameDevice:true};this.value=value;for(const listener of this.listeners)listener();}
  private stop(){this.handoff=undefined;clearTimeout(this.deadline);this.deadline=undefined;this.controller?.abort();this.controller=undefined;}
  allowSameDeviceHandoff=(generation:number)=>{
    if(this.value.generation!==generation||!['waiting','scanned'].includes(this.value.status)||!this.value.expiresAt||this.value.expiresAt<=(this.options.now??Date.now)())return;
    this.handoff=generation;this.publish({...this.value,sameDevice:true});
  };
  setForeground=(active:boolean)=>{
    this.foreground=active;
    if(!active&&this.handoff!==this.value.generation){this.cancel();return;}
    if(active&&kugouLoginBusy(this.value.status)&&this.value.expiresAt&&this.value.expiresAt<=(this.options.now??Date.now)()){
      const generation=this.value.generation;this.stop();this.publish({status:'expired',generation});return;
    }
    if(active)this.wake?.();
  };
  private waitForForeground(signal:AbortSignal):Promise<void>{
    if(this.foreground)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const cleanup=()=>{signal.removeEventListener('abort',abort);if(this.wake===wake)this.wake=undefined;};
      const wake=()=>{cleanup();resolve();},abort=()=>{cleanup();reject(new KugouLoginError('cancelled'));};
      this.wake=wake;signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort();
    });
  }
  cancel=()=>{if(!kugouLoginBusy(this.value.status))return;this.stop();this.publish({status:'cancelled',generation:this.value.generation});};
  imageFailed=(generation:number)=>{if(generation!==this.value.generation||!kugouLoginBusy(this.value.status))return;this.stop();this.publish({status:'failed',generation});};
  async login():Promise<void>{
    this.stop();
    const generation=this.value.generation+1,controller=new AbortController(),signal=controller.signal;
    this.controller=controller;
    const active=()=>this.controller===controller&&!signal.aborted;
    const finish=(status:KugouLoginStatus)=>{if(!active())return;this.stop();this.publish({status,generation});};
    this.publish({status:'loading',generation});
    this.deadline=setTimeout(()=>finish('expired'),120_000);
    try{
      const qr=await this.options.client.create(signal);
      if(!active())return;
      if(qr.expiresAt<=(this.options.now??Date.now)()){finish('expired');return;}
      clearTimeout(this.deadline);this.deadline=setTimeout(()=>finish('expired'),Math.min(120_000,qr.expiresAt-(this.options.now??Date.now)()));
      this.publish({status:'waiting',generation,image:qr.image,expiresAt:qr.expiresAt});
      while(active()){
        await this.waitForForeground(signal);if(!active())return;
        if(qr.expiresAt<=(this.options.now??Date.now)()){finish('expired');return;}
        const result=await this.options.client.poll(qr,signal);
        // An already started read may finish in the background; retain its
        // result only in this private, deadline-bound attempt until foreground.
        await this.waitForForeground(signal);if(!active())return;
        if(qr.expiresAt<=(this.options.now??Date.now)()){finish('expired');return;}
        if(result.status==='expired'){finish('expired');return;}
        if(result.status==='connected'){
          // Once a valid scan is confirmed, stop expiry of the consumed QR.
          clearTimeout(this.deadline);this.deadline=undefined;
          this.publish({status:'saving',generation});
          await this.options.accounts.save({platform:'kg',label:'酷狗音乐',username:result.session.userId,displayName:result.session.nickname,capabilities:[]},{version:1,platform:'kg',...result.session},signal);
          finish('succeeded');return;
        }
        if(result.status!==this.value.status)this.publish({status:result.status,generation,image:qr.image,expiresAt:qr.expiresAt});
        await new Promise<void>((resolve,reject)=>{
          const cleanup=()=>signal.removeEventListener('abort',cancel);
          const timer=setTimeout(()=>{cleanup();resolve();},this.options.pollMs??2000);
          const cancel=()=>{clearTimeout(timer);cleanup();reject(new KugouLoginError('cancelled'));};
          signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
        });
      }
    }catch{finish('failed');}
  }
}
