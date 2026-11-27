import type {OnlinePlatform,Track} from '../domain/track.ts';
import {onlineTrack} from './online.ts';
import {enrichKugouTrackArtworks} from './kugouTrackDetails.ts';
import {DESKTOP_UA} from './neteaseSession.ts';
import {weapiPayload} from './neteaseCrypto.ts';
import {parseProviderJSON,queryURL,requestJSON,requestText,type TextHTTPClient,type HTTPClient} from './http.ts';
import {throwIfAborted} from './async.ts';
import {qqSignature} from './qqSignature.ts';
import type {VideoItem} from './videos.ts';
import {
  mergeStyleRecommendations,
  normalizeStyleSelection,
  type StyleRecommendationResult,
  type StyleTag,
  type StyleTagPlaylists,
} from '../domain/styleRecommendation.ts';
type Row=Record<string,unknown>;
const row=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const list=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const text=(value:unknown)=>typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
const count=(value:unknown)=>value!==undefined&&value!==null&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):undefined;
export interface BrowseItem {id:string;title:string;artwork?:string;description?:string;count?:number;author?:string;released?:string;playCount?:number}
export interface NeteaseBanner {id:string;imageUrl:string;typeTitle:string;titleColor:string;targetType:number;targetId:string;url?:string;song?:Track}
export interface BrowsePage {items:readonly BrowseItem[];hasMore:boolean;page:number}
export interface PlaylistPage {title:string;items:readonly Track[];total?:number;hasMore:boolean;page:number;info?:Partial<BrowseItem>;scope?:'popular'|'public'}
export interface BrowseCategory {id:string;title:string;group?:string}
export interface OfficialToplistPreview {id:string;title:string;artwork?:string;updateFrequency?:string;tracks:readonly {first:string;second:string}[]}
export interface FeaturedSongShelf {title:string;tracks:readonly Track[]}
export interface FeaturedHomeData {
  recommendedPlaylists:readonly BrowseItem[];
  curatedSongs?:FeaturedSongShelf;
  newSongAlbumTracks:readonly Track[];
  newSongAlbumCards:readonly BrowseItem[];
  radarPlaylists:readonly BrowseItem[];
  scenePlaylists:readonly BrowseItem[];
  videoPlaylists:readonly BrowseItem[];
  highQualityPlaylists:readonly BrowseItem[];
  newExpressSongs:readonly Track[];
  newAlbums:readonly BrowseItem[];
  popularArtists:readonly {id:string;title:string;artwork?:string}[];
  officialToplists:readonly OfficialToplistPreview[];
  newSongChartTitle?:string;
  newSongChartTracks:readonly Track[];
  categories:readonly BrowseCategory[];
  latestMVs:readonly VideoItem[];
  topMVs:readonly VideoItem[];
}
export interface FeaturedHomeHelpers {
  latestMVs?:(signal:AbortSignal)=>Promise<readonly VideoItem[]>;
  topMVs?:(signal:AbortSignal)=>Promise<readonly VideoItem[]>;
  newAlbums?:(signal:AbortSignal)=>Promise<readonly BrowseItem[]>;
  popularArtists?:(signal:AbortSignal)=>Promise<readonly {id:string;title:string;artwork?:string}[]>;
}
function required(value:unknown){const id=text(value);if(!id)throw new Error('平台响应缺少有效ID');return id;}
function tree(value:unknown,depth=0):Row[]{if(depth>12)return[];if(Array.isArray(value))return value.slice(0,2000).flatMap(item=>tree(item,depth+1));const object=row(value);return Object.keys(object).length?[object,...Object.values(object).filter(item=>item&&typeof item==='object').flatMap(item=>tree(item,depth+1))]:[];}
function unique(items:BrowseItem[]){
  const byId=new Map<string,BrowseItem>();
  for(const entry of items){
    const prev=byId.get(entry.id);
    if(!prev){byId.set(entry.id,entry);continue;}
    // Prefer whichever duplicate carries artwork/description/count so bare logEvent nodes never erase covers.
    byId.set(entry.id,{
      ...prev,
      title:prev.title||entry.title,
      ...(prev.artwork||entry.artwork?{artwork:prev.artwork||entry.artwork}:{}),
      ...(prev.description||entry.description?{description:prev.description||entry.description}:{}),
      ...(prev.count!==undefined?{count:prev.count}:entry.count!==undefined?{count:entry.count}:{}),
    });
  }
  return [...byId.values()];
}
function item(id:unknown,title:unknown,artwork?:unknown,description?:unknown,total?:unknown):BrowseItem {const name=text(title);if(!name)throw new Error('平台响应缺少名称');return{id:required(id),title:name,...(text(artwork)?{artwork:text(artwork)}:{}),...(text(description)?{description:text(description)}:{}),...(count(total)!==undefined?{count:count(total)}:{})};}
function bannerTarget(targetTypeRaw:unknown,targetIdRaw:unknown,rawUrl:string):{targetType:number;targetId:string;url?:string}{
  const rawType=Number.isFinite(Number(targetTypeRaw))?Number(targetTypeRaw):0;
  const rawId=text(targetIdRaw).trim();
  const numeric=(v:string)=>/^\d+$/.test(v)?v:'';
  const orpheus=rawUrl.match(/^orpheus:\/\/(song|album|playlist)\/(\d+)/i);
  if(orpheus&&orpheus[1]&&orpheus[2]){
    const kind=orpheus[1].toLowerCase();
    return{targetType:kind==='song'?1:kind==='album'?10:1000,targetId:orpheus[2]};
  }
  if(rawUrl){
    try{
      const parsed=new URL(rawUrl);
      if((parsed.protocol==='https:'||parsed.protocol==='http:')&&!parsed.username&&!parsed.password){
        const host=parsed.hostname.toLowerCase();
        if(host==='music.163.com'||host==='y.music.163.com'||host==='st.music.163.com'){
          const route=`${parsed.pathname}${parsed.hash}`;
          const pathMatch=route.match(/\/(song|album|playlist)(?:\/(\d+))?/i);
          const idParam=numeric(parsed.searchParams.get('id')??'');
          const hashQuery=parsed.hash.includes('?')?new URLSearchParams(parsed.hash.slice(parsed.hash.indexOf('?')+1)).get('id')??'':'';
          const resolvedId=numeric(pathMatch?.[2]??'')||idParam||numeric(hashQuery);
          if(pathMatch&&pathMatch[1]&&resolvedId){
            const kind=pathMatch[1].toLowerCase();
            return{targetType:kind==='song'?1:kind==='album'?10:1000,targetId:resolvedId};
          }
        }
        if(parsed.protocol==='https:')return{targetType:rawType,targetId:rawId,url:parsed.toString()};
      }
    }catch{}
  }
  return{targetType:rawType,targetId:rawId};
}
export class DiscoveryProvider {
  private http:HTTPClient;private textHTTP:TextHTTPClient;private sha1:(value:string)=>Promise<string>;
  constructor(sha1:(value:string)=>Promise<string>,http:HTTPClient=requestJSON,textHTTP:TextHTTPClient=requestText){this.sha1=sha1;this.http=http;this.textHTTP=textHTTP;}
  private async qq(module:string,method:string,param:Row,signal:AbortSignal){
    const body=JSON.stringify({comm:{ct:24,cv:0,format:'json',uin:0},req:{module,method,param}});
    const raw=row(await this.http(queryURL('https://u.y.qq.com/cgi-bin/musics.fcg',{sign:await qqSignature(body,this.sha1)}),{method:'POST',headers:{'Content-Type':'application/json',Referer:'https://y.qq.com/'},body},signal));
    const response=row(raw.req);if(raw.code!==0||response.code!==0)throw new Error('QQ服务暂时不可用');return row(response.data);
  }
  async neteaseSongs(ids:readonly string[],signal:AbortSignal):Promise<Map<string,Track>>{
    const clean=[...new Set(ids.filter(id=>/^\d+$/.test(id)))].slice(0,20);
    const resolved=new Map<string,Track>();
    if(!clean.length)return resolved;
    const raw=row(await this.http('https://music.163.com/api/v3/song/detail',{
      method:'POST',
      credentials:'omit',
      headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':DESKTOP_UA,Referer:'https://music.163.com/',Origin:'https://music.163.com'},
      body:`c=${encodeURIComponent(JSON.stringify(clean.map(id=>({id}))))}&ids=${encodeURIComponent(JSON.stringify(clean))}`,
    },signal));
    for(const entry of list(raw.songs)){
      try{const track=onlineTrack('wy',entry);resolved.set(track.origin.id,track);}catch{}
    }
    return resolved;
  }
  async banners(platform:OnlinePlatform,signal:AbortSignal):Promise<readonly NeteaseBanner[]>{
    if(platform!=='wy')return [];
    // Align with Sollin's NetEase discover banners (clientType=pc returns single-song, album, playlist, and activity banners).
    const raw=row(await this.http('https://music.163.com/api/v2/banner/get?clientType=pc',{credentials:'omit',headers:{'User-Agent':DESKTOP_UA,Referer:'https://music.163.com/'}},signal));
    if(raw.code!==200||!Array.isArray(raw.banners))throw new Error('轮播图响应无效');
    const parsed:NeteaseBanner[]=[];
    for(const entry of list(raw.banners).slice(0,12)){
      const v=row(entry),pic=text(v.pic??v.imageUrl).trim();
      if(!pic)continue;
      let imageUrl='';
      try{
        const u=new URL(pic);
        if(!['http:','https:'].includes(u.protocol)||u.username||u.password)continue;
        if(u.protocol==='http:'&&/\.music\.126\.net$/i.test(u.hostname))u.protocol='https:';
        imageUrl=u.toString();
      }catch{continue;}
      const id=text(v.bannerId??v.encodeId)||`${parsed.length}`;
      const target=bannerTarget(v.targetType,v.targetId??v.encodeId,text(v.url).trim());
      let song:Track|undefined;
      if(v.song&&typeof v.song==='object'){try{song=onlineTrack('wy',v.song);}catch{}}
      parsed.push({id,imageUrl,typeTitle:text(v.typeTitle),titleColor:text(v.titleColor)||'red',targetType:target.targetType,targetId:target.targetId,...(target.url?{url:target.url}:{}),...(song?{song}:{})});
    }
    const missingSongIds=parsed.filter(b=>b.targetType===1&&!b.song&&/^\d+$/.test(b.targetId)).map(b=>b.targetId);
    if(missingSongIds.length){
      try{
        const songs=await this.neteaseSongs(missingSongIds,signal);
        return parsed.map(banner=>{
          if(banner.targetType!==1||banner.song)return banner;
          const hit=songs.get(banner.targetId);
          return hit?{...banner,song:hit}:banner;
        });
      }catch{}
    }
    return parsed;
  }
  async categories(platform:OnlinePlatform,signal:AbortSignal):Promise<readonly BrowseCategory[]>{
    if(platform==='wy'){const raw=row(await this.http('https://music.163.com/api/playlist/catalogue',{},signal));if(raw.code!==200||!Array.isArray(raw.sub))throw new Error('分类响应无效');return list(raw.sub).map(value=>{const v=row(value);return{id:required(v.name),title:text(v.name),group:text(row(raw.categories)[text(v.category)])};});}
    if(platform==='tx'){const data=await this.qq('playlist.PlaylistAllCategoriesServer','get_all_categories',{qq:''},signal);return list(data.v_group).flatMap(group=>list(row(group).v_item).map(value=>({id:required(row(value).id),title:text(row(value).name),group:text(row(group).group_name)})));}
    if(platform==='kw'){const raw=await this.http('https://wapi.kuwo.cn/api/pc/classify/playlist/getTagList?cmd=rcm_keyword_playlist&user=0&prod=kwplayer_pc_9.0.5.0',{},signal);const items=tree(raw).filter(value=>value.id&&value.name&&['43','10000'].includes(text(value.digest)));if(!items.length)throw new Error('分类响应无效');return items.map(value=>({id:`${required(value.id)}-${text(value.digest)}`,title:text(value.name)}));}
    if(platform==='mg'){const raw=await this.http('https://app.c.nf.migu.cn/pc/v1.0/template/musiclistplaza-taglist/release',{},signal);const items=tree(raw).filter(value=>Array.isArray(value.texts)&&list(value.texts).length>=2);if(!items.length)throw new Error('分类暂不可用');return items.map(value=>({id:required(list(value.texts)[1]),title:text(list(value.texts)[0])}));}
    const raw=row(await this.http('http://www2.kugou.kugou.com/yueku/v9/special/getSpecial?is_smarty=1&',{},signal));
    if(raw.status!==1||!Object.keys(row(row(raw.data).tagids)).length)throw new Error('酷狗分类响应无效');
    return Object.entries(row(row(raw.data).tagids)).flatMap(([group,value])=>list(row(value).data).map(item=>({id:required(row(item).id),title:text(row(item).name),group})));
  }
  async playlists(platform:OnlinePlatform,page:number,category:string|undefined,signal:AbortSignal,limit=30):Promise<BrowsePage>{
    if(!Number.isInteger(page)||page<1||!Number.isInteger(limit)||limit<1||limit>100)throw new Error('分页参数无效');
    let items:BrowseItem[]=[],hasMore=false;
    if(platform==='wy'){
      const raw=row(await this.http(queryURL('https://music.163.com/api/playlist/list',{cat:category??'全部',order:'hot',limit,offset:(page-1)*limit}),{},signal));
      if(raw.code!==200||!Array.isArray(raw.playlists))throw new Error('网易歌单服务暂时不可用');
      items=list(raw.playlists).map(value=>{const v=row(value);return item(v.id,v.name,v.coverImgUrl,v.description,v.trackCount);});hasMore=raw.more===true;
    }else if(platform==='tx'){
      const data=category?await this.qq('playlist.PlayListCategoryServer','get_category_content',{titleid:Number(category),caller:'0',category_id:Number(category),size:limit,page:page-1,use_page:1},signal):await this.qq('music.playlist.PlaylistSquare','GetRecommendWhole',{IsReqFeed:true,FeedReq:{From:(page-1)*limit,Size:limit}},signal);
      const rows=category?row(data.content).v_item:list(row(data.FeedRsp).List).map(value=>row(value).Playlist);if(!Array.isArray(rows))throw new Error('QQ歌单响应无效');
      items=list(rows).map(value=>{const v=row(value),basic=row(v.basic),cover=row(basic.cover);return item(v.tid??v.dissid??basic.tid,v.title??v.dissname??basic.title,v.cover_url_big??v.cover_url_medium??v.cover_url_small??v.imgurl??cover.big_url??cover.medium_url??cover.default_url??cover.small_url,v.desc);});hasMore=items.length>=limit;
    }else if(platform==='kw'){
      const tag=category?.match(/^(\d+)-(43|10000)$/);
      if(category&&!tag)throw new Error('酷我分类无效');
      if(tag?.[2]==='43'){
        const raw=await this.http(queryURL('https://mobileinterfaces.kuwo.cn/er.s',{type:'get_pc_qz_data',f:'web',id:tag[1],prod:'pc'}),{},signal);
        if(!Array.isArray(raw))throw new Error('酷我专区响应无效');
        // Zones mix albums, artists and playlists. Only list/songlist entries
        // have the playlist detail contract implemented by this provider.
        const values=unique(tree(raw).filter(v=>['songlist','list'].includes(text(v.type))&&['5','8'].includes(text(v.digest))).map(v=>item(v.id,v.name,v.img,v.desc,v.total)));
        return{items:values.slice((page-1)*limit,page*limit),hasMore:page*limit<values.length,page};
      }
      const url=category?'https://wapi.kuwo.cn/api/pc/classify/playlist/getTagPlayList':'https://wapi.kuwo.cn/api/pc/classify/playlist/getRcmPlayList';
      const raw=row(await this.http(queryURL(url,{loginUid:0,loginSid:0,appUid:76039576,pn:page,rn:limit,order:'hot',...(tag?{id:tag[1]}:{})}),{},signal)),data=row(raw.data);
      if(!Array.isArray(data.data))throw new Error('酷我歌单服务暂时不可用');items=list(data.data).map(value=>{const v=row(value);return item(v.id,v.name,v.img,v.desc,v.total);});hasMore=count(data.total)!==undefined?page*limit<Number(data.total):items.length>=limit;
    }else if(platform==='kg'){
      if(category){const raw=row(await this.http(queryURL('http://www2.kugou.kugou.com/yueku/v9/special/getSpecial',{is_ajax:1,cdn:'cdn',t:5,c:category,p:page}),{},signal));if(raw.status!==1||!Array.isArray(raw.special_db))throw new Error('酷狗分类歌单响应无效');
        const values=list(raw.special_db).map(value=>{const v=row(value);return item(v.specialid,v.specialname,v.img,v.intro,v.song_count);});return{items:values,hasMore:values.length>=20,page};}
      const raw=row(await this.http(queryURL('https://m.kugou.com/plist/index',{json:true,page}),{},signal)),data=row(raw.plist);
      const values=row(data.list).info;if(!Array.isArray(values))throw new Error('酷狗歌单响应无效');items=list(values).map(value=>{const v=row(value);return item(v.specialid,v.specialname,text(v.imgurl).replace('{size}','400'),v.intro,v.songcount);});hasMore=count(row(data.list).total)!==undefined?page*Number(raw.pagesize??30)<Number(row(data.list).total):items.length>=30;
    }else{
      const url=category?queryURL('https://app.c.nf.migu.cn/pc/v1.0/template/musiclistplaza-listbytag/release',{pageNumber:page,templateVersion:2,tagId:category}):queryURL('https://app.c.nf.migu.cn/pc/bmw/page-data/playlist-square-recommend/v1.0',{templateVersion:2,pageNo:page});
      const raw=row(await this.http(url,{},signal));if(raw.code!=='000000')throw new Error('咪咕歌单服务暂时不可用');
      items=unique(tree(raw.data).flatMap(v=>{
        const event=row(v.logEvent);
        const art=v.img??v.imageUrl??v.picUrl??v.imgUrl;
        if((v.resType==='2021'||event.contentType==='2021'||event.resourceType==='2021')&&(v.resId||event.contentId||event.resourceId)&&(v.txt||v.title||event.contentName)){
          return[item(v.resId??event.contentId??event.resourceId,v.txt??v.title??event.contentName,art,v.txt2??v.subTitle)];
        }
        if(v.resourceType==='2021'&&v.resourceId&&v.contentName)return[item(v.resourceId,v.contentName,art)];
        return[];
      }));
      const next=count(row(row(raw.data).header).nextPageNo),nextURL=text(row(raw.data).nextPageUrl);
      hasMore=next!==undefined?next>page:!!nextURL&&Number(nextURL.match(/[?&]pageNumber=(\d+)/)?.[1]??0)>page;
    }
    return{items,hasMore,page};
  }
  async styleRecommendations(platform:OnlinePlatform,tags:readonly StyleTag[],signal:AbortSignal,perTagLimit=20):Promise<StyleRecommendationResult>{
    const selected=normalizeStyleSelection(tags);
    throwIfAborted(signal);
    const results=await Promise.all(selected.map(async tag=>{
      try{
        const page=await this.playlists(platform,1,tag.id,signal,perTagLimit);
        throwIfAborted(signal);
        return{tag,items:page.items};
      }catch(error){
        if(signal.aborted)throw error;
        return{tag,error};
      }
    }));
    throwIfAborted(signal);
    const successes=results.flatMap(result=>'items'in result?[{tag:result.tag,items:result.items}as StyleTagPlaylists]:[]);
    return{
      items:mergeStyleRecommendations(platform,successes),
      failedTags:results.flatMap(result=>result.error?[result.tag]:[]),
    };
  }
  async rankings(platform:OnlinePlatform,signal:AbortSignal):Promise<readonly BrowseItem[]>{
    if(platform==='wy'){const raw=row(await this.http('https://music.163.com/api/toplist',{},signal));if(raw.code!==200||!Array.isArray(raw.list))throw new Error('榜单响应无效');return list(raw.list).map(v=>{const x=row(v);return item(x.id,x.name,x.coverImgUrl,x.description,x.trackCount);});}
    if(platform==='tx'){const raw=row(await this.http('https://c.y.qq.com/v8/fcg-bin/fcg_myqq_toplist.fcg?format=json',{},signal));const values=row(raw.data).topList;if(!Array.isArray(values))throw new Error('榜单响应无效');return list(values).map(v=>{const x=row(v);return item(x.id,x.topTitle,x.picUrl);});}
    if(platform==='kg'){const raw=row(await this.http('https://m.kugou.com/rank/list?json=true',{},signal));const values=row(raw.rank).list;if(!Array.isArray(values))throw new Error('榜单响应无效');return list(values).map(v=>{const x=row(v);return item(x.rankid,x.rankname,text(x.imgurl).replace('{size}','400'));});}
    if(platform==='kw'){const raw=await this.http('https://qukudata.kuwo.cn/q.k?op=query&cont=tree&node=2&pn=0&rn=1000&fmt=json&level=2',{},signal);const values=tree(raw).filter(v=>v.id&&v.name&&v.sourceid);if(!values.length)throw new Error('榜单响应无效');return unique(values.map(v=>item(v.sourceid,v.name,v.pic)));}
    const raw=await this.http('https://app.c.nf.migu.cn/pc/bmw/rank/rank-index/v1.0',{headers:{channel:'0146921',Referer:'https://app.c.nf.migu.cn/'}},signal);
    const values=tree(raw).filter(v=>v.rankId&&v.rankName);if(!values.length)throw new Error('咪咕榜单响应无效');return unique(values.map(v=>item(v.rankId,v.rankName,v.imageUrl??v.img??v.picUrl)));
  }
  async detail(platform:OnlinePlatform,id:string,page:number,signal:AbortSignal,rank=false,limit=100):Promise<PlaylistPage>{
    if(!/^\d{1,30}$/.test(id)||!Number.isInteger(page)||page<1)throw new Error('歌单ID或页码无效');
    let title='',rows:unknown[]=[],total:number|undefined,hasMore=false;
    if(platform==='wy'){
      const raw=row(await this.http(queryURL('https://music.163.com/api/v6/playlist/detail',{id,n:100000,s:0}),{},signal)),playlist=row(raw.playlist);
      if(raw.code!==200||!Array.isArray(playlist.trackIds))throw new Error('无法读取此公开歌单');title=text(playlist.name);const ids=list(playlist.trackIds).map(value=>required(row(value).id));total=ids.length;
      const selected=ids.slice((page-1)*limit,page*limit);const known=new Map(list(playlist.tracks).map(value=>[required(row(value).id),value]));
      const missing=selected.filter(id=>!known.has(id));
      if(missing.length){const detail=row(await this.http(queryURL('https://music.163.com/api/song/detail',{ids:JSON.stringify(missing)}),{},signal));for(const value of list(detail.songs))known.set(required(row(value).id),value);}
      rows=selected.map(id=>{const value=known.get(id);if(!value)throw new Error('部分歌曲不可读取，未导入不完整歌单');return value;});hasMore=page*limit<total;
    }else if(platform==='tx'){
      if(!Number.isSafeInteger(Number(id)))throw new Error('QQ接口不支持此数值ID');
      const data=rank?await this.qq('musicToplist.ToplistInfoServer','GetDetail',{topid:Number(id),offset:(page-1)*limit,num:limit},signal):await this.qq('music.srfDissInfo.aiDissInfo','uniform_get_Dissinfo',{disstid:Number(id),userinfo:1,tag:1,orderlist:1,song_begin:(page-1)*limit,song_num:limit,onlysonglist:0,enc_host_uin:''},signal);
      const values=data.songlist??data.songInfoList;if(!Array.isArray(values))throw new Error('歌单歌曲响应无效');rows=list(values).map(value=>row(value).songInfo??value);title=text(row(data.dirinfo).title??row(data.data).title);total=count(data.total_song_num??row(data.data).totalNum);hasMore=total!==undefined?page*limit<total:rows.length>=limit;
    }else if(platform==='kw'){
      const url=rank?queryURL('https://kbangserver.kuwo.cn/ksong.s',{from:'pc',fmt:'json',pn:page-1,rn:limit,type:'bang',data:'content',id,show_copyright_off:0,pcmp4:1,isbang:1}):queryURL('https://nplserver.kuwo.cn/pl.svc',{op:'getlistinfo',pid:id,pn:page-1,rn:limit,encode:'utf8',keyset:'pl2012',identity:'kuwo',pcmp4:1,newver:1,vipver:'MUSIC_9.0.5.0_W1'});
      const data=row(await this.http(url,{},signal));const values=data.musiclist;if(!Array.isArray(values))throw new Error('酷我歌单响应无效');title=text(data.title??data.name);total=count(data.total??data.totalmusic);rows=list(values).map(value=>{const v=row(value);return{...v,rid:v.id??v.rid,name:v.name,artist:v.artist,album:v.album,duration:v.duration,N_MINFO:v.n_minfo};});hasMore=total!==undefined?page*limit<total:rows.length>=limit;
    }else if(platform==='kg'){
      if(!rank){
        // The mobile endpoint exposes a preview that repeats on subsequent pages.
        // The public PC page includes the complete ordered hash list.
        const html=await this.textHTTP(`http://www2.kugou.kugou.com/yueku/v9/special/single/${id}-5-9999.html`,{headers:{'User-Agent':'Mozilla/5.0'}},signal);
        const embedded=html.match(/global\.data\s*=\s*(\[[\s\S]*?\]);/);
        if(!embedded)throw new Error('酷狗完整歌单暂不可用，未导入预览列表');
        const values=parseProviderJSON(embedded[1]!) as unknown;if(!Array.isArray(values))throw new Error('酷狗完整歌单格式无效');
        const name=html.match(/specialname\s*:\s*"([^"\n]*)"/)?.[1]??html.match(/<title>([^<]*)<\/title>/)?.[1]??'酷狗公开歌单';
        const mapped=values.map(value=>{const v=row(value),filename=text(v.filename??v.FileName??v.songname),split=filename.indexOf(' - ');return onlineTrack('kg',{...v,FileHash:v.hash??v.FileHash,Audioid:v.audio_id??v.audioid,SongName:split>=0?filename.slice(split+3):filename,SingerName:split>=0?filename.slice(0,split):text(v.singername),Duration:count(v.duration)!==undefined?Number(v.duration)/1000:undefined,FileSize:v.filesize,AlbumID:v.album_id,AlbumName:v.album_name,HQFileHash:v.hash_320,HQFileSize:v.filesize_320,SQFileHash:v.hash_flac,SQFileSize:v.filesize_flac});});
        const slice=mapped.slice((page-1)*limit,page*limit);
        const enriched=await enrichKugouTrackArtworks(this.http,slice,signal);
        return{title:name,items:enriched,total:mapped.length,hasMore:page*limit<mapped.length,page};
      }
      const url=rank?queryURL('https://m.kugou.com/rank/info',{rankid:id,page,json:true}):queryURL(`https://m.kugou.com/plist/list/${id}/`,{page,json:true});
      const raw=row(await this.http(url,{headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'}},signal)),data=row(raw.songs??raw.list),nested=row(data.list);let values:unknown=Array.isArray(data.list)?data.list:nested.info;
      if(!Array.isArray(values)&&rank){
        // Fallback to mobilecdnbj rank song API when m.kugou.com returns an anti-bot redirect stub.
        const fbRaw=row(await this.http(queryURL('https://mobilecdnbj.kugou.com/api/v3/rank/song',{version:9108,ranktype:1,plat:0,pagesize:Math.min(limit,50),area_code:1,page,rankid:id,with_res_tag:0}),{},signal));
        const fbData=row(fbRaw.data);
        if(Array.isArray(fbData.info)){
          values=fbData.info;
          title=title||'酷狗排行榜';
          total=count(fbData.total);
          rows=list(values).map(value=>{const v=row(value),filename=text(v.filename),split=filename.indexOf(' - ');return{...v,FileHash:v.hash,Audioid:v.audio_id,SongName:text(v.songname)||(split>=0?filename.slice(split+3):filename),SingerName:split>=0?filename.slice(0,split):'',Duration:v.duration,FileSize:v.filesize,AlbumID:v.album_id};});
          hasMore=total!==undefined?page*Math.min(limit,50)<total:rows.length>=Math.min(limit,50);
          const enriched=await enrichKugouTrackArtworks(this.http,rows.map(value=>onlineTrack('kg',value)),signal);
          return{title,items:enriched,total,hasMore,page};
        }
      }
      if(!Array.isArray(values))throw new Error('酷狗歌曲响应无效');const info=row(list(row(raw.info).list)[0]);title=text(info.specialname??row(raw.info).rankname);total=count(data.total??nested.total);rows=list(values).map(value=>{const v=row(value),filename=text(v.filename),split=filename.indexOf(' - ');return{...v,FileHash:v.hash,Audioid:v.audio_id,SongName:split>=0?filename.slice(split+3):filename,SingerName:split>=0?filename.slice(0,split):'',Duration:v.duration,FileSize:v.filesize,AlbumID:v.album_id};});hasMore=total!==undefined?page*Number(raw.pagesize??30)<total:rows.length>=30;
      const kgTracks=await enrichKugouTrackArtworks(this.http,rows.map(value=>onlineTrack('kg',value)),signal);
      return{title,items:kgTracks,total,hasMore,page};
    }else{
      const url=rank?queryURL('https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/querycontentbyId.do',{columnId:id,needAll:0}):queryURL('https://app.c.nf.migu.cn/MIGUM3.0/resource/playlist/song/v2.0',{pageNo:page,pageSize:limit,playlistId:id});
      const raw=row(await this.http(url,{headers:{channel:'0146921',Referer:'https://m.music.migu.cn/'}},signal)),data=row(raw.data);const values=data.songList??raw.contentList??(Array.isArray(row(raw.columnInfo).contents)?list(row(raw.columnInfo).contents).map(value=>row(value).objectInfo):undefined);if(!Array.isArray(values))throw new Error('咪咕歌单响应无效');rows=list(values);title=text(data.name??data.title??row(raw.columnInfo).columnTitle);total=count(data.totalCount??row(raw.columnInfo).contentsCount);hasMore=!rank&&(total!==undefined?page*limit<total:rows.length>=limit);
    }
    return{title,items:rows.map(value=>onlineTrack(platform,value)),total,hasMore,page};
  }
  async complete(platform:OnlinePlatform,id:string,signal:AbortSignal,rank=false):Promise<{title:string;tracks:readonly Track[]}>{
    const tracks:Track[]=[];let title='',expectedTotal:number|undefined;const pages=new Set<string>();
    for(let page=1;page<=200;page++){
      throwIfAborted(signal);const result=await this.detail(platform,id,page,signal,rank);throwIfAborted(signal);if(!title)title=result.title;
      if(result.total!==undefined){
        if(!Number.isSafeInteger(result.total)||result.total<0)throw new Error('平台歌曲数量无效，未导入不完整歌单');
        if(expectedTotal!==undefined&&expectedTotal!==result.total)throw new Error('读取期间歌曲数量变化，请重新读取完整歌单');
        expectedTotal=result.total;
      }
      const signature=JSON.stringify(result.items.map(item=>item.origin.id));if(result.hasMore&&(!result.items.length||pages.has(signature)))throw new Error('平台未推进分页，已停止不完整导入');pages.add(signature);
      tracks.push(...result.items);if(tracks.length>20000)throw new Error('歌单超过20000首，请分批导入');
      if(expectedTotal!==undefined&&(tracks.length>expectedTotal||!result.hasMore&&tracks.length!==expectedTotal))throw new Error('歌曲数量与平台声明不符，未导入不完整歌单');
      if(!result.hasMore)return{title:title||'公开平台歌单',tracks};
    }
    throw new Error('歌单分页过多，未导入不完整结果');
  }
  private async neteaseWeapi(path:string,data:Record<string,unknown>,signal:AbortSignal):Promise<Row>{
    const enc=weapiPayload(data);
    return row(await this.http(`https://music.163.com${path}`,{
      method:'POST',
      credentials:'omit',
      headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8',Referer:'https://music.163.com/',Origin:'https://music.163.com','User-Agent':DESKTOP_UA,Cookie:'os=pc; appver=2.10.13'},
      body:`params=${encodeURIComponent(enc.params)}&encSecKey=${encodeURIComponent(enc.encSecKey)}`,
    },signal));
  }
  private parseHomepagePlaylists(block:Row):BrowseItem[]{
    const out:BrowseItem[]=[];
    for(const creative of list(block.creatives)){
      const c=row(creative);
      const resources=list(c.resources);
      const entries=resources.length?resources:[c];
      for(const res of entries){
        const r=row(res),ui=row(r.uiElement),ext=row(r.resourceExtInfo);
        const rid=text(r.resourceId??c.creativeId).trim();
        const title=text(row(ui.mainTitle).title??r.name).trim();
        if(!rid||!title)continue;
        const artwork=text(row(ui.image).imageUrl).trim()||undefined;
        const playCount=count(ext.playCount);
        out.push({id:rid,title,...(artwork?{artwork}:{}),...(playCount!==undefined?{playCount}:{})});
      }
    }
    return unique(out);
  }
  private parseHomepageSongs(block:Row,limit=10):Track[]{
    const out:Track[]=[];
    const seen=new Set<string>();
    for(const creative of list(block.creatives)){
      for(const res of list(row(creative).resources)){
        const r=row(res),ext=row(r.resourceExtInfo),songData=row(ext.songData);
        if(!Object.keys(songData).length)continue;
        try{
          const track=onlineTrack('wy',songData);
          if(!seen.has(track.origin.id)){
            seen.add(track.origin.id);
            out.push(track);
            if(out.length>=limit)return out;
          }
        }catch{}
      }
    }
    return out;
  }
  private parseHomepageAlbums(block:Row):BrowseItem[]{
    const out:BrowseItem[]=[];
    for(const creative of list(block.creatives)){
      const c=row(creative);
      const cType=text(c.creativeType).toUpperCase();
      if(cType&&!cType.includes('ALBUM')&&!cType.includes('DIGITAL'))continue;
      for(const res of list(c.resources)){
        const r=row(res),ui=row(r.uiElement),ext=row(r.resourceExtInfo);
        const rid=text(r.resourceId).trim();
        const title=text(row(ui.mainTitle).title).trim();
        if(!rid||!title)continue;
        const artwork=text(row(ui.image).imageUrl).trim()||undefined;
        const artists=list(ext.artists).map(a=>text(row(a).name)).filter(Boolean).join(' / ');
        out.push({id:rid,title,...(artwork?{artwork}:{}),...(artists?{author:artists}:{})});
      }
    }
    return unique(out);
  }
  async featured(platform:OnlinePlatform,signal:AbortSignal,helpers:FeaturedHomeHelpers={}):Promise<FeaturedHomeData>{
    throwIfAborted(signal);
    const empty:FeaturedHomeData={
      recommendedPlaylists:[],
      newSongAlbumTracks:[],
      newSongAlbumCards:[],
      radarPlaylists:[],
      scenePlaylists:[],
      videoPlaylists:[],
      highQualityPlaylists:[],
      newExpressSongs:[],
      newAlbums:[],
      popularArtists:[],
      officialToplists:[],
      newSongChartTracks:[],
      categories:[],
      latestMVs:[],
      topMVs:[],
    };
    if(platform!=='wy'){
      const [plRes,rankRes,catRes]=await Promise.allSettled([
        this.playlists(platform,1,undefined,signal,18),
        this.rankings(platform,signal),
        this.categories(platform,signal),
      ]);
      throwIfAborted(signal);
      const recommendedPlaylists=plRes.status==='fulfilled'?plRes.value.items:[];
      const ranks=rankRes.status==='fulfilled'?rankRes.value:[];
      const categories=catRes.status==='fulfilled'?catRes.value:[];
      const officialToplists:OfficialToplistPreview[]=ranks.slice(0,8).map(r=>({
        id:r.id,
        title:r.title,
        ...(r.artwork?{artwork:r.artwork}:{}),
        ...(r.description?{updateFrequency:r.description.slice(0,24)}:{}),
        tracks:[],
      }));
      let newSongChartTracks:Track[]=[];
      let newSongChartTitle:string|undefined;
      if(ranks[0]){
        try{
          const topDetail=await this.detail(platform,ranks[0].id,1,signal,true,10);
          newSongChartTracks=[...topDetail.items.slice(0,10)];
          newSongChartTitle=ranks[0].title;
        }catch{}
      }
      return{
        ...empty,
        recommendedPlaylists,
        officialToplists,
        ...(newSongChartTitle?{newSongChartTitle}:{}),
        newSongChartTracks,
        categories,
      };
    }

    const [hpRes,newSongsRes,hqRes,toplistRes,catRes,albumsRes,artistsRes,latestMvRes,topMvRes]=await Promise.allSettled([
      this.neteaseWeapi('/weapi/homepage/block/page',{refresh:false},signal),
      this.http('https://music.163.com/api/v1/discovery/new/songs?type=0',{credentials:'omit',headers:{Referer:'https://music.163.com/','User-Agent':DESKTOP_UA}},signal),
      this.neteaseWeapi('/weapi/playlist/highquality/list',{cat:'全部',limit:12,lasttime:0,total:true},signal),
      this.http('https://music.163.com/api/toplist/detail',{credentials:'omit',headers:{Referer:'https://music.163.com/','User-Agent':DESKTOP_UA}},signal),
      this.categories('wy',signal),
      helpers.newAlbums?helpers.newAlbums(signal):Promise.resolve([]),
      helpers.popularArtists?helpers.popularArtists(signal):Promise.resolve([]),
      helpers.latestMVs?helpers.latestMVs(signal):Promise.resolve([]),
      helpers.topMVs?helpers.topMVs(signal):Promise.resolve([]),
    ]);
    throwIfAborted(signal);

    let recommendedPlaylists:BrowseItem[]=[];
    let curatedSongs:FeaturedSongShelf|undefined;
    let newSongAlbumTracks:Track[]=[];
    let newSongAlbumCards:BrowseItem[]=[];
    let radarPlaylists:BrowseItem[]=[];
    let scenePlaylists:BrowseItem[]=[];
    let videoPlaylists:BrowseItem[]=[];

    if(hpRes.status==='fulfilled'&&hpRes.value.code===200){
      const blocks=list(row(hpRes.value.data).blocks);
      for(const entry of blocks){
        const b=row(entry),code=text(b.blockCode),title=text(row(row(b.uiElement).subTitle).title).trim();
        if(code==='HOMEPAGE_BLOCK_PLAYLIST_RCMD')recommendedPlaylists=this.parseHomepagePlaylists(b);
        else if(code==='HOMEPAGE_BLOCK_STYLE_RCMD'){
          const songs=this.parseHomepageSongs(b,10);
          if(songs.length)curatedSongs={title:title||'专属精选',tracks:songs};
        }else if(code==='HOMEPAGE_BLOCK_NEW_ALBUM_NEW_SONG'){
          newSongAlbumTracks=this.parseHomepageSongs(b,6);
          newSongAlbumCards=this.parseHomepageAlbums(b);
        }else if(code==='HOMEPAGE_BLOCK_MGC_PLAYLIST')radarPlaylists=this.parseHomepagePlaylists(b);
        else if(code==='HOMEPAGE_BLOCK_OFFICIAL_PLAYLIST')scenePlaylists=this.parseHomepagePlaylists(b);
        else if(code==='HOMEPAGE_BLOCK_VIDEO_PLAYLIST')videoPlaylists=this.parseHomepagePlaylists(b);
      }
    }

    if(!recommendedPlaylists.length){
      try{recommendedPlaylists=[...(await this.playlists('wy',1,undefined,signal,12)).items];}catch{}
    }

    const newExpressSongs:Track[]=[];
    if(newSongsRes.status==='fulfilled'){
      const raw=row(newSongsRes.value);
      if(raw.code===200){
        for(const s of list(raw.data).slice(0,10)){
          try{newExpressSongs.push(onlineTrack('wy',s));}catch{}
        }
      }
    }

    const highQualityPlaylists:BrowseItem[]=[];
    if(hqRes.status==='fulfilled'&&hqRes.value.code===200){
      for(const pl of list(hqRes.value.playlists).slice(0,12)){
        const v=row(pl);
        try{
          const mapped=item(v.id,v.name,v.coverImgUrl,v.description,v.trackCount);
          const pc=count(v.playCount);
          highQualityPlaylists.push({...mapped,...(pc!==undefined?{playCount:pc}:{})});
        }catch{}
      }
    }

    const officialToplists:OfficialToplistPreview[]=[];
    let newSongChartId='';
    let newSongChartTitle='新歌榜';
    if(toplistRes.status==='fulfilled'){
      const raw=row(toplistRes.value);
      if(raw.code===200){
        for(const entry of list(raw.list)){
          const v=row(entry),tid=text(v.id),tname=text(v.name).trim();
          if(!tid||!tname)continue;
          const previewTracks=list(v.tracks).map(t=>{const tr=row(t);return{first:text(tr.first),second:text(tr.second)};}).filter(t=>t.first);
          if(previewTracks.length&&officialToplists.length<8){
            officialToplists.push({
              id:tid,
              title:tname,
              ...(text(v.coverImgUrl)?{artwork:text(v.coverImgUrl)}:{}),
              ...(text(v.updateFrequency)?{updateFrequency:text(v.updateFrequency)}:{}),
              tracks:previewTracks.slice(0,3),
            });
          }
          if(!newSongChartId&&tname.includes('新歌榜')){newSongChartId=tid;newSongChartTitle=tname;}
        }
      }
    }

    let newSongChartTracks:Track[]=[];
    if(newSongChartId){
      try{
        const detailPage=await this.detail('wy',newSongChartId,1,signal,true,10);
        newSongChartTracks=[...detailPage.items.slice(0,10)];
      }catch{}
    }

    const newAlbums=albumsRes.status==='fulfilled'?albumsRes.value:[];
    if(!newSongAlbumCards.length&&newAlbums.length)newSongAlbumCards=[...newAlbums.slice(0,8)];
    if(!newSongAlbumTracks.length&&newExpressSongs.length)newSongAlbumTracks=newExpressSongs.slice(0,6);

    return{
      recommendedPlaylists,
      ...(curatedSongs?{curatedSongs}:{}),
      newSongAlbumTracks,
      newSongAlbumCards,
      radarPlaylists,
      scenePlaylists,
      videoPlaylists,
      highQualityPlaylists,
      newExpressSongs,
      newAlbums,
      popularArtists:artistsRes.status==='fulfilled'?artistsRes.value:[],
      officialToplists,
      ...(newSongChartTracks.length?{newSongChartTitle}:{}),
      newSongChartTracks,
      categories:catRes.status==='fulfilled'?catRes.value:[],
      latestMVs:latestMvRes.status==='fulfilled'?latestMvRes.value:[],
      topMVs:topMvRes.status==='fulfilled'?topMvRes.value:[],
    };
  }
}
