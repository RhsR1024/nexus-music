import {LibraryDataTools} from './LibraryDataTools.tsx';
import {Cover} from './Cover.tsx';
import {Text,TextInput} from './Typography.tsx';
import {WebDAVLibrary} from './WebDAVLibrary.tsx';
import {DeviceMediaLibrary} from './DeviceMediaLibrary.tsx';
import {LocalAudioLibrary} from './LocalAudioLibrary.tsx';
import {TrackListModal} from './TrackListModal.tsx';
import {MatchModal} from './MatchModal.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {useEffect,useState,useSyncExternalStore} from 'react';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {PlaylistPicker} from './PlaylistPicker.tsx';
export function LibraryHome({services,openSearch,openSettings}:{services:Services;openSearch:()=>void;openSettings:()=>void}) {
  const theme=useTheme();const styles=useThemedStyles(makeStyles);
  const library=useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const playbackStats=useSyncExternalStore(services.playbackStats.subscribe,services.playbackStats.getSnapshot);
  const [tab,setTab]=useState<'favorites'|'history'|'playlists'>('favorites'),[selected,setSelected]=useState<string|null>(null);
  const [name,setName]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[adding,setAdding]=useState<readonly Track[]>([]);
  const [listOpen,setListOpen]=useState(false);
  const [matchingTrack,setMatchingTrack]=useState<Track|null>(null);
  const playlist=library.playlists.find(item=>item.id===selected);
  useEffect(()=>{if(selected&&!playlist)setSelected(null);setName(playlist?.title??'');},[selected,playlist?.title]);
  async function perform(run:()=>Promise<void>){setBusy(true);setMessage('');try{await run();}catch{setMessage('保存未完成，已有音乐库保留；请重试');}finally{setBusy(false);}}
  const button=(label:string,action:()=>void,disabled=busy)=><Pressable accessibilityRole="button" onPress={action} disabled={disabled} style={[styles.button,disabled&&{opacity:.4}]}><Text style={styles.action}>{label}</Text></Pressable>;
  const openPlaylistComposer=()=>{setTab('playlists');setSelected(null);setName('');};
  const iconButton=(id:string,label:string,icon:React.ComponentProps<typeof Ionicons>['name'],action:()=>void)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} onPress={action} style={styles.iconButton}><Ionicons name={icon} size={22} color={theme.palette.accent}/></Pressable>;
  const tabButton=(value:'favorites'|'history'|'playlists',label:string)=><Pressable key={value} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{selected:tab===value}} onPress={()=>{setTab(value);setSelected(null);}} style={[styles.tabButton,tab===value&&styles.tabButtonSelected]}><Text style={[styles.tabLabel,tab===value&&styles.tabLabelSelected]}>{label}</Text></Pressable>;
  const tracks=playlist?playlist.entries.map(item=>item.track):tab==='favorites'?library.favorites:tab==='history'?library.history.map(item=>item.track):[];
  return <View>
    <View style={styles.header}><View style={{flex:1}}><Text style={styles.title}>我的音乐库</Text><Text style={styles.caption}>收藏 {library.favorites.length} · 歌单 {library.playlists.length} · 最近播放 {library.history.length} · 播放统计 {playbackStats.items.length}</Text></View><View style={styles.headerActions}>{iconButton('library-open-search','搜索歌曲','search-outline',openSearch)}{iconButton('library-create-playlist','创建歌单','add',openPlaylistComposer)}{iconButton('library-open-settings','音乐来源','settings-outline',openSettings)}</View></View>
    {playbackStats.items.length>0&&<View style={styles.empty}><Text style={styles.heading}>实际聆听统计</Text>{playbackStats.items.slice(0,5).map(item=><Text key={JSON.stringify(item.track.origin)} style={styles.caption}>{item.track.title} · 播放 {item.playCount} 次 · 听歌 {Math.floor(item.listenedMs/60000)}分{Math.floor(item.listenedMs/1000)%60}秒</Text>)}{button('清空播放统计',()=>Alert.alert('清空播放统计？','只清除本机记录；服务端播放量和最近播放列表不变。',[{text:'取消',style:'cancel'},{text:'清空',style:'destructive',onPress:()=>{void perform(async()=>services.playbackStats.clear());}}]))}</View>}
    <LocalAudioLibrary services={services}/><DeviceMediaLibrary services={services}/><WebDAVLibrary services={services}/>
    {services.recoveryWarnings.map((warning,index)=><Text key={index} style={styles.caption}>{warning}</Text>)}
    <View style={styles.row}>{button('搜索歌曲',openSearch)}{button('音乐来源',openSettings)}</View>
    <View style={styles.tabs}>{tabButton('favorites','我的收藏')}{tabButton('history','最近播放')}{tabButton('playlists','我的歌单')}</View>
    {playlist?<View><Text style={styles.heading}>{playlist.title}</Text><TextInput accessibilityLabel="音枢歌单名称" value={name} onChangeText={setName} style={styles.input}/><View style={styles.row}>
      {button('保存名称',()=>{void perform(async()=>{await services.library.renamePlaylist(playlist.id,name);});},busy||!name.trim())}
      {button('删除歌单',()=>Alert.alert('删除此音枢歌单？','不会删除其他歌单中的相同歌曲。',[{text:'取消',style:'cancel'},{text:'删除',style:'destructive',onPress:()=>{void perform(async()=>{await services.library.deletePlaylist(playlist.id);});}}]))}
      {button('返回歌单列表',()=>setSelected(null))}
    </View></View>:tab==='playlists'?<View>
      <TextInput accessibilityLabel="创建音枢歌单名称" value={name} onChangeText={setName} placeholder="新歌单名称" placeholderTextColor="#768191" style={styles.input}/>
      {button('创建歌单',()=>{void perform(async()=>{const id=await services.library.createPlaylist(name);setSelected(id);});},busy||!name.trim())}
      {library.playlists.map(item=><Pressable accessibilityRole="button" accessibilityLabel={`${item.title} · ${item.entries.length}首`} key={item.id} onPress={()=>setSelected(item.id)} style={styles.trackRow}><View style={{flexDirection:"row",gap:14,alignItems:"center"}}><Cover services={services} track={item.entries[0]?.track} size={58}/><View style={{flex:1}}><Text style={styles.track}>{item.title}</Text><Text style={styles.caption}>{item.entries.length} 首</Text></View></View></Pressable>)}
    </View>:null}
    {!!tracks.length&&<View style={styles.row}>{button('播放全部',()=>services.playTracks(tracks,0))}{button('随机播放',()=>{void services.preferences.update({shuffle:true}).then(()=>services.playTracks(tracks,0)).catch(()=>setMessage('无法保存随机模式，请重试'));})}</View>}
    {tracks.length>0&&button('全部歌曲与批量管理',()=>setListOpen(true))}
    {tracks.slice(0,20).map((track,index)=><View key={playlist?.entries[index]?.id??`${index}-${track.origin.id}`} style={styles.trackRow}>
      <Pressable accessibilityRole="button" onPress={()=>services.playTracks(tracks,index)}><Text style={styles.track}>{track.title}</Text><Text style={styles.caption}>{track.artist}{track.album?` · ${track.album}`:''} · {track.origin.kind==='online'?track.origin.platform:track.origin.kind==='imported'?`汽水 · ${services.library.matchFor(track)?'已匹配':'待匹配'}`:track.origin.kind==='local'?'本地音频':track.origin.kind==='device'?'设备媒体库':track.origin.kind==='webdav'?'WebDAV':'私人曲库'}</Text></Pressable>
      <View style={styles.row}>{button(services.library.isFavorite(track)?'取消本地收藏':'本地收藏',()=>{void perform(async()=>{await services.library.favorite(track);});})}{button('下一首',()=>services.addToQueue(track,true))}{button('加入歌单',()=>setAdding([track]))}
        {(track.origin.kind==='imported'||track.origin.kind==='online')&&button('匹配歌曲',()=>setMatchingTrack(track))}
        {playlist&&index>0&&button('上移',()=>{void perform(async()=>{await services.library.moveEntry(playlist.id,playlist.entries[index]!.id,index-1);});})}
        {playlist&&button('从歌单移除',()=>{void perform(async()=>{await services.library.removeEntry(playlist.id,playlist.entries[index]!.id);});})}
        {!playlist&&tab==='history'&&button(`移除此条历史：${track.title}`,()=>{void perform(async()=>{await services.library.removeHistory(track);});})}
      </View>
    </View>)}
    {!tracks.length&&tab!=='playlists'&&<View style={styles.empty}><Text style={styles.heading}>为下一次聆听留个位置</Text><Text style={styles.caption}>{tab==='favorites'?'搜索后可以把喜欢的歌收藏到这里。':'真正开始播放后，音乐会出现在这里。'}</Text></View>}
    {tab==='history'&&library.history.length>0&&button('清空播放历史',()=>Alert.alert('清空音枢播放历史？','不会修改服务端播放记录。',[{text:'取消',style:'cancel'},{text:'清空',style:'destructive',onPress:()=>{void perform(async()=>{await services.library.clearHistory();});}}]))}
    <LibraryDataTools services={services}/>
    {!!message&&<Text accessibilityLiveRegion="polite" style={styles.caption}>{message}</Text>}
    <TrackListModal services={services} tracks={tracks} entryIds={playlist?.entries.map(item=>item.id)} playlistId={playlist?.id} kind={playlist?'playlist':tab==='history'?'history':'favorites'} title={playlist?.title??(tab==='history'?'最近播放':'我的收藏')} visible={listOpen} onClose={()=>setListOpen(false)}/>
    <PlaylistPicker services={services} tracks={adding} visible={adding.length>0} onClose={()=>setAdding([])}/>
    <MatchModal services={services} track={matchingTrack} onClose={()=>setMatchingTrack(null)}/>
  </View>;
}
const makeStyles=(theme:Theme)=>StyleSheet.create({header:{flexDirection:'row',alignItems:'flex-start',gap:12},headerActions:{flexDirection:'row',gap:8},iconButton:{width:46,height:46,borderRadius:23,backgroundColor:theme.color('#2B3730'),alignItems:'center',justifyContent:'center'},title:{color:theme.color('#F1EDE7'),fontSize:28,fontWeight:'600'},heading:{color:theme.color('#D8DFEA'),fontSize:19,marginVertical:12},caption:{color:theme.color('#929CAB'),fontSize:11,lineHeight:21,marginTop:5},row:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:10},tabs:{flexDirection:'row',gap:8,marginVertical:14,padding:5,borderRadius:18,backgroundColor:theme.color('#202630')},tabButton:{flex:1,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:14},tabButtonSelected:{backgroundColor:theme.color('#3A493C')},tabLabel:{color:theme.color('#929CAB'),fontSize:13},tabLabelSelected:{color:theme.color('#D9F49B'),fontWeight:'700'},button:{padding:11,borderRadius:11,backgroundColor:theme.color('#2B3730')},action:{color:theme.color('#D9F49B'),fontSize:12},track:{color:theme.color('#E1E6F0'),fontSize:15,lineHeight:24},trackRow:{paddingVertical:14,borderBottomWidth:1,borderColor:theme.color('#303744')},input:{color:theme.color('#EEECE7'),borderWidth:1,borderColor:theme.color('#414754'),padding:13,borderRadius:11},empty:{padding:24,marginVertical:22,borderWidth:1,borderColor:theme.color('#303744'),borderRadius:18}});
