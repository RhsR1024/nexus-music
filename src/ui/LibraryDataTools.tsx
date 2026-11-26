import {Text} from './Typography.tsx';
import {useState} from 'react';
import {Alert,Pressable,View} from 'react-native';
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
export function LibraryDataTools({services}:{services:Services}){
  const theme=useTheme(),p=theme.palette,s=sollinTokens(theme.mode,p.accent,theme.appearance);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const soft=s.dark?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.48)';
  const chipBg=s.dark?'rgba(255,255,255,0.10)':'rgba(255,255,255,0.60)';

  async function perform(run:()=>Promise<void>){setBusy(true);setMessage('');try{await run();}catch{setMessage('操作未确认完成，请核对本机数据与文件后重试');}finally{setBusy(false);}}
  const button=(label:string,action:()=>void,primary=false,testID?:string)=><Pressable testID={testID} accessibilityRole="button" disabled={busy} accessibilityState={{disabled:busy}} onPress={action} style={{paddingHorizontal:14,paddingVertical:10,minHeight:42,borderRadius:21,backgroundColor:primary?s.accent:chipBg,justifyContent:'center',alignItems:'center',opacity:busy?.4:1}}><Text style={{color:primary?'#FFFFFF':s.ink,fontSize:13,fontWeight:'600'}}>{label}</Text></Pressable>;

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

  return <View style={{gap:12,marginVertical:10}}>
    <PlaybackStatistics services={services}/>
    <StatisticsCloud services={services}/>
    <Text accessibilityRole="header" style={{color:s.muted,fontSize:13,fontWeight:'600',marginLeft:4}}>备份与迁移</Text>
    <View style={{padding:16,borderRadius:20,backgroundColor:soft,gap:10}}>
      <Text accessibilityRole="header" style={{color:s.ink,fontSize:16,fontWeight:'700'}}>备份与歌单迁移</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
        {button('导出音乐库备份',()=>{void perform(exportBackup);},true)}
        {button('恢复音枢备份',()=>{void perform(importBackup);})}
      </View>
      <CloudBackup services={services}/><CloudSync services={services}/>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
        {button('导入LX v2歌单 JSON / LXMC',()=>{void perform(importLX);})}
        {button('导出 LX 歌单 JSON',()=>{void perform(exportLX);},false,'library-export-lx-json')}
        {button('导入漫途版本1备份',()=>{void perform(importWayfarer);})}
      </View>
      <QishuiImport services={services}/>
      <Text style={{color:s.muted,fontSize:12,lineHeight:19}}>备份包含音乐库、实际播放统计及播放/歌词/EQ/外观设置；不含密码、JS音源、音频/图片/字体文件。LX 导出仅包含支持的在线歌曲。</Text>
    </View>
    {!!message&&<Text testID="library-data-message" accessibilityLiveRegion="polite" style={{color:s.accent,fontSize:13,marginLeft:4}}>{message}</Text>}
  </View>;
}
