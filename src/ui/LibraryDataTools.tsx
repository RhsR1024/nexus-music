import {Text} from './Typography.tsx';
import {useState} from 'react';
import {Alert,Pressable,StyleSheet,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {shareLocalFile} from '../storage/shareLocalFiles.ts';
import * as DocumentPicker from 'expo-document-picker';
import {File,Paths} from 'expo-file-system';
import type {Services} from '../app/services.ts';
import {decodeBackup} from '../storage/backup.ts';
import {decodePlaylistJSON,encodePlaylistJSON,type PlaylistCollection} from '../storage/playlistJSON.ts';
import {decodeWayfarer} from '../storage/wayfarer.ts';
import {decodeImportText} from '../providers/nativeLX.ts';
import {CloudBackup} from './CloudBackup.tsx';
import {CloudSync} from './CloudSync.tsx';
import {QishuiImport} from './QishuiImport.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {PlaybackStatistics} from './PlaybackStatistics.tsx';
import {StatisticsCloud} from './StatisticsCloud.tsx';

// One implementation shared by the music library and data settings.
export function LibraryDataTools({services,showStatistics=true}:{services:Services;showStatistics?:boolean}){
  const theme=useTheme(),p=theme.palette,s=sollinTokens(theme.mode,p.accent,theme.appearance);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');

  async function perform(run:()=>Promise<void>){setBusy(true);setMessage('');try{await run();}catch{setMessage('操作未确认完成，请核对本机数据与文件后重试');}finally{setBusy(false);}}
  const divider=<View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:62,backgroundColor:s.hairline}}/>;
  const actionRow=(
    title:string,
    subtitle:string,
    icon:React.ComponentProps<typeof Ionicons>['name'],
    action:()=>void,
    options?:{testID?:string;accessibilityLabel?:string;highlight?:boolean},
  )=><Pressable
    testID={options?.testID}
    accessibilityRole="button"
    accessibilityLabel={options?.accessibilityLabel??title}
    disabled={busy}
    accessibilityState={{disabled:busy}}
    onPress={action}
    style={{minHeight:60,paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:12,opacity:busy?.45:1}}
  >
    <View style={{width:34,height:34,borderRadius:10,backgroundColor:options?.highlight?s.accent:s.accentSoft,alignItems:'center',justifyContent:'center'}}>
      <Ionicons name={icon} size={18} color={options?.highlight?'#FFFFFF':s.accent}/>
    </View>
    <View style={{flex:1,minWidth:0,gap:2}}>
      <Text style={{color:s.ink,fontSize:15,fontWeight:'600'}}>{title}</Text>
      <Text numberOfLines={1} style={{color:s.muted,fontSize:12}}>{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={16} color={s.subtle}/>
  </Pressable>;

  async function exportBackup(){const file=new File(Paths.cache,`nexus-music-${Date.now()}.json`);try{file.write(await services.snapshotBackup());await shareLocalFile(file.uri,'音枢音乐库备份');}finally{if(file.exists)file.delete();}}
  async function exportLX(){
    const snapshot=services.library.getSnapshot();
    const collections:PlaylistCollection[]=[];
    if(snapshot.favorites.length>0)collections.push({title:'我喜欢的音乐',tracks:snapshot.favorites});
    for(const playlist of snapshot.playlists){
      collections.push({title:playlist.title,tracks:playlist.entries.map(entry=>entry.track)});
    }
    const payload=encodePlaylistJSON(collections);
    const parsed=JSON.parse(payload) as {data?:unknown[]};
    if(!parsed.data?.length){
      setMessage('当前没有可导出为 LX v2 格式的在线歌曲');
      return;
    }
    const file=new File(Paths.cache,`nexus-lx-playlists-${Date.now()}.json`);
    try{
      file.write(payload);
      await shareLocalFile(file.uri,'导出 LX 歌单 JSON');
      setMessage(`已导出 ${parsed.data.length} 个 LX v2 歌单 JSON`);
    }finally{if(file.exists)file.delete();}
  }
  async function importBackup(){
    const result=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true});if(result.canceled)return;
    const file=new File(result.assets[0]!.uri);
    try{
      if(file.size>32*1024*1024)throw new Error('too large');const backup=decodeBackup(await file.text());
      Alert.alert('恢复音枢备份',`包含 ${backup.library.playlists.length} 个歌单、${backup.library.favorites.length} 首收藏、${backup.library.catalogFavorites?.length??0} 项目录收藏和 ${backup.library.history.length} 条历史。${backup.settings?'包含播放/歌词/EQ和外观设置，将一并恢复。':'此旧备份无设置，保留当前设置。'}确认后替换当前音乐库和本机播放统计，播放队列不变；音频/图片/字体文件和连接凭据留在本机。`,[
        {text:'取消',style:'cancel'},{text:'替换音乐库',style:'destructive',onPress:()=>{void perform(async()=>{await services.restoreBackup(backup.library,backup.statistics!,backup.settings);setMessage('音乐库与播放统计已恢复');});}},
      ]);
    }finally{if(file.exists)file.delete();}
  }
  async function importLX(){
    const result=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true});if(result.canceled)return;
    const asset=result.assets[0]!,file=new File(asset.uri);
    try{
      const plain=/\.json$/i.test(asset.name);if(file.size>(plain?32:8)*1024*1024)throw new Error('文件过大');
      const preview=decodePlaylistJSON(plain?await file.text():await decodeImportText(await file.base64()));
      const count=preview.collections.reduce((sum,item)=>sum+item.tracks.length,0);
      Alert.alert('导入LX歌单',`${preview.collections.length} 个歌单、${count} 首支持的歌曲。另有 ${preview.unsupported} 条来源不在首期范围内，将跳过。保留顺序和重复项，作为新歌单追加；不会导入账号、音源或下载文件。`,[{text:'取消',style:'cancel'},{text:'追加导入',onPress:()=>{void perform(async()=>{await services.library.importCollections(preview.collections);setMessage(`已导入 ${preview.collections.length} 个歌单、${count} 首歌曲`);});}}]);
    }finally{if(file.exists)file.delete();}
  }
  async function importWayfarer(){
    const result=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true});if(result.canceled)return;
    const file=new File(result.assets[0]!.uri);
    try{
      if(file.size>32*1024*1024)throw new Error('文件过大');
      const preview=decodeWayfarer(await file.text()),count=preview.collections.reduce((sum,item)=>sum+item.tracks.length,0);
      Alert.alert('导入漫途备份',`${preview.collections.length} 个歌单、${count} 条歌单歌曲、${preview.favorites.length} 首收藏。${preview.unsupported} 条未支持来源将跳过。\n保留顺序和重复项，作为新歌单追加；收藏去重。忽略 ${preview.ignoredSources} 个连接/音源配置及全部设置，不迁移账号、解析地址或下载文件。`,[{text:'取消',style:'cancel'},{text:'追加导入',onPress:()=>{void perform(async()=>{await services.library.importCollections(preview.collections,preview.favorites);setMessage(`漫途导入完成：${preview.collections.length} 个歌单、${count} 条歌曲`);});}}]);
    }finally{if(file.exists)file.delete();}
  }

  return <View style={{gap:12,marginVertical:8}}>
    {showStatistics&&<>
      <Text accessibilityRole="header" style={{color:s.muted,fontSize:13,fontWeight:'600',marginLeft:6}}>聆听统计</Text>
      <View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'},s.cardShadow]}>
        <PlaybackStatistics services={services} triggerVariant="row"/>
        {divider}
        <StatisticsCloud services={services} grouped/>
      </View>
    </>}
    <Text accessibilityRole="header" style={{color:s.muted,fontSize:13,fontWeight:'600',marginLeft:6,marginTop:showStatistics?4:0}}>备份与云同步</Text>
    <View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'},s.cardShadow]}>
      {actionRow('导出音乐库备份','导出收藏、歌单、统计与偏好为 JSON','share-outline',()=>{void perform(exportBackup);},{highlight:true})}
      {divider}
      {actionRow('恢复音枢备份','从本机备份文件还原音乐库与设置','refresh-outline',()=>{void perform(importBackup);})}
      {divider}
      <CloudBackup services={services} grouped/>
      {divider}
      <CloudSync services={services} grouped/>
      {!showStatistics&&<>
        {divider}
        <StatisticsCloud services={services} grouped/>
      </>}
    </View>
    <Text accessibilityRole="header" style={{color:s.muted,fontSize:13,fontWeight:'600',marginLeft:6,marginTop:4}}>外部歌单导入与导出</Text>
    <View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'},s.cardShadow]}>
      {actionRow('导入 LX 歌单','支持 LX v2 JSON 与 LXMC 文件追加导入','document-text-outline',()=>{void perform(importLX);},{accessibilityLabel:'导入LX v2歌单 JSON / LXMC'})}
      {divider}
      {actionRow('导出 LX 歌单 JSON','将收藏与歌单导出为 LX v2 通用格式','code-download-outline',()=>{void perform(exportLX);},{testID:'library-export-lx-json'})}
      {divider}
      {actionRow('导入漫途备份','兼容漫途版本 1 备份文件追加导入','archive-outline',()=>{void perform(importWayfarer);},{accessibilityLabel:'导入漫途版本1备份'})}
      {divider}
      <QishuiImport services={services} grouped/>
    </View>
    <View style={{flexDirection:'row',alignItems:'flex-start',gap:8,paddingHorizontal:12,paddingVertical:10,borderRadius:14,backgroundColor:s.dark?'rgba(255,255,255,0.035)':'rgba(42,36,31,0.03)'}}>
      <Ionicons name="information-circle-outline" size={15} color={s.subtle} style={{marginTop:1}}/>
      <Text style={{flex:1,color:s.muted,fontSize:11.5,lineHeight:17.5}}>备份包含音乐库、实际播放统计及播放/歌词/EQ/外观设置，不含账号凭据、JS 音源与音频/图片/字体文件；LX 导出仅包含支持的在线歌曲。</Text>
    </View>
    {!!message&&<Text testID="library-data-message" accessibilityLiveRegion="polite" style={{color:s.accent,fontSize:13,marginLeft:6}}>{message}</Text>}
  </View>;
}
