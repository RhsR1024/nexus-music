import {Directory,File,Paths} from 'expo-file-system';
import type {OfflineDownloadFiles} from './offlineDownloads.ts';

export function createOfflineDownloadFiles():OfflineDownloadFiles{
  const directory=new Directory(Paths.document,'offline-audio');
  directory.create({intermediates:true,idempotent:true});
  const file=(name:string)=>new File(directory,name);
  return {
    async download(url,name,headers){
      const temporary=file(`${name}.part`),target=file(name);
      if(temporary.exists)temporary.delete();
      try{
        const downloaded=await File.downloadFileAsync(url,temporary,headers?{headers}:undefined);
        if(target.exists)target.delete();
        downloaded.move(target);
        return target.size;
      }catch(error){if(temporary.exists)temporary.delete();throw error;}
    },
    async remove(name){if(name){const target=file(name);if(target.exists)target.delete();}},
    exists:name=>Boolean(name)&&file(name).exists,
    size:name=>file(name).size,
    uri:name=>file(name).uri,
  };
}
