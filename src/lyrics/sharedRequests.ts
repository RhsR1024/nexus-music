// Only coalesce live requests. Resolved documents remain in the service's own
// invalidatable cache, so account changes and cache clearing cannot revive a
// view-level copy. Each mounted consumer owns a cancellable lease.
export class SharedRequests<T> {
  private pending=new Map<string,{promise:Promise<T>;abort:AbortController;owners:number}>();
  acquire(key:string,load:(signal:AbortSignal)=>Promise<T>){
    let entry=this.pending.get(key);
    if(!entry){
      const abort=new AbortController();
      const created={abort,owners:0,promise:Promise.resolve().then(()=>load(abort.signal))};
      const remove=()=>{if(this.pending.get(key)===created)this.pending.delete(key);};
      created.promise.then(remove,remove);
      this.pending.set(key,created);entry=created;
    }
    entry.owners++;
    let released=false;
    return {promise:entry.promise,release:()=>{
      if(released)return;released=true;
      if(--entry.owners===0){entry.abort.abort();if(this.pending.get(key)===entry)this.pending.delete(key);}
    }};
  }
}
