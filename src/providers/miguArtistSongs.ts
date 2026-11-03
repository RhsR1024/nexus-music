import type {Track} from '../domain/track.ts';
import {onlineTrack} from './online.ts';
import {queryURL,type HTTPClient} from './http.ts';
import {safePublicURL} from '../storage/cleanTrack.ts';

type Row=Record<string,unknown>;
const row=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const invalid=()=>new Error('咪咕艺术家歌曲响应无效，请重试');
const upstreamSize=50;

/** The public PC catalog ignores pageSize. Re-page its fixed 50-song pages
 * without following the legacy HTTP nextPageUrl or issuing media requests. */
export async function miguArtistSongs(http:HTTPClient,id:string,page:number,limit:number,signal:AbortSignal):Promise<{items:readonly Track[];hasMore:boolean;total?:number}>{
  const offset=(page-1)*limit,first=Math.floor(offset/upstreamSize)+1,last=Math.floor((offset+limit-1)/upstreamSize)+1;
  const collected:Track[]=[];let more=false,total:number|undefined,previous='';
  for(let current=first;current<=last;current++){
    if(signal.aborted)throw Error('已取消');
    const raw=row(await http(queryURL('https://app.u.nf.migu.cn/pc/bmw/singer/song/v1.0',{pageNo:current,singerId:id,type:1}),{credentials:'omit'},signal));
    if(signal.aborted)throw Error('已取消');
    if(raw.code!=='000000')throw Error('咪咕艺术家歌曲暂不可读取');
    const data=row(raw.data),header=row(data.header);
    if(!Array.isArray(data.contents)||data.contents.length>10||!Object.keys(header).length)throw invalid();
    const groups=data.contents.map(row).filter(value=>value.view==='ZJ-Singer-Song-Scroll');
    // Empty contents is the actual response after the terminal page. Other
    // nonempty layouts must never silently turn into an empty artist catalog.
    if(groups.length>1||(!groups.length&&data.contents.length))throw invalid();
    const values=groups.length?groups[0]!.contents:[];
    if(!Array.isArray(values)||values.length>upstreamSize)throw invalid();
    const items=values.map(value=>{
      const entry=row(value),song=row(entry.songItem);
      if(entry.view!=='ZJ-Singer-Song-Item'||!Array.isArray(song.singerList)||!song.singerList.some(singer=>row(singer).id===id))throw invalid();
      const track=onlineTrack('mg',song),image=track.artwork;
      const artwork=image?.startsWith('/')&&!image.startsWith('//')?`https://d.musicapp.migu.cn${image}`:image;
      return {...track,artwork:artwork&&safePublicURL(artwork)?artwork:undefined};
    });
    more=false;
    if(header.nextPageUrl!==undefined&&header.nextPageUrl!==''){
      if(typeof header.nextPageUrl!=='string')throw invalid();
      let next:URL;try{next=new URL(header.nextPageUrl);}catch{throw invalid();}
      if(!['http:','https:'].includes(next.protocol)||next.hostname!=='app.c.nf.migu.cn'||next.port||next.username||next.password||next.hash||next.pathname!=='/MIGUM3.0/bmw/singer/song/v1.0'||next.searchParams.get('singerId')!==id||next.searchParams.get('pageNo')!==String(current+1)||next.searchParams.get('type')!=='1'||items.length!==upstreamSize)throw invalid();
      more=true;
    }
    const signature=items.map(track=>track.origin.id).join('|');
    if(current>first&&signature&&signature===previous)throw invalid();previous=signature;
    collected.push(...items);
    if(!more){if(items.length)total=(current-1)*upstreamSize+items.length;break;}
  }
  const start=offset%upstreamSize;
  return{items:collected.slice(start,start+limit),hasMore:collected.length>start+limit||more,...(total!==undefined?{total}:{})};
}
