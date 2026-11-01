import {trackKey,type Track} from '../domain/track.ts';
import type {CommentPage,CommentThreadPage,SongComment} from './comments.ts';
import {bounded,throwIfAborted} from './async.ts';
import {queryURL,type HTTPClient} from './http.ts';
import {commentMediaURL,commentRegion} from './commentFields.ts';

const row=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const text=(v:unknown,max:number)=>typeof v==='string'?v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'').slice(0,max):'';
const integer=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:undefined;
const id=(v:unknown)=>typeof v==='string'&&/^\d{1,40}$/.test(v)?v:typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?String(v):undefined;
function mapped(value:unknown):SongComment|undefined {
 const v=row(value),key=id(v.commentId),content=text(v.content,10000).trim();if(!key||!content)return;
 const user=row(v.user),reply=row(Array.isArray(v.beReplied)?v.beReplied[0]:undefined),replyContent=text(reply.content,10000).trim(),timestamp=integer(v.time),avatar=commentMediaURL(user.avatarUrl),region=commentRegion(row(v.ipLocation).location),replyCount=integer(row(v.showFloorComment).replyCount);
 return{id:key,content,userName:text(user.nickname,200)||'匿名用户',...(avatar?{avatar}:{}),...(region?{region}:{}),...(timestamp!==undefined&&timestamp<=8640000000000000?{time:timestamp}:{}),...(integer(v.likedCount)!==undefined?{likes:integer(v.likedCount)}:{}),...(replyCount!==undefined?{replyCount}:{}),...(replyContent?{reply:{userName:text(row(reply.user).nickname,200)||'匿名用户',content:replyContent}}:{})};
}
function unique(values:readonly SongComment[]){const seen=new Set<string>();return values.filter(v=>{if(seen.has(v.id))return false;seen.add(v.id);return true;});}
interface ThreadState {total:number;cursors:Map<number,string>}
export class NeteasePublicComments {
 private http:HTTPClient;private roots=new Map<string,string>();private threads=new Map<string,ThreadState>();
 constructor(http:HTTPClient){this.http=http;}
 supports(track:Track){return track.origin.kind==='online'&&track.origin.platform==='wy'&&/^\d{1,30}$/.test(track.origin.id);}
 canExpand(track:Track,root:SongComment){return this.supports(track)&&this.roots.get(root.id)===trackKey(track.origin)&&(root.replyCount===undefined||root.replyCount>0);}
 async page(track:Track,offset:number,signal:AbortSignal):Promise<CommentPage>{
  if(!this.supports(track)||!Number.isSafeInteger(offset)||offset<0||offset>100000)throw Error('此歌曲暂不支持公开评论');
  const raw=row(await bounded(child=>this.http(queryURL(`https://music.163.com/api/v1/resource/comments/R_SO_4_${track.origin.id}`,{limit:20,offset}),{credentials:'omit',headers:{Referer:'https://music.163.com/'}},child),signal,12000));throwIfAborted(signal);
  if(raw.code!==200||!Array.isArray(raw.comments)||raw.comments.length>50||(raw.more!==undefined&&typeof raw.more!=='boolean')||(raw.hotComments!==undefined&&!Array.isArray(raw.hotComments)))throw Error('评论服务暂时不可用');
  const items=unique(raw.comments.map(mapped).filter((v):v is SongComment=>!!v)),hot=offset===0&&Array.isArray(raw.hotComments)?unique(raw.hotComments.slice(0,50).map(mapped).filter((v):v is SongComment=>!!v)):[],total=integer(raw.total);
  for(const root of [...hot,...items]){if(this.roots.size>=2048)this.roots.delete(this.roots.keys().next().value!);this.roots.set(root.id,trackKey(track.origin));}
  const nextOffset=offset+raw.comments.length;
  return{hot,items,...(total!==undefined?{total}:{}),nextOffset,hasMore:raw.more===true&&raw.comments.length>0&&(total===undefined||nextOffset<total)};
 }
 async replies(track:Track,root:SongComment,offset:number,signal:AbortSignal):Promise<CommentThreadPage>{
  const key=`${trackKey(track.origin)}:${root.id}`,previous=this.threads.get(key),cursor=offset===0?'-1':previous?.cursors.get(offset);
  if(!this.canExpand(track,root)||!id(root.id)||!Number.isSafeInteger(offset)||offset<0||offset>100000||cursor===undefined)throw Error('此评论暂不支持展开回复');
  return bounded(async child=>{
   const raw=row(await this.http(queryURL('https://music.163.com/api/resource/comment/floor/get',{parentCommentId:root.id,threadId:`R_SO_4_${track.origin.id}`,time:cursor,limit:20}),{credentials:'omit',headers:{Referer:'https://music.163.com/'}},child));throwIfAborted(child);
   const data=row(raw.data),values=data.comments,best=data.bestComments??[],reportedTotal=integer(data.totalCount),time=integer(data.time);
   if(raw.code!==200||id(row(data.ownerComment).commentId)!==root.id||reportedTotal===undefined||typeof data.hasMore!=='boolean'||!Array.isArray(values)||values.length>20||!Array.isArray(best)||best.length>20||time===undefined||time>8640000000000000)throw Error('回复服务暂时不可用');
   // Subsequent floor pages can report zero while still containing valid replies.
   const total=offset>0&&reportedTotal===0?previous!.total:reportedTotal;
   if(offset===0&&values.length>total)throw Error('回复响应无效');
   for(const value of [...best,...values])if(id(row(value).parentCommentId)!==root.id||id(row(value).commentId)===root.id)throw Error('回复归属无效');
   const items=unique([...best,...values].map(mapped).filter((v):v is SongComment=>!!v));
   if((best.length+values.length>0&&!items.length)||(data.hasMore&&(!values.length||time<=Number(cursor))))throw Error('回复分页状态已失效，请重试');
   const nextOffset=offset+values.length,state:ThreadState=offset===0?{total,cursors:new Map()}:previous!;
   state.total=total;
   if(data.hasMore)state.cursors.set(nextOffset,String(time));
   while(state.cursors.size>100)state.cursors.delete(state.cursors.keys().next().value!);
   this.threads.set(key,state);while(this.threads.size>100)this.threads.delete(this.threads.keys().next().value!);
   return{items,total,nextOffset,hasMore:data.hasMore};
  },signal,12000);
 }
}
