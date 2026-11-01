import type {Track} from '../domain/track.ts';
import {trackKey} from '../domain/track.ts';
export interface SimilarSongsSnapshot{anchor?:Track;status:'idle'|'loading'|'ready'|'error';items:readonly Track[];error?:string}
export class SimilarSongsSession{
 private state:SimilarSongsSnapshot={status:'idle',items:[]};private listeners=new Set<()=>void>();private serial=0;private abort?:AbortController;
 private read:(track:Track,signal:AbortSignal)=>Promise<readonly Track[]>;
 constructor(read:(track:Track,signal:AbortSignal)=>Promise<readonly Track[]>){this.read=read;}
 getSnapshot=()=>this.state;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private publish(state:SimilarSongsSnapshot){this.state=state;for(const listener of this.listeners)listener();}
 cancel(){this.serial++;this.abort?.abort();}
 async load(track:Track,refresh=false){
  this.cancel();const serial=this.serial,abort=this.abort=new AbortController();
  const items=refresh&&this.state.anchor&&trackKey(this.state.anchor.origin)===trackKey(track.origin)?this.state.items:[];
  this.publish({anchor:track,status:'loading',items});
  try{const result=await this.read(track,abort.signal);if(serial===this.serial&&!abort.signal.aborted)this.publish({anchor:track,status:'ready',items:result});}
  catch{if(serial===this.serial&&!abort.signal.aborted)this.publish({anchor:track,status:'error',items,error:items.length?'刷新未完成，保留上次推荐；请重试。':'相似歌曲未能载入，请重试。'});}
 }
}
