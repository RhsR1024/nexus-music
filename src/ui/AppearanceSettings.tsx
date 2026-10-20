import {MiniPlayerSettings} from './MiniPlayerSettings.tsx';
import {VisualSettings} from './VisualSettings.tsx';
import {Text} from './Typography.tsx';
import {useRef,useState,useSyncExternalStore} from 'react';
import {Alert, Pressable, Share, StyleSheet, Switch, View} from 'react-native';
import {File, Paths} from 'expo-file-system';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {accentColors,appearanceDefaults,themeBackground,visualThemeLabels as themeLabels,visualThemes,type Accent,type VisualTheme} from '../domain/appearance.ts';
import {useTheme} from './theme.tsx';
import {useVisualAssets} from './VisualBackground.tsx';
const styleLabels:Record<'gradient'|'solid'|'image',string>={gradient:'渐变',solid:'纯色',image:'图片'};
export type AppearanceSection='theme'|'background'|'skins'|'accent'|'navigation'|'mini';
export function BackgroundThemeActions({services}:{services:Services}){
  const value=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),theme=useTheme();
  const shuffleTheme=()=>{const next=visualThemes[(visualThemes.indexOf(value.visualTheme)+1)%visualThemes.length];if(next)void services.preferences.update({visualTheme:next}).catch(()=>Alert.alert('主题未保存','原主题保留，请重试。'));};
  const shareTheme=()=>{void Share.share({message:`音枢主题 · ${themeLabels[value.visualTheme]} · ${styleLabels[value.backgroundStyle]}`}).catch(()=>{});};
  const exportTheme=async()=>{const file=new File(Paths.cache,`nexus-theme-${Date.now()}.json`);try{file.write(JSON.stringify({visualTheme:value.visualTheme,accent:value.accent,backgroundStyle:value.backgroundStyle,cardOpacity:value.cardOpacity},null,2));await Share.share({url:file.uri,title:'音枢主题配置'});}catch{Alert.alert('主题配置导出失败','请重试。');}finally{if(file.exists)file.delete();}};
  const icon=(name:React.ComponentProps<typeof Ionicons>['name'],label:string,action:()=>void,id?:string)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} onPress={action} style={{width:36,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name={name} size={22} color={theme.palette.text}/></Pressable>;
  return <View accessibilityLabel="主题操作" style={{flexDirection:'row',alignItems:'center'}}>
    {icon('shuffle','随机切换主题',shuffleTheme)}
    {icon('download-outline','导出主题配置',()=>{void exportTheme();})}
    {icon('share-outline','分享当前主题',shareTheme)}
    {icon('refresh','恢复默认外观',()=>{void services.preferences.update({...appearanceDefaults}).catch(()=>Alert.alert('外观未保存','之前的设置已保留，请重试。'));},'appearance-reset')}
  </View>;
}
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
  // Follow 卡片透明度 for the glass fills; IMG_4856 at 30% shows the sheet
  // gradient through the theme grid and type capsule rather than white panels.
  const darkMode=theme.mode==='dark',outline=darkMode?'rgba(255,255,255,0.35)':'rgba(60,60,67,0.62)',glassAlpha=darkMode?0.07:Math.max(0.08,Math.min(0.45,value.cardOpacity*0.45)),glass=`rgba(255,255,255,${glassAlpha})`;
  // The reference order (Sollin, 脸红佳人, Pearl … 黄赤藕荷) first, then the two
  // themes original to 音枢. 3 columns × 5 rows is the user-confirmed layout
  // for 13 chips, so the lower page keeps its measured alignment.
  const themeChips:readonly VisualTheme[]=['blush','blushpink','pearl','mint','sunset','azure','marigold','violet','khaki','plumtea','lotus','soft','classic'];
  const outlined=(key:'accent'|'background',label:string,color:string,hex:string,action:()=>void)=><View key={key} style={{height:56,borderWidth:1,borderColor:outline,borderRadius:14,backgroundColor:glass,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:12}}>
    <View style={{position:'absolute',top:-8,left:12,paddingHorizontal:6,backgroundColor:theme.palette.background[1]}}><Text style={{color:theme.palette.secondary,fontSize:13}}>{label}</Text></View>
    {/* IMG_4856 samples the accent swatch at 20pt (x 46.0-65.7pt, y 234.0-253.7pt); 26pt read as a filled disc rather than a colour chip. */}
    <View style={{width:20,height:20,borderRadius:10,backgroundColor:color,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(0,0,0,0.12)'}}/>
    <Text testID={`${key}-hex`} style={{flex:1,color:theme.palette.text,fontSize:17,fontVariant:['tabular-nums']}}>{hex.toUpperCase()}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={key==='accent'?'选择强调色':'背景颜色说明'} onPress={action} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="color-filter-outline" size={22} color={theme.palette.secondary}/></Pressable>
  </View>;
  return <View style={{gap:8,marginVertical:flat?34:24,padding:flat?0:8,borderRadius:flat?0:22,backgroundColor:flat?'transparent':theme.palette.surface}}>
    {page==='theme'&&<View style={{gap:12}}><View>{(['system','light','dark']as const).map((mode,index)=>choice(`theme-${mode}`,['跟随系统','浅色','深色'][index]!,value.theme===mode,()=>update({theme:mode})))}</View><Text style={{color:theme.palette.secondary,fontSize:13,lineHeight:20,padding:14}}>选择后立即保存。</Text></View>}
    {page==='background'&&<View style={{gap:0,paddingBottom:16}}>
      {/* IMG_4855 card: 114pt tall, a shadowed summary pill pinned to the lower-left. */}
      <View testID="theme-preview-card" style={{borderRadius:16,backgroundColor:darkMode?theme.palette.surface:'#FFFFFF',paddingHorizontal:20,paddingBottom:16,minHeight:120,justifyContent:'flex-end'}}>
        <View style={{alignSelf:'flex-start',maxWidth:'100%',minHeight:40,paddingHorizontal:14,flexDirection:'row',alignItems:'center',gap:9,borderRadius:12,backgroundColor:darkMode?theme.palette.selected:'#FFFFFF',shadowColor:'#000000',shadowOpacity:.09,shadowRadius:10,shadowOffset:{width:0,height:3},elevation:2}}>
          <Text style={{color:theme.palette.accent,fontSize:19}}>♪</Text>
          <Text numberOfLines={1} style={{color:theme.palette.text,fontSize:17,fontWeight:'600'}}>音枢 · {themeLabels[value.visualTheme]} · {styleLabels[value.backgroundStyle]} · 卡片 {Math.round(value.cardOpacity*100)}%</Text>
        </View>
      </View>
      {/* IMG_4855 label ink is ~11pt tall (13pt type), not 16pt. The extra bottom
          margin absorbs the smaller line box so the cards below stay anchored. */}
      <Text style={{color:theme.palette.secondary,fontSize:13,marginTop:20.6,marginBottom:14}}>一键主题</Text>
      <View style={{borderRadius:18,backgroundColor:glass,padding:8,paddingBottom:9}}><View style={{flexDirection:'row',flexWrap:'wrap',gap:9.5}}>{themeChips.map(id=><Pressable key={id} testID={`visual-${id}`} accessibilityRole="radio" accessibilityState={{selected:value.visualTheme===id}} onPress={()=>update({visualTheme:id})} style={{width:'31.4%',flexDirection:'row',alignItems:'center',gap:6,minHeight:28,paddingHorizontal:8,paddingVertical:3,borderRadius:10,backgroundColor:value.visualTheme===id?'#151515':darkMode?'rgba(255,255,255,0.10)':'rgba(255,255,255,0.72)'}}>
        {value.visualTheme===id?<View style={{width:16,height:16,borderRadius:5,backgroundColor:'#FFFFFF'}}/>:<LinearGradient colors={[themeBackground(id,theme.mode)[0],themeBackground(id,theme.mode)[1],themeBackground(id,theme.mode)[2]]} start={{x:0,y:0}} end={{x:1,y:1}} style={{width:16,height:16,borderRadius:5,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(0,0,0,0.10)'}}/>}
        <Text numberOfLines={1} style={{color:value.visualTheme===id?'#FFFFFF':theme.palette.text,fontSize:16,fontWeight:'600'}}>{themeLabels[id]}</Text>
      </Pressable>)}</View></View>
      <Text style={{color:theme.palette.secondary,fontSize:13,marginTop:18.9,marginBottom:19.7}}>背景类型</Text>
      <View style={{padding:8,borderRadius:20,backgroundColor:glass}}>
        <View style={{flexDirection:'row',height:40,borderRadius:20,borderWidth:1,borderColor:outline,overflow:'hidden'}}>
          {([['solid','纯色','ellipse'],['gradient','渐变','layers-outline'],['image','图片','image-outline']] as const).map(([id,label,glyph],index)=>{
            const selected=value.backgroundStyle===id,disabled=id==='image'&&!assets.background;
            return <Pressable key={id} testID={`background-${id}`} accessibilityRole="radio" accessibilityState={{selected,disabled}} disabled={disabled} onPress={()=>update({backgroundStyle:id})} style={{flex:1,minHeight:40,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,backgroundColor:selected?`${theme.palette.accent}2E`:'transparent',borderLeftWidth:index?1:0,borderLeftColor:outline,opacity:disabled?.4:1}}><Ionicons name={glyph} size={17} color={selected?theme.palette.text:theme.palette.secondary}/><Text style={{color:selected?theme.palette.text:theme.palette.secondary,fontSize:16,fontWeight:selected?'600':'400'}}>{label}</Text></Pressable>;
          })}
        </View>
      </View>
      <Text style={{color:theme.palette.secondary,fontSize:13,marginTop:33.8,marginBottom:20.8}}>颜色</Text>
      {/* IMG_4856 puts both outlined fields 32pt from the screen edge (16pt inside
          the sheet gutter) while the section label stays on the gutter. Its first
          border sits at 216.0pt; the 3pt offset below lands the same edge. */}
      <View style={{marginHorizontal:16,marginTop:3}}>
        {outlined('accent','强调色',theme.palette.accent,theme.palette.accent,()=>Alert.alert('强调色','选择主题强调色。',[...(Object.keys(accentColors) as Accent[]).map((id,index)=>({text:['玫瑰','珊瑚','紫色','蓝色','橙色'][index]!,onPress:()=>update({accent:id})})),{text:'取消',style:'cancel' as const}]))}
        <View style={{height:28}}/>
        {outlined('background','背景颜色',theme.palette.background[0],theme.palette.background[0],()=>Alert.alert('背景颜色','背景颜色随当前主题渐变生成，可在一键主题中切换。'))}
      </View>
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
