import {useState,useSyncExternalStore,type ReactNode} from 'react';
import {Pressable,StyleSheet,Switch,View,useWindowDimensions} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {StageStyle} from '../app/preferences.ts';
import type {Track} from '../domain/track.ts';
import {Lyrics} from './Lyrics.tsx';
import {Text} from './Typography.tsx';

export const stageStyles=[['classic','经典'],['neon','霓虹'],['cyberpunk','赛博'],['aurora','炫彩']] as const;
const backgrounds:Record<StageStyle,readonly [string,string,string]>={classic:['#09131F','#09131F','#09131F'],neon:['#132938','#251C39','#0A1723'],cyberpunk:['#062C39','#30182E','#0A1723'],aurora:['#202955','#362444','#10372D']};
export function StagePlayer({services,track,lyricTrack,font,controls,onMore,onStyle}:{services:Services;track:Track;lyricTrack:Track;font?:string;controls:ReactNode;onMore:()=>void;onStyle:()=>void}){
  const prefs=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const [choosing,setChoosing]=useState(false),[error,setError]=useState('');
  const {width,height,fontScale}=useWindowDimensions(),largeText=fontScale>1.4;
  const save=(patch:{stageStyle?:StageStyle;stageBackdrop?:boolean})=>{void services.preferences.update(patch).then(()=>setError('')).catch(()=>setError('舞台设置未保存，原设置保留'));};
  const backdrop=prefs.stageBackdrop&&prefs.stageStyle!=='classic';
  return <View testID="stage-player" style={{flex:1,minHeight:0}}>
    {/* IMG_4872 has no title row; keep the track name in the AX tree for skin parity. */}
    <Text accessibilityLabel={track.title} style={{position:'absolute',top:0,left:0,width:1,height:1,fontSize:1,color:'transparent'}}>{track.title}</Text>
    {backdrop&&<LinearGradient testID="stage-backdrop" pointerEvents="none" colors={backgrounds[prefs.stageStyle]} style={StyleSheet.absoluteFill}/>}
    <Pressable accessibilityRole="button" accessibilityLabel="更多播放控制" onPress={onMore} style={{position:'absolute',top:0,right:0,width:44,height:44,zIndex:3,alignItems:'center',justifyContent:'center'}}><Ionicons name="ellipsis-horizontal" size={22} color="rgba(255,255,255,0.72)"/></Pressable>
    <View testID="stage-lyric-viewport" collapsable={false} style={{flex:1,minHeight:0,overflow:'hidden'}}>
      <Lyrics services={services} track={lyricTrack} font={font} presentation="stage" chrome={!choosing}/>
      {choosing&&<Pressable accessibilityRole="button" accessibilityLabel="收起舞台样式" onPress={()=>setChoosing(false)} style={{position:'absolute',right:0,bottom:0,width:44,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="close" size={20} color="rgba(255,255,255,0.72)"/></Pressable>}
    </View>
    <View style={{flexShrink:0,gap:2,paddingBottom:10}}>
      {choosing?<View testID="stage-style-panel" style={{gap:4}}>
        {/* IMG_4872: intrinsic pill chips sit in one row directly above the dynamic-background switch. */}
        <View style={{flexDirection:'row',flexWrap:largeText?'wrap':'nowrap',gap:8,overflow:largeText?'visible':'hidden'}}>{stageStyles.map(([id,title])=>{
          const selected=prefs.stageStyle===id;
          return <Pressable key={id} testID={`stage-style-${id}`} accessibilityRole="radio" accessibilityState={{selected}} onPress={()=>save({stageStyle:id})} style={{paddingHorizontal:largeText?12:16,minWidth:largeText?0:undefined,minHeight:largeText?48:36,borderRadius:largeText?24:18,alignItems:'center',justifyContent:'center',backgroundColor:selected?'#FFFFFF':'rgba(255,255,255,0.04)',borderWidth:1,borderColor:selected?'#FFFFFF':'rgba(255,255,255,0.22)'}}><Text numberOfLines={1} style={{color:selected?'#111111':'#FFFFFF',fontSize:largeText?15:14,fontWeight:selected?'600':'400'}}>{title}</Text></Pressable>;
        })}</View>
        <View style={{flexDirection:'row',gap:12,alignItems:'center',minHeight:largeText?44:32}}><Text style={{color:'#FFFFFF',flex:1,fontSize:14}}>动态背景</Text><Switch accessibilityLabel="舞台背景" value={prefs.stageBackdrop} onValueChange={value=>save({stageBackdrop:value})} trackColor={{true:'#B9B9BD',false:'rgba(255,255,255,0.22)'}}/></View>
        {!!error&&<Text accessibilityRole="alert" style={{color:'#FFD7BA'}}>{error}</Text>}
      </View>:<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:44}}><Pressable testID="stage-style-selector" accessibilityRole="button" accessibilityLabel="舞台样式" accessibilityValue={{text:stageStyles.find(([id])=>id===prefs.stageStyle)![1]}} onPress={()=>setChoosing(true)} style={{minHeight:44,justifyContent:'center',flex:1}}><Text style={{color:'rgba(255,255,255,0.72)',fontSize:14}}>舞台样式 · {stageStyles.find(([id])=>id===prefs.stageStyle)![1]}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="调整播放界面" onPress={onStyle} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="options-outline" size={20} color="rgba(255,255,255,0.72)"/></Pressable></View>}
      {controls}
    </View>
  </View>;
}
