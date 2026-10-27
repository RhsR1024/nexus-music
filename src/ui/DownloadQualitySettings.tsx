import {useState,useSyncExternalStore} from 'react';
import {Pressable,View} from 'react-native';
import type {Services} from '../app/services.ts';
import {downloadPlatforms} from '../domain/downloadQuality.ts';
import {normalizeQuality,qualityOrder,type Quality} from '../domain/quality.ts';
import type {OnlinePlatform} from '../domain/track.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,space,typography} from './tokens.ts';
const names:Record<OnlinePlatform,string>={wy:'网易云',tx:'QQ音乐',kg:'酷狗',kw:'酷我',mg:'咪咕'};
export function DownloadQualitySettings({services}:{services:Services}){
 const {palette:p}=useTheme(),preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),sources=useSyncExternalStore(services.registry.subscribe,services.registry.getSnapshot);
 const [platform,setPlatform]=useState<OnlinePlatform>('wy'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const supported=new Set(sources.filter(source=>services.registry.isCurrent(source)).flatMap(source=>source.capabilities.filter(capability=>capability.platform===platform&&capability.actions.includes('musicUrl')).flatMap(capability=>capability.qualities.map(normalizeQuality).filter((value):value is Quality=>value!==undefined))));
 const selected=preferences.downloadQualities[platform];
 const choose=(quality?:Quality)=>{if(busy)return;setBusy(true);setMessage('');void services.preferences.setDownloadQuality(platform,quality).then(()=>setMessage('平台下载音质已保存')).catch(()=>setMessage('下载音质未保存，原设置保留')).finally(()=>setBusy(false));};
 const option=(id:string,label:string,active:boolean,action:()=>void)=><Pressable key={id} testID={id} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{selected:active,disabled:busy}} disabled={busy} onPress={action} style={{minHeight:controls.hit,padding:space.md,borderRadius:radius.md,backgroundColor:active?p.selected:p.surface,opacity:busy?0.5:1}}><Text style={{...typography.body,color:p.accent}}>{label}</Text></Pressable>;
 return <View style={{gap:space.md}}>
  <Text accessibilityRole="header" style={{...typography.heading,color:p.text}}>各平台下载音质</Text>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:space.sm}}>{downloadPlatforms.map(value=>option(`download-platform-${value}`,names[value],value===platform,()=>setPlatform(value)))}</View>
  <Text testID="download-platform-quality-summary" style={{...typography.body,color:p.secondary}}>{names[platform]} · {selected?`首选 ${selected}`:`跟随播放设置 · ${preferences.quality}`}</Text>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:space.sm}}>{option('download-quality-follow','跟随播放设置',selected===undefined,()=>choose())}{qualityOrder.filter(quality=>supported.has(quality)).map(quality=>option(`download-quality-${quality}`,quality,selected===quality,()=>choose(quality)))}</View>
  {supported.size===0&&<Text style={{...typography.caption,color:p.secondary}}>当前没有为该平台提供下载能力的已启用音源，请先在音源管理中启用。</Text>}
  {selected&&!supported.has(selected)&&<Text style={{...typography.caption,color:p.secondary}}>当前音源未声明该首选音质，将按可用能力向下尝试。</Text>}
  <Text style={{...typography.caption,color:p.secondary}}>选项来自已启用音源。按实际解析平台应用首选音质，跨平台匹配仍按音质优先；不足时向下尝试。标记不保证实际编码或码率。已开始的解析保持本次选择，播放音质不改变。</Text>
  {!!message&&<Text accessibilityRole="alert" style={{...typography.caption,color:p.secondary}}>{message}</Text>}
 </View>;
}
