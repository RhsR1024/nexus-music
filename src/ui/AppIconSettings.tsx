import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Image,Pressable,View,type ImageSourcePropType} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {requireNativeModule} from 'expo';
import {
  appIconIDForNativeName,
  isAllowedNativeAppIconName,
  nativeNameForAppIcon,
  nexusAppIcons,
  type NexusAppIconID,
} from '../domain/appIcons.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {radius,sollinTokens,space} from './tokens.ts';

interface AppIconSnapshot {
  supported:boolean;
  current?:string|null;
  liveContainer?:boolean;
}

interface AppIconNative {
  snapshot():Promise<AppIconSnapshot>;
  setIcon(name:string|null):Promise<string|null>;
}

const previews:Record<NexusAppIconID,ImageSourcePropType>={
  primary:require('../../assets/app-icons/nexus-primary.png'),
  orange:require('../../assets/app-icons/nexus-orange.png'),
  green:require('../../assets/app-icons/nexus-green.png'),
  blue:require('../../assets/app-icons/nexus-blue.png'),
  purple:require('../../assets/app-icons/nexus-purple.png'),
  graphite:require('../../assets/app-icons/nexus-graphite.png'),
};

function nativeModule(){
  try{return requireNativeModule<AppIconNative>('NexusAppIcon');}
  catch{return undefined;}
}

export function AppIconSettings(){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),native=useRef(nativeModule()).current,mounted=useRef(true);
  const [snapshot,setSnapshot]=useState<AppIconSnapshot|undefined>(),[busy,setBusy]=useState<NexusAppIconID|null>(null),[error,setError]=useState(''),[gridWidth,setGridWidth]=useState(0);
  const itemWidth=gridWidth>0?Math.floor((gridWidth-24)/3):88;

  useEffect(()=>{
    mounted.current=true;
    if(!native){setError('此平台安装暂不支持更换应用图标。');return()=>{mounted.current=false;};}
    void native.snapshot().then(value=>{
      if(mounted.current)setSnapshot(value);
    }).catch(()=>{
      if(mounted.current)setError('无法读取当前应用图标，请重新打开此页。');
    });
    return()=>{mounted.current=false;};
  },[native]);

  const currentID=appIconIDForNativeName(snapshot?.current);
  const inLiveContainer=Boolean(snapshot?.liveContainer);
  const unavailable=!snapshot||!snapshot.supported||!!busy;
  const apply=async(id:NexusAppIconID)=>{
    if(!native||!snapshot?.supported||busy||id===currentID)return;
    const requested=nativeNameForAppIcon(id);
    if(!isAllowedNativeAppIconName(requested)){setError('切换图标失败：图标名称无效。');return;}
    setBusy(id);setError('');
    try{
      const current=await native.setIcon(requested);
      if(!mounted.current)return;
      setSnapshot(prev=>({supported:true,liveContainer:prev?.liveContainer,current}));
      if(appIconIDForNativeName(current)!==id)setError('切换图标失败：系统没有应用所选图标。');
    }catch(reason){
      if(!mounted.current)return;
      const msg=reason instanceof Error?reason.message:'请稍后重试。';
      setError(msg.includes('LiveContainer')?msg:`切换图标失败：${msg}`);
    }finally{
      if(mounted.current)setBusy(null);
    }
  };

  return <View style={{gap:space.lg,paddingTop:space.lg}}>
    <Text style={{color:s.muted,fontSize:13.5,lineHeight:20}}>选择喜欢的颜色，原生独立安装下桌面图标会立即更新。图标由系统保存，不会影响播放、队列或外观偏好。</Text>
    <View testID="app-icon-current" accessible accessibilityRole="text" accessibilityLabel={currentID?`当前应用图标：${nexusAppIcons.find(item=>item.id===currentID)?.label}`:'当前应用图标未知'} style={[{minHeight:52,paddingHorizontal:space.lg,paddingVertical:space.md,borderRadius:radius.lg,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,flexDirection:'row',alignItems:'center',gap:space.sm},s.cardShadow]}>
      {snapshot?<Ionicons name={inLiveContainer?'layers-outline':snapshot.supported?'checkmark-circle':'information-circle-outline'} size={22} color={s.accent}/>:<ActivityIndicator color={s.accent}/>}
      <Text style={{flex:1,color:s.ink,fontSize:14.5,fontWeight:'600'}}>{snapshot?(inLiveContainer?'当前运行于 LiveContainer 容器（桌面图标由宿主管理）':snapshot.supported?`当前：${currentID?nexusAppIcons.find(item=>item.id===currentID)?.label:'未识别的系统图标'}`:'此系统版本不支持更换应用图标'):'正在读取系统图标状态…'}</Text>
    </View>
    {inLiveContainer&&<View testID="app-icon-livecontainer-notice" style={{padding:14,borderRadius:16,backgroundColor:s.accentSoft,borderWidth:1,borderColor:s.accent+'33',flexDirection:'row',alignItems:'flex-start',gap:10}}>
      <Ionicons name="information-circle-outline" size={19} color={s.accent} style={{marginTop:1}}/>
      <View style={{flex:1,gap:4}}>
        <Text style={{color:s.ink,fontSize:13.5,fontWeight:'700'}}>LiveContainer 容器限制说明</Text>
        <Text style={{color:s.muted,fontSize:12.5,lineHeight:18.5}}>iOS 系统仅允许直接安装在桌面的独立应用切换备选图标；LiveContainer 运行时桌面图标归宿主容器管辖。如需更换图标，请在 LiveContainer 应用列表长按「音枢」→「设置」中自定义图标，或通过独立侧载安装即可直接在此切换。</Text>
      </View>
    </View>}
    <View testID="app-icon-grid" accessibilityRole="radiogroup" onLayout={event=>setGridWidth(event.nativeEvent.layout.width)} style={{flexDirection:'row',flexWrap:'wrap',columnGap:12,rowGap:14}}>
      {nexusAppIcons.map(item=>{
        const selected=currentID===item.id,working=busy===item.id,disabled=unavailable;
        return <Pressable key={item.id} testID={`app-icon-${item.id}`} accessibilityRole="radio" accessibilityLabel={`应用图标：${item.label}`} accessibilityHint={selected?'当前已使用':'切换系统桌面图标'} accessibilityState={{selected,disabled,busy:working}} onPress={()=>void apply(item.id)} disabled={disabled} style={{width:itemWidth,opacity:disabled&&!working?.52:1}}>
          <Image source={previews[item.id]} resizeMode="cover" accessible={false} style={{width:itemWidth,height:itemWidth,borderRadius:21,backgroundColor:s.card}}/>
          <View pointerEvents="none" style={{position:'absolute',top:0,width:itemWidth,height:itemWidth,borderRadius:21,borderWidth:2,borderColor:selected?s.accent:'transparent'}}/>
          {selected&&<View pointerEvents="none" style={{position:'absolute',top:9,right:9,width:26,height:26,borderRadius:13,backgroundColor:s.accent,borderWidth:2,borderColor:'#FFFFFF',alignItems:'center',justifyContent:'center'}}><Ionicons name="checkmark" size={17} color="#FFFFFF"/></View>}
          {working&&<View pointerEvents="none" style={{position:'absolute',top:0,width:itemWidth,height:itemWidth,borderRadius:21,backgroundColor:'rgba(0,0,0,0.30)',alignItems:'center',justifyContent:'center'}}><ActivityIndicator color="#FFFFFF"/></View>}
          <Text numberOfLines={1} style={{color:selected?s.accent:s.ink,fontSize:14,lineHeight:18,fontWeight:selected?'600':'500',textAlign:'center',marginTop:5}}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
    {!!error&&<View style={{paddingHorizontal:13,paddingVertical:10,borderRadius:14,backgroundColor:s.dark?'rgba(255,107,129,0.13)':'rgba(217,67,85,0.09)',borderWidth:1,borderColor:s.accent+'33'}}>
      <Text testID="app-icon-error" accessibilityRole="alert" accessibilityLiveRegion="polite" style={{color:s.accent,fontSize:13,lineHeight:19}}>{error}</Text>
    </View>}
  </View>;
}
