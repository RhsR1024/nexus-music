// Q-1515/LX 547ccfe public search and kg/singer.js contracts (Apache-2.0).
// Independent artist catalogs; no reference runtime, account tokens or native patches.
import type {OnlinePlatform} from '../domain/track.ts';
import type {BrowseItem,PlaylistPage} from './discovery.ts';
import {onlineTrack} from './online.ts';
import {requestJSON,requestText,queryURL,type HTTPClient,type TextHTTPClient} from './http.ts';
import {parseKuwoJSON} from './kuwoJSON.ts';
import {qqSignature} from './qqSignature.ts';
import {safePublicURL} from '../storage/cleanTrack.ts';
type Row=Record<string,unknown>;
const row=(v:unknown):Row=>v&&typeof v==='object'&&!Array.isArray(v)?v as Row:{};
const text=(v:unknown)=>typeof v==='string'?v:typeof v==='number'&&Number.isSafeInteger(v)?String(v):'';
const clean=(v:unknown)=>text(v).slice(0,20000).replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").trim();
function count(v:unknown){if(v===undefined||v===null)return undefined;if((typeof v!=='number'&&typeof v!=='string')||!String(v).trim()||!Number.isSafeInteger(Number(v))||Number(v)<0)throw Error('艺术家数量无效');return Number(v);}
function identity(v:unknown){const id=text(v);if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw Error('艺术家ID无效');return id;}
function art(v:unknown){try{const u=new URL(text(v).replace('{size}','400').replace(/^\/\//,'https://'));if(u.protocol==='http:')u.protocol='https:';return safePublicURL(u.href)?u.href:undefined;}catch{return undefined;}}
function array(v:unknown,total?:number):unknown[]{if(v===undefined&&total===0)return[];if(!Array.isArray(v)||v.length>20000)throw Error('艺术家目录响应无效');return v;}
function check(page:number,limit:number,signal:AbortSignal){if(signal.aborted)throw Error('已取消');if(!Number.isSafeInteger(page)||page<1||page>10000||!Number.isInteger(limit)||limit<1||limit>100)throw Error('艺术家分页无效');}
export interface ArtistItem extends BrowseItem{songCount?:number;albumCount?:number}
export interface ArtistSearchPage{items:readonly ArtistItem[];page:number;total?:number;hasMore:boolean}
export interface ArtistSongsPage extends PlaylistPage{info?:Partial<ArtistItem>}
export interface ArtistAlbumsPage{items:readonly BrowseItem[];page:number;total?:number;hasMore:boolean}
function artistItem(platform:OnlinePlatform,v:Row):ArtistItem{
 const id=identity(platform==='tx'?v.singerMID:platform==='kw'?v.ARTISTID:platform==='kg'?v.singerid:v.id),title=clean(platform==='tx'?v.singerName:platform==='kw'?v.ARTIST:platform==='kg'?v.singername:v.name);
 if(!title||title.length>1000||/[\u0000-\u001f\u007f]/.test(title))throw Error('艺术家名称无效');
 const artwork=art(platform==='wy'?v.picUrl??v.img1v1Url:platform==='tx'?v.singerPic:platform==='kw'?v.hts_PICPATH:platform==='kg'?v.imgurl:row(Array.isArray(v.singerPicUrl)?v.singerPicUrl[0]:undefined).img),songCount=count(platform==='wy'?v.musicSize:platform==='tx'?v.songNum:platform==='kw'?v.SONGNUM:platform==='kg'?v.songcount:v.songCount),albumCount=count(platform==='wy'?v.albumSize:platform==='tx'?v.albumNum:platform==='kw'?v.ALBUMNUM:platform==='kg'?v.albumcount:v.albumCount),description=clean(v.desc??v.briefDesc??v.profile??v.intro).slice(0,12000);
 return{id,title,...(artwork?{artwork}:{}),...(songCount!==undefined?{songCount}:{}),...(albumCount!==undefined?{albumCount}:{}),...(description?{description}:{})};
}
type Dependencies={http?:HTTPClient;textHTTP?:TextHTTPClient;md5:(v:string)=>Promise<string>;sha1:(v:string)=>Promise<string>;deviceId:()=>string;now?:()=>number};
export class ArtistProvider{
 private readonly deps:Dependencies;
 constructor(deps:Dependencies){this.deps=deps;}
 private http:HTTPClient=(url,request,signal)=>(this.deps.http??requestJSON)(url,{...request,credentials:'omit'},signal);
 private textHTTP:TextHTTPClient=(url,request,signal)=>(this.deps.textHTTP??requestText)(url,{...request,credentials:'omit'},signal);
 private async qq(module:string,method:string,param:Row,signal:AbortSignal){const body=JSON.stringify({comm:{ct:24,cv:0,format:'json',uin:0},req:{module,method,param}}),raw=row(await this.http(queryURL('https://u.y.qq.com/cgi-bin/musics.fcg',{sign:await qqSignature(body,this.deps.sha1)}),{method:'POST',headers:{'Content-Type':'application/json',Referer:'https://y.qq.com/'},body},signal)),r=row(raw.req);if(raw.code!==0||r.code!==0)throw Error('QQ艺术家服务暂不可用');return row(r.data);}
  async search(platform:OnlinePlatform,query:string,page:number,signal:AbortSignal,limit=30):Promise<ArtistSearchPage>{
    check(page,limit,signal);if(!query.trim()||query.length>500)throw Error('搜索参数无效');let values:unknown,total:unknown;
    if(platform==='wy'){
      const raw=row(await this.http('https://music.163.com/api/search/get/web',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Referer:'https://music.163.com/'},body:Object.entries({s:query,type:100,offset:(page-1)*limit,limit}).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&')},signal));if(raw.code!==200)throw Error('艺术家搜索暂不可用');const d=row(raw.result);values=d.artists;total=d.artistCount;
    }else if(platform==='tx'){
      const guid=this.deps.deviceId().replaceAll('-','').toUpperCase();const body=JSON.stringify({comm:{ct:'19',cv:'2151',guid,uin:'0',tmeAppID:'qqmusic',tmeLoginType:0},req:{module:'music.search.SearchCgiService',method:'DoSearchForQQMusicDesktop',param:{grp:1,search_type:1,query,num_per_page:limit,page_num:page,remoteplace:'txt.newclient.top',searchid:guid+'00000'}}});
      const raw=row(await this.http(queryURL('https://u.y.qq.com/cgi-bin/musics.fcg',{sign:await qqSignature(body,this.deps.sha1)}),{method:'POST',headers:{'Content-Type':'application/json',Referer:'https://y.qq.com/','User-Agent':'QQMusic 14090508(android 12)'},body},signal)),r=row(raw.req);if(raw.code!==0||r.code!==0)throw Error('艺术家搜索暂不可用');const d=row(r.data),a=row(row(d.body).singer);values=a.list;total=a.sum??row(d.meta).sum;
    }else if(platform==='kw'){
      const d=row(parseKuwoJSON(await this.textHTTP(queryURL('https://search.kuwo.cn/r.s',{all:query,pn:page-1,rn:limit,ft:'artist',rformat:'json',encoding:'utf8'}),{},signal)));values=d.abslist;total=d.TOTAL;
    }else if(platform==='kg'){
      const raw=row(await this.http(queryURL('https://msearch.kugou.com/api/v3/search/singer',{keyword:query,page,pagesize:limit,showtype:100,filter:0,version:7910,sver:2}),{},signal));if(raw.errcode!==0||raw.status!==1)throw Error('艺术家搜索暂不可用');values=raw.data;total=undefined;
    }else{
      const timestamp=String((this.deps.now??Date.now)()),deviceId=this.deps.deviceId().replaceAll('-','').toUpperCase(),sign=await this.deps.md5(`${query}6cdc72a439cef99a3418d2a78aa28c73yyapp2d16148780a1dcc7408e06336b98cfd50${deviceId}${timestamp}`);
      const raw=row(await this.http(queryURL('https://jadeite.migu.cn/music_search/v3/search/searchAll',{isCorrect:1,isCopyright:1,searchSwitch:JSON.stringify({song:0,album:0,singer:1,tagSong:0,mvSong:0,bestShow:0,songlist:0,lyricSong:0}),pageSize:limit,text:query,pageNo:page,sort:0,sid:'USS'}),{headers:{uiVersion:'A_music_3.6.1',deviceId,timestamp,sign,channel:'0146921','User-Agent':'Mozilla/5.0'}},signal));if(raw.code!=='000000')throw Error('艺术家搜索暂不可用');const d=row(raw.singerResultData);values=d.result;total=d.totalCount;
    }
    if(signal.aborted)throw Error('已取消');const parsedTotal=count(total),rows=array(values,parsedTotal);if(rows.length>1000)throw Error('艺术家搜索响应过大');
    const items=rows.map(value=>artistItem(platform,row(value)));
    // Kugou's v3 singer lookup has no paging envelope. Do not invent a catalog total.
    if(platform==='kg')return{items:page===1?items:[],page,hasMore:false};
    return{items:[...new Map(items.map(v=>[v.id,v])).values()],page,total:parsedTotal,hasMore:rows.length>0&&(parsedTotal!==undefined?page*limit<parsedTotal:rows.length>=limit)};
  }
 async songs(platform:OnlinePlatform,artist:ArtistItem,page:number,signal:AbortSignal,limit=50):Promise<ArtistSongsPage>{
  check(page,limit,signal);const id=identity(artist.id);let values:unknown,total:unknown,details:ArtistItem=artist,scope:'popular'|undefined;
  if(platform==='wy'){const r=row(await this.http(`https://music.163.com/api/artist/${id}`,{},signal));if(r.code!==200)throw Error('艺术家歌曲暂不可读取');details=artistItem(platform,row(r.artist));values=page===1?r.hotSongs:[];total=details.songCount;scope='popular';}
  else if(platform==='tx'){const d=await this.qq('musichall.song_list_server','GetSingerSongList',{singerMid:id,begin:(page-1)*limit,num:limit,order:1},signal);if(text(d.singerMid)!==id)throw Error('艺术家响应身份不符');values=array(d.songList).map(v=>row(v).songInfo);total=d.totalNum;}
  else if(platform==='kw'){const d=row(parseKuwoJSON(await this.textHTTP(queryURL('https://search.kuwo.cn/r.s',{stype:'artist2music',artistid:id,pn:page-1,rn:limit,encoding:'utf8'}),{},signal)));values=d.musiclist;total=d.total;}
  else if(platform==='kg'){const r=row(await this.http(queryURL('https://mobiles.kugou.com/api/v5/singer/song',{singerid:id,page,pagesize:limit}),{},signal));if(r.status!==1||r.errcode!==0)throw Error('艺术家歌曲暂不可读取');const d=row(r.data);values=d.info;total=d.total;if(page===1){try{const profile=row(await this.http(queryURL('https://mobiles.kugou.com/api/v5/singer/info',{singerid:id}),{},signal));if(profile.status===1&&profile.errcode===0&&text(row(profile.data).singerid)===id)details=artistItem(platform,row(profile.data));}catch{if(signal.aborted)throw Error('已取消');}}}
  else{const r=row(await this.http(queryURL('https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/querySingerSong',{singerId:id,pageNo:page,pageSize:limit}),{},signal));if(r.code!=='000000')throw Error('此平台艺术家歌曲暂不可读取');const d=row(r.data);values=d.songList;total=d.totalCount;}
  if(signal.aborted)throw Error('已取消');const parsedTotal=count(total),rows=array(values,parsedTotal);const items=rows.map(v=>{const x=row(v);if(platform==='kg'){const f=text(x.filename),i=f.indexOf(' - ');return onlineTrack(platform,{...x,FileHash:x.hash,SongName:i<0?f:f.slice(i+3),SingerName:i<0?artist.title:f.slice(0,i),AlbumName:x.album_name,Duration:x.duration,FileSize:x.filesize,HQFileHash:x['320hash'],HQFileSize:x['320filesize'],SQFileHash:x.sqhash,SQFileSize:x.sqfilesize});}if(platform==='wy')return onlineTrack(platform,{...x,h:x.h??x.hMusic,m:x.m??x.mMusic,l:x.l??x.lMusic});if(platform==='kw')return onlineTrack(platform,{...x,name:clean(x.name),artist:clean(x.artist),rid:x.MUSICRID??x.musicrid??x.rid??x.id,pic:x.pic??art(x.img),FORMATS:x.formats});return onlineTrack(platform,x);});
  return{title:details.title,items,page,total:parsedTotal,scope,info:platform==='wy'||(platform==='kg'&&details!==artist)?details:{...(parsedTotal!==undefined?{songCount:parsedTotal}:{})},hasMore:scope?false:rows.length>0&&(parsedTotal!==undefined?page*limit<parsedTotal:rows.length>=limit)};
 }
 async albums(platform:OnlinePlatform,artist:ArtistItem,page:number,signal:AbortSignal,limit=30):Promise<ArtistAlbumsPage>{
  check(page,limit,signal);const id=identity(artist.id);let values:unknown,total:unknown,more:unknown;
  if(platform==='wy'){const r=row(await this.http(queryURL(`https://music.163.com/api/artist/albums/${id}`,{offset:(page-1)*limit,limit}),{},signal));if(r.code!==200)throw Error('艺术家专辑暂不可读取');values=r.hotAlbums;total=row(r.artist).albumSize;more=r.more;}
  else if(platform==='tx'){const r=row(await this.http(queryURL('https://c.y.qq.com/v8/fcg-bin/fcg_v8_singer_album.fcg',{singermid:id,order:'time',begin:(page-1)*limit,num:limit,format:'json'}),{headers:{Referer:'https://y.qq.com/'}},signal));if(r.code!==0)throw Error('艺术家专辑暂不可读取');const d=row(r.data);if(d.singer_mid!==undefined&&text(d.singer_mid)!==id)throw Error('艺术家响应身份不符');values=d.list;total=d.total;}
  else if(platform==='kw'){const d=row(parseKuwoJSON(await this.textHTTP(queryURL('https://search.kuwo.cn/r.s',{stype:'albumlist',artistid:id,pn:page-1,rn:limit,encoding:'utf8'}),{},signal)));values=d.albumlist;total=d.total;}
  else if(platform==='kg'){const r=row(await this.http(queryURL('https://mobiles.kugou.com/api/v5/singer/album',{singerid:id,page,pagesize:limit}),{},signal));if(r.status!==1||r.errcode!==0)throw Error('艺术家专辑暂不可读取');const d=row(r.data);values=d.info;total=d.total;}
  else{const r=row(await this.http(queryURL('https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/querySingerAlbum',{singerId:id,pageNo:page,pageSize:limit}),{},signal));if(r.code!=='000000')throw Error('此平台艺术家专辑暂不可读取');const d=row(r.data);values=d.albumList;total=d.totalCount;}
  if(signal.aborted)throw Error('已取消');const parsedTotal=count(total),rows=array(values,parsedTotal);const items=rows.map(value=>{const v=row(value),albumId=identity(platform==='tx'?v.albumMID:platform==='kw'||platform==='kg'?v.albumid:v.id),title=clean(platform==='tx'?v.albumName:platform==='kg'?v.albumname:v.name);if(!title||title.length>1000)throw Error('艺术家专辑信息无效');const artwork=art(platform==='wy'?v.picUrl:platform==='tx'?`https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumId}.jpg`:platform==='kw'?v.hts_img??v.img:platform==='kg'?v.imgurl:row(Array.isArray(v.imgItems)?v.imgItems[0]:undefined).img);return{id:albumId,title,author:clean(platform==='tx'?v.singerName:platform==='kw'?v.artist:platform==='kg'?v.singername:platform==='wy'&&Array.isArray(v.artists)?v.artists.map(a=>clean(row(a).name)).filter(Boolean).join(' / '):artist.title),...(artwork?{artwork}:{})};});
  return{items,page,total:parsedTotal,hasMore:rows.length>0&&(typeof more==='boolean'?more:parsedTotal!==undefined?page*limit<parsedTotal:rows.length>=limit)};
 }
}
