import {Directory,File,Paths} from 'expo-file-system';
import {fetch} from 'expo/fetch';
import type {OfflineDownloadFiles} from './offlineDownloads.ts';
import {createStreamingDownload,type TransferFile} from './offlineTransfer.ts';
import {requireNativeModule} from 'expo';
import {Platform} from 'react-native';
import {createBackgroundDownload,type BackgroundDownloadNative} from './backgroundDownload.ts';

export function createOfflineDownloadFiles():OfflineDownloadFiles{
  const directory=new Directory(Paths.document,'offline-audio');
  directory.create({intermediates:true,idempotent:true});
  const file=(name:string)=>new File(directory,name);
  const files:OfflineDownloadFiles={
    download:createStreamingDownload(name=>file(name) as TransferFile,fetch),
    async remove(name){if(name){const target=file(name),temporary=file(`${name}.part`);if(target.exists)target.delete();if(temporary.exists)temporary.delete();}},
    exists:name=>Boolean(name)&&file(name).exists,
    size:name=>file(name).size,
    partialSize:name=>file(`${name}.part`).size,
    digest:name=>{const value=file(name).md5;return value??undefined;},
    uri:name=>file(name).uri,
  };
  return Platform.OS==='ios'?createBackgroundDownload(requireNativeModule<BackgroundDownloadNative>('NexusDownloads'),files):files;
}
