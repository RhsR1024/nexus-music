import type {Track} from '../domain/track.ts';
import type {CommentPage,CommentThreadPage,SongComment} from './comments.ts';
import {bounded,throwIfAborted} from './async.ts';
import type {HTTPClient} from './http.ts';
import {commentMediaURL,commentRegion} from './commentFields.ts';

const PAGE_SIZE=20,MAX_ROOTS=2048,MAX_CURSORS=4096;
const row=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const visible=(v:unknown,max:number)=>typeof v==='string'?v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'').replace(/\\n/g,'\n').replace(/\[em\]e\d{1,8}\[\/em\]/g,'[表情]').slice(0,max).trim():'';
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:typeof v==='string'&&/^\d{1,15}$/.test(v)&&Number.isSafeInteger(Number(v))?Number(v):undefined;
const numeric=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0?String(v):typeof v==='string'&&/^[1-9]\d{0,23}$/.test(v)?v:undefined;
const opaque=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9!.*_\-]{1,256}$/.test(v)?v:undefined;
const sequence=(v:unknown)=>typeof v==='string'&&/^\d{1,24}$/.test(v)?v:undefined;
const rank=(v:unknown)=>typeof v==='string'&&/^(?:0|[1-9]\d{0,15})(?:\.\d{1,8})?$/.test(v)?v:undefined;
const flag=(v:unknown)=>v===true||v===1?'1':v===false||v===0?'0':undefined;
function putBounded<K,V>(map:Map<K,V>,key:K,value:V,max:number){
 if(map.has(key))map.delete(key);
 if(map.size>=max){const victim=map.keys().next().value as K|undefined;if(victim!==undefined)map.delete(victim);}
 map.set(key,value);
}
function quote(value:Record<string,unknown>):SongComment['reply']|undefined{
 const values=Array.isArray(value.RepliedComments)?value.RepliedComments:[],source=values.length?row(values[values.length-1]):row(value.ParentComment);
 const content=visible(source.Content??source.content,10000),userName=visible(source.Nick??source.nick,200);
 return content&&userName?{userName,content}:undefined;
}
function comment(value:unknown,rootID:string):SongComment|undefined{
 const v=row(value),key=opaque(v.CmId??v.commentid),content=visible(v.Content??v.rootcommentcontent,10000);
 if(!key||!content)return;
 const author=visible(v.Nick??v.nick??v.rootcommentnick,200)||'匿名用户',avatar=commentMediaURL(v.Avatar??v.avatarurl),region=commentRegion(v.Location??v.location);
 const seconds=count(v.PubTime??v.time),likes=count(v.PraiseNum??v.praisenum),replyCount=count(v.ReplyCnt),quoted=quote(v);
 return{id:`tx:${rootID}:${key}`,content,userName:author.replace(/^@/,'')||'匿名用户',...(avatar?{avatar}:{}),...(region?{region}:{}),...(seconds!==undefined&&seconds<=8640000000?{time:seconds*1000}:{}),...(likes!==undefined?{likes}:{}),...(replyCount!==undefined?{replyCount}:{}),...(quoted?{reply:quoted}:{})};
}
function comments(values:unknown[],rootID:string){
 const seen=new Set<string>(),items:SongComment[]=[];
 for(const value of values){const item=comment(value,rootID);if(item&&!seen.has(item.id)){seen.add(item.id);items.push(item);}}
 return items;
}
function rootToken(value:string){const match=/^tx:([A-Za-z0-9!.*_\-]{1,256}):[A-Za-z0-9!.*_\-]{1,256}$/.exec(value);return match?.[1];}

type RootBinding={songID:string;mid:string;replyCount?:number};
type PageState={lastCommentSeqNo:string;total:number;totalVer:string};
type ReplyState={lastRankScore:string;lastCommentSeqNo:string;total?:number};

export class QQPublicComments {
 private http:HTTPClient;private ids=new Map<string,string>();private roots=new Map<string,RootBinding>();private pages=new Map<string,PageState>();private replyPages=new Map<string,ReplyState>();
 constructor(http:HTTPClient){this.http=http;}
 supports(track:Track){return track.origin.kind==='online'&&track.origin.platform==='tx'&&/^[A-Za-z0-9]{10,32}$/.test(track.origin.id);}
 private async songID(track:Track,signal:AbortSignal){
  const mid=track.origin.id,metadata=track.metadata,supplied=(metadata.songmid===undefined||metadata.songmid===mid)?numeric(metadata.id):undefined;
  if(supplied)return supplied;const cached=this.ids.get(mid);if(cached)return cached;
  const body=JSON.stringify({comm:{ct:19,cv:1859,uin:0},req:{module:'music.pf_song_detail_svr',method:'get_song_detail_yqq',param:{song_type:0,song_mid:mid}}});
  const raw=row(await this.http('https://u.y.qq.com/cgi-bin/musicu.fcg',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',Referer:'https://y.qq.com/'},body},signal)),response=row(raw.req),detail=row(row(response.data).track_info),id=numeric(detail.id);
  throwIfAborted(signal);if(raw.code!==0||response.code!==0||detail.mid!==mid||!id)throw Error('歌曲评论标识暂不可用');
  putBounded(this.ids,mid,id,100);return id;
 }
 private pageKey(mid:string,songID:string,offset:number){return `${mid}:${songID}:${offset}`;}
 private replyKey(mid:string,songID:string,rootID:string,offset?:number){return `${mid}:${songID}:${rootID}${offset===undefined?'':`:${offset}`}`;}
 private observe(rootID:string,mid:string,songID:string,replyCount:number|undefined){
  putBounded(this.roots,this.replyKey(mid,songID,rootID),{songID,mid,...(replyCount!==undefined?{replyCount}:{})},MAX_ROOTS);
 }
 private parseList(values:unknown,mid:string,songID:string){
  if(!Array.isArray(values)||values.length>PAGE_SIZE)throw Error('评论响应无效');
  const seen=new Set<string>(),items:SongComment[]=[];
  for(const raw of values){
   const v=row(raw),key=opaque(v.CmId??v.commentid);if(!key)continue;
   const declaredRoot=opaque(v.RootCmId??v.rootcommentid),rootID=declaredRoot??key,item=comment(v,rootID);
   if(item&&!seen.has(item.id)){seen.add(item.id);items.push(item);}
   this.observe(rootID,mid,songID,count(v.ReplyCnt)??(Array.isArray(v.SubComments)&&v.SubComments.length?undefined:0));
  }
  if(values.length&&!items.length)throw Error('评论响应无效');
  return items;
 }
 async page(track:Track,offset:number,signal:AbortSignal):Promise<CommentPage>{
  if(!this.supports(track)||!Number.isSafeInteger(offset)||offset<0||offset>100000||offset%PAGE_SIZE!==0)throw Error('此歌曲暂不支持公开评论');
  return bounded(async child=>{
   const mid=track.origin.id,songID=await this.songID(track,child),pageNum=offset/PAGE_SIZE,state=offset===0?{lastCommentSeqNo:'',total:0,totalVer:'0'}:this.pages.get(this.pageKey(mid,songID,offset));
   throwIfAborted(child);if(!state)throw Error('评论分页游标暂不可用');
   const body=JSON.stringify({comm:{ct:24,cv:0},req_0:{module:'music.globalComment.CommentRead',method:'GetNewCommentList',param:{BizType:1,BizId:songID,LastCommentSeqNo:state.lastCommentSeqNo,PageSize:PAGE_SIZE,PageNum:pageNum,FromCommentId:'',WithHot:offset===0?1:0,PicEnable:1,LastTotal:state.total,LastTotalVer:state.totalVer}}});
   const raw=row(await this.http('https://u.y.qq.com/cgi-bin/musicu.fcg',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',Referer:'https://y.qq.com/'},body},child)),response=row(raw.req_0),data=row(response.data);throwIfAborted(child);
   if(raw.code!==0||response.code!==0||count(data.SubCode)!==0)throw Error('评论服务暂时不可用');
   const latest=row(data.CommentList),values=latest.Comments,total=count(latest.Total),hasMore=flag(latest.HasMore);
   if(!Array.isArray(values)||total===undefined||hasMore===undefined||(total>0&&values.length>total))throw Error('评论服务暂时不可用');
   const items=this.parseList(values,mid,songID),last=row(values[values.length-1]),lastCommentSeqNo=sequence(last.SeqNo),nextOffset=offset+PAGE_SIZE;
   const pageHasMore=hasMore==='1'&&values.length>0&&nextOffset<total,hot=offset===0?this.parseList(row(data.CommentList2).Comments,mid,songID):[];
   if(pageHasMore&&!lastCommentSeqNo)throw Error('评论分页游标无效');
   const totalVer=typeof data.TotalVer==='string'&&/^[A-Za-z0-9._\-]{0,128}$/.test(data.TotalVer)?data.TotalVer:'0';
   if(pageHasMore)putBounded(this.pages,this.pageKey(mid,songID,nextOffset),{lastCommentSeqNo:lastCommentSeqNo!,total,totalVer},MAX_CURSORS);
   return{hot,items,total,nextOffset,hasMore:pageHasMore};
  },signal,12000);
 }
 canExpand(track:Track,root:SongComment){
  const rootID=rootToken(root.id);if(!rootID)return false;
  const mid=track.origin.id,metadata=track.metadata,supplied=(metadata.songmid===undefined||metadata.songmid===mid)?numeric(metadata.id):undefined,songID=supplied??this.ids.get(mid);
  if(!songID)return false;
  const binding=this.roots.get(this.replyKey(mid,songID,rootID));
  return!!binding&&binding.songID===songID&&binding.mid===mid&&(binding.replyCount===undefined||binding.replyCount>0);
 }
 async replies(track:Track,root:SongComment,offset:number,signal:AbortSignal):Promise<CommentThreadPage>{
  const rootID=rootToken(root.id);
  if(!this.supports(track)||!rootID||!Number.isSafeInteger(offset)||offset<0||offset>100000||offset%PAGE_SIZE!==0)throw Error('此评论暂不支持展开回复');
  return bounded(async child=>{
   const mid=track.origin.id,songID=await this.songID(track,child),binding=this.roots.get(this.replyKey(mid,songID,rootID));
   throwIfAborted(child);if(!binding||binding.songID!==songID||binding.mid!==mid)throw Error('评论归属已变化，请刷新后重试');
   const state=offset===0?{lastRankScore:'',lastCommentSeqNo:'',total:binding.replyCount}:this.replyPages.get(this.replyKey(mid,songID,rootID,offset));
   if(!state)throw Error('回复分页游标暂不可用');
   const body=JSON.stringify({comm:{ct:24,cv:0},req_0:{module:'music.globalComment.CommentRead',method:'GetReplyCommentList',param:{RootCmId:rootID,LastCommentSeqNo:state.lastCommentSeqNo,PageSize:PAGE_SIZE,LastRankScore:state.lastRankScore,RankType:0,PicEnable:1,PageNum:offset/PAGE_SIZE}}});
   const raw=row(await this.http('https://u.y.qq.com/cgi-bin/musicu.fcg',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',Referer:'https://y.qq.com/'},body},child)),response=row(raw.req_0),data=row(response.data),list=row(data.CommentList),values=list.Comments,total=count(list.Total),rawHasMore=flag(list.HasMore);throwIfAborted(child);
   if(raw.code!==0||response.code!==0||count(data.SubCode)!==0||!Array.isArray(values)||values.length>PAGE_SIZE||total===undefined||rawHasMore===undefined)throw Error('回复服务暂时不可用');
   if(offset===0&&binding.replyCount!==undefined&&total!==binding.replyCount)throw Error('回复总数校验失败');
   if(offset>0&&total!==0&&state.total!==undefined&&total!==state.total)throw Error('回复总数校验失败');
   if(total>0&&values.length>total)throw Error('回复列表超出声明总数');
   const items=comments(values,rootID),last=row(values[values.length-1]),nextOffset=offset+PAGE_SIZE,effectiveTotal=offset===0?total:state.total,hasMore=rawHasMore==='1'&&values.length>0&&(effectiveTotal===undefined||nextOffset<effectiveTotal);
   if(values.length&&!items.length)throw Error('回复响应无效');
   if(hasMore){
    const lastRankScore=rank(last.RankScore),lastCommentSeqNo=sequence(last.SeqNo);
    if(!lastRankScore||!lastCommentSeqNo)throw Error('回复分页游标无效');
    putBounded(this.replyPages,this.replyKey(mid,songID,rootID,nextOffset),{lastRankScore,lastCommentSeqNo,...(effectiveTotal!==undefined?{total:effectiveTotal}:{})},MAX_CURSORS);
   }
   return{items,...(effectiveTotal!==undefined?{total:effectiveTotal}:{}),nextOffset,hasMore};
  },signal,12000);
 }
}
