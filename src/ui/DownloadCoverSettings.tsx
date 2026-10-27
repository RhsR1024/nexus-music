import {useState,useSyncExternalStore} from 'react';
import {Pressable,View} from 'react-native';
import type {Services} from '../app/services.ts';
import {downloadCoverSizes,type DownloadCoverSize} from '../domain/downloadCover.ts';
import {downloadPlatforms} from '../domain/downloadQuality.ts';
import type {OnlinePlatform} from '../domain/track.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,space,typography} from './tokens.ts';
const names:Record<OnlinePlatform,string>={wy:'网易云',tx:'QQ音乐',kg:'酷狗',kw:'酷我',mg:'咪咕'};
export function DownloadCoverSettings({services}:{services:Services}){
 const {palette:p}=useTheme(),preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
 const [open,setOpen]=useState(false),[platform,setPlatform]=useState<OnlinePlatform>('wy'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const selected=preferences.downloadCoverSizes[platform];
 const choose=(size?:DownloadCoverSize)=>{if(busy)return;setBusy(true);setMessage('');void services.preferences.setDownloadCoverSize(platform,size).then(()=>setMessage('封面导出尺寸已保存')).catch(()=>setMessage('尺寸未保存，原设置保留')).finally(()=>setBusy(false));};
 const radio=(id:string,label:string,active:boolean,action:()=>void)=><Pressable key={id} testID={id} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{selected:active,disabled:busy}} disabled={busy} onPress={action} style={{minHeight:controls.hit,padding:space.md,borderRadius:radius.md,backgroundColor:active?p.selected:p.surface,opacity:busy?0.5:1}}><Text style={{...typography.body,color:p.accent}}>{label}</Text></Pressable>;
 return <View style={{gap:space.md}}>
  <Pressable testID="download-cover-open" accessibilityRole="button" accessibilityState={{expanded:open}} onPress={()=>setOpen(value=>!value)} style={{minHeight:controls.hit,padding:space.md,borderRadius:radius.md,backgroundColor:p.surface}}><Text style={{...typography.body,color:p.accent}}>封面导出尺寸 · {Object.keys(preferences.downloadCoverSizes).length?`已设置 ${Object.keys(preferences.downloadCoverSizes).length} 个平台`:'默认512像素'}</Text></Pressable>
  {open&&<><Text accessibilityRole="header" style={{...typography.heading,color:p.text}}>各平台封面最长边</Text>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:space.sm}}>{downloadPlatforms.map(value=>radio(`download-cover-platform-${value}`,names[value],value===platform,()=>setPlatform(value)))}</View>
   <Text testID="download-cover-size-summary" style={{...typography.body,color:p.secondary}}>{names[platform]} · {selected?`最长边 ${selected} 像素`:'默认最长边512像素'}</Text>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:space.sm}}>{radio('download-cover-size-default','默认512',selected===undefined,()=>choose())}{downloadCoverSizes.filter(size=>size!==512).map(size=>radio(`download-cover-size-${size}`,`${size} px`,selected===size,()=>choose(size)))}</View>
   <Text style={{...typography.caption,color:p.secondary}}>按曲目所属平台准备附加JPG。所选为最长边上限，保持比例，不放大小图；原图与来源可用性决定实际尺寸。只作用于后续导出，播放封面保持原设置。</Text>
   {!!message&&<Text accessibilityRole="alert" style={{...typography.caption,color:p.secondary}}>{message}</Text>}
  </>}
 </View>;
}
