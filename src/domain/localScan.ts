export interface ScanRoot {id:string;name:string;recursive:boolean}
export interface ScanFolder {rootId:string;rootName:string;path:string}
export interface AudioLocation extends ScanFolder {fileName:string}
export interface LocalScanState {roots:readonly ScanRoot[];minimumSeconds:number;blocked:readonly string[];folders:readonly ScanFolder[];dirty:boolean}
export const emptyLocalScan:LocalScanState={roots:[],minimumSeconds:0,blocked:[],folders:[],dirty:false};
const validID=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9-]{1,64}$/.test(value);
export function validRelativePath(value:unknown):value is string{return typeof value==='string'&&value.length<=4096&&!value.startsWith('/')&&!value.includes('\\')&&!value.includes('\0')&&value.split('/').every(part=>part!=='.'&&part!=='..');}
export const scanFolderKey=(folder:ScanFolder)=>`${folder.rootId}/${folder.path}`;
export const scanLocationKey=(location:AudioLocation)=>`${scanFolderKey(location)}/${location.fileName}`;
export function validateScanFolder(folder:ScanFolder):ScanFolder {
  if(!folder||!validID(folder.rootId)||typeof folder.rootName!=='string'||!folder.rootName||folder.rootName.length>512||!validRelativePath(folder.path))throw Error('本地文件夹记录无效');return folder;
}
export function validateAudioLocation(location:AudioLocation):AudioLocation {
  validateScanFolder(location);if(typeof location.fileName!=='string'||!location.fileName||location.fileName.includes('/')||!validRelativePath(location.fileName))throw Error('本地文件位置无效');return location;
}
export function validateLocalScan(scan:LocalScanState):LocalScanState {
  if(!scan||!Array.isArray(scan.roots)||scan.roots.length>32||new Set(scan.roots.map(root=>root.id)).size!==scan.roots.length||scan.roots.some(root=>!root||!validID(root.id)||typeof root.name!=='string'||!root.name||root.name.length>512||typeof root.recursive!=='boolean')||!Number.isFinite(scan.minimumSeconds)||scan.minimumSeconds<0||scan.minimumSeconds>86400||typeof scan.dirty!=='boolean'||!Array.isArray(scan.blocked)||scan.blocked.length>1000||!Array.isArray(scan.folders)||scan.folders.length>50000)throw Error('扫描设置无效');
  if(scan.blocked.some(path=>typeof path!=='string'||!scan.roots.some(root=>path.startsWith(root.id+'/')&&validRelativePath(path.slice(root.id.length+1)))))throw Error('屏蔽目录无效');
  scan.folders.forEach(validateScanFolder);return scan;
}
