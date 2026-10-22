import {MiniPlayerSettings} from './MiniPlayerSettings.tsx';
import {VisualSettings} from './VisualSettings.tsx';
import {Text} from './Typography.tsx';
import {useRef,useState,useSyncExternalStore} from 'react';
import {Alert, Pressable, Share, StyleSheet, Switch, Text as NativeText, View} from 'react-native';
import {File, Paths} from 'expo-file-system';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {accentColors,appearanceDefaults,themeBackground,themeSwatchBackground,visualThemeLabels as themeLabels,visualThemes,type Accent,type VisualTheme} from '../domain/appearance.ts';
import {useTheme} from './theme.tsx';
import {useVisualAssets} from './VisualBackground.tsx';
import {settingsInk,settingsLegend,settingsMuted,settingsSheet,themeChoiceLayout as chips} from './tokens.ts';
const styleLabels:Record<'gradient'|'solid'|'image',string>={gradient:'渐变',solid:'纯色',image:'图片'};
const segmentIconSize={solid:16.4,gradient:15.1,image:16.4} as const;
const segmentGlyph=(id:'gradient'|'solid'|'image',color:string)=>{const size=segmentIconSize[id];return <View style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}><NativeText allowFontScaling={false} style={{fontFamily:'CupertinoIcons',fontSize:size,color}}>{id==='solid'?'\u{f400}':id==='gradient'?'\u{f8e7}':'\u{f768}'}</NativeText></View>;};
export type AppearanceSection='theme'|'background'|'skins'|'accent'|'navigation'|'mini';
export function BackgroundThemeActions({services}:{services:Services}){
  const value=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),theme=useTheme();
  const shuffleTheme=()=>{const next=visualThemes[(visualThemes.indexOf(value.visualTheme)+1)%visualThemes.length];if(next)void services.preferences.update({visualTheme:next}).catch(()=>Alert.alert('主题未保存','原主题保留，请重试。'));};
  const favorite=value.favoriteVisualTheme===value.visualTheme;
  const toggleFavorite=()=>{void services.preferences.update({favoriteVisualTheme:favorite?null:value.visualTheme}).catch(()=>Alert.alert('主题收藏未保存','原收藏保留，请重试。'));};
  const shareTheme=()=>{void Share.share({message:`音枢主题 · ${themeLabels[value.visualTheme]} · ${styleLabels[value.backgroundStyle]}`}).catch(()=>{});};
  const exportTheme=async()=>{const file=new File(Paths.cache,`nexus-theme-${Date.now()}.json`);try{file.write(JSON.stringify({visualTheme:value.visualTheme,accent:value.accent,backgroundStyle:value.backgroundStyle,cardOpacity:value.cardOpacity},null,2));await Share.share({url:file.uri,title:'音枢主题配置'});}catch{Alert.alert('主题配置导出失败','请重试。');}finally{if(file.exists)file.delete();}};
  const icon=(name:React.ComponentProps<typeof Ionicons>['name'],label:string,action:()=>void,id?:string,accessibility?:{hint?:string;selected?:boolean},longPress?:()=>void,size=25,offsetY=0)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibility?.hint} accessibilityState={accessibility?.selected===undefined?undefined:{selected:accessibility.selected}} onPress={action} onLongPress={longPress} delayLongPress={500} style={{width:48,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name={name} size={size} color={theme.palette.text} style={offsetY?{transform:[{translateY:offsetY}]}:undefined}/></Pressable>;
  return <View accessibilityLabel="主题操作" style={{flexDirection:'row',alignItems:'center'}}>
    {icon(favorite?'bookmark':'bookmark-outline',favorite?'取消收藏当前主题':'收藏当前主题',toggleFavorite,'appearance-favorite-theme',{hint:'长按随机切换主题',selected:favorite},shuffleTheme,25,1)}
    {icon('download-outline','导出主题配置',()=>{void exportTheme();})}
    {icon('share-outline','分享当前主题',shareTheme)}
    {icon('refresh','恢复默认外观',()=>{void services.preferences.update({...appearanceDefaults}).catch(()=>Alert.alert('外观未保存','之前的设置已保留，请重试。'));},'appearance-reset')}
  </View>;
}
export function AppearanceSettings({services,section:page,onStyleSaved,accentFieldRef,onAccentFieldLayout}:{services:Services;section:AppearanceSection;onStyleSaved?:()=>void;accentFieldRef?:React.RefObject<View|null>;onAccentFieldLayout?:()=>void}){
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
  // IMG_4855 fields outline at #857373 over the sheet wash, warmer than the
  // neutral #7D7F87 the cool chrome first rendered.
  const darkMode=theme.mode==='dark',ink=settingsInk[theme.mode],muted=settingsMuted[theme.mode],legend=settingsLegend[theme.mode],outline=darkMode?'rgba(255,255,255,0.35)':'rgba(78,44,38,0.62)',glassAlpha=darkMode?0.07:Math.max(0.08,Math.min(0.45,value.cardOpacity*0.45)),glass=`rgba(255,255,255,${glassAlpha})`,themeGlassAlpha=darkMode?0.07:Math.max(0.08,Math.min(0.2,value.cardOpacity*0.47)),themeGlass=`rgba(204,254,254,${themeGlassAlpha})`;
  // The selected segment is a 20%-accent tint on white (#FEDADA for rose), not
  // the accent at 18% alpha, which reads lavender over the blue sheet wash.
  const accentRgb=parseInt(theme.palette.accent.slice(1),16),segmentTint=darkMode?`${theme.palette.accent}2E`:`rgb(${[accentRgb>>16,(accentRgb>>8)&255,accentRgb&255].map(channel=>Math.round(channel*0.2+204)).join(',')})`;
  // IMG_4855: the selected segment reads warm brown #5D3F40 (dot and label,
  // 900+ solid pixels), the unselected glyphs near-black #221919. A single
  // near-black ink for all three states was measured against the wrong state.
  const segmentInk=darkMode?'#E9E1E1':'#221919';
  const segmentInkSelected=darkMode?'#E9E1E1':'#5D3F40';
  const themeChips:readonly VisualTheme[]=['blush','blushpink','pearl','mint','sunset','azure','marigold','violet','khaki','plumtea','lotus'];
  const measuredThemeWidths:Partial<Record<VisualTheme,number>>={blush:85.3,blushpink:101.7,pearl:83.7,mint:76.7,sunset:94,azure:101,marigold:97.3,violet:102.7,khaki:102.3,plumtea:99.7,lotus:104.7};
  // Extra Nexus themes stay in a real, always reachable section below the
  // visual settings. The main group follows the reference's semantic order;
  // natural wrapping still accommodates smaller screens and larger type.
  const themeRows=(ids:readonly VisualTheme[])=>Array.from({length:Math.ceil(ids.length/3)},(_,row)=>ids.slice(row*3,row*3+3));
  const themeChoices=(ids:readonly VisualTheme[],style?:React.ComponentProps<typeof View>['style'])=><View style={[{borderRadius:chips.radius,backgroundColor:themeGlass,paddingHorizontal:chips.inset,paddingVertical:chips.verticalInset},style]}><View style={{gap:chips.rowGap}}>{themeRows(ids).map((row,rowIndex)=><View key={`theme-row-${rowIndex}`} style={{marginLeft:rowIndex>=2?2:undefined,flexDirection:'row',flexWrap:'wrap',columnGap:rowIndex===2?10:rowIndex===1?8.7:chips.columnGap,rowGap:chips.rowGap}}>{row.map(id=><Pressable key={id} testID={`visual-${id}`} accessibilityRole="radio" accessibilityState={{selected:value.visualTheme===id}} onPress={()=>update({visualTheme:id})} style={{width:measuredThemeWidths[id],flexDirection:'row',alignItems:'center',justifyContent:'center',gap:chips.columnGap,minWidth:id==='blush'?chips.primaryMinWidth:undefined,minHeight:chips.height,paddingHorizontal:chips.chipInset,borderRadius:chips.chipRadius,backgroundColor:value.visualTheme===id?'#221919':darkMode?'rgba(255,255,255,0.10)':settingsSheet.themeChip}}>
    {value.visualTheme===id?<View style={{width:chips.swatch,height:chips.swatch,borderRadius:5.5,backgroundColor:'#FFFFFF'}}/>:<LinearGradient colors={themeSwatchBackground(id)} start={{x:0,y:0}} end={{x:1,y:1}} style={{width:chips.swatch,height:chips.swatch,borderRadius:5.5,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(0,0,0,0.10)'}}/>}
    <Text style={{color:value.visualTheme===id?'#FFFFFF':'#221919',fontSize:14.7,fontWeight:'600'}}>{themeLabels[id]}</Text>
  </Pressable>)}</View>)}</View></View>;
  // IMG_4856 measures both outlined fields at a 32pt border, an 18pt swatch whose
  // visible fill spans x 47.0..64.7pt, the '#RRGGBB' ink starting at 84.3pt and
  // the colour-filter glyph at 365.0..382.7pt. Before this the swatch was 20pt,
  // the value ink sat at 79.3pt (5pt left) and the glyph at 351.3..370.3pt
  // (14pt left), which is why the colour-field grid cells scored lowest.
  const outlined=(key:'accent'|'background',label:string,color:string,hex:string,action:()=>void,backdrop:string)=><View key={key} ref={key==='accent'?accentFieldRef:undefined} onLayout={key==='accent'?onAccentFieldLayout:undefined} testID={`${key}-color-field`} style={{height:56,borderWidth:1,borderColor:outline,borderRadius:14,backgroundColor:glass,paddingLeft:14,paddingRight:0,flexDirection:'row',alignItems:'center',gap:17.3}}>
    <View style={{position:'absolute',top:-8,left:9.3,paddingHorizontal:6,backgroundColor:backdrop}}><Text style={{color:legend,fontSize:13}}>{label}</Text></View>
    {/* IMG_4856 measures the swatch outline at 20pt with an 18pt fill inside it. */}
    <View style={{width:20,height:20,borderRadius:10,backgroundColor:color,borderWidth:1,borderColor:'rgba(0,0,0,0.22)'}}/>
    <Text testID={`${key}-hex`} style={{flex:1,color:ink,fontSize:17,fontVariant:['tabular-nums']}}>{hex.toUpperCase()}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={key==='accent'?'选择强调色':'背景颜色说明'} onPress={action} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="color-filter-outline" size={21} color={legend}/></Pressable>
  </View>;
  return <View style={{gap:8,marginVertical:flat?14.5:5.5,padding:flat?0:8,borderRadius:flat?0:22,backgroundColor:flat?'transparent':theme.palette.surface}}>
    {page==='theme'&&<View style={{gap:12}}><View>{(['system','light','dark']as const).map((mode,index)=>choice(`theme-${mode}`,['跟随系统','浅色','深色'][index]!,value.theme===mode,()=>update({theme:mode})))}</View><Text style={{color:theme.palette.secondary,fontSize:13,lineHeight:20,padding:14}}>选择后立即保存。</Text></View>}
    {page==='background'&&<View style={{gap:0,paddingBottom:16}}>
      {/* IMG_4855 card: 114pt tall, a shadowed summary pill pinned to the lower-left. */}
      <View testID="theme-preview-card" style={{borderRadius:16,backgroundColor:darkMode?theme.palette.surface:settingsSheet.card,paddingHorizontal:14,paddingBottom:16,minHeight:120,justifyContent:'flex-end'}}>
        <View style={{alignSelf:'flex-start',maxWidth:'100%',minHeight:40,paddingLeft:16.7,paddingRight:13.3,flexDirection:'row',alignItems:'center',gap:11.5,borderRadius:12,backgroundColor:darkMode?theme.palette.selected:'#FFFFFF',shadowColor:'#000000',shadowOpacity:.09,shadowRadius:10,shadowOffset:{width:0,height:3},elevation:2}}>
          <Text style={{color:theme.palette.accent,fontSize:24.8,transform:[{translateY:.7}]}}>♪</Text>
          <View testID="theme-preview-summary" accessible accessibilityRole="text" accessibilityLabel={`音枢 · ${styleLabels[value.backgroundStyle]} · 卡片 ${Math.round(value.cardOpacity*100)}%`} style={{flexDirection:'row',alignItems:'center',flexShrink:1,marginLeft:-1}}>
            <Text style={{width:43.3,flexShrink:0,color:ink,fontSize:15.2,fontWeight:'500',transform:[{translateY:1.6}]}}>音枢</Text>
            <Text style={{width:4,flexShrink:0,color:ink,fontSize:15.2,fontWeight:'600',textAlign:'center',transform:[{translateY:.6}]}}>·</Text>
            <Text numberOfLines={1} style={{width:31,marginLeft:6.3,flexShrink:0,color:ink,fontSize:15.2,fontWeight:'600',transform:[{translateY:-.4}]}}>{styleLabels[value.backgroundStyle]}</Text>
            <Text style={{width:4,flexShrink:0,color:ink,fontSize:15.2,fontWeight:'600',textAlign:'center',transform:[{translateY:.6}]}}>·</Text>
            <Text numberOfLines={1} style={{width:32.3,marginLeft:5.7,flexShrink:0,color:ink,fontSize:15.2,fontWeight:'600',transform:[{translateY:-.4}]}}>卡片</Text>
            <Text numberOfLines={1} style={{width:35.5,flexShrink:0,color:ink,fontSize:15.2,fontWeight:'600',transform:[{translateY:.3}]}}>{Math.round(value.cardOpacity*100)}%</Text>
          </View>
        </View>
      </View>
      {/* IMG_4855 label ink is ~11pt tall (13pt type), not 16pt. The extra bottom
          margin absorbs the smaller line box so the cards below stay anchored. */}
      <Text style={{color:muted,fontSize:13,marginLeft:4,marginTop:20.6,marginBottom:14}}>一键主题</Text>
      {themeChoices(themeChips,{paddingBottom:12.7,transform:[{translateY:-4.3}]})}
      <Text style={{color:muted,fontSize:13,marginLeft:4,marginTop:18.9,marginBottom:19.7}}>背景类型</Text>
      <View style={{marginHorizontal:8,padding:8,borderRadius:20,backgroundColor:glass}}>
        <View style={{flexDirection:'row',height:40,borderRadius:20,borderWidth:1,borderColor:outline,overflow:'hidden'}}>
          {([['solid','纯色'],['gradient','渐变'],['image','图片']] as const).map(([id,label],index)=>{
            const selected=value.backgroundStyle===id,disabled=id==='image'&&!assets.background;
            const segmentLabelInk=selected?segmentInkSelected:segmentInk;
            return <Pressable key={id} testID={`background-${id}`} accessibilityRole="radio" accessibilityState={{selected,disabled}} disabled={disabled} accessibilityHint={disabled?'请先在下方导入主题背景图片':undefined} onPress={()=>update({backgroundStyle:id})} style={{flex:1,minHeight:40,paddingBottom:2.8,paddingRight:3,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8.3,backgroundColor:selected?segmentTint:'transparent',borderLeftWidth:index?1:0,borderLeftColor:outline}}>{segmentGlyph(id,segmentLabelInk)}<Text style={{color:segmentLabelInk,fontSize:14.5,fontWeight:'500'}}>{label}</Text></Pressable>;
          })}
        </View>
      </View>
      {/* IMG_4855 fields sit 3.3pt above the first render; 4856's scrolled
          capture differs by only 1pt, so the cut is half the 4855 offset. */}
      <Text style={{color:muted,fontSize:13,marginLeft:4,marginTop:32.1,marginBottom:20.8}}>颜色</Text>
      {/* IMG_4856 puts both outlined fields 32pt from the screen edge (16pt inside
          the sheet gutter) while the section label stays on the gutter. Its first
          border sits at 216.0pt; the 3pt offset below lands the same edge. */}
      <View style={{marginHorizontal:16,marginTop:2.6}}>
        {outlined('accent','强调色',theme.palette.accent,theme.palette.accent,()=>Alert.alert('强调色','选择主题强调色。',[...(Object.keys(accentColors) as Accent[]).map((id,index)=>({text:['玫瑰','珊瑚','紫色','蓝色','橙色'][index]!,onPress:()=>update({accent:id})})),{text:'取消',style:'cancel' as const}]),darkMode?theme.palette.background[1]:settingsSheet.fieldBackdrop[0])}
        {/* IMG_4856 border pitch is 83.0pt (field 55 + 28 gap); the 28pt spacer
            rendered a 84.0pt pitch and pushed the second field's borders 1pt low. */}
        <View style={{height:27}}/>
        {outlined('background','背景颜色',theme.palette.background[0],theme.palette.background[0],()=>Alert.alert('背景颜色','背景颜色随当前主题渐变生成，可在一键主题中切换。'),darkMode?theme.palette.background[1]:settingsSheet.fieldBackdrop[1])}
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
    {page==='background'&&<><VisualSettings services={services}/><Text accessibilityRole="header" style={{color:muted,fontSize:13,marginLeft:4,marginTop:12,marginBottom:8}}>音枢扩展主题 · {themeLabels[value.visualTheme]}</Text>{themeChoices(['soft','classic'])}</>} {page==='mini'&&<MiniPlayerSettings services={services}/>}
    {!!error&&<Text accessibilityLiveRegion="polite" style={{color:theme.palette.accent}}>{error}</Text>}
  </View>;
}
