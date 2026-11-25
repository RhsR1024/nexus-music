import {SavedCatalogs} from './SavedCatalogs.tsx';
import {LibraryDataTools} from './LibraryDataTools.tsx';
import {AccountRecommendations} from './AccountRecommendations.tsx';
import {Cover} from './Cover.tsx';
import {QualityBadge} from './QualityBadge.tsx';
import {PlaybackStatistics} from './PlaybackStatistics.tsx';
import {Text,TextInput} from './Typography.tsx';
import {WebDAVLibrary} from './WebDAVLibrary.tsx';
import {DeviceMediaLibrary} from './DeviceMediaLibrary.tsx';
import {LocalAudioLibrary} from './LocalAudioLibrary.tsx';
import {TrackListModal} from './TrackListModal.tsx';
import {TrackActions,type AdditionalTrackAction} from './TrackActions.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {Fragment,useEffect,useMemo,useState,useSyncExternalStore} from 'react';
import {historyTimestamp} from '../domain/historyPresentation.ts';
import {listeningDuration} from '../domain/listeningStatistics.ts';
import {Alert, Pressable, StyleSheet, View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {LocalPlaylist} from '../storage/library.ts';
import {Toast} from './Toast.tsx';
import type {Track} from '../domain/track.ts';
import {playlistCoverSource} from '../domain/playlistCover.ts';

type PlaylistSort='default'|'name'|'count';

export function LibraryHome({
  services,
  openSearch,
  openSettings,
  openAccounts,
  bottomInset=0,
}:{
  services:Services;
  openSearch:()=>void;
  openSettings:()=>void;
  openAccounts:()=>void;
  bottomInset?:number;
}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const styles=useThemedStyles(makeStyles);
  const library=useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const playbackStats=useSyncExternalStore(services.playbackStats.subscribe,services.playbackStats.getSnapshot);
  const recommendations=useSyncExternalStore(services.recommendations.subscribe,services.recommendations.getSnapshot);

  const [tab,setTab]=useState<'favorites'|'history'|'playlists'>('favorites');
  const [selected,setSelected]=useState<string|null>(null);
  const [composerOpen,setComposerOpen]=useState(true);
  const [dailyExpanded,setDailyExpanded]=useState(false);
  const [playlistQuery,setPlaylistQuery]=useState('');
  const [playlistSort,setPlaylistSort]=useState<PlaylistSort>('default');
  const [name,setName]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[visibleCount,setVisibleCount]=useState(20);
  const [description,setDescription]=useState(''),[coverUrl,setCoverUrl]=useState(''),[undoSnapshot,setUndoSnapshot]=useState<LocalPlaylist|null>(null);
  const [listOpen,setListOpen]=useState(false);
  const [menu,setMenu]=useState<{track:Track;entryId?:string;playlistId?:string;history:boolean}|null>(null);

  const playlist=library.playlists.find(item=>item.id===selected);
  useEffect(()=>{
    if(selected&&!playlist)setSelected(null);
    setName(playlist?.title??'');
    setDescription(playlist?.description??'');
    setCoverUrl(playlist?.coverUrl??'');
    setVisibleCount(20);
  },[selected,playlist?.title,playlist?.description,playlist?.coverUrl,tab]);

  const filteredPlaylists=useMemo(()=>{
    const q=playlistQuery.trim().toLowerCase();
    const list=q
      ?library.playlists.filter(item=>item.title.toLowerCase().includes(q)||(item.description??'').toLowerCase().includes(q))
      :[...library.playlists];
    if(playlistSort==='name')return [...list].sort((a,b)=>a.title.localeCompare(b.title,'zh-Hans-CN'));
    if(playlistSort==='count')return [...list].sort((a,b)=>b.entries.length-a.entries.length||a.title.localeCompare(b.title,'zh-Hans-CN'));
    return list;
  },[library.playlists,playlistQuery,playlistSort]);

  const totalListenedMs=useMemo(()=>playbackStats.items.reduce((sum,item)=>sum+item.listenedMs,0),[playbackStats.items]);
  const totalPlays=useMemo(()=>playbackStats.items.reduce((sum,item)=>sum+item.playCount,0),[playbackStats.items]);
  const today=useMemo(()=>{
    const d=new Date();
    return {month:`${d.getMonth()+1}月`,day:String(d.getDate())};
  },[]);

  async function perform(run:()=>Promise<void>){
    setBusy(true);setMessage('');
    try{await run();}
    catch{setMessage('保存未完成，已有音乐库保留；请重试');}
    finally{setBusy(false);}
  }

  const button=(label:string,action:()=>void,disabled=busy,testID?:string,primary=false)=><Pressable testID={testID} accessibilityRole="button" onPress={action} disabled={disabled} style={[styles.button,primary&&styles.buttonPrimary,disabled&&{opacity:.4}]}><Text style={[styles.action,primary&&styles.actionPrimary]}>{label}</Text></Pressable>;
  const openPlaylistComposer=()=>{setTab('playlists');setSelected(null);setName('');setDescription('');setCoverUrl('');setComposerOpen(true);};
  const iconButton=(id:string,label:string,icon:React.ComponentProps<typeof Ionicons>['name'],action:()=>void)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} onPress={action} style={styles.iconButton}><Ionicons name={icon} size={20} color="#FFFFFF"/></Pressable>;
  const tabButton=(value:'favorites'|'history'|'playlists',label:string)=><Pressable key={value} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:tab===value}} onPress={()=>{setTab(value);setSelected(null);}} style={[styles.tabButton,tab===value&&styles.tabButtonSelected]}><Text style={[styles.tabLabel,tab===value&&styles.tabLabelSelected]}>{label}</Text></Pressable>;

  const tracks=playlist?playlist.entries.map(item=>item.track):tab==='favorites'?library.favorites:tab==='history'?library.history.map(item=>item.track):[];
  const selectedCover=playlist?playlistCoverSource(playlist.coverUrl,playlist.entries[0]?.track):undefined;
  const dailyTracks=recommendations.recommendations.map(item=>item.track);

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

  const playPrimaryBg=s.dark?'#F0E8EA':'#3A3333';
  const playPrimaryInk=s.dark?'#1F191C':'#FFFFFF';

  return <View style={{gap:12,paddingBottom:bottomInset}}>
    {/* Sollin 277-library.png: Display title + 3 coral circular action buttons */}
    <View style={styles.header}>
      <View style={{flex:1}}>
        <Text accessibilityRole="header" accessibilityLabel="我的音乐库" style={styles.title}>音乐库</Text>
        <Text style={styles.caption}>收藏 {library.favorites.length} · 歌单 {library.playlists.length} · 历史 {library.history.length} · 播放统计 {playbackStats.items.length}</Text>
      </View>
      <View style={styles.headerActions}>
        {iconButton('library-create-playlist','创建歌单','add',openPlaylistComposer)}
        {iconButton('library-open-search','搜索歌曲','search-outline',openSearch)}
        {iconButton('library-open-settings','音乐来源','menu',openSettings)}
      </View>
    </View>

    {/* Sollin 277-library.png: Iconic dark frosted glass Daily Recommendation calendar card */}
    {!playlist&&<View testID={dailyTracks.length>0?'local-recommendations':undefined} style={styles.dailySection}>
      <View style={styles.dailyTopRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="每日推荐" onPress={()=>{if(dailyTracks.length)setDailyExpanded(value=>!value);else openAccounts();}} style={styles.dailyCalendarWrap}>
          <LinearGradient colors={['#4A3832','#271F1E','#3D2E30']} start={{x:0.1,y:0}} end={{x:0.9,y:1}} style={styles.dailyCalendar}>
            <View style={styles.dailyCalendarTop}>
              <Text style={styles.dailyMonth}>{today.month}</Text>
              <Ionicons name="sparkles" size={16} color="rgba(255,255,255,0.92)"/>
            </View>
            <Text style={styles.dailyDay}>{today.day}</Text>
            <Text style={styles.dailyBadge}>今日推荐</Text>
          </LinearGradient>
        </Pressable>
        <View style={styles.dailyInfo}>
          <Text style={styles.dailyTitle}>每日推荐</Text>
          <Text style={styles.caption}>{dailyTracks.length?`${dailyTracks.length} 首 · 为你挑选`:'聆听与收藏后生成专属推荐'}</Text>
          <View style={styles.dailyButtons}>
            <Pressable accessibilityRole="button" accessibilityLabel="一键播放每日推荐" onPress={()=>{if(dailyTracks.length)services.playTracks(dailyTracks,0);else openAccounts();}} style={[styles.dailyActionBtn,{backgroundColor:playPrimaryBg}]}>
              <Ionicons name="play" size={14} color={playPrimaryInk}/>
              <Text style={{color:playPrimaryInk,fontSize:12.5,fontWeight:'600'}}>{dailyTracks.length?'播放日推':'去登录'}</Text>
            </Pressable>
            {dailyTracks.length>0&&<Pressable accessibilityRole="button" accessibilityLabel={dailyExpanded?'收起每日推荐':'展开每日推荐'} onPress={()=>setDailyExpanded(value=>!value)} style={styles.dailyGhostBtn}>
              <Text style={{color:s.ink,fontSize:12.5,fontWeight:'600'}}>{dailyExpanded?'收起':'展开'}</Text>
            </Pressable>}
            {dailyTracks.length>0&&<Pressable testID="local-fm" accessibilityRole="button" accessibilityLabel="开始本地FM" onPress={()=>{try{const fmTracks=services.recommendations.nextFM(10);if(fmTracks.length)services.playTracks(fmTracks,0);else setMessage('暂无可播放的本地 FM 曲目');}catch{setMessage('本地 FM 暂时不可用，请重试');}}} style={styles.dailyFmBtn}>
              <Ionicons name="radio-outline" size={16} color={s.accent}/>
            </Pressable>}
          </View>
        </View>
      </View>
      {dailyExpanded&&dailyTracks.length>0&&<View style={styles.dailyList}>
        {recommendations.recommendations.slice(0,8).map((item,idx)=><Pressable key={`${idx}-${JSON.stringify(item.track.origin)}`} accessibilityRole="button" accessibilityLabel={`播放本地推荐：${item.track.title}`} onPress={()=>services.playTracks(dailyTracks,idx)} style={styles.recommendationRow}>
          <Cover services={services} track={item.track} size={42} radius={9}/>
          <View style={{flex:1,gap:2}}>
            <Text numberOfLines={1} style={styles.track}>{item.track.title}</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
              <QualityBadge track={item.track}/>
              <Text numberOfLines={1} style={[styles.caption,{flex:1}]}>{item.track.artist} · {item.reasons.map(reason=>({favorite:'收藏',recent:'最近播放',frequent:'常听',playlist:'歌单',library:'曲库'}[reason])).join(' · ')}</Text>
            </View>
          </View>
          <Ionicons name="play-circle-outline" size={21} color={s.accent}/>
        </Pressable>)}
      </View>}
    </View>}

    {/* Borderless soft-translucent 3-segment tabs */}
    <View style={styles.tabs}>{tabButton('favorites','我的收藏')}{tabButton('history','最近播放')}{tabButton('playlists','我的歌单')}</View>

    {playlist?<View style={styles.softCard}>
      <View style={{flexDirection:'row',gap:14,alignItems:'center'}}>
        <View style={s.cardShadow}><Cover services={services} url={selectedCover?.url} track={selectedCover?.track} size={84} radius={14} testID="library-playlist-detail-cover"/></View>
        <View style={{flex:1,gap:3}}>
          <Text style={styles.heading}>{playlist.title}</Text>
          <Text style={styles.caption}>{playlist.entries.length} 首歌曲</Text>
        </View>
      </View>
      <TextInput accessibilityLabel="音枢歌单名称" value={name} onChangeText={setName} style={styles.input}/>
      <TextInput accessibilityLabel="音枢歌单描述" value={description} onChangeText={setDescription} placeholder="歌单描述（可选）" placeholderTextColor={s.subtle} style={styles.input}/>
      <TextInput accessibilityLabel="音枢歌单封面地址" value={coverUrl} onChangeText={setCoverUrl} placeholder="封面图片地址（可选）" placeholderTextColor={s.subtle} style={styles.input}/>
      <View style={styles.row}>
        {button('保存信息',()=>{void perform(async()=>{await services.library.renamePlaylist(playlist.id,name);await services.library.updatePlaylistMeta(playlist.id,{description,coverUrl});});},busy||!name.trim(),undefined,true)}
        {button('删除歌单',()=>Alert.alert('删除此音枢歌单？','不会删除其他歌单中的相同歌曲。',[{text:'取消',style:'cancel'},{text:'删除',style:'destructive',onPress:()=>{void perform(async()=>{const snapshot=playlist;await services.library.deletePlaylist(playlist.id);setUndoSnapshot(snapshot);});}}]))}
        {button('返回歌单列表',()=>setSelected(null))}
      </View>
    </View>:tab==='playlists'?<View style={{gap:10}}>
      {/* Compact collapsible composer card (starts visible in playlists tab for zero UITest breakage) */}
      <View style={styles.softCard}>
        <Pressable accessibilityRole="button" accessibilityLabel={composerOpen?'收起新建歌单':'展开新建歌单'} onPress={()=>setComposerOpen(v=>!v)} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
            <Ionicons name="add-circle" size={18} color={s.accent}/>
            <Text style={styles.sectionLabel}>新建自建歌单</Text>
          </View>
          <Ionicons name={composerOpen?'chevron-up':'chevron-down'} size={16} color={s.subtle}/>
        </Pressable>
        {composerOpen&&<View style={{gap:8}}>
          <View style={{flexDirection:'row',gap:8,alignItems:'center'}}>
            <TextInput accessibilityLabel="创建音枢歌单名称" value={name} onChangeText={setName} placeholder="新歌单名称" placeholderTextColor={s.subtle} style={[styles.input,{flex:1}]}/>
            {button('创建歌单',()=>{void perform(async()=>{const id=await services.library.createPlaylist(name,[],{description,coverUrl});setSelected(id);});},busy||!name.trim(),'library-create-playlist-submit',true)}
          </View>
          <View style={{flexDirection:'row',gap:8}}>
            <TextInput accessibilityLabel="创建音枢歌单描述" value={description} onChangeText={setDescription} placeholder="描述（可选）" placeholderTextColor={s.subtle} style={[styles.input,{flex:1}]}/>
            <TextInput accessibilityLabel="创建音枢歌单封面地址" value={coverUrl} onChangeText={setCoverUrl} placeholder="封面图片地址（可选）" placeholderTextColor={s.subtle} style={[styles.input,{flex:1}]}/>
          </View>
        </View>}
      </View>

      {/* Playlist filter & sort toolbar */}
      {library.playlists.length>0&&<View style={{gap:8}}>
        <View style={styles.playlistSearchBar}>
          <Ionicons name="search-outline" size={16} color={s.subtle}/>
          <TextInput accessibilityLabel="搜索我的歌单" value={playlistQuery} onChangeText={setPlaylistQuery} placeholder="搜索歌单名称或描述" placeholderTextColor={s.subtle} style={styles.playlistSearchInput}/>
          {!!playlistQuery&&<Pressable accessibilityRole="button" accessibilityLabel="清空歌单筛选" onPress={()=>setPlaylistQuery('')} style={{padding:4}}><Ionicons name="close-circle" size={16} color={s.subtle}/></Pressable>}
        </View>
        <View style={{flexDirection:'row',gap:6}}>
          {([['default','默认'],['name','名称'],['count','曲数']] as const).map(([key,label])=>{
            const active=playlistSort===key;
            return <Pressable key={key} accessibilityRole="radio" accessibilityState={{selected:active}} onPress={()=>setPlaylistSort(key)} style={[styles.sortChip,active&&styles.sortChipActive]}>
              <Text style={[styles.sortChipText,active&&styles.sortChipTextActive]}>{label}</Text>
            </Pressable>;
          })}
        </View>
      </View>}

      {library.playlists.length===0?<Text style={[styles.caption,{textAlign:'center',paddingVertical:18}]}>还没有歌单，可以新建或收藏一个</Text>
      :filteredPlaylists.length===0?<Text style={[styles.caption,{textAlign:'center',paddingVertical:16}]}>没有匹配的歌单</Text>
      :filteredPlaylists.map((item,index)=>{
        const cover=playlistCoverSource(item.coverUrl,item.entries[0]?.track);
        return <Pressable accessibilityRole="button" accessibilityLabel={`${item.title} · ${item.entries.length}首`} key={item.id} onPress={()=>setSelected(item.id)} style={styles.playlistRow}>
          <Cover services={services} url={cover.url} track={cover.track} size={56} radius={12} testID={`library-playlist-cover-${index}`}/>
          <View style={{flex:1,gap:2}}>
            <Text numberOfLines={1} style={styles.track}>{item.title}</Text>
            <Text numberOfLines={1} style={styles.caption}>{item.entries.length} 首{item.description?` · ${item.description}`:''}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={s.subtle}/>
        </Pressable>;
      })}
    </View>:null}

    {!!tracks.length&&<View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
      <Pressable accessibilityRole="button" accessibilityLabel="播放全部" onPress={()=>services.playTracks(tracks,0)} style={{flex:1,minHeight:44,borderRadius:14,backgroundColor:playPrimaryBg,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:14}}>
        <Ionicons name="play" size={15} color={playPrimaryInk}/>
        <Text style={{color:playPrimaryInk,fontSize:14,fontWeight:'600'}}>播放全部</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="随机播放" onPress={()=>{void services.preferences.update({repeat:'off',shuffle:true}).then(()=>services.playTracks(tracks,0)).catch(()=>setMessage('无法保存随机模式，请重试'));}} style={{flex:1,minHeight:44,borderRadius:14,backgroundColor:s.dark?'rgba(255,255,255,0.09)':'rgba(255,255,255,0.46)',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:14}}>
        <Ionicons name="shuffle" size={16} color={s.ink}/>
        <Text style={{color:s.ink,fontSize:14,fontWeight:'600'}}>随机播放</Text>
      </Pressable>
      {button('全部歌曲与批量管理',()=>setListOpen(true))}
    </View>}

    {/* Frameless Sollin song rows with QualityBadge (Sollin q98_music_library_favorite_one) */}
    {tracks.slice(0,visibleCount).map((track,index)=><Fragment key={playlist?.entries[index]?.id??`${index}-${track.origin.id}`}>
      {tab==='history'&&(index===0||historyTimestamp(library.history[index]?.playedAt).day!==historyTimestamp(library.history[index-1]?.playedAt).day)&&<View style={styles.historyDayRow}><View style={styles.historyDayDot}/><Text testID={`history-day-${index}`} accessibilityRole="header" style={styles.historyDay}>{historyTimestamp(library.history[index]?.playedAt).day}</Text></View>}
      <View testID={tab==='history'?`history-item-${index}`:undefined} style={tab==='history'?styles.historyRow:styles.trackRow}>
        {tab==='history'&&<View style={styles.historyRail}><View style={styles.historyDot}/><View style={styles.historyLine}/><Text style={styles.historyTime}>{historyTimestamp(library.history[index]?.playedAt).clock}</Text></View>}
        <View style={tab==='history'?styles.historyCard:styles.trackInner}>
          <Pressable accessibilityRole="button" onPress={()=>services.playTracks(tracks,index)} style={{flex:1,flexDirection:'row',alignItems:'center',gap:12}}>
            <Cover services={services} track={track} size={46} radius={10}/>
            <View style={{flex:1,gap:3}}>
              <Text numberOfLines={1} style={styles.track}>{track.title}</Text>
              <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                <QualityBadge track={track}/>
                <Text numberOfLines={1} style={[styles.caption,{flex:1}]}>{track.artist}{track.album?` · ${track.album}`:''} · {track.origin.kind==='online'?track.origin.platform:track.origin.kind==='imported'?`汽水 · ${services.library.matchFor(track)?'已匹配':'待匹配'}`:track.origin.kind==='local'?'本地音频':track.origin.kind==='device'?'设备媒体库':track.origin.kind==='webdav'?'WebDAV':'私人曲库'}</Text>
              </View>
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`更多操作：${track.title}`} onPress={()=>setMenu({track,entryId:playlist?.entries[index]?.id,playlistId:playlist?.id,history:tab==='history'})} style={styles.moreButton}><Ionicons name="ellipsis-horizontal" size={19} color={s.muted}/></Pressable>
        </View>
      </View>
    </Fragment>)}

    {tracks.length>visibleCount&&<View style={styles.loadMore}><Text style={styles.caption}>已显示 {Math.min(visibleCount,tracks.length)} / {tracks.length} 首</Text>{button('加载更多歌曲',()=>setVisibleCount(count=>Math.min(count+20,tracks.length)))}</View>}
    {!tracks.length&&tab!=='playlists'&&<View style={styles.empty}><Ionicons name={tab==='favorites'?'heart-outline':'time-outline'} size={34} color={s.subtle}/><Text style={styles.emptyTitle}>{tab==='favorites'?'还没有收藏歌曲':'还没有播放历史'}</Text><Text style={styles.caption}>{tab==='favorites'?'搜索或发现喜欢的歌后，可收藏到这里。':'开始播放音乐后，记录会按时间线出现在这里。'}</Text></View>}
    {tab==='history'&&library.history.length>0&&<View style={{alignSelf:'flex-start'}}>{button('清空播放历史',()=>Alert.alert('清空音枢播放历史？','不会修改服务端播放记录。',[{text:'取消',style:'cancel'},{text:'清空',style:'destructive',onPress:()=>{void perform(async()=>{await services.library.clearHistory();});}}]))}</View>}

    <AccountRecommendations services={services} openAccounts={openAccounts}/>
    <SavedCatalogs services={services}/>
    <View style={{gap:6}}><LocalAudioLibrary services={services}/><DeviceMediaLibrary services={services}/><WebDAVLibrary services={services}/></View>

    {/* Dedicated Playback Statistics overview card + clear entry to full statistics */}
    <View style={styles.softCard}>
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
        <View style={{flex:1}}>
          <Text style={styles.heading}>实际聆听统计</Text>
          <Text style={[styles.caption,{fontVariant:['tabular-nums']}]}>{playbackStats.items.length} 首曲目 · {totalPlays} 次播放 · {listeningDuration(totalListenedMs)}</Text>
        </View>
        {playbackStats.items.length>0&&button('清空播放统计',()=>Alert.alert('清空播放统计？','只清除本机记录；服务端播放量和最近播放列表不变。',[{text:'取消',style:'cancel'},{text:'清空',style:'destructive',onPress:()=>{void perform(async()=>services.playbackStats.clear());}}]))}
      </View>
      {playbackStats.items.slice(0,3).map(item=><Text key={JSON.stringify(item.track.origin)} numberOfLines={1} style={[styles.caption,{fontVariant:['tabular-nums']}]}>{item.track.title} · 播放 {item.playCount} 次 · 听歌 {Math.floor(item.listenedMs/60000)}分{Math.floor(item.listenedMs/1000)%60}秒</Text>)}
      <PlaybackStatistics services={services} triggerTestID="library-open-statistics" triggerLabel="查看完整听歌统计"/>
    </View>

    {services.recoveryWarnings.map((warning,index)=><Text key={index} style={styles.caption}>{warning}</Text>)}
    <LibraryDataTools services={services}/>
    {!!message&&<Text accessibilityLiveRegion="polite" style={[styles.caption,{color:s.accent}]}>{message}</Text>}
    <Toast message={undoSnapshot?`已删除歌单「${undoSnapshot.title}」`:''} onDismiss={()=>setUndoSnapshot(null)} action={undoSnapshot?{label:'撤销',onRun:()=>{void perform(async()=>{await services.library.restorePlaylist(undoSnapshot);});}}:undefined}/>
    <TrackListModal services={services} tracks={tracks} entryIds={playlist?.entries.map(item=>item.id)} playlistId={playlist?.id} kind={playlist?'playlist':tab==='history'?'history':'favorites'} title={playlist?.title??(tab==='history'?'最近播放':'我的收藏')} coverUrl={playlist?.coverUrl} visible={listOpen} onClose={()=>setListOpen(false)}/>
    <TrackActions services={services} track={menu?.track??null} prefix="library" extras favoriteScope="library" additionalActions={managementActions} closeLabel="收起音乐库歌曲更多操作" onClose={()=>setMenu(null)}/>
  </View>;
}

const makeStyles=(theme:Theme)=>{
  const s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const soft=s.dark?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.46)';
  const segTrack=s.dark?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.34)';
  const segActive=s.dark?'rgba(255,255,255,0.16)':'rgba(255,255,255,0.82)';
  return StyleSheet.create({
    header:{flexDirection:'row',alignItems:'center',gap:12,paddingTop:2},
    headerActions:{flexDirection:'row',gap:8},
    iconButton:{width:40,height:40,borderRadius:20,backgroundColor:s.accent,alignItems:'center',justifyContent:'center',...s.cardShadow},
    title:{color:s.ink,fontSize:30,fontWeight:'700',lineHeight:36,letterSpacing:-0.5},
    heading:{color:s.ink,fontSize:17,fontWeight:'700'},
    sectionLabel:{color:s.ink,fontSize:14,fontWeight:'700'},
    caption:{color:s.muted,fontSize:12,lineHeight:18},
    row:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:4},
    softCard:{padding:14,borderRadius:20,backgroundColor:soft,gap:10},
    dailySection:{gap:10},
    dailyTopRow:{flexDirection:'row',alignItems:'center',gap:14},
    dailyCalendarWrap:{borderRadius:18,...s.cardShadow},
    dailyCalendar:{width:118,height:118,borderRadius:18,padding:12,justifyContent:'space-between',overflow:'hidden'},
    dailyCalendarTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
    dailyMonth:{color:'rgba(255,255,255,0.9)',fontSize:12.5,fontWeight:'600'},
    dailyDay:{color:'#FFFFFF',fontSize:42,lineHeight:46,fontWeight:'800',fontVariant:['tabular-nums'],letterSpacing:-1},
    dailyBadge:{color:'rgba(255,255,255,0.85)',fontSize:11.5,fontWeight:'600'},
    dailyInfo:{flex:1,gap:6},
    dailyTitle:{color:s.ink,fontSize:18,fontWeight:'700'},
    dailyButtons:{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap',marginTop:2},
    dailyActionBtn:{minHeight:36,paddingHorizontal:13,borderRadius:18,flexDirection:'row',alignItems:'center',gap:5},
    dailyGhostBtn:{minHeight:36,paddingHorizontal:12,borderRadius:18,backgroundColor:soft,justifyContent:'center'},
    dailyFmBtn:{width:36,height:36,borderRadius:18,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center'},
    dailyList:{borderRadius:18,backgroundColor:soft,paddingHorizontal:12,paddingVertical:4},
    playlistSearchBar:{flexDirection:'row',alignItems:'center',gap:8,minHeight:40,paddingHorizontal:12,borderRadius:16,backgroundColor:s.inputBg},
    playlistSearchInput:{flex:1,color:s.ink,fontSize:14,paddingVertical:7},
    sortChip:{paddingHorizontal:12,paddingVertical:6,borderRadius:14,backgroundColor:soft},
    sortChipActive:{backgroundColor:s.accent},
    sortChipText:{color:s.muted,fontSize:12,fontWeight:'600'},
    sortChipTextActive:{color:'#FFFFFF'},
    playlistRow:{padding:10,borderRadius:16,backgroundColor:soft,flexDirection:'row',alignItems:'center',gap:12},
    recommendationRow:{minHeight:54,paddingVertical:7,borderTopWidth:StyleSheet.hairlineWidth,borderColor:s.hairline,flexDirection:'row',alignItems:'center',gap:11},
    tabs:{flexDirection:'row',gap:4,padding:3,borderRadius:24,backgroundColor:segTrack},
    tabButton:{flex:1,minHeight:38,alignItems:'center',justifyContent:'center',borderRadius:21},
    tabButtonSelected:{backgroundColor:segActive,...s.cardShadow},
    tabLabel:{color:s.muted,fontSize:13,fontWeight:'500'},
    tabLabelSelected:{color:s.ink,fontWeight:'700'},
    button:{minHeight:40,paddingHorizontal:14,paddingVertical:8,borderRadius:20,backgroundColor:soft,justifyContent:'center',alignItems:'center'},
    buttonPrimary:{backgroundColor:s.accent},
    action:{color:s.ink,fontSize:13,fontWeight:'600'},
    actionPrimary:{color:'#FFFFFF'},
    track:{color:s.ink,fontSize:15,fontWeight:'600',lineHeight:20},
    trackRow:{paddingVertical:8},
    trackInner:{flexDirection:'row',alignItems:'center',gap:8},
    historyDayRow:{flexDirection:'row',alignItems:'center',gap:8,marginTop:10,marginBottom:2},
    historyDayDot:{width:8,height:8,borderRadius:4,backgroundColor:s.accent},
    historyDay:{color:s.ink,fontSize:15,fontWeight:'700'},
    historyRow:{flexDirection:'row',alignItems:'center',gap:8,marginVertical:3},
    historyRail:{width:54,alignItems:'center',flexDirection:'row',gap:6},
    historyTime:{color:s.muted,fontSize:11,fontWeight:'600',fontVariant:['tabular-nums']},
    historyLine:{position:'absolute',left:3.5,top:14,bottom:-18,width:1,backgroundColor:s.accent+'44'},
    historyDot:{width:8,height:8,borderRadius:4,backgroundColor:s.accent,zIndex:1},
    historyCard:{flex:1,flexDirection:'row',alignItems:'center',gap:8,padding:10,borderRadius:16,backgroundColor:soft},
    loadMore:{alignItems:'center',paddingVertical:10,gap:6},
    input:{color:s.ink,backgroundColor:s.inputBg,paddingHorizontal:12,paddingVertical:10,borderRadius:13,fontSize:14},
    empty:{paddingVertical:28,paddingHorizontal:20,borderRadius:20,backgroundColor:soft,alignItems:'center',gap:6},
    emptyTitle:{color:s.ink,fontSize:16,fontWeight:'700'},
    moreButton:{width:36,height:40,alignItems:'center',justifyContent:'center'},
  });
};
