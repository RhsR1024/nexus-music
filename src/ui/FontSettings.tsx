import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {useState,useSyncExternalStore} from 'react';
import {Alert,Pressable,View} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
import type {Services} from '../app/services.ts';
import {effectiveLyricFont} from '../storage/fontCatalog.ts';
import {lyricStyleDefaults,type LyricStyle} from '../lyrics/settings.ts';
export function FontSettings({services}:{services:Services}){
  const theme=useTheme(),p=theme.palette;
  const fonts=useSyncExternalStore(services.fonts.subscribe,services.fonts.getSnapshot),preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[colors,setColors]=useState({activeColor:'',inactiveColor:''});
  async function perform(run:()=>Promise<void>){setBusy(true);setMessage('');try{await run();}catch(error){setMessage(error instanceof Error?error.message:'字体操作失败');}finally{setBusy(false);}}
  const button=(label:string,action:()=>void,id?:string,selected?:boolean)=><Pressable testID={id} accessibilityRole="button" accessibilityState={{selected,disabled:busy}} disabled={busy} onPress={action} style={{padding:12,minHeight:44,backgroundColor:selected?p.selected:p.surface,borderRadius:10}}><Text style={{color:p.accent}}>{label}{selected?' ✓':''}</Text></Pressable>;
  const update=(patch:Partial<LyricStyle>)=>{void perform(()=>services.preferences.updateLyricStyle(patch));};
  const name=(id:string|null|undefined)=>fonts.fonts.find(item=>item.id===id)?.name??'系统字体';
  const change=(field:'lineHeight'|'spacing'|'blur',step:number)=>{void perform(()=>services.preferences.adjustLyricStyle(field,step));};
  return <View style={{gap:12,marginVertical:24}}><Text accessibilityRole="header" style={{fontSize:18,color:p.text}}>字体与歌词样式</Text>
    {button('导入TTF / OTF字体',()=>{void perform(async()=>{const result=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true});if(result.canceled)return;const asset=result.assets[0]!;try{await services.fonts.import(asset.uri,asset.name);}finally{try{const file=new File(asset.uri);if(file.exists)file.delete();}catch{/* A failed temporary-file cleanup must not misreport a saved font. */}}});},'font-import')}
    <Text testID="font-global-status" style={{color:p.secondary}}>全局字体：{name(fonts.global)}</Text>
    {button('全局使用系统字体',()=>{void perform(()=>services.fonts.selectGlobal(null));},'font-global-system',!fonts.global)}
    <Text testID="font-lyric-status" style={{color:p.secondary}}>歌词字体：{fonts.lyricMode==='inherit'?'跟随全局 · ':''}{name(effectiveLyricFont(fonts))}</Text>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{button('歌词跟随全局字体',()=>{void perform(()=>services.fonts.followGlobal());},'font-lyrics-inherit',fonts.lyricMode==='inherit')}{button('歌词使用系统字体',()=>{void perform(()=>services.fonts.select(null));},'font-lyrics-system',fonts.lyricMode==='system')}</View>
    {fonts.fonts.map(item=><View key={item.id} style={{gap:8,padding:12,borderWidth:1,borderColor:p.border,borderRadius:12}}>
      <Text style={{color:p.text,fontFamily:fonts.global===item.id||fonts.selected===item.id?item.id:undefined,fontSize:22}}>Aa 音枢 · {item.name}</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{button(`设为全局：${item.name}`,()=>{void perform(()=>services.fonts.selectGlobal(item.id));},'font-global-'+item.id,fonts.global===item.id)}{button(`设为歌词：${item.name}`,()=>{void perform(()=>services.fonts.select(item.id));},'font-lyrics-'+item.id,fonts.lyricMode==='custom'&&fonts.selected===item.id)}
      {button(`删除字体：${item.name}`,()=>Alert.alert('删除导入字体？','使用此字体的选择会回退，歌词优先跟随全局字体。',[{text:'取消',style:'cancel'},{text:'删除',style:'destructive',onPress:()=>{void perform(()=>services.fonts.remove(item.id));}}]),'font-delete-'+item.id)}</View>
    </View>)}
    <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:12}}>{button('字号−',()=>{void perform(()=>services.preferences.update({fontScale:Math.max(.7,Math.round((preferences.fontScale-.1)*10)/10)}));})}<Text style={{color:p.secondary}}>{Math.round(preferences.fontScale*100)}%</Text>{button('字号＋',()=>{void perform(()=>services.preferences.update({fontScale:Math.min(2,Math.round((preferences.fontScale+.1)*10)/10)}));})}</View>
    <Text style={{color:p.secondary}}>歌词对齐</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(['auto','left','center'] as const).map(value=><View key={value}>{button({auto:'跟随皮肤',left:'左对齐',center:'居中'}[value],()=>{void perform(()=>services.preferences.update({lyricAlignment:value}));},'lyric-align-'+value,preferences.lyricAlignment===value)}</View>)}</View>
    {(['activeColor','inactiveColor'] as const).map(field=><View key={field} style={{gap:8}}><Text style={{color:p.secondary}}>{field==='activeColor'?'当前行颜色':'其他行颜色'}</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(['auto','#FFFFFF','#FFD7A0','#A8D8FF','#F5A9CC'] as const).map((color,index)=><View key={color}>{button(['跟随主题','白色','暖金','浅蓝','粉色'][index]!,()=>update({[field]:color}),`lyric-${field}-${index}`,preferences.lyricStyle[field]===color)}</View>)}</View><TextInput accessibilityLabel={field==='activeColor'?'当前行自定颜色':'其他行自定颜色'} placeholder="#RRGGBB" placeholderTextColor={p.secondary} autoCapitalize="characters" autoCorrect={false} maxLength={7} value={colors[field]} onChangeText={text=>setColors(value=>({...value,[field]:text}))} onSubmitEditing={()=>update({[field]:colors[field].trim()})} style={{color:p.text,borderWidth:1,borderColor:p.border,borderRadius:10,padding:12}}/>{button(field==='activeColor'?'应用当前行自定颜色':'应用其他行自定颜色',()=>update({[field]:colors[field].trim()}))}</View>)}
    {([['lineHeight','行高倍数',.1],['spacing','行间距',2],['blur','其他行模糊',1]] as const).map(([field,label,step])=><View key={field} style={{gap:8}}><Text testID={'lyric-style-'+field} style={{color:p.secondary}}>{label}：{preferences.lyricStyle[field]}</Text><View style={{flexDirection:'row',gap:12}}>{button(label+'−',()=>change(field,-step))}{button(label+'＋',()=>change(field,step))}</View></View>)}
    {button(preferences.lyricStyle.emphasis?'逐字强调：开':'逐字强调：关',()=>update({emphasis:!preferences.lyricStyle.emphasis}),'lyric-emphasis')}
    <Text style={{fontSize:24,color:preferences.lyricStyle.activeColor==='auto'?p.accent:preferences.lyricStyle.activeColor,fontFamily:effectiveLyricFont(fonts)??'System',lineHeight:Math.ceil(24*preferences.lyricStyle.lineHeight)}}>Aa 音乐让此刻更动听</Text>
    {button('恢复默认歌词样式',()=>{void perform(()=>services.preferences.update({lyricStyle:lyricStyleDefaults,fontScale:1,lyricAlignment:'auto'}));},'lyric-style-reset')}
    {!!message&&<Text accessibilityRole="alert" style={{color:p.accent}}>{message}</Text>}
  </View>;
}
