import {validKugouQrImage} from './kugouLogin.ts';
import type {KugouLoginCoordinator,KugouLoginSnapshot} from './kugouLoginCoordinator.ts';
export interface LoginQrPhotoNative{saveLoginQrPhoto(id:string,image:string,expiresAt:number):Promise<boolean>;cancelLoginQrPhoto(id:string):Promise<void>}
export type QrPhotoState='idle'|'saving'|'saved'|'saved_stale'|'denied'|'expired'|'cancelled'|'failed';
export interface QrPhotoSnapshot{readonly status:QrPhotoState;readonly generation:number}
export class KugouQrPhoto{
  private value:QrPhotoSnapshot={status:'idle',generation:0};private readonly listeners=new Set<()=>void>();
  private pending?:{id:string;qr:KugouLoginSnapshot};
  private readonly deps:{login:Pick<KugouLoginCoordinator,'getSnapshot'|'subscribe'|'allowSameDeviceHandoff'>;native:LoginQrPhotoNative;uuid:()=>string;now?:()=>number};
  constructor(deps:KugouQrPhoto['deps']){this.deps=deps;deps.login.subscribe(()=>{
    if(this.pending&&!this.current(this.pending.qr))void deps.native.cancelLoginQrPhoto(this.pending.id).catch(()=>{});
    else if(!this.pending)this.publish({status:'idle',generation:deps.login.getSnapshot().generation});
  });}
  getSnapshot=()=>this.value;
  subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
  private publish(value:QrPhotoSnapshot){this.value=value;for(const fn of this.listeners)fn();}
  private current(qr:KugouLoginSnapshot){const value=this.deps.login.getSnapshot();return value.generation===qr.generation&&value.image===qr.image&&value.expiresAt===qr.expiresAt&&['waiting','scanned'].includes(value.status)&&!!qr.expiresAt&&qr.expiresAt>(this.deps.now??Date.now)();}
  async save():Promise<void>{
    if(this.pending)return;
    const qr=this.deps.login.getSnapshot();
    if(!this.current(qr)||!validKugouQrImage(qr.image)){this.publish({status:'expired',generation:qr.generation});return;}
    const attempt={id:this.deps.uuid(),qr};this.pending=attempt;this.publish({status:'saving',generation:qr.generation});
    try{
      const saved=await this.deps.native.saveLoginQrPhoto(attempt.id,qr.image!,qr.expiresAt!);
      if(saved&&this.current(qr))this.deps.login.allowSameDeviceHandoff(qr.generation);
      this.publish({status:saved?(this.current(qr)?'saved':'saved_stale'):'failed',generation:qr.generation});
    }catch(error){
      const code=error&&typeof error==='object'&&'code' in error?String(error.code):'';
      this.publish({status:!this.current(qr)||code==='QR_PHOTO_CANCELLED'?'cancelled':code==='QR_PHOTO_PERMISSION'?'denied':code==='QR_PHOTO_EXPIRED'?'expired':'failed',generation:qr.generation});
    }finally{if(this.pending===attempt)this.pending=undefined;}
  }
}
