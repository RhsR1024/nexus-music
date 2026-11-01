import type {Track} from '../domain/track.ts';
import type {CommentPage,SongComment} from './comments.ts';
import {bounded,throwIfAborted} from './async.ts';
import {queryURL,type HTTPClient} from './http.ts';
import {commentMediaURL} from './commentFields.ts';

const row=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const visible=(v:unknown,max:number)=>typeof v==='string'?v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'').slice(0,max).trim():'';
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:typeof v==='string'&&/^\d{1,15}$/.test(v)&&Number.isSafeInteger(Number(v))?Number(v):undefined;
const id=(v:unknown)=>typeof v==='string'&&/^[1-9]\d{0,39}$/.test(v)?v:typeof v==='number'&&Number.isSafeInteger(v)&&v>0?String(v):undefined;
function comment(value:unknown):SongComment|undefined{
 const v=row(value),key=id(v.id),content=visible(v.msg,10000);if(!key||!content)return;
 const replies=Array.isArray(v.child_comments)?v.child_comments.slice(0,50).map(row):[],reply=replies.find(v=>visible(v.msg,10000)),seconds=count(v.time),likes=count(v.like_num);
 const avatar=commentMediaURL(v.u_pic);
 return{id:`kw:${key}`,content,userName:visible(v.u_name,200)||'匿名用户',...(avatar?{avatar}:{}),...(seconds!==undefined&&seconds<=8640000000000?{time:seconds*1000}:{}),...(likes!==undefined?{likes}:{}),...(reply?{reply:{userName:visible(reply.u_name,200)||'匿名用户',content:visible(reply.msg,10000)}}:{})};
}
function comments(value:unknown):SongComment[]{
 if(!Array.isArray(value)||value.length>20)throw Error('评论响应无效');
 const seen=new Set<string>(),items:SongComment[]=[];
 for(const raw of value){const item=comment(raw);if(item&&!seen.has(item.id)){seen.add(item.id);items.push(item);}}
 if(value.length&&!items.length)throw Error('评论响应无效');return items;
}
export class KuwoPublicComments {
 private http:HTTPClient;
 constructor(http:HTTPClient){this.http=http;}
 supports(track:Track){return track.origin.kind==='online'&&track.origin.platform==='kw'&&/^[1-9]\d{0,23}$/.test(track.origin.id);}
 private async read(track:Track,offset:number,hot:boolean,signal:AbortSignal){
  const raw=row(await this.http(queryURL('https://ncomment.kuwo.cn/com.s',{f:'web',type:hot?'get_rec_comment':'get_comment',aapiver:1,prod:'kwplayer_ar_10.5.2.0',digest:15,sid:track.origin.id,start:offset,msgflag:1,count:20,newver:3,uid:0}),{credentials:'omit',headers:{'User-Agent':'Dalvik/2.1.0 (Linux; U; Android 9;)'}},signal));throwIfAborted(signal);
  const total=count(hot?raw.hot_comments_counts:raw.comments_counts),values=hot?raw.hot_comments:raw.comments;
  if(raw.code!=='200'||raw.result!=='ok'||total===undefined||!Array.isArray(values)||values.length>20||values.length>total)throw Error('评论服务暂时不可用');
  const items=comments(values),nextOffset=values.length?count(raw.offset):offset;
  if(nextOffset===undefined||nextOffset<offset+values.length||nextOffset>100000||(values.length>0&&nextOffset<=offset))throw Error('评论分页响应无效');
  return{items,total,nextOffset,hasMore:values.length>0&&nextOffset<total};
 }
 async page(track:Track,offset:number,signal:AbortSignal):Promise<CommentPage>{
  if(!this.supports(track)||!Number.isSafeInteger(offset)||offset<0||offset>100000)throw Error('此歌曲暂不支持公开评论');
  return bounded(async child=>{
   const [latest,hot]=await Promise.all([this.read(track,offset,false,child),offset===0?this.read(track,0,true,child):Promise.resolve(undefined)]);throwIfAborted(child);
   return{hot:hot?.items??[],items:latest.items,total:latest.total,nextOffset:latest.nextOffset,hasMore:latest.hasMore};
  },signal,12000);
 }
}
