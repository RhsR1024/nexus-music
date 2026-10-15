import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {useState,useSyncExternalStore} from 'react';
import {Alert,Pressable,Text,View} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
import type {Services} from '../app/services.ts';
export function FontSettings({services}:{services:Services}){
  const theme=useTheme();
  const fonts=useSyncExternalStore(services.fonts.subscribe,services.fonts.getSnapshot),preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function perform(run:()=>Promise<void>){setBusy(true);setMessage('');try{await run();}catch(error){setMessage(error instanceof Error?error.message:'字体操作失败');}finally{setBusy(false);}}
  const button=(label:string,action:()=>void)=><Pressable accessibilityRole="button" disabled={busy} onPress={action} style={{padding:12,backgroundColor:theme.color('#303A32'),borderRadius:10}}><Text style={{color:theme.color('#D9F49B')}}>{label}</Text></Pressable>;
  return <View style={{gap:12,marginVertical:24}}><Text style={{fontSize:18,color:theme.color('#ECEBF3')}}>歌词字体与字号</Text>
    {button('导入TTF / OTF字体',()=>{void perform(async()=>{const result=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true});if(result.canceled)return;const asset=result.assets[0]!;try{await services.fonts.import(asset.uri,asset.name);}finally{const file=new File(asset.uri);if(file.exists)file.delete();}});})}
    {button(fonts.selected?'恢复系统字体':'系统字体 · 已选择',()=>{void perform(()=>services.fonts.select(null));})}
    {fonts.fonts.map(item=><View key={item.id} style={{gap:8}}>{button(`${item.name}${fonts.selected===item.id?' · 已选择':''}`,()=>{void perform(()=>services.fonts.select(item.id));})}{button(`删除字体：${item.name}`,()=>Alert.alert('删除导入字体？','歌词恢复为系统字体。',[{text:'取消',style:'cancel'},{text:'删除',style:'destructive',onPress:()=>{void perform(()=>services.fonts.remove(item.id));}}]))}</View>)}
    <View style={{flexDirection:'row',gap:12}}>{button('字号−',()=>{void services.preferences.update({fontScale:Math.max(.7,Math.round((preferences.fontScale-.1)*10)/10)});})}<Text style={{color:theme.color('#BFC8D9')}}>{Math.round(preferences.fontScale*100)}%</Text>{button('字号＋',()=>{void services.preferences.update({fontScale:Math.min(2,Math.round((preferences.fontScale+.1)*10)/10)});})}</View>
    {!!message&&<Text style={{color:theme.color('#D6B69A')}}>{message}</Text>}
  </View>;
}
