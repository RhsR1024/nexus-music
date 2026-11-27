// QR & SMS login protocols adapted from Q-music Android 5db858f, kugouApi.ts
// (Apache-2.0), with MakcRe/KuGouMusicApi MIT attribution retained (licenses/kugou-api-mit.txt).
// NexusMusic owns cancellation, validation and storage; no playlist APIs.
import {bounded,throwIfAborted} from './async.ts';
import {HTTPResponseError,queryURL,type HTTPClient} from './http.ts';
import {kugouAesDecrypt,kugouAesEncrypt,kugouRsaEncrypt} from './kugouCrypto.ts';
import {normalizeAccountAvatar} from '../domain/accountAvatar.ts';

export interface KugouQr {readonly key:string;readonly image:string;readonly mid:string;readonly expiresAt:number}
export interface KugouSession {readonly userId:string;readonly token:string;readonly mid:string;readonly nickname:string;readonly avatar?:string}
export type KugouQrResult={status:'waiting'|'scanned'|'expired'}|{status:'connected';session:KugouSession};
export type KugouLoginErrorKind='cancelled'|'unavailable'|'login_required'|'invalid_input'|'captcha_required';
export class KugouLoginError extends Error {
  readonly kind:KugouLoginErrorKind;
  constructor(kind:KugouLoginErrorKind='unavailable',customMessage?:string){
    super(customMessage??(kind==='cancelled'?'酷狗登录已取消':kind==='login_required'?'酷狗登录已失效，请重新登录':kind==='invalid_input'?'请输入正确的 11 位手机号和验证码':kind==='captcha_required'?'酷狗触发了人机安全验证，请改用「扫码登录」完成授权':'酷狗登录服务暂时不可用，请重试'));
    this.kind=kind;
  }
}
const row=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const opaque=(value:unknown):value is string=>typeof value==='string'&&value.length>0&&value.length<=4096&&!/[\u0000-\u0020\u007f]/.test(value);
const numericId=(value:unknown)=>typeof value==='number'&&!Number.isSafeInteger(value)?'':typeof value==='string'||typeof value==='number'?/^[0-9]{1,20}$/.test(String(value))?String(value).replace(/^0+/,''):'' :'';

/** Bound decoded dimensions as well as URI size before passing PNG to UIKit. */
export function validKugouQrImage(value:unknown):value is string {
  if(typeof value!=='string'||value.length>2*1024*1024||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return false;
  const encoded=value.slice(22);if(encoded.length%4!==0||encoded.length<32)return false;
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',bytes:number[]=[];
  for(let i=0;i<32;i+=4){const n=(alphabet.indexOf(encoded.charAt(i))<<18)|(alphabet.indexOf(encoded.charAt(i+1))<<12)|(alphabet.indexOf(encoded.charAt(i+2))<<6)|alphabet.indexOf(encoded.charAt(i+3));bytes.push((n>>>16)&255,(n>>>8)&255,n&255);}
  if([137,80,78,71,13,10,26,10].some((v,i)=>bytes[i]!==v)||String.fromCharCode(...bytes.slice(12,16))!=='IHDR')return false;
  const dimension=(offset:number)=>bytes[offset]!*16777216+bytes[offset+1]!*65536+bytes[offset+2]!*256+bytes[offset+3]!;
  return [dimension(16),dimension(20)].every(size=>size>=32&&size<=1024);
}

export class KugouLoginClient {
  private readonly options:{http:HTTPClient;md5:(value:string)=>Promise<string>;nonce:()=>string;now?:()=>number};
  constructor(options:KugouLoginClient['options']){this.options=options;}
  private now(){return(this.options.now??Date.now)();}
  private async call(path:'/v2/qrcode'|'/v2/get_userinfo_qrcode',params:Record<string,string|number>,mid:string,signal:AbortSignal){
    try{
      return await bounded(async child=>{
        const query:Record<string,string|number>={dfid:'-',mid,uuid:'-',appid:1005,clientver:20489,clienttime:Math.floor(this.now()/1000),...params};
        const salt='NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt';
        const signature=await this.options.md5(salt+Object.keys(query).sort().map(key=>`${key}=${query[key]}`).join('')+salt);
        throwIfAborted(child);
        if(!/^[a-f0-9]{32}$/.test(signature))throw new KugouLoginError();
        const result=row(await this.options.http(queryURL('https://login-user.kugou.com'+path,{...query,signature}),{method:'GET',credentials:'omit',headers:{'Content-Type':'application/json',dfid:'-',mid,clienttime:String(query.clienttime)}},child));
        throwIfAborted(child);
        if(![1,'1'].includes(result.status as number|string)||result.error_code!==undefined&&![0,'0'].includes(result.error_code as number|string)||!result.data||typeof result.data!=='object'||Array.isArray(result.data))throw new KugouLoginError();
        return row(result.data);
      },signal,12_000);
    }catch(error){
      if(signal.aborted)throw new KugouLoginError('cancelled');
      if(error instanceof HTTPResponseError&&(error.status===401||error.status===403))throw new KugouLoginError('login_required');
      // Transport exceptions can contain the QR key or later session token.
      throw new KugouLoginError();
    }
  }
  async create(signal:AbortSignal):Promise<KugouQr>{
    throwIfAborted(signal);
    const expiresAt=this.now()+120_000,mid=await this.options.md5(this.options.nonce());
    throwIfAborted(signal);
    if(!/^[a-f0-9]{32}$/.test(mid))throw new KugouLoginError();
    const data=await this.call('/v2/qrcode',{type:1,plat:4,srcappid:2919,qrcode_txt:'https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=1005&'},mid,signal);
    if(!opaque(data.qrcode)||!validKugouQrImage(data.qrcode_img))throw new KugouLoginError();
    return{key:data.qrcode,image:data.qrcode_img,mid,expiresAt};
  }
  async poll(qr:KugouQr,signal:AbortSignal):Promise<KugouQrResult>{
    throwIfAborted(signal);
    if(!opaque(qr.key)||!/^[a-f0-9]{32}$/.test(qr.mid)||!Number.isFinite(qr.expiresAt))throw new KugouLoginError();
    if(this.now()>=qr.expiresAt)return{status:'expired'};
    const data=await this.call('/v2/get_userinfo_qrcode',{plat:4,srcappid:2919,qrcode:qr.key},qr.mid,signal);
    if(this.now()>=qr.expiresAt)return{status:'expired'};
    if(data.status===0||data.status==='0')return{status:'expired'};
    if(data.status===1||data.status==='1')return{status:'waiting'};
    if(data.status===2||data.status==='2')return{status:'scanned'};
    const userId=numericId(data.userid);
    if(![4,'4'].includes(data.status as number|string)||!userId||!opaque(data.token))throw new KugouLoginError();
    const nickname=typeof data.nickname==='string'&&data.nickname.trim()&&data.nickname.length<=120&&!/[\u0000-\u001f\u007f]/.test(data.nickname)?data.nickname.trim():'酷狗账号';
    const avatar=normalizeAccountAvatar(data.pic??data.picurl);
    return{status:'connected',session:{userId,token:data.token,mid:qr.mid,nickname,...(avatar?{avatar}:{})}};
  }

  private async androidPost(baseUrl:string,path:string,bodyObj:Record<string,unknown>,mid:string,extraHeaders:Record<string,string>,signal:AbortSignal){
    return bounded(async child=>{
      const clienttime=Math.floor(this.now()/1000);
      const query:Record<string,string|number>={dfid:'-',mid,uuid:'-',appid:1005,clientver:20489,clienttime};
      const body=JSON.stringify(bodyObj);
      const salt='OIlwieks28dk2k092lksi2UIkp';
      const signature=await this.options.md5(salt+Object.keys(query).sort().map(key=>`${key}=${query[key]}`).join('')+body+salt);
      throwIfAborted(child);
      if(!/^[a-f0-9]{32}$/.test(signature))throw new KugouLoginError();
      const result=row(await this.options.http(queryURL(baseUrl+path,{...query,signature}),{
        method:'POST',
        credentials:'omit',
        headers:{'Content-Type':'application/json; charset=UTF-8',dfid:'-',mid,clienttime:String(clienttime),...extraHeaders},
        body,
      },child));
      throwIfAborted(child);
      return result;
    },signal,12_000);
  }

  async sendPhoneCode(rawMobile:string,signal:AbortSignal,existingMid?:string):Promise<{readonly mid:string}>{
    throwIfAborted(signal);
    const mobile=rawMobile.trim();
    if(!/^1\d{10}$/.test(mobile))throw new KugouLoginError('invalid_input','请输入正确的 11 位手机号');
    const mid=existingMid&&/^[a-f0-9]{32}$/.test(existingMid)?existingMid:await this.options.md5(this.options.nonce());
    throwIfAborted(signal);
    if(!/^[a-f0-9]{32}$/.test(mid))throw new KugouLoginError();
    try{
      const result=await this.androidPost('https://login.user.kugou.com','/v7/send_mobile_code',{businessid:5,mobile,plat:3},mid,{},signal);
      const ok=[1,'1'].includes(result.status as number|string)&&(result.error_code===undefined||[0,'0'].includes(result.error_code as number|string));
      if(ok)return{mid};
      const errCode=Number(result.error_code??0);
      const errText=String(result.data??result.error_msg??result.err_msg??'');
      if(errCode===20028||errCode===30001||/验证|人机|安全|captcha|ssa/i.test(errText)){
        throw new KugouLoginError('captcha_required');
      }
      throw new KugouLoginError('unavailable','验证码发送失败，请稍后重试或改用扫码登录');
    }catch(error){
      if(signal.aborted)throw new KugouLoginError('cancelled');
      if(error instanceof KugouLoginError)throw error;
      throw new KugouLoginError('unavailable','验证码发送失败，请稍后重试或改用扫码登录');
    }
  }

  async loginByPhone(rawMobile:string,rawCode:string,mid:string,signal:AbortSignal):Promise<KugouSession>{
    throwIfAborted(signal);
    const mobile=rawMobile.trim(),code=rawCode.trim();
    if(!/^1\d{10}$/.test(mobile))throw new KugouLoginError('invalid_input','请输入正确的 11 位手机号');
    if(!/^\d{4,8}$/.test(code))throw new KugouLoginError('invalid_input','请输入有效的短信验证码');
    const sessionMid=/^[a-f0-9]{32}$/.test(mid)?mid:await this.options.md5(this.options.nonce());
    throwIfAborted(signal);
    try{
      const dateTime=this.now();
      const encrypted=await kugouAesEncrypt({mobile,code},this.options.md5);
      throwIfAborted(signal);
      const maskedMobile=`${mobile.slice(0,2)}*****${mobile.slice(10,11)}`;
      const paramsKey=await this.options.md5(`1005OIlwieks28dk2k092lksi2UIkp20489${dateTime}`);
      throwIfAborted(signal);
      const pk=kugouRsaEncrypt({clienttime_ms:dateTime,key:encrypted.key});
      const dataMap={
        plat:1,
        support_multi:1,
        t1:0,
        t2:0,
        t3:'MCwwLDAsMCwwLDAsMCwwLDA=',
        clienttime_ms:dateTime,
        mobile:maskedMobile,
        key:paramsKey,
        pk,
        params:encrypted.str,
      };
      const result=await this.androidPost(
        'https://loginserviceretry.kugou.com',
        '/v7/login_by_verifycode',
        dataMap,
        sessionMid,
        {'support-calm':'1','User-Agent':'Android16-1070-11440-130-0-LOGIN-wifi'},
        signal,
      );
      if(![1,'1'].includes(result.status as number|string)||(result.error_code!==undefined&&![0,'0'].includes(result.error_code as number|string))||!result.data||typeof result.data!=='object'||Array.isArray(result.data)){
        throw new KugouLoginError('unavailable','登录失败，请检查验证码是否正确或改用扫码登录');
      }
      let merged:Record<string,unknown>={...row(result.data)};
      if(typeof merged.secu_params==='string'&&merged.secu_params.length>0){
        const decrypted=await kugouAesDecrypt(merged.secu_params,encrypted.key,this.options.md5);
        if(decrypted&&typeof decrypted==='object'&&!Array.isArray(decrypted)){
          merged={...merged,...row(decrypted)};
        }else if(typeof decrypted==='string'&&decrypted.trim()){
          merged={...merged,token:decrypted.trim()};
        }
      }
      const userId=numericId(merged.userid);
      const token=merged.token;
      if(!userId||!opaque(token))throw new KugouLoginError('unavailable','酷狗登录响应缺少有效凭据，请重试');
      const rawName=merged.nickname??merged.nick_name??merged.username;
      const nickname=typeof rawName==='string'&&rawName.trim()&&rawName.length<=120&&!/[\u0000-\u001f\u007f]/.test(rawName)?rawName.trim():'酷狗账号';
      const avatar=normalizeAccountAvatar(merged.pic??merged.picurl);
      return{userId,token,mid:sessionMid,nickname,...(avatar?{avatar}:{})};
    }catch(error){
      if(signal.aborted)throw new KugouLoginError('cancelled');
      if(error instanceof KugouLoginError)throw error;
      throw new KugouLoginError('unavailable','登录失败，请检查验证码是否正确或改用扫码登录');
    }
  }
}
