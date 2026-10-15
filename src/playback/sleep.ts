export type SleepState={mode:'off'}|{mode:'duration';deadline:number}|{mode:'track';entryId:string};
export function sleepState(value:Record<string,unknown>):SleepState {
  if(value.mode==='duration'&&typeof value.deadline==='number'&&Number.isFinite(value.deadline))return{mode:'duration',deadline:value.deadline};
  if(value.mode==='track'&&typeof value.entryId==='string'&&value.entryId)return{mode:'track',entryId:value.entryId};return{mode:'off'};
}
export class SleepStore {
  private value:SleepState={mode:'off'};private revision=-1;private listeners=new Set<()=>void>();
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  getSnapshot=()=>this.value;
  update=(value:Record<string,unknown>)=>{if(typeof value.revision==='number'&&Number.isSafeInteger(value.revision)){if(value.revision<this.revision)return;this.revision=value.revision;}this.value=sleepState(value);for(const listener of this.listeners)listener();};
}
