import type {HTTPClient,HTTPRequest} from './http.ts';
import {HTTPResponseError} from './http.ts';
import type {MusicSession} from './musicAccounts.ts';
import {musicCookieHeader,parseNeteaseCookiePayload} from './musicWebLogin.ts';
import {DESKTOP_UA,neteaseWeapiRequest} from './neteaseSession.ts';
import {throwIfAborted} from './async.ts';
import {normalizeAccountAvatar} from '../domain/accountAvatar.ts';

export interface NeteaseAccountProfile {
  readonly userId:string;
  readonly nickname:string;
  readonly avatar?:string;
}

export class NeteaseAccountProfileError extends Error {
  readonly kind:'login_required'|'unavailable'|'cancelled';
  constructor(kind:'login_required'|'unavailable'|'cancelled'){
    super(kind==='login_required'?'网易云登录已失效，请重新登录':kind==='cancelled'?'账号验证已取消':'暂时无法验证网易云账号');
    this.kind=kind;
  }
}

const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const text=(value:unknown)=>typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';

export function parseNeteaseAccountProfile(raw:unknown):NeteaseAccountProfile{
  const response=object(raw),profile=object(response.profile),account=object(response.account);
  if(response.code!==200)throw new NeteaseAccountProfileError(response.code===301||response.code===401||response.code===403?'login_required':'unavailable');
  const userId=text(profile.userId)||text(account.id);
  const nickname=text(profile.nickname).trim();
  if(!/^\d{1,20}$/.test(userId)||!nickname||nickname.length>120||/[\u0000-\u001f\u007f]/.test(nickname))throw new NeteaseAccountProfileError('login_required');
  const avatar=normalizeAccountAvatar(profile.avatarUrl);
  return Object.freeze({userId,nickname,...(avatar?{avatar}:{})});
}

export interface NeteaseAccountProfileClientOptions {
  readonly http?:HTTPClient;
  readonly endpoint?:string;
}

const DEFAULT_ACCOUNT_ENDPOINT='https://music.163.com/api/nuser/account/get';
const WEAPI_ACCOUNT_ENDPOINT='https://music.163.com/weapi/nuser/account/get';

/** Validates the web session by reading its own official account profile. */
export class NeteaseAccountProfileClient {
  private readonly http:HTTPClient;
  private readonly endpoint:string;
  constructor(options:NeteaseAccountProfileClientOptions={}){
    this.http=options.http??(async()=>{throw new NeteaseAccountProfileError('unavailable');});
    this.endpoint=options.endpoint??DEFAULT_ACCOUNT_ENDPOINT;
  }
  async fetch(session:MusicSession,signal:AbortSignal):Promise<NeteaseAccountProfile>{
    try{throwIfAborted(signal);}catch{throw new NeteaseAccountProfileError('cancelled');}
    const cookies=parseNeteaseCookiePayload(JSON.stringify(object(session.cookies)));
    const cookieHeader=musicCookieHeader(cookies);
    const request:HTTPRequest={
      method:'GET',
      credentials:'omit',
      headers:{
        Accept:'application/json',
        Cookie:cookieHeader,
        Referer:'https://music.163.com/',
        Origin:'https://music.163.com',
        'User-Agent':DESKTOP_UA,
      },
    };
    const classifyError=(error:unknown):NeteaseAccountProfileError=>{
      if(signal.aborted||(error instanceof NeteaseAccountProfileError&&error.kind==='cancelled'))return new NeteaseAccountProfileError('cancelled');
      if(error instanceof NeteaseAccountProfileError)return error;
      if(error instanceof HTTPResponseError&&(error.status===401||error.status===403))return new NeteaseAccountProfileError('login_required');
      return new NeteaseAccountProfileError('unavailable');
    };
    try{
      const raw=await this.http(this.endpoint,request,signal);
      try{throwIfAborted(signal);}catch{throw new NeteaseAccountProfileError('cancelled');}
      return parseNeteaseAccountProfile(raw);
    }catch(primaryError){
      const classified=classifyError(primaryError);
      if(classified.kind==='cancelled'||this.endpoint!==DEFAULT_ACCOUNT_ENDPOINT)throw classified;
      const weapiRequest=neteaseWeapiRequest({},{
        cookie:`${cookieHeader}; os=pc; appver=2.10.13; channel=netease`,
        csrf:cookies.__csrf??'',
      });
      try{
        const fallbackRaw=await this.http(WEAPI_ACCOUNT_ENDPOINT,{...weapiRequest,credentials:'omit'},signal);
        try{throwIfAborted(signal);}catch{throw new NeteaseAccountProfileError('cancelled');}
        return parseNeteaseAccountProfile(fallbackRaw);
      }catch(fallbackError){
        const fallbackClassified=classifyError(fallbackError);
        if(fallbackClassified.kind==='cancelled')throw fallbackClassified;
        throw classified;
      }
    }
  }
}
