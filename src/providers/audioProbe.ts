import {throwIfAborted,abortError} from './async.ts';
export const probeStates=['header','unrecognized','http-error','network-error','timeout','invalid-url','redirect-error','range-error','cancelled'] as const;
export type ProbeState=typeof probeStates[number];
export interface AudioProbeResult {state:ProbeState;bytes:number;status?:number;format?:'flac'|'wav'|'aiff'|'ogg'|'mp4'|'id3'|'aac'|'mpeg'}
export interface AudioProbeNative {probeAudioURL(id:string,url:string):Promise<unknown>;cancelAudioProbe(id:string):Promise<void>}
export type AudioProbe=(url:string,signal:AbortSignal)=>Promise<AudioProbeResult>;
export function createAudioProbe(native:AudioProbeNative,uuid:()=>string):AudioProbe {
  return async(url,signal)=>{
    throwIfAborted(signal);const id=uuid();let cancel!:()=>void;
    const cancelled=new Promise<never>((_,reject)=>{cancel=()=>{void native.cancelAudioProbe(id).catch(()=>{});reject(abortError());};});
    signal.addEventListener('abort',cancel,{once:true});
    try{
      const raw=await Promise.race([native.probeAudioURL(id,url),cancelled]);throwIfAborted(signal);
      const value=raw as AudioProbeResult;
      if(!value||!probeStates.includes(value.state)||!Number.isInteger(value.bytes)||value.bytes<0||value.bytes>4096||(value.status!==undefined&&(!Number.isInteger(value.status)||value.status<100||value.status>599))||(value.format!==undefined&&!['flac','wav','aiff','ogg','mp4','id3','aac','mpeg'].includes(value.format))||(value.state==='header'&&!value.format))throw new Error('媒体响应检查失败');
      return{state:value.state,bytes:value.bytes,...(value.status!==undefined?{status:value.status}:{}),...(value.format?{format:value.format}:{})};
    }finally{signal.removeEventListener('abort',cancel);}
  };
}
