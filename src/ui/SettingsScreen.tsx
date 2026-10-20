import {useEffect,useLayoutEffect,useRef,useState,useSyncExternalStore} from 'react';
import {AccessibilityInfo,BackHandler,findNodeHandle,Keyboard,Pressable,ScrollView,View,useWindowDimensions,type Text as NativeText} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import type {Services} from '../app/services.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {SheetModal} from './AdaptiveModal.tsx';
import {AppearanceSettings,BackgroundThemeActions,type AppearanceSection} from './AppearanceSettings.tsx';
import {AppearanceOverview} from './AppearanceOverview.tsx';
import {AudioSettings} from './AudioSettings.tsx';
import {EqualizerSettings} from './EqualizerSettings.tsx';
import {PlaybackSettings} from './PlaybackSettings.tsx';
import {FontSettings} from './FontSettings.tsx';
import {CacheSettings} from './CacheSettings.tsx';
import {DownloadSettings,DownloadTasks} from './DownloadSettings.tsx';
import {LibraryDataTools} from './LibraryDataTools.tsx';
import {NavidromeSettings} from './NavidromeSettings.tsx';
import {SourceSettings} from './SourceSettings.tsx';

export type SettingsPage='home'|'playback'|'equalizer'|'appearance'|'typography'|'globalFont'|'lyricFont'|'storage'|'downloads'|'downloadTasks'|'sources'|AppearanceSection;
type AppearanceSheetSection='background'|'theme'|'skins'|'mini'|'navigation'|'typography'|'globalFont'|'lyricFont';
const isAppearanceSheet=(page:SettingsPage):page is AppearanceSheetSection=>page==='background'||page==='theme'||page==='skins'||page==='mini'||page==='navigation'||page==='typography'||page==='globalFont'||page==='lyricFont';
const sheetIDs:Record<AppearanceSheetSection,string>={background:'theme-background-sheet',theme:'theme-mode-sheet',skins:'player-style-sheet',mini:'mini-settings-sheet',navigation:'navigation-style-sheet',typography:'lyric-display-sheet',globalFont:'global-font-sheet',lyricFont:'lyric-font-sheet'};
const titles:Record<SettingsPage,string>={home:'设置',playback:'播放与歌词',equalizer:'EQ 均衡器',appearance:'外观与界面',typography:'歌词显示设置',globalFont:'全局字体',lyricFont:'歌词字体',storage:'数据与存储',downloads:'下载管理',downloadTasks:'下载任务与文件',sources:'音乐来源',theme:'软件主题',background:'主题与背景',skins:'播放界面样式',mini:'迷你播放器按钮',navigation:'底部栏样式',accent:'强调色'};

export function SettingsScreen({services,initialPage='home',homeRequest=0,onExit}:{services:Services;initialPage?:SettingsPage;homeRequest?:number;onExit:()=>void}){
  const {palette:p}=useTheme();
  const {fontScale}=useWindowDimensions();
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const firstPage=isAppearanceSheet(initialPage)?initialPage==='typography'?'playback':'appearance':initialPage;
  const [history,setHistory]=useState<SettingsPage[]>([firstPage]);
  const [visited,setVisited]=useState<SettingsPage[]>([firstPage]);
  const [appearanceSheet,setAppearanceSheet]=useState<{section:AppearanceSheetSection;visible:boolean;session:number}>({section:isAppearanceSheet(initialPage)?initialPage:'theme',visible:isAppearanceSheet(initialPage),session:0});
  const closeSheet=()=>setAppearanceSheet(value=>({...value,visible:false,session:value.session+1}));
  // IMG_4856 is scrolled past the sheet title and actions, so the background
  // sheet retires that row while its content moves instead of pinning it over
  // the reference's blank top band. The close button stays pinned for testing
  // and for users who prefer a tap target over swipe dismissal.
  const [headerCollapsed,setHeaderCollapsed]=useState(false);
  useEffect(()=>{if(appearanceSheet.visible)setHeaderCollapsed(false);},[appearanceSheet.visible,appearanceSheet.section]);
  const heading=useRef<NativeText>(null),page=history[history.length-1]!;
  const scrolls=useRef<Partial<Record<SettingsPage,ScrollView|null>>>({}),offsets=useRef<Partial<Record<SettingsPage,number>>>({});
  const restoring=useRef<SettingsPage|null>(null);
  const previousHomeRequest=useRef(homeRequest);
  useLayoutEffect(()=>{
    if(previousHomeRequest.current===homeRequest)return;
    previousHomeRequest.current=homeRequest;
    Keyboard.dismiss();
    closeSheet();
    setVisited(value=>value.includes('home')?value:[...value,'home']);
    setHistory(['home']);
  },[homeRequest]);
  useLayoutEffect(()=>{
    restoring.current=page;let settle:number|undefined;
    const frame=requestAnimationFrame(()=>{scrolls.current[page]?.scrollTo({y:offsets.current[page]??0,animated:false});settle=requestAnimationFrame(()=>{restoring.current=null;});});
    return()=>{cancelAnimationFrame(frame);if(settle!==undefined)cancelAnimationFrame(settle);};
  },[page]);
  const back=()=>{Keyboard.dismiss();if(history.length>1)setHistory(value=>value.slice(0,-1));else if(page!=='home')onExit();};
  const open=(next:SettingsPage)=>{Keyboard.dismiss();if(isAppearanceSheet(next)){setAppearanceSheet(value=>({section:next,visible:true,session:value.session+1}));return;}setVisited(value=>value.includes(next)?value:[...value,next]);setHistory(value=>[...value,next]);};
  useEffect(()=>{let active=true;void AccessibilityInfo.isScreenReaderEnabled().then(enabled=>{if(active&&enabled){const node=findNodeHandle(heading.current);if(node)AccessibilityInfo.setAccessibilityFocus(node);}});return()=>{active=false;};},[page]);
  useEffect(()=>{const listener=BackHandler.addEventListener('hardwareBackPress',()=>{if(page==='home')return false;back();return true;});return()=>listener.remove();},[page,history.length]);
  const row=(next:SettingsPage,subtitle:string,icon:React.ComponentProps<typeof Ionicons>['name'],value?:string,grouped=false)=><Pressable testID={`settings-open-${next}`} accessibilityRole="button" accessibilityLabel={titles[next]} accessibilityHint={subtitle} accessibilityValue={value?{text:value}:undefined} onPress={()=>open(next)} style={{padding:18,minHeight:82,flexDirection:'row',alignItems:'center',gap:14,borderRadius:grouped?0:22,backgroundColor:grouped?'transparent':p.surface,borderWidth:grouped?0:1,borderColor:p.border}}>
    <View style={{width:grouped?28:44,height:44,borderRadius:14,backgroundColor:grouped?'transparent':p.selected,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={24} color={p.accent}/></View>
    <View style={{flex:1,gap:6}}><Text style={{color:p.text,fontSize:18,fontWeight:'600'}}>{titles[next]}</Text><Text style={{color:p.secondary,fontSize:13,lineHeight:20}}>{subtitle}</Text></View>
    {value&&fontScale<=1.4&&<Text accessible={false} style={{color:p.secondary,fontSize:13,maxWidth:72,textAlign:'right'}}>{value}</Text>}
    <Ionicons name="chevron-forward" size={20} color={p.secondary}/>
  </Pressable>;
  const content=(key:SettingsPage)=>{
    switch(key){
      case 'home':return <View style={{gap:14}}>
        <Text style={{color:p.secondary,lineHeight:23,marginBottom:8}}>让每一次聆听，更像你。</Text>
        <Text accessibilityRole="header" style={{color:p.secondary,fontSize:13}}>设置分类</Text>
        <View testID="settings-category-group" style={{borderRadius:22,backgroundColor:p.surface,borderWidth:1,borderColor:p.border,overflow:'hidden'}}>
          {row('playback','音质、睡眠、歌词与均衡器','musical-notes-outline',preferences.quality.toUpperCase(),true)}
          <View accessible={false} style={{height:1,marginLeft:60,backgroundColor:p.border}}/>
          {row('appearance','主题、字体、播放界面与迷你播放器','color-palette-outline',({classic:'经典',am:'AM',immersive:'沉浸',photo:'写真',vinyl:'黑胶',wave:'声波核',stage:'舞台',am2:'AM2'}as const)[preferences.playerLayout],true)}
          <View accessible={false} style={{height:1,marginLeft:60,backgroundColor:p.border}}/>
          {row('downloads','下载偏好、任务与已保存文件','cloud-download-outline','下载设置',true)}
          <View accessible={false} style={{height:1,marginLeft:60,backgroundColor:p.border}}/>
          {row('storage','缓存、备份、同步与歌单迁移','folder-outline','本地数据',true)}
        </View>
        <Text accessibilityRole="header" style={{color:p.secondary,fontSize:13,marginTop:12}}>曲库与播放来源</Text>
        {row('sources','LX 音源与 Navidrome 私人曲库','server-outline')}
      </View>;
      case 'sources':return <><NavidromeSettings services={services}/><SourceSettings catalog={services.catalog} health={services.sourceHealth}/></>;
      case 'playback':return <><View style={{gap:12}}>{row('equalizer','10 段曲线、前级、预设与实时音效','options-outline')}{row('typography','歌词字体、颜色、对齐与逐字效果','text-outline')}</View><AudioSettings services={services}/><PlaybackSettings services={services}/></>;
      case 'equalizer':return <EqualizerSettings services={services}/>;
      case 'appearance':return <AppearanceOverview services={services} open={open}/>;
      case 'theme':case 'background':case 'skins':case 'mini':case 'navigation':case 'accent':return <AppearanceSettings services={services} section={key}/>;
      case 'typography':case 'globalFont':case 'lyricFont':return <FontSettings services={services} section={key==='typography'?'display':key==='globalFont'?'global':'lyric'} onOpen={section=>open(section==='display'?'typography':section==='global'?'globalFont':'lyricFont')}/>;
      case 'downloads':return <DownloadSettings services={services} openTasks={()=>open('downloadTasks')}/>;
      case 'downloadTasks':return <DownloadTasks services={services}/>;
      case 'storage':return <><CacheSettings services={services}/><LibraryDataTools services={services}/></>;
    }
  };
  return <View style={{flex:1}} onAccessibilityEscape={page==='home'?undefined:back}>
    <View style={{paddingHorizontal:22,paddingVertical:12,minHeight:64,flexDirection:'row',alignItems:'center',justifyContent:'center'}}>
      {page!=='home'&&<Pressable testID="settings-back" accessibilityRole="button" accessibilityLabel={history.length>1?`返回${titles[history[history.length-2]!]}`:'返回音乐库'} onPress={back} style={{position:'absolute',left:12,top:8,bottom:8,width:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="chevron-back" size={27} color={p.text}/></Pressable>}
      <Text ref={heading} testID={`settings-title-${page}`} accessibilityRole="header" style={{fontSize:page==='home'?36:20,fontWeight:'700',color:p.text,flex:1,textAlign:page==='home'?'left':'center',marginHorizontal:page==='home'?0:36}}>{titles[page]}</Text>
    </View>
    {visited.map(key=><View key={key} testID={`settings-viewport-${key}`} style={{flex:1,display:key===page?'flex':'none'}} accessibilityElementsHidden={key!==page||appearanceSheet.visible} importantForAccessibility={key===page&&!appearanceSheet.visible?'auto':'no-hide-descendants'} pointerEvents={key===page&&!appearanceSheet.visible?'auto':'none'}>
      {key==='downloadTasks'?content(key):<ScrollView ref={node=>{scrolls.current[key]=node;}} testID={`settings-scroll-${key}`} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" scrollEventThrottle={32} onScroll={event=>{if(key===page&&restoring.current===null)offsets.current[key]=Math.max(0,event.nativeEvent.contentOffset.y);}} contentContainerStyle={{paddingHorizontal:22,paddingTop:10,paddingBottom:32}}>{content(key)}</ScrollView>}
    </View>)}
    <SheetModal visible={appearanceSheet.visible} animationType="slide" allowSwipeDismissal onRequestClose={closeSheet}>
      <View testID={sheetIDs[appearanceSheet.section]} accessibilityViewIsModal onAccessibilityEscape={closeSheet} style={{flex:1,backgroundColor:p.background[0],paddingHorizontal:appearanceSheet.section==='background'?16:22,paddingTop:appearanceSheet.section==='background'?48:18}}>
        {appearanceSheet.section==='background'&&<>
          <LinearGradient testID="theme-sheet-gradient" pointerEvents="none" colors={[p.background[0],p.background[1],p.background[2]]} start={{x:0,y:0}} end={{x:0.55,y:1}} style={{position:'absolute',top:0,right:0,bottom:0,left:0}}/>
          <View accessible={false} style={{alignItems:'center',paddingBottom:24}}><View style={{width:32,height:4,borderRadius:2,backgroundColor:p.secondary+'66'}}/></View>
        </>}
        <View style={{flexDirection:'row',alignItems:'center',gap:appearanceSheet.section==='background'?0:12}}>
          <View
            style={{flex:1,flexDirection:'row',alignItems:'center',gap:4,opacity:appearanceSheet.section==='background'&&headerCollapsed?0:1}}
            pointerEvents={appearanceSheet.section==='background'&&headerCollapsed?'none':'auto'}
            accessibilityElementsHidden={appearanceSheet.section==='background'&&headerCollapsed}
            importantForAccessibility={appearanceSheet.section==='background'&&headerCollapsed?'no-hide-descendants':'auto'}>
            <Text testID={`settings-title-${appearanceSheet.section}`} accessibilityRole="header" style={{flex:1,fontSize:24,fontWeight:'700',color:p.text}}>{titles[appearanceSheet.section]}</Text>
            {appearanceSheet.section==='background'&&<BackgroundThemeActions services={services}/>}
          </View>
          <Pressable testID={`${appearanceSheet.section}-sheet-close`} accessibilityRole="button" accessibilityLabel={`关闭${titles[appearanceSheet.section]}`} onPress={closeSheet} style={{width:48,minHeight:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="close" size={26} color={p.text}/></Pressable>
        </View>
        <ScrollView key={`${appearanceSheet.section}:${appearanceSheet.session}`} testID={`${appearanceSheet.section}-sheet-scroll`} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" scrollEventThrottle={appearanceSheet.section==='background'?64:undefined} onScroll={appearanceSheet.section==='background'?event=>setHeaderCollapsed(event.nativeEvent.contentOffset.y>90):undefined} contentContainerStyle={{paddingBottom:32}}>{appearanceSheet.section==='typography'||appearanceSheet.section==='globalFont'||appearanceSheet.section==='lyricFont'?content(appearanceSheet.section):<AppearanceSettings key={`${appearanceSheet.section}:${appearanceSheet.session}`} services={services} section={appearanceSheet.section} onStyleSaved={()=>{
          // A completed write from an earlier presentation must not close a newly opened sheet.
          const session=appearanceSheet.session;
          setAppearanceSheet(value=>value.session===session?{...value,visible:false,session:value.session+1}:value);
        }}/>}</ScrollView>
      </View>
    </SheetModal>
  </View>;
}
