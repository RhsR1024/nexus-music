import type {OnlinePlatform,Track} from './track.ts';
import {downloadPlatforms} from './downloadQuality.ts';
export const downloadCoverSizes=[256,500,512,1000,1024,1200,2048] as const;
export type DownloadCoverSize=typeof downloadCoverSizes[number];
export interface DownloadCoverPreferences {downloadCoverSizes:Readonly<Partial<Record<OnlinePlatform,DownloadCoverSize>>>}
export const downloadCoverDefaults:DownloadCoverPreferences={downloadCoverSizes:Object.freeze({})};
export function normalizeDownloadCoverSizes(value:unknown):DownloadCoverPreferences['downloadCoverSizes']{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('封面导出尺寸无效');
 const result:Partial<Record<OnlinePlatform,DownloadCoverSize>>={};
 for(const [platform,size] of Object.entries(value)){
  if(!downloadPlatforms.includes(platform as OnlinePlatform)||!downloadCoverSizes.includes(size as DownloadCoverSize))throw Error('封面导出尺寸无效');
  result[platform as OnlinePlatform]=size as DownloadCoverSize;
 }
 return Object.freeze(result);
}
export function downloadCoverSize(track:Track,policy:DownloadCoverPreferences['downloadCoverSizes']={}):DownloadCoverSize{return track.origin.kind==='online'?policy[track.origin.platform]??512:512;}
