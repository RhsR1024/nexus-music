// QR protocol adapted from Q-music Android 5db858f, kugouApi.ts
// (Apache-2.0), with its MakcRe/KuGouMusicApi MIT attribution retained.
// NexusMusic owns cancellation, validation and storage; no playlist APIs.
import {bounded,throwIfAborted} from './async.ts';
import {HTTPResponseError,queryURL,type HTTPClient} from './http.ts';

export interface KugouQr {readonly key:string;readonly image:string;readonly mid:string;readonly expiresAt:number}
export interface KugouSession {readonly userId:string;readonly token:string;readonly mid:string;readonly nickname:string}
export type KugouQrResult={status:'waiting'|'scanned'|'expired'}|{status:'connected';session:KugouSession};
export class KugouLoginError extends Error {
  readonly kind:'cancelled'|'unavailable'|'login_required';
  constructor(kind:'cancelled'|'unavailable'|'login_required'='unavailable'){
    super(kind==='cancelled'?'酷狗登录已取消':kind==='login_required'?'酷狗登录已失效，请重新登录':'酷狗登录服务暂时不可用，请重试');this.kind=kind;
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
    return{status:'connected',session:{userId,token:data.token,mid:qr.mid,nickname}};
  }
}
