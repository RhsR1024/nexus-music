import type {VideoItem} from '../providers/videos.ts';
import type {BrowseItem} from '../providers/discovery.ts';
import {MVDetail,videoDuration} from './MVDetail.tsx';
import type {ArtistItem} from '../providers/artists.ts';
import {Discovery,type DiscoveryTarget} from './Discovery.tsx';
import {Cover} from './Cover.tsx';
import {controls,space,catalogArtwork,radius} from './tokens.ts';
import {Text,TextInput} from './Typography.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import { useEffect, useState, useSyncExternalStore } from 'react';
import {ActivityIndicator, Keyboard, Pressable, StyleSheet, View} from 'react-native';
import type { Services } from '../app/services.ts';
import type { OnlinePlatform, Track } from '../domain/track.ts';
import { trackKey } from '../domain/track.ts';
import { normalizeSearchQuery, suggestSearchQueries } from '../domain/searchHistory.ts';
import { platforms, type SearchGroup } from '../providers/searchCoordinator.ts';
import {TrackActions} from './TrackActions.tsx';
import {BatchSelectionBar, type BatchAction} from './BatchSelectionBar.tsx';
import {PlaylistPicker} from './PlaylistPicker.tsx';
import {Toast,useToast} from './Toast.tsx';
import {selectionAll,selectionByListOrder,selectionByTapOrder,selectionCount,selectionEnter,selectionHas,selectionToggle,selectionNone,type SelectionModel} from '../domain/selection.ts';
import {Ionicons} from '@expo/vector-icons';
export const platformNames: Readonly<Record<OnlinePlatform,string>> = {wy:'网易云',tx:'QQ音乐',kw:'酷我',kg:'酷狗',mg:'咪咕'};

const kindNames={song:'歌曲',playlist:'歌单',album:'专辑',artist:'艺术家',mv:'MV'} as const;
type SearchKind=keyof typeof kindNames;
interface GroupSelection { platform: OnlinePlatform; model: SelectionModel }

export function Search({ services }: { services: Services }) {
  const theme=useTheme();const styles=useThemedStyles(makeStyles);
  const songState = useSyncExternalStore(services.search.subscribe,services.search.getSnapshot);
  const playlistState=useSyncExternalStore(services.playlistSearch.subscribe,services.playlistSearch.getSnapshot);
  const [kind,setKind]=useState<SearchKind>('song'),[collection,setCollection]=useState<DiscoveryTarget|null>(null),[video,setVideo]=useState<{platform:OnlinePlatform;item:VideoItem}|null>(null);
  const albumState=useSyncExternalStore(services.albumSearch.subscribe,services.albumSearch.getSnapshot);
  const artistState=useSyncExternalStore(services.artistSearch.subscribe,services.artistSearch.getSnapshot);
  const videoState=useSyncExternalStore(services.videoSearch.subscribe,services.videoSearch.getSnapshot);
  const catalogState=kind==='mv'?videoState:kind==='artist'?artistState:kind==='album'?albumState:playlistState;
  const catalogCoordinator=kind==='mv'?services.videoSearch:kind==='artist'?services.artistSearch:kind==='album'?services.albumSearch:services.playlistSearch;
  const state=kind==='song'?songState:catalogState;
  const history = useSyncExternalStore(services.searchHistory.subscribe,services.searchHistory.getSnapshot);
  const assistance=useSyncExternalStore(services.searchAssistance.subscribe,services.searchAssistance.getSnapshot);
  const [editing,setEditing]=useState(false);
  const [query,setQuery] = useState(state.query), [platform,setPlatform] = useState<OnlinePlatform|'all'>('all');

  const [menuTrack,setMenuTrack]=useState<Track|null>(null);
  // Batch selection (Sollin capture §4): scope is the loaded collection of one
  // platform group; count shows 已选 N / loaded total.
  const [selection,setSelection]=useState<GroupSelection|null>(null),[picking,setPicking]=useState(false),[busy,setBusy]=useState(false);
  const toast=useToast();
  useEffect(()=>{setSelection(null);setPicking(false);setMenuTrack(null);setCollection(null);setVideo(null);},[state.query,platform,kind]);

  const draft=normalizeSearchQuery(query);
  const suggestions=draft&&draft!==state.query?suggestSearchQueries(history,draft):[];
  const emptyResults=!!state.query&&state.groups.length>0&&state.groups.every(group=>!group.loading&&!group.error&&group.items.length===0);
  const assistanceMode=!draft&&!history.length?'hot':draft&&(editing||draft!==state.query||emptyResults)?'suggest':null;
  useEffect(()=>{
    services.searchAssistance.clear();
    if(!assistanceMode)return;
    const timer=setTimeout(()=>{void services.searchAssistance.load(assistanceMode,draft,platform);},assistanceMode==='hot'?0:300);
    return()=>{clearTimeout(timer);services.searchAssistance.clear();};
  },[services,assistanceMode,draft,platform,kind]);

  const searchFor=(type:SearchKind,value:string,selected:OnlinePlatform|'all')=>{
    const catalogs={song:services.search,playlist:services.playlistSearch,album:services.albumSearch,artist:services.artistSearch,mv:services.videoSearch};
    for(const [name,catalog] of Object.entries(catalogs))void catalog.search(name===type?value:'',selected);
  };
  function openCatalog(platform:OnlinePlatform,item:BrowseItem){
    if(kind==='mv'){if(platform!=='mg')services.playback.controller.pause();setVideo({platform,item:item as VideoItem});}
    else setCollection({platform,collection:item,...(kind==='album'?{kind:'album' as const}:kind==='artist'?{kind:'artist' as const}:{})});
  }
  const submit=(value=query,selected:OnlinePlatform|'all'=platform,record=true,type=kind)=>{
    const cleaned=normalizeSearchQuery(value);
    Keyboard.dismiss();setEditing(false);setQuery(cleaned);
    if(cleaned&&record)void services.searchHistory.record(cleaned).catch(()=>{});
    searchFor(type,cleaned,selected);
  };
  const run=()=>submit();
  const change=(value:string)=>{setEditing(true);setQuery(value);if(!normalizeSearchQuery(value)&&state.query)searchFor(kind,'',platform);};
  const clearQuery=()=>{setQuery('');Keyboard.dismiss();searchFor(kind,'',platform);};

  async function runBatch(action:BatchAction,group:SearchGroup){
    const model=selection?.platform===group.platform?selection.model:selectionNone;
    const count=selectionCount(model);
    if(!count||busy)return;
    const rows=group.items.map((track,index)=>({track,id:String(index)}));
    const tapTracks=selectionByTapOrder(model,rows,row=>row.id).map(row=>row.track);
    const listTracks=selectionByListOrder(model,rows,row=>row.id).map(row=>row.track);
    if(action==='favorite'){
      setBusy(true);
      try{await services.library.addFavorites(tapTracks);toast.show(`已收藏 ${count} 首`);setSelection(null);}
      catch{toast.show('收藏未保存，请重试');}
      finally{setBusy(false);}
    }else if(action==='next'){
      services.addTracksToQueue(listTracks,true);
      toast.show(`已添加 ${count} 首到下一首播放`);setSelection(null);
    }else if(action==='download'){
      setBusy(true);
      try{
        for(const track of listTracks)await services.offlineDownloads.enqueue(track);
        toast.show(`已添加 ${count} 个下载任务`);setSelection(null);
      }catch{toast.show('部分下载任务未创建，请重试');}
      finally{setBusy(false);}
    }else if(action==='playlist'){setPicking(true);}
  }

  const assistanceSections=assistance.groups.map(group=><View key={group.platform} style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>{platformNames[group.platform]}{assistance.mode==='hot'?'热搜词':group.platform==='mg'?'匹配建议':'搜索建议'}</Text>
      {assistance.mode==='suggest'&&group.platform==='mg'&&<Text style={styles.caption}>根据公开歌曲匹配生成，点击后重新搜索。</Text>}
      {group.loading&&<ActivityIndicator accessibilityLabel="加载关键词" color={theme.palette.accent}/>}
      {group.error?<><Text style={styles.caption}>{group.error}</Text>{group.retryable&&<Pressable testID={`search-assistance-retry-${group.platform}`} accessibilityRole="button" accessibilityLabel={`重试${platformNames[group.platform]}关键词`} onPress={()=>{void services.searchAssistance.retry(group.platform);}} style={styles.sectionAction}><Text style={styles.link}>重试</Text></Pressable>}</>:!group.loading&&!group.items.length?<Text style={styles.caption}>{assistance.mode==='hot'?'暂无热搜词':'暂无搜索建议'}</Text>:null}
      {group.items.map((word,index)=><Pressable key={word} testID={`search-public-${assistance.mode}-${group.platform}-${index}`} accessibilityRole="button" accessibilityLabel={`${platformNames[group.platform]}${assistance.mode==='hot'?'热搜词':group.platform==='mg'?'匹配建议':'搜索建议'}：${word}`} onPress={()=>submit(word)} style={styles.historyRow}><Text accessible={false} style={styles.caption}>{assistance.mode==='hot'?`${index+1}.`:'·'}</Text><Text style={styles.historyText}>{word}</Text></Pressable>)}
    </View>);

  return <View>
    <Text style={styles.title}>寻找下一首喜欢的歌</Text>
    <Text style={styles.caption}>歌曲、歌单、专辑、艺术家与MV按平台分别搜索、展示。键入时向所选平台获取关键词建议。导入并启用LX音源后可解析歌曲，MV打开平台页面。</Text>
    <View style={styles.inputRow}>
      <TextInput accessibilityLabel={kind==='song'?'搜索歌曲或歌手':`搜索${kindNames[kind]}`} placeholder={kind==='song'?'歌曲、歌手':`${kindNames[kind]}关键词`} placeholderTextColor="#768191" autoCorrect={false} onFocus={()=>setEditing(true)} value={query} onChangeText={change} onSubmitEditing={run} returnKeyType="search" style={styles.input}/>
      {!!query&&<Pressable testID="search-clear" accessibilityRole="button" accessibilityLabel="清除搜索输入" onPress={clearQuery} style={styles.clear}><Ionicons name="close-circle" size={22} color={theme.palette.secondary}/></Pressable>}
    </View>
    {assistance.mode==='suggest'&&assistanceSections}
    {!!suggestions.length&&<View style={styles.section}>
      <Text style={styles.heading}>搜索建议</Text>
      {suggestions.map((item,index)=><Pressable key={item} testID={`search-suggestion-${index}`} accessibilityRole="button" accessibilityLabel={`搜索建议：${item}`} onPress={()=>submit(item)} style={styles.historyRow}>
        <Ionicons name="search-outline" size={18} color={theme.palette.secondary}/>
        <Text style={styles.historyText} numberOfLines={1}>{item}</Text>
      </Pressable>)}
    </View>}
    {!state.query&&!suggestions.length&&<View style={styles.section}>
      {history.length?<>
        <View style={styles.sectionHeader}>
          <Text style={styles.heading}>搜索历史</Text>
          <Pressable testID="search-history-clear" accessibilityRole="button" accessibilityLabel="清空搜索历史" onPress={()=>{void services.searchHistory.clear().catch(()=>toast.show('搜索历史未清除，请重试'));}} style={styles.sectionAction}><Text style={styles.link}>清空</Text></Pressable>
        </View>
        {history.map((item,index)=><Pressable key={item} testID={`search-history-${index}`} accessibilityRole="button" accessibilityLabel={`搜索历史：${item}`} onPress={()=>submit(item)} style={styles.historyRow}>
          <Ionicons name="time-outline" size={18} color={theme.palette.secondary}/>
          <Text style={styles.historyText} numberOfLines={1}>{item}</Text>
        </Pressable>)}
      </>:<Text style={styles.caption}>{kind==='song'?'输入歌曲或歌手开始搜索。':`输入${kindNames[kind]}关键词开始搜索。`}</Text>}
    </View>}
    <View style={styles.row}>{(['song','playlist','album','artist','mv']as const).map(type=><Pressable key={type} testID={`search-kind-${type}`} accessibilityRole="radio" accessibilityState={{selected:kind===type}} onPress={()=>{if(type===kind)return;setKind(type);submit(query,platform,false,type);}} style={[styles.chip,kind===type&&styles.selected]}><Text style={styles.text}>{kindNames[type]}</Text></Pressable>)}</View>
    <View style={styles.row}>{(['all',...platforms] as const).map(item => <Pressable key={item} accessibilityRole="radio" accessibilityState={{selected:platform===item}} onPress={() => {setPlatform(item);submit(query,item,false);}} style={[styles.chip,platform===item&&styles.selected]}><Text style={styles.text}>{item==='all'?'聚合':platformNames[item]}</Text></Pressable>)}</View>
    <Pressable testID="run-online-search" accessibilityRole="button" onPress={run} style={styles.button}><Text style={styles.text}>搜索</Text></Pressable>
    {assistance.mode==='hot'&&assistanceSections}
    {kind==='song'&&songState.groups.map(group => {const model=selection?.platform===group.platform?selection.model:selectionNone;const hasItems=group.items.length>0;return <View key={group.platform} style={styles.group}>
      <Text style={styles.heading}>{platformNames[group.platform]}　<Text style={styles.caption}>{group.items.length} 首已载入{group.total!==undefined?` / ${group.total}`:''}</Text></Text>
      {group.items.map((track,index) => {const id=String(index);const selected=selectionHas(model,id);return <View key={`${index}-${trackKey(track.origin)}`} style={styles.trackRow}>
        <Pressable accessibilityRole="button" testID={`search-track-${group.platform}-${index}`} accessibilityLabel={`${selected?'选择':'播放'}${track.title}`} accessibilityState={{selected}} style={{flex:1,minHeight:44,flexDirection:'row',alignItems:'center',gap:10}}
          onLongPress={()=>{setPicking(false);setSelection({platform:group.platform,model:selectionEnter(id)});}}
          onPress={() => { if(model.active){setSelection({platform:group.platform,model:selectionToggle(model,id)});} else services.playTracks(group.items,index); }}>
          {model.active&&<Ionicons name={selected?'checkmark-circle':'ellipse-outline'} size={22} color={selected?theme.palette.accent:theme.palette.secondary}/>}
          <View style={{flex:1}}><Text style={styles.track}>{track.title}</Text><Text style={styles.caption}>{track.artist}{track.album?` · ${track.album}`:''}</Text></View>
        </Pressable>
        {!model.active&&<Pressable testID={`search-more-${group.platform}-${index}`} accessibilityRole="button" accessibilityLabel={`更多操作：${track.title}`} onPress={()=>setMenuTrack(track)} style={styles.more}><Ionicons name="ellipsis-horizontal" size={24} color={theme.palette.accent}/></Pressable>}
      </View>;})}
      {model.active&&!picking&&<BatchSelectionBar
        count={selectionCount(model)} total={group.items.length}
        allSelected={group.items.length>0&&selectionCount(model)===group.items.length}
        actions={['favorite','playlist','next','download']} busy={busy}
        onSelectAll={()=>setSelection({platform:group.platform,model:selectionAll(model,group.items.map((_,index)=>String(index)))})}
        onCancel={()=>{setSelection(null);setPicking(false);}}
        onAction={action=>{void runBatch(action,group);}}/>}
      {model.active&&picking&&<PlaylistPicker inline services={services} tracks={selectionByListOrder(model,group.items.map((track,index)=>({track,id:String(index)})),row=>row.id).map(row=>row.track)} visible onClose={()=>setPicking(false)} onAdded={title=>toast.show(`已添加 ${selectionCount(model)} 首到 ${title}`)}/>}
      {!model.active&&group.loading&&!hasItems&&<View testID={`search-loading-${group.platform}`} style={styles.status}><ActivityIndicator color={theme.palette.accent}/><Text style={styles.caption}>正在搜索…</Text></View>}
      {!model.active&&group.error&&<View testID={`search-error-${group.platform}`} style={styles.status}>
        <Text style={styles.error}>{hasItems?'加载更多失败，已保留当前结果':'暂时无法加载内容'}</Text>
        <Text style={styles.caption}>{group.error}</Text>
        <Pressable testID={`search-retry-${group.platform}`} accessibilityRole="button" disabled={group.loading} onPress={()=>{void services.search.retry(group.platform);}} style={styles.button}><Text style={styles.text}>{group.loading?'正在重试…':'重试'}</Text></Pressable>
      </View>}
      {!model.active&&!group.loading&&!group.error&&!hasItems&&<Text testID={`search-empty-${group.platform}`} style={styles.caption}>未找到结果，请更换关键词或平台</Text>}
      {!model.active&&hasItems&&!group.loading&&!group.error&&!group.hasMore&&<Text testID={`search-end-${group.platform}`} style={styles.end}>没有更多结果了</Text>}
      {!model.active&&hasItems&&group.hasMore&&!group.error&&<Pressable testID={`search-load-more-${group.platform}`} accessibilityRole="button" disabled={group.loading} onPress={()=>{void services.search.more(group.platform);}} style={styles.button}><Text style={styles.text}>{group.loading?'正在加载…':'加载更多'}</Text></Pressable>}
    </View>;})}
    {kind!=='song'&&catalogState.groups.map(group=><View key={group.platform} style={styles.group}>
      <Text style={styles.heading}>{platformNames[group.platform]} <Text style={styles.caption}>{group.items.length} 个{kindNames[kind]}已载入{group.total!==undefined?` / ${group.total}`:''}</Text></Text>
      {group.items.map((item,index)=>{
        const artist=kind==='artist'?item as ArtistItem:undefined,mv=kind==='mv'?item as VideoItem:undefined;
        const summary=artist?`${artist.songCount!==undefined?` · ${artist.songCount} 首歌曲`:''}${artist.albumCount!==undefined?` · ${artist.albumCount} 张专辑`:''}`:mv?mv.durationSeconds!==undefined?` · ${videoDuration(mv.durationSeconds)}`:'':item.count!==undefined?` · ${item.count} 首`:'';
        return <Pressable key={item.id} testID={`search-${kind}-${group.platform}-${index}`} accessibilityRole="button" accessibilityLabel={`打开${kindNames[kind]}：${item.title}，${platformNames[group.platform]}${item.author?`，${mv?'艺术家':'作者'}${item.author}`:''}${summary}`} onPress={()=>openCatalog(group.platform,item)} onLongPress={()=>openCatalog(group.platform,item)} style={styles.catalogRow}>
          <Cover services={services} url={item.artwork} size={mv?catalogArtwork.videoWidth:catalogArtwork.square} aspectRatio={mv?catalogArtwork.videoAspect:1} radius={mv?Math.min(theme.appearance.coverRadius,radius.md):undefined}/><View style={{flex:1}}><Text style={styles.track} numberOfLines={2}>{item.title}</Text><Text style={styles.caption}>{platformNames[group.platform]}{item.author?` · ${item.author}`:''}{summary}</Text><Text style={styles.link}>打开{kindNames[kind]}</Text></View>
        </Pressable>;
      })}
      {group.loading&&<View testID={`${kind}-search-loading-${group.platform}`} style={styles.status}><ActivityIndicator color={theme.palette.accent}/><Text style={styles.caption}>{group.items.length?'正在加载更多…':`正在搜索${kindNames[kind]}…`}</Text></View>}
      {!!group.error&&<View testID={`${kind}-search-error-${group.platform}`} style={styles.status}><Text style={styles.error}>{group.error}</Text><Pressable testID={`${kind}-search-retry-${group.platform}`} accessibilityRole="button" disabled={group.loading} onPress={()=>{void catalogCoordinator.retry(group.platform);}} style={styles.button}><Text style={styles.text}>重试</Text></Pressable></View>}
      {!group.loading&&!group.error&&!group.items.length&&<Text testID={`${kind}-search-empty-${group.platform}`} style={styles.caption}>未找到结果，请更换关键词或平台</Text>}
      {!group.loading&&!group.error&&group.items.length>0&&!group.hasMore&&<Text testID={`${kind}-search-end-${group.platform}`} style={styles.end}>没有更多结果了</Text>}
      {!group.loading&&!group.error&&group.hasMore&&<Pressable testID={`${kind}-search-more-${group.platform}`} accessibilityRole="button" onPress={()=>{void catalogCoordinator.more(group.platform);}} style={styles.button}><Text style={styles.text}>加载更多</Text></Pressable>}
    </View>)}
    {video&&<MVDetail services={services} platform={video.platform} video={video.item} onClose={()=>setVideo(null)}/>}
    {collection&&<Discovery key={`${collection.platform}:${collection.collection.id}`} services={services} initialCollection={collection} onClose={()=>setCollection(null)}/>}
    <TrackActions services={services} track={menuTrack} prefix="search" onClose={()=>setMenuTrack(null)} extras/>
    <Toast message={toast.message} onDismiss={toast.clear}/>
  </View>;
}
const makeStyles=(theme:Theme)=>StyleSheet.create({
  title:{color:theme.color('#F1EDE7'),fontSize:26,fontWeight:'600'},caption:{color:theme.color('#929CAB'),fontSize:11,lineHeight:20,marginTop:5},
  inputRow:{flexDirection:'row',alignItems:'center',marginVertical:18},input:{color:theme.color('#EEECE7'),borderWidth:1,borderColor:theme.color('#414754'),borderRadius:13,padding:14,flex:1,fontSize:15},
  clear:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',marginLeft:4},
  row:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:8},chip:{minHeight:controls.hit,justifyContent:'center',backgroundColor:theme.color('#263329'),borderRadius:10,paddingHorizontal:11,paddingVertical:9},selected:{borderWidth:1,borderColor:theme.color('#D9F49B')},
  text:{color:theme.color('#D9F49B'),fontSize:12},button:{backgroundColor:theme.color('#303A32'),borderRadius:12,padding:13,alignItems:'center',marginVertical:10},
  section:{marginTop:14,marginBottom:4},sectionHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},sectionAction:{minWidth:44,minHeight:44,alignItems:'flex-end',justifyContent:'center'},link:{color:theme.color('#D9F49B'),fontSize:13},
  historyRow:{flexDirection:'row',alignItems:'center',gap:10,minHeight:44,borderBottomWidth:1,borderBottomColor:theme.color('#2E3440')},historyText:{color:theme.color('#DFE4EE'),fontSize:14,flex:1},
  group:{marginTop:26},heading:{color:theme.color('#E5E8E0'),fontSize:18},track:{color:theme.color('#DFE4EE'),fontSize:15,lineHeight:23},more:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},trackRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,paddingVertical:13,borderBottomWidth:1,borderBottomColor:theme.color('#2E3440')},error:{color:theme.color('#D3AB94'),fontSize:12},
  catalogRow:{minHeight:controls.hit,flexDirection:'row',alignItems:'center',gap:space.md,paddingVertical:space.md,borderBottomWidth:1,borderBottomColor:theme.palette.border},
  status:{alignItems:'center',paddingVertical:16,gap:4},end:{color:theme.color('#929CAB'),fontSize:12,textAlign:'center',marginTop:14},
});
