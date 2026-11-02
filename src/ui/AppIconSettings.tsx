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
import {radius,space} from './tokens.ts';

interface AppIconSnapshot {
  supported:boolean;
  current?:string|null;
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
  const theme=useTheme(),native=useRef(nativeModule()).current,mounted=useRef(true);
  const [snapshot,setSnapshot]=useState<AppIconSnapshot|undefined>(),[busy,setBusy]=useState<NexusAppIconID|null>(null),[error,setError]=useState(''),[gridWidth,setGridWidth]=useState(0);
  const itemWidth=gridWidth>0?Math.floor((gridWidth-24)/3):88;

  useEffect(()=>{
    mounted.current=true;
    if(!native){setError('此安装不支持更换应用图标。');return()=>{mounted.current=false;};}
    void native.snapshot().then(value=>{
      if(mounted.current)setSnapshot(value);
    }).catch(()=>{
      if(mounted.current)setError('无法读取当前应用图标，请重新打开此页。');
    });
    return()=>{mounted.current=false;};
  },[native]);

  const currentID=appIconIDForNativeName(snapshot?.current);
  const unavailable=!snapshot||!snapshot.supported||!!busy;
  const apply=async(id:NexusAppIconID)=>{
    if(!native||!snapshot?.supported||busy||id===currentID)return;
    const requested=nativeNameForAppIcon(id);
    if(!isAllowedNativeAppIconName(requested)){setError('切换图标失败：图标名称无效。');return;}
    setBusy(id);setError('');
    try{
      const current=await native.setIcon(requested);
      if(!mounted.current)return;
      setSnapshot({supported:true,current});
      if(appIconIDForNativeName(current)!==id)setError('切换图标失败：系统没有应用所选图标。');
    }catch(reason){
      if(mounted.current)setError(`切换图标失败：${reason instanceof Error?reason.message:'请稍后重试。'}`);
    }finally{
      if(mounted.current)setBusy(null);
    }
  };

  return <View style={{gap:space.lg,paddingTop:space.lg}}>
    <Text style={{color:theme.palette.secondary,fontSize:14,lineHeight:21}}>选择喜欢的颜色，桌面图标会立即更新。图标由系统保存，不会影响播放、队列或外观偏好。</Text>
    <View testID="app-icon-current" accessible accessibilityRole="text" accessibilityLabel={currentID?`当前应用图标：${nexusAppIcons.find(item=>item.id===currentID)?.label}`:'当前应用图标未知'} style={{minHeight:52,paddingHorizontal:space.lg,paddingVertical:space.md,borderRadius:radius.lg,backgroundColor:theme.palette.surface,flexDirection:'row',alignItems:'center',gap:space.sm}}>
      {snapshot?<Ionicons name={snapshot.supported?'checkmark-circle':'information-circle-outline'} size={22} color={theme.palette.accent}/>:<ActivityIndicator color={theme.palette.accent}/>}
      <Text style={{flex:1,color:theme.palette.text,fontSize:15}}>{snapshot?(snapshot.supported?`当前：${currentID?nexusAppIcons.find(item=>item.id===currentID)?.label:'未识别的系统图标'}`:'此系统版本不支持更换应用图标'):'正在读取系统图标状态…'}</Text>
    </View>
    <View testID="app-icon-grid" accessibilityRole="radiogroup" onLayout={event=>setGridWidth(event.nativeEvent.layout.width)} style={{flexDirection:'row',flexWrap:'wrap',columnGap:12,rowGap:14}}>
      {nexusAppIcons.map(item=>{
        const selected=currentID===item.id,working=busy===item.id,disabled=unavailable;
        return <Pressable key={item.id} testID={`app-icon-${item.id}`} accessibilityRole="radio" accessibilityLabel={`应用图标：${item.label}`} accessibilityHint={selected?'当前已使用':'切换系统桌面图标'} accessibilityState={{selected,disabled,busy:working}} onPress={()=>void apply(item.id)} disabled={disabled} style={{width:itemWidth,opacity:disabled&&!working?.52:1}}>
          <Image source={previews[item.id]} resizeMode="cover" accessible={false} style={{width:itemWidth,height:itemWidth,borderRadius:21,backgroundColor:theme.palette.surface}}/>
          <View pointerEvents="none" style={{position:'absolute',top:0,width:itemWidth,height:itemWidth,borderRadius:24,borderWidth:2,borderColor:selected?theme.palette.accent:'transparent'}}/>
          {selected&&<View pointerEvents="none" style={{position:'absolute',top:9,right:9,width:26,height:26,borderRadius:13,backgroundColor:theme.palette.accent,borderWidth:2,borderColor:'#FFFFFF',alignItems:'center',justifyContent:'center'}}><Ionicons name="checkmark" size={17} color="#FFFFFF"/></View>}
          {working&&<View pointerEvents="none" style={{position:'absolute',top:0,width:itemWidth,height:itemWidth,borderRadius:24,backgroundColor:'rgba(0,0,0,0.30)',alignItems:'center',justifyContent:'center'}}><ActivityIndicator color="#FFFFFF"/></View>}
          <Text numberOfLines={1} style={{color:selected?theme.palette.accent:theme.palette.text,fontSize:14,lineHeight:18,fontWeight:selected?'600':'500',textAlign:'center',marginTop:5}}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
    {!!error&&<Text testID="app-icon-error" accessibilityRole="alert" accessibilityLiveRegion="polite" style={{color:theme.palette.accent,fontSize:14,lineHeight:21}}>{error}</Text>}
  </View>;
}
