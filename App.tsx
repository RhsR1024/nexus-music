import {PlaybackSettings} from './src/ui/PlaybackSettings';
import {FutureRecordError} from './src/storage/recovery.ts';
import {ThemeContext,useAppearance} from './src/ui/theme.tsx';
import {AmbientBackground,GlassSurface} from './src/ui/Materials.tsx';
import {AppearanceSettings} from './src/ui/AppearanceSettings.tsx';
import {useEffect,useState} from 'react';
import {getServices,type Services} from './src/app/services';
import {SourceSettings} from './src/ui/SourceSettings';
import {AudioSettings} from './src/ui/AudioSettings';
import {Player} from './src/ui/Player';
import {Search} from './src/ui/Search';
import {Discovery} from './src/ui/Discovery';
import {NavidromeSettings} from './src/ui/NavidromeSettings';
import {NavidromeLibrary} from './src/ui/NavidromeLibrary';
import {CacheSettings} from './src/ui/CacheSettings';
import {FontSettings} from './src/ui/FontSettings';
import {LibraryHome} from './src/ui/LibraryHome';
import {StatusBar} from 'expo-status-bar';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaProvider,useSafeAreaInsets} from 'react-native-safe-area-context';
import {Linking,Pressable,ScrollView,Text,View} from 'react-native';
type Tab='discover'|'library'|'search'|'settings';
export default function App(){return <MusicApplication initialize={getServices}/>;}
export function MusicApplication({initialize}:{initialize:()=>Promise<Services>}){return <SafeAreaProvider><MusicApp initialize={initialize}/></SafeAreaProvider>;}
function MusicApp({initialize}:{initialize:()=>Promise<Services>}){
  const [tab,setTab]=useState<Tab>('discover'),[privateLibrary,setPrivateLibrary]=useState(false);
  const [chromeHeight,setChromeHeight]=useState(80);
  const [services,setServices]=useState<Services>(),[startupError,setStartupError]=useState<string>();
  const insets=useSafeAreaInsets();
  const startup=()=>{setStartupError(undefined);void initialize().then(setServices,error=>setStartupError(error instanceof FutureRecordError?error.message:'无法打开本地数据或原生模块，原始数据已保留，请重试。'));};
  useEffect(()=>{let active=true;void initialize().then(value=>{if(active)setServices(value);},error=>{if(active)setStartupError(error instanceof FutureRecordError?error.message:'无法打开本地数据或原生模块，原始数据已保留，请重试。');});return()=>{active=false;};},[initialize]);
  useEffect(()=>{const open=(url:string|null)=>{if(url?.startsWith('com.nexusmusic.app://settings'))setTab('settings');};void Linking.getInitialURL().then(open);const subscription=Linking.addEventListener('url',event=>open(event.url));return()=>subscription.remove();},[]);
  const theme=useAppearance(services?.preferences),p=theme.palette;
  const text={color:p.text},caption={color:p.secondary};
  return <ThemeContext.Provider value={theme}><View style={{flex:1,backgroundColor:p.background[0]}}>
    <AmbientBackground/><StatusBar style={theme.mode==='dark'?'light':'dark'}/>
    <View style={{flex:1,paddingTop:insets.top+12,paddingBottom:chromeHeight+Math.max(insets.bottom,12)+10}}>
      {tab==='discover'&&services&&!startupError?<Discovery services={services} embedded/>:<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingHorizontal:22,paddingTop:14,paddingBottom:32}}>
        <Text style={[caption,{fontSize:11,letterSpacing:3,marginBottom:12}]}>音枢 · NEXUS MUSIC</Text>
        {startupError?<View><Text style={caption}>{startupError}</Text><Pressable accessibilityRole="button" onPress={startup} style={{padding:16}}><Text style={{color:p.accent}}>重试打开</Text></Pressable></View>:!services?<Text style={caption}>正在打开音乐数据…</Text>:tab==='library'?<>
          <View style={{flexDirection:'row',gap:12,marginBottom:22}}>{([false,true]as const).map(value=><Pressable key={String(value)} testID={value?'tab-private':'library-local'} accessibilityRole="tab" accessibilityState={{selected:privateLibrary===value}} onPress={()=>setPrivateLibrary(value)} style={{paddingHorizontal:18,paddingVertical:12,borderRadius:22,backgroundColor:privateLibrary===value?p.selected:p.surface}}><Text style={{color:privateLibrary===value?p.accent:p.secondary,fontWeight:'600'}}>{value?'私人曲库':'我的音乐'}</Text></Pressable>)}</View>
          {privateLibrary?<NavidromeLibrary services={services} openSettings={()=>setTab('settings')}/>:<LibraryHome services={services} openSearch={()=>setTab('search')} openSettings={()=>setTab('settings')}/>}
        </>:tab==='search'?<Search services={services}/>:<>
          <Text accessibilityRole="header" style={[text,{fontSize:36,fontWeight:'700',marginBottom:8}]}>设置</Text>
          <Text style={[caption,{lineHeight:23,marginBottom:12}]}>连接你的曲库，让音乐更像你。</Text>
          <NavidromeSettings services={services}/><SourceSettings catalog={services.catalog}/><AppearanceSettings services={services}/><AudioSettings services={services}/><PlaybackSettings services={services}/><FontSettings services={services}/><CacheSettings services={services}/>
        </>}
      </ScrollView>}
    </View>
    <View pointerEvents="box-none" onLayout={event=>{const height=event.nativeEvent.layout.height;setChromeHeight(previous=>Math.abs(previous-height)<.5?previous:height);}} style={{position:'absolute',bottom:Math.max(insets.bottom,12),left:16,right:16,gap:10}}>
      {services&&<Player services={services}/>}
      <View style={{flexDirection:'row',gap:10,alignItems:'center'}}>
        <GlassSurface style={{flex:1}}><View style={{flexDirection:'row',paddingVertical:9}}>{([
          ['discover','grid-outline','发现'],['library','albums-outline','音乐库'],['settings','settings-outline','设置'],
        ]as const).map(([key,icon,title])=><Pressable key={key} testID={`tab-${key}`} accessibilityLabel={title} accessibilityRole="tab" accessibilityState={{selected:tab===key}} onPress={()=>setTab(key)} style={{flex:1,alignItems:'center',gap:4,minHeight:48,justifyContent:'center'}}>
          <Ionicons name={icon} size={24} color={tab===key?p.accent:p.secondary}/><Text style={{color:tab===key?p.accent:p.secondary,fontSize:12,fontWeight:tab===key?'700':'400'}}>{title}</Text>
        </Pressable>)}</View></GlassSurface>
        <GlassSurface style={{width:70,height:70,borderRadius:35}}><Pressable testID="tab-search" accessibilityLabel="搜索" accessibilityRole="tab" accessibilityState={{selected:tab==='search'}} onPress={()=>setTab('search')} style={{flex:1,alignItems:'center',justifyContent:'center'}}><Ionicons name="search-outline" size={28} color={tab==='search'?p.accent:p.text}/></Pressable></GlassSurface>
      </View>
    </View>
  </View></ThemeContext.Provider>;
}
