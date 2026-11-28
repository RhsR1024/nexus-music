// Read-only account contracts: Q-music Android 5db858f kugouApi.ts
// (Apache-2.0), MakcRe/KuGouMusicApi (MIT; licenses/kugou-api-mit.txt).
// Protocol alignment for /v4/get_list_all_file & concept-client fallback: Coda 22bc58e.
import {AccountPlaylistError,type AccountPlaylist} from './accountPlaylists.ts';
import {validKugouDailySession} from './kugouDaily.ts';
import {resolveKugouTracks,enrichKugouTrackArtworks,KugouTrackDetailError} from './kugouTrackDetails.ts';
import {queryURL,type HTTPClient} from './http.ts';
import type {MusicAccount,MusicSession} from './musicAccounts.ts';
import {cleanTrack,safePublicURL} from '../storage/cleanTrack.ts';
import {onlineTrack} from './online.ts';
import type {Track} from '../domain/track.ts';
type Row=Record<string,unknown>;
const row=(v:unknown):Row=>v&&typeof v==='object'&&!Array.isArray(v)?v as Row:{};
const text=(v:unknown)=>typeof v==='string'?v:typeof v==='number'&&Number.isSafeInteger(v)?String(v):'';
function fail():never{throw new AccountPlaylistError('incomplete');}
const id=(v:unknown)=>{const result=text(v);return /^[1-9]\d{0,19}$/.test(result)?result:fail();};
const count=(v:unknown)=>{if(typeof v!=='number'&&!(typeof v==='string'&&/^\d+$/.test(v)))return fail();const n=Number(v);return Number.isSafeInteger(n)&&n>=0&&n<=10000?n:fail();};
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{32}$/i.test(v);
const cover=(v:unknown)=>{try{const u=new URL(text(v).replace('{size}','240').replace(/^http:/i,'https:'));return u.protocol==='https:'&&safePublicURL(u.href)?u.href:'';}catch{return '';}};

function extractInlineTrack(rawValue:unknown):Track|null{
  const item=row(rawValue);
  const fileHash=item.hash??item.filehash??item.file_hash;
  if(!hash(fileHash))return null;
  const rawName=text(item.name??item.filename??item.songname).trim();
  let title=rawName,artist=text(item.singername??item.author_name).trim();
  if(!artist&&rawName.includes(' - ')){
    const idx=rawName.indexOf(' - ');
    artist=rawName.slice(0,idx).trim();
    title=rawName.slice(idx+3).trim();
  }
  if(!title)title='未知歌曲';
  const trans=row(item.trans_param),albumInfo=row(item.album_info??item.albuminfo);
  const firstAuthor=Array.isArray(item.authors)&&item.authors.length?row(item.authors[0]):{};
  const rawCover=[item.cover,albumInfo.sizable_cover,trans.union_cover,item.sizable_cover,item.pic,item.img,firstAuthor.sizable_avatar]
    .map(v=>text(v).trim()).find(Boolean)??'';
  const durationMs=Number(item.timelen??item.timelength??0);
  const durationSec=Number.isFinite(durationMs)&&durationMs>0?(durationMs>10000?durationMs/1000:durationMs):0;
  try{
    return cleanTrack(onlineTrack('kg',{
      FileHash:fileHash.toUpperCase(),
      Audioid:item.audio_id??item.mixsongid??item.album_audio_id??0,
      OriSongName:title,
      SingerName:artist||'未知歌手',
      AlbumName:text(item.album_name??albumInfo.album_name??albumInfo.name),
      AlbumID:text(item.album_id??albumInfo.album_id),
      sizable_cover:rawCover||undefined,
      Duration:durationSec,
      FileSize:item.size??item.filesize,
      HQFileHash:hash(item.hash_320)?item.hash_320:undefined,
      SQFileHash:hash(item.hash_flac)?item.hash_flac:undefined,
      ResFileHash:hash(item.hash_high)?item.hash_high:undefined,
    }));
  }catch{return null;}
}

export class KugouPlaylists{
  private readonly deps:{http:HTTPClient;md5:(value:string)=>Promise<string>;now?:()=>number};
  constructor(deps:KugouPlaylists['deps']){this.deps=deps;}
  private open(account:MusicAccount,session:MusicSession,signal:AbortSignal,check:()=>void){
    check();if(!validKugouDailySession(account,session)||session.accountId!==undefined&&session.accountId!==account.id)throw new AccountPlaylistError('login_required');
    return async(path:'/v7/get_all_list'|'/v4/get_list_all_file_v3'|'/v4/get_list_all_file',body:Row,extraQuery:Row={},concept=false)=>{
      check();
      const appid=concept?3116:1005,clientver=concept?11430:20489;
      const query:Row={dfid:'-',mid:session.mid,uuid:'-',appid,clientver,clienttime:Math.floor((this.deps.now??Date.now)()/1000),...(path==='/v7/get_all_list'?{plat:1}:{}),...extraQuery,userid:session.userId,token:session.token};
      const payload=JSON.stringify(body),salt=concept?'LnT6xpN3khm36zse0QzvmgTZ3waWdRSA':'OIlwieks28dk2k092lksi2UIkp';
      const signature=await this.deps.md5(salt+Object.keys(query).sort().map(k=>`${k}=${query[k]}`).join('')+payload+salt);
      check();if(!hash(signature))throw new AccountPlaylistError('unavailable');
      const raw=row(await this.deps.http(queryURL(`https://gateway.kugou.com${path}`,{...query,signature}),{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',dfid:'-',mid:String(session.mid),clienttime:String(query.clienttime),'x-router':'cloudlist.service.kugou.com'},body:payload},signal));check();
      if(![1,'1'].includes(raw.status as string|number)||raw.error_code!==undefined&&![0,'0'].includes(raw.error_code as string|number)||!raw.data||typeof raw.data!=='object'||Array.isArray(raw.data))throw new AccountPlaylistError('unavailable');
      return row(raw.data);
    };
  }
  async list(account:MusicAccount,session:MusicSession,signal:AbortSignal,check:()=>void):Promise<AccountPlaylist[]>{
    const call=this.open(account,session,signal,check),items:AccountPlaylist[]=[],seen=new Set<string>();let expected:number|undefined;
    for(let page=1;page<=100;page++){
      let data:Row;
      try{
        data=await call('/v7/get_all_list',{userid:session.userId,token:session.token,total_ver:979,type:2,page,pagesize:100});
      }catch(err){
        if(err instanceof AccountPlaylistError&&err.kind==='unavailable'){
          data=await call('/v7/get_all_list',{userid:Number(session.userId)||0,token:session.token,total_ver:979,type:2,page,pagesize:100},{total_ver:979,type:2,page,pagesize:100},true);
        }else throw err;
      }
      const rows=data.info??data.list??data.lists;
      if(!Array.isArray(rows)||rows.length>100)fail();
      const rawTotal=data.total??data.count;if(rawTotal!=null){const n=count(rawTotal);if(expected!==undefined&&n!==expected)fail();expected=n;}else if(expected!==undefined)fail();
      for(const value of rows){const item=row(value),identifier=id(item.listid??item.list_id),title=text(item.name??item.listname).trim()||'未命名歌单';
        if(seen.has(identifier)||title.length>200||/[\u0000-\u001f\u007f]/.test(title))fail();seen.add(identifier);
        const creator=item.list_create_userid,foreign=creator!==undefined&&creator!==null&&text(creator)!==''&&text(creator)!=='0'?id(creator)!==session.userId:false;
        const gid=text(item.list_create_gid??item.global_collection_id);
        items.push(Object.freeze({id:identifier,title,count:count(item.count??item.songcount??item.filecount),coverUrl:cover(item.pic??item.img??item.picurl),kind:Number(item.is_collect)===1||foreign?'favorite':'created',...(gid.startsWith('collection_')?{globalCollectionId:gid}:{})}));
      }
      if(items.length>10000)fail();
      if(expected!==undefined){if(items.length>expected)fail();if(items.length===expected)return items;if(!rows.length)fail();}
      else if(rows.length<100)return items;
    }
    return fail();
  }
  private async fetchCloudRows(call:ReturnType<KugouPlaylists['open']>,session:MusicSession,identifier:string,page:number,lenient:boolean){
    try{
      return await call('/v4/get_list_all_file_v3',{listid:identifier,userid:session.userId,token:session.token,type:0,page,pagesize:300,area_code:1,allplatform:1,show_cover:1});
    }catch(firstErr){
      if(!lenient&&!(firstErr instanceof AccountPlaylistError&&firstErr.kind==='unavailable'))throw firstErr;
      // Fallback 1: official /v4/get_list_all_file with query listid/page/pagesize (works for Kugou QR concept sessions & newer cloudlist gateway)
      for(const concept of [false,true]){
        try{
          return await call('/v4/get_list_all_file',{listid:identifier,userid:Number(session.userId)||0,token:session.token,type:0,page,pagesize:200,area_code:1,show_relate_goods:0,allplatform:1,show_cover:1},{listid:identifier,page,pagesize:200},concept);
        }catch{
          // try next profile
        }
      }
      throw firstErr;
    }
  }
  async tracks(account:MusicAccount,session:MusicSession,playlist:AccountPlaylist,signal:AbortSignal,check:()=>void,options?:{lenient?:boolean}):Promise<Track[]>{
    const call=this.open(account,session,signal,check),identifier=id(playlist.id),hashes:string[]=[],inlineByHash=new Map<string,Track>(),pages=new Set<string>();
    const lenient=options?.lenient===true;
    let expected:number|undefined;
    // Collected Kugou playlists may expose songs only via public collection ID
    if(lenient&&playlist.kind==='favorite'&&playlist.globalCollectionId?.startsWith('collection_')){
      try{
        const pubTracks=await this.publicCollectionTracks(session,playlist.globalCollectionId,signal,check);
        if(pubTracks.length)return pubTracks;
      }catch{check();}
    }
    for(let page=1;page<=100;page++){
      const data=await this.fetchCloudRows(call,session,identifier,page,lenient);
      const rows=data.info??data.list??data.songs??data.songlist??data.files;
      if(!Array.isArray(rows)||rows.length>300)fail();
      const rawTotal=data.count??data.total;
      if(!lenient){
        if(rawTotal!=null){const n=count(rawTotal);if(expected!==undefined&&n!==expected)fail();expected=n;}else if(expected!==undefined)fail();
      }else if(rawTotal!=null&&expected===undefined){
        const n=Number(rawTotal);if(Number.isSafeInteger(n)&&n>=0&&n<=10000)expected=n;
      }
      const group:string[]=[];
      for(const value of rows){
        const item=row(value),valueHash=item.hash??item.filehash??item.file_hash;
        if(!hash(valueHash)){if(lenient)continue;return fail();}
        const upper=valueHash.toUpperCase();
        group.push(upper);
        if(lenient&&!inlineByHash.has(upper)){
          const inline=extractInlineTrack(item);
          if(inline)inlineByHash.set(upper,inline);
        }
      }
      const fingerprint=JSON.stringify(group);
      if(group.length&&pages.has(fingerprint)){if(lenient)break;fail();}
      pages.add(fingerprint);hashes.push(...group);
      if(hashes.length>10000){if(lenient)break;fail();}
      if(!lenient&&expected!==undefined&&hashes.length>expected)fail();
      if(!lenient&&expected!==undefined&&!rows.length&&hashes.length<expected)fail();
      const pageLimit=rows.length<=200?200:300;
      const done=(expected!==undefined&&hashes.length>=expected)||(expected===undefined&&rows.length<pageLimit)||(lenient&&!rows.length);
      if(done){
        if(!hashes.length)return [];
        let resolved:Track[]=[];
        try{
          resolved=(await resolveKugouTracks(this.deps,hashes,signal,check,{lenient})).map(cleanTrack);
        }catch(error){
          check();
          if(!lenient||!inlineByHash.size){
            if(error instanceof KugouTrackDetailError)throw new AccountPlaylistError('incomplete');
            throw error;
          }
        }
        if(lenient&&resolved.length<hashes.length&&inlineByHash.size){
          const byHash=new Map<string,Track>();
          for(const t of resolved){byHash.set(String(t.metadata.hash??t.origin.id).toUpperCase(),t);}
          const merged=hashes.map(h=>byHash.get(h)??inlineByHash.get(h)).filter((t):t is Track=>!!t);
          return [...await enrichKugouTrackArtworks(this.deps.http,merged,signal)];
        }
        return lenient?[...await enrichKugouTrackArtworks(this.deps.http,resolved,signal)]:resolved;
      }
    }
    if(lenient&&hashes.length){
      try{return [...await enrichKugouTrackArtworks(this.deps.http,(await resolveKugouTracks(this.deps,hashes,signal,check,{lenient:true})).map(cleanTrack),signal)];}
      catch{check();const fallback=hashes.map(h=>inlineByHash.get(h)).filter((t):t is Track=>!!t);return [...await enrichKugouTrackArtworks(this.deps.http,fallback,signal)];}
    }
    return fail();
  }
  private async publicCollectionTracks(session:MusicSession,globalCollectionId:string,signal:AbortSignal,check:()=>void):Promise<Track[]>{
    const out:Track[]=[];
    for(let page=0;page<25;page++){
      check();
      const ts=Math.floor((this.deps.now??Date.now)()/1000);
      const query:Row={
        area_code:1,begin_idx:out.length,clienttime:ts,clientver:11430,dfid:'-',
        extend_fields:'abtags,hot_cmt,popularization',global_collection_id:globalCollectionId,
        mid:session.mid,mode:1,pagesize:200,personal_switch:1,plat:1,type:1,appid:3116,uuid:'-',
        userid:session.userId,token:session.token,
      };
      const salt='LnT6xpN3khm36zse0QzvmgTZ3waWdRSA';
      const signature=await this.deps.md5(salt+Object.keys(query).sort().map(k=>`${k}=${query[k]}`).join('')+salt);
      const raw=row(await this.deps.http(queryURL('https://gateway.kugou.com/pubsongs/v2/get_other_list_file_nofilt',{...query,signature}),{method:'GET',credentials:'omit',headers:{dfid:'-',mid:String(session.mid),clienttime:String(ts)}},signal));
      const data=row(raw.data),songs=Array.isArray(data.songs)?data.songs:[];
      for(const s of songs){const t=extractInlineTrack(s);if(t)out.push(t);}
      const total=Number(data.count??0);
      if(!songs.length||(total>0?out.length>=total:songs.length<200))break;
    }
    return [...await enrichKugouTrackArtworks(this.deps.http,out,signal)];
  }
}
