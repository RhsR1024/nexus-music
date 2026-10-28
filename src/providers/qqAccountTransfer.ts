// Q-music 5db858f accountTransfer/qqImportedSession wire semantics (Apache-2.0).
// Own confirmation coordinator: secrets stay private until a guarded Keychain save.
import type {MusicAccount,MusicAccounts,MusicSession} from './musicAccounts.ts';
import {parseQQCookiePayload,qqMusicIdentity,type QQAccountProfileClient} from './qqAccountProfile.ts';
export interface QQTransferNative {receiveQQTransfer(id:string,code:string):Promise<string>;scanQQTransfer(id:string):Promise<string|null>;cancelQQTransfer(id:string):Promise<void>}
export type QQTransferStatus='idle'|'scanning'|'connecting'|'verifying'|'confirm'|'saving'|'succeeded'|'cancelled'|'expired'|'failed';
export interface QQTransferSnapshot {readonly status:QQTransferStatus;readonly generation:number;readonly name?:string;readonly hint?:string;readonly reason?:'camera'|'storage'}
class QQTransferExpired extends Error {}
const allowed=new Set(['qqmusic_key','musickey','qqmusic_uin','musicid','login_type','wxuin','uin']);
export function parseQQTransferPayload(raw:string,now:number){
  if(raw.length>32768)throw Error('invalid');
  const p=JSON.parse(raw) as Record<string,unknown>;
  if(!p||p.v!==1||p.provider!=='tx'||typeof p.expiresAt!=='number'||!Number.isFinite(p.expiresAt)||p.expiresAt>now+180000||!p.cookies||typeof p.cookies!=='object'||Array.isArray(p.cookies))throw Error('invalid');
  if(p.expiresAt<=now)throw new QQTransferExpired();
  for(const [name,value]of Object.entries(p.cookies))if(!allowed.has(name)||typeof value!=='string'||!value||value.length>4096||!/^[!-:<-~]+$/.test(value))throw Error('invalid');
  const cookies=parseQQCookiePayload(JSON.stringify(p.cookies),'music'),identity=qqMusicIdentity(cookies);
  if(!['1','2'].includes(cookies.login_type??'')||cookies.qqmusic_uin!==identity.uin||cookies.qqmusic_key!==identity.authst)throw Error('invalid');
  return{cookies,identity,expiresAt:p.expiresAt};
}
export class QQAccountTransfer {
  private value:QQTransferSnapshot={status:'idle',generation:0};private readonly listeners=new Set<()=>void>();
  private controller?:AbortController;private attempt?:string;private deadline?:ReturnType<typeof setTimeout>;private unsubscribe?:()=>void;
  private candidate?:{expiresAt:number;username:string;name:string;session:MusicSession;expected:MusicAccount|null};
  private readonly deps:{native:QQTransferNative;accounts:Pick<MusicAccounts,'getSnapshot'|'subscribe'|'save'>;profile:Pick<QQAccountProfileClient,'fetch'>;hash:(value:string)=>Promise<string>;uuid:()=>string;now?:()=>number};
  constructor(deps:QQAccountTransfer['deps']){this.deps=deps;}
  getSnapshot=()=>this.value;
  subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
  private publish(value:QQTransferSnapshot){this.value=value;for(const fn of this.listeners)fn();}
  private stop(){clearTimeout(this.deadline);this.deadline=undefined;this.unsubscribe?.();this.unsubscribe=undefined;this.controller?.abort();this.controller=undefined;this.candidate=undefined;const id=this.attempt;this.attempt=undefined;if(id)void this.deps.native.cancelQQTransfer(id).catch(()=>{});}
  cancel=()=>{if(['idle','succeeded','cancelled','expired','failed'].includes(this.value.status))return;this.stop();this.publish({status:'cancelled',generation:this.value.generation});};
  async connect(code?:string):Promise<void>{
    this.stop();const generation=this.value.generation+1,controller=new AbortController(),id=this.deps.uuid();this.controller=controller;this.attempt=id;
    const active=()=>this.controller===controller&&!controller.signal.aborted;
    const now=()=> (this.deps.now??Date.now)();
    const check=()=>{if(!active())throw Error('cancelled');};
    const initial=this.deps.accounts.getSnapshot().filter(a=>a.platform==='tx');
    this.unsubscribe=this.deps.accounts.subscribe(()=>{const current=this.deps.accounts.getSnapshot().filter(a=>a.platform==='tx');if(current.length!==initial.length||initial.some(a=>!current.includes(a)))this.cancel();});
    this.publish({status:code===undefined?'scanning':'connecting',generation});
    // Includes scanner interaction; no unattended attempt survives indefinitely.
    this.deadline=setTimeout(()=>{if(active()){this.stop();this.publish({status:'expired',generation});}},180000);
    try{
      const input=code??await this.deps.native.scanQQTransfer(id);check();
      if(input===null){this.cancel();return;}
      this.publish({status:'connecting',generation});
      const raw=await this.deps.native.receiveQQTransfer(id,input);check();
      const payload=parseQQTransferPayload(raw,now());
      clearTimeout(this.deadline);this.deadline=setTimeout(()=>{if(active()){this.stop();this.publish({status:'expired',generation});}},payload.expiresAt-now());
      this.publish({status:'verifying',generation});
      const profile=await this.deps.profile.fetch({platform:'tx',userId:payload.identity.uin,cookies:payload.cookies},controller.signal);check();
      if(profile.userId!==payload.identity.uin)throw Error('invalid');if(payload.expiresAt<=now())throw new QQTransferExpired();
      const username=`qq:${payload.identity.tmeLoginType}:${profile.userId}`,accountId=await this.deps.hash(JSON.stringify(['tx',username]));check();
      if(payload.expiresAt<=now())throw new QQTransferExpired();
      const name=profile.nickname,expected=initial.find(a=>a.username===username)??null;
      this.candidate={expiresAt:payload.expiresAt,username,name,expected,session:{version:1,platform:'tx',accountId,userId:profile.userId,cookies:payload.cookies}};
      this.publish({status:'confirm',generation,name,hint:`${payload.identity.tmeLoginType===1?'微信':'QQ'} · ••••${profile.userId.slice(-4)}`});
    }catch(error){if(active()){const code=(error as {code?:unknown})?.code;this.stop();this.publish({status:code==='TRANSFER_CANCELLED'?'cancelled':code==='TRANSFER_EXPIRED'||error instanceof QQTransferExpired?'expired':'failed',generation,...(code==='TRANSFER_CAMERA'?{reason:'camera' as const}:{})});}}
  }
  async confirm():Promise<void>{
    const candidate=this.candidate,controller=this.controller,generation=this.value.generation;
    if(!candidate||!controller||this.value.status!=='confirm')return;
    if(candidate.expiresAt<=(this.deps.now??Date.now)()){this.stop();this.publish({status:'expired',generation});return;}
    // Store's expected-object check protects the selected identity while queued.
    // Remove our observer before our own successful publication replaces it.
    this.unsubscribe?.();this.unsubscribe=undefined;this.publish({status:'saving',generation,name:candidate.name,hint:this.value.hint});
    try{
      await this.deps.accounts.save({platform:'tx',username:candidate.username,label:'QQ 音乐',displayName:candidate.name,capabilities:[]},candidate.session,controller.signal,candidate.expected);
      if(this.controller!==controller||controller.signal.aborted)return;
      this.stop();this.publish({status:'succeeded',generation});
    }catch{if(this.controller===controller){this.stop();this.publish({status:'failed',generation,reason:'storage'});}}
  }
}
