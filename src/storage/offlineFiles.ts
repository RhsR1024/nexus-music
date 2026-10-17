import {Directory,File,Paths} from 'expo-file-system';
import {fetch} from 'expo/fetch';
import type {OfflineDownloadFiles} from './offlineDownloads.ts';
import {createStreamingDownload,type TransferFile} from './offlineTransfer.ts';

export function createOfflineDownloadFiles():OfflineDownloadFiles{
  const directory=new Directory(Paths.document,'offline-audio');
  directory.create({intermediates:true,idempotent:true});
  const file=(name:string)=>new File(directory,name);
  return {
    download:createStreamingDownload(name=>file(name) as TransferFile,fetch),
    async remove(name){if(name){const target=file(name),temporary=file(`${name}.part`);if(target.exists)target.delete();if(temporary.exists)temporary.delete();}},
    exists:name=>Boolean(name)&&file(name).exists,
    size:name=>file(name).size,
    partialSize:name=>file(`${name}.part`).size,
    digest:name=>{const value=file(name).md5;return value??undefined;},
    uri:name=>file(name).uri,
  };
}
