import type {MusicAccounts} from './musicAccounts.ts';
import {KugouLoginError,type KugouLoginClient} from './kugouLogin.ts';

export type KugouLoginStatus='idle'|'loading'|'waiting'|'scanned'|'saving'|'succeeded'|'cancelled'|'expired'|'failed';
export interface KugouLoginSnapshot {readonly status:KugouLoginStatus;readonly generation:number;readonly image?:string;readonly expiresAt?:number}
export const kugouLoginBusy=(status:KugouLoginStatus)=>['loading','waiting','scanned','saving'].includes(status);

/** The UI snapshot never contains a QR key, device nonce or account token. */
export class KugouLoginCoordinator {
  private value:KugouLoginSnapshot={status:'idle',generation:0};
  private readonly listeners=new Set<()=>void>();
  private controller?:AbortController;
  private deadline?:ReturnType<typeof setTimeout>;
  private readonly options:{client:Pick<KugouLoginClient,'create'|'poll'>;accounts:Pick<MusicAccounts,'save'>;pollMs?:number};
  constructor(options:KugouLoginCoordinator['options']){this.options=options;}
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  private publish(value:KugouLoginSnapshot){this.value=value;for(const listener of this.listeners)listener();}
  private stop(){clearTimeout(this.deadline);this.deadline=undefined;this.controller?.abort();this.controller=undefined;}
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
      if(qr.expiresAt<=Date.now()){finish('expired');return;}
      clearTimeout(this.deadline);this.deadline=setTimeout(()=>finish('expired'),Math.min(120_000,qr.expiresAt-Date.now()));
      this.publish({status:'waiting',generation,image:qr.image,expiresAt:qr.expiresAt});
      while(active()){
        const result=await this.options.client.poll(qr,signal);
        if(!active())return;
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
