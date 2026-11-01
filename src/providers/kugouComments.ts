import type {Track} from '../domain/track.ts';
import type {CommentPage,SongComment} from './comments.ts';
import {bounded,throwIfAborted} from './async.ts';
import {queryURL,type HTTPClient} from './http.ts';

export interface KugouCommentCrypto {md5:(value:string)=>Promise<string>;nonce:()=>string;now?:()=>number}
const row=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const visible=(v:unknown,max:number)=>typeof v==='string'?v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').slice(0,max).trim():'';
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:typeof v==='string'&&/^\d{1,15}$/.test(v)&&Number.isSafeInteger(Number(v))?Number(v):undefined;
const numeric=(v:unknown)=>typeof v==='string'&&/^[1-9]\d{0,39}$/.test(v)?v:typeof v==='number'&&Number.isSafeInteger(v)&&v>0?String(v):undefined;
const hex=(v:unknown):v is string=>typeof v==='string'&&/^[a-f\d]{32}$/i.test(v);
function identity(track:Track){
 if(track.origin.kind!=='online'||track.origin.platform!=='kg')return;
 const m=/^(?:([1-9]\d{0,23})_)?([a-f\d]{32})$/i.exec(track.origin.id);if(!m)return;
 const hash=m[2]!.toUpperCase();if(track.metadata.hash!==undefined&&(!hex(track.metadata.hash)||track.metadata.hash.toUpperCase()!==hash))return;
 return{hash,audioID:m[1]};
}
function comment(value:unknown):SongComment|undefined{
 const v=row(value),id=numeric(v.id);let content=visible(v.content,10000);if(!id||!content)return;
 if(Array.isArray(v.atlist))for(const raw of v.atlist.slice(0,50)){const at=row(raw),key=numeric(at.id),name=visible(at.name,200);if(key&&name)content=content.replaceAll(`[at=${key}]`,`@${name} `);}
 const parent=visible(v.pcontent,10000),seconds=count(v.addtimestamp),likes=count(row(v.like).likenum);
 return{id:`kg:${id}`,content:visible(content,10000),userName:visible(v.user_name,200)||'匿名用户',...(seconds!==undefined&&seconds<=8640000000000?{time:seconds*1000}:{}),...(likes!==undefined?{likes}:{}),...(parent?{reply:{userName:visible(v.puser,200)||'匿名用户',content:parent}}:{})};
}
function comments(values:unknown){
 if(!Array.isArray(values)||values.length>20)throw Error('评论响应无效');
 const seen=new Set<string>(),items:SongComment[]=[];
 for(const value of values){const item=comment(value);if(item&&!seen.has(item.id)){seen.add(item.id);items.push(item);}}
 if(values.length&&!items.length)throw Error('评论响应无效');return items;
}
export class KugouPublicComments {
 private http:HTTPClient;private crypto:KugouCommentCrypto;
 constructor(http:HTTPClient,crypto:KugouCommentCrypto){this.http=http;this.crypto=crypto;}
 supports(track:Track){return !!identity(track);}
 private async read(track:Track,offset:number,hot:boolean,signal:AbortSignal){
  const {hash,audioID}=identity(track)!,page=offset/20+1,mid=this.crypto.nonce().replaceAll('-',''),now=(this.crypto.now??Date.now)();
  if(!hex(mid)||!Number.isSafeInteger(now)||now<0)throw Error('评论请求暂不可用');
  const params={dfid:'0',mid,clienttime:String(now),uuid:'0',extdata:hash,appid:'1005',code:'fc4be23b4e972707f36b8a828a93ba8a',schash:hash,clientver:'11409',p:String(page),clienttoken:'',pagesize:'20',ver:'10',kugouid:'0'},salt='OIlwieks28dk2k092lksi2UIkp';
  const signature=await this.crypto.md5(salt+Object.entries(params).map(([k,v])=>`${k}=${v}`).sort().join('')+salt);throwIfAborted(signal);if(!hex(signature))throw Error('评论请求暂不可用');
  const raw=row(await this.http(queryURL(`https://gateway.kugou.com/r/v1/rank/${hot?'topliked':'newest'}`,{...params,signature}),{credentials:'omit',headers:{'x-router':'m.comment.service.kugou.com','User-Agent':'Mozilla/5.0'}},signal));throwIfAborted(signal);
  const total=count(raw.count),values=raw.list;
  if(raw.err_code!==0||raw.current_page!==page||total===undefined||!Array.isArray(values)||values.length>20||values.length>total||(audioID&&numeric(raw.childrenid)!==audioID))throw Error('评论服务暂时不可用');
  return{items:comments(values),total,nextOffset:offset+20,hasMore:values.length>0&&offset+20<total};
 }
 async page(track:Track,offset:number,signal:AbortSignal):Promise<CommentPage>{
  if(!this.supports(track)||!Number.isSafeInteger(offset)||offset<0||offset>100000||offset%20!==0)throw Error('此歌曲暂不支持公开评论');
  return bounded(async child=>{const [latest,hot]=await Promise.all([this.read(track,offset,false,child),offset===0?this.read(track,0,true,child):Promise.resolve(undefined)]);throwIfAborted(child);return{hot:hot?.items??[],items:latest.items,total:latest.total,nextOffset:latest.nextOffset,hasMore:latest.hasMore};},signal,12000);
 }
}
