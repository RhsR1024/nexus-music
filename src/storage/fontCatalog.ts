import {InvalidRecordError} from './recovery.ts';
import type {Repository} from './repository.ts';

export interface ImportedFont {id:string;name:string;file:string}
export type LyricFontMode='inherit'|'system'|'custom';
export interface FontState {version:1;fonts:readonly ImportedFont[];selected:string|null;global:string|null;lyricMode:LyricFontMode}
export interface FontFiles {
  exists(font:ImportedFont):boolean;
  prepare(uri:string,name:string):Promise<ImportedFont>;
  load(font:ImportedFont):Promise<void>;
  remove(font:ImportedFont):void;
  uri(font:ImportedFont):string;
}
export const emptyFonts:FontState={version:1,fonts:[],selected:null,global:null,lyricMode:'inherit'};
const validID=(id:unknown):id is string=>typeof id==='string'&&/^nexusfont_[a-f0-9]{64}$/.test(id);
export function effectiveLyricFont(state:FontState):string|undefined {
  return (state.lyricMode==='inherit'?state.global:state.lyricMode==='custom'?state.selected:null)??undefined;
}
// File and font registration are platform adapters; selection commits remain atomic.
export class FontCatalog {
  private value:FontState=emptyFonts;
  private listeners=new Set<()=>void>();private tail:Promise<unknown>=Promise.resolve();
  private repository:Pick<Repository,'get'|'put'>;private files:FontFiles;
  constructor(repository:Pick<Repository,'get'|'put'>,files:FontFiles){this.repository=repository;this.files=files;}
  getSnapshot=()=>this.value;
  selectedURI=()=>{const id=effectiveLyricFont(this.value),font=this.value.fonts.find(item=>item.id===id);return font?this.files.uri(font):undefined;};
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(value:FontState){this.value=value;for(const listener of this.listeners)listener();}
  private enqueue(run:()=>Promise<void>){const next=this.tail.then(run);this.tail=next.catch(()=>{});return next;}
  restore(){return this.enqueue(async()=>{
    const saved=await this.repository.get<FontState>('fonts.v1');if(!saved)return;
    if(saved.version!==1||!Array.isArray(saved.fonts)||saved.fonts.length>16||
      saved.fonts.some(item=>!item||!validID(item.id)||typeof item.name!=='string'||item.name.length>200||item.file!==`${item.id}.font`)||
      new Set(saved.fonts.map(item=>item.id)).size!==saved.fonts.length||
      saved.selected!==null&&!validID(saved.selected)||saved.global!==undefined&&saved.global!==null&&!validID(saved.global)||
      saved.lyricMode!==undefined&&!['inherit','system','custom'].includes(saved.lyricMode))throw new InvalidRecordError();
    const fonts=saved.fonts.filter(item=>this.files.exists(item));
    let selected=fonts.find(item=>item.id===saved.selected)?.id??null,global=fonts.find(item=>item.id===saved.global)?.id??null;
    let lyricMode:LyricFontMode=saved.lyricMode??(saved.selected?'custom':'inherit');
    for(const id of new Set([global,lyricMode==='custom'?selected:null]))if(id){
      try{await this.files.load(fonts.find(item=>item.id===id)!);}catch{if(global===id)global=null;if(selected===id)selected=null;}
    }
    if(lyricMode==='custom'&&!selected)lyricMode='system';
    this.publish({version:1,fonts,selected,global,lyricMode});
  });}
  import(uri:string,name:string){return this.enqueue(async()=>{
    const font=await this.files.prepare(uri,name),existing=this.value.fonts.find(item=>item.id===font.id);
    try{
      if(this.value.fonts.length>=16&&!existing)throw new Error('最多保留16个字体，请先删除');
      await this.files.load(font);
      const value:FontState={...this.value,fonts:existing?this.value.fonts:[...this.value.fonts,font],selected:font.id,lyricMode:'custom'};
      await this.repository.put('fonts.v1',value);this.publish(value);
    }catch{if(!existing)this.files.remove(font);throw new Error('字体无法载入或保存，原设置已保留');}
  });}
  select(id:string|null){return this.selectFor('lyrics',id);}
  selectGlobal(id:string|null){return this.selectFor('global',id);}
  followGlobal(){return this.enqueue(async()=>{const value:FontState={...this.value,selected:null,lyricMode:'inherit'};await this.repository.put('fonts.v1',value);this.publish(value);});}
  private selectFor(scope:'lyrics'|'global',id:string|null){return this.enqueue(async()=>{
    const font=this.value.fonts.find(item=>item.id===id);if(id&&!font)throw new Error('字体不存在');
    if(font){if(!this.files.exists(font))throw new Error('字体文件已丢失，请重新导入');await this.files.load(font);}
    const value:FontState=scope==='global'?{...this.value,global:id}:{...this.value,selected:id,lyricMode:id?'custom':'system'};
    await this.repository.put('fonts.v1',value);this.publish(value);
  });}
  remove(id:string){return this.enqueue(async()=>{
    const font=this.value.fonts.find(item=>item.id===id);if(!font)return;
    const value:FontState={...this.value,global:this.value.global===id?null:this.value.global,selected:this.value.selected===id?null:this.value.selected,
      lyricMode:this.value.selected===id&&this.value.lyricMode==='custom'?'inherit':this.value.lyricMode,fonts:this.value.fonts.filter(item=>item.id!==id)};
    await this.repository.put('fonts.v1',value);this.publish(value);this.files.remove(font);
  });}
}
