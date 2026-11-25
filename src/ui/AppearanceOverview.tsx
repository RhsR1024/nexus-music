import {useState,useSyncExternalStore} from 'react';
import {Pressable,StyleSheet,Switch,View,useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {AppearanceSection} from './AppearanceSettings.tsx';
import {miniActionLabels} from '../domain/miniPlayer.ts';
import {visualThemeLabels} from '../domain/appearance.ts';
import {effectiveLyricFont} from '../storage/fontCatalog.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';

export function AppearanceOverview({services,open}:{services:Services;open:(page:AppearanceSection|'globalFont'|'lyricFont')=>void}){
  const theme=useTheme(),p=theme.palette,s=sollinTokens(theme.mode,p.accent,theme.appearance);
  const value=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),fonts=useSyncExternalStore(services.fonts.subscribe,services.fonts.getSnapshot);
  const stacked=useWindowDimensions().fontScale>1.4;
  const [error,setError]=useState('');
  const update=(patch:Parameters<typeof services.preferences.update>[0])=>{setError('');void services.preferences.update(patch).catch(()=>setError('设置未保存，请重试；之前的设置已保留。'));};
  const fontName=(id:string|null|undefined)=>fonts.fonts.find(font=>font.id===id)?.name??'系统默认';
  const themes=visualThemeLabels,styles={gradient:'渐变',solid:'纯色',image:'图片'},layouts={classic:'经典',am:'AM 风格',immersive:'封面沉浸',photo:'写真歌词',vinyl:'黑胶唱机',wave:'声波核',stage:'歌词舞台',am2:'AM2'};
  const navLabels={liquid:'液态玻璃',frosted:'磨砂融合',acrylic:'亚克力中置'} as const;
  type Row={id:string;title:string;icon:React.ComponentProps<typeof Ionicons>['name'];detail?:string;subtitle?:string;page?:AppearanceSection|'globalFont'|'lyricFont';toggle?:{value:boolean;change:(next:boolean)=>void}};
  const displayRows:Row[]=[
    {id:'theme',title:'软件主题',icon:'contrast',detail:{system:'跟随系统',light:'浅色',dark:'深色'}[value.theme],page:'theme'},
    {id:'background',title:'主题与背景',icon:'color-palette',detail:`${themes[value.visualTheme]} · ${styles[value.backgroundStyle]}`,page:'background'},
    {id:'cover-color',title:'背景随封面变化',icon:'color-filter-outline',subtitle:'使用封面主体色，应用到全局及播放器',toggle:{value:value.coverColor,change:coverColor=>update({coverColor})}},
    {id:'motion',title:'动态背景',icon:'pulse',subtitle:'封面色彩流动并优先显示；暂停或减少动态效果时停止',toggle:{value:value.dynamicBackground,change:dynamicBackground=>update({dynamicBackground})}},
    {id:'icons',title:'软件图标',icon:'apps',detail:'默认图标',page:'icons'},
    {id:'globalFont',title:'全局字体',icon:'text',detail:fontName(fonts.global),page:'globalFont'},
    {id:'lyricFont',title:'歌词字体',icon:'reader-outline',detail:fonts.lyricMode==='inherit'?'跟随全局字体':fontName(effectiveLyricFont(fonts)),page:'lyricFont'},
    {id:'skins',title:'播放界面样式',icon:'albums',detail:layouts[value.playerLayout],page:'skins'},
    {id:'navigation',title:'底部栏样式',icon:'grid',detail:navLabels[value.navigationStyle],page:'navigation'},
    {id:'show-local',title:'显示「本地」菜单',icon:'phone-portrait-outline',subtitle:'关闭后底部栏与侧边栏不再显示「本地」入口，本地音乐仍保留在设备上',toggle:{value:value.showLocalTab,change:showLocalTab=>update({showLocalTab})}},
    {id:'mini',title:'迷你播放器按钮',icon:'options-outline',subtitle:'选择与调整按钮顺序，最多 4 个',detail:value.miniActions.map(action=>miniActionLabels[action]).join('、'),page:'mini'},
  ];
  const playerRows:Row[]=[
    {id:'keep-screen-on',title:'播放界面屏幕常亮',icon:'sunny-outline',subtitle:'打开完整播放界面时阻止屏幕自动息屏',toggle:{value:value.keepScreenOn,change:keepScreenOn=>update({keepScreenOn})}},
    {id:'full-screen',title:'全屏模式',icon:'expand-outline',subtitle:'隐藏顶部状态栏，获得更沉浸的浏览与播放视野',toggle:{value:value.fullScreenMode,change:fullScreenMode=>update({fullScreenMode})}},
    {id:'tape-style',title:'磁带封面',icon:'radio-outline',subtitle:'为经典、沉浸、声波核与 AM 系列主要封面追加粉调磁带框',toggle:{value:value.tapeStyle,change:tapeStyle=>update({tapeStyle})}},
    {id:'player-background',title:'播放器背景',icon:'image-outline',detail:{artwork:'歌曲封面',photo:'自定义写真',solid:'纯色'}[value.playerBackground],page:'background'},
    {id:'accent',title:'强调色',icon:'ellipse',detail:{rose:'玫瑰',coral:'珊瑚',purple:'紫色',blue:'蓝色',orange:'橙色'}[value.accent],page:'accent'},
  ];
  function row(item:Row,last:boolean){
    const body=<>
      <View style={{width:28,alignItems:'center',justifyContent:'center'}}>
        <Ionicons name={item.icon} size={21} color={item.id==='accent'?s.accent:s.ink}/>
      </View>
      <View style={{flex:1,minWidth:0,gap:3}}>
        <Text style={{color:s.ink,fontSize:16,fontWeight:'500'}}>{item.title}</Text>
        {item.subtitle&&<Text style={{color:s.muted,fontSize:12,lineHeight:17}}>{item.subtitle}</Text>}
        {stacked&&item.detail&&<Text style={{color:s.muted,fontSize:13}}>{item.detail}</Text>}
      </View>
      {item.toggle?<Switch testID={`appearance-${item.id}`} accessibilityLabel={item.title} value={item.toggle.value} onValueChange={item.toggle.change} trackColor={s.switchTrack} thumbColor={s.switchThumb(item.toggle.value)}/>
        :<>{!stacked&&!!item.detail&&<Text numberOfLines={2} style={{color:s.muted,fontSize:14,textAlign:'right',maxWidth:'42%',flexShrink:1}}>{item.detail}</Text>}{item.page&&<Ionicons name="chevron-forward" size={16} color={s.subtle}/>}</>}
    </>;
    const style={paddingVertical:14,paddingHorizontal:16,flexDirection:'row' as const,alignItems:'center' as const,gap:12,minHeight:56};
    return <View key={item.id} style={{borderBottomWidth:last?0:StyleSheet.hairlineWidth,borderBottomColor:s.hairline}}>
      {item.page?<Pressable testID={`settings-open-${item.id}`} accessibilityRole="button" accessibilityLabel={item.title} accessibilityValue={{text:item.detail}} onPress={()=>open(item.page!)} style={style}>{body}</Pressable>:<View style={style}>{body}</View>}
    </View>;
  }
  return <View style={{gap:10,paddingTop:6}}>
    <Text accessibilityRole="header" style={{color:s.muted,fontSize:13,marginLeft:6,marginTop:4}}>显示</Text>
    <View style={{borderRadius:20,overflow:'hidden',backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder}}>{displayRows.map((item,i)=>row(item,i===displayRows.length-1))}</View>
    <Text accessibilityRole="header" style={{color:s.muted,fontSize:13,marginLeft:6,marginTop:10}}>播放器</Text>
    <View style={{borderRadius:20,overflow:'hidden',backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder}}>{playerRows.map((item,i)=>row(item,i===playerRows.length-1))}</View>
    {!!error&&<Text accessibilityRole="alert" style={{color:s.accent,marginLeft:6}}>{error}</Text>}
  </View>;
}
