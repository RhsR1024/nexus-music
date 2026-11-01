import type {Track} from '../domain/track.ts';
import type {CommentPage,SongComment} from './comments.ts';
import {bounded,throwIfAborted} from './async.ts';
import type {HTTPClient} from './http.ts';
import {commentMediaURL,commentRegion} from './commentFields.ts';
const row=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const visible=(v:unknown,max:number)=>typeof v==='string'?v.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,'').replace(/\\n/g,'\n').replace(/\[em\]e\d{1,8}\[\/em\]/g,'[表情]').slice(0,max).trim():'';
const count=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0?v:typeof v==='string'&&/^\d{1,15}$/.test(v)&&Number.isSafeInteger(Number(v))?Number(v):undefined;
const numeric=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0?String(v):typeof v==='string'&&/^[1-9]\d{0,23}$/.test(v)?v:undefined;
const opaque=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9!.*_\-]{1,256}$/.test(v)?v:undefined;
function comment(value:unknown):SongComment|undefined{
 const v=row(value),key=opaque(v.commentid),root=opaque(v.rootcommentid),original=visible(v.rootcommentcontent,10000);
 if(!key||!root)return;
 const replies=Array.isArray(v.middlecommentcontent)?v.middlecommentcontent.slice(0,50).map(row):[];
 const latest=key!==root?replies.find(r=>r.subcommentid===key):undefined,body=visible(latest?.subcommentcontent,10000),isReply=!!body;
 if(!body&&!original)return;
 const author=visible(isReply?latest?.replynick:v.rootcommentnick,200)||(key===root?visible(v.nick,200):'')||'匿名用户';
 const seconds=count(v.time),likes=isReply||key===root?count(v.praisenum):undefined,time=seconds!==undefined&&seconds<=8640000000000&&(isReply||key===root)?seconds*1000:undefined;
 const identity=isReply?latest:v,avatar=commentMediaURL(identity?.avatarurl??identity?.Avatar),region=commentRegion(identity?.Location??identity?.location);
 return{id:`tx:${root}:${key}`,content:body||original,userName:author.replace(/^@/,'')||'匿名用户',...(avatar?{avatar}:{}),...(region?{region}:{}),...(time!==undefined?{time}:{}),...(likes!==undefined?{likes}:{}),...(isReply&&original?{reply:{userName:visible(v.rootcommentnick,200)||'匿名用户',content:original}}:{})};
}
function comments(values:unknown):SongComment[]{
 if(!Array.isArray(values)||values.length>50)throw Error('评论响应无效');
 const seen=new Set<string>(),items:SongComment[]=[];
 for(const value of values){const item=comment(value);if(item&&!seen.has(item.id)){seen.add(item.id);items.push(item);}}
 if(values.length&&!items.length)throw Error('评论响应无效');return items;
}
export class QQPublicComments {
 private http:HTTPClient;private ids=new Map<string,string>();
 constructor(http:HTTPClient){this.http=http;}
 supports(track:Track){return track.origin.kind==='online'&&track.origin.platform==='tx'&&/^[A-Za-z0-9]{10,32}$/.test(track.origin.id);}
 private async songID(track:Track,signal:AbortSignal){
  const mid=track.origin.id,metadata=track.metadata,supplied=(metadata.songmid===undefined||metadata.songmid===mid)?numeric(metadata.id):undefined;
  if(supplied)return supplied;const cached=this.ids.get(mid);if(cached)return cached;
  const body=JSON.stringify({comm:{ct:19,cv:1859,uin:0},req:{module:'music.pf_song_detail_svr',method:'get_song_detail_yqq',param:{song_type:0,song_mid:mid}}});
  const raw=row(await this.http('https://u.y.qq.com/cgi-bin/musicu.fcg',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',Referer:'https://y.qq.com/'},body},signal)),response=row(raw.req),detail=row(row(response.data).track_info),id=numeric(detail.id);
  throwIfAborted(signal);if(raw.code!==0||response.code!==0||detail.mid!==mid||!id)throw Error('歌曲评论标识暂不可用');
  if(this.ids.size>=100)this.ids.delete(this.ids.keys().next().value!);this.ids.set(mid,id);return id;
 }
 async page(track:Track,offset:number,signal:AbortSignal):Promise<CommentPage>{
  if(!this.supports(track)||!Number.isSafeInteger(offset)||offset<0||offset>100000||offset%20!==0)throw Error('此歌曲暂不支持公开评论');
  return bounded(async child=>{
   const songID=await this.songID(track,child);throwIfAborted(child);
   const body=new URLSearchParams({uin:'0',format:'json',cid:'205360772',reqtype:'2',biztype:'1',topid:songID,cmd:'8',needmusiccrit:'1',pagenum:String(offset/20),pagesize:'20'}).toString();
   const raw=row(await this.http('https://c.y.qq.com/base/fcgi-bin/fcg_global_comment_h5.fcg',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/x-www-form-urlencoded',Referer:'https://y.qq.com/'},body},child));throwIfAborted(child);
   const recent=row(raw.comment),total=count(recent.commenttotal),values=recent.commentlist;
   if(raw.code!==0||numeric(raw.topid)!==songID||total===undefined||!Array.isArray(values)||values.length>20||values.length>total)throw Error('评论服务暂时不可用');
   const items=comments(values),hot=offset===0&&raw.hot_comment!==undefined?comments(row(raw.hot_comment).commentlist):[];
   const nextOffset=offset+20;return{hot,items,total,nextOffset,hasMore:values.length>0&&nextOffset<total};
  },signal,12000);
 }
}
