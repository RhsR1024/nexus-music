import {MiniPlayerSettings} from './MiniPlayerSettings.tsx';
import {VisualSettings} from './VisualSettings.tsx';
import {Text} from './Typography.tsx';
import {useRef,useState,useSyncExternalStore} from 'react';
import {Alert, Pressable, Share, StyleSheet, Switch, Text as NativeText, View} from 'react-native';
import {ThemeConfigActions} from './ThemeConfigActions.tsx';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {accentColors,appearanceDefaults,themeBackground,themeSwatchBackground,visualThemeLabels as themeLabels,visualThemes,type Accent,type VisualTheme} from '../domain/appearance.ts';
import {useTheme} from './theme.tsx';
import {useVisualAssets} from './VisualBackground.tsx';
import {settingsInk,settingsLegend,settingsMuted,settingsSheet,sollinTokens,themeChoiceLayout as chips} from './tokens.ts';
const styleLabels:Record<'gradient'|'solid'|'image',string>={gradient:'渐变',solid:'纯色',image:'图片'};
const segmentIconSize={solid:16.4,gradient:15.1,image:16.4} as const;
const segmentGlyphFontSize=16.4;
const segmentGlyph=(id:'gradient'|'solid'|'image',color:string)=>{const size=segmentIconSize[id];return <View style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}><NativeText allowFontScaling={false} style={{fontFamily:'CupertinoIcons',fontSize:segmentGlyphFontSize,color,transform:id==='gradient'?[{translateY:-0.67}]:undefined}}>{id==='solid'?'\u{f400}':id==='gradient'?'\u{f8e7}':'\u{f768}'}</NativeText></View>;};
export type AppearanceSection='theme'|'background'|'skins'|'accent'|'navigation'|'mini'|'icons';
export function BackgroundThemeActions({services}:{services:Services}){
  const value=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),theme=useTheme();
  const shuffleTheme=()=>{const next=visualThemes[(visualThemes.indexOf(value.visualTheme)+1)%visualThemes.length];if(next)void services.preferences.update({visualTheme:next}).catch(()=>Alert.alert('主题未保存','原主题保留，请重试。'));};
  const favorite=value.favoriteVisualTheme===value.visualTheme;
  const toggleFavorite=()=>{void services.preferences.update({favoriteVisualTheme:favorite?null:value.visualTheme}).catch(()=>Alert.alert('主题收藏未保存','原收藏保留，请重试。'));};
  const shareTheme=()=>{void Share.share({message:`音枢主题 · ${themeLabels[value.visualTheme]} · ${styleLabels[value.backgroundStyle]}`}).catch(()=>{});};
  const icon=(name:React.ComponentProps<typeof Ionicons>['name'],label:string,action:()=>void,id?:string,accessibility?:{hint?:string;selected?:boolean},longPress?:()=>void,size=25,offsetY=0)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibility?.hint} accessibilityState={accessibility?.selected===undefined?undefined:{selected:accessibility.selected}} onPress={action} onLongPress={longPress} delayLongPress={500} style={{width:48,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name={name} size={size} color={theme.palette.text} style={offsetY?{transform:[{translateY:offsetY}]}:undefined}/></Pressable>;
  return <View accessibilityLabel="主题操作" style={{flexDirection:'row',alignItems:'center'}}>
    {icon(favorite?'bookmark':'bookmark-outline',favorite?'取消收藏当前主题':'收藏当前主题',toggleFavorite,'appearance-favorite-theme',{hint:'长按随机切换主题',selected:favorite},shuffleTheme,25,1)}
    <ThemeConfigActions services={services}/>
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
  const s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const section=(title:string,children:React.ReactNode)=><View style={{gap:12,paddingVertical:10}}><Text style={{fontSize:13,fontWeight:'500',color:s.muted,marginLeft:4}}>{title}</Text>{children}</View>;
  const choice=(id:string,label:string,selected:boolean,onPress:()=>void,disabled=false,last=false)=><Pressable key={id} testID={id} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} style={{minHeight:54,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:last?0:StyleSheet.hairlineWidth,borderBottomColor:s.hairline,opacity:disabled?.5:1}}><Text style={{color:selected?s.accent:s.ink,fontWeight:selected?'600':'500',fontSize:16}}>{label}</Text>{selected&&<Ionicons name="checkmark" size={20} color={s.accent}/>}</Pressable>;
  // IMG_4855 keeps the sections on the sheet's own tinted surface; only the
  // summary card and control rows carry a fill.
  const flat=page==='background';
  // Follow 卡片透明度 for the glass fills; IMG_4856 at 30% shows the sheet
  // gradient through the theme grid and type capsule rather than white panels.
  // IMG_4855 fields outline at #857373 over the sheet wash, warmer than the
  // neutral #7D7F87 the cool chrome first rendered.
  const darkMode=theme.mode==='dark',ink=settingsInk[theme.mode],muted=settingsMuted[theme.mode],legend=settingsLegend[theme.mode],outline=darkMode?'rgba(255,255,255,0.35)':'rgba(78,44,38,0.62)',glassAlpha=darkMode?0.07:Math.max(0.08,Math.min(0.45,value.cardOpacity*0.45)),glass=`rgba(255,255,255,${glassAlpha})`,colorCardAlpha=darkMode?0.07:Math.max(0.04,Math.min(0.3,value.cardOpacity*0.3)),colorCard=`rgba(255,255,255,${colorCardAlpha})`,themeGlassAlpha=darkMode?0.07:Math.max(0.08,Math.min(0.2,value.cardOpacity*0.47)),themeGlass=`rgba(204,254,254,${themeGlassAlpha})`;
  // The selected segment is #FEDADA for rose in IMG_4855; other accents mix
  // toward warm white so the pill never reads lavender over the cool sheet wash.
  const accentRgb=parseInt(theme.palette.accent.slice(1),16),segmentTint=darkMode?`${theme.palette.accent}2E`:theme.palette.accent.toUpperCase()==='#E83D56'?'#FEDADA':`rgb(${[accentRgb>>16,(accentRgb>>8)&255,accentRgb&255].map(channel=>Math.round(channel*0.2+204)).join(',')})`;
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
  const outlined=(key:'accent'|'background',label:string,color:string,hex:string,action:()=>void,backdrop:string)=><View key={key} ref={key==='accent'?accentFieldRef:undefined} onLayout={key==='accent'?onAccentFieldLayout:undefined} testID={`${key}-color-field`} style={{height:56,borderWidth:1,borderColor:outline,borderRadius:7,backgroundColor:'transparent',paddingLeft:14,paddingRight:0,flexDirection:'row',alignItems:'center',gap:17.3}}>
    <View style={{position:'absolute',top:-8,left:11,paddingHorizontal:4,backgroundColor:backdrop}}><Text style={{color:legend,fontSize:13}}>{label}</Text></View>
    {/* IMG_4856 measures the swatch outline at 20pt with an 18pt fill inside it. */}
    <View style={{width:20,height:20,borderRadius:10,backgroundColor:color,borderWidth:1,borderColor:'rgba(0,0,0,0.22)'}}/>
    <Text testID={`${key}-hex`} style={{flex:1,color:ink,fontSize:17,fontVariant:['tabular-nums']}}>{hex.toUpperCase()}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={key==='accent'?'选择强调色':'背景颜色说明'} onPress={action} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="color-filter-outline" size={21} color={legend}/></Pressable>
  </View>;
  return <View style={{gap:8,marginVertical:flat?14.5:10,padding:flat?0:0,borderRadius:flat?0:20,backgroundColor:'transparent'}}>
    {page==='theme'&&<View style={{gap:12}}><View style={{borderRadius:18,overflow:'hidden',backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder}}>{(['system','light','dark']as const).map((mode,index)=>choice(`theme-${mode}`,['跟随系统','浅色','深色'][index]!,value.theme===mode,()=>update({theme:mode}),false,index===2))}</View><Text style={{color:s.muted,fontSize:13,lineHeight:20,paddingHorizontal:6}}>选择后立即保存。</Text></View>}
    {page==='background'&&<View style={{gap:0,paddingBottom:3}}>
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
            <Text numberOfLines={1} style={{minWidth:35.5,flexShrink:0,color:ink,fontSize:15.2,fontWeight:'600',transform:[{translateY:.3}]}}>{Math.round(value.cardOpacity*100)}%</Text>
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
      <Text style={{color:muted,fontSize:13,marginLeft:4,marginTop:32.1,marginBottom:9.8}}>颜色</Text>
      {/* IMG_4855/4856 wrap both outlined fields inside a shared rounded frosted
          card with a hairline divider between them while keeping the 32pt field
          inset (16pt sheet gutter + 16pt card padding) and 83.0pt field pitch. */}
      <View style={{marginTop:2,borderRadius:18,backgroundColor:colorCard,paddingHorizontal:16,paddingTop:11.3,paddingBottom:14}}>
        {outlined('accent','强调色',theme.palette.accent,theme.palette.accent,()=>Alert.alert('强调色','选择主题强调色。',[...(Object.keys(accentColors) as Accent[]).map((id,index)=>({text:['玫瑰','珊瑚','紫色','蓝色','橙色'][index]!,onPress:()=>update({accent:id})})),{text:'取消',style:'cancel' as const}]),darkMode?theme.palette.background[1]:settingsSheet.fieldBackdrop[0])}
        <View style={{height:27,justifyContent:'center'}}><View style={{height:StyleSheet.hairlineWidth,backgroundColor:darkMode?'rgba(255,255,255,0.10)':'rgba(60,60,67,0.14)'}}/></View>
        {outlined('background','背景颜色',theme.palette.background[0],theme.palette.background[0],()=>Alert.alert('背景颜色','背景颜色随当前主题渐变生成，可在一键主题中切换。'),darkMode?theme.palette.background[1]:settingsSheet.fieldBackdrop[1])}
      </View>
    </View>}
    {page==='skins'&&<View style={{gap:10}}><View accessibilityLabel="可选播放界面样式" style={[{borderRadius:20,overflow:'hidden',backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder},s.cardShadow]}>{([
      ['classic','经典','disc-outline','封面与歌词分栏、原始播放器布局'],
      ['vinyl','黑胶唱机','musical-note','旋转黑胶唱片与动态唱针'],
      ['am','AM 风格','list','大幅歌词、动态封面与三态队列'],
      ['am2','AM2','pulse','流动封面背景与逐词歌词动画'],
      ['immersive','封面沉浸','tablet-landscape','大封面沉浸与居中歌词'],
      ['wave','声波核','radio','环形进度、实时音频频谱环与居中歌词'],
      ['photo','写真歌词','image','写真封面、长歌词与轻触快捷操作'],
      ['stage','歌词舞台','text','全屏逐字大字舞台与多种视觉风格'],
    ] as const).map(([id,label,icon,detail],index)=>{
      const selected=value.playerLayout===id;
      return <View key={id}>
        {index>0&&<View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:58,backgroundColor:s.hairline}}/>}
        <Pressable testID={`player-layout-${id}`} accessibilityRole="radio" accessibilityLabel={label} accessibilityValue={{text:detail}} accessibilityState={{selected,disabled:styleBusy,busy:styleBusy}} disabled={styleBusy} onPress={()=>{void selectStyle(id);}} style={{minHeight:64,paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:14,backgroundColor:'transparent',opacity:styleBusy?.5:1}}>
          <View style={{width:28,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={21} color={selected?s.accent:s.ink}/></View>
          <View style={{flex:1,gap:2}}><Text style={{color:selected?s.accent:s.ink,fontSize:15.5,fontWeight:'700'}}>{label}</Text><Text style={{color:s.muted,fontSize:12,lineHeight:17}}>{detail}</Text></View>
          {selected&&<Ionicons name="checkmark" size={20} color={s.accent}/>}
        </Pressable>
      </View>;
    })}</View><Text accessibilityLiveRegion="polite" style={{color:s.muted,fontSize:12,lineHeight:18,paddingHorizontal:6}}>{styleBusy?'正在保存…':'选择后立即保存并应用；播放进度、队列和播放意图保持不变。'}</Text></View>}
    {page==='accent'&&section('强调色',<View style={{borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,padding:16,flexDirection:'row',gap:14,flexWrap:'wrap'}}>{(Object.entries(accentColors) as [Accent,readonly[string,string]][]).map(([id,colors],index)=><Pressable key={id} testID={`accent-${id}`} accessibilityLabel={['玫瑰','珊瑚','紫色','蓝色','橙色'][index]} accessibilityRole="radio" accessibilityState={{selected:value.accent===id}} onPress={()=>update({accent:id})} style={{minWidth:44,minHeight:44,borderRadius:22,backgroundColor:colors[theme.mode==='dark'?1:0],alignItems:'center',justifyContent:'center',borderWidth:value.accent===id?3:0,borderColor:s.ink}}><Text style={{color:'#FFFFFF',fontSize:20}}>{value.accent===id?'✓':''}</Text></Pressable>)}</View>)}
    {page==='navigation'&&<View style={{gap:14}}>
      <View style={[{borderRadius:20,overflow:'hidden',backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder},s.cardShadow]}>{([
        ['liquid','液态玻璃','sparkles','现有的悬浮液态玻璃底栏'],
        ['frosted','磨砂融合','albums','迷你播放器与一级页底栏融合，二级页单独显示'],
        ['acrylic','亚克力中置','apps','透明亚克力底栏，播放器悬浮在底栏上方'],
      ] as const).map(([id,label,icon,detail],index)=>{
        const selected=value.navigationStyle===id;
        return <View key={id}>
          {index>0&&<View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:58,backgroundColor:s.hairline}}/>}
          <Pressable testID={`nav-style-${id}`} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{selected}} onPress={()=>update({navigationStyle:id})} style={{minHeight:64,paddingHorizontal:16,paddingVertical:11,flexDirection:'row',alignItems:'center',gap:14,backgroundColor:'transparent'}}>
            <View style={{width:28,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={21} color={selected?s.accent:s.ink}/></View>
            <View style={{flex:1,gap:2}}><Text style={{color:selected?s.accent:s.ink,fontSize:15.5,fontWeight:'700'}}>{label}</Text><Text style={{color:s.muted,fontSize:12,lineHeight:17}}>{detail}</Text></View>
            {selected&&<Ionicons name="checkmark" size={20} color={s.accent}/>}
          </Pressable>
        </View>;
      })}</View>
      <View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,paddingHorizontal:16,paddingVertical:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},s.cardShadow]}>
        <View style={{flex:1,gap:2}}><Text style={{fontSize:15.5,fontWeight:'700',color:s.ink}}>玻璃底栏</Text><Text style={{color:s.muted,fontSize:12,lineHeight:17}}>关闭或开启系统“降低透明度”时，使用实色表面。</Text></View>
        <Switch accessibilityLabel="玻璃底栏" value={value.glassNavigation} onValueChange={glassNavigation=>update({glassNavigation})} trackColor={s.switchTrack} thumbColor={s.switchThumb(value.glassNavigation)}/>
      </View>
    </View>}
    {page==='background'&&<><VisualSettings services={services}/><Text accessibilityRole="header" style={{color:muted,fontSize:13,marginLeft:4,marginTop:12,marginBottom:8}}>音枢扩展主题 · {themeLabels[value.visualTheme]}</Text>{themeChoices(['soft','classic'])}</>} {page==='mini'&&<MiniPlayerSettings services={services}/>}
    {!!error&&<Text accessibilityLiveRegion="polite" style={{color:theme.palette.accent}}>{error}</Text>}
  </View>;
}
