import {OfflineDownloadInterrupted,type OfflineDownloadFiles} from './offlineDownloads.ts';

export interface BackgroundDownloadState {fileName:string;state:'running'|'pausing'|'cancelling'|'paused'|'cancelled'|'failed'|'completed';received:number;expected:number;error?:string}
export interface BackgroundDownloadNative {
  configure(maximum:number):Promise<void>;
  snapshot(name:string):Promise<BackgroundDownloadState|null>;
  begin(url:string,name:string,headers:Readonly<Record<string,string>>,resume:boolean):Promise<BackgroundDownloadState>;
  stop(name:string,pause:boolean):Promise<void>;
  discard(name:string):Promise<void>;
  acknowledge(name:string):Promise<void>;
}

// Polling only observes the native journal; it never owns the transfer. Native
// URLSession continues when JS is suspended, and the next process can adopt it.
export function createBackgroundDownload(native:BackgroundDownloadNative,files:OfflineDownloadFiles,delay=()=>new Promise<void>(resolve=>setTimeout(resolve,250))):OfflineDownloadFiles{
  const states=new Map<string,BackgroundDownloadState>();
  const remember=(state:BackgroundDownloadState|null)=>{if(state)states.set(state.fileName,state);return state;};
  const wait=async(name:string,signal?:AbortSignal)=>{
    let stop:Promise<void>|undefined;
    const interrupt=()=>{if(!stop){stop=native.stop(name,signal?.reason==='pause');void stop.catch(()=>{});}};
    signal?.addEventListener('abort',interrupt,{once:true});if(signal?.aborted)interrupt();
    try{
      while(true){
        if(stop)await stop;
        const state=remember(await native.snapshot(name));
        if(!state)throw new Error('后台下载状态已缺失');
        if(['paused','cancelled'].includes(state.state)||(signal?.aborted&&['completed','failed'].includes(state.state)))throw new OfflineDownloadInterrupted(state.received);
        if(state.state==='completed')return state.received;
        if(state.state==='failed')throw new Error(state.error==='capacity'?'离线容量已满，请先清理已保存文件':'后台下载失败，请重试');
        await delay();
      }
    }finally{signal?.removeEventListener('abort',interrupt);}
  };
  return {
    ...files,independentTransfers:true,
    configure:maximum=>native.configure(maximum),
    async stopDownload(name,pause){
      await native.stop(name,pause);
      while(true){const state=remember(await native.snapshot(name));if(!state||!['running','pausing','cancelling'].includes(state.state))return;await delay();}
    },
    async recoverState(name){const state=remember(await native.snapshot(name));return state?.state==='paused'||state?.state==='pausing'?'paused':state?.state==='cancelled'||state?.state==='cancelling'?'cancelled':undefined;},
    async download(url,name,headers,options){
      if(options?.signal?.aborted)throw new OfflineDownloadInterrupted(0);
      remember(await native.begin(url,name,headers??{},(options?.offset??0)>0));
      return wait(name,options?.signal);
    },
    async recoverDownload(name,options){
      const state=remember(await native.snapshot(name));
      if(!state||['paused','cancelled','failed'].includes(state.state))return;
      return wait(name,options?.signal);
    },
    async acknowledge(name){await native.acknowledge(name);states.delete(name);},
    async remove(name){await native.discard(name);states.delete(name);await files.remove(name);},
    partialSize:name=>Math.max(files.partialSize(name),states.get(name)?.received??0),
  };
}
