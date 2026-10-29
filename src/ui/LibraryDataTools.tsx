import {Text} from './Typography.tsx';
import {useState} from 'react';
import {Alert,Pressable,Share,View} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {File,Paths} from 'expo-file-system';
import type {Services} from '../app/services.ts';
import {decodeBackup} from '../storage/backup.ts';
import {decodePlaylistJSON} from '../storage/playlistJSON.ts';
import {decodeWayfarer} from '../storage/wayfarer.ts';
import {decodeImportText} from '../providers/nativeLX.ts';
import {CloudBackup} from './CloudBackup.tsx';
import {CloudSync} from './CloudSync.tsx';
import {QishuiImport} from './QishuiImport.tsx';
import {useTheme} from './theme.tsx';
import {PlaybackStatistics} from './PlaybackStatistics.tsx';
import {StatisticsCloud} from './StatisticsCloud.tsx';

// One implementation shared by the music library and data settings.
export function LibraryDataTools({services}:{services:Services}){
  const {palette:p}=useTheme();
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  async function perform(run:()=>Promise<void>){setBusy(true);setMessage('');try{await run();}catch{setMessage('操作未确认完成，请核对本机数据与文件后重试');}finally{setBusy(false);}}
  const button=(label:string,action:()=>void)=><Pressable accessibilityRole="button" disabled={busy} accessibilityState={{disabled:busy}} onPress={action} style={{padding:13,minHeight:44,borderRadius:14,backgroundColor:p.selected,opacity:busy?.4:1}}><Text style={{color:p.accent}}>{label}</Text></Pressable>;
  async function exportBackup(){const file=new File(Paths.cache,`nexus-music-${Date.now()}.json`);try{file.write(await services.snapshotBackup());await Share.share({url:file.uri,title:'音枢音乐库备份'});}finally{if(file.exists)file.delete();}}
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
  return <View style={{gap:12,marginVertical:20}}>
    <PlaybackStatistics services={services}/>
    <StatisticsCloud services={services}/>
    <Text accessibilityRole="header" style={{color:p.text,fontSize:20,fontWeight:'600'}}>备份与迁移</Text>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{button('导出音乐库备份',()=>{void perform(exportBackup);})}{button('恢复音枢备份',()=>{void perform(importBackup);})}</View>
    <CloudBackup services={services}/><CloudSync services={services}/>
    {button('导入LX v2歌单 JSON / LXMC',()=>{void perform(importLX);})}
    {button('导入漫途版本1备份',()=>{void perform(importWayfarer);})}
    <QishuiImport services={services}/>
    <Text style={{color:p.secondary,fontSize:12,lineHeight:21}}>备份包含音乐库、实际播放统计及播放/歌词/EQ/外观设置；不含密码、JS音源、音频/图片/字体文件。旧备份无设置时保留当前设置。漫途QQ曲目保留MID，播放时需获取缺失元数据。</Text>
    {!!message&&<Text accessibilityLiveRegion="polite" style={{color:p.accent}}>{message}</Text>}
  </View>;
}
