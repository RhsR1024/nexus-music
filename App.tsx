import {SavedCatalogs} from './src/ui/SavedCatalogs.tsx';
import {TypographyProvider} from './src/ui/Typography.tsx';
import {Text} from './src/ui/Typography.tsx';
import {FutureRecordError} from './src/storage/recovery.ts';
import {ThemeContext,useAppearance} from './src/ui/theme.tsx';
import {AmbientBackground,GlassSurface} from './src/ui/Materials.tsx';
import {SettingsScreen,type SettingsPage} from './src/ui/SettingsScreen.tsx';
import {LocalAudioLibrary} from './src/ui/LocalAudioLibrary.tsx';
import {sollinTokens} from './src/ui/tokens.ts';
import {defaults} from './src/app/preferences.ts';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {getServices,type Services} from './src/app/services';
import {Player} from './src/ui/Player';
import {Search,type SearchSession} from './src/ui/Search';
import {Discovery} from './src/ui/Discovery';
import {PresentationProvider} from './src/ui/AdaptiveModal.tsx';
import {NavidromeLibrary} from './src/ui/NavidromeLibrary';
import {LibraryHome} from './src/ui/LibraryHome';
import {StatusBar} from 'expo-status-bar';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaProvider,useSafeAreaInsets} from 'react-native-safe-area-context';
import {Linking, Pressable, ScrollView, View, useWindowDimensions} from 'react-native';
type Tab='discover'|'library'|'local'|'search'|'settings';
const emptySubscribe=()=>()=>{};
const defaultPrefs=()=>defaults;
const emptyQueueSub=()=>()=>{};
const emptyHasTrack=()=>false;
export default function App(){return <MusicApplication initialize={getServices}/>;}
type ApplicationProps={initialize:()=>Promise<Services>;initialSettingsPage?:SettingsPage};
export function MusicApplication(props:ApplicationProps){return <PresentationProvider><SafeAreaProvider><MusicApp {...props}/></SafeAreaProvider></PresentationProvider>;}
function MusicApp({initialize,initialSettingsPage}:ApplicationProps){
  const [tab,setTab]=useState<Tab>(initialSettingsPage?'settings':'discover'),[privateLibrary,setPrivateLibrary]=useState(false);
  const [chromeHeight,setChromeHeight]=useState(80);
  const [searchSession,setSearchSession]=useState<SearchSession>({kind:'song',query:'',platform:'all'});
  const [artistQuery,setArtistQuery]=useState<string|undefined>(undefined);
  const [settingsEntry,setSettingsEntry]=useState<SettingsPage>(initialSettingsPage??'home'),[settingsRevision,setSettingsRevision]=useState(0);
  const navigateTab=(next:Tab)=>{if(next==='settings'){setSettingsEntry('home');setSettingsRevision(value=>value+1);}setTab(next);};
  const openSources=()=>{setSettingsEntry('sources');setTab('settings');};
  const openAccounts=()=>{setSettingsEntry('accounts');setTab('settings');};
  const openArtistSearch=(artist:string)=>{const q=artist.trim();if(!q)return;setSearchSession({kind:'song',query:q,platform:'all'});setArtistQuery(q);setTab('search');};
  const [services,setServices]=useState<Services>(),[startupError,setStartupError]=useState<string>();
  const insets=useSafeAreaInsets(),{width,height,fontScale}=useWindowDimensions();
  const expanded=width>=768&&height>=500&&width/Math.max(1,fontScale)>=620;
  const railWidth=expanded?196:0;
  const preferences=useSyncExternalStore(services?.preferences.subscribe??emptySubscribe,services?.preferences.getSnapshot??defaultPrefs);
  const hasCurrentTrack=useSyncExternalStore(services?.playback.controller.subscribe??emptyQueueSub,()=>services?!!services.playback.controller.getSnapshot().queue.currentId:emptyHasTrack());
  const effectiveTab:Tab=tab==='local'&&!preferences.showLocalTab?'library':tab;
  const barTabs=([
    ['discover','grid-outline','grid','发现'],
    ['library','albums-outline','albums','音乐库'],
    ...(preferences.showLocalTab?([['local','phone-portrait-outline','phone-portrait','本地']] as const):[]),
    ['settings','settings-outline','settings','设置'],
  ] as const);
  const navigation=[
    ...barTabs,
    ['search','search-outline','search','搜索'] as const,
  ] as const;
  const startup=()=>{setStartupError(undefined);void initialize().then(setServices,error=>setStartupError(error instanceof FutureRecordError?error.message:'无法打开本地数据或原生模块，原始数据已保留，请重试。'));};
  useEffect(()=>{let active=true;void initialize().then(value=>{if(active)setServices(value);},error=>{if(active)setStartupError(error instanceof FutureRecordError?error.message:'无法打开本地数据或原生模块，原始数据已保留，请重试。');});return()=>{active=false;};},[initialize]);
  useEffect(()=>{const open=(url:string|null)=>{if(url?.startsWith('com.nexusmusic.app://settings')){setSettingsEntry('home');setTab('settings');}};void Linking.getInitialURL().then(open);const subscription=Linking.addEventListener('url',event=>open(event.url));return()=>subscription.remove();},[]);
  const autoPlayApplied=useRef(false);
  useEffect(()=>{
    if(!services||autoPlayApplied.current)return;
    autoPlayApplied.current=true;
    const pref=services.preferences.getSnapshot();
    if(!pref.autoPlayOnLaunch)return;
    const state=services.playback.controller.getSnapshot();
    if(state.intent==='playing')return;
    if(pref.autoPlaySource==='favorites'){
      const favs=services.library.getSnapshot().favorites;
      if(favs.length>0){services.playTracks(favs,0);return;}
    }
    if(state.queue.currentId)void services.playback.controller.play();
  },[services]);
  const theme=useAppearance(services?.preferences,services?.coverTheme),p=theme.palette,s=sollinTokens(theme.mode,p.accent,theme.appearance);
  const navStyle=preferences.navigationStyle;
  const activePillBg=s.dark?'rgba(255,255,255,0.14)':'rgba(255,255,255,0.74)';
  const text={color:s.ink},caption={color:s.muted};
  const tabItem=(key:Tab,outline:React.ComponentProps<typeof Ionicons>['name'],filled:React.ComponentProps<typeof Ionicons>['name'],title:string,compact=false)=>{
    const selected=effectiveTab===key;
    return <Pressable key={key} testID={`tab-${key}`} accessibilityLabel={title} accessibilityRole="tab" accessibilityState={{selected}} onPress={()=>navigateTab(key)} style={{flex:1,alignItems:'center',justifyContent:'center',minHeight:compact?46:50,borderRadius:24,marginHorizontal:2,paddingVertical:4,backgroundColor:selected&&navStyle==='liquid'?activePillBg:'transparent',gap:2}}>
      <Ionicons name={selected?filled:outline} size={compact?21:22} color={selected?s.accent:s.ink}/>
      <Text numberOfLines={1} style={{color:selected?s.accent:s.muted,fontSize:11,lineHeight:14,fontWeight:selected?'600':'500'}}>{title}</Text>
    </Pressable>;
  };
  return <ThemeContext.Provider value={theme}><TypographyProvider store={services?.fonts}><View style={{flex:1,backgroundColor:p.background[0]}}>
    <AmbientBackground services={services}/><StatusBar hidden={preferences.fullScreenMode} style={theme.mode==='dark'?'light':'dark'}/>
    <View testID={expanded?'app-layout-expanded':'app-layout-compact'} style={{flex:1,flexDirection:'row',paddingTop:insets.top+(effectiveTab==='settings'?0:6),paddingLeft:insets.left,paddingRight:insets.right,paddingBottom:chromeHeight+Math.max(insets.bottom,10)+8}}>
      <View style={{width:railWidth,display:expanded?'flex':'none',paddingHorizontal:16}}>
        <Text accessibilityRole="header" style={[text,{fontSize:24,fontWeight:'700',padding:12,marginBottom:20}]}>音枢</Text>
        <View style={{gap:10}}>{navigation.map(([key,outline,filled,title])=><Pressable key={key} testID={`rail-tab-${key}`} accessibilityLabel={title} accessibilityRole="tab" accessibilityState={{selected:effectiveTab===key}} onPress={()=>navigateTab(key)} style={{minHeight:50,paddingHorizontal:14,paddingVertical:10,borderRadius:16,backgroundColor:effectiveTab===key?s.accentSoft:s.card,borderWidth:1,borderColor:effectiveTab===key?s.accentPill:s.cardBorder,flexDirection:'row',alignItems:'center',gap:12}}><Ionicons name={effectiveTab===key?filled:outline} size={22} color={effectiveTab===key?s.accent:s.muted}/><Text style={{color:effectiveTab===key?s.accent:s.ink,fontSize:15,fontWeight:effectiveTab===key?'600':'500',flexShrink:1}}>{title}</Text></Pressable>)}</View>
      </View>
      <View style={{flex:1,minWidth:0,maxWidth:1120,alignSelf:'stretch',marginHorizontal:expanded?'auto':0}}>
      {effectiveTab==='discover'&&services&&!startupError?<Discovery services={services} embedded openAccounts={openAccounts} openSources={openSources} catalogShortcuts={<SavedCatalogs services={services} compact/>}/>
        :effectiveTab==='settings'&&services&&!startupError?<SettingsScreen key={settingsEntry} services={services} initialPage={settingsEntry} homeRequest={settingsRevision} onExit={()=>setTab(settingsEntry==='sources'?'library':'discover')}/>
        :effectiveTab==='local'&&services&&!startupError?<LocalAudioLibrary services={services} embedded/>
        :<ScrollView testID={effectiveTab==='search'?'search-viewport':undefined} automaticallyAdjustKeyboardInsets keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:20,paddingTop:8,paddingBottom:28}}>
          {startupError?<View style={{paddingVertical:32,gap:12}}><Text style={caption}>{startupError}</Text><Pressable accessibilityRole="button" onPress={startup} style={{alignSelf:'flex-start',paddingHorizontal:18,paddingVertical:12,borderRadius:20,backgroundColor:s.accentSoft}}><Text style={{color:s.accent,fontWeight:'600'}}>重试打开</Text></Pressable></View>:!services?<Text style={[caption,{paddingVertical:24}]}>正在打开音乐数据…</Text>:effectiveTab==='library'?<>
            <View style={{flexDirection:'row',gap:8,marginBottom:14}}>{([false,true]as const).map(value=><Pressable key={String(value)} testID={value?'tab-private':'library-local'} accessibilityRole="tab" accessibilityState={{selected:privateLibrary===value}} onPress={()=>setPrivateLibrary(value)} style={{paddingHorizontal:16,paddingVertical:9,borderRadius:20,backgroundColor:privateLibrary===value?s.control:s.chip,borderWidth:1,borderColor:privateLibrary===value?s.control:s.chipBorder}}><Text style={{color:privateLibrary===value?'#FFFFFF':s.muted,fontSize:13,fontWeight:'600'}}>{value?'私人曲库':'我的音乐'}</Text></Pressable>)}</View>
            {privateLibrary?<NavidromeLibrary services={services} openSettings={openSources}/>:<LibraryHome services={services} openSearch={()=>setTab('search')} openSettings={openSources} openAccounts={openAccounts}/>}
          </>:<Search services={services} session={searchSession} initialQuery={artistQuery} onSessionChange={update=>setSearchSession(previous=>({...previous,...update}))}/>}
        </ScrollView>}
      </View>
    </View>
    <View pointerEvents="box-none" onLayout={event=>{const height=event.nativeEvent.layout.height;setChromeHeight(previous=>Math.abs(previous-height)<.5?previous:height);}} style={{position:'absolute',bottom:Math.max(insets.bottom,10),left:expanded?insets.left+railWidth+16:14,right:insets.right+14,gap:8}}>
      {navStyle==='frosted'&&!expanded?(
        <GlassSurface variant="frosted" radius={28}>
          <View>
            {services&&hasCurrentTrack&&<View style={{borderBottomWidth:1,borderBottomColor:s.hairline}}><Player services={services} fused onSearchArtist={openArtistSearch}/></View>}
            <View style={{flexDirection:'row',paddingHorizontal:6,paddingVertical:6,alignItems:'center'}}>
              {barTabs.map(([key,outline,filled,title])=>tabItem(key,outline,filled,title,true))}
              {tabItem('search','search-outline','search','搜索',true)}
            </View>
          </View>
        </GlassSurface>
      ):(
        <>
          {services&&<Player services={services} barVariant={navStyle} onSearchArtist={openArtistSearch}/>}
          <View style={{flexDirection:'row',gap:10,alignItems:'center',justifyContent:navStyle==='acrylic'?'center':'flex-start',display:expanded?'none':'flex'}}>
            <GlassSurface variant={navStyle} radius={31} style={navStyle==='acrylic'?{minWidth:268,maxWidth:330,flex:1}:{flex:1}}>
              <View style={{flexDirection:'row',paddingHorizontal:6,paddingVertical:5}}>
                {barTabs.map(([key,outline,filled,title])=>tabItem(key,outline,filled,title))}
              </View>
            </GlassSurface>
            <GlassSurface variant={navStyle} radius={31} style={{width:62,height:62}}>
              <Pressable testID="tab-search" accessibilityLabel="搜索" accessibilityRole="tab" accessibilityState={{selected:effectiveTab==='search'}} onPress={()=>setTab('search')} style={{flex:1,alignItems:'center',justifyContent:'center',borderRadius:31,backgroundColor:effectiveTab==='search'?activePillBg:'transparent'}}>
                <Ionicons name={effectiveTab==='search'?'search':'search-outline'} size={24} color={effectiveTab==='search'?s.accent:s.ink}/>
              </Pressable>
            </GlassSurface>
          </View>
        </>
      )}
    </View>
  </View></TypographyProvider></ThemeContext.Provider>;
}
