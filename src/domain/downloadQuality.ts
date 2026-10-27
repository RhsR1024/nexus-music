import {qualityOrder,type Quality} from './quality.ts';
import type {OnlinePlatform} from './track.ts';
export const downloadPlatforms=['wy','tx','kg','kw','mg'] as const satisfies readonly OnlinePlatform[];
export interface DownloadQualityPreferences {downloadQualities:Readonly<Partial<Record<OnlinePlatform,Quality>>>}
export const downloadQualityDefaults:DownloadQualityPreferences={downloadQualities:Object.freeze({})};
export function normalizeDownloadQualities(value:unknown):DownloadQualityPreferences['downloadQualities']{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('下载音质设置无效');
 const result:Partial<Record<OnlinePlatform,Quality>>={};
 for(const [platform,quality] of Object.entries(value)){
  if(!downloadPlatforms.includes(platform as OnlinePlatform)||typeof quality!=='string'||!qualityOrder.includes(quality as Quality))throw Error('下载音质设置无效');
  result[platform as OnlinePlatform]=quality as Quality;
 }
 return Object.freeze(result);
}
