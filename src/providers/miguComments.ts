import {trackKey,type Track} from '../domain/track.ts';
import type {CommentPage,CommentThreadPage,SongComment} from './comments.ts';
import {bounded,throwIfAborted} from './async.ts';
import {queryURL,type HTTPClient} from './http.ts';
import {commentMediaURL} from './commentFields.ts';

const row=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const visible=(value:unknown,max:number)=>typeof value==='string'?value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'').slice(0,max).trim():'';
const count=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?value:typeof value==='string'&&/^\d{1,9}$/.test(value)&&Number.isSafeInteger(Number(value))?Number(value):undefined;
const opaque=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)?value:typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?String(value):undefined;
const songID=(track:Track)=>track.origin.kind==='online'&&track.origin.platform==='mg'&&/^[1-9]\d{0,29}$/.test(track.origin.id)?track.origin.id:undefined;

function time(value:unknown){
 if(typeof value!=='string')return;
 const match=/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);if(!match)return;
 const [year,month,day,hour,minute]=match.slice(1,6).map(Number),second=Number(match[6]??0);
 const calendar=Date.UTC(year!,month!-1,day!,hour!,minute!,second),check=new Date(calendar);
 if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month!-1||check.getUTCDate()!==day||check.getUTCHours()!==hour||check.getUTCMinutes()!==minute||check.getUTCSeconds()!==second)return;
 const milliseconds=calendar-8*60*60*1000;return milliseconds>=0&&milliseconds<=8640000000000000?milliseconds:undefined;
}

function comment(value:unknown):SongComment|undefined{
 const item=row(value),id=opaque(item.commentId),content=visible(item.commentInfo,10000);if(!id||!content)return;
 const user=row(item.user),replies=Array.isArray(item.replyComments)?item.replyComments.slice(0,50).map(row):[],latest=replies.find(reply=>visible(reply.replyInfo,10000))??replies[0];
 const replyContent=visible(latest?.replyInfo,10000),replyUser=visible(row(latest?.user).nickName,200);
 const timestamp=time(item.commentTime),likes=count(row(item.opNumItem).thumbNum),replyCount=count(item.replyTotalCount),avatar=commentMediaURL(user.middleIcon??user.bigIcon??user.smallIcon);
 return{id:`mg:${id}`,content,userName:visible(user.nickName,200)||'匿名用户',...(avatar?{avatar}:{}),...(timestamp!==undefined?{time:timestamp}:{}),...(likes!==undefined?{likes}:{}),...(replyCount!==undefined?{replyCount}:{}),...(replyContent?{reply:{userName:replyUser||'匿名用户',content:replyContent}}:{})};
}

function comments(values:unknown){
 if(!Array.isArray(values)||values.length>20)throw Error('评论响应无效');
 const seen=new Set<string>(),items:SongComment[]=[];
 for(const value of values){const item=comment(value);if(item&&!seen.has(item.id)){seen.add(item.id);items.push(item);}}
 if(values.length&&!items.length)throw Error('评论响应无效');return items;
}

function replies(values:unknown,rootID:string):SongComment[]{
 if(!Array.isArray(values)||values.length>20)throw Error('回复响应无效');
 const seen=new Set<string>(),items:SongComment[]=[];
 for(const raw of values){
  const item=row(raw),id=opaque(item.replyId),content=visible(item.replyInfo,10000);if(!id||!content||seen.has(id))continue;seen.add(id);
  const user=row(item.user),timestamp=time(item.replyTime),likes=count(row(item.opNumItem).thumbNum),target=visible(item.targetComment,10000),targetUser=visible(row(item.targetUser).nickName,200),avatar=commentMediaURL(user.middleIcon??user.bigIcon??user.smallIcon);
  items.push({id:`mg:${rootID}:reply:${id}`,content,userName:visible(user.nickName,200)||'匿名用户',...(avatar?{avatar}:{}),...(timestamp!==undefined?{time:timestamp}:{}),...(likes!==undefined?{likes}:{}),...(target?{reply:{userName:targetUser||'匿名用户',content:target}}:{})});
 }
 if(values.length&&!items.length)throw Error('回复响应无效');return items;
}

interface CursorState { total?:number;cursors:Map<number,string> }
export class MiguPublicComments {
 private http:HTTPClient;private states=new Map<string,CursorState>();private roots=new Map<string,string>();
 constructor(http:HTTPClient){this.http=http;}
 supports(track:Track){return !!songID(track);}
 async page(track:Track,offset:number,signal:AbortSignal):Promise<CommentPage>{
  const resourceId=songID(track);
  if(!resourceId||!Number.isSafeInteger(offset)||offset<0||offset>100000)throw Error('此歌曲暂不支持公开评论');
  const key=trackKey(track.origin),previous=this.states.get(key),cursor=offset===0?'':previous?.cursors.get(offset);
  if(offset>0&&!cursor)throw Error('评论分页状态已失效，请刷新后重试');
  return bounded(async child=>{
   const url=queryURL('https://app.c.nf.migu.cn/MIGUM3.0/user/comment/stack/v1.0',{
    pageSize:20,queryType:1,resourceId,resourceType:2,commentId:cursor??'',
   });
   const raw=row(await this.http(url,{credentials:'omit',headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'}},child));
   throwIfAborted(child);
   const data=row(raw.data),total=count(data.commentNums),values=data.comments;
   if(raw.code!=='000000'||total===undefined||!Array.isArray(values)||values.length>20||values.length>total||(offset===0&&!Array.isArray(data.hotComments)))throw Error('评论服务暂时不可用');
   if(offset>0&&values.length===0&&total===0&&(previous?.total??0)>0)throw Error('评论分页状态已失效，请刷新后重试');
   const items=comments(values),hot=offset===0?comments(data.hotComments):[];
   const nextOffset=offset+values.length,last=values.length?opaque(row(values.at(-1)).commentId):undefined;
   if(values.length&&!last)throw Error('评论响应无效');
   if(offset===0)this.states.delete(key);
   const state=this.states.get(key)??{cursors:new Map<number,string>()};state.total=total;
   if(last){state.cursors.set(nextOffset,last);while(state.cursors.size>200)state.cursors.delete(state.cursors.keys().next().value!);}
   for(const root of [...hot,...items]){if(this.roots.size>=2048)this.roots.delete(this.roots.keys().next().value!);this.roots.set(root.id,key);}
   this.states.set(key,state);
   if(this.states.size>100)this.states.delete(this.states.keys().next().value!);
   return{hot,items,total,nextOffset,hasMore:values.length>0&&nextOffset<total};
  },signal,12000);
 }
 async replies(track:Track,root:SongComment,offset:number,signal:AbortSignal):Promise<CommentThreadPage>{
  const resourceId=songID(track),rootID=root.id.startsWith('mg:')?opaque(root.id.slice(3)):undefined;
  if(!resourceId||!rootID||this.roots.get(root.id)!==trackKey(track.origin)||!Number.isSafeInteger(offset)||offset<0||offset>100000||offset%20!==0)throw Error('此评论暂不支持展开回复');
  return bounded(async child=>{
   const url=queryURL(`https://app.c.nf.migu.cn/MIGUM3.0/user/comment/stack/${encodeURIComponent(rootID)}/v1.0`,{pageSize:20,queryType:2,resourceId,resourceType:2,start:offset});
   const raw=row(await this.http(url,{credentials:'omit',headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'}},child));throwIfAborted(child);
   const data=row(raw.data),main=row(data.mainCommentItem),total=count(data.replyTotalCount),values=main.replyComments;
   if(raw.code!=='000000'||opaque(main.commentId)!==rootID||opaque(main.targetResourceId)!==resourceId||String(main.targetResourceType)!=='2'||total===undefined||count(main.replyTotalCount)!==total||!Array.isArray(values)||values.length>20||values.length>total)throw Error('回复服务暂时不可用');
   const nextOffset=offset+20;return{items:replies(values,rootID),total,nextOffset,hasMore:values.length>0&&nextOffset<total};
  },signal,12000);
 }

}
