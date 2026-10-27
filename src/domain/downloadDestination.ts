import {validateDownloadNaming,type DownloadNaming} from './downloadNaming.ts';
export interface DestinationRoot {id:string;name:string}
export interface DownloadDestinationIntent extends DownloadNaming {id:string;name:string;job:string}
const uuid=/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
export function validateDestinationRoot(value:unknown):DestinationRoot {
 if(!value||typeof value!=='object')throw Error('保存目录记录无效');const v=value as DestinationRoot;if(!uuid.test(v.id)||typeof v.name!=='string'||!v.name.trim()||v.name.length>512)throw Error('保存目录记录无效');return Object.freeze({id:v.id,name:v.name});
}
export function validateDestinationIntent(value:unknown):DownloadDestinationIntent {
 if(!value||typeof value!=='object')throw Error('目录保存任务无效');const v=value as DownloadDestinationIntent;if(!uuid.test(v.id)||!uuid.test(v.job)||typeof v.name!=='string'||!v.name.trim()||v.name.length>512)throw Error('目录保存任务无效');validateDownloadNaming(v);return Object.freeze({id:v.id,name:v.name,job:v.job,downloadNameOrder:v.downloadNameOrder,downloadNameSeparator:v.downloadNameSeparator});
}
