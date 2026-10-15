import {InvalidRecordError} from './recovery.ts';
import {Directory,File,Paths} from 'expo-file-system';
import * as Font from 'expo-font';
import * as Crypto from 'expo-crypto';
import type {Repository} from './repository.ts';
export interface ImportedFont {id:string;name:string;file:string}
interface FontState {version:1;fonts:readonly ImportedFont[];selected:string|null}
export class FontStore {
  private value:FontState={version:1,fonts:[],selected:null};
  private listeners=new Set<()=>void>();private tail:Promise<unknown>=Promise.resolve();
  private directory=new Directory(Paths.document,'lyric-fonts');
  constructor(private repository:Repository){}
  getSnapshot=()=>this.value;
  selectedURI=()=>this.value.selected?new File(this.directory,`${this.value.selected}.font`).uri:undefined;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(value:FontState){this.value=value;for(const listener of this.listeners)listener();}
  async restore(){
    const saved=await this.repository.get<FontState>('fonts.v1');if(!saved)return;
    if(saved.version!==1||!Array.isArray(saved.fonts)||saved.fonts.length>16)throw new InvalidRecordError();
    const fonts=saved.fonts.filter(item=>item&&typeof item.id==='string'&&/^nexusfont_[a-f0-9]{64}$/.test(item.id)&&typeof item.name==='string'&&item.file===`${item.id}.font`&&new File(this.directory,item.file).exists);
    let selected=fonts.find(item=>item.id===saved.selected)?.id??null;
    if(selected){try{await Font.loadAsync({[selected]:new File(this.directory,`${selected}.font`).uri});}catch{selected=null;}}
    this.publish({version:1,fonts,selected});
  }
  private enqueue(run:()=>Promise<void>){const next=this.tail.then(run);this.tail=next.catch(()=>{});return next;}
  import(uri:string,name:string){return this.enqueue(async()=>{
    const source=new File(uri);if(!/\.(ttf|otf)$/i.test(name)||source.size<12||source.size>20*1024*1024)throw new Error('请选择20MB以内的TTF或OTF字体');
    const bytes=await source.bytes();const signature=Array.from(bytes.slice(0,4)).map(byte=>byte.toString(16).padStart(2,'0')).join('');
    if(!['00010000','4f54544f','74727565'].includes(signature))throw new Error('字体格式无效');
    const digest=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,await source.base64());
    const id=`nexusfont_${digest}`,existing=this.value.fonts.find(item=>item.id===id);
    if(this.value.fonts.length>=16&&!existing)throw new Error('最多保留16个字体，请先删除');
    this.directory.create({idempotent:true,intermediates:true});const file=new File(this.directory,`${id}.font`);
    if(!file.exists)source.copy(file);
    try{
      await Font.loadAsync({[id]:file.uri});const value:FontState={version:1,fonts:existing?this.value.fonts:[...this.value.fonts,{id,name,file:`${id}.font`}],selected:id};
      await this.repository.put('fonts.v1',value);this.publish(value);
    }catch{if(!existing&&file.exists)file.delete();throw new Error('字体无法载入，原设置已保留');}
  });}
  select(id:string|null){return this.enqueue(async()=>{
    const font=this.value.fonts.find(item=>item.id===id);if(id&&!font)throw new Error('字体不存在');
    if(font)await Font.loadAsync({[font.id]:new File(this.directory,font.file).uri});
    const value={...this.value,selected:id};await this.repository.put('fonts.v1',value);this.publish(value);
  });}
  remove(id:string){return this.enqueue(async()=>{
    const font=this.value.fonts.find(item=>item.id===id);if(!font)return;
    const value={...this.value,selected:this.value.selected===id?null:this.value.selected,fonts:this.value.fonts.filter(item=>item.id!==id)};
    await this.repository.put('fonts.v1',value);this.publish(value);
    const file=new File(this.directory,font.file);if(file.exists)file.delete();
  });}
}
