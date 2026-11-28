import type {VideoItem} from '../providers/videos.ts';
import type {BrowseItem} from '../providers/discovery.ts';
import {MVDetail,videoDuration} from './MVDetail.tsx';
import type {ArtistItem} from '../providers/artists.ts';
import {Discovery,type DiscoveryTarget} from './Discovery.tsx';
import {Cover} from './Cover.tsx';
import {QualityBadge} from './QualityBadge.tsx';
import {controls,space,catalogArtwork,radius,sollinTokens} from './tokens.ts';
import {Text,TextInput} from './Typography.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {ActivityIndicator, Keyboard, Pressable, StyleSheet, View} from 'react-native';
import type { Services } from '../app/services.ts';
import type { OnlinePlatform, Track } from '../domain/track.ts';
import { trackKey } from '../domain/track.ts';
import { normalizeSearchQuery, suggestSearchQueries } from '../domain/searchHistory.ts';
import { platforms, type SearchGroup } from '../providers/searchCoordinator.ts';
import { asQishuiMatchedTrack } from '../providers/qishui.ts';
import {TrackActions} from './TrackActions.tsx';
import {BatchSelectionBar, type BatchAction} from './BatchSelectionBar.tsx';
import {PlaylistPicker} from './PlaylistPicker.tsx';
import {Toast,useToast} from './Toast.tsx';
import {selectionToggleAll,selectionByListOrder,selectionByTapOrder,selectionCount,selectionEnter,selectionHas,selectionToggle,selectionNone,type SelectionModel} from '../domain/selection.ts';
import {Ionicons} from '@expo/vector-icons';
import type {DownloadSubmission} from '../app/downloadSubmission.ts';
import {DownloadSubmissionModal} from './DownloadSubmission.tsx';

export type SearchPlatform = OnlinePlatform | 'qishui' | 'bodian';
export const platformNames: Readonly<Record<SearchPlatform,string>> = {wy:'网易云',tx:'QQ音乐',kw:'酷我',kg:'酷狗',mg:'咪咕',qishui:'汽水',bodian:'波点'};

const kindNames={song:'歌曲',playlist:'歌单',album:'专辑',artist:'艺术家',mv:'MV'} as const;
const kindIcons={all:'apps',song:'musical-note',playlist:'albums-outline',album:'disc-outline',artist:'person-circle-outline',mv:'play-circle-outline'} as const;
const platformIcons:Readonly<Record<'all'|SearchPlatform,React.ComponentProps<typeof Ionicons>['name']>>={all:'grid',wy:'musical-note',tx:'albums-outline',kw:'pulse',kg:'mic-outline',mg:'sparkles-outline',qishui:'water-outline',bodian:'radio-outline'};
const platformRows:[readonly ('all'|SearchPlatform)[],readonly ('all'|SearchPlatform)[]]=[['all','wy','tx','kw'],['kg','mg','qishui','bodian']];
type SearchKind=keyof typeof kindNames;
type SearchTab='all'|SearchKind;
export interface SearchSession {
  kind:SearchTab;
  query:string;
  platform:SearchPlatform|'all';
}
interface ExtraSearchGroup {
  platform:'qishui'|'bodian';
  query:string;
  items:readonly Track[];
  page:number;
  hasMore:boolean;
  loading:boolean;
  error?:string;
  note?:string;
}
function isOnlinePlatform(p:SearchPlatform|'all'):p is OnlinePlatform{
  return p==='wy'||p==='tx'||p==='kw'||p==='kg'||p==='mg';
}
interface GroupSelection { platform: OnlinePlatform; model: SelectionModel }
const unifiedKinds=['song','playlist','album','artist','mv'] as const;
const unifiedPreviewLimit=2;

export function Search({
  services,
  session,
  onSessionChange,
  bottomInset=0,
  initialQuery,
}:{
  services:Services;
  session:SearchSession;
  onSessionChange:(update:Partial<SearchSession>)=>void;
  bottomInset?:number;
  initialQuery?:string;
}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);const styles=useThemedStyles(makeStyles);
  const songState = useSyncExternalStore(services.search.subscribe,services.search.getSnapshot);
  const playlistState=useSyncExternalStore(services.playlistSearch.subscribe,services.playlistSearch.getSnapshot);
  const {kind,query,platform}=session;
  const setKind=(kind:SearchTab)=>onSessionChange({kind});
  const setQuery=(query:string)=>onSessionChange({query});
  const setPlatform=(platform:SearchPlatform|'all')=>onSessionChange({platform});
  const [extraGroups,setExtraGroups]=useState<readonly ExtraSearchGroup[]>([]);
  const extraAbort=useRef<AbortController|null>(null);
  useEffect(()=>()=>{extraAbort.current?.abort();},[]);
  const [collection,setCollection]=useState<DiscoveryTarget|null>(null),[video,setVideo]=useState<{platform:OnlinePlatform;item:VideoItem}|null>(null);
  const albumState=useSyncExternalStore(services.albumSearch.subscribe,services.albumSearch.getSnapshot);
  const artistState=useSyncExternalStore(services.artistSearch.subscribe,services.artistSearch.getSnapshot);
  const videoState=useSyncExternalStore(services.videoSearch.subscribe,services.videoSearch.getSnapshot);
  const catalogState=kind==='mv'?videoState:kind==='artist'?artistState:kind==='album'?albumState:playlistState;
  const catalogCoordinator=kind==='mv'?services.videoSearch:kind==='artist'?services.artistSearch:kind==='album'?services.albumSearch:services.playlistSearch;
  const state=kind==='song'||kind==='all'?songState:catalogState;
  const history = useSyncExternalStore(services.searchHistory.subscribe,services.searchHistory.getSnapshot);
  const assistance=useSyncExternalStore(services.searchAssistance.subscribe,services.searchAssistance.getSnapshot);
  const [editing,setEditing]=useState(false);

  const [menuTrack,setMenuTrack]=useState<Track|null>(null);
  // Batch selection (Sollin capture §4): scope is the loaded collection of one
  // platform group; count shows 已选 N / loaded total.
  const [selection,setSelection]=useState<GroupSelection|null>(null),[picking,setPicking]=useState(false),[busy,setBusy]=useState(false);
  const [downloadReport,setDownloadReport]=useState<DownloadSubmission|null>(null);
  const downloadOwner=useRef(selection);downloadOwner.current=selection;
  const downloadScope=useRef('');downloadScope.current=JSON.stringify([kind,platform,state.query]);
  const lastInitialQuery=useRef<string|undefined>(undefined);
  useEffect(()=>()=>{downloadOwner.current=null;},[]);
  const toast=useToast();
  useEffect(()=>{setSelection(null);setPicking(false);setMenuTrack(null);setCollection(null);setVideo(null);setDownloadReport(null);},[state.query,platform,kind]);

  const draft=normalizeSearchQuery(query);
  const suggestions=draft&&draft!==state.query?suggestSearchQueries(history,draft):[];
  const activeGroups=kind==='all'?[songState.groups,playlistState.groups,albumState.groups,artistState.groups,videoState.groups]:[state.groups];
  const emptyResults=!!state.query&&activeGroups.every(groups=>groups.length>0&&groups.every(group=>!group.loading&&!group.error&&group.items.length===0));
  // Show hot keywords alongside history whenever input is empty (Sollin 299-global-search).
  const assistancePlatform:OnlinePlatform|'all'=isOnlinePlatform(platform)?platform:'all';
  const assistanceMode=!draft?'hot':draft&&(editing||draft!==state.query||emptyResults)?'suggest':null;
  useEffect(()=>{
    services.searchAssistance.clear();
    if(!assistanceMode)return;
    const timer=setTimeout(()=>{void services.searchAssistance.load(assistanceMode,draft,assistancePlatform);},assistanceMode==='hot'?0:300);
    return()=>{clearTimeout(timer);services.searchAssistance.clear();};
  },[services,assistanceMode,draft,assistancePlatform,kind]);

  const runExtraSearch=async(target:'qishui'|'bodian',cleaned:string,page=1,append=false)=>{
    if(!cleaned){setExtraGroups([]);return;}
    if(!append){extraAbort.current?.abort();extraAbort.current=new AbortController();}
    const signal=(extraAbort.current??(extraAbort.current=new AbortController())).signal;
    setExtraGroups(prev=>{
      const existing=prev.find(g=>g.platform===target);
      const next:ExtraSearchGroup={platform:target,query:cleaned,items:append&&existing?existing.items:[],page,hasMore:false,loading:true};
      return prev.some(g=>g.platform===target)?prev.map(g=>g.platform===target?next:g):[...prev,next];
    });
    try{
      if(target==='bodian'){
        const sess=await services.bodianAccount.session().catch(()=>undefined);
        const res=await services.bodian.searchSongs(cleaned,page,signal,sess);
        if(signal.aborted)return;
        setExtraGroups(prev=>prev.map(g=>g.platform!=='bodian'?g:{
          platform:'bodian',query:cleaned,
          items:append?[...g.items,...res.items]:res.items,
          page,hasMore:res.hasMore,loading:false,
        }));
      }else{
        // Search Qishui bound playlists + liked + recent + public charts + cross-matched online catalog
        const snap=services.qishuiAccount.getSnapshot();
        const needle=cleaned.toLowerCase();
        const localPool:Track[]=[];
        const seenIds=new Set<string>();
        const pushUnique=(t:Track)=>{
          const k=`${t.title.toLowerCase()}::${t.artist.toLowerCase()}`;
          if(seenIds.has(k))return;
          seenIds.add(k);
          localPool.push(t);
        };
        for(const t of [...snap.liked,...snap.recent,...snap.playlists.flatMap(p=>p.tracks)]){
          if(t.title.toLowerCase().includes(needle)||t.artist.toLowerCase().includes(needle)||(t.album??'').toLowerCase().includes(needle)){
            pushUnique(t);
          }
        }
        try{
          const charts=await services.qishui.fetchCharts(signal);
          const topChartTracks=await Promise.allSettled(charts.slice(0,2).map(ch=>services.qishui.fetchChartTracks(ch.id,signal)));
          for(const tr of topChartTracks){
            if(tr.status!=='fulfilled')continue;
            for(const t of tr.value){
              if(t.title.toLowerCase().includes(needle)||t.artist.toLowerCase().includes(needle)){pushUnique(t);}
            }
          }
        }catch{}
        // Supplement with matched online search results tagged as Qishui roaming matches
        const onlineHits=await Promise.allSettled([
          services.online.search('wy',cleaned,page,signal),
          services.online.search('tx',cleaned,page,signal),
        ]);
        if(signal.aborted)return;
        for(const r of onlineHits){
          if(r.status==='fulfilled'){
            for(const t of r.value.items.slice(0,18))pushUnique(asQishuiMatchedTrack(t));
          }
        }
        setExtraGroups(prev=>prev.map(g=>g.platform!=='qishui'?g:{
          platform:'qishui',query:cleaned,
          items:append?[...g.items,...localPool]:localPool,
          page,hasMore:localPool.length>=15&&page<3,loading:false,
          note:'包含汽水已绑定曲库、榜单与智能匹配歌曲',
        }));
      }
    }catch(err){
      if(signal.aborted)return;
      const msg=err instanceof Error?err.message:'搜索失败，请重试';
      setExtraGroups(prev=>prev.map(g=>g.platform!==target?g:{...g,loading:false,error:msg}));
    }
  };

  const searchFor=(type:SearchTab,value:string,selected:SearchPlatform|'all')=>{
    const catalogs={song:services.search,playlist:services.playlistSearch,album:services.albumSearch,artist:services.artistSearch,mv:services.videoSearch};
    if(selected==='qishui'||selected==='bodian'){
      for(const catalog of Object.values(catalogs))void catalog.search('','all');
      if(!value){setExtraGroups([]);return;}
      setExtraGroups([]);
      void runExtraSearch(selected,value,1,false);
      return;
    }
    const targets:readonly SearchKind[]=type==='all'?unifiedKinds:[type];
    for(const [name,catalog] of Object.entries(catalogs))void catalog.search(targets.includes(name as SearchKind)?value:'',selected);
    if(selected==='all'&&value&&(type==='song'||type==='all')){
      setExtraGroups([]);
      void runExtraSearch('bodian',value,1,false);
    }else{
      extraAbort.current?.abort();
      setExtraGroups([]);
    }
  };
  function searchOnly(type:SearchKind,value:string,selected:OnlinePlatform|'all'){
    const catalogs={song:services.search,playlist:services.playlistSearch,album:services.albumSearch,artist:services.artistSearch,mv:services.videoSearch};
    void catalogs[type].search(value,selected);
  }
  function selectKind(type:SearchTab){
    if(type===kind)return;
    const cleaned=normalizeSearchQuery(query);
    setKind(type);Keyboard.dismiss();setEditing(false);
    if(!cleaned)return;
    if(platform==='qishui'||platform==='bodian'){
      void runExtraSearch(platform,cleaned,1,false);
      return;
    }
    const catalogs={song:services.search,playlist:services.playlistSearch,album:services.albumSearch,artist:services.artistSearch,mv:services.videoSearch};
    const targets:readonly SearchKind[]=type==='all'?unifiedKinds:[type];
    const expectedPlatforms=platform==='all'?platforms:[platform];
    for(const target of targets){
      const snapshot=catalogs[target].getSnapshot();
      const hasPlatformResults=expectedPlatforms.every(expected=>snapshot.groups.some(group=>group.platform===expected));
      if(snapshot.query!==cleaned||!hasPlatformResults)searchOnly(target,cleaned,platform);
    }
  }
  function openCatalog(type:'mv'|'playlist'|'album'|'artist',platform:OnlinePlatform,item:BrowseItem){
    if(type==='mv'){if(platform!=='mg')services.playback.controller.pause();setVideo({platform,item:item as VideoItem});}
    else setCollection({platform,collection:item,...(type==='album'?{kind:'album' as const}:type==='artist'?{kind:'artist' as const}:{})});
  }
  const submit=(value=query,selected:SearchPlatform|'all'=platform,record=true,type:SearchTab=kind)=>{
    const cleaned=normalizeSearchQuery(value);
    Keyboard.dismiss();setEditing(false);setQuery(cleaned);
    if(cleaned&&record)void services.searchHistory.record(cleaned).catch(()=>{});
    searchFor(type,cleaned,selected);
  };
  useEffect(()=>{
    const cleaned=initialQuery?normalizeSearchQuery(initialQuery):'';
    if(cleaned&&cleaned!==lastInitialQuery.current){
      lastInitialQuery.current=cleaned;
      submit(cleaned,platform,true,kind);
    }
  },[initialQuery]);
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
      setBusy(true);const owner=selection,scope=downloadScope.current;
      try{
        const report=await services.submitDownloads(listTracks);
        if(downloadOwner.current===owner&&downloadScope.current===scope){setDownloadReport(report);if(report.entries.every(e=>e.disposition!=='failed'))setSelection(null);}
      }catch{if(downloadOwner.current===owner&&downloadScope.current===scope)toast.show('下载提交未完成，请查看下载管理中的已有任务');}
      finally{setBusy(false);}
    }else if(action==='playlist'){setPicking(true);}
  }

  const assistanceSections=assistance.groups.map(group=><View key={group.platform} style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text accessibilityRole="header" style={styles.heading}>{assistance.mode==='hot'?`热搜词 · ${platformNames[group.platform]}`:`${platformNames[group.platform]}${group.platform==='mg'?'匹配建议':'搜索建议'}`}</Text>
        {group.error&&group.retryable&&<Pressable testID={`search-assistance-retry-${group.platform}`} accessibilityRole="button" accessibilityLabel={`重试${platformNames[group.platform]}关键词`} onPress={()=>{void services.searchAssistance.retry(group.platform);}} style={styles.sectionAction}><Text style={styles.link}>重试</Text></Pressable>}
      </View>
      {assistance.mode==='suggest'&&group.platform==='mg'&&<Text style={styles.caption}>根据公开歌曲匹配生成，点击后重新搜索。</Text>}
      {group.loading&&<ActivityIndicator accessibilityLabel="加载关键词" color={s.accent}/>}
      {group.error?<Text style={styles.caption}>{group.error}</Text>:!group.loading&&!group.items.length?<Text style={styles.caption}>{assistance.mode==='hot'?'暂无热搜词':'暂无搜索建议'}</Text>:null}
      {assistance.mode==='hot'?<View style={styles.hotWrap}>{group.items.map((word,index)=>{
        const top3=index<3;
        return <Pressable key={word} testID={`search-public-${assistance.mode}-${group.platform}-${index}`} accessibilityRole="button" accessibilityLabel={`${platformNames[group.platform]}热搜词：${word}`} onPress={()=>submit(word)} style={[styles.hotChip,top3&&styles.hotChipTop]}>
          <Text accessible={false} style={[styles.hotRank,top3&&styles.hotRankTop]}>{String(index+1).padStart(2,'0')}</Text>
          <Text style={styles.hotWord}>{word}</Text>
        </Pressable>;
      })}</View>:group.items.map((word,index)=><Pressable key={word} testID={`search-public-${assistance.mode}-${group.platform}-${index}`} accessibilityRole="button" accessibilityLabel={`${platformNames[group.platform]}${group.platform==='mg'?'匹配建议':'搜索建议'}：${word}`} onPress={()=>submit(word)} style={styles.historyRow}><Ionicons name="search-outline" size={16} color={s.subtle}/><Text style={styles.historyText}>{word}</Text></Pressable>)}
    </View>);

  function renderUnifiedEntity(type:typeof unifiedKinds[number],platform:OnlinePlatform,group?:SearchGroup<Track>|SearchGroup<BrowseItem>){
    if(!group)return null;
    const previews:{key:string;title:string;subtitle:string;artwork?:string;track?:Track;onPress:()=>void}[]=type==='song'
      ?(group as SearchGroup<Track>).items.slice(0,unifiedPreviewLimit).map((track,index)=>({key:trackKey(track.origin),title:track.title,subtitle:[track.artist,track.album].filter(Boolean).join(' · '),track,onPress:()=>services.playTracks((group as SearchGroup<Track>).items,index)}))
      :(group as SearchGroup<BrowseItem>).items.slice(0,unifiedPreviewLimit).map(item=>{
        const artist=type==='artist'?item as ArtistItem:undefined;
        const details=artist?[artist.songCount!==undefined?`${artist.songCount} 首歌曲`:'',artist.albumCount!==undefined?`${artist.albumCount} 张专辑`:''].filter(Boolean).join(' · '):[item.author,item.count!==undefined?`${item.count} 首`:''].filter(Boolean).join(' · ');
        return {key:item.id,title:item.title,subtitle:details||`打开${kindNames[type]}`,...(item.artwork?{artwork:item.artwork}:{}),onPress:()=>openCatalog(type,platform,item)};
      });
    const coordinator=type==='song'?services.search:type==='playlist'?services.playlistSearch:type==='album'?services.albumSearch:type==='artist'?services.artistSearch:services.videoSearch;
    const retry=()=>{void coordinator.retry(platform);};
    const icon=type==='song'?'musical-note-outline':type==='playlist'?'list-outline':type==='album'?'albums-outline':type==='artist'?'person-outline':'videocam-outline';
    return <View key={`${platform}-${type}`} testID={`unified-${type}-${platform}`} style={styles.unifiedEntity}>
      <View style={styles.unifiedEntityHeader}>
        <Text accessibilityRole="header" style={styles.unifiedEntityTitle}>{kindNames[type]}</Text>
        <Text style={styles.caption}>{group.items.length} 条已载入{group.total!==undefined?` / ${group.total}`:''}</Text>
        <Pressable testID={`unified-view-all-${type}-${platform}`} accessibilityRole="button" accessibilityLabel={`查看${platformNames[platform]}全部${kindNames[type]}结果`} onPress={()=>selectKind(type)} style={styles.unifiedViewAll}><Text style={styles.link}>查看全部</Text></Pressable>
      </View>
      {previews.map((item,index)=><Pressable key={item.key} testID={`unified-${type}-${platform}-${index}`} accessibilityRole="button" accessibilityLabel={`${type==='song'?'播放':'打开'}${kindNames[type]}：${item.title}，${platformNames[platform]}${item.subtitle?`，${item.subtitle}`:''}`} onPress={item.onPress} style={styles.unifiedRow}>
        {item.track?<Cover services={services} track={item.track} size={46} radius={10}/>:item.artwork?<Cover services={services} url={item.artwork} size={catalogArtwork.square} radius={Math.min(theme.appearance.coverRadius,radius.md)}/>:<View style={styles.unifiedTypeIcon}><Ionicons name={icon} size={20} color={theme.palette.accent}/></View>}
        <View style={{flex:1,gap:2}}>
          <Text style={styles.track} numberOfLines={2}>{item.title}</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
            {item.track&&<QualityBadge track={item.track}/>}
            {!!item.subtitle&&<Text style={[styles.caption,{flex:1}]} numberOfLines={1}>{item.subtitle}</Text>}
          </View>
        </View>
      </Pressable>)}
      {group.loading&&<View testID={`unified-${type}-loading-${platform}`} style={styles.unifiedStatus}><ActivityIndicator color={theme.palette.accent}/><Text style={styles.caption}>{group.items.length?'正在加载更多…':`正在搜索${kindNames[type]}…`}</Text></View>}
      {!!group.error&&<View testID={`unified-${type}-error-${platform}`} style={styles.unifiedStatus}><Text style={styles.error}>{group.error}</Text><Pressable testID={`unified-${type}-retry-${platform}`} accessibilityRole="button" disabled={group.loading} onPress={retry} style={styles.unifiedRetry}><Text style={styles.link}>重试{kindNames[type]}</Text></Pressable></View>}
      {!group.loading&&!group.error&&!group.items.length&&<Text testID={`unified-${type}-empty-${platform}`} style={styles.caption}>没有匹配的{kindNames[type]}</Text>}
      {!group.loading&&!group.error&&!!group.items.length&&group.hasMore&&<Text style={styles.caption}>统一页仅预览前 {unifiedPreviewLimit} 条，分页请进入“{kindNames[type]}”。</Text>}
    </View>;
  }

  return <View style={{gap:2,paddingBottom:bottomInset}}>
    <Text accessibilityRole="header" style={styles.title}>搜索</Text>

    {/* Sollin 299-global-search: borderless soft rounded kind tiles */}
    <View style={styles.kindRow}>{(['all','song','playlist','album','artist','mv']as const).map(type=>{
      const active=kind===type,label=type==='all'?'全部':kindNames[type];
      return <Pressable key={type} testID={`search-kind-${type}`} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{selected:active}} onPress={()=>selectKind(type)} style={[styles.kindCard,active&&styles.kindCardActive]}>
        <Ionicons name={kindIcons[type]} size={19} color={active?'#FFFFFF':s.ink}/>
        <Text numberOfLines={1} style={[styles.kindLabel,active&&styles.kindLabelActive]}>{label}</Text>
      </Pressable>;
    })}</View>

    {/* Strict 3x2 equal-width platform grid (Sollin 299-global-search) */}
    <Text style={styles.subLabel}>音乐平台</Text>
    <View style={styles.platformRows}>
      {platformRows.map((row,rowIndex)=><View key={rowIndex} style={styles.platformRow}>
        {row.map(item=>{
          const active=platform===item,label=item==='all'?'聚合':platformNames[item];
          return <Pressable key={item} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{selected:active}} onPress={()=>{setPlatform(item);submit(query,item,false);}} style={[styles.platformTile,active&&styles.platformTileActive]}>
            <Ionicons name={platformIcons[item]} size={14} color={active?'#FFFFFF':s.ink}/>
            <Text numberOfLines={1} style={[styles.platformLabel,active&&styles.platformLabelActive]}>{label}</Text>
          </Pressable>;
        })}
      </View>)}
    </View>

    {/* Soft borderless search capsule */}
    <View style={styles.inputRow}>
      <View style={styles.inputShell}>
        <Ionicons name="search-outline" size={18} color={s.subtle}/>
        <TextInput testID="search-input" accessibilityLabel={kind==='song'?'搜索歌曲或歌手':kind==='all'?'搜索歌曲、歌单、专辑、艺术家或MV':`搜索${kindNames[kind]}`} placeholder={kind==='song'?'搜索歌曲、歌手或专辑':kind==='all'?'歌曲、歌单、专辑、艺术家、MV':`搜索${kindNames[kind]}关键词`} placeholderTextColor={s.subtle} autoCorrect={false} onFocus={()=>setEditing(true)} value={query} onChangeText={change} onSubmitEditing={run} returnKeyType="search" style={styles.input}/>
        {!!query&&<Pressable testID="search-clear" accessibilityRole="button" accessibilityLabel="清除搜索输入" onPress={clearQuery} style={styles.clear}><Ionicons name="close-circle" size={19} color={s.subtle}/></Pressable>}
      </View>
      <Pressable testID="run-online-search" accessibilityRole="button" onPress={run} style={styles.searchButton}><Text style={styles.searchButtonText}>搜索</Text></Pressable>
    </View>

    {assistance.mode==='suggest'&&assistanceSections}
    {!!suggestions.length&&<View style={styles.section}>
      <Text style={styles.heading}>搜索建议</Text>
      {suggestions.map((item,index)=><Pressable key={item} testID={`search-suggestion-${index}`} accessibilityRole="button" accessibilityLabel={`搜索建议：${item}`} onPress={()=>submit(item)} style={styles.historyRow}>
        <Ionicons name="search-outline" size={16} color={s.subtle}/>
        <Text style={styles.historyText} numberOfLines={1}>{item}</Text>
      </Pressable>)}
    </View>}

    {/* History section with per-item remove × button + clear all */}
    {!state.query&&!extraGroups.length&&!suggestions.length&&<View style={styles.section}>
      {history.length?<>
        <View style={styles.sectionHeader}>
          <Text style={styles.heading}>搜索历史</Text>
          <Pressable testID="search-history-clear" accessibilityRole="button" accessibilityLabel="清空搜索历史" onPress={()=>{void services.searchHistory.clear().catch(()=>toast.show('搜索历史未清除，请重试'));}} style={styles.sectionAction}><Text style={styles.link}>清空</Text></Pressable>
        </View>
        <View style={styles.hotWrap}>{history.map((item,index)=><View key={item} style={styles.historyPill}>
          <Pressable testID={`search-history-${index}`} accessibilityRole="button" accessibilityLabel={`搜索历史：${item}`} onPress={()=>submit(item)} style={styles.historyPillMain}>
            <Text style={styles.hotWord} numberOfLines={1}>{item}</Text>
          </Pressable>
          <Pressable testID={`search-history-remove-${index}`} accessibilityRole="button" accessibilityLabel={`删除搜索历史：${item}`} hitSlop={6} onPress={()=>{void services.searchHistory.remove(item).catch(()=>toast.show('历史记录删除失败，请重试'));}} style={styles.historyRemove}>
            <Ionicons name="close" size={14} color={s.subtle}/>
          </Pressable>
        </View>)}</View>
      </>:<Text style={styles.caption}>{kind==='song'?'输入歌曲、歌手或专辑名开始搜索。':kind==='all'?'输入歌曲、歌单、专辑、艺术家或MV关键词开始全局搜索。':`输入${kindNames[kind]}关键词开始搜索。`}</Text>}
    </View>}

    {/* Hot keywords always visible below history when input is empty */}
    {assistance.mode==='hot'&&assistanceSections}

    {extraGroups.map(group=><View key={`extra-${group.platform}`} testID={`search-extra-group-${group.platform}`} style={styles.group}>
      <Text style={styles.heading}>{platformNames[group.platform]}　<Text style={styles.caption}>{group.items.length} 首已载入</Text></Text>
      {!!group.note&&<Text style={[styles.caption,{marginBottom:4}]}>{group.note}</Text>}
      {group.items.map((track,index)=><View key={`${index}-${trackKey(track.origin)}`} style={styles.trackRow}>
        <Pressable accessibilityRole="button" testID={`search-track-${group.platform}-${index}`} accessibilityLabel={`播放${track.title}`} style={{flex:1,minHeight:48,flexDirection:'row',alignItems:'center',gap:12}} onPress={()=>services.playTracks(group.items,index)}>
          <Cover services={services} track={track} size={46} radius={10}/>
          <View style={{flex:1,gap:3}}>
            <Text numberOfLines={1} style={styles.track}>{track.title}</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
              <QualityBadge track={track}/>
              <Text numberOfLines={1} style={[styles.caption,{flex:1}]}>{track.artist}{track.album?` · ${track.album}`:''} · {platformNames[group.platform]}</Text>
            </View>
          </View>
        </Pressable>
        <Pressable testID={`search-more-${group.platform}-${index}`} accessibilityRole="button" accessibilityLabel={`更多操作：${track.title}`} onPress={()=>setMenuTrack(track)} style={styles.more}><Ionicons name="ellipsis-horizontal" size={20} color={s.muted}/></Pressable>
      </View>)}
      {group.loading&&!group.items.length&&<View testID={`search-loading-${group.platform}`} style={styles.status}><ActivityIndicator color={theme.palette.accent}/><Text style={styles.caption}>正在搜索{platformNames[group.platform]}…</Text></View>}
      {!!group.error&&<View testID={`search-error-${group.platform}`} style={styles.status}>
        <Text style={styles.error}>{group.error}</Text>
        <Pressable testID={`search-retry-${group.platform}`} accessibilityRole="button" disabled={group.loading} onPress={()=>{void runExtraSearch(group.platform,group.query,1,false);}} style={styles.button}><Text style={styles.text}>重试</Text></Pressable>
      </View>}
      {!group.loading&&!group.error&&!group.items.length&&<Text testID={`search-empty-${group.platform}`} style={styles.caption}>未找到匹配的{platformNames[group.platform]}歌曲，请更换关键词</Text>}
      {!group.loading&&!group.error&&group.hasMore&&<Pressable testID={`search-load-more-${group.platform}`} accessibilityRole="button" onPress={()=>{void runExtraSearch(group.platform,group.query,group.page+1,true);}} style={styles.button}><Text style={styles.text}>加载更多</Text></Pressable>}
    </View>)}

    {kind==='all'&&(platform==='all'||isOnlinePlatform(platform))?<View testID="unified-search-results">
      <View style={styles.section}><Text accessibilityRole="header" style={styles.heading}>跨类型结果</Text><Text style={styles.caption}>按平台分组；歌曲、歌单、专辑、艺术家与MV各自保留加载、失败和分页状态。</Text></View>
      {platforms.map(platformName=>{
        const songGroup=songState.groups.find(group=>group.platform===platformName),playlistGroup=playlistState.groups.find(group=>group.platform===platformName),albumGroup=albumState.groups.find(group=>group.platform===platformName),artistGroup=artistState.groups.find(group=>group.platform===platformName),videoGroup=videoState.groups.find(group=>group.platform===platformName);
        if(!songGroup&&!playlistGroup&&!albumGroup&&!artistGroup&&!videoGroup)return null;
        return <View key={platformName} testID={`unified-platform-${platformName}`} style={styles.group}>
          <Text accessibilityRole="header" style={styles.heading}>{platformNames[platformName]}　<Text style={styles.caption}>来源：{platformNames[platformName]}</Text></Text>
          {renderUnifiedEntity('song',platformName,songGroup)}
          {renderUnifiedEntity('playlist',platformName,playlistGroup)}
          {renderUnifiedEntity('album',platformName,albumGroup)}
          {renderUnifiedEntity('artist',platformName,artistGroup)}
          {renderUnifiedEntity('mv',platformName,videoGroup)}
        </View>;
      })}
    </View>:null}

    {/* Sollin 303/337: clean frameless song rows with QualityBadge */}
    {kind==='song'&&songState.groups.map(group => {const model=selection?.platform===group.platform?selection.model:selectionNone;const hasItems=group.items.length>0;return <View key={group.platform} style={styles.group}>
      <Text style={styles.heading}>{platformNames[group.platform]}　<Text style={styles.caption}>{group.items.length} 首已载入{group.total!==undefined?` / ${group.total}`:''}</Text></Text>
      {group.items.map((track,index) => {const id=String(index);const selected=selectionHas(model,id);return <View key={`${index}-${trackKey(track.origin)}`} style={styles.trackRow}>
        <Pressable accessibilityRole="button" testID={`search-track-${group.platform}-${index}`} accessibilityLabel={`${selected?'选择':'播放'}${track.title}`} accessibilityState={{selected}} style={{flex:1,minHeight:48,flexDirection:'row',alignItems:'center',gap:12}}
          onLongPress={()=>{setPicking(false);setSelection({platform:group.platform,model:selectionEnter(id)});}}
          onPress={() => { if(model.active){setSelection({platform:group.platform,model:selectionToggle(model,id)});} else services.playTracks(group.items,index); }}>
          {model.active&&<Ionicons name={selected?'checkmark-circle':'ellipse-outline'} size={21} color={selected?s.control:s.subtle}/>}
          <Cover services={services} track={track} size={46} radius={10}/>
          <View style={{flex:1,gap:3}}>
            <Text numberOfLines={1} style={styles.track}>{track.title}</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
              <QualityBadge track={track}/>
              <Text numberOfLines={1} style={[styles.caption,{flex:1}]}>{track.artist}{track.album?` · ${track.album}`:''} · {platformNames[group.platform]}</Text>
            </View>
          </View>
        </Pressable>
        {!model.active&&<Pressable testID={`search-more-${group.platform}-${index}`} accessibilityRole="button" accessibilityLabel={`更多操作：${track.title}`} onPress={()=>setMenuTrack(track)} style={styles.more}><Ionicons name="ellipsis-horizontal" size={20} color={s.muted}/></Pressable>}
      </View>;})}
      {model.active&&!picking&&<BatchSelectionBar
        count={selectionCount(model)} total={group.items.length}
        allSelected={group.items.length>0&&selectionCount(model)===group.items.length}
        actions={['favorite','playlist','next','download']} busy={busy}
        onSelectAll={()=>setSelection({platform:group.platform,model:selectionToggleAll(model,group.items.map((_,index)=>String(index)))})}
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

    {kind!=='song'&&kind!=='all'&&catalogState.groups.map(group=><View key={group.platform} style={styles.group}>
      <Text style={styles.heading}>{platformNames[group.platform]} <Text style={styles.caption}>{group.items.length} 个{kindNames[kind]}已载入{group.total!==undefined?` / ${group.total}`:''}</Text></Text>
      {group.items.map((item,index)=>{
        const artist=kind==='artist'?item as ArtistItem:undefined,mv=kind==='mv'?item as VideoItem:undefined;
        const summary=artist?`${artist.songCount!==undefined?` · ${artist.songCount} 首歌曲`:''}${artist.albumCount!==undefined?` · ${artist.albumCount} 张专辑`:''}`:mv?mv.durationSeconds!==undefined?` · ${videoDuration(mv.durationSeconds)}`:'':item.count!==undefined?` · ${item.count} 首`:'';
        return <Pressable key={item.id} testID={`search-${kind}-${group.platform}-${index}`} accessibilityRole="button" accessibilityLabel={`打开${kindNames[kind]}：${item.title}，${platformNames[group.platform]}${item.author?`，${mv?'艺术家':'作者'}${item.author}`:''}${summary}`} onPress={()=>openCatalog(kind,group.platform,item)} onLongPress={()=>openCatalog(kind,group.platform,item)} style={styles.catalogRow}>
          <Cover services={services} url={item.artwork} size={mv?catalogArtwork.videoWidth:catalogArtwork.square} aspectRatio={mv?catalogArtwork.videoAspect:1} radius={mv?Math.min(theme.appearance.coverRadius,radius.md):12}/><View style={{flex:1,gap:2}}><Text style={styles.track} numberOfLines={2}>{item.title}</Text><Text style={styles.caption}>{platformNames[group.platform]}{item.author?` · ${item.author}`:''}{summary}</Text><Text style={styles.link}>打开{kindNames[kind]}</Text></View>
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
    <DownloadSubmissionModal services={services} report={downloadReport} onClose={()=>setDownloadReport(null)}/>
    <Toast message={toast.message} onDismiss={toast.clear}/>
  </View>;
}

const makeStyles=(theme:Theme)=>{
  const s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const soft=s.dark?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.46)';
  return StyleSheet.create({
    title:{color:s.ink,fontSize:30,fontWeight:'700',lineHeight:36,letterSpacing:-0.5,marginBottom:12},
    subLabel:{color:s.muted,fontSize:13,fontWeight:'600',marginTop:14,marginBottom:8},
    caption:{color:s.muted,fontSize:12,lineHeight:18},
    kindRow:{flexDirection:'row',gap:7},
    kindCard:{flex:1,minHeight:62,borderRadius:15,backgroundColor:soft,alignItems:'center',justifyContent:'center',gap:5,paddingVertical:8,paddingHorizontal:3},
    kindCardActive:{backgroundColor:s.accent,...s.cardShadow},
    kindLabel:{color:s.ink,fontSize:11.5,fontWeight:'600'},
    kindLabelActive:{color:'#FFFFFF'},
    platformRows:{gap:8},
    platformRow:{flexDirection:'row',gap:8},
    platformTile:{flex:1,minHeight:42,borderRadius:13,backgroundColor:soft,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:4,paddingHorizontal:4},
    platformTileActive:{backgroundColor:s.accent,...s.cardShadow},
    platformLabel:{color:s.ink,fontSize:12.5,fontWeight:'600'},
    platformLabelActive:{color:'#FFFFFF'},
    inputRow:{flexDirection:'row',alignItems:'center',gap:8,marginTop:14,marginBottom:4},
    inputShell:{flex:1,flexDirection:'row',alignItems:'center',gap:8,minHeight:46,paddingHorizontal:14,borderRadius:23,backgroundColor:s.inputBg},
    input:{color:s.ink,flex:1,fontSize:15,paddingVertical:8},
    clear:{minWidth:34,minHeight:34,alignItems:'center',justifyContent:'center'},
    searchButton:{minHeight:46,paddingHorizontal:18,borderRadius:23,backgroundColor:s.control,alignItems:'center',justifyContent:'center'},
    searchButtonText:{color:'#FFFFFF',fontSize:14,fontWeight:'600'},
    text:{color:s.control,fontSize:13,fontWeight:'600'},
    button:{backgroundColor:soft,borderRadius:20,paddingVertical:11,paddingHorizontal:16,alignItems:'center',marginVertical:10},
    section:{marginTop:18,marginBottom:4,gap:10},
    sectionHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
    sectionAction:{minWidth:44,minHeight:36,alignItems:'flex-end',justifyContent:'center'},
    link:{color:s.control,fontSize:13,fontWeight:'600'},
    hotWrap:{flexDirection:'row',flexWrap:'wrap',gap:8},
    hotChip:{minHeight:38,paddingHorizontal:13,paddingVertical:8,borderRadius:12,backgroundColor:soft,flexDirection:'row',alignItems:'center',gap:7},
    hotChipTop:{backgroundColor:s.accentSoft,borderWidth:1,borderColor:s.dark?'rgba(255,136,154,0.45)':'rgba(218,76,98,0.42)'},
    hotRank:{color:s.subtle,fontSize:13,fontWeight:'700',fontVariant:['tabular-nums']},
    hotRankTop:{color:s.accent},
    hotWord:{color:s.ink,fontSize:14,fontWeight:'600'},
    historyPill:{minHeight:36,borderRadius:18,backgroundColor:soft,flexDirection:'row',alignItems:'center',paddingLeft:14,paddingRight:6,maxWidth:'100%'},
    historyPillMain:{minHeight:36,justifyContent:'center',paddingRight:4,flexShrink:1},
    historyRemove:{width:26,height:26,borderRadius:13,alignItems:'center',justifyContent:'center'},
    historyRow:{flexDirection:'row',alignItems:'center',gap:10,minHeight:44,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:s.hairline},
    historyText:{color:s.ink,fontSize:14,flex:1},
    group:{marginTop:20,gap:4},
    heading:{color:s.ink,fontSize:19,fontWeight:'700'},
    track:{color:s.ink,fontSize:15,fontWeight:'600',lineHeight:21},
    more:{minWidth:38,minHeight:44,alignItems:'center',justifyContent:'center'},
    trackRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8,paddingVertical:9},
    error:{color:s.accent,fontSize:12},
    catalogRow:{minHeight:controls.hit,flexDirection:'row',alignItems:'center',gap:space.md,paddingVertical:10},
    status:{alignItems:'center',paddingVertical:14,gap:6},
    end:{color:s.subtle,fontSize:12,textAlign:'center',marginTop:12},
    unifiedEntity:{marginTop:12,borderRadius:18,backgroundColor:soft,padding:12,gap:4},
    unifiedEntityHeader:{minHeight:36,flexDirection:'row',alignItems:'center',gap:space.sm},
    unifiedEntityTitle:{color:s.ink,fontSize:15,fontWeight:'700',minWidth:42},
    unifiedViewAll:{minHeight:36,justifyContent:'center',marginLeft:'auto',paddingHorizontal:space.xs},
    unifiedRow:{minHeight:controls.hit,flexDirection:'row',alignItems:'center',gap:space.sm,paddingVertical:8,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:s.hairline},
    unifiedTypeIcon:{width:48,height:48,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:s.accentSoft},
    unifiedStatus:{alignItems:'center',gap:space.xs,paddingVertical:space.sm},
    unifiedRetry:{minHeight:controls.hit,justifyContent:'center',paddingHorizontal:space.md},
  });
};
