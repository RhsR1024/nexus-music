import type {OnlinePlatform,Track} from '../domain/track.ts';
import {onlineTrack} from './online.ts';
import {queryURL,requestJSON,type HTTPClient} from './http.ts';
import {throwIfAborted} from './async.ts';
import {qqSignature} from './qqSignature.ts';
type Row=Record<string,unknown>;
const row=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const list=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const text=(value:unknown)=>typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
const count=(value:unknown)=>value!==undefined&&value!==null&&Number.isFinite(Number(value))&&Number(value)>=0?Number(value):undefined;
export interface BrowseItem {id:string;title:string;artwork?:string;description?:string;count?:number}
export interface BrowsePage {items:readonly BrowseItem[];hasMore:boolean;page:number}
export interface PlaylistPage {title:string;items:readonly Track[];total?:number;hasMore:boolean;page:number}
export interface BrowseCategory {id:string;title:string;group?:string}
function required(value:unknown){const id=text(value);if(!id)throw new Error('平台响应缺少有效ID');return id;}
function tree(value:unknown,depth=0):Row[]{if(depth>12)return[];if(Array.isArray(value))return value.slice(0,2000).flatMap(item=>tree(item,depth+1));const object=row(value);return Object.keys(object).length?[object,...Object.values(object).filter(item=>item&&typeof item==='object').flatMap(item=>tree(item,depth+1))]:[];}
function unique(items:BrowseItem[]){return [...new Map(items.map(item=>[item.id,item])).values()];}
function item(id:unknown,title:unknown,artwork?:unknown,description?:unknown,total?:unknown):BrowseItem {const name=text(title);if(!name)throw new Error('平台响应缺少名称');return{id:required(id),title:name,...(text(artwork)?{artwork:text(artwork)}:{}),...(text(description)?{description:text(description)}:{}),...(count(total)!==undefined?{count:count(total)}:{})};}
export class DiscoveryProvider {
  private http:HTTPClient;private sha1:(value:string)=>Promise<string>;
  constructor(sha1:(value:string)=>Promise<string>,http:HTTPClient=requestJSON){this.sha1=sha1;this.http=http;}
  private async qq(module:string,method:string,param:Row,signal:AbortSignal){
    const body=JSON.stringify({comm:{ct:24,cv:0,format:'json',uin:0},req:{module,method,param}});
    const raw=row(await this.http(queryURL('https://u.y.qq.com/cgi-bin/musics.fcg',{sign:await qqSignature(body,this.sha1)}),{method:'POST',headers:{'Content-Type':'application/json',Referer:'https://y.qq.com/'},body},signal));
    const response=row(raw.req);if(raw.code!==0||response.code!==0)throw new Error('QQ服务暂时不可用');return row(response.data);
  }
  async categories(platform:OnlinePlatform,signal:AbortSignal):Promise<readonly BrowseCategory[]>{
    if(platform==='wy'){const raw=row(await this.http('https://music.163.com/api/playlist/catalogue',{},signal));if(raw.code!==200||!Array.isArray(raw.sub))throw new Error('分类响应无效');return list(raw.sub).map(value=>{const v=row(value);return{id:required(v.name),title:text(v.name),group:text(row(raw.categories)[text(v.category)])};});}
    if(platform==='tx'){const data=await this.qq('playlist.PlaylistAllCategoriesServer','get_all_categories',{qq:''},signal);return list(data.v_group).flatMap(group=>list(row(group).v_item).map(value=>({id:required(row(value).id),title:text(row(value).name),group:text(row(group).group_name)})));}
    if(platform==='kw'){const raw=await this.http('https://wapi.kuwo.cn/api/pc/classify/playlist/getTagList?cmd=rcm_keyword_playlist&user=0&prod=kwplayer_pc_9.0.5.0',{},signal);const items=tree(raw).filter(value=>value.id&&value.name&&value.digest);if(!items.length)throw new Error('分类响应无效');return items.map(value=>({id:required(value.id),title:text(value.name),group:text(value.digest)}));}
    if(platform==='mg'){const raw=await this.http('https://app.c.nf.migu.cn/pc/v1.0/template/musiclistplaza-taglist/release',{},signal);const items=tree(raw).filter(value=>Array.isArray(value.texts)&&list(value.texts).length>=2);if(!items.length)throw new Error('分类暂不可用');return items.map(value=>({id:required(list(value.texts)[1]),title:text(list(value.texts)[0])}));}
    // Kugou's mobile public plaza exposes recommendations but no category tree.
    return[];
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
      items=list(rows).map(value=>{const v=row(value),basic=row(v.basic);return item(v.tid??v.dissid??basic.tid,v.title??v.dissname??basic.title,v.cover_url_big??v.imgurl??row(basic.cover).medium_url??row(basic.cover).default_url,v.desc);});hasMore=items.length>=limit;
    }else if(platform==='kw'){
      const url=category?'https://wapi.kuwo.cn/api/pc/classify/playlist/getTagPlayList':'https://wapi.kuwo.cn/api/pc/classify/playlist/getRcmPlayList';
      const raw=row(await this.http(queryURL(url,{loginUid:0,loginSid:0,appUid:76039576,pn:page,rn:limit,order:'hot',...(category?{id:category}:{})}),{},signal)),data=row(raw.data);
      if(!Array.isArray(data.data))throw new Error('酷我歌单服务暂时不可用');items=list(data.data).map(value=>{const v=row(value);return item(v.id,v.name,v.img,v.desc,v.total);});hasMore=count(data.total)!==undefined?page*limit<Number(data.total):items.length>=limit;
    }else if(platform==='kg'){
      const raw=row(await this.http(queryURL('https://m.kugou.com/plist/index',{json:true,page}),{},signal)),data=row(raw.plist);
      const values=row(data.list).info;if(!Array.isArray(values))throw new Error('酷狗歌单响应无效');items=list(values).map(value=>{const v=row(value);return item(v.specialid,v.specialname,text(v.imgurl).replace('{size}','400'),v.intro,v.songcount);});hasMore=count(row(data.list).total)!==undefined?page*Number(raw.pagesize??30)<Number(row(data.list).total):items.length>=30;
    }else{
      const url=category?queryURL('https://app.c.nf.migu.cn/pc/v1.0/template/musiclistplaza-listbytag/release',{pageNumber:page,templateVersion:2,tagId:category}):queryURL('https://app.c.nf.migu.cn/pc/bmw/page-data/playlist-square-recommend/v1.0',{templateVersion:2,pageNo:page});
      const raw=row(await this.http(url,{},signal));if(raw.code!=='000000')throw new Error('咪咕歌单服务暂时不可用');
      items=unique(tree(raw.data).filter(v=>v.resourceType==='2021'&&v.resourceId&&v.contentName).map(v=>item(v.resourceId,v.contentName)));
      const next=count(row(row(raw.data).header).nextPageNo);hasMore=next!==undefined&&next>page;
    }
    return{items,hasMore,page};
  }
  async rankings(platform:OnlinePlatform,signal:AbortSignal):Promise<readonly BrowseItem[]>{
    if(platform==='wy'){const raw=row(await this.http('https://music.163.com/api/toplist',{},signal));if(raw.code!==200||!Array.isArray(raw.list))throw new Error('榜单响应无效');return list(raw.list).map(v=>{const x=row(v);return item(x.id,x.name,x.coverImgUrl,x.description,x.trackCount);});}
    if(platform==='tx'){const raw=row(await this.http('https://c.y.qq.com/v8/fcg-bin/fcg_myqq_toplist.fcg?format=json',{},signal));const values=row(raw.data).topList;if(!Array.isArray(values))throw new Error('榜单响应无效');return list(values).map(v=>{const x=row(v);return item(x.id,x.topTitle,x.picUrl);});}
    if(platform==='kg'){const raw=row(await this.http('https://m.kugou.com/rank/list?json=true',{},signal));const values=row(raw.rank).list;if(!Array.isArray(values))throw new Error('榜单响应无效');return list(values).map(v=>{const x=row(v);return item(x.rankid,x.rankname,text(x.imgurl).replace('{size}','400'));});}
    if(platform==='kw'){const raw=await this.http('https://qukudata.kuwo.cn/q.k?op=query&cont=tree&node=2&pn=0&rn=1000&fmt=json&level=2',{},signal);const values=tree(raw).filter(v=>v.id&&v.name&&v.sourceid);if(!values.length)throw new Error('榜单响应无效');return unique(values.map(v=>item(v.sourceid,v.name,v.pic)));}
    const raw=await this.http('https://app.c.nf.migu.cn/pc/bmw/rank/rank-index/v1.0',{headers:{channel:'0146921',Referer:'https://app.c.nf.migu.cn/'}},signal);
    const values=tree(raw).filter(v=>v.rankId&&v.rankName);if(!values.length)throw new Error('咪咕榜单响应无效');return unique(values.map(v=>item(v.rankId,v.rankName,v.img)));
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
      const url=rank?queryURL('https://m.kugou.com/rank/info',{rankid:id,page,json:true}):queryURL(`https://m.kugou.com/plist/list/${id}/`,{page,json:true});
      const raw=row(await this.http(url,{},signal)),data=row(raw.songs??raw.list),nested=row(data.list);const values=Array.isArray(data.list)?data.list:nested.info;
      if(!Array.isArray(values))throw new Error('酷狗歌曲响应无效');const info=row(list(row(raw.info).list)[0]);title=text(info.specialname??row(raw.info).rankname);total=count(data.total??nested.total);rows=list(values).map(value=>{const v=row(value),filename=text(v.filename),split=filename.indexOf(' - ');return{...v,FileHash:v.hash,Audioid:v.audio_id,SongName:split>=0?filename.slice(split+3):filename,SingerName:split>=0?filename.slice(0,split):'',Duration:v.duration,FileSize:v.filesize,AlbumID:v.album_id};});hasMore=total!==undefined?page*Number(raw.pagesize??30)<total:rows.length>=30;
    }else{
      const url=rank?queryURL('https://app.c.nf.migu.cn/MIGUM2.0/v1.0/content/querycontentbyId.do',{columnId:id,needAll:0}):queryURL('https://app.c.nf.migu.cn/MIGUM3.0/resource/playlist/song/v2.0',{pageNo:page,pageSize:limit,playlistId:id});
      const raw=row(await this.http(url,{headers:{channel:'0146921',Referer:'https://m.music.migu.cn/'}},signal)),data=row(raw.data);const values=data.songList??raw.contentList;if(!Array.isArray(values))throw new Error('咪咕歌单响应无效');rows=list(values);title=text(data.name??data.title);total=count(data.totalCount);hasMore=!rank&&(total!==undefined?page*limit<total:rows.length>=limit);
    }
    return{title,items:rows.map(value=>onlineTrack(platform,value)),total,hasMore,page};
  }
  async complete(platform:OnlinePlatform,id:string,signal:AbortSignal,rank=false):Promise<{title:string;tracks:readonly Track[]}>{
    const tracks:Track[]=[];let title='';const pages=new Set<string>();
    for(let page=1;page<=200;page++){
      throwIfAborted(signal);const result=await this.detail(platform,id,page,signal,rank);if(!title)title=result.title;
      const signature=JSON.stringify(result.items.map(item=>item.origin.id));if(result.hasMore&&(!result.items.length||pages.has(signature)))throw new Error('平台未推进分页，已停止不完整导入');pages.add(signature);
      tracks.push(...result.items);if(tracks.length>20000)throw new Error('歌单超过20000首，请分批导入');if(!result.hasMore)return{title:title||'公开平台歌单',tracks};
    }
    throw new Error('歌单分页过多，未导入不完整结果');
  }
}
