import type {Track} from '../domain/track.ts';
import {cleanTrack} from '../storage/cleanTrack.ts';
import {HTTPResponseError,type HTTPClient} from './http.ts';
import type {MusicAccount,MusicAccounts,MusicSession} from './musicAccounts.ts';
import {neteaseSessionAuth,neteaseWeapiRequest,type NeteaseSessionAuth} from './neteaseSession.ts';
import {onlineTrack} from './online.ts';

// Static target boundary: fixed Sollin IPA E-060/F-051/P-051. This is an
// independent account reader, not a recovered target client.
const BASE='https://music.163.com/weapi/';
export const NETEASE_HEARTBEAT_COUNT=300;
export const NETEASE_HEARTBEAT_DETAIL_BATCH=500;

export interface AccountHeartbeatResult {
  readonly seed:Track;
  readonly tracks:readonly Track[];
  readonly source:'current'|'liked';
}

export type AccountHeartbeatFailure=
  |'login_required'
  |'account_changed'
  |'cancelled'
  |'unavailable'
  |'favorite_playlist_missing'
  |'liked_empty'
  |'seed_unavailable'
  |'recommendations_empty';

const messages:Readonly<Record<AccountHeartbeatFailure,string>>={
  login_required:'网易云登录已失效，请重新登录',
  account_changed:'平台账号已更改，请重试',
  cancelled:'心动模式开启已取消',
  unavailable:'心动模式暂时不可用，请稍后重试',
  favorite_playlist_missing:'没有找到“我喜欢的音乐”歌单',
  liked_empty:'你的“我喜欢的音乐”还是空的',
  seed_unavailable:'没有找到可用的心动模式种子歌曲',
  recommendations_empty:'网易云心动模式返回了空列表，请换一首歌再试',
};

export class AccountHeartbeatError extends Error {
  readonly kind:AccountHeartbeatFailure;
  constructor(kind:AccountHeartbeatFailure){
    super(messages[kind]);
    this.kind=kind;
  }
}

type Row=Record<string,unknown>;
type Operation={};
const row=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const list=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const text=(value:unknown)=>typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
const identifier=(value:unknown)=>{
  const id=text(value);
  return /^[1-9]\d{0,19}$/.test(id)?id:undefined;
};
const loginCode=(value:unknown)=>[301,401,403].includes(Number(value));

function uniqueIDs(values:readonly unknown[],objectKey?:string):string[]{
  const seen=new Set<string>(),ids:string[]=[];
  for(const value of values){
    const raw=objectKey?row(value)[objectKey]:value;
    const id=identifier(raw);
    if(!id||seen.has(id))continue;
    seen.add(id);ids.push(id);
  }
  return ids;
}

export interface AccountHeartbeatOptions {
  readonly http?:HTTPClient;
  readonly accounts?:Pick<MusicAccounts,'getSnapshot'>;
  readonly random?:()=>number;
}

export class AccountHeartbeat {
  private readonly http:HTTPClient;
  private readonly accounts?:Pick<MusicAccounts,'getSnapshot'>;
  private readonly random:()=>number;
  private readonly operations=new Map<string,Operation>();
  constructor(options:AccountHeartbeatOptions={}){
    this.http=options.http??(async()=>{throw new AccountHeartbeatError('unavailable');});
    this.accounts=options.accounts;
    this.random=options.random??Math.random;
  }
  clear(accountId?:string){
    if(accountId===undefined)this.operations.clear();
    else this.operations.delete(accountId);
  }
  private begin(account:MusicAccount,signal:AbortSignal){
    const operation:Operation={};
    this.operations.set(account.id,operation);
    const check=()=>{
      if(signal.aborted)throw new AccountHeartbeatError('cancelled');
      if(this.operations.get(account.id)!==operation)throw new AccountHeartbeatError('account_changed');
      if(this.accounts&&!this.accounts.getSnapshot().includes(account))throw new AccountHeartbeatError('account_changed');
    };
    check();
    return{operation,check};
  }
  private credentials(account:MusicAccount,session:MusicSession){
    if(account.platform!=='wy')throw new AccountHeartbeatError('unavailable');
    const owner=text(session.userId),auth=neteaseSessionAuth(session),cookies=row(session.cookies);
    if(session.platform!=='wy'||session.accountId!==account.id||account.username!==`netease:${owner}`||!/^[1-9]\d{0,19}$/.test(owner)||text(cookies.MUSIC_U).trim()===''||!auth)throw new AccountHeartbeatError('login_required');
    return{auth,owner};
  }
  private async request(path:string,data:Record<string,unknown>,auth:NeteaseSessionAuth,signal:AbortSignal,check:()=>void,requireSuccess=true){
    check();
    let raw:unknown;
    try{
      raw=await this.http(BASE+path,{...neteaseWeapiRequest(data,auth),credentials:'omit'},signal);
    }catch(error){
      check();
      if(error instanceof HTTPResponseError&&[401,403].includes(error.status))throw new AccountHeartbeatError('login_required');
      throw new AccountHeartbeatError('unavailable');
    }
    check();
    const response=row(raw);
    if(requireSuccess&&response.code!==200)throw new AccountHeartbeatError(loginCode(response.code)?'login_required':'unavailable');
    return response;
  }
  private async favoritePlaylist(owner:string,auth:NeteaseSessionAuth,signal:AbortSignal,check:()=>void){
    const response=await this.request('user/playlist',{uid:owner,limit:2000,offset:0,includeVideo:true},auth,signal,check);
    if(!Array.isArray(response.playlist)||response.playlist.length>2000)throw new AccountHeartbeatError('unavailable');
    let fallbackTen:{id:string;title:string}|undefined;
    let fallbackNamed:{id:string;title:string}|undefined;
    for(const value of response.playlist){
      const playlist=row(value),id=identifier(playlist.id);
      if(text(row(playlist.creator).userId)!==owner||!id)continue;
      const st=Number(playlist.specialType),title=text(playlist.name);
      // Real NetEase liked-music playlist carries specialType === 5; keep 10 and title fallback for compatibility.
      if(st===5)return{id,title};
      if(st===10&&!fallbackTen)fallbackTen={id,title};
      if(!fallbackNamed&&/我喜欢的音乐|喜欢的音乐/.test(title))fallbackNamed={id,title};
    }
    const found=fallbackTen??fallbackNamed;
    if(found)return found;
    throw new AccountHeartbeatError('favorite_playlist_missing');
  }
  private async playlistOrder(playlistId:string,auth:NeteaseSessionAuth,signal:AbortSignal,check:()=>void){
    try{
      const response=await this.request('v3/playlist/detail',{id:playlistId,n:'100000'},auth,signal,check);
      const trackIds=row(response.playlist).trackIds;
      if(!Array.isArray(trackIds))throw new AccountHeartbeatError('unavailable');
      return uniqueIDs(trackIds,'id');
    }catch(error){
      check();
      if(error instanceof AccountHeartbeatError&&(error.kind==='cancelled'||error.kind==='account_changed'))throw error;
      return undefined;
    }
  }
  private async likedIDs(owner:string,playlistId:string,auth:NeteaseSessionAuth,signal:AbortSignal,check:()=>void){
    const ordered=await this.playlistOrder(playlistId,auth,signal,check);
    if(ordered)return ordered;
    const response=await this.request('song/like/get',{uid:owner},auth,signal,check);
    if(!Array.isArray(response.ids))throw new AccountHeartbeatError('unavailable');
    const ids=uniqueIDs(response.ids);
    if(response.ids.length&&!ids.length)throw new AccountHeartbeatError('unavailable');
    return ids;
  }
  private async detailBatch(ids:readonly string[],auth:NeteaseSessionAuth,signal:AbortSignal,check:()=>void):Promise<Track[]>{
    const response=await this.request('v3/song/detail',{c:JSON.stringify(ids.map(id=>({id})))},auth,signal,check);
    if(!Array.isArray(response.songs))throw new AccountHeartbeatError('unavailable');
    const songs=new Map<string,unknown>();
    for(const value of list(response.songs)){
      const id=identifier(row(value).id);
      if(id&&!songs.has(id))songs.set(id,value);
    }
    const tracks:Track[]=[];
    for(const id of ids){
      if(!songs.has(id))continue;
      try{tracks.push(cleanTrack(onlineTrack('wy',songs.get(id))));}catch{/* Skip one malformed detail row. */}
    }
    return tracks;
  }
  private async likedTracks(ids:readonly string[],auth:NeteaseSessionAuth,signal:AbortSignal,check:()=>void){
    if(!ids.length)throw new AccountHeartbeatError('liked_empty');
    const tracks:Track[]=[];
    for(let offset=0;offset<ids.length;offset+=NETEASE_HEARTBEAT_DETAIL_BATCH){
      tracks.push(...await this.detailBatch(ids.slice(offset,offset+NETEASE_HEARTBEAT_DETAIL_BATCH),auth,signal,check));
    }
    check();
    return tracks;
  }
  private seed(current:Track|undefined,liked:readonly Track[]){
    if(!liked.length)throw new AccountHeartbeatError('seed_unavailable');
    if(current?.origin.kind==='online'&&current.origin.platform==='wy'&&liked.some(track=>track.origin.kind==='online'&&track.origin.platform==='wy'&&track.origin.id===current.origin.id)){
      try{return{track:cleanTrack(current),source:'current' as const};}catch{/* Fall back to the hydrated liked row. */}
    }
    const index=Math.max(0,Math.min(liked.length-1,Math.floor(this.random()*liked.length)||0));
    return{track:liked[index]!,source:'liked' as const};
  }
  private intelligenceIDs(response:Row,seedId:string){
    const payload=row(response.data);
    if(!Array.isArray(payload.list))throw new AccountHeartbeatError('unavailable');
    const rows=payload.list,ids:string[]=[],seen=new Set<string>();
    let parsed=0;
    for(const value of rows){
      const item=row(value),songInfo=row(item.songInfo),song=row(item.song);
      const id=identifier(songInfo.id)??identifier(song.id);
      if(!id)continue;
      parsed++;
      if(id===seedId||seen.has(id))continue;
      seen.add(id);ids.push(id);
    }
    if(rows.length&&!parsed)throw new AccountHeartbeatError('unavailable');
    if(!ids.length)throw new AccountHeartbeatError('recommendations_empty');
    return ids;
  }
  private async recommendationTracks(ids:readonly string[],auth:NeteaseSessionAuth,signal:AbortSignal,check:()=>void){
    const tracks:Track[]=[];
    for(let offset=0;offset<ids.length;offset+=NETEASE_HEARTBEAT_DETAIL_BATCH){
      try{
        tracks.push(...await this.detailBatch(ids.slice(offset,offset+NETEASE_HEARTBEAT_DETAIL_BATCH),auth,signal,check));
      }catch(error){
        check();
        if(error instanceof AccountHeartbeatError&&error.kind==='login_required')throw error;
        // The target logs and omits one failed recommendation-detail batch
        // while retaining other successful batches.
      }
    }
    return tracks;
  }
  async start(account:MusicAccount,session:MusicSession,current:Track|undefined,signal:AbortSignal):Promise<AccountHeartbeatResult>{
    const {operation,check}=this.begin(account,signal);
    try{
      const {auth,owner}=this.credentials(account,session);
      check();
      const favorite=await this.favoritePlaylist(owner,auth,signal,check);
      const likedIds=await this.likedIDs(owner,favorite.id,auth,signal,check);
      const liked=await this.likedTracks(likedIds,auth,signal,check);
      const selected=this.seed(current,liked);
      const seedId=selected.track.origin.id;
      const response=await this.request('playmode/intelligence/list',{songId:seedId,type:'fromPlayOne',playlistId:favorite.id,startMusicId:seedId,count:NETEASE_HEARTBEAT_COUNT},auth,signal,check);
      const recommendationIds=this.intelligenceIDs(response,seedId);
      const recommendations=await this.recommendationTracks(recommendationIds,auth,signal,check);
      check();
      return{seed:selected.track,tracks:[selected.track,...recommendations],source:selected.source};
    }catch(error){
      check();
      if(error instanceof AccountHeartbeatError)throw error;
      if(error instanceof HTTPResponseError&&[401,403].includes(error.status))throw new AccountHeartbeatError('login_required');
      throw new AccountHeartbeatError('unavailable');
    }finally{
      if(this.operations.get(account.id)===operation)this.operations.delete(account.id);
    }
  }
}
