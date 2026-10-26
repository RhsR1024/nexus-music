import {defaults,validatePreferences,type Preferences} from '../app/preferences.ts';
import {normalizeLyricOffsets} from '../lyrics/settings.ts';

// This is deliberately an explicit schema. A future local preference (for
// example a credential or file URI) must not silently enter exported backups.
const fields=[
  'visualTheme','accent','backgroundStyle','backgroundOpacity','cardOpacity','backgroundMask','maskColor','playerBackground','playerBlur','playerDarkness','coverRadius','coverColor','globalBackgroundMotion','dynamicBackground','glassNavigation',
  'miniActions','miniLyrics','localAudioSortField','localAudioSortDirection','stageStyle','stageBackdrop','am2AutoLyrics','am2DelaySeconds','am2ShowVolume','lyricStyle','autoMatch','lyricAlignment','lyricOffsets','volume','preampDB','eqPresets','playerLayout','favoriteVisualTheme','quality','eqEnabled','gains','repeat','shuffle','lyricOffsetMs','fontScale','rate','theme','cacheLimitMB','offlineLimitMB',
] as const satisfies readonly (keyof Preferences)[];
export interface BackupSettings {version:1;preferences:Pick<Preferences,(typeof fields)[number]>}
function portableOffsetKey(key:string){
  try{const value=JSON.parse(key);if(!Array.isArray(value)||value.length!==3||value.some(x=>typeof x!=='string')||JSON.stringify(value)!==key)return false;
    const [kind,namespace,id]=value as string[];
    if(!id||/[\u0000-\u001f\u007f]/.test(id)||/^(?:https?|file|ipod-library):\/\//i.test(id))return false;
    return kind==='online'?['wy','tx','kw','kg','mg'].includes(namespace!):kind==='local'?namespace==='files':kind==='imported'?namespace==='qishui':['device','navidrome','webdav'].includes(kind!)&&/^[a-z\d-]{1,128}$/i.test(namespace!);
  }catch{return false;}
}
export function cleanBackupSettings(value:unknown):BackupSettings{
  if(!value||typeof value!=='object'||(value as BackupSettings).version!==1)throw Error('设置备份版本无效');
  const raw=(value as BackupSettings).preferences;if(!raw||typeof raw!=='object'||Array.isArray(raw)||fields.some(field=>!Object.hasOwn(raw,field)))throw Error('设置备份不完整');
  const selected=Object.fromEntries(fields.map(field=>[field,raw[field]])) as unknown as BackupSettings['preferences'];
  const valid=validatePreferences({...defaults,...selected}),style=valid.lyricStyle;
  return {version:1,preferences:{...selected,gains:[...valid.gains],miniActions:[...valid.miniActions],eqPresets:valid.eqPresets.map(preset=>({name:preset.name,gains:[...preset.gains],preampDB:preset.preampDB})),
    lyricStyle:{activeColor:style.activeColor,inactiveColor:style.inactiveColor,lineHeight:style.lineHeight,spacing:style.spacing,blur:style.blur,emphasis:style.emphasis},
    lyricOffsets:Object.fromEntries(Object.entries(normalizeLyricOffsets(valid.lyricOffsets)).filter(([key])=>portableOffsetKey(key))),
  }};
}
