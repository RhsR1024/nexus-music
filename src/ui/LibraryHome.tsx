import {SavedCatalogs} from './SavedCatalogs.tsx';
import {LibraryDataTools} from './LibraryDataTools.tsx';
import {AccountRecommendations} from './AccountRecommendations.tsx';
import {Cover} from './Cover.tsx';
import {Text,TextInput} from './Typography.tsx';
import {WebDAVLibrary} from './WebDAVLibrary.tsx';
import {DeviceMediaLibrary} from './DeviceMediaLibrary.tsx';
import {LocalAudioLibrary} from './LocalAudioLibrary.tsx';
import {TrackListModal} from './TrackListModal.tsx';
import {TrackActions,type AdditionalTrackAction} from './TrackActions.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {Fragment,useEffect,useState,useSyncExternalStore} from 'react';
import {historyTimestamp} from '../domain/historyPresentation.ts';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {LocalPlaylist} from '../storage/library.ts';
import {Toast} from './Toast.tsx';
import type {Track} from '../domain/track.ts';
import {playlistCoverSource} from '../domain/playlistCover.ts';
export function LibraryHome({services,openSearch,openSettings,openAccounts}:{services:Services;openSearch:()=>void;openSettings:()=>void;openAccounts:()=>void}) {
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);const styles=useThemedStyles(makeStyles);
  const library=useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const playbackStats=useSyncExternalStore(services.playbackStats.subscribe,services.playbackStats.getSnapshot);
  const recommendations=useSyncExternalStore(services.recommendations.subscribe,services.recommendations.getSnapshot);
  const [tab,setTab]=useState<'favorites'|'history'|'playlists'>('favorites'),[selected,setSelected]=useState<string|null>(null);
  const [name,setName]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[visibleCount,setVisibleCount]=useState(20);
  const [description,setDescription]=useState(''),[coverUrl,setCoverUrl]=useState(''),[undoSnapshot,setUndoSnapshot]=useState<LocalPlaylist|null>(null);
  const [listOpen,setListOpen]=useState(false);
  const [menu,setMenu]=useState<{track:Track;entryId?:string;playlistId?:string;history:boolean}|null>(null);
  const playlist=library.playlists.find(item=>item.id===selected);
  useEffect(()=>{if(selected&&!playlist)setSelected(null);setName(playlist?.title??'');setDescription(playlist?.description??'');setCoverUrl(playlist?.coverUrl??'');setVisibleCount(20);},[selected,playlist?.title,playlist?.description,playlist?.coverUrl,tab]);
  async function perform(run:()=>Promise<void>){setBusy(true);setMessage('');try{await run();}catch{setMessage('保存未完成，已有音乐库保留；请重试');}finally{setBusy(false);}}
  const button=(label:string,action:()=>void,disabled=busy,testID?:string,primary=false)=><Pressable testID={testID} accessibilityRole="button" onPress={action} disabled={disabled} style={[styles.button,primary&&styles.buttonPrimary,disabled&&{opacity:.4}]}><Text style={[styles.action,primary&&styles.actionPrimary]}>{label}</Text></Pressable>;
  const openPlaylistComposer=()=>{setTab('playlists');setSelected(null);setName('');};
  const iconButton=(id:string,label:string,icon:React.ComponentProps<typeof Ionicons>['name'],action:()=>void)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} onPress={action} style={styles.iconButton}><Ionicons name={icon} size={20} color="#FFFFFF"/></Pressable>;
  const tabButton=(value:'favorites'|'history'|'playlists',label:string)=><Pressable key={value} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:tab===value}} onPress={()=>{setTab(value);setSelected(null);}} style={[styles.tabButton,tab===value&&styles.tabButtonSelected]}><Text style={[styles.tabLabel,tab===value&&styles.tabLabelSelected]}>{label}</Text></Pressable>;
  const tracks=playlist?playlist.entries.map(item=>item.track):tab==='favorites'?library.favorites:tab==='history'?library.history.map(item=>item.track):[];
  const selectedCover=playlist?playlistCoverSource(playlist.coverUrl,playlist.entries[0]?.track):undefined;
  const managementActions:AdditionalTrackAction[]=[];
  if(menu?.playlistId&&menu.entryId){
    const {playlistId,entryId}=menu;
    const at=library.playlists.find(item=>item.id===playlistId)?.entries.findIndex(item=>item.id===entryId)??-1;
    if(at>0)managementActions.push({id:'move-up',label:'上移',icon:'arrow-up',run:async()=>{
      const index=services.library.getSnapshot().playlists.find(item=>item.id===playlistId)?.entries.findIndex(item=>item.id===entryId)??-1;
      if(index>0)await services.library.moveEntry(playlistId,entryId,index-1);
    }});
    if(at>=0)managementActions.push({id:'remove-entry',label:'从歌单移除',icon:'remove-circle-outline',run:()=>services.library.removeEntry(playlistId,entryId)});
  }
  if(menu?.history)managementActions.push({id:'remove-history',label:`移除此条历史：${menu.track.title}`,icon:'trash-outline',run:()=>services.library.removeHistory(menu.track)});

  return <View style={{gap:10}}>
    <View style={styles.header}><View style={{flex:1}}><Text accessibilityRole="header" accessibilityLabel="我的音乐库" style={styles.title}>音乐库</Text><Text style={styles.caption}>收藏 {library.favorites.length} · 歌单 {library.playlists.length} · 历史 {library.history.length} · 播放统计 {playbackStats.items.length}</Text></View><View style={styles.headerActions}>{iconButton('library-create-playlist','创建歌单','add',openPlaylistComposer)}{iconButton('library-open-search','搜索歌曲','search-outline',openSearch)}{iconButton('library-open-settings','音乐来源','menu',openSettings)}</View></View>
    <View style={styles.tabs}>{tabButton('favorites','我的收藏')}{tabButton('history','最近播放')}{tabButton('playlists','我的歌单')}</View>
    {playlist?<View style={styles.card}><View style={{flexDirection:"row",gap:14,alignItems:"center"}}><Cover services={services} url={selectedCover?.url} track={selectedCover?.track} size={78} radius={14} testID="library-playlist-detail-cover"/><View style={{flex:1}}><Text style={styles.heading}>{playlist.title}</Text><Text style={styles.caption}>{playlist.entries.length} 首歌曲</Text></View></View><TextInput accessibilityLabel="音枢歌单名称" value={name} onChangeText={setName} style={styles.input}/>
      <TextInput accessibilityLabel="音枢歌单描述" value={description} onChangeText={setDescription} placeholder="歌单描述（可选）" placeholderTextColor={s.subtle} style={styles.input}/>
      <TextInput accessibilityLabel="音枢歌单封面地址" value={coverUrl} onChangeText={setCoverUrl} placeholder="封面图片地址（可选）" placeholderTextColor={s.subtle} style={styles.input}/><View style={styles.row}>
      {button('保存信息',()=>{void perform(async()=>{await services.library.renamePlaylist(playlist.id,name);await services.library.updatePlaylistMeta(playlist.id,{description,coverUrl});});},busy||!name.trim(),undefined,true)}
      {button('删除歌单',()=>Alert.alert('删除此音枢歌单？','不会删除其他歌单中的相同歌曲。',[{text:'取消',style:'cancel'},{text:'删除',style:'destructive',onPress:()=>{void perform(async()=>{const snapshot=playlist;await services.library.deletePlaylist(playlist.id);setUndoSnapshot(snapshot);});}}]))}
      {button('返回歌单列表',()=>setSelected(null))}
    </View></View>:tab==='playlists'?<View style={{gap:10}}>
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>新建自建歌单</Text>
        <TextInput accessibilityLabel="创建音枢歌单名称" value={name} onChangeText={setName} placeholder="新歌单名称" placeholderTextColor={s.subtle} style={styles.input}/>
        <TextInput accessibilityLabel="创建音枢歌单描述" value={description} onChangeText={setDescription} placeholder="歌单描述（可选）" placeholderTextColor={s.subtle} style={styles.input}/>
        <TextInput accessibilityLabel="创建音枢歌单封面地址" value={coverUrl} onChangeText={setCoverUrl} placeholder="封面图片地址（可选）" placeholderTextColor={s.subtle} style={styles.input}/>
        <View style={{alignSelf:'flex-start'}}>{button('创建歌单',()=>{void perform(async()=>{const id=await services.library.createPlaylist(name,[],{description,coverUrl});setSelected(id);});},busy||!name.trim(),'library-create-playlist-submit',true)}</View>
      </View>
      {library.playlists.length===0&&<Text style={[styles.caption,{textAlign:'center',paddingVertical:14}]}>还没有歌单，可以新建或收藏一个</Text>}
      {library.playlists.map((item,index)=>{const cover=playlistCoverSource(item.coverUrl,item.entries[0]?.track);return <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} · ${item.entries.length}首`} key={item.id} onPress={()=>setSelected(item.id)} style={styles.playlistCard}><Cover services={services} url={cover.url} track={cover.track} size={56} radius={12} testID={`library-playlist-cover-${index}`}/><View style={{flex:1,gap:2}}><Text numberOfLines={1} style={styles.track}>{item.title}</Text><Text numberOfLines={1} style={styles.caption}>{item.entries.length} 首{item.description?` · ${item.description}`:''}</Text></View><Ionicons name="chevron-forward" size={16} color={s.subtle}/></Pressable>})}
    </View>:null}
    {!!tracks.length&&<View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
      <Pressable accessibilityRole="button" accessibilityLabel="播放全部" onPress={()=>services.playTracks(tracks,0)} style={{flex:1,minHeight:42,borderRadius:21,backgroundColor:s.control,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:14}}><Ionicons name="play" size={16} color="#FFFFFF"/><Text style={{color:'#FFFFFF',fontSize:14,fontWeight:'600'}}>播放全部</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="随机播放" onPress={()=>{void services.preferences.update({repeat:'off',shuffle:true}).then(()=>services.playTracks(tracks,0)).catch(()=>setMessage('无法保存随机模式，请重试'));}} style={{flex:1,minHeight:42,borderRadius:21,backgroundColor:s.cardElevated,borderWidth:1,borderColor:s.cardBorder,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:14}}><Ionicons name="shuffle" size={16} color={s.control}/><Text style={{color:s.ink,fontSize:14,fontWeight:'600'}}>随机播放</Text></Pressable>
      {button('全部歌曲与批量管理',()=>setListOpen(true))}
    </View>}
    {tracks.slice(0,visibleCount).map((track,index)=><Fragment key={playlist?.entries[index]?.id??`${index}-${track.origin.id}`}>
      {tab==='history'&&(index===0||historyTimestamp(library.history[index]?.playedAt).day!==historyTimestamp(library.history[index-1]?.playedAt).day)&&<View style={styles.historyDayRow}><View style={styles.historyDayDot}/><Text testID={`history-day-${index}`} accessibilityRole="header" style={styles.historyDay}>{historyTimestamp(library.history[index]?.playedAt).day}</Text></View>}
      <View testID={tab==='history'?`history-item-${index}`:undefined} style={tab==='history'?styles.historyRow:styles.trackRow}>
      {tab==='history'&&<View style={styles.historyRail}><View style={styles.historyDot}/><View style={styles.historyLine}/><Text style={styles.historyTime}>{historyTimestamp(library.history[index]?.playedAt).clock}</Text></View>}
      <View style={tab==='history'?styles.historyCard:styles.trackInner}>
        <Pressable accessibilityRole="button" onPress={()=>services.playTracks(tracks,index)} style={{flex:1,flexDirection:'row',alignItems:'center',gap:11}}>
          <Cover services={services} track={track} size={46} radius={10}/>
          <View style={{flex:1,gap:2}}><Text numberOfLines={1} style={styles.track}>{track.title}</Text><Text numberOfLines={1} style={styles.caption}>{track.artist}{track.album?` · ${track.album}`:''} · {track.origin.kind==='online'?track.origin.platform:track.origin.kind==='imported'?`汽水 · ${services.library.matchFor(track)?'已匹配':'待匹配'}`:track.origin.kind==='local'?'本地音频':track.origin.kind==='device'?'设备媒体库':track.origin.kind==='webdav'?'WebDAV':'私人曲库'}</Text></View>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`更多操作：${track.title}`} onPress={()=>setMenu({track,entryId:playlist?.entries[index]?.id,playlistId:playlist?.id,history:tab==='history'})} style={styles.moreButton}><Ionicons name="ellipsis-horizontal" size={19} color={s.muted}/></Pressable>
      </View>
    </View></Fragment>)}
    {tracks.length>visibleCount&&<View style={styles.loadMore}><Text style={styles.caption}>已显示 {Math.min(visibleCount,tracks.length)} / {tracks.length} 首</Text>{button('加载更多歌曲',()=>setVisibleCount(count=>Math.min(count+20,tracks.length)))}</View>}
    {!tracks.length&&tab!=='playlists'&&<View style={styles.empty}><Ionicons name={tab==='favorites'?'heart-outline':'time-outline'} size={34} color={s.subtle}/><Text style={styles.emptyTitle}>{tab==='favorites'?'还没有收藏歌曲':'还没有播放历史'}</Text><Text style={styles.caption}>{tab==='favorites'?'搜索或发现喜欢的歌后，可收藏到这里。':'开始播放音乐后，记录会按时间线出现在这里。'}</Text></View>}
    {tab==='history'&&library.history.length>0&&<View style={{alignSelf:'flex-start'}}>{button('清空播放历史',()=>Alert.alert('清空音枢播放历史？','不会修改服务端播放记录。',[{text:'取消',style:'cancel'},{text:'清空',style:'destructive',onPress:()=>{void perform(async()=>{await services.library.clearHistory();});}}]))}</View>}
    <AccountRecommendations services={services} openAccounts={openAccounts}/>
    {recommendations.recommendations.length>0&&<View testID="local-recommendations" style={styles.card}><View style={styles.recommendationHeader}><View style={{flex:1}}><Text style={styles.heading}>本地推荐</Text><Text style={styles.caption}>根据本机收藏、历史、歌单与聆听统计生成</Text></View><Pressable testID="local-fm" accessibilityRole="button" accessibilityLabel="开始本地FM" onPress={()=>{try{const tracks=services.recommendations.nextFM(10);if(tracks.length)services.playTracks(tracks,0);else setMessage('暂无可播放的本地 FM 曲目');}catch{setMessage('本地 FM 暂时不可用，请重试');}}} style={{width:40,height:40,borderRadius:20,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center'}}><Ionicons name="radio-outline" size={20} color={s.control}/></Pressable></View>{recommendations.recommendations.slice(0,5).map(item=><Pressable key={JSON.stringify(item.track.origin)} accessibilityRole="button" accessibilityLabel={`播放本地推荐：${item.track.title}`} onPress={()=>services.playTracks([item.track],0)} style={styles.recommendationRow}><Cover services={services} track={item.track} size={42} radius={9}/><View style={{flex:1}}><Text numberOfLines={1} style={styles.track}>{item.track.title}</Text><Text numberOfLines={1} style={styles.caption}>{item.track.artist} · {item.reasons.map(reason=>({favorite:'收藏',recent:'最近播放',frequent:'常听',playlist:'歌单',library:'曲库'}[reason])).join(' · ')}</Text></View><Ionicons name="play-circle-outline" size={22} color={s.control}/></Pressable>)}</View>}
    <SavedCatalogs services={services}/>
    <View style={{gap:6}}><LocalAudioLibrary services={services}/><DeviceMediaLibrary services={services}/><WebDAVLibrary services={services}/></View>
    {playbackStats.items.length>0&&<View style={styles.card}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={styles.heading}>实际聆听统计</Text>{button('清空播放统计',()=>Alert.alert('清空播放统计？','只清除本机记录；服务端播放量和最近播放列表不变。',[{text:'取消',style:'cancel'},{text:'清空',style:'destructive',onPress:()=>{void perform(async()=>services.playbackStats.clear());}}]))}</View>{playbackStats.items.slice(0,5).map(item=><Text key={JSON.stringify(item.track.origin)} style={styles.caption}>{item.track.title} · 播放 {item.playCount} 次 · 听歌 {Math.floor(item.listenedMs/60000)}分{Math.floor(item.listenedMs/1000)%60}秒</Text>)}</View>}
    {services.recoveryWarnings.map((warning,index)=><Text key={index} style={styles.caption}>{warning}</Text>)}
    <LibraryDataTools services={services}/>
    {!!message&&<Text accessibilityLiveRegion="polite" style={styles.caption}>{message}</Text>}
    <Toast message={undoSnapshot?`已删除歌单「${undoSnapshot.title}」`:''} onDismiss={()=>setUndoSnapshot(null)} action={undoSnapshot?{label:'撤销',onRun:()=>{void perform(async()=>{await services.library.restorePlaylist(undoSnapshot);});}}:undefined}/>
    <TrackListModal services={services} tracks={tracks} entryIds={playlist?.entries.map(item=>item.id)} playlistId={playlist?.id} kind={playlist?'playlist':tab==='history'?'history':'favorites'} title={playlist?.title??(tab==='history'?'最近播放':'我的收藏')} coverUrl={playlist?.coverUrl} visible={listOpen} onClose={()=>setListOpen(false)}/>
    <TrackActions services={services} track={menu?.track??null} prefix="library" extras favoriteScope="library" additionalActions={managementActions} closeLabel="收起音乐库歌曲更多操作" onClose={()=>setMenu(null)}/>
  </View>;
}
const makeStyles=(theme:Theme)=>{
  const s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  return StyleSheet.create({
    header:{flexDirection:'row',alignItems:'center',gap:12,paddingTop:2},
    headerActions:{flexDirection:'row',gap:8},
    iconButton:{width:40,height:40,borderRadius:20,backgroundColor:s.accent,alignItems:'center',justifyContent:'center'},
    title:{color:s.ink,fontSize:34,fontWeight:'800',letterSpacing:-0.6},
    heading:{color:s.ink,fontSize:17,fontWeight:'700'},
    sectionLabel:{color:s.muted,fontSize:13,fontWeight:'600'},
    caption:{color:s.muted,fontSize:12,lineHeight:18},
    row:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:4},
    card:{padding:14,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:10},
    playlistCard:{padding:12,borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,flexDirection:'row',alignItems:'center',gap:12},
    recommendationHeader:{flexDirection:'row',alignItems:'center',gap:12},
    recommendationRow:{minHeight:54,paddingVertical:7,borderTopWidth:StyleSheet.hairlineWidth,borderColor:s.hairline,flexDirection:'row',alignItems:'center',gap:11},
    tabs:{flexDirection:'row',gap:4,padding:3,borderRadius:22,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder},
    tabButton:{flex:1,minHeight:38,alignItems:'center',justifyContent:'center',borderRadius:19},
    tabButtonSelected:{backgroundColor:s.cardElevated,...s.cardShadow},
    tabLabel:{color:s.muted,fontSize:13,fontWeight:'500'},
    tabLabelSelected:{color:s.ink,fontWeight:'700'},
    button:{minHeight:40,paddingHorizontal:14,paddingVertical:8,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,justifyContent:'center',alignItems:'center'},
    buttonPrimary:{backgroundColor:s.control,borderColor:s.control},
    action:{color:s.ink,fontSize:13,fontWeight:'600'},
    actionPrimary:{color:'#FFFFFF'},
    track:{color:s.ink,fontSize:15,fontWeight:'600',lineHeight:20},
    trackRow:{paddingVertical:9,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:s.hairline},
    trackInner:{flexDirection:'row',alignItems:'center',gap:8},
    historyDayRow:{flexDirection:'row',alignItems:'center',gap:8,marginTop:10,marginBottom:2},
    historyDayDot:{width:8,height:8,borderRadius:4,backgroundColor:s.accent},
    historyDay:{color:s.ink,fontSize:15,fontWeight:'700'},
    historyRow:{flexDirection:'row',alignItems:'center',gap:8,marginVertical:3},
    historyRail:{width:54,alignItems:'center',flexDirection:'row',gap:6},
    historyTime:{color:s.muted,fontSize:11,fontWeight:'600',fontVariant:['tabular-nums']},
    historyLine:{position:'absolute',left:3.5,top:14,bottom:-18,width:1,backgroundColor:s.accent+'44'},
    historyDot:{width:8,height:8,borderRadius:4,backgroundColor:s.accent,zIndex:1},
    historyCard:{flex:1,flexDirection:'row',alignItems:'center',gap:8,padding:10,borderRadius:16,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder},
    loadMore:{alignItems:'center',paddingVertical:10,gap:6},
    input:{color:s.ink,backgroundColor:s.inputBg,borderWidth:1,borderColor:s.cardBorder,paddingHorizontal:14,paddingVertical:11,borderRadius:14,fontSize:14},
    empty:{paddingVertical:28,paddingHorizontal:20,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,alignItems:'center',gap:6},
    emptyTitle:{color:s.ink,fontSize:16,fontWeight:'700'},
    moreButton:{width:36,height:40,alignItems:'center',justifyContent:'center'},
  });
};
