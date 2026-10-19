import {useState,useSyncExternalStore} from 'react';
import {Pressable,Switch,View,useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {AppearanceSection} from './AppearanceSettings.tsx';
import {miniActionLabels} from '../domain/miniPlayer.ts';
import {visualThemeLabels} from '../domain/appearance.ts';
import {effectiveLyricFont} from '../storage/fontCatalog.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';

export function AppearanceOverview({services,open}:{services:Services;open:(page:AppearanceSection|'globalFont'|'lyricFont')=>void}){
  const {palette:p}=useTheme(),value=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),fonts=useSyncExternalStore(services.fonts.subscribe,services.fonts.getSnapshot);
  const stacked=useWindowDimensions().fontScale>1.4;
  const [error,setError]=useState('');
  const update=(patch:Parameters<typeof services.preferences.update>[0])=>{setError('');void services.preferences.update(patch).catch(()=>setError('设置未保存，请重试；之前的设置已保留。'));};
  const fontName=(id:string|null|undefined)=>fonts.fonts.find(font=>font.id===id)?.name??'系统默认';
  const themes=visualThemeLabels,styles={gradient:'渐变',solid:'纯色',image:'图片'},layouts={classic:'经典',am:'AM 风格',immersive:'封面沉浸',photo:'写真歌词',vinyl:'黑胶唱机',wave:'声波核',stage:'歌词舞台',am2:'AM2'};
  type Row={id:string;title:string;icon:React.ComponentProps<typeof Ionicons>['name'];detail?:string;subtitle?:string;page?:AppearanceSection|'globalFont'|'lyricFont';toggle?:{value:boolean;change:(next:boolean)=>void}};
  const rows:Row[]=[
    {id:'theme',title:'软件主题',icon:'contrast-outline',subtitle:'白天、晚上或跟随系统外观',detail:{system:'跟随系统',light:'白天',dark:'晚上'}[value.theme],page:'theme'},
    {id:'background',title:'主题与背景',icon:'brush-outline',detail:`${themes[value.visualTheme]} · ${styles[value.backgroundStyle]} · 背景 ${Math.round(value.backgroundOpacity*100)}%`,page:'background'},
    {id:'cover-color',title:'背景随封面变化',icon:'color-filter-outline',subtitle:'使用封面主体色，应用到全局及播放器；关闭后恢复自选背景',toggle:{value:value.coverColor,change:coverColor=>update({coverColor})}},
    {id:'motion',title:'动态背景',icon:'pulse-outline',subtitle:'播放页封面缓慢移动；暂停、后台或减少动态效果时停止',toggle:{value:value.dynamicBackground,change:dynamicBackground=>update({dynamicBackground})}},
    {id:'globalFont',title:'全局字体',icon:'text-outline',detail:fontName(fonts.global),page:'globalFont'},
    {id:'lyricFont',title:'歌词字体',icon:'reader-outline',detail:fonts.lyricMode==='inherit'?`跟随全局 · ${fontName(effectiveLyricFont(fonts))}`:fontName(effectiveLyricFont(fonts)),page:'lyricFont'},
    {id:'skins',title:'播放界面样式',icon:'albums-outline',detail:layouts[value.playerLayout],page:'skins'},
    {id:'navigation',title:'底部栏样式',icon:'grid-outline',detail:value.glassNavigation?'玻璃':'实色',page:'navigation'},
    {id:'mini',title:'迷你播放器按钮',icon:'options-outline',subtitle:'选择与调整按钮顺序，最多 4 个',detail:value.miniActions.map(action=>miniActionLabels[action]).join('、'),page:'mini'},
  ];
  function row(item:Row){
    const body=<><Ionicons name={item.icon} size={23} color={p.text}/><View style={{flex:1,minWidth:0,gap:4}}><Text style={{color:p.text,fontSize:17,fontWeight:'600'}}>{item.title}</Text>{item.subtitle&&<Text style={{color:p.secondary,fontSize:13,lineHeight:19}}>{item.subtitle}</Text>}{stacked&&item.detail&&<Text style={{color:p.secondary,fontSize:14}}>{item.detail}</Text>}</View>{item.toggle?<Switch testID={`appearance-${item.id}`} accessibilityLabel={item.title} value={item.toggle.value} onValueChange={item.toggle.change} trackColor={{true:p.accent}}/>:<>{!stacked&&<Text numberOfLines={2} style={{color:p.secondary,fontSize:14,textAlign:'right',maxWidth:'48%',flexShrink:1}}>{item.detail}</Text>}{item.page&&<Ionicons name="chevron-forward" size={17} color={p.secondary}/>}</>          }</>;
    const style={paddingVertical:17,paddingHorizontal:16,flexDirection:'row' as const,alignItems:'center' as const,gap:12,minHeight:62};
    return <View key={item.id} style={{borderBottomWidth:item.id==='mini'?0:1,borderBottomColor:p.border}}>{item.page?<Pressable testID={`settings-open-${item.id}`} accessibilityRole="button" accessibilityLabel={item.title} accessibilityValue={{text:item.detail}} onPress={()=>open(item.page!)} style={style}>{body}</Pressable>:<View style={style}>{body}</View>}</View>;
  }
  return <View style={{gap:14,paddingTop:10}}>
    <Text accessibilityRole="header" style={{color:p.secondary,fontSize:13,marginTop:8}}>显示</Text>
    <View style={{borderRadius:24,overflow:'hidden',backgroundColor:p.surface}}>{rows.map(row)}</View>
    <Text accessibilityRole="header" style={{color:p.secondary,fontSize:13,marginTop:16}}>播放器</Text>
    <View style={{borderRadius:24,overflow:'hidden',backgroundColor:p.surface}}>{row({id:'player-background',title:'播放器背景',icon:'image-outline',detail:{artwork:'歌曲封面',photo:'自定义写真',solid:'纯色'}[value.playerBackground],page:'background'})}{row({id:'accent',title:'强调色',icon:'color-palette-outline',detail:{rose:'玫瑰',coral:'珊瑚',purple:'紫色',blue:'蓝色',orange:'橙色'}[value.accent],page:'accent'})}</View>
    {!!error&&<Text accessibilityRole="alert" style={{color:p.accent}}>{error}</Text>}
  </View>;
}
