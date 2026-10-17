import {Directory,File,Paths} from 'expo-file-system';
import {OfflineDownloadInterrupted,type OfflineDownloadFiles} from './offlineDownloads.ts';

export function createOfflineDownloadFiles():OfflineDownloadFiles{
  const directory=new Directory(Paths.document,'offline-audio');
  directory.create({intermediates:true,idempotent:true});
  const file=(name:string)=>new File(directory,name);
  return {
    async download(url,name,headers,options){
      const temporary=file(`${name}.part`),target=file(name);
      let offset=options?.offset??0;
      if(offset>0&&(!temporary.exists||temporary.size!==offset)){
        if(temporary.exists)temporary.delete();
        offset=0;
      }
      if(offset===0&&temporary.exists)temporary.delete();
      try{
        const response=await fetch(url,{headers:{...headers,...(offset>0?{Range:`bytes=${offset}-`}: {})},signal:options?.signal});
        if(response.status===416||response.status<200||response.status>=300)throw new Error(offset>0?'断点续传不可用':'下载响应无效');
        const append=offset>0&&response.status===206;
        if(!append&&temporary.exists)temporary.delete();
        if(!temporary.exists)temporary.create({intermediates:true});
        const output=temporary.open();
        output.offset=append?offset:0;
        try{
          if(!response.body)throw new Error('下载响应为空');
          const reader=response.body.getReader();let received=append?offset:0;
          while(true){if(options?.signal?.aborted)throw new OfflineDownloadInterrupted(received);const chunk=await reader.read();if(chunk.done)break;output.writeBytes(chunk.value);received+=chunk.value.byteLength;}
          output.close();
          if(target.exists)target.delete();
          temporary.move(target);
          return received;
        }finally{try{output.close();}catch{/* Already closed after a successful move. */}}
      }catch(error){if(error instanceof OfflineDownloadInterrupted)throw error;if(options?.signal?.aborted)throw new OfflineDownloadInterrupted(temporary.exists?temporary.size:0);if(offset>0&&temporary.exists&&error instanceof Error&&error.message==='断点续传不可用'){temporary.delete();return this.download(url,name,headers,{signal:options?.signal,offset:0});}throw error;}
    },
    async remove(name){if(name){const target=file(name),temporary=file(`${name}.part`);if(target.exists)target.delete();if(temporary.exists)temporary.delete();}},
    exists:name=>Boolean(name)&&file(name).exists,
    size:name=>file(name).size,
    partialSize:name=>file(`${name}.part`).size,
    digest:name=>{const value=file(name).md5;return value??undefined;},
    uri:name=>file(name).uri,
  };
}
