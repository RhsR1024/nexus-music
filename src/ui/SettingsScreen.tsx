import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {AccessibilityInfo,BackHandler,findNodeHandle,Keyboard,Pressable,ScrollView,View,type Text as NativeText} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {AppearanceSettings,type AppearanceSection} from './AppearanceSettings.tsx';
import {AppearanceOverview} from './AppearanceOverview.tsx';
import {AudioSettings} from './AudioSettings.tsx';
import {EqualizerSettings} from './EqualizerSettings.tsx';
import {PlaybackSettings} from './PlaybackSettings.tsx';
import {FontSettings} from './FontSettings.tsx';
import {CacheSettings} from './CacheSettings.tsx';
import {LibraryDataTools} from './LibraryDataTools.tsx';
import {NavidromeSettings} from './NavidromeSettings.tsx';
import {SourceSettings} from './SourceSettings.tsx';

export type SettingsPage='home'|'playback'|'equalizer'|'appearance'|'typography'|'storage'|'sources'|AppearanceSection;
const titles:Record<SettingsPage,string>={home:'设置',playback:'播放与歌词',equalizer:'EQ 均衡器',appearance:'外观与界面',typography:'字体与歌词样式',storage:'数据与存储',sources:'音乐来源',theme:'软件主题',background:'主题与背景',skins:'播放界面样式',mini:'迷你播放器按钮',navigation:'底部栏样式',accent:'强调色'};

export function SettingsScreen({services,initialPage='home',homeRequest=0,onExit}:{services:Services;initialPage?:SettingsPage;homeRequest?:number;onExit:()=>void}){
  const {palette:p}=useTheme();
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const [history,setHistory]=useState<SettingsPage[]>([initialPage]);
  const [visited,setVisited]=useState<SettingsPage[]>([initialPage]);
  const heading=useRef<NativeText>(null),page=history[history.length-1]!;
  const scrolls=useRef<Partial<Record<SettingsPage,ScrollView|null>>>({}),offsets=useRef<Partial<Record<SettingsPage,number>>>({});
  const restoring=useRef<SettingsPage|null>(null);
  const previousHomeRequest=useRef(homeRequest);
  useLayoutEffect(()=>{
    if(previousHomeRequest.current===homeRequest)return;
    previousHomeRequest.current=homeRequest;
    Keyboard.dismiss();
    setVisited(value=>value.includes('home')?value:[...value,'home']);
    setHistory(['home']);
  },[homeRequest]);
  useLayoutEffect(()=>{
    restoring.current=page;let settle:number|undefined;
    const frame=requestAnimationFrame(()=>{scrolls.current[page]?.scrollTo({y:offsets.current[page]??0,animated:false});settle=requestAnimationFrame(()=>{restoring.current=null;});});
    return()=>{cancelAnimationFrame(frame);if(settle!==undefined)cancelAnimationFrame(settle);};
  },[page]);
  const back=()=>{Keyboard.dismiss();if(history.length>1)setHistory(value=>value.slice(0,-1));else if(page!=='home')onExit();};
  const open=(next:SettingsPage)=>{Keyboard.dismiss();setVisited(value=>value.includes(next)?value:[...value,next]);setHistory(value=>[...value,next]);};
  useEffect(()=>{let active=true;void AccessibilityInfo.isScreenReaderEnabled().then(enabled=>{if(active&&enabled){const node=findNodeHandle(heading.current);if(node)AccessibilityInfo.setAccessibilityFocus(node);}});return()=>{active=false;};},[page]);
  useEffect(()=>{const listener=BackHandler.addEventListener('hardwareBackPress',()=>{if(page==='home')return false;back();return true;});return()=>listener.remove();},[page,history.length]);
  const row=(next:SettingsPage,subtitle:string,icon:React.ComponentProps<typeof Ionicons>['name'])=><Pressable testID={`settings-open-${next}`} accessibilityRole="button" accessibilityLabel={titles[next]} accessibilityHint={subtitle} onPress={()=>open(next)} style={{padding:18,minHeight:82,flexDirection:'row',alignItems:'center',gap:14,borderRadius:22,backgroundColor:p.surface,borderWidth:1,borderColor:p.border}}>
    <View style={{width:44,height:44,borderRadius:14,backgroundColor:p.selected,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={24} color={p.accent}/></View>
    <View style={{flex:1,gap:6}}><Text style={{color:p.text,fontSize:18,fontWeight:'600'}}>{titles[next]}</Text><Text style={{color:p.secondary,fontSize:13,lineHeight:20}}>{subtitle}</Text></View>
    <Ionicons name="chevron-forward" size={20} color={p.secondary}/>
  </Pressable>;
  const content=(key:SettingsPage)=>{
    switch(key){
      case 'home':return <View style={{gap:14}}>
        <Text style={{color:p.secondary,lineHeight:23,marginBottom:8}}>让每一次聆听，更像你。</Text>
        {row('playback',`${preferences.quality} · 音质、睡眠与歌词`,'musical-notes-outline')}
        {row('equalizer','10 段曲线、前级、预设与实时 PCM 处理','options-outline')}
        {row('appearance','主题、背景、播放界面与迷你播放器','color-palette-outline')}
        {row('storage','缓存、备份、同步与歌单迁移','folder-outline')}
        <Text accessibilityRole="header" style={{color:p.secondary,fontSize:13,marginTop:12}}>曲库与播放来源</Text>
        {row('sources','LX 音源与 Navidrome 私人曲库','server-outline')}
      </View>;
      case 'sources':return <><NavidromeSettings services={services}/><SourceSettings catalog={services.catalog} health={services.sourceHealth}/></>;
      case 'playback':return <>{row('typography','歌词字体、颜色、对齐与逐字效果','text-outline')}<AudioSettings services={services}/><PlaybackSettings services={services}/></>;
      case 'equalizer':return <EqualizerSettings services={services}/>;
      case 'appearance':return <AppearanceOverview services={services} open={open}/>;
      case 'theme':case 'background':case 'skins':case 'mini':case 'navigation':case 'accent':return <AppearanceSettings services={services} section={key}/>;
      case 'typography':return <FontSettings services={services}/>;
      case 'storage':return <><CacheSettings services={services}/><LibraryDataTools services={services}/></>;
    }
  };
  return <View style={{flex:1}} onAccessibilityEscape={page==='home'?undefined:back}>
    <View style={{paddingHorizontal:22,paddingVertical:12,minHeight:64,flexDirection:'row',alignItems:'center',justifyContent:'center'}}>
      {page!=='home'&&<Pressable testID="settings-back" accessibilityRole="button" accessibilityLabel={history.length>1?`返回${titles[history[history.length-2]!]}`:'返回音乐库'} onPress={back} style={{position:'absolute',left:12,top:8,bottom:8,width:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="chevron-back" size={27} color={p.text}/></Pressable>}
      <Text ref={heading} testID={`settings-title-${page}`} accessibilityRole="header" style={{fontSize:page==='home'?36:20,fontWeight:'700',color:p.text,flex:1,textAlign:page==='home'?'left':'center',marginHorizontal:page==='home'?0:36}}>{titles[page]}</Text>
    </View>
    {visited.map(key=><View key={key} testID={`settings-viewport-${key}`} style={{flex:1,display:key===page?'flex':'none'}} accessibilityElementsHidden={key!==page} importantForAccessibility={key===page?'auto':'no-hide-descendants'} pointerEvents={key===page?'auto':'none'}>
      <ScrollView ref={node=>{scrolls.current[key]=node;}} testID={`settings-scroll-${key}`} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" scrollEventThrottle={32} onScroll={event=>{if(key===page&&restoring.current===null)offsets.current[key]=Math.max(0,event.nativeEvent.contentOffset.y);}} contentContainerStyle={{paddingHorizontal:22,paddingTop:10,paddingBottom:32}}>{content(key)}</ScrollView>
    </View>)}
  </View>;
}
