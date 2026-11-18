import {safePublicURL} from '../domain/publicURL.ts';
import {HTTPResponseError,type HTTPClient} from './http.ts';
import {parseQQCookiePayload,qqMusicIdentity} from './qqAccountProfile.ts';
import {neteaseSessionAuth,neteaseWeapiRequest,type NeteaseSessionAuth} from './neteaseSession.ts';
import type {MusicAccount,MusicAccounts,MusicSession} from './musicAccounts.ts';
import type {BrowseItem} from './discovery.ts';

// Static target boundary: fixed Sollin IPA E-059/F-050. This is an
// independently implemented account reader, not a recovered target client.
export interface AccountRecommendedPlaylist extends BrowseItem {
  readonly platform:'wy'|'tx';
}

export type AccountRecommendedPlaylistsFailure='login_required'|'account_changed'|'cancelled'|'unavailable';

export class AccountRecommendedPlaylistsError extends Error {
  readonly kind:AccountRecommendedPlaylistsFailure;
  constructor(kind:AccountRecommendedPlaylistsFailure){
    super(({
      login_required:'平台登录已失效，请重新登录后读取推荐歌单',
      account_changed:'平台账号已更改，请重新读取推荐歌单',
      cancelled:'推荐歌单读取已取消',
      unavailable:'推荐歌单暂时不可用，请稍后重试',
    })[kind]);
    this.kind=kind;
  }
}

type Row=Record<string,unknown>;
const row=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const list=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const text=(value:unknown)=>typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
const identifier=(value:unknown)=>{const id=text(value);return /^[1-9]\d{0,19}$/.test(id)?id:undefined;};
const boundedText=(value:unknown,limit:number)=>{
  const output=text(value).trim();
  return output&&output.length<=limit&&!/[\u0000-\u001f\u007f]/.test(output)?output:undefined;
};
const cover=(value:unknown)=>{
  const raw=text(value).trim().replace(/^\/\//,'https://');
  if(!raw)return undefined;
  return safePublicURL(raw)?raw:undefined;
};
const count=(value:unknown)=>{
  if(value===undefined||value===null||value==='')return undefined;
  const number=typeof value==='number'?value:/^\d+$/.test(text(value))?Number(value):NaN;
  return Number.isSafeInteger(number)&&number>=0&&number<=1_000_000?number:undefined;
};

function parseNetease(raw:unknown):readonly AccountRecommendedPlaylist[]{
  const response=row(raw);
  if(response.code!==200)throw new AccountRecommendedPlaylistsError([301,401,403].includes(Number(response.code))?'login_required':'unavailable');
  if(!Array.isArray(response.recommend))throw new AccountRecommendedPlaylistsError('unavailable');
  const seen=new Set<string>(),items:AccountRecommendedPlaylist[]=[];
  for(const value of list(response.recommend)){
    const item=row(value),id=identifier(item.id),title=boundedText(item.name,200);
    if(!id||!title||seen.has(id))continue;
    const creator=row(item.creator),artwork=cover(item.picUrl),description=boundedText(item.intro??item.description,1000),author=boundedText(creator.nickname??creator.name,200),total=count(item.trackCount);
    seen.add(id);
    items.push(Object.freeze({platform:'wy',id,title,...(artwork?{artwork}:{}),...(description?{description}:{}),...(author?{author}:{}),...(total!==undefined?{count:total}:{})}));
    if(items.length===30)break;
  }
  if(response.recommend.length&&!items.length)throw new AccountRecommendedPlaylistsError('unavailable');
  return items;
}

function parseQQ(raw:unknown):readonly AccountRecommendedPlaylist[]{
  const response=row(raw),data=row(response.data);
  if(response.code!==0)throw new AccountRecommendedPlaylistsError([301,401,403,1000,104400,104401].includes(Number(response.code))?'login_required':'unavailable');
  const feed=row(data.FeedRsp);
  if(!Array.isArray(feed.List))throw new AccountRecommendedPlaylistsError('unavailable');
  const seen=new Set<string>(),items:AccountRecommendedPlaylist[]=[];
  for(const value of list(feed.List)){
    const playlist=row(row(value).Playlist),basic=row(playlist.basic);
    const id=identifier(basic.tid??playlist.tid??playlist.dissid);
    const title=boundedText(basic.title??playlist.title??playlist.dissname,200);
    if(!id||!title||seen.has(id))continue;
    const artwork=cover(row(basic.cover).medium_url??row(basic.cover).default_url??playlist.cover_url_big??playlist.imgurl);
    const description=boundedText(basic.desc??playlist.desc,1000);
    const author=boundedText(row(basic.creator).nick??row(basic.creator).name,200);
    const total=count(basic.song_cnt??basic.songNum??playlist.songNum??playlist.song_cnt);
    seen.add(id);
    items.push(Object.freeze({platform:'tx',id,title,...(artwork?{artwork}:{}),...(description?{description}:{}),...(author?{author}:{}),...(total!==undefined?{count:total}:{})}));
    if(items.length===30)break;
  }
  if(feed.List.length&&!items.length)throw new AccountRecommendedPlaylistsError('unavailable');
  return items;
}

export class AccountRecommendedPlaylists {
  private readonly http:HTTPClient;
  private readonly accounts?:Pick<MusicAccounts,'getSnapshot'>;
  private readonly operations=new Map<string,object>();
  private readonly cache=new Map<string,{expires:number;value:readonly AccountRecommendedPlaylist[]}>();
  private readonly now:()=>number;
  constructor(options:{http?:HTTPClient;accounts?:Pick<MusicAccounts,'getSnapshot'>;now?:()=>number}={}){
    this.http=options.http??(async()=>{throw new AccountRecommendedPlaylistsError('unavailable');});
    this.accounts=options.accounts;
    this.now=options.now??Date.now;
  }
  clear(accountId?:string){
    if(accountId===undefined){this.operations.clear();this.cache.clear();return;}
    this.operations.delete(accountId);
    for(const [key,value] of this.cache)if(key.startsWith(`${accountId}\u0000`))this.cache.delete(key);
  }
  private credentials(account:MusicAccount,session:MusicSession){
    if(account.platform==='wy'){
      const auth=neteaseSessionAuth(session),owner=text(session.userId);
      if(!auth||session.accountId!==account.id||session.platform!=='wy'||account.username!==`netease:${owner}`)throw new AccountRecommendedPlaylistsError('login_required');
      return {platform:'wy' as const,auth};
    }
    if(account.platform==='tx'){
      if(session.version!==1||session.platform!=='tx'||session.accountId!==account.id)throw new AccountRecommendedPlaylistsError('login_required');
      try{
        const cookies=parseQQCookiePayload(JSON.stringify(row(session.cookies)),'music'),identity=qqMusicIdentity(cookies);
        if(session.userId!==identity.uin||account.username!==`qq:${identity.tmeLoginType}:${identity.uin}`)throw new AccountRecommendedPlaylistsError('login_required');
        return {platform:'tx' as const,cookies,identity};
      }catch(error){
        if(error instanceof AccountRecommendedPlaylistsError)throw error;
        throw new AccountRecommendedPlaylistsError('login_required');
      }
    }
    throw new AccountRecommendedPlaylistsError('unavailable');
  }
  private async netease(auth:NeteaseSessionAuth,signal:AbortSignal,check:()=>void){
    check();
    const raw=await this.http('https://music.163.com/weapi/v1/discovery/recommend/resource',{...neteaseWeapiRequest({},auth),credentials:'omit'},signal);
    check();return parseNetease(raw);
  }
  private async qq(cookies:Readonly<Record<string,string>>,identity:ReturnType<typeof qqMusicIdentity>,signal:AbortSignal,check:()=>void){
    check();
    const request={module:'music.playlist.PlaylistSquare',method:'GetRecommendFeed',param:{From:0,Size:30}};
    const raw=await this.http('https://u.y.qq.com/cgi-bin/musicu.fcg',{
      method:'POST',credentials:'omit',
      headers:{Cookie:Object.entries(cookies).map(([key,value])=>`${key}=${value}`).join('; '),Referer:'https://y.qq.com/',Origin:'https://y.qq.com','Content-Type':'application/json;charset=UTF-8'},
      body:JSON.stringify({comm:{uin:identity.uin,authst:identity.authst,ct:24,cv:0,format:'json',tmeAppID:'qqmusic',tmeLoginType:identity.tmeLoginType},req:request}),
    },signal);
    check();
    const response=row(raw),envelope=row(response.req);
    if(response.code!==undefined&&Number(response.code)!==0)throw new AccountRecommendedPlaylistsError([301,401,403,1000,104400,104401].includes(Number(response.code))?'login_required':'unavailable');
    if(envelope.code!==undefined&&Number(envelope.code)!==0)throw new AccountRecommendedPlaylistsError([301,401,403,1000,104400,104401].includes(Number(envelope.code))?'login_required':'unavailable');
    return parseQQ(envelope);
  }
  async list(account:MusicAccount,session:MusicSession,signal:AbortSignal,force=false):Promise<readonly AccountRecommendedPlaylist[]>{
    const operation={};this.operations.set(account.id,operation);
    const key=`${account.id}\u0000${account.platform}\u0000${account.updatedAt}`;
    const check=()=>{
      if(signal.aborted)throw new AccountRecommendedPlaylistsError('cancelled');
      if(this.operations.get(account.id)!==operation||this.accounts&&!this.accounts.getSnapshot().includes(account))throw new AccountRecommendedPlaylistsError('account_changed');
    };
    try{
      check();
      const credentials=this.credentials(account,session);
      if(!force){const cached=this.cache.get(key);if(cached&&cached.expires>this.now())return cached.value;}
      let items:readonly AccountRecommendedPlaylist[];
      try{items=credentials.platform==='wy'?await this.netease(credentials.auth,signal,check):await this.qq(credentials.cookies,credentials.identity,signal,check);}
      catch(error){
        check();
        if(error instanceof AccountRecommendedPlaylistsError)throw error;
        if(error instanceof HTTPResponseError&&[401,403].includes(error.status))throw new AccountRecommendedPlaylistsError('login_required');
        throw new AccountRecommendedPlaylistsError('unavailable');
      }
      check();this.cache.set(key,{expires:this.now()+5*60_000,value:items});return items;
    }catch(error){
      if(signal.aborted)throw new AccountRecommendedPlaylistsError('cancelled');
      if(error instanceof AccountRecommendedPlaylistsError)throw error;
      throw new AccountRecommendedPlaylistsError('unavailable');
    }finally{
      if(this.operations.get(account.id)===operation)this.operations.delete(account.id);
    }
  }
}
