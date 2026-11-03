import type {BrowseItem} from './discovery.ts';
import type {Track} from '../domain/track.ts';
import {onlineTrack} from './online.ts';
import {queryURL,type HTTPClient} from './http.ts';
import {safePublicURL} from '../storage/cleanTrack.ts';

type Row=Record<string,unknown>;
const row=(v:unknown):Row=>v&&typeof v==='object'&&!Array.isArray(v)?v as Row:{};
const text=(v:unknown)=>typeof v==='string'?v:typeof v==='number'&&Number.isSafeInteger(v)?String(v):'';
const clean=(v:unknown)=>text(v).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').trim();
const invalid=()=>new Error('咪咕专辑响应身份、数量或格式无效，请重试');
const digitalPrefix='migu-digital-';
function id(v:unknown){const value=text(v);if(!/^\d{1,100}$/.test(value))throw invalid();return value;}
function size(v:unknown){if(!['string','number'].includes(typeof v)||!String(v).trim()||!Number.isSafeInteger(Number(v))||Number(v)<0||Number(v)>20000)throw invalid();return Number(v);}
function title(v:unknown){const value=clean(v);if(!value||value.length>1000||/[\u0000-\u001f\u007f]/.test(value))throw invalid();return value;}
function image(v:unknown){const value=text(v),url=value.startsWith('/')&&!value.startsWith('//')?`https://d.musicapp.migu.cn${value}`:value;return url&&safePublicURL(url)?url:undefined;}
function list(v:unknown,max=20000):unknown[]{if(!Array.isArray(v)||v.length>max)throw invalid();return v;}
async function read(http:HTTPClient,url:string,signal:AbortSignal){
  if(signal.aborted)throw Error('已取消');const raw=row(await http(url,{credentials:'omit'},signal));if(signal.aborted)throw Error('已取消');if(raw.code!=='000000')throw Error('咪咕专辑暂不可公开读取');return raw;
}
/** Digital and ordinary albums inhabit different public resource namespaces.
 * The internal prefix survives existing catalog favorites/backup/sync intact. */
export function miguAlbumIdentity(value:string){
  const digital=value.startsWith(digitalPrefix);return{digital,id:id(digital?value.slice(digitalPrefix.length):value)};
}
export function miguAlbumCatalogId(value:unknown,resourceType:unknown){
  const raw=id(value);if(resourceType==='5')return digitalPrefix+raw;if(resourceType===undefined||resourceType==='2003')return raw;throw invalid();
}
export async function miguArtistAlbums(http:HTTPClient,artistId:string,page:number,limit:number,signal:AbortSignal):Promise<{items:readonly BrowseItem[];hasMore:boolean;total?:number}>{
  const upstreamSize=10,offset=(page-1)*limit,first=Math.floor(offset/upstreamSize)+1,last=Math.floor((offset+limit-1)/upstreamSize)+1;
  const collected:BrowseItem[]=[];let more=false,total:number|undefined,previous='';
  for(let current=first;current<=last;current++){
    const raw=await read(http,queryURL('https://app.u.nf.migu.cn/pc/bmw/singer/album/v1.0',{pageNo:current,singerId:artistId}),signal),data=row(raw.data),header=row(data.header);
    if(!Object.keys(header).length)throw invalid();
    const items=list(data.contents,upstreamSize).map(value=>{
      const v=row(value),resourceId=id(v.resId);if(v.view!=='ZJ-Album-Item'||!['0','1'].includes(text(v.resType)))throw invalid();
      const digital=text(v.resType)==='1';let action:URL;try{action=new URL(text(v.action));}catch{throw invalid();}
      if(action.protocol!=='mgmusic:'||action.username||action.password||action.port||action.hash||action.pathname||action.hostname!==(digital?'digital-album-info':'album-info')||action.searchParams.get('id')!==resourceId)throw invalid();
      const artwork=image(v.img),author=clean(v.txt2).slice(0,1000),released=calendar(v.txt3);
      return{id:digital?digitalPrefix+resourceId:resourceId,title:title(v.txt),...(digital?{description:'数字专辑'}:{}),...(artwork?{artwork}:{}),...(author?{author}:{}),...(released?{released}:{})};
    });
    more=false;
    if(header.nextPageUrl!==undefined&&header.nextPageUrl!==''){
      let next:URL;try{next=new URL(text(header.nextPageUrl));}catch{throw invalid();}
      if(!['http:','https:'].includes(next.protocol)||next.hostname!=='app.c.nf.migu.cn'||next.port||next.username||next.password||next.hash||next.pathname!=='/MIGUM3.0/bmw/singer/album/v1.0'||next.searchParams.get('singerId')!==artistId||next.searchParams.get('pageNo')!==String(current+1)||items.length!==upstreamSize)throw invalid();more=true;
    }
    const signature=items.map(v=>v.id).join('|');if(current>first&&signature&&signature===previous)throw invalid();previous=signature;
    collected.push(...items);if(!more){if(items.length)total=(current-1)*upstreamSize+items.length;break;}
  }
  const start=offset%upstreamSize;return{items:collected.slice(start,start+limit),hasMore:collected.length>start+limit||more,...(total!==undefined?{total}:{})};
}
function calendar(value:unknown){const date=text(value).slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return undefined;const time=Date.parse(date+'T00:00:00Z');return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===date?date:undefined;}
function metadata(data:Row,digital:boolean):Partial<BrowseItem>{
  const images=digital?data.imgItem:data.imgItems,artwork=image(row(images===undefined?undefined:list(images,20)[0]).img),author=clean(data.singer).slice(0,1000),released=calendar(data.publishDate??data.publishTime),description=clean(data.summary??data.intro).slice(0,12000);
  return{title:title(data.title),...(artwork?{artwork}:{}),...(author?{author}:{}),...(released?{released}:{}),...(description?{description}:{})};
}
function digitalDuration(value:unknown){
  if(value===undefined||value==='')return undefined;const match=/^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(text(value));if(!match)throw invalid();const seconds=Number(match[1])*3600+Number(match[2])*60+Number(match[3]);if(seconds>86400)throw invalid();return seconds;
}
function track(value:unknown,albumId:string,digital:boolean):Track{
  const song=row(value);
  if(digital?id(song.dalbumId)!==albumId:id(song.albumId)!==albumId)throw invalid();
  const artwork=image(song.img3??row(Array.isArray(song.albumImgs)?song.albumImgs[0]:undefined).img),duration=digital?digitalDuration(song.length):song.duration;
  const result=onlineTrack('mg',{...song,...(duration!==undefined?{duration}:{}),...(artwork?{img3:artwork}:{img3:undefined})});
  return{...result,artwork};
}
type Snapshot={title:string;items:readonly Track[];total:number;info:Partial<BrowseItem>;scope?:'public'};
async function digitalSnapshot(http:HTTPClient,resourceId:string,signal:AbortSignal):Promise<Snapshot>{
  const raw=await read(http,queryURL('https://c.musicapp.migu.cn/v1.0/content/resourceinfo.do',{resourceId,resourceType:5,needSimple:'01'}),signal),resources=list(raw.resource,1);if(resources.length!==1)throw invalid();
  const data=row(resources[0]);if(data.resourceType!=='5'||id(data.contentId)!==resourceId)throw invalid();const total=size(data.totalCount),songs=list(data.songItems);if(songs.length!==total)throw Error('咪咕数字专辑公开曲目不完整，请到官方平台核对');
  const info=metadata(data,true);return{title:info.title!,total,items:songs.map(v=>track(v,resourceId,true)),info,scope:'public'};
}
export async function miguAlbumSnapshot(http:HTTPClient,album:BrowseItem,signal:AbortSignal):Promise<Snapshot>{
  const identity=miguAlbumIdentity(album.id);
  if(identity.digital)return digitalSnapshot(http,identity.id,signal);
  const raw=await read(http,queryURL('https://c.musicapp.migu.cn/resource/album/v2.0',{albumId:identity.id}),signal),data=row(raw.data);
  // Older saved/search IDs omitted the resource namespace. The normal lookup
  // explicitly omits data for a digital ID. Resolve that miss through the
  // public typed resource endpoint, requiring its full identity and contents;
  // never guess from ID length, names, network errors or a foreign response.
  if(raw.data===undefined)return digitalSnapshot(http,identity.id,signal);
  if(data.resourceType!=='2003'||id(data.albumId)!==identity.id)throw invalid();
  const total=size(data.totalCount),info=metadata(data,false),items:Track[]=[];let previous='';
  for(let page=1;page<=200;page++){
    const response=await read(http,queryURL('https://app.c.nf.migu.cn/MIGUM3.0/resource/album/song/v2.0',{albumId:identity.id,pageNo:page,pageSize:200}),signal),d=row(response.data),songs=list(d.songList);
    if(size(d.totalCount)!==total||typeof d.hasNext!=='boolean'||items.length+songs.length>total)throw invalid();
    const next=songs.map(v=>track(v,identity.id,false)),signature=next.map(v=>v.origin.id).join('|');
    if(page>1&&signature===previous)throw invalid();previous=signature;items.push(...next);
    if(!d.hasNext){if(items.length!==total)throw Error('咪咕专辑公开曲目不完整，请重试');return{title:info.title!,items,total,info};}
    if(!songs.length||items.length>=total)throw invalid();
  }
  throw Error('咪咕专辑分页超过限制');
}
