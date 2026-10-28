// QQ protocol fields adapted from Q-music-android 5db858f, musicAccount/
// cookies.ts, qqCredentials.ts, requests.ts and accountTransfer.ts (Apache-2.0).
// Modified for NexusMusic: separate QQ web/imported music identities, bounded cookies, strict responses,
// abortable requests and no persistence of the authorization-check playlist data.
import type {HTTPClient} from './http.ts';
import {HTTPResponseError} from './http.ts';
import type {MusicSession} from './musicAccounts.ts';
import {MusicAuthError} from './musicAuth.ts';

const names=['qqmusic_key','qm_keyst','musickey','qqmusic_uin','uin','musicid','login_type','wxuin'];
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};

export function parseQQCookiePayload(raw:string,mode:'web'|'music'='web'):Readonly<Record<string,string>>{
  let source:Record<string,unknown>;
  try{source=object(JSON.parse(raw));}catch{throw new MusicAuthError('failed','登录结果格式无效');}
  const cookies:Record<string,string>={};
  for(const name of names){
    const value=source[name];
    if(value===undefined)continue;
    if(typeof value!=='string'||!value||value.length>4096||/[\u0000-\u001f\u007f;]/.test(value))throw new MusicAuthError('failed','登录凭据格式无效');
    cookies[name]=value;
  }
  if(mode==='music')qqMusicIdentity(cookies);else qqWebIdentity(cookies);
  return Object.freeze(cookies);
}

export function qqWebIdentity(cookies:Readonly<Record<string,string>>){
  const keys=[cookies.qqmusic_key,cookies.qm_keyst,cookies.musickey].filter((key):key is string=>!!key);
  // WX and QQ music identities are distinct. This entry does not support WX.
  if(cookies.login_type==='2'||cookies.login_type!==undefined&&cookies.login_type!=='1'||
    cookies.login_type!=='1'&&(!!cookies.wxuin||keys.some(key=>key.startsWith('W_X'))))throw new MusicAuthError('failed','此入口仅支持 QQ 网页登录');
  const authst=keys.find(key=>!key.startsWith('W_X'));
  const identity=[cookies.qqmusic_uin,cookies.uin,cookies.musicid].find(value=>!!value&&/^o?\d{1,20}$/i.test(value)&&/[1-9]/.test(value));
  if(!authst||!identity)throw new MusicAuthError('failed','QQ 音乐登录未完成');
  return{uin:identity.replace(/^o/i,'').replace(/^0+/,''),authst,tmeLoginType:2 as const};
}

/** Imported WX sessions keep their own music ID and login type. Never fall
 * back to a residual QQ uin, or silently relabel a web-login session as WX. */
export function qqMusicIdentity(cookies:Readonly<Record<string,string>>):{uin:string;authst:string;tmeLoginType:1|2}{
  if(cookies.login_type!=='2')return qqWebIdentity(cookies);
  const keys=[cookies.qqmusic_key,cookies.qm_keyst,cookies.musickey].filter((key):key is string=>!!key);
  const authst=keys.find(key=>key.startsWith('W_X'))??keys.find(key=>!key.startsWith('Q_H_L'));
  const identity=[cookies.wxuin,cookies.musicid,cookies.qqmusic_uin].find(value=>!!value&&/^o?\d{1,20}$/i.test(value)&&/[1-9]/.test(value));
  if(!authst||!identity)throw new MusicAuthError('failed','QQ 音乐登录未完成');
  return{uin:identity.replace(/^o/i,'').replace(/^0+/,''),authst,tmeLoginType:1};
}

export class QQAccountProfileError extends Error{
  readonly kind:'login_required'|'unavailable'|'cancelled';
  constructor(kind:'login_required'|'unavailable'|'cancelled'){
    super(kind==='cancelled'?'账号验证已取消':kind==='login_required'?'QQ 音乐登录已失效，请重新登录':'暂时无法验证 QQ 音乐账号');
    this.kind=kind;
  }
}

/** Public profile alone is insufficient: also check the official music account API. */
export class QQAccountProfileClient{
  private readonly options:{http:HTTPClient};
  constructor(options:{http:HTTPClient}){this.options=options;}
  async fetch(session:MusicSession,signal:AbortSignal):Promise<{userId:string;nickname:string;encryptedUin?:string}>{
    const check=()=>{if(signal.aborted)throw new QQAccountProfileError('cancelled');};
    check();
    try{
      if(session.platform!=='tx')throw new QQAccountProfileError('login_required');
      const cookies=parseQQCookiePayload(JSON.stringify(object(session.cookies)),'music');
      const {uin,authst,tmeLoginType}=qqMusicIdentity(cookies);
      if(session.userId!==undefined&&session.userId!==uin)throw new QQAccountProfileError('login_required');
      const headers={Cookie:Object.entries(cookies).map(([name,value])=>`${name}=${value}`).join('; '),Referer:'https://y.qq.com/',Origin:'https://y.qq.com',Accept:'application/json'};
      const profile=object(await this.options.http(`https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg?ct=20&cv=4747474&cid=205360838&userid=${uin}`,{method:'GET',headers,credentials:'omit'},signal));
      check();
      if(profile.code!==0)throw new QQAccountProfileError(profile.code===401||profile.code===403?'login_required':'unavailable');
      const creator=object(object(profile.data).creator);
      const nickname=typeof creator.nick==='string'?creator.nick:typeof creator.nickname==='string'?creator.nickname:'';
      if(!nickname.trim()||nickname.length>120||/[\u0000-\u001f\u007f]/.test(nickname))throw new QQAccountProfileError('unavailable');
      const raw=object(await this.options.http('https://u.y.qq.com/cgi-bin/musicu.fcg',{
        method:'POST',credentials:'omit',headers:{...headers,'Content-Type':'application/json;charset=UTF-8'},
        body:JSON.stringify({comm:{uin,authst,ct:24,cv:0,format:'json',tmeAppID:'qqmusic',tmeLoginType},status:{module:'music.musicasset.PlaylistBaseRead',method:'GetPlaylistByUin',param:{uin}}}),
      },signal));
      check();
      const status=object(raw.status);
      if(raw.code!==0||status.code!==0||!status.data||typeof status.data!=='object'||Array.isArray(status.data))throw new QQAccountProfileError('login_required');
      // Only the authorization result is consumed. Never save or expose lists.
      const encryptedUin=creator.encrypt_uin;
      return{userId:uin,nickname:nickname.trim(),...(typeof encryptedUin==='string'&&encryptedUin.length>0&&encryptedUin.length<=1024&&!/[\u0000-\u001f\u007f]/.test(encryptedUin)?{encryptedUin}:{})};
    }catch(error){
      check();
      if(error instanceof QQAccountProfileError)throw error;
      if(error instanceof MusicAuthError||error instanceof HTTPResponseError&&(error.status===401||error.status===403))throw new QQAccountProfileError('login_required');
      throw new QQAccountProfileError('unavailable');
    }
  }
}
