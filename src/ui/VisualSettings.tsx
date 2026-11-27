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
import {settingsInk,settingsLegend,settingsMuted,settingsSheet,sollinTokens} from './tokens.ts';
import {appearanceCaptureFixture} from './captureFixtures.ts';

export function VisualSettings({services}:{services:Services}){
  const {width,fontScale}=useWindowDimensions(),stacked=width<390||fontScale>1.4;
  const theme=useTheme(),p=theme.palette,s=sollinTokens(theme.mode,p.accent,theme.appearance);
  const value=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),assets=useVisualAssets(services);
  const background=useVisualImage(services,assets.background),photo=useVisualImage(services,assets.photo),[busy,setBusy]=useState(false),[message,setMessage]=useState('');const working=useRef(false);
  useEffect(()=>{
    if(!appearanceCaptureFixture()||value.playerBlur===0)return;
    void services.preferences.update({playerBlur:0}).catch(()=>{});
  },[services.preferences,value.playerBlur]);
  async function perform(action:()=>Promise<void>,fallback='图片或设置未保存，请重试；之前的数据保留。'){if(working.current)return;working.current=true;setBusy(true);setMessage('');try{await action();}catch(error){setMessage(error instanceof VisualImportError?({read:'图片读取或处理失败，请检查格式与大小后重新选择。[V02]',validate:'图片处理结果无效，请重新选择。[V03]',save:'图片信息未保存，请重试。[V04]'}[error.stage]+' 之前的数据保留。'):fallback);}finally{working.current=false;setBusy(false);}}
  const update=(patch:Parameters<typeof services.preferences.update>[0])=>{void perform(()=>services.preferences.update(patch));};
  async function importImage(slot:VisualSlot){await perform(async()=>{const result=await DocumentPicker.getDocumentAsync({type:'image/*',copyToCacheDirectory:true});if(result.canceled)return;const asset=result.assets[0]!;try{await services.visualAssets.import(slot,asset.uri,asset.name);setMessage(slot==='background'?'主题背景图片已保存':'写真图片已保存');}finally{if(asset.uri.startsWith(Paths.cache.uri)){try{const file=new File(asset.uri);if(file.exists)file.delete();}catch{}}}},'系统文件选择或复制失败，请重新选择图片。[V01] 之前的数据保留。');}
  const percent=(next:number)=>`${Math.round(next*100)}%`;
  const sliderTicks:Partial<Record<'backgroundOpacity'|'cardOpacity'|'backgroundMask'|'playerBlur'|'playerDarkness'|'coverRadius',number>>={backgroundOpacity:17,cardOpacity:41,backgroundMask:18,playerBlur:41};
  const adjust=(field:'backgroundOpacity'|'cardOpacity'|'backgroundMask'|'playerBlur'|'playerDarkness'|'coverRadius',label:string,step:number,min:number,max:number)=><SliderControl testID={field} label={label} value={value[field]} min={min} max={max} step={step} tickCount={sliderTicks[field]??41} disabled={busy} stacked={stacked} format={field==='playerBlur'||field==='coverRadius'?undefined:percent} onChange={next=>update({[field]:next})}/>;
  const remove=(slot:VisualSlot)=>Alert.alert('移除此图片？','仅删除音枢保存的副本，系统文件中的原图保留。',[{text:'取消',style:'cancel'},{text:'移除',style:'destructive',onPress:()=>{void perform(()=>services.visualAssets.remove(slot));}}]);
  const darkMode=theme.mode==='dark',ink=settingsInk[theme.mode],muted=settingsMuted[theme.mode],legend=settingsLegend[theme.mode],cardAlpha=darkMode?0.07:Math.max(0.04,Math.min(0.3,value.cardOpacity*0.3)),card=`rgba(255,255,255,${cardAlpha})`,outline=darkMode?'rgba(255,255,255,0.35)':'rgba(60,60,67,0.62)';
  const maskColors=[['#FFFFFF','白色'],['#000000','黑色'],['#2A241F','暖褐']] as const;
  const row=(key:string,index:number,children:React.ReactNode,style?:{paddingTop:number;paddingBottom:number})=><View key={key} style={[{paddingVertical:16,borderBottomWidth:index<4?StyleSheet.hairlineWidth:0,borderBottomColor:s.hairline},style]}>{children}</View>;
  const maskField=<View style={{height:56,borderWidth:1,borderColor:outline,borderRadius:7,paddingLeft:13,paddingRight:0,flexDirection:'row',alignItems:'center',gap:19}}>
    <View style={{position:'absolute',top:-8,left:11,paddingHorizontal:4,backgroundColor:darkMode?theme.palette.background[1]:settingsSheet.maskBackdrop}}><Text style={{color:legend,fontSize:12}}>遮罩颜色</Text></View>
    <View style={{width:20,height:20,borderRadius:10,backgroundColor:value.maskColor,borderWidth:1,borderColor:'rgba(0,0,0,0.22)'}}/>
    <Text testID="visual-value-maskColor" style={{flex:1,color:ink,fontSize:16,letterSpacing:0.9,fontVariant:['tabular-nums']}}>{value.maskColor.toUpperCase()}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="选择遮罩颜色" disabled={busy} onPress={()=>Alert.alert('遮罩颜色','选择播放背景遮罩颜色。',[...maskColors.map(([color,label])=>({text:label,onPress:()=>update({maskColor:color})})),{text:'取消',style:'cancel' as const}])} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="color-filter-outline" size={21} color={legend}/></Pressable>
  </View>;

  const divider=<View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:52,backgroundColor:s.hairline}}/>;
  const switchRow=(id:string,icon:React.ComponentProps<typeof Ionicons>['name'],label:string,subtitle:string,on:boolean,action:(next:boolean)=>void)=><View style={{paddingHorizontal:16,paddingVertical:13,flexDirection:'row',alignItems:'center',gap:12}}>
    <View style={{width:26,alignItems:'center'}}><Ionicons name={icon} size={19} color={s.ink}/></View>
    <View style={{flex:1,gap:2}}>
      <Text style={{color:s.ink,fontSize:15,fontWeight:'700'}}>{label}</Text>
      <Text style={{color:s.muted,fontSize:12,lineHeight:17}}>{subtitle}</Text>
    </View>
    <Switch testID={id} accessibilityLabel={label} value={on} disabled={busy} onValueChange={action} trackColor={s.switchTrack} thumbColor={s.switchThumb(on)}/>
  </View>;

  const actionPill=(id:string,label:string,icon:React.ComponentProps<typeof Ionicons>['name'],action:()=>void,destructive=false)=><Pressable key={id} testID={id} accessibilityRole="button" accessibilityLabel={label} disabled={busy} onPress={action} style={{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,minHeight:38,borderRadius:19,backgroundColor:destructive?(s.dark?'rgba(255,107,129,0.14)':'rgba(217,67,85,0.09)'):s.chip,borderWidth:1,borderColor:destructive?s.accent+'44':s.chipBorder,opacity:busy?.5:1}}>
    <Ionicons name={icon} size={15} color={destructive?s.accent:s.ink}/>
    <Text style={{color:destructive?s.accent:s.ink,fontSize:13,fontWeight:'600'}}>{label}</Text>
  </Pressable>;

  return <View style={{gap:16,paddingTop:11.5,paddingBottom:12}}>
    {/* Primary visual sliders card */}
    <View style={{paddingTop:2,gap:7.4}}>
      <Text accessibilityRole="header" style={{color:muted,fontSize:13,marginLeft:4,letterSpacing:0.4}}>视觉参数</Text>
      <View style={[{borderRadius:20,backgroundColor:card,borderWidth:1,borderColor:s.cardBorder,paddingHorizontal:16},s.cardShadow]}>
        {row('backgroundOpacity',0,adjust('backgroundOpacity','背景透明度',.1,0,1))}
        {row('cardOpacity',1,adjust('cardOpacity','卡片透明度',.1,0,1))}
        {row('backgroundMask',2,adjust('backgroundMask','背景遮罩',.1,0,1))}
        {row('maskColor',3,maskField,{paddingTop:14.5,paddingBottom:17.5})}
        <View style={{paddingTop:10.7,paddingBottom:16}}>{adjust('playerBlur','背景模糊',10,0,80)}</View>
      </View>
    </View>

    {/* Polished grouped card: 自定义背景与写真图片 */}
    <View style={{gap:8,marginTop:8}}>
      <Text accessibilityRole="header" style={{color:muted,fontSize:13,fontWeight:'500',marginLeft:6}}>自定义背景与写真</Text>
      <View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,padding:16,gap:14},s.cardShadow]}>
        <Text style={{color:s.muted,fontSize:12,lineHeight:18}}>图片仅保存在本机（支持 JPEG / PNG / HEIC，最大 20 MiB），自动缩放并去除原图元数据，不参与云备份。</Text>
        <View style={{gap:10}}>
          <VisualPreview testID="visual-background-preview" uri={background} blur={0} opacity={value.backgroundOpacity}>
            <Text style={{color:'#FFFFFF',fontSize:14,fontWeight:'700'}}>主题背景预览</Text>
            <Text testID="visual-background-name" style={{color:'rgba(255,255,255,0.82)',fontSize:12,marginTop:4}}>{assets.background?.name??'尚未导入主题背景'}</Text>
          </VisualPreview>
          <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
            {actionPill('visual-import-background','导入主题背景图片','image-outline',()=>{void importImage('background');})}
            {assets.background&&actionPill('visual-remove-background','移除主题背景图片','trash-outline',()=>remove('background'),true)}
          </View>
        </View>
        <View accessible={false} style={{height:StyleSheet.hairlineWidth,backgroundColor:s.hairline}}/>
        <View style={{gap:10}}>
          <VisualPreview testID="visual-photo-preview" uri={photo} blur={value.playerBlur} opacity={1-value.playerDarkness}>
            <Text style={{color:'#FFFFFF',fontSize:14,fontWeight:'700'}}>播放写真预览</Text>
            <Text testID="visual-photo-name" style={{color:'rgba(255,255,255,0.82)',fontSize:12,marginTop:4}}>{assets.photo?.name??'尚未导入写真图片'}</Text>
          </VisualPreview>
          <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
            {actionPill('visual-import-photo','导入写真图片','images-outline',()=>{void importImage('photo');})}
            {assets.photo&&actionPill('visual-remove-photo','移除写真图片','trash-outline',()=>remove('photo'),true)}
          </View>
        </View>
      </View>
    </View>

    {/* Polished grouped card: 播放背景来源、暗度与圆角 */}
    <View style={{gap:8}}>
      <Text accessibilityRole="header" style={{color:muted,fontSize:13,fontWeight:'500',marginLeft:6}}>播放背景与封面</Text>
      <View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'},s.cardShadow]}>
        <View style={{padding:16,gap:10}}>
          <Text style={{color:s.ink,fontSize:14.5,fontWeight:'700'}}>播放页背景来源</Text>
          <View style={{flexDirection:'row',padding:3,borderRadius:16,backgroundColor:s.dark?'rgba(255,255,255,0.06)':'rgba(42,36,31,0.05)',gap:4}}>
            {([['artwork','歌曲封面'],['photo','自定义写真'],['solid','纯色背景']] as const).map(([mode,label])=>{
              const selected=value.playerBackground===mode;
              return <Pressable key={mode} testID={`player-background-${mode}`} accessibilityRole="radio" accessibilityLabel={`${label}背景`} accessibilityState={{selected}} disabled={busy} onPress={()=>update({playerBackground:mode})} style={{flex:1,minHeight:36,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:selected?s.control:'transparent'}}>
                <Text numberOfLines={1} style={{color:selected?'#FFFFFF':s.ink,fontSize:12.5,fontWeight:selected?'700':'500'}}>{label}</Text>
              </Pressable>;
            })}
          </View>
          <Text style={{color:s.muted,fontSize:11.5,lineHeight:17}}>写真皮肤优先显示已导入写真；其他皮肤遵循上方选项，模糊仅作用于背景层。</Text>
        </View>
        <View accessible={false} style={{height:StyleSheet.hairlineWidth,marginHorizontal:16,backgroundColor:s.hairline}}/>
        <View style={{paddingHorizontal:16,paddingVertical:14}}>{adjust('playerDarkness','播放背景暗度',.1,.35,.9)}</View>
        <View accessible={false} style={{height:StyleSheet.hairlineWidth,marginHorizontal:16,backgroundColor:s.hairline}}/>
        <View style={{paddingHorizontal:16,paddingVertical:14}}>{adjust('coverRadius','封面圆角',8,0,48)}</View>
      </View>
    </View>

    {/* Polished grouped card: 动效与磁带装饰开关 */}
    <View style={{gap:8}}>
      <Text accessibilityRole="header" style={{color:muted,fontSize:13,fontWeight:'500',marginLeft:6}}>取色与动态效果</Text>
      <View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'},s.cardShadow]}>
        {switchRow('visual-tape-style','radio-outline','磁带封面','为经典、沉浸、声波核与 AM 系列主封面追加磁带框，列表缩略图保持简洁',value.tapeStyle,tapeStyle=>update({tapeStyle}))}
        {divider}
        {switchRow('visual-cover-color','color-filter-outline','封面取色','提取当前播放歌曲封面主色并应用至全局氛围',value.coverColor,coverColor=>update({coverColor}))}
        {divider}
        {switchRow('visual-global-motion','sparkles-outline','全局封面流动','独立开启全局封面流动背景，关闭后恢复取色或主题背景',value.globalBackgroundMotion,globalBackgroundMotion=>update({globalBackgroundMotion}))}
        {divider}
        {switchRow('visual-motion','pulse-outline','播放页背景动效','在暂停、缓冲、后台或系统减少动态效果时自动停止以省电',value.dynamicBackground,dynamicBackground=>update({dynamicBackground}))}
      </View>
    </View>

    {!!message&&<Text testID="visual-status" accessibilityLiveRegion="polite" style={{color:s.accent,fontSize:13,paddingHorizontal:6}}>{message}</Text>}
  </View>;
}
