export type MusicAuthStatus='idle'|'waiting'|'succeeded'|'cancelled'|'expired'|'failed';
export interface MusicAuthSnapshot {readonly status:MusicAuthStatus;readonly generation:number;readonly error?:string}
export type MusicAuthEvent<T>={type:'success';value:T}|{type:'cancel'}|{type:'expired'}|{type:'error';error:unknown};
export type MusicAuthLauncher<T>=(emit:(event:MusicAuthEvent<T>)=>void)=>()=>void;

export class MusicAuthError extends Error {
  readonly kind:'cancelled'|'expired'|'failed';
  constructor(kind:'cancelled'|'expired'|'failed',message:string){super(message);this.kind=kind;}
}

/**
 * Owns one platform authorization attempt. A new attempt invalidates every
 * callback from the old one, including callbacks fired after native teardown.
 */
export class MusicAuthFlow<T> {
  private snapshot:MusicAuthSnapshot={status:'idle',generation:0};
  private listeners=new Set<()=>void>();
  private stop?:()=>void;
  private settle?:{resolve:(value:T)=>void;reject:(error:unknown)=>void};
  getSnapshot=()=>this.snapshot;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  private publish(snapshot:MusicAuthSnapshot){this.snapshot=snapshot;for(const listener of this.listeners)listener();}
  start(launch:MusicAuthLauncher<T>):Promise<T>{
    this.cancel();
    const generation=this.snapshot.generation+1;
    this.publish({status:'waiting',generation});
    return new Promise<T>((resolve,reject)=>{
      this.settle={resolve,reject};
      let active=true;
      const finish=(event:MusicAuthEvent<T>)=>{
        if(!active||this.snapshot.generation!==generation)return;
        active=false;const stop=this.stop;this.stop=undefined;this.settle=undefined;stop?.();
        if(event.type==='success'){this.publish({status:'succeeded',generation});resolve(event.value);return;}
        if(event.type==='cancel'){this.publish({status:'cancelled',generation});reject(new MusicAuthError('cancelled','授权已取消'));return;}
        if(event.type==='expired'){this.publish({status:'expired',generation});reject(new MusicAuthError('expired','授权已过期'));return;}
        const message=event.error instanceof Error?event.error.message:'授权失败';
        this.publish({status:'failed',generation,error:message});reject(new MusicAuthError('failed','授权失败'));
      };
      try{
        const stop=launch(finish);
        let cleaned=false;
        const cleanup=()=>{if(!cleaned){cleaned=true;stop();}};
        if(active)this.stop=()=>{active=false;cleanup();};else cleanup();
      }catch(error){finish({type:'error',error});}
    });
  }
  cancel(){
    if(!this.settle)return;
    const settle=this.settle;this.settle=undefined;const stop=this.stop;this.stop=undefined;stop?.();
    const generation=this.snapshot.generation;this.publish({status:'cancelled',generation});settle.reject(new MusicAuthError('cancelled','授权已取消'));
  }
}
