import type {Track} from '../domain/track.ts';
import {lyricSignature} from '../domain/matching.ts';
import {activeLyric,type LyricDocument} from './parser.ts';
export interface LyricPreviewState {identity:string;loading:boolean;failed:boolean;document?:LyricDocument}
export class LyricPreview {
  private value:LyricPreviewState={identity:'',loading:false,failed:false};
  private listeners=new Set<()=>void>();private request?:AbortController;private generation=0;
  private loader:(track:Track,signal:AbortSignal)=>Promise<{document:LyricDocument}>;
  constructor(loader:(track:Track,signal:AbortSignal)=>Promise<{document:LyricDocument}>){this.loader=loader;}
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(value:LyricPreviewState){this.value=value;for(const listener of this.listeners)listener();}
  clear(){this.generation++;this.request?.abort();this.request=undefined;this.publish({identity:'',loading:false,failed:false});}
  async load(track:Track){
    this.request?.abort();const generation=++this.generation,request=new AbortController(),identity=lyricSignature(track);this.request=request;
    this.publish({identity,loading:true,failed:false});
    try{const result=await this.loader(track,request.signal);if(!request.signal.aborted&&generation===this.generation)this.publish({identity,loading:false,failed:false,document:result.document});}
    catch{if(!request.signal.aborted&&generation===this.generation)this.publish({identity,loading:false,failed:true});}
    finally{if(this.request===request)this.request=undefined;}
  }
}
export function miniLyricText(document:LyricDocument|undefined,positionMs:number,offsetMs=0):string|undefined {
  if(!document)return;
  const active=activeLyric(document.lines,positionMs,offsetMs),first=document.lines.find(line=>!line.background);
  const line=active>=0?document.lines[active]:first&&positionMs-offsetMs<first.startMs?first:undefined;
  const text=(document.synced?line?.text:document.plain.find(value=>!!value.trim()))?.trim();
  return text?(text.length>280?text.slice(0,280).replace(/[\uD800-\uDBFF]$/,'')+'…':text):undefined;
}
