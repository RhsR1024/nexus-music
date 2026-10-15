import {WebDAVLibrary} from './WebDAVLibrary.tsx';
import {DeviceMediaLibrary} from './DeviceMediaLibrary.tsx';
import {LocalAudioLibrary} from './LocalAudioLibrary.tsx';
import {TrackListModal} from './TrackListModal.tsx';
import {MatchModal} from './MatchModal.tsx';
import {QishuiImport} from './QishuiImport.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {Alert,Pressable,Share,StyleSheet,Text,TextInput,View} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {File,Paths} from 'expo-file-system';
import type {Services} from '../app/services.ts';
import {decodeBackup,encodeBackup} from '../storage/backup.ts';
import {decodePlaylistJSON} from '../storage/playlistJSON.ts';
import {decodeWayfarer} from '../storage/wayfarer.ts';
import {decodeImportText} from '../providers/nativeLX.ts';
import type {Track} from '../domain/track.ts';
import {PlaylistPicker} from './PlaylistPicker.tsx';
export function LibraryHome({services,openSearch,openSettings}:{services:Services;openSearch:()=>void;openSettings:()=>void}) {
  const theme=useTheme();const styles=useThemedStyles(makeStyles);
  const library=useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const [tab,setTab]=useState<'favorites'|'history'|'playlists'>('favorites'),[selected,setSelected]=useState<string|null>(null);
  const [name,setName]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[adding,setAdding]=useState<readonly Track[]>([]);
  const [listOpen,setListOpen]=useState(false);
  const [matchingTrack,setMatchingTrack]=useState<Track|null>(null);
  const playlist=library.playlists.find(item=>item.id===selected);
  useEffect(()=>{if(selected&&!playlist)setSelected(null);setName(playlist?.title??'');},[selected,playlist?.title]);
  async function perform(run:()=>Promise<void>){setBusy(true);setMessage('');try{await run();}catch{setMessage('保存未完成，已有音乐库保留；请重试');}finally{setBusy(false);}}
  const button=(label:string,action:()=>void,disabled=busy)=><Pressable accessibilityRole="button" onPress={action} disabled={disabled} style={[styles.button,disabled&&{opacity:.4}]}><Text style={styles.action}>{label}</Text></Pressable>;
  const tracks=playlist?playlist.entries.map(item=>item.track):tab==='favorites'?library.favorites:tab==='history'?library.history.map(item=>item.track):[];
  async function exportBackup(){const file=new File(Paths.cache,`nexus-music-${Date.now()}.json`);try{file.write(encodeBackup(library));await Share.share({url:file.uri,title:'音枢音乐库备份'});}finally{if(file.exists)file.delete();}}
  async function importBackup(){
    const result=await DocumentPicker.getDocumentAsync({type:'*/*',copyToCacheDirectory:true});if(result.canceled)return;
    const file=new File(result.assets[0]!.uri);
    try{
      if(file.size>32*1024*1024)throw new Error('too large');const backup=decodeBackup(await file.text());
      Alert.alert('恢复音枢备份',`包含 ${backup.library.playlists.length} 个歌单、${backup.library.favorites.length} 首收藏和 ${backup.library.history.length} 条历史。确认后替换当前音乐库，播放队列不变。`,[
        {text:'取消',style:'cancel'},{text:'替换音乐库',style:'destructive',onPress:()=>{void perform(async()=>{await services.library.replace(backup.library);setMessage('音乐库已恢复');});}},
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
  return <View>
    <Text style={styles.title}>我的音乐库</Text><Text style={styles.caption}>收藏 {library.favorites.length} · 歌单 {library.playlists.length} · 最近播放 {library.history.length}</Text>
    <LocalAudioLibrary services={services}/><DeviceMediaLibrary services={services}/><WebDAVLibrary services={services}/>
    {services.recoveryWarnings.map((warning,index)=><Text key={index} style={styles.caption}>{warning}</Text>)}
    <View style={styles.row}>{button('搜索歌曲',openSearch)}{button('音乐来源',openSettings)}</View>
    <View style={styles.row}>{(['favorites','history','playlists']as const).map((value,index)=><View key={value}>{button(['我的收藏','最近播放','我的歌单'][index]!,()=>{setTab(value);setSelected(null);})}</View>)}</View>
    {playlist?<View><Text style={styles.heading}>{playlist.title}</Text><TextInput accessibilityLabel="音枢歌单名称" value={name} onChangeText={setName} style={styles.input}/><View style={styles.row}>
      {button('保存名称',()=>{void perform(async()=>{await services.library.renamePlaylist(playlist.id,name);});},busy||!name.trim())}
      {button('删除歌单',()=>Alert.alert('删除此音枢歌单？','不会删除其他歌单中的相同歌曲。',[{text:'取消',style:'cancel'},{text:'删除',style:'destructive',onPress:()=>{void perform(async()=>{await services.library.deletePlaylist(playlist.id);});}}]))}
      {button('返回歌单列表',()=>setSelected(null))}
    </View></View>:tab==='playlists'?<View>
      <TextInput accessibilityLabel="创建音枢歌单名称" value={name} onChangeText={setName} placeholder="新歌单名称" placeholderTextColor="#768191" style={styles.input}/>
      {button('创建歌单',()=>{void perform(async()=>{const id=await services.library.createPlaylist(name);setSelected(id);});},busy||!name.trim())}
      {library.playlists.map(item=><Pressable accessibilityRole="button" key={item.id} onPress={()=>setSelected(item.id)} style={styles.trackRow}><Text style={styles.track}>{item.title}</Text><Text style={styles.caption}>{item.entries.length} 首</Text></Pressable>)}
    </View>:null}
    {!!tracks.length&&button('播放全部',()=>services.playTracks(tracks,0))}
    {tracks.length>0&&button('全部歌曲与批量管理',()=>setListOpen(true))}
    {tracks.slice(0,20).map((track,index)=><View key={playlist?.entries[index]?.id??`${index}-${track.origin.id}`} style={styles.trackRow}>
      <Pressable accessibilityRole="button" onPress={()=>services.playTracks(tracks,index)}><Text style={styles.track}>{track.title}</Text><Text style={styles.caption}>{track.artist}{track.album?` · ${track.album}`:''} · {track.origin.kind==='online'?track.origin.platform:track.origin.kind==='imported'?`汽水 · ${services.library.matchFor(track)?'已匹配':'待匹配'}`:track.origin.kind==='local'?'本地音频':track.origin.kind==='device'?'设备媒体库':track.origin.kind==='webdav'?'WebDAV':'私人曲库'}</Text></Pressable>
      <View style={styles.row}>{button(services.library.isFavorite(track)?'取消本地收藏':'本地收藏',()=>{void perform(async()=>{await services.library.favorite(track);});})}{button('下一首',()=>services.addToQueue(track,true))}{button('加入歌单',()=>setAdding([track]))}
        {track.origin.kind==='imported'&&button('匹配歌曲',()=>setMatchingTrack(track))}
        {playlist&&index>0&&button('上移',()=>{void perform(async()=>{await services.library.moveEntry(playlist.id,playlist.entries[index]!.id,index-1);});})}
        {playlist&&button('从歌单移除',()=>{void perform(async()=>{await services.library.removeEntry(playlist.id,playlist.entries[index]!.id);});})}
        {!playlist&&tab==='history'&&button(`移除此条历史：${track.title}`,()=>{void perform(async()=>{await services.library.removeHistory(track);});})}
      </View>
    </View>)}
    {!tracks.length&&tab!=='playlists'&&<View style={styles.empty}><Text style={styles.heading}>为下一次聆听留个位置</Text><Text style={styles.caption}>{tab==='favorites'?'搜索后可以把喜欢的歌收藏到这里。':'真正开始播放后，音乐会出现在这里。'}</Text></View>}
    {tab==='history'&&library.history.length>0&&button('清空播放历史',()=>Alert.alert('清空音枢播放历史？','不会修改服务端播放记录。',[{text:'取消',style:'cancel'},{text:'清空',style:'destructive',onPress:()=>{void perform(async()=>{await services.library.clearHistory();});}}]))}
    <View style={styles.row}>{button('导出音乐库备份',()=>{void perform(exportBackup);})}{button('恢复音枢备份',()=>{void perform(importBackup);})}</View>
    {button('导入LX v2歌单 JSON / LXMC',()=>{void perform(importLX);})}
    {button('导入漫途版本1备份',()=>{void perform(importWayfarer);})}
    <QishuiImport services={services}/>
    <Text style={styles.caption}>备份包含音乐库，不包含密码、JS音源或音频文件。漫途QQ曲目保留MID，播放时需获取缺失元数据。</Text>
    {!!message&&<Text accessibilityLiveRegion="polite" style={styles.caption}>{message}</Text>}
    <TrackListModal services={services} tracks={tracks} entryIds={playlist?.entries.map(item=>item.id)} playlistId={playlist?.id} kind={playlist?'playlist':tab==='history'?'history':'favorites'} title={playlist?.title??(tab==='history'?'最近播放':'我的收藏')} visible={listOpen} onClose={()=>setListOpen(false)}/>
    <PlaylistPicker services={services} tracks={adding} visible={adding.length>0} onClose={()=>setAdding([])}/>
    <MatchModal services={services} track={matchingTrack} onClose={()=>setMatchingTrack(null)}/>
  </View>;
}
const makeStyles=(theme:Theme)=>StyleSheet.create({title:{color:theme.color('#F1EDE7'),fontSize:28,fontWeight:'600'},heading:{color:theme.color('#D8DFEA'),fontSize:19,marginVertical:12},caption:{color:theme.color('#929CAB'),fontSize:11,lineHeight:21,marginTop:5},row:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:10},button:{padding:11,borderRadius:11,backgroundColor:theme.color('#2B3730')},action:{color:theme.color('#D9F49B'),fontSize:12},track:{color:theme.color('#E1E6F0'),fontSize:15,lineHeight:24},trackRow:{paddingVertical:14,borderBottomWidth:1,borderColor:theme.color('#303744')},input:{color:theme.color('#EEECE7'),borderWidth:1,borderColor:theme.color('#414754'),padding:13,borderRadius:11},empty:{padding:24,marginVertical:22,borderWidth:1,borderColor:theme.color('#303744'),borderRadius:18}});
