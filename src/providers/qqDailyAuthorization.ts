import {MusicAuthError,MusicAuthFlow} from './musicAuth.ts';
import type {MusicAccount,MusicAccounts} from './musicAccounts.ts';
import {parseQQCookiePayload,qqMusicIdentity,type QQAccountProfileClient} from './qqAccountProfile.ts';
import {validQQDailyKey,type QQDailyClient} from './qqDaily.ts';

export interface QQDailyAuthNative{openQQDaily(id:string):Promise<string>;cancel(id:string):Promise<void>}
/** The native page owns its fresh web login. Only the key paired with that
 * page's verified QQ identity can enter the matching Keychain session. */
export class QQDailyAuthorization{
  private readonly flow=new MusicAuthFlow<void>();
  private readonly options:{native:QQDailyAuthNative;accounts:Pick<MusicAccounts,'getSnapshot'|'session'|'save'>;profile:Pick<QQAccountProfileClient,'fetch'>;daily:Pick<QQDailyClient,'validateKey'>;hash:(value:string)=>Promise<string>;uuid:()=>string};
  constructor(options:QQDailyAuthorization['options']){this.options=options;}
  getSnapshot=()=>this.flow.getSnapshot();
  subscribe=(listener:()=>void)=>this.flow.subscribe(listener);
  cancel=()=>this.flow.cancel();
  authorize(target?:MusicAccount):Promise<void>{
    return this.flow.start(emit=>{
      const controller=new AbortController(),attempt=this.options.uuid(),initial=this.options.accounts.getSnapshot();let active=true,bound=target;
      const current=()=>{if(!active||controller.signal.aborted)throw new MusicAuthError('cancelled','授权已取消');if(bound&&!this.options.accounts.getSnapshot().includes(bound))throw new Error('账号已更改');};
      void(async()=>{
        try{
          current();if(target&&target.platform!=='tx')throw new Error('平台不支持');
          const raw=await this.options.native.openQQDaily(attempt);current();
          if(raw.length>40000)throw new Error('授权结果无效');
          const payload=JSON.parse(raw) as {key?:unknown;cookies?:unknown};
          if(!payload||!validQQDailyKey(payload.key))throw new Error('授权结果无效');
          const cookies=parseQQCookiePayload(JSON.stringify(payload.cookies),'music');
          const {uin,tmeLoginType}=qqMusicIdentity(cookies),username=`qq:${tmeLoginType}:${uin}`;
          bound=target??initial.find(item=>item.platform==='tx'&&item.username===username);current();
          const identityKeys=tmeLoginType===1?['wxuin','qqmusic_uin','musicid']:['uin','qqmusic_uin','musicid'];
          const identities=new Set(identityKeys.flatMap(name=>{const value=cookies[name];const normalized=value&&/^o?\d{1,20}$/i.test(value)?value.replace(/^o/i,'').replace(/^0+/,''):'';return normalized?[normalized]:[];}));
          if(identities.size!==1||target&&target.username!==username)throw new Error('账号身份不符');
          const profile=await this.options.profile.fetch({platform:'tx',userId:uin,cookies},controller.signal);current();
          if(profile.userId!==uin)throw new Error('账号身份不符');
          const accountId=await this.options.hash(JSON.stringify(['tx',username]));current();
          const session={version:1,platform:'tx',accountId,userId:uin,cookies,qqDailyKey:payload.key,qqDailyKeyOwner:accountId};
          const existing=bound??this.options.accounts.getSnapshot().find(item=>item.id===accountId);
          await this.options.daily.validateKey({id:accountId,platform:'tx',username,label:'QQ 音乐',capabilities:[],updatedAt:0},session,payload.key,controller.signal);current();
          const avatar=('avatar' in profile&&typeof profile.avatar==='string'&&profile.avatar)||existing?.avatar;
          await this.options.accounts.save({platform:'tx',username,label:'QQ 音乐',displayName:profile.nickname,...(avatar?{avatar}:{}),capabilities:[...new Set([...(existing?.capabilities??[]),'daily' as const])]},session,controller.signal,existing??null);
          if(!active||controller.signal.aborted)throw new MusicAuthError('cancelled','授权已取消');
          if(active)emit({type:'success',value:undefined});
        }catch(error){if(active){const code=(error as {code?:unknown})?.code;if(code==='AUTH_CANCELLED')emit({type:'cancel'});else if(code==='AUTH_EXPIRED')emit({type:'expired'});else emit({type:'error',error});}}
      })();
      return()=>{active=false;controller.abort();void this.options.native.cancel(attempt).catch(()=>{});};
    });
  }
  async saveManualKey(account:MusicAccount,rawKey:string,signal:AbortSignal):Promise<void>{
    if(account.platform!=='tx')throw new Error('平台不支持');
    const key=rawKey.trim();
    if(!validQQDailyKey(key))throw new Error('请输入有效的 qmk- 官方 Skills 密钥');
    this.cancel();
    const existingSession={...await this.options.accounts.session(account.id)};
    const nextSession={...existingSession,qqDailyKey:key,qqDailyKeyOwner:account.id};
    await this.options.daily.validateKey(account,nextSession,key,signal);
    if(signal.aborted)throw new MusicAuthError('cancelled','授权已取消');
    await this.options.accounts.save({
      platform:account.platform,
      username:account.username,
      label:account.label,
      ...(account.displayName?{displayName:account.displayName}:{}),
      ...(account.avatar?{avatar:account.avatar}:{}),
      capabilities:[...new Set([...account.capabilities,'daily' as const])],
    },nextSession,signal,account);
  }
  async clear(account:MusicAccount,signal:AbortSignal){
    if(account.platform!=='tx')throw new Error('平台不支持');
    this.cancel();
    const session={...await this.options.accounts.session(account.id)};
    delete session.qqDailyKey;delete session.qqDailyKeyOwner;
    await this.options.accounts.save({platform:account.platform,username:account.username,label:account.label,...(account.displayName?{displayName:account.displayName}:{}),...(account.avatar?{avatar:account.avatar}:{}),capabilities:account.capabilities.filter(value=>value!=='daily')},session,signal,account);
  }
}
