// Public MV catalogs reuse NexusMusic's attributed search/signature adapters.
// No reference runtime, account cookies, media URL extraction or private tokens.
import type {OnlinePlatform} from '../domain/track.ts';
import type {BrowseItem} from './discovery.ts';
import {requestJSON,requestText,queryURL,type HTTPClient,type TextHTTPClient} from './http.ts';
import {parseKuwoJSON} from './kuwoJSON.ts';
import {qqSignature} from './qqSignature.ts';
import {safePublicURL} from '../storage/cleanTrack.ts';
type Row=Record<string,unknown>;
const row=(v:unknown):Row=>v&&typeof v==='object'&&!Array.isArray(v)?v as Row:{};
const text=(v:unknown)=>typeof v==='string'?v:typeof v==='number'&&Number.isSafeInteger(v)?String(v):'';
const clean=(v:unknown)=>text(v).slice(0,20000).replace(/<[^>]*>/g,'').replace(/&nbsp;|\u00a0/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").trim();
function id(v:unknown){const s=text(v);if(!/^[A-Za-z0-9_-]{1,128}$/.test(s))throw Error('MV标识无效');return s;}
function count(v:unknown){if(v===undefined||v===null)return undefined;if(!['number','string'].includes(typeof v)||!String(v).trim()||!Number.isSafeInteger(Number(v))||Number(v)<0)throw Error('MV数量无效');return Number(v);}
function duration(v:unknown){if(v===undefined||v===null||v==='')return undefined;const raw=typeof v==='number'&&Number.isFinite(v)?String(v):text(v),parts=raw.split(':');const n=!raw.trim()?NaN:parts.length===1?Number(raw):parts.length===2&&/^\d+:\d{2}$/.test(raw)&&Number(parts[1])<60?Number(parts[0])*60+Number(parts[1]):NaN;if(!Number.isFinite(n)||n<0||n>86400)throw Error('MV时长无效');return n>0?n:undefined;}
function art(v:unknown){try{const u=new URL(text(v).replace('{size}','400').replace(/^\/\//,'https://'));if(u.protocol==='http:')u.protocol='https:';return safePublicURL(u.href)?u.href:undefined;}catch{return undefined;}}
export interface VideoItem extends BrowseItem{platform:OnlinePlatform;durationSeconds?:number}
export interface VideoSearchPage{items:readonly VideoItem[];page:number;total?:number;hasMore:boolean}
export class PublicMVPageUnavailableError extends Error {
 constructor(){super('此平台暂不支持在应用内查看MV详情。');}
}
type Dependencies={http?:HTTPClient;textHTTP?:TextHTTPClient;md5:(v:string)=>Promise<string>;sha1:(v:string)=>Promise<string>;deviceId:()=>string;now?:()=>number};
export class VideoProvider{
 private readonly deps:Dependencies;
 constructor(deps:Dependencies){this.deps=deps;}
 private http:HTTPClient=(u,r,s)=>(this.deps.http??requestJSON)(u,{...r,credentials:'omit'},s);
 private textHTTP:TextHTTPClient=(u,r,s)=>(this.deps.textHTTP??requestText)(u,{...r,credentials:'omit'},s);
 async search(platform:OnlinePlatform,query:string,page:number,signal:AbortSignal,limit=30):Promise<VideoSearchPage>{
  if(signal.aborted)throw Error('已取消');if(!query.trim()||query.length>500||!Number.isSafeInteger(page)||page<1||page>10000||!Number.isInteger(limit)||limit<1||limit>100)throw Error('MV搜索参数无效');
  let values:unknown,total:unknown;
  if(platform==='wy'){const r=row(await this.http('https://music.163.com/api/cloudsearch/pc',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Referer:'https://music.163.com/'},body:Object.entries({s:query,type:1004,offset:(page-1)*limit,limit}).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&')},signal));if(r.code!==200)throw Error('MV搜索暂不可用');const d=row(r.result);values=d.mvs;total=d.mvCount;}
  else if(platform==='tx'){const guid=this.deps.deviceId().replaceAll('-','').toUpperCase(),body=JSON.stringify({comm:{ct:'19',cv:'2151',guid,uin:'0',tmeAppID:'qqmusic',tmeLoginType:0},req:{module:'music.search.SearchCgiService',method:'DoSearchForQQMusicDesktop',param:{grp:1,search_type:4,query,num_per_page:limit,page_num:page,remoteplace:'txt.newclient.top',searchid:guid+'00000'}}});const r=row(await this.http(queryURL('https://u.y.qq.com/cgi-bin/musics.fcg',{sign:await qqSignature(body,this.deps.sha1)}),{method:'POST',headers:{'Content-Type':'application/json',Referer:'https://y.qq.com/','User-Agent':'QQMusic 14090508(android 12)'},body},signal)),req=row(r.req);if(r.code!==0||req.code!==0)throw Error('MV搜索暂不可用');const d=row(req.data);values=row(row(d.body).mv).list;total=row(d.meta).sum;}
  else if(platform==='kw'){const d=row(parseKuwoJSON(await this.textHTTP(queryURL('https://search.kuwo.cn/r.s',{all:query,pn:page-1,rn:limit,ft:'music',hasmkv:1,rformat:'json',encoding:'utf8'}),{},signal)));values=d.abslist;total=d.TOTAL;}
  else if(platform==='kg'){const r=row(await this.http(queryURL('https://msearch.kugou.com/api/v3/search/mv',{keyword:query,page,pagesize:limit,showtype:10,filter:0,version:7910,sver:2}),{},signal));if(r.status!==1||r.errcode!==0)throw Error('MV搜索暂不可用');const d=row(r.data);values=d.info;total=d.total;}
  else{const timestamp=String((this.deps.now??Date.now)()),deviceId=this.deps.deviceId().replaceAll('-','').toUpperCase(),sign=await this.deps.md5(`${query}6cdc72a439cef99a3418d2a78aa28c73yyapp2d16148780a1dcc7408e06336b98cfd50${deviceId}${timestamp}`);const r=row(await this.http(queryURL('https://jadeite.migu.cn/music_search/v3/search/searchAll',{isCorrect:1,isCopyright:1,searchSwitch:JSON.stringify({song:0,album:0,singer:0,tagSong:0,mvSong:1,bestShow:0,songlist:0,lyricSong:0}),pageSize:limit,text:query,pageNo:page,sort:0,sid:'USS'}),{headers:{uiVersion:'A_music_3.6.1',deviceId,timestamp,sign,channel:'0146921','User-Agent':'Mozilla/5.0'}},signal));if(r.code!=='000000')throw Error('MV搜索暂不可用');const d=row(r.mvSongResultData);values=d.result;total=d.totalCount;}
  if(signal.aborted)throw Error('已取消');const parsedTotal=count(total);if(values===undefined&&parsedTotal===0)values=[];if(!Array.isArray(values)||values.length>1000)throw Error('MV搜索响应无效');
  const items=values.map(value=>{const v=row(value),mv=row(Array.isArray(v.mvList)?v.mvList[0]:undefined);
   if(platform==='kw'&&(!text(v.MKVRID).startsWith('MV_')||text(v.MVFLAG)==='0'))throw Error('返回内容不是MV');
   const identity=id(platform==='wy'?v.id:platform==='tx'?v.v_id:platform==='kw'?text(v.MUSICRID).replace(/^MUSIC_/,''):platform==='kg'?text(v.hash).toLowerCase():mv.id),title=clean(platform==='tx'?v.mv_name:platform==='kw'?v.NAME:platform==='kg'?v.filename:v.name),author=clean(platform==='wy'?v.artistName:platform==='tx'?v.singer_name:platform==='kw'?v.ARTIST:platform==='kg'?v.singername:Array.isArray(v.singers)?v.singers.map(a=>clean(row(a).name)).join(' / '):''),artwork=art(platform==='wy'?v.cover:platform==='tx'?v.mv_pic_url:platform==='kw'?v.hts_MVPIC:platform==='kg'?v.imgurl:row(Array.isArray(mv.mvPicUrl)?mv.mvPicUrl[0]:undefined).img),seconds=duration(platform==='wy'?typeof v.duration==='number'?v.duration/1000:v.duration:platform==='kw'?undefined:platform==='mg'?v.mvDuration:v.duration);
   if(!title||title.length>1000||/[\u0000-\u001f\u007f]/.test(title))throw Error('MV名称无效');return{id:identity,title,platform,...(author?{author:author.slice(0,1000)}:{}),...(artwork?{artwork}:{}),...(seconds!==undefined?{durationSeconds:seconds}:{})};});
  return{items:[...new Map(items.map(v=>[v.id,v])).values()],page,total:parsedTotal,hasMore:values.length>0&&(parsedTotal!==undefined?page*limit<parsedTotal:values.length>=limit)};
 }
 async publicPage(platform:OnlinePlatform,item:VideoItem,signal:AbortSignal):Promise<string>{
  if(signal.aborted)throw Error('已取消');if(item.platform!==platform)throw Error('MV平台不符');const identity=id(item.id);
  if(platform!=='tx'&&platform!=='kg'&&!/^\d+$/.test(identity))throw Error('MV页面标识无效');
  if(platform==='wy')return`https://music.163.com/mv?id=${identity}`;
  if(platform==='tx')return`https://y.qq.com/n/ryqq/mv/${identity}`;
  if(platform==='kw')return`https://m.kuwo.cn/newh5app/mvplay/7/${identity}?id=${identity}&type=7`;
  // The old official MV URL now redirects to the v5 home page. Do not disguise
  // that unrelated page as this result's detail. Catalog metadata remains usable.
  if(platform==='mg')throw new PublicMVPageUnavailableError();
  // Resolve only the public page ID. Expiring media URLs never enter the model.
  const d=row(await this.http(queryURL('https://m.kugou.com/app/i/mv.php',{cmd:100,hash:identity,ismp3:1,ext:'mp4'}),{},signal));if(signal.aborted)throw Error('已取消');if(d.status!==1||d.errcode!==0)throw Error('MV页面暂不可读取');const pageId=id(d.id);if(!/^\d+$/.test(pageId))throw Error('MV页面标识无效');return`https://www.kugou.com/mvweb/html/mv_${pageId}.html`;
 }
}
