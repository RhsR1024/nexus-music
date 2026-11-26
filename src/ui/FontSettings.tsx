import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {useState,useSyncExternalStore} from 'react';
import {Alert,Pressable,StyleSheet,Switch,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
import type {Services} from '../app/services.ts';
import {effectiveLyricFont} from '../storage/fontCatalog.ts';
import {lyricStyleDefaults,type LyricStyle} from '../lyrics/settings.ts';
export type FontSection='global'|'lyric'|'display';
const secondaryScales=[0.8,0.9,1,1.15,1.3] as const;
export function FontSettings({services,section,onOpen}:{services:Services;section?:FontSection;onOpen?:(section:FontSection)=>void}){
  const [localSection,setLocalSection]=useState<FontSection>('display'),mode=section??localSection,open=onOpen??setLocalSection;
  const theme=useTheme(),p=theme.palette,s=sollinTokens(theme.mode,p.accent,theme.appearance);
  const fonts=useSyncExternalStore(services.fonts.subscribe,services.fonts.getSnapshot),preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[colors,setColors]=useState({activeColor:'',inactiveColor:''});
  async function perform(run:()=>Promise<void>){setBusy(true);setMessage('');try{await run();}catch(error){setMessage(error instanceof Error?error.message:'字体操作失败');}finally{setBusy(false);}}
  const button=(label:string,action:()=>void,id?:string,selected?:boolean)=><Pressable testID={id} accessibilityRole="button" accessibilityState={{selected,disabled:busy}} disabled={busy} onPress={action} style={{paddingHorizontal:13,paddingVertical:8,minHeight:38,backgroundColor:selected?s.control:s.chip,borderWidth:1,borderColor:selected?s.control:s.chipBorder,borderRadius:19,justifyContent:'center',opacity:busy?.5:1}}><Text style={{color:selected?'#FFFFFF':s.ink,fontSize:13,fontWeight:selected?'700':'600'}}>{label}{selected?' ✓':''}</Text></Pressable>;
  const update=(patch:Partial<LyricStyle>)=>{void perform(()=>services.preferences.updateLyricStyle(patch));};
  const name=(id:string|null|undefined)=>fonts.fonts.find(item=>item.id===id)?.name??'系统字体';
  const change=(field:'lineHeight'|'spacing'|'blur',step:number)=>{void perform(()=>services.preferences.adjustLyricStyle(field,step));};
  const showTranslation=preferences.lyricStyle.showTranslation!==false;
  const showRomanization=preferences.lyricStyle.showRomanization!==false;
  const secondaryScale=preferences.lyricStyle.secondaryScale??1;
  const divider=<View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:16,backgroundColor:s.hairline}}/>;
  return <View style={{gap:14,marginVertical:14}}>
    <View style={[{padding:14,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:8},s.cardShadow]}>
      <Text accessibilityRole="header" style={{fontSize:16,fontWeight:'700',color:s.ink}}>{{global:'全局字体',lyric:'歌词字体',display:'歌词样式'}[mode]}</Text>
      <Text testID="font-global-status" style={{color:s.muted,fontSize:13}}>全局字体：{name(fonts.global)}</Text>
      <Text testID="font-lyric-status" style={{color:s.muted,fontSize:13}}>歌词字体：{fonts.lyricMode==='inherit'?'跟随全局 · ':''}{name(effectiveLyricFont(fonts))}</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:2}}>{(['global','lyric','display'] as const).filter(value=>value!==mode).map(value=><View key={value}>{button({global:'设置全局字体',lyric:'设置歌词字体',display:'歌词显示设置'}[value],()=>open(value),'font-open-'+value)}</View>)}</View>
    </View>
    {mode!=='display'&&<>
      <Text style={{color:s.muted,fontSize:13,lineHeight:20,paddingHorizontal:4}}>{mode==='global'?'应用到软件界面中的普通文字；已单独设置的歌词字体会保留。':'统一应用到所有播放界面的歌词。选择跟随全局字体时，歌词会随全局字体一起变化。'}</Text>
      <View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'},s.cardShadow]}>
        {mode==='global'&&<Pressable testID="font-global-system" accessibilityRole="button" accessibilityState={{selected:!fonts.global,disabled:busy}} disabled={busy} onPress={()=>{void perform(()=>services.fonts.selectGlobal(null));}} style={{minHeight:58,paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}>
          <View style={{flex:1,gap:2}}><Text style={{color:!fonts.global?s.accent:s.ink,fontSize:15.5,fontWeight:'700'}}>全局使用系统字体</Text><Text style={{color:s.muted,fontSize:12}}>跟随 iOS / 系统默认字体</Text></View>
          {!fonts.global&&<Ionicons name="checkmark" size={20} color={s.accent}/>}
        </Pressable>}
        {mode==='lyric'&&<>
          <Pressable testID="font-lyrics-inherit" accessibilityRole="button" accessibilityState={{selected:fonts.lyricMode==='inherit',disabled:busy}} disabled={busy} onPress={()=>{void perform(()=>services.fonts.followGlobal());}} style={{minHeight:58,paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}>
            <View style={{flex:1,gap:2}}><Text style={{color:fonts.lyricMode==='inherit'?s.accent:s.ink,fontSize:15.5,fontWeight:'700'}}>歌词跟随全局字体</Text><Text style={{color:s.muted,fontSize:12}}>当前为 {name(fonts.global)}</Text></View>
            {fonts.lyricMode==='inherit'&&<Ionicons name="checkmark" size={20} color={s.accent}/>}
          </Pressable>
          {divider}
          <Pressable testID="font-lyrics-system" accessibilityRole="button" accessibilityState={{selected:fonts.lyricMode==='system',disabled:busy}} disabled={busy} onPress={()=>{void perform(()=>services.fonts.select(null));}} style={{minHeight:58,paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12}}>
            <View style={{flex:1,gap:2}}><Text style={{color:fonts.lyricMode==='system'?s.accent:s.ink,fontSize:15.5,fontWeight:'700'}}>歌词使用系统字体</Text><Text style={{color:s.muted,fontSize:12}}>仅歌词区域使用系统默认字体</Text></View>
            {fonts.lyricMode==='system'&&<Ionicons name="checkmark" size={20} color={s.accent}/>}
          </Pressable>
        </>}
      </View>
      <Text accessibilityRole="header" style={{color:s.muted,fontSize:13,fontWeight:'500',marginLeft:6,marginBottom:-6}}>已导入字体</Text>
      {!fonts.fonts.length&&<View style={[{padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder},s.cardShadow]}><Text style={{color:s.muted,fontSize:14}}>暂未导入字体</Text></View>}
      {fonts.fonts.map(item=><View key={item.id} style={[{gap:10,padding:14,borderWidth:1,borderColor:s.cardBorder,borderRadius:20,backgroundColor:s.card},s.cardShadow]}>
        <Text style={{color:s.ink,fontFamily:fonts.global===item.id||fonts.selected===item.id?item.id:undefined,fontSize:21}}>Aa 音枢 · {item.name}</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{mode==='global'&&button(`设为全局：${item.name}`,()=>{void perform(()=>services.fonts.selectGlobal(item.id));},'font-global-'+item.id,fonts.global===item.id)}{mode==='lyric'&&button(`设为歌词：${item.name}`,()=>{void perform(()=>services.fonts.select(item.id));},'font-lyrics-'+item.id,fonts.lyricMode==='custom'&&fonts.selected===item.id)}
        {button(`删除字体：${item.name}`,()=>Alert.alert('删除导入字体？','使用此字体的选择会回退，歌词优先跟随全局字体。',[{text:'取消',style:'cancel'},{text:'删除',style:'destructive',onPress:()=>{void perform(()=>services.fonts.remove(item.id));}}]),'font-delete-'+item.id)}</View>
      </View>)}
      <Pressable testID="font-import" accessibilityRole="button" accessibilityState={{disabled:busy}} disabled={busy} onPress={()=>{void perform(async()=>{const result=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true});if(result.canceled)return;const asset=result.assets[0]!;try{await services.fonts.import(asset.uri,asset.name);}finally{try{const file=new File(asset.uri);if(file.exists)file.delete();}catch{/* A failed temporary-file cleanup must not misreport a saved font. */}}});}} style={{minHeight:48,paddingHorizontal:16,borderRadius:24,borderWidth:1,borderColor:s.control,backgroundColor:s.card,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,opacity:busy?.5:1}}>
        <Ionicons name="download-outline" size={18} color={s.control}/>
        <Text style={{color:s.control,fontSize:14.5,fontWeight:'600'}}>导入TTF / OTF字体</Text>
      </Pressable>
    </>}
    {mode==='display'&&<>
      <View style={[{padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:6},s.cardShadow]}>
        <Text style={{color:s.muted,fontSize:12}}>实时歌词效果预览</Text>
        <Text style={{fontSize:Math.round(22*preferences.fontScale),color:preferences.lyricStyle.activeColor==='auto'?s.accent:preferences.lyricStyle.activeColor,fontFamily:effectiveLyricFont(fonts)??undefined,fontWeight:'700',lineHeight:Math.ceil(22*preferences.fontScale*preferences.lyricStyle.lineHeight),textAlign:preferences.lyricAlignment==='center'?'center':'left'}}>Aa 音乐让此刻更动听</Text>
        {showTranslation&&<Text style={{fontSize:Math.round(14*secondaryScale),color:preferences.lyricStyle.inactiveColor==='auto'?s.muted:preferences.lyricStyle.inactiveColor,fontFamily:effectiveLyricFont(fonts)??undefined,textAlign:preferences.lyricAlignment==='center'?'center':'left'}}>Music makes this moment resonate</Text>}
        {showRomanization&&<Text style={{fontSize:Math.round(12.5*secondaryScale),color:s.subtle,fontFamily:effectiveLyricFont(fonts)??undefined,textAlign:preferences.lyricAlignment==='center'?'center':'left'}}>yīn yuè ràng cǐ kè gèng dòng tīng</Text>}
      </View>
      <View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'},s.cardShadow]}>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,paddingHorizontal:16,paddingVertical:13}}>
          <View style={{flex:1,gap:2}}>
            <Text style={{color:s.ink,fontSize:15.5,fontWeight:'700'}}>显示翻译歌词</Text>
            <Text style={{color:s.muted,fontSize:12,lineHeight:17}}>歌词包含中文译文时在原词下方同步展示</Text>
          </View>
          <Switch testID="lyric-show-translation" accessibilityLabel="显示翻译歌词" value={showTranslation} onValueChange={next=>update({showTranslation:next})} trackColor={s.switchTrack} thumbColor={s.switchThumb(showTranslation)}/>
        </View>
        {divider}
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,paddingHorizontal:16,paddingVertical:13}}>
          <View style={{flex:1,gap:2}}>
            <Text style={{color:s.ink,fontSize:15.5,fontWeight:'700'}}>显示罗马音 / 音译歌词</Text>
            <Text style={{color:s.muted,fontSize:12,lineHeight:17}}>歌曲提供罗马音或音译轨时辅助跟唱</Text>
          </View>
          <Switch testID="lyric-show-romanization" accessibilityLabel="显示罗马音/音译歌词" value={showRomanization} onValueChange={next=>update({showRomanization:next})} trackColor={s.switchTrack} thumbColor={s.switchThumb(showRomanization)}/>
        </View>
        {divider}
        <View style={{paddingHorizontal:16,paddingVertical:13,gap:8}}>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
            <Text style={{color:s.ink,fontSize:15.5,fontWeight:'700'}}>副歌词字号比例</Text>
            <Text testID="lyric-secondary-scale-value" style={{color:s.control,fontSize:13,fontWeight:'700'}}>{secondaryScale.toFixed(secondaryScale===1||secondaryScale===0.8||secondaryScale===0.9||secondaryScale===1.3?1:2)}x</Text>
          </View>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
            {secondaryScales.map(scale=>{
              const active=Math.abs(secondaryScale-scale)<0.01;
              const label=`${scale===1?'1.0':scale}x`;
              return <Pressable key={scale} testID={`lyric-secondary-scale-${scale}`} accessibilityRole="radio" accessibilityLabel={`副歌词字号 ${label}`} accessibilityState={{selected:active,disabled:busy}} disabled={busy} onPress={()=>update({secondaryScale:scale})} style={{paddingHorizontal:12,paddingVertical:7,minHeight:36,borderRadius:18,backgroundColor:active?s.control:s.chip,borderWidth:1,borderColor:active?s.control:s.chipBorder,justifyContent:'center'}}><Text style={{color:active?'#FFFFFF':s.ink,fontSize:13,fontWeight:active?'700':'500'}}>{label}</Text></Pressable>;
            })}
          </View>
        </View>
      </View>
      <View style={[{padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:12},s.cardShadow]}>
        <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:10}}>
          <Text style={{color:s.ink,fontSize:15,fontWeight:'700',marginRight:4}}>字号缩放</Text>
          {button('字号−',()=>{void perform(()=>services.preferences.update({fontScale:Math.max(.7,Math.round((preferences.fontScale-.1)*10)/10)}));})}
          <Text style={{color:s.control,fontSize:14,fontWeight:'700',minWidth:46,textAlign:'center'}}>{Math.round(preferences.fontScale*100)}%</Text>
          {button('字号＋',()=>{void perform(()=>services.preferences.update({fontScale:Math.min(2,Math.round((preferences.fontScale+.1)*10)/10)}));})}
        </View>
        <View style={{height:StyleSheet.hairlineWidth,backgroundColor:s.hairline}}/>
        <View style={{gap:8}}>
          <Text style={{color:s.muted,fontSize:12.5,fontWeight:'600'}}>歌词对齐</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(['auto','left','center'] as const).map(value=><View key={value}>{button({auto:'跟随皮肤',left:'左对齐',center:'居中'}[value],()=>{void perform(()=>services.preferences.update({lyricAlignment:value}));},'lyric-align-'+value,preferences.lyricAlignment===value)}</View>)}</View>
        </View>
        <View style={{height:StyleSheet.hairlineWidth,backgroundColor:s.hairline}}/>
        {([['lineHeight','行高倍数',.1],['spacing','行间距',2],['blur','其他行模糊',1]] as const).map(([field,label,step])=><View key={field} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
          <Text testID={'lyric-style-'+field} style={{color:s.ink,fontSize:14,fontWeight:'600'}}>{label}：{preferences.lyricStyle[field]}</Text>
          <View style={{flexDirection:'row',gap:8}}>{button(label+'−',()=>change(field,-step))}{button(label+'＋',()=>change(field,step))}</View>
        </View>)}
        <View style={{height:StyleSheet.hairlineWidth,backgroundColor:s.hairline}}/>
        {button(preferences.lyricStyle.emphasis?'逐字强调：开':'逐字强调：关',()=>update({emphasis:!preferences.lyricStyle.emphasis}),'lyric-emphasis')}
      </View>
      <View style={[{padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:14},s.cardShadow]}>
        {(['activeColor','inactiveColor'] as const).map((field,idx)=><View key={field} style={{gap:8,paddingTop:idx===1?10:0,borderTopWidth:idx===1?StyleSheet.hairlineWidth:0,borderTopColor:s.hairline}}>
          <Text style={{color:s.ink,fontSize:14.5,fontWeight:'700'}}>{field==='activeColor'?'当前行颜色':'其他行颜色'}</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(['auto','#FFFFFF','#FFD7A0','#A8D8FF','#F5A9CC'] as const).map((color,index)=><View key={color}>{button(['跟随主题','白色','暖金','浅蓝','粉色'][index]!,()=>update({[field]:color}),`lyric-${field}-${index}`,preferences.lyricStyle[field]===color)}</View>)}</View>
          <View style={{flexDirection:'row',gap:8,alignItems:'center'}}>
            <TextInput accessibilityLabel={field==='activeColor'?'当前行自定颜色':'其他行自定颜色'} placeholder="#RRGGBB" placeholderTextColor={s.subtle} autoCapitalize="characters" autoCorrect={false} maxLength={7} value={colors[field]} onChangeText={text=>setColors(value=>({...value,[field]:text}))} onSubmitEditing={()=>update({[field]:colors[field].trim()})} style={{flex:1,color:s.ink,backgroundColor:s.inputBg,borderWidth:1,borderColor:s.cardBorder,borderRadius:14,paddingHorizontal:12,paddingVertical:10,fontSize:13.5}}/>
            {button(field==='activeColor'?'应用当前行自定颜色':'应用其他行自定颜色',()=>update({[field]:colors[field].trim()}))}
          </View>
        </View>)}
      </View>
      {button('恢复默认歌词样式',()=>{void perform(()=>services.preferences.update({lyricStyle:lyricStyleDefaults,fontScale:1,lyricAlignment:'auto'}));},'lyric-style-reset')}
    </>}
    {!!message&&<Text accessibilityRole="alert" style={{color:s.accent,marginLeft:4}}>{message}</Text>}
  </View>;
}
