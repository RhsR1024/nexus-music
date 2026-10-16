import type {Track} from '../domain/track.ts';
import type {LibraryStore} from '../storage/library.ts';

export interface SystemMediaNative {
  setSystemArtwork(file:string,itemID:string):Promise<void>;
  setSystemFavorite(favorite:boolean,itemID:string):Promise<void>;
}
interface Item {id:string;original:Track;abort:AbortController;ready:boolean}

// The native media item survives pause generations, but never survives a load/stop.
export class SystemMediaSession {
  private item:Item|undefined;
  private unsubscribe:()=>void;
  private native:SystemMediaNative;
  private covers:{loadTrack(track:Track,signal:AbortSignal):Promise<string|undefined>};
  private library:Pick<LibraryStore,'isFavorite'|'setFavorite'|'subscribe'>;
  constructor(native:SystemMediaNative,covers:{loadTrack(track:Track,signal:AbortSignal):Promise<string|undefined>},library:Pick<LibraryStore,'isFavorite'|'setFavorite'|'subscribe'>){
    this.native=native;this.covers=covers;this.library=library;
    this.unsubscribe=library.subscribe(()=>this.refresh());
  }
  clear(){this.item?.abort.abort();this.item=undefined;}
  load(original:Track,display:Track,id:string,loaded:Promise<void>){
    this.clear();const item:Item={id,original,abort:new AbortController(),ready:false};this.item=item;
    void loaded.then(async()=>{
      if(this.item!==item)return;
      item.ready=true;this.refresh();
      const file=await this.covers.loadTrack(display,item.abort.signal);
      if(this.item!==item||item.abort.signal.aborted)return;
      // Native validates ownership/size and guards the same item again after decoding.
      if(file)await this.native.setSystemArtwork(file,item.id);
    }).catch(()=>{});
  }
  isCurrent(id:unknown){return this.item!==undefined&&this.item.id===id;}
  private refresh(){
    const item=this.item;if(!item?.ready)return;
    void this.native.setSystemFavorite(this.library.isFavorite(item.original),item.id).catch(()=>{});
  }
  async favorite(event:Record<string,unknown>){
    const item=this.item;
    if(!item?.ready||event.itemID!==item.id||typeof event.favorite!=='boolean')return;
    try{await this.library.setFavorite(item.original,event.favorite,()=>this.item===item&&!item.abort.signal.aborted);}
    finally{if(this.item===item)this.refresh();}
  }
  dispose(){this.clear();this.unsubscribe();}
}
