// Read-only contracts: Q-music Android 5db858f, musicAccount/playlists.ts,
// requests.ts and qqCredentials.ts (Apache-2.0, Nshpiter/LX attribution).
// Independent reader: no platform writes, sync, scripts or playback credentials.
import {AccountPlaylistError,type AccountPlaylist} from './accountPlaylists.ts';
import {parseQQCookiePayload,qqMusicIdentity,type QQAccountProfileClient,QQAccountProfileError} from './qqAccountProfile.ts';
import type {MusicAccount,MusicSession} from './musicAccounts.ts';
import type {HTTPClient} from './http.ts';
import type {Track} from '../domain/track.ts';
import {onlineTrack} from './online.ts';
import {cleanTrack,safePublicURL} from '../storage/cleanTrack.ts';

type Row=Record<string,unknown>;
const row=(v:unknown):Row=>v&&typeof v==='object'&&!Array.isArray(v)?v as Row:{};
const text=(v:unknown)=>typeof v==='string'?v:typeof v==='number'&&Number.isSafeInteger(v)?String(v):'';
function fail():never{throw new AccountPlaylistError('incomplete');}
const total=(v:unknown)=>{const n=Number(v);if(typeof v==='string'&&!/^\d+$/.test(v))fail();if(v===undefined||v===null||v===''||typeof v==='boolean'||!Number.isSafeInteger(n)||n<0||n>10000)fail();return n;};
const more=(v:unknown)=>{if(v===true||v===1||v==='1')return true;if(v===false||v===0||v==='0')return false;return fail();};
const numeric=(v:unknown)=>{const id=text(v);return /^[1-9]\d{0,15}$/.test(id)&&Number.isSafeInteger(Number(id))?id:fail();};
const mid=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9]{1,128}$/.test(v);
const authCode=(v:unknown)=>[301,401,403,1000,104400,104401].includes(Number(v));
const publicCover=(v:unknown)=>{try{const u=new URL(text(v).replace(/^\/\//,'https://'));return u.protocol==='https:'&&safePublicURL(u.href)?u.href:'';}catch{return '';}};
function playlist(value:unknown,kind:AccountPlaylist['kind']):AccountPlaylist{
  const item=row(value),dir=item.dirId??item.dirid;
  const raw=[item.tid,item.dissid,item.dissId,item.id].find(v=>/^[1-9]\d*$/.test(text(v)));
  const id=text(dir)==='201'?'dir:201':raw!==undefined?numeric(raw):`dir:${numeric(dir)}`;
  const title=text(item.dirName??item.dirname??item.title??item.dissname??item.name).trim();
  if(!title||title.length>200||/[\u0000-\u001f\u007f]/.test(title))fail();
  return Object.freeze({id,title,count:total(item.songNum??item.song_cnt??item.songnum??item.song_num??item.songCount??item.trackCount),coverUrl:publicCover(item.picUrl??item.bigpicUrl??item.picurl??item.logo),kind});
}

export class QQPlaylists{
  private readonly deps:{http:HTTPClient;profile:Pick<QQAccountProfileClient,'fetch'>};
  constructor(deps:QQPlaylists['deps']){this.deps=deps;}
  private async open(account:MusicAccount,session:MusicSession,signal:AbortSignal,check:()=>void){
    check();let cookies:Readonly<Record<string,string>>,identity:ReturnType<typeof qqMusicIdentity>;
    try{
      if(account.platform!=='tx'||session.version!==1||session.platform!=='tx'||session.accountId!==account.id)throw new Error();
      cookies=parseQQCookiePayload(JSON.stringify(row(session.cookies)),'music');identity=qqMusicIdentity(cookies);
      if(session.userId!==identity.uin||account.username!==`qq:${identity.tmeLoginType}:${identity.uin}`)throw new Error();
    }catch{throw new AccountPlaylistError('login_required');}
    let profile:Awaited<ReturnType<QQAccountProfileClient['fetch']>>;
    try{profile=await this.deps.profile.fetch(session,signal);}catch(error){check();if(error instanceof QQAccountProfileError)throw new AccountPlaylistError(error.kind);throw error;}
    check();if(profile.userId!==identity.uin)throw new AccountPlaylistError('login_required');
    const encryptedUin=profile.encryptedUin;
    if(typeof encryptedUin!=='string'||!encryptedUin||encryptedUin.length>1024||/[\u0000-\u001f\u007f]/.test(encryptedUin))throw new AccountPlaylistError('unavailable');
    const request=async(calls:Row)=>{
      check();const result=row(await this.deps.http('https://u.y.qq.com/cgi-bin/musicu.fcg',{
        method:'POST',credentials:'omit',headers:{Cookie:Object.entries(cookies).map(([k,v])=>`${k}=${v}`).join('; '),Referer:'https://y.qq.com/',Origin:'https://y.qq.com','Content-Type':'application/json;charset=UTF-8'},
        body:JSON.stringify({comm:{uin:identity.uin,authst:identity.authst,ct:24,cv:0,format:'json',tmeAppID:'qqmusic',tmeLoginType:identity.tmeLoginType},...calls}),
      },signal));check();
      for(const code of [result.code,...Object.keys(calls).map(k=>row(result[k]).code)])if(code!==0)throw new AccountPlaylistError(authCode(code)?'login_required':'unavailable');
      for(const key of Object.keys(calls))if(!row(result[key]).data||typeof row(result[key]).data!=='object'||Array.isArray(row(result[key]).data))fail();
      return Object.fromEntries(Object.keys(calls).map(key=>[key,row(row(result[key]).data)]));
    };
    const detail=(id:string,offset:number,size=100)=>({module:'music.srfDissInfo.DissInfo',method:'CgiGetDiss',param:{disstid:id.startsWith('dir:')?0:Number(numeric(id)),dirid:id.startsWith('dir:')?Number(numeric(id.slice(4))):0,tag:true,song_begin:offset,song_num:size,userinfo:true,orderlist:true,enc_host_uin:encryptedUin}});
    return{request,detail,uin:identity.uin,encryptedUin};
  }
  async list(account:MusicAccount,session:MusicSession,signal:AbortSignal,check:()=>void):Promise<AccountPlaylist[]>{
    const {request,detail,uin,encryptedUin}=await this.open(account,session,signal,check);
    const favorite=(offset:number)=>({module:'music.musicasset.PlaylistFavRead',method:'CgiGetPlaylistFavInfo',param:{uin:encryptedUin,offset,size:100}});
    const result=await request({created:{module:'music.musicasset.PlaylistBaseRead',method:'GetPlaylistByUin',param:{uin}},favorite:favorite(0),liked:detail('dir:201',0,1)});
    const created=result.created!;
    // This fixed API is unpaged. Reject an explicit truncated response.
    if(!Array.isArray(created.v_playlist)||created.v_playlist.length>10000||created.hasmore!=null&&more(created.hasmore))fail();
    const likedCount=total(result.liked!.total_song_num??result.liked!.songnum??result.liked!.totalnum);
    const items=created.v_playlist.map(value=>{
      const item=row(value);
      return playlist(text(item.dirId??item.dirid)==='201'?{...item,songNum:likedCount}:item,'created');
    }),seen=new Set(items.map(v=>v.id));
    if(seen.size!==items.length)fail();
    const liked=items.findIndex(v=>v.id==='dir:201');
    if(liked>=0)items[liked]=Object.freeze({...items[liked]!,count:likedCount});
    else{items.unshift(Object.freeze({id:'dir:201',title:'我喜欢',count:likedCount,coverUrl:'',kind:'created'}));seen.add('dir:201');}
    let data=result.favorite!,offset=0;
    for(let page=0;page<100;page++){
      const rows=data.v_list??data.v_playlist;if(!Array.isArray(rows)||rows.length>100)fail();
      let added=0;
      for(const value of rows){const item=playlist(value,'favorite');if(seen.has(item.id))continue;items.push(item);seen.add(item.id);added++;}
      if(items.length>10000)fail();offset+=rows.length;
      if(!more(data.hasmore))return items;
      if(!added)fail();data=(await request({favorite:favorite(offset)})).favorite!;
    }
    return fail();
  }
  async tracks(account:MusicAccount,session:MusicSession,playlist:AccountPlaylist,signal:AbortSignal,check:()=>void):Promise<Track[]>{
    const {request,detail}=await this.open(account,session,signal,check),tracks:Track[]=[],seen=new Set<string>();let offset=0,expected:number|undefined;
    for(let page=0;page<100;page++){
      const data=(await request({detail:detail(playlist.id,offset)})).detail!,rows=data.songlist??data.songList??data.track_list;
      if(!Array.isArray(rows)||rows.length>100)fail();
      const rawTotal=data.total_song_num??data.songnum??data.totalnum;
      if(rawTotal!=null){const n=total(rawTotal);if(expected!==undefined&&n!==expected)fail();expected=n;}
      else if(expected!==undefined)fail();
      for(const value of rows){
        const song=row(row(value).track_info??value);if(!mid(song.mid)||!mid(row(song.file).media_mid)||!song.album||typeof song.album!=='object'||Array.isArray(song.album)||seen.has(song.mid))fail();
        seen.add(song.mid);try{tracks.push(cleanTrack(onlineTrack('tx',song)));}catch{return fail();}
      }
      offset+=rows.length;if(offset>10000)fail();
      const hasMore=data.hasmore==null?undefined:more(data.hasmore);
      if(expected!==undefined&&offset>=expected){if(offset!==expected||hasMore===true)fail();return tracks;}
      if(hasMore===false){if(expected!==undefined&&offset!==expected)fail();return tracks;}
      if(!rows.length)fail();
    }
    return fail();
  }
}
