import type {MusicAccount, MusicAccounts, MusicSession} from './musicAccounts.ts';
import {MusicAuthError,type MusicAuthEvent,type MusicAuthFlow} from './musicAuth.ts';
import type {NeteaseAccountProfileClient} from './neteaseAccountProfile.ts';
import {parseQQCookiePayload,type QQAccountProfileClient} from './qqAccountProfile.ts';

export type MusicWebLoginProvider='wy'|'tx';
// Official QQ Connect entry from Q-music-android 5db858f/login.ts. Use its
// default web presentation instead of the app-only mobile one-key screen.
const qqRedirect='https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https%3A%2F%2Fy.qq.com%2F';
export const MUSIC_WEB_LOGIN_URLS:{readonly [P in MusicWebLoginProvider]:string}={
  wy:'https://music.163.com/m/login',
  tx:`https://graph.qq.com/oauth2.0/authorize?client_id=100497308&redirect_uri=${encodeURIComponent(qqRedirect)}&response_type=code&scope=all`,
};

export interface MusicWebAuthNative {
  open(id:string,provider:MusicWebLoginProvider,url:string):Promise<string>;
  cancel(id:string):Promise<void>;
}

type MusicWebSession=MusicSession&{
  readonly version:1;
  readonly platform:MusicWebLoginProvider;
  readonly accountId:string;
  readonly cookies:Readonly<Record<string,string>>;
};

export interface MusicWebLoginResult {
  readonly account:MusicAccount;
  readonly session:MusicWebSession;
}

const allowedCookies=new Set(['MUSIC_U','MUSIC_A_T','MUSIC_R_T','MUSIC_SNS','__csrf','NMTID','_ntes_nuid']);
const cookieName=/^[A-Za-z_][A-Za-z0-9_]*$/;
const invalidCookieValue=/[\u0000-\u001f\u007f;]/;

/**
 * The native bridge returns only cookies read from the WebKit store. Keep the
 * small authentication subset needed by the account API and reject values that
 * could alter a Cookie header.
 */
export function parseNeteaseCookiePayload(raw:string):Readonly<Record<string,string>>{
  let value:unknown;
  try{value=JSON.parse(raw);}catch{throw new MusicAuthError('failed','登录结果格式无效');}
  if(!value||typeof value!=='object'||Array.isArray(value))throw new MusicAuthError('failed','登录结果格式无效');
  const source=value as Record<string,unknown>,cookies:Record<string,string>={};
  for(const name of allowedCookies){
    const cookie=source[name];
    if(cookie===undefined)continue;
    if(typeof cookie!=='string'||!cookie||cookie.length>4096||!cookieName.test(name)||invalidCookieValue.test(cookie))throw new MusicAuthError('failed','登录凭据格式无效');
    cookies[name]=cookie;
  }
  if(!cookies.MUSIC_U)throw new MusicAuthError('failed','网易云登录未完成');
  return Object.freeze(cookies);
}

export function musicCookieHeader(cookies:Readonly<Record<string,string>>):string{
  return Object.entries(cookies).map(([name,value])=>`${name}=${value}`).join('; ');
}

function eventFromNativeError(error:unknown):MusicAuthEvent<Record<string,unknown>>{
  const code=typeof error==='object'&&error?String((error as {code?:unknown}).code??''):'';
  if(code==='AUTH_CANCELLED')return{type:'cancel'};
  if(code==='AUTH_EXPIRED')return{type:'expired'};
  return{type:'error',error};
}

export class MusicWebLoginCoordinator {
  private readonly native:MusicWebAuthNative;
  private readonly flow:Pick<MusicAuthFlow<Record<string,unknown>>,'start'|'cancel'|'subscribe'|'getSnapshot'>;
  private readonly accounts:Pick<MusicAccounts,'save'>;
  private readonly profile:NeteaseAccountProfileClient;
  private readonly qqProfile?:QQAccountProfileClient;
  private readonly hash:(value:string)=>Promise<string>;
  private readonly uuid:()=>string;
  constructor(dependencies:{native:MusicWebAuthNative;flow:Pick<MusicAuthFlow<Record<string,unknown>>,'start'|'cancel'|'subscribe'|'getSnapshot'>;accounts:Pick<MusicAccounts,'save'>;profile:NeteaseAccountProfileClient;qqProfile?:QQAccountProfileClient;hash:(value:string)=>Promise<string>;uuid:()=>string}){
    this.native=dependencies.native;this.flow=dependencies.flow;this.accounts=dependencies.accounts;this.profile=dependencies.profile;this.hash=dependencies.hash;this.uuid=dependencies.uuid;
    this.qqProfile=dependencies.qqProfile;
  }
  getSnapshot=()=>this.flow.getSnapshot();
  subscribe=(listener:()=>void)=>this.flow.subscribe(listener);
  cancel=()=>{this.flow.cancel();};

  async login(provider:MusicWebLoginProvider='wy'):Promise<MusicWebLoginResult>{
    if(provider!=='wy'&&provider!=='tx'||provider==='tx'&&!this.qqProfile)throw new MusicAuthError('failed','该平台登录尚未接入');
    const parse=provider==='wy'?parseNeteaseCookiePayload:parseQQCookiePayload;
    const attempt=this.uuid(),url=MUSIC_WEB_LOGIN_URLS[provider]+(provider==='tx'?`&state=${encodeURIComponent(attempt)}`:'');
    const raw=await this.flow.start(emit=>{
      let active=true;
      const controller=new AbortController();
      void this.native.open(attempt,provider,url).then(async result=>{
        if(!active)return;
        try{
          const cookies=parse(result);
          const profile=await (provider==='wy'?this.profile:this.qqProfile!).fetch({platform:provider,cookies},controller.signal);
          if(!active)return;
          const username=provider==='wy'?`netease:${profile.userId}`:`qq:2:${profile.userId}`;
          const accountId=await this.hash(JSON.stringify([provider,username]));
          if(!active)return;
          const session:MusicWebSession=Object.freeze({version:1,platform:provider,accountId,userId:profile.userId,cookies});
          // Authorization remains waiting/cancellable through the store's own
          // hash and both writes. Success is published only after commit.
          const account=await this.accounts.save({platform:provider,label:provider==='wy'?'网易云音乐':'QQ 音乐',username,displayName:profile.nickname,capabilities:provider==='wy'?['daily','fm']:[]},session,controller.signal);
          if(active)emit({type:'success',value:{account,session}});
        }
        catch(error){emit({type:'error',error});}
      },error=>{if(active)emit(eventFromNativeError(error));});
      return()=>{active=false;controller.abort();void this.native.cancel(attempt).catch(()=>{});};
    });
    return{account:raw.account as MusicAccount,session:raw.session as MusicWebSession};
  }
}
