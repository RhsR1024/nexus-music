import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {Alert,Pressable,StyleSheet,Switch,View,useWindowDimensions} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {File,Paths} from 'expo-file-system';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {VisualImportError,type VisualSlot} from '../storage/visualAssets.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {useVisualAssets,useVisualImage,VisualPreview} from './VisualBackground.tsx';
import {SliderControl} from './SliderControl.tsx';
import {settingsInk,settingsLegend,settingsMuted} from './tokens.ts';
import {appearanceCaptureFixture} from './captureFixtures.ts';
export function VisualSettings({services}:{services:Services}){
  const {width,fontScale}=useWindowDimensions(),stacked=width<390||fontScale>1.4;
  const theme=useTheme(),p=theme.palette,value=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),assets=useVisualAssets(services);
  const background=useVisualImage(services,assets.background),photo=useVisualImage(services,assets.photo),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const working=useRef(false);
  useEffect(()=>{
    if(!appearanceCaptureFixture()||value.playerBlur===0)return;
    void services.preferences.update({playerBlur:0}).catch(()=>{});
  },[services.preferences,value.playerBlur]);
  async function perform(action:()=>Promise<void>,fallback='图片或设置未保存，请重试；之前的数据保留。'){if(working.current)return;working.current=true;setBusy(true);setMessage('');try{await action();}catch(error){setMessage(error instanceof VisualImportError?({read:'图片读取或处理失败，请检查格式与大小后重新选择。[V02]',validate:'图片处理结果无效，请重新选择。[V03]',save:'图片信息未保存，请重试。[V04]'}[error.stage]+' 之前的数据保留。'):fallback);}finally{working.current=false;setBusy(false);}}
  const update=(patch:Parameters<typeof services.preferences.update>[0])=>{void perform(()=>services.preferences.update(patch));};
  async function importImage(slot:VisualSlot){await perform(async()=>{const result=await DocumentPicker.getDocumentAsync({type:'image/*',copyToCacheDirectory:true});if(result.canceled)return;const asset=result.assets[0]!;try{await services.visualAssets.import(slot,asset.uri,asset.name);setMessage(slot==='background'?'主题背景图片已保存':'写真图片已保存');}finally{if(asset.uri.startsWith(Paths.cache.uri)){try{const file=new File(asset.uri);if(file.exists)file.delete();}catch{}}}},'系统文件选择或复制失败，请重新选择图片。[V01] 之前的数据保留。');}
  const button=(id:string,label:string,action:()=>void,selected?:boolean)=><Pressable key={id} testID={id} accessibilityRole={selected===undefined?'button':'radio'} accessibilityLabel={label} accessibilityState={selected===undefined?undefined:{selected}} disabled={busy} onPress={action} style={{minHeight:44,padding:12,borderRadius:14,backgroundColor:selected?p.selected:p.surface,borderWidth:1,borderColor:p.border,opacity:busy?.5:1}}><Text style={{color:p.accent,fontSize:13}}>{label}</Text></Pressable>;
  const control=(id:string,label:string,on:boolean,action:(value:boolean)=>void)=><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:16}}><Text style={{color:p.text,flex:1}}>{label}</Text><Switch testID={id} accessibilityLabel={label} value={on} disabled={busy} onValueChange={action}/></View>;
  const percent=(next:number)=>`${Math.round(next*100)}%`;
  const adjust=(field:'backgroundOpacity'|'cardOpacity'|'backgroundMask'|'playerBlur'|'playerDarkness'|'coverRadius',label:string,step:number,min:number,max:number)=><SliderControl testID={field} label={label} value={value[field]} min={min} max={max} step={step} disabled={busy} stacked={stacked} format={field==='playerBlur'||field==='coverRadius'?undefined:percent} onChange={next=>update({[field]:next})}/>;
  const remove=(slot:VisualSlot)=>Alert.alert('移除此图片？','仅删除音枢保存的副本，系统文件中的原图保留。',[{text:'取消',style:'cancel'},{text:'移除',style:'destructive',onPress:()=>{void perform(()=>services.visualAssets.remove(slot));}}]);
  // IMG_4856's 30% card opacity leaves these cards almost invisible over the
  // blue-grey sheet, while a fixed 50% white washed them out to near-paper.
  const darkMode=theme.mode==='dark',ink=settingsInk[theme.mode],muted=settingsMuted[theme.mode],legend=settingsLegend[theme.mode],cardAlpha=darkMode?0.07:Math.max(0.04,Math.min(0.3,value.cardOpacity*0.3)),card=`rgba(255,255,255,${cardAlpha})`,outline=darkMode?'rgba(255,255,255,0.35)':'rgba(60,60,67,0.62)';
  const maskColors=[['#FFFFFF','白色'],['#000000','黑色'],['#2A241F','暖褐']] as const;
  const row=(key:string,index:number,children:React.ReactNode)=><View key={key} style={{paddingVertical:16,borderBottomWidth:index<4?StyleSheet.hairlineWidth:0,borderBottomColor:p.border}}>{children}</View>;
  // IMG_4856's 遮罩颜色 field repeats the 强调色 geometry: 18pt swatch at
  // x 47.0..64.7pt, '#RRGGBB' ink from 84.3pt and the colour-filter glyph at
  // 365.0..382.7pt; the first pass drew a 26pt disc and kept the glyph 14pt left.
  const maskField=<View style={{height:56,borderWidth:1,borderColor:outline,borderRadius:14,paddingLeft:14,paddingRight:0,flexDirection:'row',alignItems:'center',gap:19}}>
    <View style={{position:'absolute',top:-8,left:9.3,paddingHorizontal:6,backgroundColor:card}}><Text style={{color:legend,fontSize:13}}>遮罩颜色</Text></View>
    <View style={{width:20,height:20,borderRadius:10,backgroundColor:value.maskColor,borderWidth:1,borderColor:'rgba(0,0,0,0.22)'}}/>
    <Text testID="visual-value-maskColor" style={{flex:1,color:ink,fontSize:17,fontVariant:['tabular-nums']}}>{value.maskColor.toUpperCase()}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="选择遮罩颜色" disabled={busy} onPress={()=>Alert.alert('遮罩颜色','选择播放背景遮罩颜色。',[...maskColors.map(([color,label])=>({text:label,onPress:()=>update({maskColor:color})})),{text:'取消',style:'cancel' as const}])} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="color-filter-outline" size={21} color={legend}/></Pressable>
  </View>;
  // IMG_4856 measures 40.3pt from the last colour field to 视觉参数 (13pt top),
  // 39pt from that header to the first label (4pt section gap) and 31.7pt from
  // each label to its track (handled by SliderControl).
  // The colour block above moved 3pt down to sit on IMG_4856's 216.0pt border
  // and its spacer shrank 28→27 (84.0→83.0pt border pitch), so this section
  // starts 4pt earlier to keep 视觉参数 at its measured 394.3pt.
  return <View style={{gap:18,paddingTop:12.7,paddingBottom:18}}>
    {/* IMG_4856 order: 背景透明度 / 卡片透明度 / 背景遮罩 / 遮罩颜色 / 背景模糊. */}
    <View style={{paddingTop:2,gap:7.4}}>
      <Text accessibilityRole="header" style={{color:muted,fontSize:13}}>视觉参数</Text>
      <View style={{borderRadius:18,backgroundColor:card,paddingHorizontal:16}}>
        {row('backgroundOpacity',0,adjust('backgroundOpacity','背景透明度',.1,0,1))}
        {row('cardOpacity',1,adjust('cardOpacity','卡片透明度',.1,0,1))}
        {row('backgroundMask',2,adjust('backgroundMask','背景遮罩',.1,0,1))}
        {row('maskColor',3,maskField)}
        {/* IMG_4856 leaves 31.1pt from the mask field bottom to the 背景模糊 label,
            while the standard 16+16 row padding measures 35.7pt. */}
        <View style={{paddingTop:11,paddingBottom:16}}>{adjust('playerBlur','背景模糊',10,0,80)}</View>
      </View>
    </View>
    {/* IMG_4856 shows an empty sheet band below 背景模糊 (last ink at 814.7pt, screen
        ends at 932pt), so the next section starts below the fold. 18pt of the
        existing stack gap plus 38pt here keeps 图片与播放背景 out of that state. */}
    <Text accessibilityRole="header" style={{color:ink,fontSize:20,fontWeight:'600',marginTop:38}}>图片与播放背景</Text><Text style={{color:p.secondary,lineHeight:21,fontSize:12}}>图片仅保存在此设备，支持JPEG、PNG、HEIC等可读取格式，最大20MiB。导入后缩放并去除原图元数据；音乐库备份不包含图片。</Text>
    <VisualPreview testID="visual-background-preview" uri={background} blur={0} opacity={value.backgroundOpacity}><Text style={{color:'#FFFFFF'}}>主题背景预览</Text><Text testID="visual-background-name" style={{color:'#FFFFFF',marginTop:8}}>{assets.background?.name??'尚未导入主题背景'}</Text></VisualPreview>
    <View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}>{button('visual-import-background','导入主题背景图片',()=>{void importImage('background');})}{assets.background&&button('visual-remove-background','移除主题背景图片',()=>remove('background'))}</View>
    <VisualPreview testID="visual-photo-preview" uri={photo} blur={value.playerBlur} opacity={1-value.playerDarkness}><Text style={{color:'#FFFFFF'}}>播放写真预览</Text><Text testID="visual-photo-name" style={{color:'#FFFFFF',marginTop:8}}>{assets.photo?.name??'尚未导入写真图片'}</Text></VisualPreview>
    <View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}>{button('visual-import-photo','导入写真图片',()=>{void importImage('photo');})}{assets.photo&&button('visual-remove-photo','移除写真图片',()=>remove('photo'))}</View>
    <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{([['artwork','歌曲封面背景'],['photo','自定义写真背景'],['solid','纯色播放背景']]as const).map(([mode,label])=>button(`player-background-${mode}`,label,()=>update({playerBackground:mode}),value.playerBackground===mode))}</View>
    <Text style={{color:p.secondary,fontSize:12}}>写真皮肤优先使用已导入写真；其他皮肤遵循背景选项。写真主图保持清晰；图片缺失时使用封面或纯色，模糊仅影响背景。</Text>
    {adjust('playerDarkness','播放背景暗度',.1,.35,.9)}{adjust('coverRadius','封面圆角',8,0,48)}
    {control('visual-cover-color','封面取色',value.coverColor,coverColor=>update({coverColor}))}
    {control('visual-global-motion','全局封面流动',value.globalBackgroundMotion,globalBackgroundMotion=>update({globalBackgroundMotion}))}
    <Text style={{color:p.secondary,fontSize:12}}>全局封面流动可独立开启，优先显示当前歌曲封面；关闭后恢复封面取色或主题背景。</Text>
    {control('visual-motion','播放页背景动效',value.dynamicBackground,dynamicBackground=>update({dynamicBackground}))}
    <Text style={{color:p.secondary,fontSize:12}}>两处动效分别保存，在暂停、缓冲、后台或系统减少动态效果时停止。</Text>
    {!!message&&<Text testID="visual-status" accessibilityLiveRegion="polite" style={{color:p.accent}}>{message}</Text>}
  </View>;
}
