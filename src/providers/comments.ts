import {trackKey,type Track} from '../domain/track.ts';
import {bounded,throwIfAborted} from './async.ts';
import {queryURL,requestJSON,type HTTPClient} from './http.ts';
export interface SongComment {id:string;content:string;userName:string;time?:number;likes?:number;reply?:{userName:string;content:string}}
export interface CommentPage {hot:readonly SongComment[];items:readonly SongComment[];total?:number;nextOffset:number;hasMore:boolean}
export interface CommentReader {supports(track:Track):boolean;page(track:Track,offset:number,signal:AbortSignal):Promise<CommentPage>}
const row=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const text=(v:unknown,max:number)=>typeof v==='string'?v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'').slice(0,max):'';
const integer=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:undefined;
const id=(v:unknown)=>typeof v==='string'&&/^\d{1,40}$/.test(v)?v:typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?String(v):undefined;
function mapped(value:unknown):SongComment|undefined {
 const v=row(value),key=id(v.commentId),content=text(v.content,10000).trim();if(!key||!content)return;
 const user=row(v.user),reply=row(Array.isArray(v.beReplied)?v.beReplied[0]:undefined),replyContent=text(reply.content,10000).trim(),timestamp=integer(v.time);
 return{id:key,content,userName:text(user.nickname,200)||'匿名用户',...(timestamp!==undefined&&timestamp<=8640000000000000?{time:timestamp}:{}),...(integer(v.likedCount)!==undefined?{likes:integer(v.likedCount)}:{}),...(replyContent?{reply:{userName:text(row(reply.user).nickname,200)||'匿名用户',content:replyContent}}:{})};
}
function unique(values:readonly SongComment[]){const seen=new Set<string>();return values.filter(v=>{if(seen.has(v.id))return false;seen.add(v.id);return true;});}
export class PublicComments implements CommentReader {
 private http:HTTPClient;
 constructor(http:HTTPClient=requestJSON){this.http=http;}
 supports(track:Track){return track.origin.kind==='online'&&track.origin.platform==='wy'&&/^\d{1,30}$/.test(track.origin.id);}
 async page(track:Track,offset:number,signal:AbortSignal):Promise<CommentPage>{
  if(!this.supports(track)||!Number.isSafeInteger(offset)||offset<0||offset>100000)throw Error('此歌曲暂不支持公开评论');
  const raw=row(await bounded(child=>this.http(queryURL(`https://music.163.com/api/v1/resource/comments/R_SO_4_${track.origin.id}`,{limit:20,offset}),{headers:{Referer:'https://music.163.com/'}},child),signal,12000));throwIfAborted(signal);
  if(raw.code!==200||!Array.isArray(raw.comments)||raw.comments.length>50||(raw.more!==undefined&&typeof raw.more!=='boolean')||(raw.hotComments!==undefined&&!Array.isArray(raw.hotComments)))throw Error('评论服务暂时不可用');
  const items=unique(raw.comments.map(mapped).filter((v):v is SongComment=>!!v)),hot=offset===0&&Array.isArray(raw.hotComments)?unique(raw.hotComments.slice(0,50).map(mapped).filter((v):v is SongComment=>!!v)):[],total=integer(raw.total);
  const nextOffset=offset+raw.comments.length;
  return{hot,items,...(total!==undefined?{total}:{}),nextOffset,hasMore:raw.more===true&&raw.comments.length>0&&(total===undefined||nextOffset<total)};
 }
}
export interface CommentSnapshot {key:string;track?:Track;hot:readonly SongComment[];items:readonly SongComment[];total?:number;offset:number;hasMore:boolean;loading:boolean;error?:string;limited:boolean;supported:boolean}
const empty=():CommentSnapshot=>({key:'',hot:[],items:[],offset:0,hasMore:false,loading:false,limited:false,supported:false});
export class CommentSession {
 private value=empty();private generation=0;private pending?:AbortController;private failedRefresh=false;private listeners=new Set<()=>void>();
 private reader:CommentReader;
 constructor(reader:CommentReader){this.reader=reader;}
 getSnapshot=()=>this.value;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private publish(value:CommentSnapshot){this.value=value;for(const listener of this.listeners)listener();}
 select(track:Track){this.cancel();this.publish({...empty(),key:trackKey(track.origin),track,supported:this.reader.supports(track)});if(this.value.supported)void this.load(true);}
 cancel(){this.generation++;this.pending?.abort();this.pending=undefined;if(this.value.loading)this.publish({...this.value,loading:false});}
 close(){this.cancel();this.publish(empty());}
 retry(){return this.load(this.failedRefresh);}
 async load(refresh=false){
  const old=this.value;if(old.loading||!old.supported||!old.track||(!refresh&&(!old.hasMore||old.limited)))return;
  this.failedRefresh=refresh;
  const generation=++this.generation,abort=new AbortController();this.pending=abort;this.publish({...old,loading:true,error:undefined});
  try{const page=await bounded(child=>this.reader.page(old.track!,refresh?0:old.offset,child),abort.signal,12000);throwIfAborted(abort.signal);if(generation!==this.generation)return;
   const prior=refresh?[]:old.items,seen=new Set(prior.map(v=>v.id)),added=page.items.filter(v=>!seen.has(v.id)),items=[...prior,...added].slice(0,1000);
   const stopped=page.hasMore&&(items.length>=1000||!added.length||page.nextOffset<=(refresh?0:old.offset));
   this.publish({...old,hot:refresh?page.hot:old.hot,items,total:page.total,offset:page.nextOffset,hasMore:page.hasMore&&!stopped,loading:false,error:undefined,limited:stopped});
  }catch{if(generation===this.generation&&!abort.signal.aborted)this.publish({...old,loading:false,error:'评论暂时无法载入，请重试。已显示的内容已保留。'});}
  finally{if(this.pending===abort)this.pending=undefined;}
 }
 dispose(){this.close();this.listeners.clear();}
}
