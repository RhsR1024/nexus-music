import {MiniPlayerSettings} from './MiniPlayerSettings.tsx';
import {VisualSettings} from './VisualSettings.tsx';
import {Text} from './Typography.tsx';
import {useState,useSyncExternalStore} from 'react';
import {Pressable, Switch, View} from 'react-native';
import type {Services} from '../app/services.ts';
import {accentColors,type Accent,type VisualTheme} from '../domain/appearance.ts';
import {useTheme} from './theme.tsx';
export type AppearanceSection='theme'|'background'|'skins'|'accent'|'navigation'|'mini';
export function AppearanceSettings({services,section:page}:{services:Services;section:AppearanceSection}){
  const theme=useTheme(),value=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),[error,setError]=useState('');
  const update=(patch:Parameters<typeof services.preferences.update>[0])=>{setError('');void services.preferences.update(patch).catch(()=>setError('外观未保存，请重试；之前的设置已保留。'));};
  const section=(title:string,children:React.ReactNode)=><View style={{gap:14,paddingVertical:18,borderBottomWidth:1,borderBottomColor:theme.palette.border}}><Text style={{fontSize:16,fontWeight:'600',color:theme.palette.text}}>{title}</Text>{children}</View>;
  const choice=(id:string,label:string,selected:boolean,onPress:()=>void)=><Pressable key={id} testID={id} accessibilityRole="radio" accessibilityState={{selected}} onPress={onPress} style={{backgroundColor:selected?theme.palette.selected:theme.palette.surface,padding:14,borderRadius:18,borderWidth:1,borderColor:selected?theme.palette.accent:theme.palette.border}}><Text style={{color:selected?theme.palette.accent:theme.palette.secondary,fontWeight:selected?'600':'400'}}>{label}</Text></Pressable>;
  return <View style={{gap:8,marginVertical:24,padding:20,borderRadius:26,backgroundColor:theme.palette.surface}}>
    {page==='theme'&&section('软件主题',<View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{(['system','light','dark']as const).map((mode,index)=>choice(`theme-${mode}`,['跟随系统','浅色','深色'][index]!,value.theme===mode,()=>update({theme:mode})))}</View>)}
    {page==='background'&&section('主题与背景',<><View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{([['classic','经典'],['blush','粉雾'],['soft','柔和']]as const).map(([id,label])=>choice(`visual-${id}`,label,value.visualTheme===id,()=>update({visualTheme:id as VisualTheme})))}</View><View style={{flexDirection:'row',gap:8}}>{(['gradient','solid']as const).map((id,index)=>choice(`background-${id}`,['柔和渐变','纯色'][index]!,value.backgroundStyle===id,()=>update({backgroundStyle:id})))}</View></>)}
    {page==='skins'&&section('播放界面样式',<View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{([['classic','经典'],['am','AM 风格'],['immersive','封面沉浸'],['photo','写真歌词'],['vinyl','黑胶唱机'],['wave','声波核']]as const).map(([id,label])=>choice(`player-layout-${id}`,label,value.playerLayout===id,()=>update({playerLayout:id})))}</View>)}
    {page==='accent'&&section('强调色',<View style={{flexDirection:'row',gap:14,flexWrap:'wrap'}}>{(Object.entries(accentColors) as [Accent,readonly[string,string]][]).map(([id,colors],index)=><Pressable key={id} testID={`accent-${id}`} accessibilityLabel={['玫瑰','珊瑚','紫色','蓝色','橙色'][index]} accessibilityRole="radio" accessibilityState={{selected:value.accent===id}} onPress={()=>update({accent:id})} style={{minWidth:44,minHeight:44,borderRadius:22,backgroundColor:colors[theme.mode==='dark'?1:0],alignItems:'center',justifyContent:'center',borderWidth:value.accent===id?3:0,borderColor:theme.palette.text}}><Text style={{color:'#FFFFFF',fontSize:20}}>{value.accent===id?'✓':''}</Text></Pressable>)}</View>)}
    {page==='navigation'&&<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:16,gap:12}}><View style={{flex:1}}><Text style={{fontSize:16,fontWeight:'600',color:theme.palette.text}}>玻璃底栏</Text><Text style={{color:theme.palette.secondary,lineHeight:20,marginTop:6}}>关闭或开启系统“降低透明度”时，使用实色表面。</Text></View><Switch accessibilityLabel="玻璃底栏" value={value.glassNavigation} onValueChange={glassNavigation=>update({glassNavigation})} trackColor={{true:theme.palette.accent}}/></View>}
    {page==='background'&&<VisualSettings services={services}/>} {page==='mini'&&<MiniPlayerSettings services={services}/>}
    {!!error&&<Text accessibilityLiveRegion="polite" style={{color:theme.palette.accent}}>{error}</Text>}
  </View>;
}
