import {MiniPlayerSettings} from './MiniPlayerSettings.tsx';
import {VisualSettings} from './VisualSettings.tsx';
import {Text} from './Typography.tsx';
import {useRef,useState,useSyncExternalStore} from 'react';
import {Pressable, StyleSheet, Switch, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {accentColors,appearanceDefaults,appearancePalette,visualThemeLabels as themeLabels,visualThemes,type Accent,type VisualTheme} from '../domain/appearance.ts';
import {useTheme} from './theme.tsx';
import {useVisualAssets} from './VisualBackground.tsx';
const styleLabels:Record<'gradient'|'solid'|'image',string>={gradient:'渐变',solid:'纯色',image:'图片'};
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
  // IMG_4855 keeps the sections on the sheet's own tinted surface; only the
  // summary card and control rows carry a fill.
  const flat=page==='background';
  return <View style={{gap:8,marginVertical:flat?12:24,padding:flat?0:8,borderRadius:flat?0:22,backgroundColor:flat?'transparent':theme.palette.surface}}>
    {page==='theme'&&<View style={{gap:12}}><View>{(['system','light','dark']as const).map((mode,index)=>choice(`theme-${mode}`,['跟随系统','浅色','深色'][index]!,value.theme===mode,()=>update({theme:mode})))}</View><Text style={{color:theme.palette.secondary,fontSize:13,lineHeight:20,padding:14}}>选择后立即保存。</Text></View>}
    {page==='background'&&<View style={{gap:16,paddingVertical:16}}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:12}}>
        <Pressable testID="appearance-reset" accessibilityRole="button" accessibilityLabel="恢复默认外观" onPress={()=>update({...appearanceDefaults})} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="refresh" size={22} color={theme.palette.secondary}/></Pressable>
      </View>
      {/* IMG_4855: a tinted summary card, chips, a segmented type control and the colour rows. */}
      {/* IMG_4855 card: 114pt tall, text pinned to the lower-left. */}
      <View testID="theme-preview-card" style={{borderRadius:14,backgroundColor:theme.mode==='dark'?theme.palette.surface:'#FFFFFF',paddingHorizontal:20,paddingBottom:16,height:114,justifyContent:'flex-end'}}>
        <Text numberOfLines={1} style={{color:theme.palette.text,fontSize:15,lineHeight:22}}>♪ 音枢 · {themeLabels[value.visualTheme]} · {styleLabels[value.backgroundStyle]}</Text>
      </View>
      <Text style={{color:theme.palette.secondary,fontSize:13}}>一键主题</Text>
      <View style={{borderRadius:16,backgroundColor:'rgba(255,255,255,0.55)',padding:10}}><View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{visualThemes.map(id=><Pressable key={id} testID={`visual-${id}`} accessibilityRole="radio" accessibilityState={{selected:value.visualTheme===id}} onPress={()=>update({visualTheme:id})} style={{flexGrow:0,flexBasis:'31%',minWidth:96,minHeight:46,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:9,borderRadius:12,borderWidth:1,borderColor:value.visualTheme===id?theme.palette.text:theme.palette.border,backgroundColor:value.visualTheme===id?theme.palette.text:theme.palette.surface}}><View style={{width:18,height:18,borderRadius:6,backgroundColor:appearancePalette(theme.mode,{...value,visualTheme:id}).background[0],borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(0,0,0,0.12)'}}/><Text numberOfLines={1} style={{flex:1,color:value.visualTheme===id?theme.palette.surface:theme.palette.text,fontSize:14,fontWeight:value.visualTheme===id?'700':'500'}}>{themeLabels[id]}</Text></Pressable>)}</View></View>
      <Text style={{color:theme.palette.secondary,fontSize:13}}>背景类型</Text>
      <View style={{flexDirection:'row',borderRadius:12,borderWidth:1,borderColor:theme.palette.border,overflow:'hidden',backgroundColor:theme.palette.surface}}>
        {([['solid','纯色','ellipse'],['gradient','渐变','reorder-three-outline'],['image','图片','image-outline']] as const).map(([id,label,icon])=>{
          const selected=value.backgroundStyle===id,disabled=id==='image'&&!assets.background;
          return <Pressable key={id} testID={`background-${id}`} accessibilityRole="radio" accessibilityState={{selected,disabled}} disabled={disabled} onPress={()=>update({backgroundStyle:id})} style={{flex:1,minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,backgroundColor:selected?theme.palette.selected:'transparent',borderRightWidth:id==='image'?0:1,borderRightColor:theme.palette.border,opacity:disabled?.45:1}}><Ionicons name={icon} size={16} color={selected?theme.palette.accent:theme.palette.secondary}/><Text style={{color:selected?theme.palette.accent:theme.palette.text,fontSize:14,fontWeight:selected?'600':'400'}}>{label}</Text></Pressable>;
        })}
      </View>
      {!assets.background&&<Text style={{color:theme.palette.secondary,fontSize:12}}>导入主题背景图片后可选择图片背景。</Text>}
      <Text style={{color:theme.palette.secondary,fontSize:13}}>颜色</Text>
      {/* IMG_4855 keeps 强调色 and 背景颜色 as two separate cards. */}
      <View style={{borderRadius:14,backgroundColor:theme.palette.surface,paddingHorizontal:16,minHeight:56,flexDirection:'row',alignItems:'center',gap:12}}>
        <View style={{width:24,height:24,borderRadius:12,backgroundColor:theme.palette.accent}}/>
        <Text style={{color:theme.palette.text,fontSize:15,flex:1}}>强调色</Text>
        <Text testID="accent-hex" style={{color:theme.palette.secondary,fontSize:14,fontVariant:['tabular-nums']}}>{theme.palette.accent.toUpperCase()}</Text>
      </View>
      <View style={{borderRadius:14,backgroundColor:theme.palette.surface,paddingHorizontal:16,minHeight:56,flexDirection:'row',alignItems:'center',gap:12}}>
        <View style={{width:24,height:24,borderRadius:12,backgroundColor:theme.palette.background[0],borderWidth:1,borderColor:theme.palette.border}}/>
        <Text style={{color:theme.palette.text,fontSize:15,flex:1}}>背景颜色</Text>
        <Text testID="background-hex" style={{color:theme.palette.secondary,fontSize:14,fontVariant:['tabular-nums']}}>{theme.palette.background[0].toUpperCase()}</Text>
      </View>
      <View style={{flexDirection:'row',gap:12}}>{(Object.keys(accentColors) as Accent[]).map((id,index)=><Pressable key={id} testID={`accent-${id}`} accessibilityLabel={['玫瑰','珊瑚','紫色','蓝色','橙色'][index]} accessibilityRole="radio" accessibilityState={{selected:value.accent===id}} onPress={()=>update({accent:id})} style={{minWidth:44,minHeight:44,borderRadius:22,backgroundColor:accentColors[id][theme.mode==='dark'?1:0],alignItems:'center',justifyContent:'center',borderWidth:value.accent===id?3:0,borderColor:theme.palette.text}}><Text style={{color:'#FFFFFF',fontSize:18}}>{value.accent===id?'✓':''}</Text></Pressable>)}</View>
    </View>}
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
