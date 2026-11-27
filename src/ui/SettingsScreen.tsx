import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {AccessibilityInfo,BackHandler,findNodeHandle,Keyboard,Pressable,ScrollView,StyleSheet,View,useWindowDimensions,type Text as NativeText} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {AppearanceSettings,BackgroundThemeActions,type AppearanceSection} from './AppearanceSettings.tsx';
import {AppearanceOverview} from './AppearanceOverview.tsx';
import {AppIconSettings} from './AppIconSettings.tsx';
import {AudioSettings} from './AudioSettings.tsx';
import {EqualizerSettings} from './EqualizerSettings.tsx';
import {PlaybackSettings} from './PlaybackSettings.tsx';
import {FontSettings} from './FontSettings.tsx';
import {CacheSettings} from './CacheSettings.tsx';
import {DownloadSettings,DownloadTasks} from './DownloadSettings.tsx';
import {LibraryDataTools} from './LibraryDataTools.tsx';
import {MusicSourcesScreen} from './MusicSourcesScreen.tsx';
import {MusicAccountSettings} from './MusicAccountSettings.tsx';
import {CarPlaySiriSettings} from './CarPlaySiriSettings.tsx';

export type SettingsPage='home'|'playback'|'equalizer'|'appearance'|'typography'|'globalFont'|'lyricFont'|'storage'|'downloads'|'downloadTasks'|'sources'|'accounts'|'car'|AppearanceSection;
const titles:Record<SettingsPage,string>={home:'设置',playback:'播放与歌词',equalizer:'EQ 均衡器',appearance:'外观与界面',typography:'歌词显示设置',globalFont:'全局字体',lyricFont:'歌词字体',storage:'数据与存储',downloads:'下载管理',downloadTasks:'下载任务与文件',sources:'音乐来源',accounts:'音乐账号',car:'车载与语音控制',theme:'软件主题',background:'主题与背景',skins:'播放界面样式',mini:'迷你播放器按钮',navigation:'底部栏样式与毛玻璃',accent:'强调色',icons:'软件图标'};
const layoutSummaryLabels:Record<string,string>={classic:'经典',am:'AM',immersive:'沉浸',photo:'写真',vinyl:'黑胶',wave:'声波核',stage:'舞台',am2:'AM2',groove:'螺旋槽',groove2:'螺旋槽 2',teletype:'打字机',teletype2:'打字机 2'};

export function SettingsScreen({services,initialPage='home',homeRequest=0,bottomInset=0,onExit}:{services:Services;initialPage?:SettingsPage;homeRequest?:number;bottomInset?:number;onExit:()=>void}){
  const theme=useTheme(),p=theme.palette,s=sollinTokens(theme.mode,p.accent,theme.appearance);
  const {fontScale}=useWindowDimensions();
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const sources=useSyncExternalStore(services.catalog.subscribe,services.catalog.getSnapshot);
  const sourceUpdateCount=sources.filter(item=>item.hasUpdate&&item.allowUpdateAlert).length;
  const [history,setHistory]=useState<SettingsPage[]>([initialPage]);
  const [visited,setVisited]=useState<SettingsPage[]>([initialPage]);
  const heading=useRef<NativeText>(null),page=history[history.length-1]!;
  const currentPage=useRef(page);currentPage.current=page;
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
  const row=(next:SettingsPage,subtitle:string,icon:React.ComponentProps<typeof Ionicons>['name'],value?:string,grouped=false)=><Pressable testID={`settings-open-${next}`} accessibilityRole="button" accessibilityLabel={titles[next]} accessibilityHint={subtitle} accessibilityValue={value?{text:value}:undefined} onPress={()=>open(next)} style={{paddingHorizontal:16,paddingVertical:14,minHeight:64,flexDirection:'row',alignItems:'center',gap:13,borderRadius:grouped?0:20,backgroundColor:grouped?'transparent':s.card,borderWidth:grouped?0:1,borderColor:s.cardBorder}}>
    <View style={{width:32,height:32,borderRadius:10,backgroundColor:s.dark?'rgba(255,255,255,0.08)':'rgba(42,36,31,0.045)',alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={19} color={s.ink}/></View>
    <View style={{flex:1,gap:2}}><Text style={{color:s.ink,fontSize:15.5,fontWeight:'700'}}>{titles[next]}</Text><Text style={{color:s.muted,fontSize:12,lineHeight:17}}>{subtitle}</Text></View>
    {value&&fontScale<=1.4&&<Text accessible={false} style={{color:s.muted,fontSize:13,maxWidth:96,textAlign:'right'}}>{value}</Text>}
    <Ionicons name="chevron-forward" size={16} color={s.subtle}/>
  </Pressable>;
  const content=(key:SettingsPage)=>{
    switch(key){
      case 'home':return <View style={{gap:14}}>
        <Text style={{color:s.muted,fontSize:13.5,lineHeight:20,marginLeft:4,marginBottom:0}}>让每一次聆听，更像你。</Text>
        <Text accessibilityRole="header" style={{color:s.muted,fontSize:13,fontWeight:'500',marginLeft:6,marginBottom:-6}}>设置分类</Text>
        <View testID="settings-category-group" style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'},s.cardShadow]}>
          {row('playback','播放偏好、歌词、在线音源与音效','musical-notes',preferences.quality.toUpperCase(),true)}
          <View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:60,backgroundColor:s.hairline}}/>
          {row('appearance','主题、字体、界面布局与播放器外观','color-palette',layoutSummaryLabels[preferences.playerLayout]??'经典',true)}
          <View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:60,backgroundColor:s.hairline}}/>
          {row('car','CarPlay、Siri 快捷指令与 Android Auto','car-sport',undefined,true)}
          <View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:60,backgroundColor:s.hairline}}/>
          {row('downloads','下载音质、并发与任务文件管理','cloud-download','下载设置',true)}
          <View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:60,backgroundColor:s.hairline}}/>
          {row('storage','缓存、听歌统计与备份恢复','folder','本地数据',true)}
        </View>
        <Text accessibilityRole="header" style={{color:s.muted,fontSize:13,fontWeight:'500',marginLeft:6,marginTop:4,marginBottom:-6}}>曲库与播放来源</Text>
        <View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'},s.cardShadow]}>
          {row('sources','LX 音源与 Navidrome 私人曲库','server',sourceUpdateCount>0?`${sourceUpdateCount} 个更新`:undefined,true)}
          <View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:60,backgroundColor:s.hairline}}/>
          {row('accounts','网易云、QQ、酷狗、汽水账号与本机会话','person-circle',undefined,true)}
        </View>
      </View>;
      case 'sources':return <MusicSourcesScreen services={services}/>;
      case 'car':return <CarPlaySiriSettings services={services}/>;
      case 'accounts':return <MusicAccountSettings services={services} active={page==='accounts'} onRevealQr={({top,height})=>{
        const scroller=scrolls.current.accounts;
        if(currentPage.current!=='accounts'||!scroller||!Number.isFinite(top)||height<=0)return;
        scroller.getNativeScrollRef()?.measureInWindow((_x,viewportTop,_width,viewportHeight)=>{
          if(currentPage.current!=='accounts'||viewportHeight<=0)return;
          const delta=top-(viewportTop+Math.max(0,(viewportHeight-height)/2));
          scroller.scrollTo({y:Math.max(0,(offsets.current.accounts??0)+delta),animated:false});
        });
      }}/>;
      case 'playback':return <><View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'},s.cardShadow]}>{row('equalizer','10 段曲线、前级、预设与实时音效','options-outline',preferences.eqEnabled?'已开启':undefined,true)}<View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:60,backgroundColor:s.hairline}}/>{row('typography','歌词字体、颜色、双语与逐字效果','text-outline',undefined,true)}</View><AudioSettings services={services}/><PlaybackSettings services={services}/></>;
      case 'equalizer':return <EqualizerSettings services={services}/>;
      case 'appearance':return <AppearanceOverview services={services} open={open}/>;
      case 'icons':return <AppIconSettings/>;
      case 'background':return <View style={{gap:4}}><View style={{flexDirection:'row',justifyContent:'flex-end',marginBottom:-8}}><BackgroundThemeActions services={services}/></View><AppearanceSettings services={services} section="background"/></View>;
      case 'theme':case 'skins':case 'mini':case 'navigation':case 'accent':return <AppearanceSettings services={services} section={key} onStyleSaved={key==='skins'?back:undefined}/>;
      case 'typography':case 'globalFont':case 'lyricFont':return <FontSettings services={services} section={key==='typography'?'display':key==='globalFont'?'global':'lyric'} onOpen={section=>open(section==='display'?'typography':section==='global'?'globalFont':'lyricFont')}/>;
      case 'downloads':return <DownloadSettings services={services} openTasks={()=>open('downloadTasks')}/>;
      case 'downloadTasks':return <DownloadTasks services={services}/>;
      case 'storage':return <><CacheSettings services={services}/><LibraryDataTools services={services}/></>;
    }
  };
  return <View style={{flex:1}} onAccessibilityEscape={page==='home'?undefined:back}>
    <View style={{paddingHorizontal:22,paddingVertical:0,minHeight:54,flexDirection:'row',alignItems:'center',justifyContent:'center',borderBottomWidth:page==='home'?0:StyleSheet.hairlineWidth,borderBottomColor:s.hairline}}>
      {page!=='home'&&<Pressable testID="settings-back" accessibilityRole="button" accessibilityLabel={history.length>1?`返回${titles[history[history.length-2]!]}`:'返回音乐库'} onPress={back} style={{position:'absolute',left:6,top:3,bottom:3,width:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="chevron-back" size={27} color={p.text}/></Pressable>}
      <Text ref={heading} testID={`settings-title-${page}`} accessibilityRole="header" style={{fontSize:page==='home'?36:20,fontWeight:'700',letterSpacing:page==='home'?undefined:-1,color:p.text,flex:1,textAlign:page==='home'?'left':'center',marginHorizontal:page==='home'?0:44}}>{titles[page]}</Text>
    </View>
    {visited.map(key=><View key={key} testID={`settings-viewport-${key}`} style={{flex:1,display:key===page?'flex':'none'}} accessibilityElementsHidden={key!==page} importantForAccessibility={key===page?'auto':'no-hide-descendants'} pointerEvents={key===page?'auto':'none'}>
      {key==='downloadTasks'?content(key):<ScrollView ref={node=>{scrolls.current[key]=node;}} testID={`settings-scroll-${key}`} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" scrollEventThrottle={32} onScroll={event=>{if(key===page&&restoring.current===null)offsets.current[key]=Math.max(0,event.nativeEvent.contentOffset.y);}} contentContainerStyle={{paddingHorizontal:20,paddingTop:10,paddingBottom:Math.max(40,bottomInset+34)}} showsVerticalScrollIndicator={false}>{content(key)}</ScrollView>}
    </View>)}
  </View>;
}
