import {MiniPlayerSettings} from './MiniPlayerSettings.tsx';
import {VisualSettings} from './VisualSettings.tsx';
import {Text} from './Typography.tsx';
import {useRef,useState,useSyncExternalStore} from 'react';
import {Pressable, Switch, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {accentColors,type Accent,type VisualTheme} from '../domain/appearance.ts';
import {useTheme} from './theme.tsx';
import {useVisualAssets} from './VisualBackground.tsx';
export type AppearanceSection='theme'|'background'|'skins'|'accent'|'navigation'|'mini';
export function AppearanceSettings({services,section:page,onStyleSaved}:{services:Services;section:AppearanceSection;onStyleSaved?:()=>void}){
  const theme=useTheme(),value=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),assets=useVisualAssets(services),[error,setError]=useState('');
  const update=(patch:Parameters<typeof services.preferences.update>[0])=>{setError('');void services.preferences.update(patch).catch(()=>setError('外观未保存，请重试；之前的设置已保留。'));};
  const savingStyle=useRef(false),[styleBusy,setStyleBusy]=useState(false);
  const selectStyle=async(playerLayout:typeof value.playerLayout)=>{
    if(savingStyle.current)return;
    savingStyle.current=true;setStyleBusy(true);setError('');
    try{await services.preferences.update({playerLayout});onStyleSaved?.();}
    catch{setError('播放界面未保存，请重试；之前的设置已保留。');}
    finally{savingStyle.current=false;setStyleBusy(false);}
  };
  const section=(title:string,children:React.ReactNode)=><View style={{gap:14,paddingVertical:18,borderBottomWidth:1,borderBottomColor:theme.palette.border}}><Text style={{fontSize:16,fontWeight:'600',color:theme.palette.text}}>{title}</Text>{children}</View>;
  const choice=(id:string,label:string,selected:boolean,onPress:()=>void,disabled=false)=><Pressable key={id} testID={id} accessibilityRole="radio" accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} style={{minHeight:56,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:theme.palette.border,opacity:disabled?.5:1}}><Text style={{color:selected?theme.palette.accent:theme.palette.text,fontWeight:selected?'600':'400',fontSize:15}}>{label}</Text>{selected&&<Ionicons name="checkmark-circle" size={21} color={theme.palette.accent}/>}</Pressable>;
  return <View style={{gap:8,marginVertical:24,padding:8,borderRadius:22,backgroundColor:theme.palette.surface}}>
    {page==='theme'&&<View style={{gap:12}}><View>{(['system','light','dark']as const).map((mode,index)=>choice(`theme-${mode}`,['跟随系统','浅色','深色'][index]!,value.theme===mode,()=>update({theme:mode})))}</View><Text style={{color:theme.palette.secondary,fontSize:13,lineHeight:20,padding:14}}>选择后立即保存。</Text></View>}
    {page==='background'&&section('主题与背景',<><View>{([['classic','经典'],['blush','粉雾'],['soft','柔和']]as const).map(([id,label])=>choice(`visual-${id}`,label,value.visualTheme===id,()=>update({visualTheme:id as VisualTheme})))}</View><View>{([['gradient','柔和渐变'],['solid','纯色']]as const).map(([id,label])=>choice(`background-${id}`,label,value.backgroundStyle===id,()=>update({backgroundStyle:id})))}{choice('background-image','图片',value.backgroundStyle==='image',()=>update({backgroundStyle:'image'}),!assets.background)}</View>{!assets.background&&<Text style={{color:theme.palette.secondary,fontSize:12,padding:14}}>导入主题背景图片后可选择图片背景。</Text>}</>)}
    {page==='skins'&&section('播放界面样式',<View accessibilityLabel="可选播放界面样式" style={{borderRadius:18,overflow:'hidden',borderWidth:1,borderColor:theme.palette.border}}>{([
      ['classic','经典','albums-outline','歌词、播放控制与队列'],
      ['am','AM 风格','musical-notes-outline','大幅歌词与紧凑歌曲信息'],
      ['immersive','封面沉浸','image-outline','封面背景与居中歌词'],
      ['photo','写真歌词','person-outline','自定义写真背景与歌词'],
      ['vinyl','黑胶唱机','disc-outline','唱盘视觉与播放控制'],
      ['wave','声波核','pulse-outline','实时音频频谱环'],
      ['stage','歌词舞台','text-outline','当前歌词分段与原生逐字绘制'],
      ['am2','AM2','reader-outline','封面、歌词与内容面板'],
    ] as const).map(([id,label,icon,detail],index)=>{
      const selected=value.playerLayout===id;
      return <Pressable key={id} testID={`player-layout-${id}`} accessibilityRole="radio" accessibilityLabel={label} accessibilityValue={{text:detail}} accessibilityState={{selected,disabled:styleBusy,busy:styleBusy}} disabled={styleBusy} onPress={()=>{void selectStyle(id);}} style={{minHeight:72,paddingHorizontal:14,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:13,borderBottomWidth:id==='am2'?0:1,borderBottomColor:theme.palette.border,backgroundColor:selected?theme.palette.selected:theme.palette.surface,opacity:styleBusy?.5:1}}>
        <View style={{width:40,height:40,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:selected?theme.palette.accent:theme.palette.selected}}><Ionicons name={icon} size={20} color={selected?theme.palette.surface:theme.palette.accent}/></View>
        <View style={{flex:1,gap:3}}><Text style={{color:selected?theme.palette.accent:theme.palette.text,fontSize:15,fontWeight:selected?'600':'500'}}>{label}</Text><Text style={{color:theme.palette.secondary,fontSize:12,lineHeight:17}}>{detail}</Text></View>
        <Ionicons name={selected?'checkmark-circle':'chevron-forward'} size={21} color={selected?theme.palette.accent:theme.palette.secondary}/>
      </Pressable>;
    })}<Text accessibilityLiveRegion="polite" style={{color:theme.palette.secondary,fontSize:12,lineHeight:18,padding:14}}>{styleBusy?'正在保存…':'选择后保存并应用；播放进度、队列和播放意图保持不变。'}</Text></View>)}
    {page==='accent'&&section('强调色',<View style={{flexDirection:'row',gap:14,flexWrap:'wrap'}}>{(Object.entries(accentColors) as [Accent,readonly[string,string]][]).map(([id,colors],index)=><Pressable key={id} testID={`accent-${id}`} accessibilityLabel={['玫瑰','珊瑚','紫色','蓝色','橙色'][index]} accessibilityRole="radio" accessibilityState={{selected:value.accent===id}} onPress={()=>update({accent:id})} style={{minWidth:44,minHeight:44,borderRadius:22,backgroundColor:colors[theme.mode==='dark'?1:0],alignItems:'center',justifyContent:'center',borderWidth:value.accent===id?3:0,borderColor:theme.palette.text}}><Text style={{color:'#FFFFFF',fontSize:20}}>{value.accent===id?'✓':''}</Text></Pressable>)}</View>)}
    {page==='navigation'&&<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:16,gap:12}}><View style={{flex:1}}><Text style={{fontSize:16,fontWeight:'600',color:theme.palette.text}}>玻璃底栏</Text><Text style={{color:theme.palette.secondary,lineHeight:20,marginTop:6}}>关闭或开启系统“降低透明度”时，使用实色表面。</Text></View><Switch accessibilityLabel="玻璃底栏" value={value.glassNavigation} onValueChange={glassNavigation=>update({glassNavigation})} trackColor={{true:theme.palette.accent}}/></View>}
    {page==='background'&&<VisualSettings services={services}/>} {page==='mini'&&<MiniPlayerSettings services={services}/>}
    {!!error&&<Text accessibilityLiveRegion="polite" style={{color:theme.palette.accent}}>{error}</Text>}
  </View>;
}
