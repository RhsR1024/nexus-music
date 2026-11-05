export type SleepState={mode:'off'}|{mode:'duration';deadline:number}|{mode:'track';entryId:string};
export function sleepCountdown(deadline:number,now=Date.now()){
  const seconds=Math.max(0,Math.ceil((deadline-now)/1000));
  if(seconds===0)return '即将停止';
  const hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),remainder=seconds%60;
  return hours>0?`${hours}:${String(minutes).padStart(2,'0')}:${String(remainder).padStart(2,'0')}`:`${minutes}:${String(remainder).padStart(2,'0')}`;
}
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
