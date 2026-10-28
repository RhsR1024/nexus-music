// Public playlist search contracts adapted from Q-1515 547ccfe musicSdk/*/songList.js
// (Apache-2.0, LX/lyswhut attribution). Own bounded parser and iOS HTTPS requests.
import {parseKuwoJSON} from './kuwoJSON.ts';
import type {OnlinePlatform} from '../domain/track.ts';
import type {BrowseItem} from './discovery.ts';
import {queryURL,requestJSON,requestText,type HTTPClient,type TextHTTPClient} from './http.ts';
import {safePublicURL} from '../storage/cleanTrack.ts';
export interface PlaylistSearchItem extends BrowseItem {readonly author?:string}
export interface PlaylistSearchPage {items:readonly PlaylistSearchItem[];total?:number;page:number;hasMore:boolean}
type Row=Record<string,unknown>;
const row=(v:unknown):Row=>v&&typeof v==='object'&&!Array.isArray(v)?v as Row:{};
const text=(v:unknown)=>typeof v==='string'?v:typeof v==='number'&&Number.isSafeInteger(v)?String(v):'';
const clean=(v:unknown)=>text(v).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();
function count(v:unknown){if(v===undefined||v===null)return undefined;const n=Number(v);if((typeof v!=='string'&&typeof v!=='number')||(typeof v==='string'&&!v.trim())||!Number.isSafeInteger(n)||n<0)throw Error('歌单数量格式无效');return n;}
function art(v:unknown){try{const url=new URL(text(v).replace('{size}','400').replace(/^\/\//,'https://'));if(url.protocol==='http:')url.protocol='https:';return safePublicURL(url.href)?url.href:undefined;}catch{return undefined;}}
function item(platform:OnlinePlatform,v:Row):PlaylistSearchItem{
  const id=text(platform==='wy'?v.id:platform==='tx'?v.dissid:platform==='kw'?v.playlistid:platform==='kg'?v.specialid:v.id);
  const title=clean(platform==='wy'||platform==='kw'||platform==='mg'?v.name:platform==='tx'?v.dissname:v.specialname);
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)||!title||title.length>1000||/[\u0000-\u001f\u007f]/.test(title))throw Error('歌单详情格式无效');
  const author=clean(platform==='wy'?row(v.creator).nickname:platform==='tx'?row(v.creator).name:platform==='kw'||platform==='kg'?v.nickname:v.userName).slice(0,200);
  const artwork=art(platform==='wy'?v.coverImgUrl:platform==='tx'?v.imgurl:platform==='kw'?v.pic:platform==='kg'?v.imgurl:v.musicListPicUrl);
  const total=count(platform==='wy'?v.trackCount:platform==='tx'?v.song_count:platform==='kw'?v.songnum:platform==='kg'?v.songcount:v.musicNum);
  const description=clean(v.description??v.intro??v.introduction).slice(0,5000);
  return{id,title,...(description?{description}:{}),...(author?{author}:{}),...(artwork?{artwork}:{}),...(total!==undefined?{count:total}:{})};
}
export class PlaylistSearchProvider{
  private readonly deps:{http?:HTTPClient;textHTTP?:TextHTTPClient;md5:(v:string)=>Promise<string>;deviceId:()=>string;now?:()=>number};
  constructor(deps:PlaylistSearchProvider['deps']){this.deps=deps;}
  async search(platform:OnlinePlatform,query:string,page:number,signal:AbortSignal,limit=30):Promise<PlaylistSearchPage>{
    if(!query.trim()||query.length>500||!Number.isSafeInteger(page)||page<1||page>10000||!Number.isInteger(limit)||limit<1||limit>100)throw Error('搜索参数无效');
    if(signal.aborted)throw Error('搜索已取消');
    const http=this.deps.http??requestJSON;let values:unknown,total:unknown;
    if(platform==='wy'){
      const r=row(await http('https://music.163.com/api/search/get/web',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/x-www-form-urlencoded',Referer:'https://music.163.com/'},body:Object.entries({s:query,type:1000,offset:(page-1)*limit,limit}).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&')},signal));
      if(r.code!==200)throw Error('歌单搜索暂不可用');const data=row(r.result);values=data.playlists;total=data.playlistCount;
    }else if(platform==='tx'){
      const r=row(await http(queryURL('https://c.y.qq.com/soso/fcgi-bin/client_music_search_songlist',{page_no:page-1,num_per_page:limit,format:'json',query,remoteplace:'txt.yqq.playlist',inCharset:'utf8',outCharset:'utf-8'}),{credentials:'omit',headers:{Referer:'https://y.qq.com/portal/search.html','User-Agent':'Mozilla/5.0'}},signal));
      if(r.code!==0)throw Error('歌单搜索暂不可用');const data=row(r.data);values=data.list;total=data.sum;
    }else if(platform==='kw'){
      const r=row(parseKuwoJSON(await (this.deps.textHTTP??requestText)(queryURL('https://search.kuwo.cn/r.s',{all:query,pn:page-1,rn:limit,rformat:'json',encoding:'utf8',ver:'mbox',vipver:'MUSIC_8.7.7.0_BCS37',plat:'pc',ft:'playlist',pay:0,needliveshow:0}),{credentials:'omit'},signal)));values=r.abslist;total=r.TOTAL;
    }else if(platform==='kg'){
      const r=row(await http(queryURL('https://msearchretry.kugou.com/api/v3/search/special',{keyword:query,page,pagesize:limit,showtype:10,filter:0,version:7910,sver:2}),{credentials:'omit'},signal));
      if(r.errcode!==0)throw Error('歌单搜索暂不可用');const data=row(r.data);values=data.info;total=data.total;
    }else{
      const timestamp=String((this.deps.now??Date.now)()),deviceId=this.deps.deviceId().replaceAll('-','').toUpperCase();
      const sign=await this.deps.md5(`${query}6cdc72a439cef99a3418d2a78aa28c73yyapp2d16148780a1dcc7408e06336b98cfd50${deviceId}${timestamp}`);
      const r=row(await http(queryURL('https://jadeite.migu.cn/music_search/v3/search/searchAll',{isCorrect:1,isCopyright:1,searchSwitch:JSON.stringify({song:0,album:0,singer:0,tagSong:0,mvSong:0,bestShow:0,songlist:1,lyricSong:0}),pageSize:limit,text:query,pageNo:page,sort:0,sid:'USS'}),{credentials:'omit',headers:{uiVersion:'A_music_3.6.1',deviceId,timestamp,sign,channel:'0146921','User-Agent':'Mozilla/5.0'}},signal));
      if(r.code!=='000000')throw Error('歌单搜索暂不可用');const data=row(r.songListResultData);values=data.result;total=data.totalCount;
    }
    if(signal.aborted)throw Error('搜索已取消');const parsedTotal=count(total);
    if(values===undefined&&parsedTotal===0)values=[];
    if(!Array.isArray(values)||values.length>1000)throw Error('歌单搜索响应无效');
    const items=[...new Map(values.map(v=>{const value=item(platform,row(v));return[value.id,value] as const;})).values()];
    return{items,page,...(parsedTotal!==undefined?{total:parsedTotal}:{}),hasMore:values.length>0&&(parsedTotal!==undefined?page*limit<parsedTotal:values.length>=limit)};
  }
}
