import {OfflineDownloadInterrupted,type OfflineDownloadFiles} from './offlineDownloads.ts';

export interface DownloadResponseHeaders {get(name:string):string|null}
export interface DownloadResponseInspection {
  append:boolean;
  expectedBytes?:number;
  expectedTotal?:number;
  validator?:string;
}

class ResumeUnavailable extends Error {}
export function safeDownloadValidator(value:string|undefined):string|undefined{
  if(!value||value.length>256)return;
  if(/^"[\x21\x23-\x7e]*"$/.test(value))return value;
  if(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)&&Number.isFinite(Date.parse(value)))return value;
}
function headerNumber(headers:DownloadResponseHeaders,name:string):number|undefined{
  const value=headers.get(name);if(value===null)return;
  if(!/^\d+$/.test(value.trim()))throw new Error('下载响应长度无效');
  const parsed=Number(value);if(!Number.isSafeInteger(parsed)||parsed<0)throw new Error('下载响应长度无效');
  return parsed;
}
export function inspectDownloadResponse(status:number,headers:DownloadResponseHeaders,offset:number):DownloadResponseInspection{
  if(offset>0&&(status===200||status===416))throw new ResumeUnavailable('断点续传不可用');
  if(status!==200&&status!==206)throw new Error('下载响应无效');
  const encoding=headers.get('content-encoding');
  if(encoding&&encoding.toLowerCase()!=='identity')throw new Error('下载响应编码不支持');
  const contentLength=headerNumber(headers,'content-length');
  const validator=safeDownloadValidator(headers.get('etag')??undefined)??safeDownloadValidator(headers.get('last-modified')??undefined);
  if(status===200)return {append:false,expectedBytes:contentLength,validator};
  const match=/^bytes\s+(\d+)-(\d+)\/(\d+)$/i.exec(headers.get('content-range')?.trim()??'');
  if(!match)throw new ResumeUnavailable('断点续传不可用');
  const start=Number(match[1]),end=Number(match[2]),total=Number(match[3]);
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||!Number.isSafeInteger(total)||start!==offset||end<start||end+1!==total)throw new ResumeUnavailable('断点续传不可用');
  const rangeBytes=end-start+1;
  if(contentLength!==undefined&&contentLength!==rangeBytes)throw new ResumeUnavailable('断点续传长度无效');
  return {append:offset>0,expectedBytes:rangeBytes,expectedTotal:total,validator};
}
export function assertDownloadedLength(inspection:DownloadResponseInspection,received:number,offset:number):void{
  const bodyBytes=received-(inspection.append?offset:0);
  if(inspection.expectedBytes!==undefined&&bodyBytes!==inspection.expectedBytes)throw new Error('下载内容长度不匹配');
  if(inspection.expectedTotal!==undefined&&received!==inspection.expectedTotal)throw new Error('下载内容长度不匹配');
}

// The same transfer algorithm runs with Expo files/fetch in the app and real HTTP/files in tests.
export interface TransferFile {
  readonly exists:boolean;
  readonly size:number;
  delete():void;
  create(options:{intermediates:boolean}):void;
  open():{offset:number|null;writeBytes(bytes:Uint8Array):void;close():void};
  move(target:TransferFile):void;
}
export interface TransferResponse {
  status:number;
  headers:DownloadResponseHeaders;
  body:ReadableStream<Uint8Array>|null;
}
export function createStreamingDownload(
  file:(name:string)=>TransferFile,
  request:(url:string,init:{headers:Record<string,string>;signal?:AbortSignal;credentials:'omit'})=>Promise<TransferResponse>,
):OfflineDownloadFiles['download']{
  return async function download(url,name,headers,options){
    const temporary=file(`${name}.part`),target=file(name);
    let offset=options?.offset??0;
    if(offset>0&&(!temporary.exists||temporary.size!==offset||!safeDownloadValidator(options?.validator))){
      if(temporary.exists)temporary.delete();offset=0;
    }
    if(offset===0&&temporary.exists)temporary.delete();
    // Provider headers cannot override transport framing or add ambient session cookies.
    const requestHeaders:Record<string,string>={};
    for(const [key,value] of Object.entries(headers??{}))if(!['range','if-range','accept-encoding'].includes(key.toLowerCase()))requestHeaders[key]=value;
    requestHeaders['Accept-Encoding']='identity';
    if(offset>0){requestHeaders.Range=`bytes=${offset}-`;requestHeaders['If-Range']=options!.validator!;}
    let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
    let output:ReturnType<TransferFile['open']>|undefined;
    let received=offset;
    try{
      const response=await request(url,{headers:requestHeaders,signal:options?.signal,credentials:'omit'});
      reader=response.body?.getReader();
      const inspection=inspectDownloadResponse(response.status,response.headers,offset);
      if(offset>0&&inspection.validator!==options?.validator)throw new ResumeUnavailable('断点续传实体已变更');
      options?.onValidator?.(inspection.validator);
      if(!reader)throw new Error('下载响应为空');
      if(options?.signal?.aborted)throw new OfflineDownloadInterrupted(received);
      if(!temporary.exists)temporary.create({intermediates:true});
      output=temporary.open();output.offset=offset;
      while(true){
        if(options?.signal?.aborted)throw new OfflineDownloadInterrupted(received);
        const chunk=await reader.read();if(chunk.done)break;
        if(inspection.expectedBytes!==undefined&&received-offset+chunk.value.byteLength>inspection.expectedBytes)throw new Error('下载内容长度不匹配');
        if(received+chunk.value.byteLength>2*1024*1024*1024)throw new Error('离线文件大小无效');
        output.writeBytes(chunk.value);received+=chunk.value.byteLength;
      }
      if(options?.signal?.aborted)throw new OfflineDownloadInterrupted(received);
      assertDownloadedLength(inspection,received,offset);
      output.close();output=undefined;
      if(temporary.size!==received||received===0)throw new Error('下载文件长度不匹配');
      if(target.exists)target.delete();temporary.move(target);return received;
    }catch(error){
      if(output){try{output.close();}catch{/* Preserve the first error. */}output=undefined;}
      if(reader){try{await reader.cancel();}catch{/* An aborted stream may already be closed. */}reader.releaseLock();reader=undefined;}
      if(options?.signal?.aborted)throw new OfflineDownloadInterrupted(temporary.exists?temporary.size:0);
      if(offset>0&&error instanceof ResumeUnavailable){
        if(temporary.exists)temporary.delete();
        return download(url,name,headers,{...options,offset:0,validator:undefined});
      }
      throw error;
    }finally{
      if(output)try{output.close();}catch{/* Preserve the first error. */}
      reader?.releaseLock();
    }
  };
}
