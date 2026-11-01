import {QQPublicComments} from './qqComments.ts';
import {MiguPublicComments} from './miguComments.ts';
import {KuwoPublicComments} from './kuwoComments.ts';
import {KugouPublicComments,type KugouCommentCrypto} from './kugouComments.ts';
import {trackKey,type Track} from '../domain/track.ts';
import {bounded,throwIfAborted} from './async.ts';
import {queryURL,requestJSON,type HTTPClient} from './http.ts';
export interface SongComment {id:string;content:string;userName:string;time?:number;likes?:number;replyCount?:number;reply?:{userName:string;content:string}}
export interface CommentPage {hot:readonly SongComment[];items:readonly SongComment[];total?:number;nextOffset:number;hasMore:boolean}
export interface CommentThreadPage {items:readonly SongComment[];total?:number;nextOffset:number;hasMore:boolean}
export interface CommentReader {session?():CommentReader;supports(track:Track):boolean;page(track:Track,offset:number,signal:AbortSignal):Promise<CommentPage>;replies?(track:Track,root:SongComment,offset:number,signal:AbortSignal):Promise<CommentThreadPage>}
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
 private http:HTTPClient;private qq:QQPublicComments;private migu:MiguPublicComments;private kuwo:KuwoPublicComments;private kugou?:KugouPublicComments;private crypto?:KugouCommentCrypto;
 constructor(http:HTTPClient=requestJSON,crypto?:KugouCommentCrypto){this.http=http;this.crypto=crypto;this.qq=new QQPublicComments(http);this.migu=new MiguPublicComments(http);this.kuwo=new KuwoPublicComments(http);if(crypto)this.kugou=new KugouPublicComments(http,crypto);}
 session():CommentReader{return new PublicComments(this.http,this.crypto);}
 supports(track:Track){return !!this.kugou?.supports(track)||this.qq.supports(track)||this.migu.supports(track)||this.kuwo.supports(track)||(track.origin.kind==='online'&&track.origin.platform==='wy'&&/^\d{1,30}$/.test(track.origin.id));}
 replies(track:Track,root:SongComment,offset:number,signal:AbortSignal){if(this.kugou?.supports(track))return this.kugou.replies(track,root,offset,signal);throw Error('此评论暂不支持展开回复');}
 async page(track:Track,offset:number,signal:AbortSignal):Promise<CommentPage>{
  if(this.qq.supports(track))return this.qq.page(track,offset,signal);
  if(this.migu.supports(track))return this.migu.page(track,offset,signal);
  if(this.kuwo.supports(track))return this.kuwo.page(track,offset,signal);
  if(this.kugou?.supports(track))return this.kugou.page(track,offset,signal);
  if(!this.supports(track)||!Number.isSafeInteger(offset)||offset<0||offset>100000)throw Error('此歌曲暂不支持公开评论');
  const raw=row(await bounded(child=>this.http(queryURL(`https://music.163.com/api/v1/resource/comments/R_SO_4_${track.origin.id}`,{limit:20,offset}),{headers:{Referer:'https://music.163.com/'}},child),signal,12000));throwIfAborted(signal);
  if(raw.code!==200||!Array.isArray(raw.comments)||raw.comments.length>50||(raw.more!==undefined&&typeof raw.more!=='boolean')||(raw.hotComments!==undefined&&!Array.isArray(raw.hotComments)))throw Error('评论服务暂时不可用');
  const items=unique(raw.comments.map(mapped).filter((v):v is SongComment=>!!v)),hot=offset===0&&Array.isArray(raw.hotComments)?unique(raw.hotComments.slice(0,50).map(mapped).filter((v):v is SongComment=>!!v)):[],total=integer(raw.total);
  const nextOffset=offset+raw.comments.length;
  return{hot,items,...(total!==undefined?{total}:{}),nextOffset,hasMore:raw.more===true&&raw.comments.length>0&&(total===undefined||nextOffset<total)};
 }
}
export interface CommentThreadSnapshot {items:readonly SongComment[];offset:number;hasMore:boolean;loading:boolean;expanded:boolean;error?:string;limited:boolean}
export interface CommentSnapshot {key:string;track?:Track;hot:readonly SongComment[];items:readonly SongComment[];total?:number;offset:number;hasMore:boolean;loading:boolean;error?:string;limited:boolean;supported:boolean;threads:Readonly<Record<string,CommentThreadSnapshot>>}
const emptyThread=(expanded=false):CommentThreadSnapshot=>({items:[],offset:0,hasMore:false,loading:false,expanded,limited:false});
const empty=():CommentSnapshot=>({key:'',hot:[],items:[],offset:0,hasMore:false,loading:false,limited:false,supported:false,threads:{}});
export class CommentSession {
 private value=empty();private generation=0;private pending?:AbortController;private pendingThreads=new Map<string,AbortController>();private failedRefresh=false;private listeners=new Set<()=>void>();
 private reader:CommentReader;
 constructor(reader:CommentReader){this.reader=reader.session?.()??reader;}
 getSnapshot=()=>this.value;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private publish(value:CommentSnapshot){this.value=value;for(const listener of this.listeners)listener();}
 select(track:Track){this.cancel();this.publish({...empty(),key:trackKey(track.origin),track,supported:this.reader.supports(track)});if(this.value.supported)void this.load(true);}
 cancel(){this.generation++;this.pending?.abort();this.pending=undefined;for(const abort of this.pendingThreads.values())abort.abort();this.pendingThreads.clear();if(this.value.loading||Object.values(this.value.threads).some(thread=>thread.loading)){this.publish({...this.value,loading:false,threads:Object.fromEntries(Object.entries(this.value.threads).map(([key,thread])=>[key,{...thread,loading:false}]))});}}
 close(){this.cancel();this.publish(empty());}
 retry(){return this.load(this.failedRefresh);}
 canExpand(comment:SongComment){return !!this.reader.replies&&(comment.replyCount??0)>0;}
 toggleReplies(comment:SongComment){
  const old=this.value;if(!old.track||!this.canExpand(comment))return;
  const thread=old.threads[comment.id]??emptyThread();
  if(thread.expanded){this.pendingThreads.get(comment.id)?.abort();this.pendingThreads.delete(comment.id);this.publish({...old,threads:{...old.threads,[comment.id]:{...thread,loading:false,expanded:false}}});return;}
  this.publish({...old,threads:{...old.threads,[comment.id]:{...thread,expanded:true,error:undefined}}});
  if(!thread.items.length&&!thread.loading)void this.loadReplies(comment,true);
 }
 async loadReplies(root:SongComment,refresh=false){
  const old=this.value,reader=this.reader.replies,track=old.track;if(!reader||!track||!this.canExpand(root)||(old.loading&&this.failedRefresh))return;
  const current=old.threads[root.id]??emptyThread(true);if(current.loading||(!refresh&&(!current.hasMore||current.limited)))return;
  const generation=this.generation,abort=new AbortController();this.pendingThreads.get(root.id)?.abort();this.pendingThreads.set(root.id,abort);
  const set=(thread:CommentThreadSnapshot)=>this.publish({...this.value,threads:{...this.value.threads,[root.id]:thread}});
  set({...current,expanded:true,loading:true,error:undefined});
  try{
   const page=await bounded(child=>reader.call(this.reader,track,root,refresh?0:current.offset,child),abort.signal,12000);throwIfAborted(abort.signal);if(generation!==this.generation)return;
   const latest=this.value.threads[root.id]??current,prior=refresh?[]:latest.items,seen=new Set(prior.map(item=>item.id)),added=page.items.filter(item=>{if(seen.has(item.id))return false;seen.add(item.id);return true;}),items=[...prior,...added].slice(0,500);
   const stopped=page.hasMore&&(items.length>=500||!added.length||page.nextOffset<=(refresh?0:current.offset));
   set({...latest,items,offset:page.nextOffset,hasMore:page.hasMore&&!stopped,loading:false,expanded:true,error:undefined,limited:stopped});
  }catch{if(generation===this.generation&&!abort.signal.aborted)set({...(this.value.threads[root.id]??current),loading:false,expanded:true,error:'回复暂时无法载入，请重试。已显示的回复已保留。'});}
  finally{if(this.pendingThreads.get(root.id)===abort)this.pendingThreads.delete(root.id);}
 }
 async load(refresh=false){
  const old=this.value;if(old.loading||!old.supported||!old.track||(!refresh&&(!old.hasMore||old.limited)))return;
  this.failedRefresh=refresh;
  if(refresh){this.generation++;for(const pending of this.pendingThreads.values())pending.abort();this.pendingThreads.clear();}
  const generation=this.generation,abort=new AbortController();this.pending=abort;this.publish({...old,loading:true,error:undefined,...(refresh?{threads:Object.fromEntries(Object.entries(old.threads).map(([key,thread])=>[key,{...thread,loading:false}]))}:{})});
  try{const page=await bounded(child=>this.reader.page(old.track!,refresh?0:old.offset,child),abort.signal,12000);throwIfAborted(abort.signal);if(generation!==this.generation)return;
   const prior=refresh?[]:old.items,seen=new Set(prior.map(v=>v.id)),added=page.items.filter(v=>!seen.has(v.id)),items=[...prior,...added].slice(0,1000);
   const stopped=page.hasMore&&(items.length>=1000||!added.length||page.nextOffset<=(refresh?0:old.offset));
   this.publish({...old,hot:refresh?page.hot:old.hot,items,total:page.total,offset:page.nextOffset,hasMore:page.hasMore&&!stopped,loading:false,error:undefined,limited:stopped,threads:refresh?{}:this.value.threads});
  }catch{if(generation===this.generation&&!abort.signal.aborted)this.publish({...old,threads:this.value.threads,loading:false,error:'评论暂时无法载入，请重试。已显示的内容已保留。'});}
  finally{if(this.pending===abort)this.pending=undefined;}
 }
 dispose(){this.close();this.listeners.clear();}
}
