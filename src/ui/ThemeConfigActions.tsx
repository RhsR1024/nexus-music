import {useEffect,useRef,useState} from 'react';
import {Alert,Pressable,Share} from 'react-native';
import {File,Paths} from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {visualThemeLabels} from '../domain/appearance.ts';
import {decodeThemeConfig,encodeThemeConfig,themeConfigLimit} from '../storage/themeConfig.ts';
import {useTheme} from './theme.tsx';

export function ThemeConfigActions({services}:{services:Services}){
  const {palette}=useTheme(),locked=useRef(false),active=useRef(true),[busy,setBusy]=useState(false);
  useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
  const finish=()=>{locked.current=false;if(active.current)setBusy(false);};
  const begin=()=>{if(locked.current)return false;locked.current=true;setBusy(true);return true;};
  const exportTheme=async()=>{
    if(!begin())return;let file:File|undefined;
    try{const text=encodeThemeConfig(services.preferences.getSnapshot());file=new File(Paths.cache,`nexus-theme-${Date.now()}.json`);file.write(text);await Share.share({url:file.uri,title:'音枢主题配置'});}
    catch{if(active.current)Alert.alert('主题配置导出失败','请重试。');}
    finally{try{if(file?.exists)file.delete();}catch{}finish();}
  };
  const importTheme=async()=>{
    if(!begin())return;
    try{
      const picked=await DocumentPicker.getDocumentAsync({type:['application/json','text/plain'],copyToCacheDirectory:true,multiple:false});
      if(picked.canceled||!active.current){finish();return;}
      const asset=picked.assets[0];if(!asset)throw Error();const file=new File(asset.uri);
      if(file.size>themeConfigLimit)throw Error();
      const parsed=decodeThemeConfig(await file.text());if(!active.current){finish();return;}
      const value={...services.preferences.getSnapshot(),...parsed.appearance};
      const summary=parsed.legacy?'旧版配置：仅替换主题、强调色、背景类型和卡片透明度。':`背景 ${Math.round(value.backgroundOpacity*100)}% · 卡片 ${Math.round(value.cardOpacity*100)}%\n遮罩 ${Math.round(value.backgroundMask*100)}% · ${value.maskColor}\n播放器模糊 ${value.playerBlur} · 明暗 ${Math.round(value.playerDarkness*100)}% · 圆角 ${value.coverRadius}\n封面取色${value.coverColor?'开':'关'} · 全局动态${value.globalBackgroundMotion?'开':'关'} · 播放页动态${value.dynamicBackground?'开':'关'}\n底部栏${value.glassNavigation?'玻璃':'实色'} · 播放器背景${{artwork:'封面',solid:'纯色',photo:'写真'}[value.playerBackground]}`;
      let applying=false;
      Alert.alert('导入主题配置',`${visualThemeLabels[value.visualTheme]} · ${{rose:'玫瑰',coral:'珊瑚',purple:'紫色',blue:'蓝色',orange:'橙色'}[value.accent]} · ${{gradient:'渐变',solid:'纯色',image:'图片'}[value.backgroundStyle]}\n${summary}\n\n仅替换主题与背景参数，不影响播放、EQ或音乐库。不含图片和字体文件；图片样式使用本机素材，缺少时显示默认背景。`,[
        {text:'取消',style:'cancel',onPress:finish},
        {text:'应用主题',onPress:()=>{applying=true;void services.preferences.update(parsed.appearance).then(()=>{if(active.current)Alert.alert('主题已导入','主题与背景参数已保存。');}).catch(()=>{if(active.current)Alert.alert('主题未保存','原设置保留，请重试。');}).finally(finish);}},
      ],{cancelable:true,onDismiss:()=>{if(!applying)finish();}});
    }catch{finish();if(active.current)Alert.alert('无法导入主题配置','请选择64KiB以内的音枢主题JSON。原设置保留。');}
  };
  const action=(name:'download-outline'|'folder-open-outline',label:string,run:()=>Promise<void>)=><Pressable testID={name==='download-outline'?'appearance-export-theme':'appearance-import-theme'} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:busy,busy}} disabled={busy} onPress={()=>{void run();}} style={{width:44,height:44,alignItems:'center',justifyContent:'center',opacity:busy?.5:1}}><Ionicons name={name} size={25} color={palette.text}/></Pressable>;
  return <>{action('folder-open-outline','导入主题配置',importTheme)}{action('download-outline','导出主题配置',exportTheme)}</>;
}
