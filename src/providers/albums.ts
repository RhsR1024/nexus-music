// Public catalog contracts: Q-1515 547ccfe musicSearch and kw/kg/mg album
// (Apache-2.0, LX/lyswhut attribution); independent HTTPS/catalog implementation.
import type {OnlinePlatform,Track} from '../domain/track.ts';
import {trackKey} from '../domain/track.ts';
import type {BrowseItem,PlaylistPage} from './discovery.ts';
import type {PlaylistSearchItem,PlaylistSearchPage} from './playlistSearch.ts';
import {requestJSON,requestText,queryURL,type HTTPClient,type TextHTTPClient} from './http.ts';
import {parseKuwoJSON} from './kuwoJSON.ts';
import {qqSignature} from './qqSignature.ts';
import {onlineTrack} from './online.ts';
import {safePublicURL} from '../storage/cleanTrack.ts';
type Row=Record<string,unknown>;
const row=(v:unknown):Row=>v&&typeof v==='object'&&!Array.isArray(v)?v as Row:{};
const text=(v:unknown)=>typeof v==='string'?v:typeof v==='number'&&Number.isSafeInteger(v)?String(v):'';
const clean=(v:unknown)=>text(v).replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").trim();
function count(v:unknown){if(v===undefined||v===null)return undefined;if((typeof v!=='number'&&typeof v!=='string')||!String(v).trim()||!Number.isSafeInteger(Number(v))||Number(v)<0)throw Error('专辑数量无效');return Number(v);}
// NetEase publishes its calendar date as a China-midnight epoch; 0/-1 are unknown.
function date(v:unknown){if(typeof v==='number'){if(!Number.isFinite(v)||v===0||v===-1)return undefined;try{return new Date(v+8*60*60*1000).toISOString().slice(0,10);}catch{return undefined;}}const d=text(v).slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return undefined;const time=Date.parse(d+'T00:00:00Z');return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===d?d:undefined;}
function info(author:unknown,released:unknown,description:unknown):Partial<BrowseItem>{const a=clean(author).slice(0,200),d=date(released),s=clean(description).slice(0,12000);return{...(a?{author:a}:{}),...(d?{released:d}:{}),...(s?{description:s}:{})};}
function identity(v:unknown){const id=text(v);if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw Error('专辑ID无效');return id;}
function art(v:unknown){try{const u=new URL(text(v).replace('{size}','400').replace(/^\/\//,'https://'));if(u.protocol==='http:')u.protocol='https:';return safePublicURL(u.href)?u.href:undefined;}catch{return undefined;}}
function array(v:unknown,total?:number):unknown[]{if(v===undefined&&total===0)return[];if(!Array.isArray(v)||v.length>20000)throw Error('专辑曲目响应无效');return v;}
function check(page:number,limit:number,signal:AbortSignal){if(signal.aborted)throw Error('已取消');if(!Number.isSafeInteger(page)||page<1||page>10000||!Number.isInteger(limit)||limit<1||limit>100)throw Error('专辑分页无效');}
export interface AlbumSearchItem extends PlaylistSearchItem {released?:string}
type Dependencies={http?:HTTPClient;textHTTP?:TextHTTPClient;md5:(v:string)=>Promise<string>;sha1:(v:string)=>Promise<string>;deviceId:()=>string;now?:()=>number};
export class AlbumProvider{
  private readonly deps:Dependencies;
  constructor(deps:Dependencies){this.deps=deps;}
  private http:HTTPClient=(url,request,signal)=>(this.deps.http??requestJSON)(url,{...request,credentials:'omit'},signal);
  private textHTTP:TextHTTPClient=(url,request,signal)=>(this.deps.textHTTP??requestText)(url,{...request,credentials:'omit'},signal);
  async search(platform:OnlinePlatform,query:string,page:number,signal:AbortSignal,limit=30):Promise<PlaylistSearchPage>{
    check(page,limit,signal);if(!query.trim()||query.length>500)throw Error('搜索参数无效');let values:unknown,total:unknown;
    if(platform==='wy'){
      const raw=row(await this.http('https://music.163.com/api/search/get/web',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Referer:'https://music.163.com/'},body:Object.entries({s:query,type:10,offset:(page-1)*limit,limit}).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&')},signal));if(raw.code!==200)throw Error('专辑搜索暂不可用');const d=row(raw.result);values=d.albums;total=d.albumCount;
    }else if(platform==='tx'){
      const guid=this.deps.deviceId().replaceAll('-','').toUpperCase();const body=JSON.stringify({comm:{ct:'19',cv:'2151',guid,uin:'0',tmeAppID:'qqmusic',tmeLoginType:0},req:{module:'music.search.SearchCgiService',method:'DoSearchForQQMusicDesktop',param:{grp:1,search_type:2,query,num_per_page:limit,page_num:page,remoteplace:'txt.newclient.top',searchid:guid+'00000'}}});
      const raw=row(await this.http(queryURL('https://u.y.qq.com/cgi-bin/musics.fcg',{sign:await qqSignature(body,this.deps.sha1)}),{method:'POST',headers:{'Content-Type':'application/json',Referer:'https://y.qq.com/','User-Agent':'QQMusic 14090508(android 12)'},body},signal)),r=row(raw.req);if(raw.code!==0||r.code!==0)throw Error('专辑搜索暂不可用');const d=row(r.data),a=row(row(d.body).album);values=a.list;total=a.sum??row(d.meta).sum;
    }else if(platform==='kw'){
      const d=row(parseKuwoJSON(await this.textHTTP(queryURL('https://search.kuwo.cn/r.s',{all:query,pn:page-1,rn:limit,ft:'album',rformat:'json',encoding:'utf8'}),{},signal)));values=d.albumlist;total=d.total;
    }else if(platform==='kg'){
      const raw=row(await this.http(queryURL('https://msearch.kugou.com/api/v3/search/album',{keyword:query,page,pagesize:limit,showtype:10,filter:0,version:7910,sver:2}),{},signal));if(raw.errcode!==0)throw Error('专辑搜索暂不可用');const d=row(raw.data);values=d.info;total=d.total;
    }else{
      const timestamp=String((this.deps.now??Date.now)()),deviceId=this.deps.deviceId().replaceAll('-','').toUpperCase(),sign=await this.deps.md5(`${query}6cdc72a439cef99a3418d2a78aa28c73yyapp2d16148780a1dcc7408e06336b98cfd50${deviceId}${timestamp}`);
      const raw=row(await this.http(queryURL('https://jadeite.migu.cn/music_search/v3/search/searchAll',{isCorrect:1,isCopyright:1,searchSwitch:JSON.stringify({song:0,album:1,singer:0,tagSong:0,mvSong:0,bestShow:0,songlist:0,lyricSong:0}),pageSize:limit,text:query,pageNo:page,sort:0,sid:'USS'}),{headers:{uiVersion:'A_music_3.6.1',deviceId,timestamp,sign,channel:'0146921','User-Agent':'Mozilla/5.0'}},signal));if(raw.code!=='000000')throw Error('专辑搜索暂不可用');const d=row(raw.albumResultData);values=d.result;total=d.totalCount;
    }
    if(signal.aborted)throw Error('已取消');const parsedTotal=count(total),rows=array(values,parsedTotal);if(rows.length>1000)throw Error('专辑搜索响应过大');
    const items=rows.map(value=>{const v=row(value),id=identity(platform==='tx'?v.albumMID:platform==='kw'||platform==='kg'?v.albumid:v.id),title=clean(platform==='tx'?v.albumName:platform==='kg'?v.albumname:v.name);if(!title||title.length>1000||/[\u0000-\u001f\u007f]/.test(title))throw Error('专辑名称无效');const author=clean(platform==='wy'?row(v.artist).name:platform==='tx'?v.singerName:platform==='kw'?v.artist:platform==='kg'?v.singername:v.singer).slice(0,200),artwork=art(platform==='wy'?v.picUrl:platform==='tx'?v.albumPic:platform==='kw'?v.hts_img??v.img:platform==='kg'?v.imgurl:row(Array.isArray(v.imgItems)?v.imgItems[0]:undefined).img),size=count(platform==='wy'?v.size:platform==='tx'?v.song_count:platform==='kw'?v.musiccnt:platform==='kg'?v.songcount:undefined);return{id,title,...info(author,platform==='wy'?v.publishTime:platform==='tx'?v.publicTime:platform==='kw'?v.pub:platform==='kg'?v.publishtime:v.publishDate,v.description??v.intro),...(author?{author}:{}),...(artwork?{artwork}:{}),...(size!==undefined?{count:size}:{})};});
    return{items:[...new Map(items.map(v=>[v.id,v])).values()],page,total:parsedTotal,hasMore:rows.length>0&&(parsedTotal!==undefined?page*limit<parsedTotal:rows.length>=limit)};
  }
  async detail(platform:OnlinePlatform,album:BrowseItem,page:number,signal:AbortSignal,limit=100):Promise<PlaylistPage>{
    check(page,limit,signal);const id=identity(album.id);let values:unknown,total:unknown,localPaging=false,metadata:Partial<BrowseItem>={};
    if(platform==='wy'){
      const r=row(await this.http(`https://music.163.com/api/album/${id}`,{},signal));if(r.code!==200)throw Error('此专辑暂不可公开读取，请到官方平台确认可用性');values=r.songs??row(r.album).songs;total=row(r.album).size;metadata=info(row(row(r.album).artist).name,row(r.album).publishTime,row(r.album).description);localPaging=true;
    }else if(platform==='tx'){
      const r=row(await this.http(queryURL('https://c.y.qq.com/v8/fcg-bin/fcg_v8_album_info_cp.fcg',{albummid:id,format:'json'}),{headers:{Referer:'https://y.qq.com/'}},signal));if(r.code!==0)throw Error('此专辑暂不可公开读取');const d=row(r.data);values=d.list;total=d.total_song_num??d.total;metadata=info(d.singername,d.aDate,d.desc);localPaging=true;
    }else if(platform==='kw'){
      const d=row(parseKuwoJSON(await this.textHTTP(queryURL('https://search.kuwo.cn/r.s',{pn:page-1,rn:limit,stype:'albuminfo',albumid:id,show_copyright_off:0,encoding:'utf',vipver:'MUSIC_9.1.0'}),{},signal)));values=d.musiclist;total=d.songnum;metadata=info(d.artist,d.pub,d.info);
    }else if(platform==='kg'){
      const r=row(await this.http(queryURL('https://mobiles.kugou.com/api/v3/album/song',{version:9108,albumid:id,plat:0,pagesize:limit,area_code:0,page,with_res_tag:0}),{},signal));if(r.errcode!==0||r.status!==1)throw Error('此专辑暂不可公开读取');const d=row(r.data);values=d.info;total=d.total;
    }else{
      const r=row(await this.http(queryURL('https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/queryAlbumSong',{albumId:id,pageNo:page}),{},signal));if(r.code!=='000000')throw Error('此专辑暂不可公开读取');const d=row(r.data);values=d.songList;total=d.totalCount;localPaging=true;
    }
    if(signal.aborted)throw Error('已取消');const parsedTotal=count(total);let rows=array(values,parsedTotal);
    // These endpoints return a complete album; never silently accept a truncated snapshot.
    if(localPaging){if(parsedTotal!==undefined&&rows.length!==parsedTotal)throw Error('专辑曲目不完整');rows=rows.slice((page-1)*limit,page*limit);}
    const items=rows.map(value=>{const v=row(value);if(platform==='kw')return onlineTrack(platform,{...v,name:clean(v.name),artist:clean(v.artist),rid:v.id??v.rid,album:album.title,albumid:id,pic:v.pic??album.artwork,FORMATS:v.formats});if(platform==='kg'){const filename=text(v.filename),split=filename.indexOf(' - ');return onlineTrack(platform,{...v,FileHash:v.hash,SongName:split<0?filename:filename.slice(split+3),SingerName:split<0?'':filename.slice(0,split),AlbumID:id,AlbumName:album.title,Duration:v.duration,FileSize:v.filesize,HQFileHash:v['320hash'],HQFileSize:v['320filesize'],SQFileHash:v.sqhash,SQFileSize:v.sqfilesize});}if(platform==='tx')return onlineTrack(platform,{...v,file:{media_mid:v.strMediaMid,size_128mp3:v.size128,size_320mp3:v.size320,size_flac:v.sizeflac}});return onlineTrack(platform,v);});
    if(items.some(v=>!v.title))throw Error('专辑歌曲信息缺失');return{title:album.title,items,page,total:parsedTotal,info:metadata,hasMore:rows.length>0&&(parsedTotal!==undefined?page*limit<parsedTotal:rows.length>=limit)};
  }
  async complete(platform:OnlinePlatform,album:BrowseItem,signal:AbortSignal):Promise<{title:string;tracks:readonly Track[]}>{
    const tracks:Track[]=[];let expected:number|undefined,previous='';
    for(let page=1;page<=200;page++){
      const result=await this.detail(platform,album,page,signal);if(result.total===undefined||result.total>20000||(expected!==undefined&&result.total!==expected))throw Error('无法确认专辑完整曲目');expected=result.total;
      const signature=result.items.map(track=>trackKey(track.origin)).join('|');if(page>1&&signature===previous)throw Error('专辑分页未推进');previous=signature;tracks.push(...result.items);if(tracks.length>20000)throw Error('专辑歌曲超过20000首');
      if(!result.hasMore){if(tracks.length!==expected)throw Error('专辑曲目不完整');return{title:album.title,tracks};}if(!result.items.length)throw Error('专辑分页未推进');
    }throw Error('专辑分页超过限制');
  }
}
