export type NexusAppIconID = 'primary'|'orange'|'green'|'blue'|'purple'|'graphite';

export interface NexusAppIconChoice {
  id: NexusAppIconID;
  label: string;
  nativeName: string|null;
}

export const nexusAppIcons: readonly NexusAppIconChoice[] = Object.freeze([
  {id:'primary',label:'珊瑚',nativeName:null},
  {id:'orange',label:'暖橙',nativeName:'NexusAltOrange'},
  {id:'green',label:'青柠',nativeName:'NexusAltGreen'},
  {id:'blue',label:'海蓝',nativeName:'NexusAltBlue'},
  {id:'purple',label:'暮紫',nativeName:'NexusAltPurple'},
  {id:'graphite',label:'石墨',nativeName:'NexusAltGraphite'},
]);

const nativeNames = new Set(nexusAppIcons.flatMap(choice=>choice.nativeName?[choice.nativeName]:[]));

export function appIconIDForNativeName(name:string|null|undefined):NexusAppIconID|undefined {
  if(name===null||name===undefined)return 'primary';
  return nexusAppIcons.find(choice=>choice.nativeName===name)?.id;
}

export function nativeNameForAppIcon(id:NexusAppIconID):string|null {
  return nexusAppIcons.find(choice=>choice.id===id)?.nativeName??null;
}

export function isAllowedNativeAppIconName(name:string|null):boolean {
  return name===null||nativeNames.has(name);
}
