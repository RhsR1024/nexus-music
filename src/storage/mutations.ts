// Shared by stores whose snapshots are restored in one database transaction.
export class MutationQueue {
  private tail:Promise<unknown>=Promise.resolve();
  run<T>(work:()=>Promise<T>):Promise<T>{const result=this.tail.then(work);this.tail=result.catch(()=>{});return result;}
}
