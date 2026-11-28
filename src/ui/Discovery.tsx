import {CatalogFavoriteButton} from './CatalogFavoriteButton.tsx';
import type {ArtistItem} from '../providers/artists.ts';
import {controls,sollinTokens} from './tokens.ts';
import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {useEffect,useMemo,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {Alert, FlatList, Image, Linking, Pressable, ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Modal} from './AdaptiveModal.tsx';
import type {Services} from '../app/services.ts';
import type {OnlinePlatform,Track} from '../domain/track.ts';
import type {BrowseItem,FeaturedHomeData,NeteaseBanner} from '../providers/discovery.ts';
import type {VideoItem} from '../providers/videos.ts';
import {FeaturedDiscoverFeed} from './FeaturedDiscoverFeed.tsx';
import {GlobalRadioModal} from './GlobalRadioModal.tsx';
import {AudioMatchModal} from './AudioMatchModal.tsx';
import {MVDetail} from './MVDetail.tsx';
import {MVPlazaModal,type MVPlazaTab} from './MVPlazaModal.tsx';
import {NeteasePodcastsModal} from './NeteasePodcastsModal.tsx';
import {QishuiDiscoverSection} from './QishuiDiscoverSection.tsx';
import {BodianDiscoverSection} from './BodianDiscoverSection.tsx';
import {AccountFeatureSheet,type AccountFeatureKind} from './AccountFeatureSheet.tsx';
import {classifyDiscoveryFailure,playlistLinkFailure} from '../providers/discoveryFailure.ts';
import {Cover} from './Cover.tsx';
import {QualityBadge} from './QualityBadge.tsx';
import {trackRows,viewTrackRows,type TrackSort} from '../domain/trackList.ts';
import {TrackListTools} from './TrackListTools.tsx';
import {QishuiImport} from './QishuiImport.tsx';
import {TrackActions} from './TrackActions.tsx';
import type {DownloadSubmission} from '../app/downloadSubmission.ts';
import {DownloadSubmissionModal} from './DownloadSubmission.tsx';
import {BatchSelectionBar,type BatchAction} from './BatchSelectionBar.tsx';
import {PlaylistPicker} from './PlaylistPicker.tsx';
import {Toast,useToast} from './Toast.tsx';
import {selectionToggleAll,selectionByListOrder,selectionByTapOrder,selectionCount,selectionEnter,selectionHas,selectionNone,selectionToggle,type SelectionModel} from '../domain/selection.ts';
import {StyleRecommendationSheet} from './StyleRecommendationSheet.tsx';
import {PlatformLogo} from './PlatformLogo.tsx';
import {TrackPlaybackIndicator,useTrackPlaybackState} from './TrackPlaybackIndicator.tsx';

type DiscoveryTabKind='featured'|'playlists'|'rankings';
type PageView={kind:'featured'}|{kind:'playlists'}|{kind:'rankings'}|{kind:'categories'}|{kind:'artists'}|{kind:'albums'}|{kind:'detail';id:string;title:string;rank:boolean;artwork?:string;description?:string;returnView?:DiscoveryTabKind}|{kind:'bannerSongs';id:string;title:string;artwork?:string;tracks:readonly Track[];returnView?:DiscoveryTabKind};
type Item={kind:'collection';value:BrowseItem;rank:boolean}|{kind:'artist';value:ArtistItem}|{kind:'category';id:string;title:string;group?:string}|{kind:'track';track:Track;key?:string};
const platforms=[['wy','网易云','#E60026','musical-notes'],['tx','QQ音乐','#31C27C','musical-note'],['kw','酷我音乐','#F5A623','disc'],['kg','酷狗音乐','#2B8CFF','radio'],['mg','咪咕音乐','#E91E63','headset']]as const;
type DiscoverPlatformChoice=OnlinePlatform|'qishui'|'bodian';
const platformOptions:readonly{id:DiscoverPlatformChoice;name:string;color:string;icon:React.ComponentProps<typeof Ionicons>['name']}[]=[
  {id:'wy',name:'网易云',color:'#E60026',icon:'musical-notes'},
  {id:'tx',name:'QQ音乐',color:'#31C27C',icon:'musical-note'},
  {id:'kw',name:'酷我音乐',color:'#F5A623',icon:'disc'},
  {id:'kg',name:'酷狗音乐',color:'#2B8CFF',icon:'radio'},
  {id:'mg',name:'咪咕音乐',color:'#E91E63',icon:'headset'},
  {id:'qishui',name:'汽水音乐',color:'#00C49A',icon:'sparkles'},
  {id:'bodian',name:'波点音乐',color:'#7C5CFF',icon:'pulse'},
];
const styleQuickCards=[
  {title:'华语精选',subtitle:'流行 · 热门',icon:'musical-notes-outline' as const,tint:'rgba(232,61,86,0.12)'},
  {title:'深夜电台',subtitle:'夜晚 · 治愈',icon:'moon-outline' as const,tint:'rgba(116,92,188,0.12)'},
  {title:'节奏说唱',subtitle:'说唱 · 欧美',icon:'flame-outline' as const,tint:'rgba(230,118,52,0.12)'},
  {title:'氛围轻音',subtitle:'轻音乐 · 放松',icon:'leaf-outline' as const,tint:'rgba(52,168,128,0.12)'},
  {title:'摇滚现场',subtitle:'摇滚 · 热血',icon:'flash-outline' as const,tint:'rgba(66,133,244,0.12)'},
] as const;
const retainedCopy=(message:string,suffix:string)=>`${message}${/[。！？]$/.test(message)?'':' '}${suffix}`;

export interface DiscoveryTarget{platform:OnlinePlatform;collection:BrowseItem;kind?:'album'|'artist';returnLabel?:string;artistSummaryLabel?:string}

export function Discovery({
  services,
  embedded=false,
  initialCollection,
  onClose,
  catalogShortcuts,
  openAccounts,
  openSources,
  bottomInset=28,
}:{
  services:Services;
  embedded?:boolean;
  initialCollection?:DiscoveryTarget;
  onClose?:()=>void;
  catalogShortcuts?:ReactNode;
  openAccounts?:()=>void;
  openSources?:()=>void;
  bottomInset?:number;
}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),{width,fontScale}=useWindowDimensions();
  const sources=useSyncExternalStore(services.catalog.subscribe,services.catalog.getSnapshot);
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const musicAccounts=useSyncExternalStore(services.musicAccounts.subscribe,services.musicAccounts.getSnapshot);
  const trackPlayback=useTrackPlaybackState(services);
  const wySignedIn=musicAccounts.some(a=>a.platform==='wy');
  const txSignedIn=musicAccounts.some(a=>a.platform==='tx');
  const kgSignedIn=musicAccounts.some(a=>a.platform==='kg');
  const activeSource=sources.find(item=>item.enabled&&item.status==='ready')?.displayName??sources.find(item=>item.enabled)?.displayName;
  const hasSourceUpdates=sources.some(item=>item.hasUpdate&&item.allowUpdateAlert);
  const [contentWidth,setContentWidth]=useState<number>();
  const [tools,setTools]=useState(false),[descriptionOpen,setDescriptionOpen]=useState(false);
  const [styleOpen,setStyleOpen]=useState(false);
  const [query,setQuery]=useState(''),[sort,setSort]=useState<TrackSort>('original');
  const [total,setTotal]=useState<number>();
  const [artistAlbums,setArtistAlbums]=useState(false),[nestedCollection,setNestedCollection]=useState<DiscoveryTarget|null>(null),[artistInfo,setArtistInfo]=useState<Partial<ArtistItem>>({}),[popular,setPopular]=useState(false);
  const [albumInfo,setAlbumInfo]=useState<Partial<BrowseItem>>({}),[publicAlbum,setPublicAlbum]=useState(false);

  const [open,setOpen]=useState(!!initialCollection);
  const [platform,setPlatform]=useState<OnlinePlatform>(initialCollection?.platform??preferences.homePlatform??'wy');
  const [view,setView]=useState<PageView>(initialCollection?{kind:'detail',id:initialCollection.collection.id,title:initialCollection.collection.title,rank:false,artwork:initialCollection.collection.artwork,description:initialCollection.collection.description}:{kind:'featured'});
  const [banners,setBanners]=useState<readonly NeteaseBanner[]>([]),[bannerIndex,setBannerIndex]=useState(0);
  const [featuredData,setFeaturedData]=useState<FeaturedHomeData|null>(null),[featuredLoading,setFeaturedLoading]=useState(false),[featuredError,setFeaturedError]=useState('');
  const [activeMV,setActiveMV]=useState<VideoItem|null>(null);
  const [mvPlazaTab,setMvPlazaTab]=useState<MVPlazaTab|null>(null);
  const [podcastsOpen,setPodcastsOpen]=useState(false);
  const [radioOpen,setRadioOpen]=useState(false);
  const [audioMatchOpen,setAudioMatchOpen]=useState(false);
  const [accountFeature,setAccountFeature]=useState<AccountFeatureKind|null>(null);
  const [qishuiTab,setQishuiTab]=useState(false);
  const [bodianTab,setBodianTab]=useState(false);
  const [platformSheetOpen,setPlatformSheetOpen]=useState(false);
  const [showBackTop,setShowBackTop]=useState(false);
  const listRef=useRef<FlatList<Item>|null>(null);
  const scrollOffsets=useRef<Record<string,number>>({});
  const activeScrollKey=qishuiTab?'qishui':bodianTab?'bodian':`${platform}:${view.kind}`;
  const bannerScroll=useRef<ScrollView|null>(null),bannerDragging=useRef(false);
  const [category,setCategory]=useState<string>();
  const [items,setItems]=useState<readonly Item[]>([]),[more,setMore]=useState(false),[retryAppend,setRetryAppend]=useState(false),[loading,setLoading]=useState(false),[error,setError]=useState(''),[link,setLink]=useState(''),[message,setMessage]=useState(''),[linkLoading,setLinkLoading]=useState(false),[importing,setImporting]=useState(false),[menuTrack,setMenuTrack]=useState<Track|null>(null);
  // Batch selection (Sollin §4): scoped to the loaded detail rows, with the
  // favorite store reading tap order and the queue reading list order.
  const [selection,setSelection]=useState<SelectionModel>(selectionNone),[picking,setPicking]=useState(false),[busy,setBusy]=useState(false);
  const [downloadReport,setDownloadReport]=useState<DownloadSubmission|null>(null);
  const downloadOwner=useRef<SelectionModel|null>(selection);downloadOwner.current=selection;
  useEffect(()=>()=>{downloadOwner.current=null;},[]);
  const toast=useToast();
  const page=useRef(0),generation=useRef(0),pending=useRef(new AbortController()),importAbort=useRef(new AbortController()),linkAbort=useRef(new AbortController()),linkGeneration=useRef(0);
  const lastHomePlatform=useRef(preferences.homePlatform);

  // Sync homePlatform preference ONLY when explicitly changed externally (never override active Qishui/Bodian or current platform selection).
  useEffect(()=>{
    if(!initialCollection&&preferences.homePlatform&&preferences.homePlatform!==lastHomePlatform.current){
      lastHomePlatform.current=preferences.homePlatform;
      if(!qishuiTab&&!bodianTab&&preferences.homePlatform!==platform&&view.kind!=='detail'){
        setPlatform(preferences.homePlatform);
      }
    }
  },[preferences.homePlatform]);

  // Restore saved scroll offset when returning to a previously scrolled platform/view.
  useEffect(()=>{
    const saved=scrollOffsets.current[activeScrollKey]??0;
    const id=requestAnimationFrame(()=>{
      listRef.current?.scrollToOffset({offset:saved,animated:false});
      setShowBackTop(saved>520);
    });
    return()=>cancelAnimationFrame(id);
  },[activeScrollKey]);

  function selectPlatform(next:OnlinePlatform){
    setQishuiTab(false);
    setBodianTab(false);
    setPlatform(next);
    setCategory(undefined);
    setFeaturedData(null);
    setView({kind:'featured'});
    lastHomePlatform.current=next;
    if(!initialCollection){
      void services.preferences.update({homePlatform:next}).catch(()=>{});
    }
  }

  function pickDiscoverPlatform(choice:DiscoverPlatformChoice){
    setPlatformSheetOpen(false);
    if(choice==='qishui'){
      setBodianTab(false);
      setQishuiTab(true);
      setView({kind:'featured'});
      return;
    }
    if(choice==='bodian'){
      setQishuiTab(false);
      setBodianTab(true);
      setView({kind:'featured'});
      return;
    }
    selectPlatform(choice);
  }

  async function loadFeatured(){
    const version=++generation.current;
    pending.current.abort();
    pending.current=new AbortController();
    const signal=pending.current.signal;
    setFeaturedLoading(true);
    setFeaturedError('');
    try{
      const data=await services.discovery.featured(platform,signal,{
        latestMVs:platform==='wy'?sig=>services.videos.latestNetease(sig,12):undefined,
        topMVs:platform==='wy'?sig=>services.videos.topNetease(sig,12):undefined,
        newAlbums:platform==='wy'?async sig=>(await services.albums.newNetease(1,sig)).items.slice(0,12):undefined,
        popularArtists:platform==='wy'?async sig=>(await services.artists.popularNetease(1,sig)).items.slice(0,12):undefined,
      });
      if(version===generation.current&&!signal.aborted)setFeaturedData(data);
    }catch(failure){
      if(version===generation.current&&!signal.aborted){
        setFeaturedError(classifyDiscoveryFailure(failure).message);
      }
    }finally{
      if(version===generation.current)setFeaturedLoading(false);
    }
  }

  async function load(append=false){
    if(view.kind==='featured'){await loadFeatured();return;}
    const version=++generation.current;pending.current.abort();pending.current=new AbortController();const signal=pending.current.signal,next=append?page.current+1:1;
    setRetryAppend(append);
    setLoading(true);setError('');
    try{
      let values:Item[]=[],hasMore=false,detailTotal:number|undefined;
      if(initialCollection?.kind==='artist'&&artistAlbums){const result=await services.artists.albums(platform,initialCollection.collection,next,signal);values=result.items.map(value=>({kind:'collection',value,rank:false}));hasMore=result.hasMore;detailTotal=result.total;if(version===generation.current&&!signal.aborted&&result.total!==undefined)setArtistInfo(old=>({...old,albumCount:result.total}));}
      else if(view.kind==='playlists'){const result=await services.discovery.playlists(platform,next,category,signal);values=result.items.map(value=>({kind:'collection',value,rank:false}));hasMore=result.hasMore;}
      else if(view.kind==='rankings'){values=(await services.discovery.rankings(platform,signal)).map(value=>({kind:'collection',value,rank:true}));}
      else if(view.kind==='artists'){
        const result=await services.artists.popularNetease(next,signal);
        if(append&&result.items.some(artist=>items.some(item=>item.kind==='artist'&&item.value.id===artist.id)))throw Error('热门歌手目录发生变化，请刷新后重试');
        values=result.items.map(value=>({kind:'artist',value}));hasMore=result.hasMore;
      }
      else if(view.kind==='albums'){
        const result=await services.albums.newNetease(next,signal);
        if(append&&result.items.some(album=>items.some(item=>item.kind==='collection'&&item.value.id===album.id)))throw Error('新碟目录发生变化，请刷新后重试');
        values=result.items.map(value=>({kind:'collection',value,rank:false}));hasMore=result.hasMore;
      }
      else if(view.kind==='categories'){values=(await services.discovery.categories(platform,signal)).map(value=>({kind:'category',...value}));}
      else if(view.kind==='bannerSongs'){
        let list=[...view.tracks];
        if(!list.length&&/^\d+$/.test(view.id)&&typeof services.discovery.neteaseSongs==='function'){
          const resolved=await services.discovery.neteaseSongs([view.id],signal);
          const hit=resolved.get(view.id);
          if(hit)list=[hit];
        }
        values=list.map(track=>({kind:'track',track}));
        detailTotal=list.length;
      }
      else{const result=initialCollection?.kind==='artist'?await services.artists.songs(platform,initialCollection.collection,next,signal):initialCollection?.kind==='album'?await services.albums.detail(platform,initialCollection.collection,next,signal):await services.discovery.detail(platform,view.id,next,signal,view.rank);values=result.items.map(track=>({kind:'track',track}));hasMore=result.hasMore;detailTotal=result.total;if(initialCollection?.kind==='artist'&&version===generation.current&&!signal.aborted){setArtistInfo(result.info??{});setPopular(result.scope==='popular');}if(initialCollection?.kind==='album'&&version===generation.current&&!signal.aborted){setAlbumInfo(result.info??{});setPublicAlbum(result.scope==='public');}}
      if(version!==generation.current||signal.aborted)return;
      if(view.kind==='detail'||view.kind==='bannerSongs')setTotal(detailTotal);
      setItems(old=>append?[...old,...values]:values);setMore(hasMore);setRetryAppend(false);page.current=next;
    }catch(failure){if(version===generation.current&&!signal.aborted){const result=classifyDiscoveryFailure(failure);setError(append||items.length?retainedCopy(result.message,'已加载内容保留。'):result.message);}}
    finally{if(version===generation.current)setLoading(false);}
  }
  const inDetail=view.kind==='detail'||view.kind==='bannerSongs';
  useEffect(()=>{if(open||embedded){setItems([]);setQuery('');setSort('original');setMore(false);setRetryAppend(false);setImporting(false);setMessage('');page.current=0;void load();}return()=>{generation.current++;pending.current.abort();importAbort.current.abort();linkGeneration.current++;linkAbort.current.abort();};},[open,embedded,platform,view,category,artistAlbums]);

  useEffect(()=>{
    if(!embedded||platform!=='wy'){setBanners([]);setBannerIndex(0);return;}
    const controller=new AbortController();
    void services.discovery.banners('wy',controller.signal).then(result=>{
      if(!controller.signal.aborted){setBanners(result);setBannerIndex(0);}
    }).catch(()=>{if(!controller.signal.aborted)setBanners([]);});
    return()=>controller.abort();
  },[embedded,platform,services]);

  useEffect(()=>{
    if(!embedded||platform!=='wy'||inDetail||banners.length<2)return;
    const widthStep=contentWidth??Math.max(1,width-40);
    const timer=setInterval(()=>{
      if(bannerDragging.current)return;
      setBannerIndex(previous=>{
        const next=(previous+1)%banners.length;
        bannerScroll.current?.scrollTo({x:next*widthStep,animated:true});
        return next;
      });
    },5000);
    return()=>clearInterval(timer);
  },[embedded,platform,inDetail,banners.length,contentWidth,width]);

  function openBanner(banner:NeteaseBanner){
    if(banner.targetType===1&&(banner.song||(banner.targetId&&/^\d+$/.test(banner.targetId)))){
      const song=banner.song;
      setDescriptionOpen(false);
      setTotal(song?1:undefined);
      setView({
        kind:'bannerSongs',
        id:song?.origin.id??banner.targetId,
        title:song?.title||banner.typeTitle||'新歌首发',
        artwork:song?.artwork??banner.imageUrl,
        tracks:song?[song]:[],
        returnView:'featured',
      });
      return;
    }
    if(banner.targetType===10&&banner.targetId&&/^\d+$/.test(banner.targetId)){
      setNestedCollection({platform:'wy',kind:'album',collection:{id:banner.targetId,title:banner.typeTitle||'推荐专辑',artwork:banner.imageUrl},returnLabel:'返回发现'});
      return;
    }
    if(banner.targetType===1000&&banner.targetId&&/^\d+$/.test(banner.targetId)){
      openCollection({id:banner.targetId,title:banner.typeTitle||'推荐歌单',artwork:banner.imageUrl},false,'featured');
      return;
    }
    if(banner.url&&banner.url.startsWith('https://')){
      void Linking.openURL(banner.url).catch(()=>{});
    }
  }

  function close(){importAbort.current.abort();linkGeneration.current++;linkAbort.current.abort();setLinkLoading(false);setImporting(false);setMenuTrack(null);setOpen(false);onClose?.();}
  async function previewPlaylistLink(){
    linkAbort.current.abort();linkAbort.current=new AbortController();const signal=linkAbort.current.signal,version=++linkGeneration.current;
    setLinkLoading(true);setMessage('');
    try{const value=await services.resolvePlaylistLink(link,platform,signal);if(signal.aborted||version!==linkGeneration.current)return;setError('');setTotal(undefined);setView({kind:'detail',id:value.id,title:'公开分享歌单',rank:false,returnView:currentTabKind});}
    catch(failure){if(!signal.aborted&&version===linkGeneration.current)setMessage(playlistLinkFailure(failure));}
    finally{if(version===linkGeneration.current)setLinkLoading(false);}
  }
  function cancelLinkPreview(){linkGeneration.current++;linkAbort.current.abort();setLinkLoading(false);setMessage('已取消解析。');}
  function cancelPageRead(){generation.current++;pending.current.abort();setLoading(false);setError(items.length?'读取已取消，已加载内容保留。':'读取已取消，可重试。');}
  async function importPlaylist(){
    if(view.kind!=='detail')return;importAbort.current.abort();importAbort.current=new AbortController();const signal=importAbort.current.signal;
    setImporting(true);setMessage('');
    try{
      const result:{title:string;tracks:readonly Track[];scope?:'public'}=initialCollection?.kind==='album'?await services.albums.complete(platform,initialCollection.collection,signal):await services.discovery.complete(platform,view.id,signal,view.rank);if(signal.aborted)return;
      if(!result.tracks.length){setMessage(initialCollection?.kind==='album'?'此专辑为空，未创建本地歌单':'此歌单为空，未创建本地歌单');return;}
      Alert.alert(result.scope==='public'?'导入公开曲目':initialCollection?.kind==='album'?'导入公开专辑':'导入公开歌单',`${result.title} · ${result.tracks.length} 首。${result.scope==='public'?'仅包含平台公开目录返回的曲目；未返回的曲目不在本次导入范围内。':'保留平台来源、完整顺序和重复项；'}创建一个新的音枢本地歌单。`,[{text:'取消',style:'cancel'},{text:'创建本地歌单',onPress:()=>{void services.library.createPlaylist(result.title,result.tracks,result.scope==='public'?{description:'来自平台公开目录，仅包含本次可读取的曲目。'}:{}).then(()=>setMessage('已保存到我的歌单')).catch(()=>setMessage('保存失败，原音乐库保留'));}}]);
    }catch(error){if(!signal.aborted){const failure=classifyDiscoveryFailure(error);setMessage(retainedCopy(failure.message,'原音乐库保留。'));}}
    finally{if(!signal.aborted)setImporting(false);}
  }

  const loadedTracks=useMemo(()=>items.flatMap(item=>item.kind==='track'?[item.track]:[]),[items]);
  const shownRows=useMemo(()=>viewTrackRows(trackRows(loadedTracks),query,sort),[loadedTracks,query,sort]);
  const tracks=useMemo(()=>shownRows.map(row=>row.track),[shownRows]);
  const displayed:readonly Item[]=(view.kind==='detail'&&!artistAlbums)||view.kind==='bannerSongs'?shownRows.map(row=>({kind:'track',track:row.track,key:row.key})):items;
  useEffect(()=>{setSelection(selectionNone);setPicking(false);},[view.kind,view.kind==='detail'||view.kind==='bannerSongs'?view.id:'',platform,query,artistAlbums]);
  useEffect(()=>{setSelection(current=>{const valid=new Set(shownRows.map(row=>row.key));const kept=current.ids.filter(key=>valid.has(key));return kept.length===current.ids.length?current:{...current,ids:kept};});},[shownRows]);

  async function runBatch(action:BatchAction){
    const count=selectionCount(selection);
    if(!count||busy)return;
    const tapTracks=selectionByTapOrder(selection,shownRows,row=>row.key).map(row=>row.track);
    const listTracks=selectionByListOrder(selection,shownRows,row=>row.key).map(row=>row.track);
    if(action==='favorite'){
      setBusy(true);
      try{await services.library.addFavorites(tapTracks);toast.show(`已收藏 ${count} 首`);setSelection(selectionNone);}
      catch{toast.show('收藏未保存，请重试');}
      finally{setBusy(false);}
    }else if(action==='next'){
      services.addTracksToQueue(listTracks,true);
      toast.show(`已添加 ${count} 首到下一首播放`);setSelection(selectionNone);
    }else if(action==='download'){
      setBusy(true);const owner=selection,version=generation.current;
      try{
        const report=await services.submitDownloads(listTracks);
        if(downloadOwner.current===owner&&generation.current===version){setDownloadReport(report);if(report.entries.every(e=>e.disposition!=='failed'))setSelection(selectionNone);}
      }catch{if(downloadOwner.current===owner&&generation.current===version)toast.show('下载提交未完成，请查看下载管理中的已有任务');}
      finally{setBusy(false);}
    }else if(action==='playlist'){setPicking(true);}
  }

  const softSurface=s.dark?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.44)';
  const segmentTrack=s.dark?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.34)';
  const segmentActive=s.dark?'rgba(255,255,255,0.16)':'rgba(255,255,255,0.82)';
  const outlineBorder=s.dark?'rgba(255,255,255,0.22)':'rgba(42,36,31,0.22)';
  const playPrimaryBg=s.dark?'#F0E8EA':'#3A3333';
  const playPrimaryInk=s.dark?'#1F191C':'#FFFFFF';

  const button=(label:string,action:()=>void,disabled=false,testID?:string,primary=false)=><Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={action} style={{backgroundColor:primary?s.control:softSurface,minHeight:controls.hit,justifyContent:'center',alignItems:'center',paddingHorizontal:16,paddingVertical:10,borderRadius:22,opacity:disabled?.42:1}}><Text style={{color:primary?'#FFFFFF':s.ink,fontSize:14,fontWeight:'600'}}>{label}</Text></Pressable>;

  const usableWidth=contentWidth??Math.max(1,width-40);
  const gridColumns=Math.max(1,Math.min(4,Math.floor((usableWidth+14)/(156*Math.max(1,fontScale)+14))));
  const columns=(view.kind==='detail'&&!artistAlbums)||view.kind==='bannerSongs'?1:view.kind==='rankings'?1:gridColumns;
  const cardWidth=Math.max(1,Math.min(240,(usableWidth-14*(columns-1))/columns));
  const currentTabKind:DiscoveryTabKind=view.kind==='featured'||view.kind==='rankings'||view.kind==='playlists'?view.kind:'featured';
  const openCollection=(item:BrowseItem,rank:boolean,returnView?:DiscoveryTabKind)=>{setDescriptionOpen(false);setTotal(undefined);setView({kind:'detail',id:item.id,title:item.title,rank,artwork:item.artwork,description:item.description,returnView:returnView??currentTabKind});};
  const detailReturnView:DiscoveryTabKind=view.kind==='detail'||view.kind==='bannerSongs'?(view.returnView??(view.kind==='bannerSongs'?'featured':'playlists')):'playlists';
  const detailReturnLabel=detailReturnView==='featured'?'返回精选':detailReturnView==='rankings'?'返回排行榜':'返回歌单广场';
  const albumMetadata=initialCollection?.kind==='album'?{...initialCollection.collection,...albumInfo}:undefined;
  const artistMetadata=initialCollection?.kind==='artist'?{...initialCollection.collection as ArtistItem,...artistInfo}:undefined;
  const detailDescription=view.kind==='detail'?artistMetadata?.description??albumMetadata?.description??view.description:undefined;
  const emptyDetail=view.kind==='detail'&&!artistAlbums&&!loading&&!error&&items.length===0;
  const emptyDetailMessage=emptyDetail?(initialCollection?.kind==='album'?'此专辑为空，无法导入。':'此歌单为空，无法导入。'):'';
  const currentPlatform=platforms.find(([id])=>id===platform)??platforms[0];
  const refreshLabel=initialCollection?.kind==='artist'?'刷新艺术家':initialCollection?.kind==='album'?'刷新专辑':'刷新歌单';

  const header=<View style={{gap:14,paddingBottom:12}}>
    {(!embedded||inDetail)&&<View style={{flexDirection:'row',gap:8,alignItems:'center',justifyContent:'space-between'}}>
      <View style={{flexDirection:'row',gap:8,alignItems:'center',flex:1}}>
        {!embedded&&<Pressable accessibilityRole="button" accessibilityLabel={initialCollection?initialCollection.returnLabel??'返回搜索结果':'收起发现'} onPress={close} style={{minHeight:38,paddingHorizontal:12,borderRadius:19,backgroundColor:softSurface,flexDirection:'row',alignItems:'center',gap:4}}>
          <Ionicons name="chevron-back" size={18} color={s.ink}/>
          <Text numberOfLines={1} style={{color:s.ink,fontSize:14,fontWeight:'600'}}>{initialCollection?initialCollection.returnLabel??'返回搜索结果':'收起发现'}</Text>
        </Pressable>}
        {inDetail&&!initialCollection&&<Pressable accessibilityRole="button" accessibilityLabel={detailReturnLabel} onPress={()=>setView({kind:detailReturnView})} style={{minHeight:38,paddingHorizontal:12,borderRadius:19,backgroundColor:softSurface,flexDirection:'row',alignItems:'center',gap:4}}>
          <Ionicons name="chevron-back" size={18} color={s.ink}/>
          <Text style={{color:s.ink,fontSize:14,fontWeight:'600'}}>{detailReturnLabel}</Text>
        </Pressable>}
      </View>
      {inDetail&&<Text numberOfLines={1} style={{color:s.muted,fontSize:13,fontWeight:'600',maxWidth:'42%'}}>{currentPlatform[1]}</Text>}
    </View>}

    {view.kind==='bannerSongs'?<>
      {/* Sollin _NeteaseStaticSongsPage: borderless artwork + title + 1 首 + Play/Shuffle + 歌曲 N */}
      <View testID="netease-banner-song-page" style={{flexDirection:'row',alignItems:'center',gap:16,paddingTop:4}}>
        <View style={s.cardShadow}><Cover services={services} url={view.tracks[0]?.artwork??view.artwork} size={122} radius={16}/></View>
        <View style={{flex:1,gap:6}}>
          <Text accessibilityRole="header" numberOfLines={3} style={{fontSize:21,fontWeight:'700',lineHeight:27,color:s.ink}}>{view.title}</Text>
          <Text style={{color:s.muted,fontSize:13}}>{loadedTracks.length} 首</Text>
        </View>
      </View>
      {tracks.length>0&&<View style={{flexDirection:'row',gap:10,paddingTop:2}}>
        <Pressable accessibilityRole="button" accessibilityLabel="播放" onPress={()=>services.playTracks(tracks,0)} style={{flex:1,minHeight:46,borderRadius:14,backgroundColor:playPrimaryBg,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:12}}>
          <Ionicons name="play" size={16} color={playPrimaryInk}/>
          <Text numberOfLines={1} style={{color:playPrimaryInk,fontSize:14,fontWeight:'600'}}>播放</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="随机播放" onPress={()=>{void services.preferences.update({repeat:'off',shuffle:true}).then(()=>services.playTracks(tracks,0)).catch(()=>setMessage('无法保存随机模式，请重试'));}} style={{flex:1,minHeight:46,borderRadius:14,backgroundColor:softSurface,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:12}}>
          <Ionicons name="shuffle" size={17} color={s.ink}/>
          <Text numberOfLines={1} style={{color:s.ink,fontSize:14,fontWeight:'600'}}>随机播放</Text>
        </Pressable>
      </View>}
      <View style={{flexDirection:'row',alignItems:'baseline',gap:8,paddingTop:4}}>
        <Text style={{color:s.ink,fontSize:17,fontWeight:'700'}}>歌曲</Text>
        <Text style={{color:s.muted,fontSize:14,fontWeight:'600',fontVariant:['tabular-nums']}}>{tracks.length}</Text>
      </View>
      {(tracks.length>3||!!query)&&<TrackListTools query={query} onQuery={setQuery} sort={sort} onSort={setSort} label="搜索已加载歌曲歌手专辑"/>}
      {selection.active&&!picking&&<BatchSelectionBar count={selectionCount(selection)} total={shownRows.length} allSelected={shownRows.length>0&&selectionCount(selection)===shownRows.length} actions={['favorite','playlist','next','download']} busy={busy} testPrefix="discovery"
        onSelectAll={()=>setSelection(current=>selectionToggleAll(current,shownRows.map(row=>row.key)))}
        onCancel={()=>{setSelection(selectionNone);setPicking(false);}}
        onAction={action=>{void runBatch(action);}}/>}
      {selection.active&&picking&&<PlaylistPicker inline services={services} tracks={selectionByListOrder(selection,shownRows,row=>row.key).map(row=>row.track)} visible onClose={()=>setPicking(false)} onAdded={title=>toast.show(`已添加 ${selectionCount(selection)} 首到 ${title}`)}/>}
    </>:view.kind==='detail'?<>
      {/* Sollin 02-playlist.png: borderless floating artwork + metadata directly over warm blush ambient */}
      <View style={{flexDirection:'row',alignItems:'center',gap:16,paddingTop:4}}>
        <View style={s.cardShadow}><Cover services={services} url={artistMetadata?.artwork??view.artwork} size={122} radius={16}/></View>
        <View style={{flex:1,gap:6}}>
          <Text accessibilityRole="header" numberOfLines={3} style={{fontSize:21,fontWeight:'700',lineHeight:27,color:s.ink}}>{artistMetadata?.title??view.title}</Text>
          <Text style={{color:s.muted,fontSize:13}}>{currentPlatform[1]} · 已加载 {artistAlbums?items.length:loadedTracks.length}{total!==undefined?` / ${total}`:''} {artistAlbums?'张专辑':'首'}</Text>
          {!!albumMetadata?.author&&<Text testID="album-artist" style={{color:s.muted,fontSize:13}}>{albumMetadata.author}</Text>}
          {!!albumMetadata?.released&&<Text testID="album-released" style={{color:s.subtle,fontSize:12}}>{albumMetadata.released}</Text>}
        </View>
      </View>

      {!!detailDescription&&((initialCollection?.kind==='album'||initialCollection?.kind==='artist')?<View style={{gap:4}}>
        <Pressable accessibilityRole="button" accessibilityLabel={descriptionOpen?artistMetadata?'收起艺术家简介':'收起专辑简介':artistMetadata?'展开艺术家简介':'展开专辑简介'} accessibilityState={{expanded:descriptionOpen}} onPress={()=>setDescriptionOpen(value=>!value)} style={{minHeight:30,justifyContent:'center'}}>
          <Text style={{color:s.ink,fontSize:13,fontWeight:'600'}}>{artistMetadata?'艺术家':'专辑'}简介 · {descriptionOpen?'收起':'展开'}</Text>
        </Pressable>
        <Text numberOfLines={descriptionOpen?undefined:2} style={{color:s.muted,fontSize:13,lineHeight:20}}>{detailDescription}</Text>
      </View>:<Pressable accessibilityRole="button" accessibilityLabel={descriptionOpen?'收起歌单简介':'展开歌单简介'} onPress={()=>setDescriptionOpen(value=>!value)}>
        <Text numberOfLines={descriptionOpen?undefined:2} style={{color:s.muted,fontSize:13,lineHeight:20}}>{detailDescription}</Text>
        <Text style={{color:s.ink,fontSize:12,fontWeight:'700',marginTop:4}}>{descriptionOpen?'收起':'展开'}</Text>
      </Pressable>)}

      {/* Sollin 02-playlist.png: two outlined pills (收藏歌单 / 刷新) + optional full import */}
      <View style={{flexDirection:'row',gap:10,flexWrap:'wrap',alignItems:'center'}}>
        {!view.rank&&initialCollection?.kind!=='artist'&&<CatalogFavoriteButton services={services} target={{kind:initialCollection?.kind==='album'?'album':'playlist',platform,id:view.id,title:albumMetadata?.title??view.title,...((albumMetadata?.artwork??view.artwork)?{artwork:albumMetadata?.artwork??view.artwork}:{}),...(albumMetadata?.author?{author:albumMetadata.author}:{}),...(albumMetadata?.released?{released:albumMetadata.released}:{}),...(detailDescription?{description:detailDescription}:{})}}/>}
        <Pressable accessibilityRole="button" accessibilityLabel={refreshLabel} accessibilityHint="重新读取当前分页，失败时保留已加载内容" onPress={()=>{void load();}} disabled={loading} style={{minHeight:40,paddingHorizontal:15,borderRadius:20,borderWidth:1,borderColor:outlineBorder,backgroundColor:s.dark?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.22)',flexDirection:'row',alignItems:'center',gap:6,opacity:loading?.45:1}}>
          <Ionicons name="refresh" size={16} color={s.ink}/>
          <Text style={{color:s.ink,fontSize:13,fontWeight:'600'}}>刷新</Text>
        </Pressable>
        {initialCollection?.kind!=='artist'&&(()=>{const importLabel=importing?(publicAlbum?'正在读取公开曲目…':'正在完整读取…'):emptyDetail?(initialCollection?.kind==='album'?'专辑为空':'歌单为空'):initialCollection?.kind==='album'?(publicAlbum?'导入公开曲目到音乐库':'导入完整专辑到音乐库'):'导入完整歌单到音乐库';return <Pressable testID="discovery-import-full" accessibilityRole="button" accessibilityLabel={importLabel} disabled={importing||emptyDetail} onPress={()=>{void importPlaylist();}} style={{minHeight:40,paddingHorizontal:14,borderRadius:20,borderWidth:1,borderColor:outlineBorder,backgroundColor:s.dark?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.22)',flexDirection:'row',alignItems:'center',gap:5,opacity:importing||emptyDetail?.42:1}}>
          <Ionicons name="download-outline" size={15} color={s.ink}/>
          <Text style={{color:s.ink,fontSize:13,fontWeight:'600'}}>{importLabel}</Text>
        </Pressable>;})()}
        {importing&&button('取消读取',()=>{importAbort.current.abort();setImporting(false);},false,'discovery-import-cancel')}
      </View>

      {artistMetadata&&<View style={{gap:8}}>
        <Text testID="artist-search-counts" style={{color:s.muted,fontSize:13}}>{initialCollection?.artistSummaryLabel??'搜索摘要'}：{(initialCollection?.collection as ArtistItem).songCount??'未知'} 首歌曲 · {(initialCollection?.collection as ArtistItem).albumCount??'未知'} 张专辑</Text>
        {artistInfo.songCount!==undefined&&<Text testID="artist-detail-counts" style={{color:s.muted,fontSize:13}}>详情资料：{artistInfo.songCount} 首歌曲 · {artistInfo.albumCount??'未知'} 张专辑</Text>}
        <View style={{flexDirection:'row',gap:8}}>{(['songs','albums']as const).map(tab=><Pressable key={tab} testID={`artist-tab-${tab}`} accessibilityRole="tab" accessibilityState={{selected:artistAlbums===(tab==='albums')}} onPress={()=>{if(artistAlbums!==(tab==='albums')){setTotal(undefined);setArtistAlbums(tab==='albums');}}} style={{minHeight:38,justifyContent:'center',paddingHorizontal:18,backgroundColor:artistAlbums===(tab==='albums')?playPrimaryBg:softSurface,borderRadius:19}}><Text style={{color:artistAlbums===(tab==='albums')?playPrimaryInk:s.muted,fontSize:14,fontWeight:'600'}}>{tab==='songs'?'歌曲':'专辑'}</Text></Pressable>)}</View>
        {!artistAlbums&&popular&&<Text testID="artist-popular-scope" style={{color:s.muted,fontSize:12}}>当前展示热门歌曲集合，已加载不代表艺术家完整曲库。</Text>}
      </View>}
      {publicAlbum&&initialCollection?.kind==='album'&&<Text testID="album-public-scope" style={{color:s.muted,fontSize:12,lineHeight:19}}>当前仅展示平台公开目录返回的曲目，不代表完整发行版。未返回的曲目不会导入。</Text>}

      {/* Sollin 02-playlist.png: equal-width dual action buttons (#3A3333 dark charcoal + translucent white) */}
      {tracks.length>0&&<View style={{flexDirection:'row',gap:10,paddingTop:2}}>
        <Pressable accessibilityRole="button" accessibilityLabel="播放已加载歌曲" onPress={()=>services.playTracks(tracks,0)} style={{flex:1,minHeight:46,borderRadius:14,backgroundColor:playPrimaryBg,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:12}}>
          <Ionicons name="play" size={16} color={playPrimaryInk}/>
          <Text numberOfLines={1} style={{color:playPrimaryInk,fontSize:14,fontWeight:'600'}}>播放已加载歌曲</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="随机播放已加载" onPress={()=>{void services.preferences.update({repeat:'off',shuffle:true}).then(()=>services.playTracks(tracks,0)).catch(()=>setMessage('无法保存随机模式，请重试'));}} style={{flex:1,minHeight:46,borderRadius:14,backgroundColor:softSurface,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:12}}>
          <Ionicons name="shuffle" size={17} color={s.ink}/>
          <Text numberOfLines={1} style={{color:s.ink,fontSize:14,fontWeight:'600'}}>随机播放已加载</Text>
        </Pressable>
      </View>}

      {!artistAlbums&&<>
        <View style={{flexDirection:'row',alignItems:'baseline',gap:8,paddingTop:4}}>
          <Text style={{color:s.ink,fontSize:17,fontWeight:'700'}}>歌曲</Text>
          <Text style={{color:s.muted,fontSize:14,fontWeight:'600',fontVariant:['tabular-nums']}}>{tracks.length}</Text>
        </View>
        <TrackListTools query={query} onQuery={setQuery} sort={sort} onSort={setSort} label="搜索已加载歌曲歌手专辑"/>
        <Text style={{color:s.subtle,fontSize:11}}>筛选显示 {tracks.length} 首；{initialCollection?.kind==='artist'?'搜索和排序仅作用于已加载歌曲，不代表完整艺术家曲库。':publicAlbum?'搜索和排序仅作用于已加载歌曲，导入保留公开目录顺序。':'搜索和排序仅作用于已加载歌曲，完整导入保留平台原始顺序。'}</Text>
      </>}
      {selection.active&&!picking&&<BatchSelectionBar count={selectionCount(selection)} total={shownRows.length} allSelected={shownRows.length>0&&selectionCount(selection)===shownRows.length} actions={['favorite','playlist','next','download']} busy={busy} testPrefix="discovery"
        onSelectAll={()=>setSelection(current=>selectionToggleAll(current,shownRows.map(row=>row.key)))}
        onCancel={()=>{setSelection(selectionNone);setPicking(false);}}
        onAction={action=>{void runBatch(action);}}/>}
      {selection.active&&picking&&<PlaylistPicker inline services={services} tracks={selectionByListOrder(selection,shownRows,row=>row.key).map(row=>row.track)} visible onClose={()=>setPicking(false)} onAdded={title=>toast.show(`已添加 ${selectionCount(selection)} 首到 ${title}`)}/>}
    </>:<>
      {/* Sollin 01-discover.png: clean display header + universal top-right Audio Match & Globe (全球电台) icons */}
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:4}}>
        <Text accessibilityRole="header" style={{fontSize:30,fontWeight:'700',lineHeight:36,color:s.ink,letterSpacing:-0.5}}>发现</Text>
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
          <Pressable testID="discovery-audio-match" accessibilityRole="button" accessibilityLabel="打开听歌识曲" onPress={()=>setAudioMatchOpen(true)} style={{width:34,height:34,borderRadius:17,backgroundColor:softSurface,alignItems:'center',justifyContent:'center'}}>
            <Ionicons name="ear-outline" size={17} color={s.ink}/>
          </Pressable>
          <Pressable testID="discovery-global-radio" accessibilityRole="button" accessibilityLabel="打开全球电台" onPress={()=>setRadioOpen(true)} style={{width:34,height:34,borderRadius:17,backgroundColor:softSurface,alignItems:'center',justifyContent:'center'}}>
            <Ionicons name="earth-outline" size={18} color={s.ink}/>
          </Pressable>
        </View>
      </View>

      {/* Sollin-style compact platform dropdown + active LX source switcher directly below 发现 */}
      {(()=>{
        const activeChoice:DiscoverPlatformChoice=qishuiTab?'qishui':bodianTab?'bodian':platform;
        const activeMeta=platformOptions.find(opt=>opt.id===activeChoice)??platformOptions[0]!;
        return <View style={{flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap',marginTop:-4}}>
          <Pressable
            testID="discovery-platform-trigger"
            accessibilityRole="button"
            accessibilityLabel={`切换音乐平台，当前：${activeMeta.name}`}
            onPress={()=>setPlatformSheetOpen(true)}
            style={{flexDirection:'row',alignItems:'center',gap:6,paddingVertical:4,paddingRight:4}}
          >
            <PlatformLogo platform={activeMeta.id} size={22}/>
            <Text style={{color:s.ink,fontSize:14.5,fontWeight:'700'}}>{activeMeta.name}</Text>
            <Ionicons name="chevron-down" size={14} color={s.muted}/>
          </Pressable>
          {openSources&&<>
            <Text style={{color:s.subtle,fontSize:14}}>·</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="音乐来源设置"
              onPress={openSources}
              style={{flexDirection:'row',alignItems:'center',gap:4,paddingVertical:4,maxWidth:180}}
            >
              <Text numberOfLines={1} style={{color:s.muted,fontSize:14,fontWeight:'600'}}>{activeSource??'无 LX 音源'}</Text>
              <Ionicons name="chevron-down" size={13} color={s.muted}/>
              {hasSourceUpdates&&<View style={{width:7,height:7,borderRadius:3.5,backgroundColor:'#E53935'}}/>}
            </Pressable>
          </>}
        </View>;
      })()}

      {qishuiTab?<QishuiDiscoverSection services={services}/>:bodianTab?<BodianDiscoverSection services={services} openAccounts={openAccounts}/>:<>
      {/* Sollin borderless translucent 3-segment control: 精选 | 榜单 | 歌单 */}
      <View style={{flexDirection:'row',padding:3,borderRadius:24,backgroundColor:segmentTrack}}>
        {([['featured','精选'],['rankings','榜单'],['playlists','歌单']]as const).map(([kind,label])=>{
          const selected=view.kind===kind||(kind==='playlists'&&(view.kind==='categories'||view.kind==='artists'||view.kind==='albums'));
          return <Pressable key={kind} accessibilityRole="tab" accessibilityState={{selected}} onPress={()=>setView({kind})} style={[{flex:1,minHeight:38,borderRadius:21,backgroundColor:selected?segmentActive:'transparent',alignItems:'center',justifyContent:'center'},selected&&s.cardShadow]}>
            <Text style={{color:selected?s.ink:s.muted,fontWeight:selected?'700':'500',fontSize:14}}>{label}</Text>
          </Pressable>;
        })}
      </View>

      {/* Platform-capability-aware quick icon row (strictly honors each platform's real abilities; zero NetEase hijacks!) */}
      {(()=>{
        type Shortcut={testID?:string;label:string;a11y:string;icon:React.ComponentProps<typeof Ionicons>['name'];active:boolean;onPress:()=>void};
        let shortcuts:Shortcut[]=[];
        if(platform==='wy'&&wySignedIn){
          // Exact 15-item Sollin NetEase order requested by user
          shortcuts=[
            {testID:'discovery-wy-daily',label:'每日推荐',a11y:'网易云每日推荐',icon:'calendar-outline',active:accountFeature==='wy_daily',onPress:()=>setAccountFeature('wy_daily')},
            {testID:'discovery-wy-rec-playlists',label:'推荐歌单',a11y:'网易云推荐歌单',icon:'albums-outline',active:accountFeature==='wy_rec_playlists',onPress:()=>setAccountFeature('wy_rec_playlists')},
            {testID:'discovery-wy-heartbeat',label:'心动模式',a11y:'开启网易云心动模式',icon:'pulse',active:accountFeature==='wy_heartbeat',onPress:()=>setAccountFeature('wy_heartbeat')},
            {testID:'discovery-wy-sub-playlists',label:'收藏的歌单',a11y:'网易云收藏的歌单',icon:'bookmark-outline',active:accountFeature==='wy_sub_playlists',onPress:()=>setAccountFeature('wy_sub_playlists')},
            {testID:'discovery-wy-created-playlists',label:'创建的歌单',a11y:'网易云创建的歌单',icon:'folder-open-outline',active:accountFeature==='wy_created_playlists',onPress:()=>setAccountFeature('wy_created_playlists')},
            {testID:'discovery-wy-liked',label:'我喜欢',a11y:'网易云我喜欢的音乐',icon:'heart',active:accountFeature==='wy_liked',onPress:()=>setAccountFeature('wy_liked')},
            {testID:'discovery-wy-fm',label:'私人FM',a11y:'开启网易云私人FM',icon:'radio-outline',active:accountFeature==='wy_fm',onPress:()=>setAccountFeature('wy_fm')},
            {testID:'discovery-podcasts',label:'播客专区',a11y:'打开网易云播客专区',icon:'headset-outline',active:podcastsOpen,onPress:()=>setPodcastsOpen(true)},
            {testID:'discovery-wy-recent-songs',label:'最近播放',a11y:'网易云最近播放',icon:'time-outline',active:accountFeature==='wy_recent_songs',onPress:()=>setAccountFeature('wy_recent_songs')},
            {testID:'discovery-wy-recent-playlists',label:'最近歌单',a11y:'网易云最近歌单',icon:'list-outline',active:accountFeature==='wy_recent_playlists',onPress:()=>setAccountFeature('wy_recent_playlists')},
            {testID:'discovery-wy-play-record',label:'听歌排行',a11y:'网易云听歌排行',icon:'stats-chart-outline',active:accountFeature==='wy_play_record',onPress:()=>setAccountFeature('wy_play_record')},
            {testID:'discovery-wy-cloud',label:'我的云盘',a11y:'网易云我的云盘',icon:'cloud-outline',active:accountFeature==='wy_cloud',onPress:()=>setAccountFeature('wy_cloud')},
            {testID:'discovery-wy-sub-artists',label:'收藏歌手',a11y:'网易云收藏歌手',icon:'people-outline',active:accountFeature==='wy_sub_artists',onPress:()=>setAccountFeature('wy_sub_artists')},
            {testID:'discovery-wy-sub-albums',label:'收藏专辑',a11y:'网易云收藏专辑',icon:'disc-outline',active:accountFeature==='wy_sub_albums',onPress:()=>setAccountFeature('wy_sub_albums')},
            {testID:'discovery-wy-sub-mvs',label:'收藏MV',a11y:'网易云收藏MV',icon:'videocam-outline',active:accountFeature==='wy_sub_mvs',onPress:()=>setAccountFeature('wy_sub_mvs')},
          ];
        }else if(platform==='wy'){
          shortcuts=[
            {testID:'discovery-popular-artists',label:'热门歌手',a11y:'热门歌手',icon:'mic-outline',active:view.kind==='artists',onPress:()=>{setCategory(undefined);setView({kind:'artists'});}},
            {testID:'discovery-new-albums',label:'新碟首发',a11y:'新碟首发',icon:'disc-outline',active:view.kind==='albums',onPress:()=>{setCategory(undefined);setView({kind:'albums'});}},
            {testID:'discovery-podcasts',label:'播客专区',a11y:'打开网易云播客专区',icon:'headset-outline',active:podcastsOpen,onPress:()=>setPodcastsOpen(true)},
            {label:'风格推荐',a11y:'打开风格推荐',icon:'sparkles',active:styleOpen,onPress:()=>setStyleOpen(true)},
            {label:'歌单导入',a11y:'展开歌单导入',icon:'albums-outline',active:tools,onPress:()=>setTools(value=>!value)},
          ];
        }else if(platform==='tx'){
          // Exact 6-item Sollin QQ Music capability bar
          shortcuts=[
            {testID:'discovery-tx-liked',label:'我喜欢',a11y:'QQ音乐我喜欢',icon:'heart',active:accountFeature==='tx_liked',onPress:()=>setAccountFeature('tx_liked')},
            {testID:'discovery-tx-playlists',label:'个人歌单',a11y:'QQ音乐个人歌单',icon:'albums-outline',active:accountFeature==='tx_playlists',onPress:()=>setAccountFeature('tx_playlists')},
            {testID:'discovery-tx-radar',label:'雷达推荐',a11y:'QQ音乐雷达推荐',icon:'radio-outline',active:accountFeature==='tx_radar',onPress:()=>setAccountFeature('tx_radar')},
            {testID:'discovery-tx-new-songs',label:'新歌推荐',a11y:'QQ音乐新歌推荐',icon:'sparkles-outline',active:accountFeature==='tx_new_songs',onPress:()=>setAccountFeature('tx_new_songs')},
            {testID:'discovery-tx-rec-playlists',label:'推荐歌单',a11y:'QQ音乐推荐歌单',icon:'musical-notes-outline',active:accountFeature==='tx_rec_playlists',onPress:()=>setAccountFeature('tx_rec_playlists')},
            {testID:'discovery-tx-home-feed',label:'个性首页',a11y:'QQ音乐个性首页',icon:'compass-outline',active:accountFeature==='tx_home_feed',onPress:()=>setAccountFeature('tx_home_feed')},
          ];
        }else if(platform==='kg'){
          // Exact 4-item Sollin Kugou Music capability bar
          shortcuts=[
            {testID:'discovery-kg-daily',label:'每日推荐',a11y:'酷狗每日推荐',icon:'calendar-outline',active:accountFeature==='kg_daily',onPress:()=>setAccountFeature('kg_daily')},
            {testID:'discovery-kg-liked',label:'我喜欢',a11y:'酷狗我喜欢',icon:'heart',active:accountFeature==='kg_liked',onPress:()=>setAccountFeature('kg_liked')},
            {testID:'discovery-kg-playlists',label:'个人歌单',a11y:'酷狗个人歌单',icon:'albums-outline',active:accountFeature==='kg_playlists',onPress:()=>setAccountFeature('kg_playlists')},
            {testID:'discovery-kg-new-songs',label:'新歌速递',a11y:'酷狗新歌速递',icon:'flash-outline',active:accountFeature==='kg_new_songs',onPress:()=>setAccountFeature('kg_new_songs')},
          ];
        }
        // Kuwo (kw) and Migu (mg) do not support account login or NetEase-only shortcuts.
        if(!shortcuts.length)return null;
        return <View style={{gap:10}}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:12,paddingVertical:4,paddingHorizontal:2}}>
            {shortcuts.map(shortcut=><Pressable key={shortcut.label} testID={shortcut.testID} accessibilityRole="button" accessibilityLabel={shortcut.a11y} onPress={shortcut.onPress} style={{width:62,alignItems:'center',gap:6}}>
              <View style={{width:48,height:48,borderRadius:24,backgroundColor:shortcut.active?s.accent:s.accentSoft,alignItems:'center',justifyContent:'center'}}>
                <Ionicons name={shortcut.icon} size={21} color={shortcut.active?'#FFFFFF':s.accent}/>
              </View>
              <Text numberOfLines={1} style={{color:s.ink,fontSize:11.5,fontWeight:'500'}}>{shortcut.label}</Text>
            </Pressable>)}
          </ScrollView>
          {((platform==='wy'&&!wySignedIn)||(platform==='tx'&&!txSignedIn)||(platform==='kg'&&!kgSignedIn))&&openAccounts&&<Pressable testID={`discovery-login-prompt-${platform}`} accessibilityRole="button" onPress={openAccounts} style={{flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:14,paddingVertical:10,borderRadius:16,backgroundColor:softSurface}}>
            <Ionicons name="person-circle-outline" size={20} color={s.accent}/>
            <Text numberOfLines={1} style={{flex:1,color:s.ink,fontSize:12.5,fontWeight:'600'}}>
              {platform==='wy'?'登录网易云解锁每日推荐、心动模式、私人FM与个人歌单':platform==='tx'?'登录 QQ 音乐解锁我喜欢、个人歌单与雷达推荐':'登录酷狗解锁每日推荐、我喜欢与个人歌单'}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={s.subtle}/>
          </Pressable>}
        </View>;
      })()}

      {/* Sollin NetEase horizontal rotating banner carousel (positioned below quick actions, above 风格化推荐) */}
      {embedded&&platform==='wy'&&banners.length>0&&<View testID="netease-banner-carousel" style={{gap:8}}>
        <View style={[{borderRadius:18,overflow:'hidden',backgroundColor:softSurface},s.cardShadow]}>
          <ScrollView ref={bannerScroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={32}
            onScrollBeginDrag={()=>{bannerDragging.current=true;}}
            onScrollEndDrag={()=>{bannerDragging.current=false;}}
            onMomentumScrollEnd={event=>{
              bannerDragging.current=false;
              const idx=Math.round(event.nativeEvent.contentOffset.x/Math.max(1,usableWidth));
              setBannerIndex(Math.max(0,Math.min(banners.length-1,idx)));
            }}>
            {banners.map((banner,idx)=><Pressable key={`${banner.id}-${idx}`} testID={`netease-banner-${idx}`} accessibilityRole="button" accessibilityLabel={banner.typeTitle?`网易云推荐横幅：${banner.typeTitle}`:'网易云推荐横幅'} onPress={()=>openBanner(banner)} style={{width:usableWidth,height:Math.round(Math.min(200,Math.max(132,usableWidth/2.55)))}}>
              <Image source={{uri:banner.imageUrl}} resizeMode="cover" style={StyleSheet.absoluteFill}/>
              {!!banner.typeTitle&&<View style={{position:'absolute',left:10,bottom:10,paddingHorizontal:10,paddingVertical:4,borderRadius:999,backgroundColor:'rgba(0,0,0,0.55)'}}>
                <Text style={{color:'#FFFFFF',fontSize:11.5,fontWeight:'700'}}>{banner.typeTitle}</Text>
              </View>}
            </Pressable>)}
          </ScrollView>
        </View>
        {banners.length>1&&<View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:5}}>
          {banners.map((banner,idx)=><View key={`${banner.id}-dot-${idx}`} style={{width:idx===bannerIndex?16:5,height:5,borderRadius:2.5,backgroundColor:idx===bannerIndex?s.accent:s.subtle+'66'}}/>)}
        </View>}
      </View>}

      {/* Sollin 01-discover.png: 风格化推荐 section (shown on NetEase where public style tags belong) */}
      {platform==='wy'&&<View style={{gap:10,paddingTop:2}}>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <Text style={{color:s.ink,fontSize:19,fontWeight:'700'}}>风格化推荐</Text>
            <Ionicons name="play" size={14} color={s.subtle}/>
          </View>
          <Pressable testID="discovery-style-recommendation" accessibilityRole="button" accessibilityLabel="定制风格化推荐" accessibilityHint="从公开分类中选择最多五个标签" onPress={()=>setStyleOpen(true)} style={{minHeight:32,paddingHorizontal:4,justifyContent:'center'}}>
            <Text style={{color:s.accent,fontSize:13,fontWeight:'600'}}>选择标签</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="按标签生成专属推荐" onPress={()=>setStyleOpen(true)} style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:4}}>
          <Ionicons name="options-outline" size={22} color={s.muted}/>
          <View style={{flex:1,gap:2}}>
            <Text style={{color:s.ink,fontSize:14.5,fontWeight:'500'}}>选择喜欢的曲风、语种或场景</Text>
            <Text style={{color:s.muted,fontSize:12}}>按标签生成专属推荐</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={s.subtle}/>
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:10,paddingVertical:2}}>
          {styleQuickCards.map(card=><Pressable key={card.title} accessibilityRole="button" accessibilityLabel={`风格推荐：${card.title}`} onPress={()=>setStyleOpen(true)} style={{width:132,paddingHorizontal:12,paddingVertical:11,borderRadius:16,backgroundColor:s.dark?'rgba(255,255,255,0.08)':card.tint,gap:6}}>
            <Ionicons name={card.icon} size={18} color={s.accent}/>
            <Text numberOfLines={1} style={{color:s.ink,fontSize:14,fontWeight:'700'}}>{card.title}</Text>
            <Text numberOfLines={1} style={{color:s.muted,fontSize:11.5}}>{card.subtitle}</Text>
          </Pressable>)}
        </ScrollView>
      </View>}

      {catalogShortcuts}

      {view.kind!=='featured'&&<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingTop:4}}>
        <Text style={{color:s.ink,fontSize:20,fontWeight:'700'}}>{view.kind==='rankings'?'排行榜':view.kind==='categories'?'歌单分类':view.kind==='artists'?'网易热门歌手':view.kind==='albums'?'网易新碟首发':category?`歌单 · ${category}`:'歌单广场'}</Text>
        <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
          {view.kind==='playlists'&&<Pressable accessibilityRole="button" accessibilityLabel="按分类筛选歌单" onPress={()=>setView({kind:'categories'})} style={{paddingHorizontal:11,paddingVertical:5,borderRadius:14,backgroundColor:softSurface}}>
            <Text style={{color:s.ink,fontSize:12,fontWeight:'600'}}>分类筛选</Text>
          </Pressable>}
          {view.kind==='playlists'&&<Pressable accessibilityRole="button" accessibilityLabel="展开歌单链接导入" onPress={()=>setTools(v=>!v)} style={{paddingHorizontal:11,paddingVertical:5,borderRadius:14,backgroundColor:tools?s.accentSoft:softSurface}}>
            <Text style={{color:tools?s.accent:s.ink,fontSize:12,fontWeight:'600'}}>链接导入</Text>
          </Pressable>}
          {!!category&&<Pressable accessibilityRole="button" accessibilityLabel="清除分类筛选" onPress={()=>{setCategory(undefined);setView({kind:'playlists'});}} style={{paddingHorizontal:11,paddingVertical:5,borderRadius:14,backgroundColor:s.accentSoft}}>
            <Text style={{color:s.accent,fontSize:12,fontWeight:'600'}}>清除筛选</Text>
          </Pressable>}
        </View>
      </View>}
      {view.kind==='artists'&&<Text testID="popular-artists-count" accessibilityLiveRegion="polite" style={{color:s.muted,fontSize:12}}>已加载 {items.length} 位歌手 · 平台公开热门目录</Text>}
      {view.kind==='albums'&&<Text testID="new-albums-count" accessibilityLiveRegion="polite" style={{color:s.muted,fontSize:12}}>已加载 {items.length} 张专辑 · 平台公开新碟目录</Text>}
      {(tools||!embedded)&&<View style={{gap:10,padding:14,borderRadius:18,backgroundColor:softSurface}}>
        <TextInput testID="discovery-link-input" accessibilityLabel="公开歌单分享链接或ID" placeholder="分享链接或当前平台歌单ID" placeholderTextColor={s.subtle} value={link} editable={!linkLoading} onChangeText={value=>{setLink(value);linkGeneration.current++;linkAbort.current.abort();setLinkLoading(false);setMessage('');}} autoCorrect={false} autoCapitalize="none" style={{color:s.ink,backgroundColor:s.inputBg,paddingHorizontal:14,paddingVertical:11,borderRadius:14,fontSize:14}}/>
        <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
          {button(linkLoading?'正在解析分享链接…':'预览分享歌单',()=>{void previewPlaylistLink();},linkLoading||!link.trim(),'discovery-link-preview',true)}
          {linkLoading&&button('取消解析',cancelLinkPreview,false,'discovery-link-cancel')}
        </View>
        <QishuiImport services={services}/>
      </View>}
      {view.kind==='featured'&&<FeaturedDiscoverFeed
        services={services}
        platform={platform}
        data={featuredData}
        loading={featuredLoading}
        error={featuredError}
        onRetry={()=>{void loadFeatured();}}
        onOpenPlaylist={pl=>openCollection(pl,false,'featured')}
        onOpenAlbum={al=>setNestedCollection({platform,kind:'album',collection:al,returnLabel:'返回精选'})}
        onOpenArtist={ar=>setNestedCollection({platform,kind:'artist',collection:ar,returnLabel:'返回精选'})}
        onOpenRank={rank=>openCollection({id:rank.id,title:rank.title,artwork:rank.artwork,description:rank.updateFrequency},true,'featured')}
        onOpenCategory={cat=>{setCategory(cat.id);setView({kind:'playlists'});}}
        onOpenMV={mv=>setActiveMV(mv)}
        onOpenMorePlaylists={()=>{setCategory(undefined);setView({kind:'playlists'});}}
        onOpenMoreRankings={()=>setView({kind:'rankings'})}
        onOpenMoreAlbums={platform==='wy'?()=>{setView({kind:'albums'});}:()=>{setView({kind:'playlists'});}}
        onOpenMoreArtists={platform==='wy'?()=>{setView({kind:'artists'});}:()=>{setView({kind:'playlists'});}}
        onOpenMoreMVs={platform==='wy'?tab=>setMvPlazaTab(tab):undefined}
        onOpenSongShelf={(title,shelfTracks)=>{setDescriptionOpen(false);setTotal(shelfTracks.length);setView({kind:'bannerSongs',id:`shelf-${title}`,title,artwork:shelfTracks[0]?.artwork,tracks:shelfTracks,returnView:'featured'});}}
      />}
      </>}
    </>}
    {!!message&&<Text accessibilityLiveRegion="polite" style={{color:s.accent,fontSize:13,lineHeight:20}}>{message}</Text>}
  </View>;

  const content=<View testID="discovery-content" onLayout={event=>{const next=Math.max(1,event.nativeEvent.layout.width-40);setContentWidth(previous=>previous!==undefined&&Math.abs(previous-next)<.5?previous:next);}} style={{flex:1,backgroundColor:embedded?'transparent':theme.palette.background[0],paddingHorizontal:20,paddingTop:embedded?0:54}}>
    <FlatList ref={listRef} key={columns} numColumns={columns} columnWrapperStyle={columns>1?{gap:14}:undefined} data={view.kind==='featured'||qishuiTab||bodianTab?[]:displayed} keyExtractor={(item,index)=>item.kind==='track'?item.key??`${index}-track`:`${index}-${item.kind}`} ListHeaderComponent={header} initialNumToRender={12} windowSize={7} contentContainerStyle={{paddingBottom:embedded?bottomInset:44}} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" scrollEventThrottle={64} onScroll={e=>{const y=Math.max(0,e.nativeEvent.contentOffset.y);scrollOffsets.current[activeScrollKey]=y;setShowBackTop(prev=>(y>520)!==prev?y>520:prev);}}
      renderItem={({item,index})=>item.kind==='track'?(()=>{const key=item.key??`${index}-track`,checked=selectionHas(selection,key),rowPlayState=trackPlayback.stateFor(item.track),isActive=rowPlayState!=='idle';return <View testID={`discovery-track-${index}`} style={{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:9,paddingHorizontal:isActive?6:0,borderRadius:isActive?12:0,backgroundColor:isActive?(s.dark?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.48)'):'transparent'}}>
        <Pressable accessibilityRole="button" onLongPress={()=>{setPicking(false);setSelection(selectionEnter(key));}} onPress={()=>{if(selection.active)setSelection(selectionToggle(selection,key));else{trackPlayback.markPending(item.track);services.playTracks(tracks,index);}}} accessibilityLabel={`${selection.active?checked?'取消选择':'选择':'播放'}${item.track.title}`} accessibilityState={{selected:checked}} style={{flex:1,minHeight:48,flexDirection:'row',alignItems:'center',gap:12}}>
          {selection.active&&<Ionicons name={checked?'checkmark-circle':'ellipse-outline'} size={21} color={checked?s.control:s.subtle}/>}
          <Cover services={services} track={item.track} size={46} radius={10}/>
          <View style={{flex:1,gap:3}}>
            <Text numberOfLines={1} style={{color:isActive?s.accent:s.ink,fontSize:15,fontWeight:isActive?'700':'600'}}>{item.track.title}</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
              <QualityBadge track={item.track}/>
              <Text numberOfLines={1} style={{flex:1,color:s.muted,fontSize:12.5}}>{item.track.artist}{item.track.album?` · ${item.track.album}`:''}</Text>
            </View>
          </View>
          <TrackPlaybackIndicator state={rowPlayState} color={s.accent} size={15}/>
          {view.kind==='detail'&&view.rank&&!isActive&&<Text style={{color:s.subtle,fontSize:13,fontWeight:'700',fontVariant:['tabular-nums']}}>{String(index+1).padStart(2,'0')}</Text>}
        </Pressable>
        {!selection.active&&<Pressable testID={`discovery-more-${index}`} accessibilityRole="button" accessibilityLabel={`更多操作：${item.track.title}`} onPress={()=>setMenuTrack(item.track)} style={{width:36,height:42,alignItems:'center',justifyContent:'center'}}><Ionicons name="ellipsis-horizontal" size={19} color={s.muted}/></Pressable>}
      </View>;})():view.kind==='rankings'&&item.kind==='collection'?<Pressable testID={`discovery-item-${index}`} accessibilityRole="button" onPress={()=>openCollection(item.value,item.rank)} style={{flexDirection:'row',alignItems:'center',gap:14,padding:10,marginBottom:10,borderRadius:16,backgroundColor:softSurface}}>
        <Cover services={services} url={item.value.artwork} size={58} radius={12}/>
        <View style={{flex:1,gap:4}}>
          <Text numberOfLines={1} style={{color:s.ink,fontSize:16,fontWeight:'700'}}>{item.value.title}</Text>
          <Text numberOfLines={2} style={{color:s.muted,fontSize:12.5,lineHeight:17}}>{item.value.description??(item.value.count!==undefined?`${item.value.count} 首`:'官方排行榜')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={s.subtle}/>
      </Pressable>:item.kind==='category'?<Pressable testID={`discovery-item-${index}`} accessibilityRole="button" onPress={()=>{setCategory(item.id);setView({kind:'playlists'});}} style={{flex:1,marginBottom:10,maxWidth:cardWidth,paddingHorizontal:14,paddingVertical:13,borderRadius:16,backgroundColor:category===item.id?playPrimaryBg:softSurface,gap:4}}>
        <Text numberOfLines={1} style={{color:category===item.id?playPrimaryInk:s.ink,fontSize:15,fontWeight:'600'}}>{item.title}</Text>
        {!!item.group&&<Text numberOfLines={1} style={{color:category===item.id?playPrimaryInk+'B8':s.muted,fontSize:12}}>{item.group}</Text>}
      </Pressable>:<Pressable testID={`discovery-item-${index}`} accessibilityRole="button" onPress={()=>item.kind==='artist'?setNestedCollection({platform:'wy',collection:item.value,kind:'artist',returnLabel:'返回热门歌手',artistSummaryLabel:'热门目录摘要'}):(initialCollection?.kind==='artist'&&artistAlbums||view.kind==='albums')?setNestedCollection({platform,collection:item.value,kind:'album',returnLabel:view.kind==='albums'?'返回新碟首发':'返回艺术家专辑'}):openCollection(item.value,item.rank)} style={{flex:1,marginBottom:18,gap:7,maxWidth:cardWidth}}>
        <View style={s.cardShadow}><Cover services={services} url={item.value.artwork} size={cardWidth} radius={14}/></View>
        <Text numberOfLines={2} style={{color:s.ink,fontSize:14,fontWeight:'600',lineHeight:19}}>{item.value.title}</Text>
        <Text numberOfLines={1} style={{color:s.muted,fontSize:12}}>{item.kind==='artist'?'查看歌曲与专辑':item.value.count!==undefined?`${item.value.author?`${item.value.author} · `:''}${item.value.count} 首`:item.value.description}</Text>
      </Pressable>}
      ListFooterComponent={view.kind==='featured'||qishuiTab||bodianTab?null:<View style={{gap:10,paddingVertical:18}}>{loading&&<Text style={{color:s.muted,fontSize:13}}>正在获取平台数据…</Text>}{!!error&&<Text testID="discovery-load-error" accessibilityLiveRegion="polite" style={{color:s.accent,fontSize:13}}>{error}</Text>}{!!emptyDetailMessage&&<Text testID="discovery-empty-detail" accessibilityLiveRegion="polite" style={{color:s.muted,fontSize:13}}>{emptyDetailMessage}</Text>}{!loading&&!error&&!items.length&&!inDetail&&<Text style={{color:s.muted,fontSize:13}}>此平台暂未返回可展示内容</Text>}{view.kind!=='bannerSongs'&&<View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{loading&&(inDetail||view.kind==='artists'||view.kind==='albums')&&button('取消页面读取',cancelPageRead,false,'discovery-page-cancel')}{button(error?'重试':'刷新',()=>{void load(error?retryAppend:false);},loading,'discovery-load-retry')}{more&&button('加载更多',()=>{void load(true);},loading,'discovery-load-more')}</View>}</View>} showsVerticalScrollIndicator={false}/>
    {showBackTop&&<Pressable testID="discovery-back-top" accessibilityRole="button" accessibilityLabel="返回顶部" onPress={()=>listRef.current?.scrollToOffset({offset:0,animated:true})} style={[{position:'absolute',right:18,bottom:embedded?bottomInset+12:24,width:44,height:44,borderRadius:22,backgroundColor:segmentActive,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:s.cardBorder},s.cardShadow]}>
      <Ionicons name="arrow-up" size={20} color={s.ink}/>
    </Pressable>}
    <Toast message={toast.message} onDismiss={toast.clear}/>
  </View>;

  const platformPickerSheet=<Modal visible={platformSheetOpen} transparent animationType="fade" onRequestClose={()=>setPlatformSheetOpen(false)}>
    <View style={{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,0.42)'}}>
      <Pressable accessibilityRole="button" accessibilityLabel="关闭平台选择" onPress={()=>setPlatformSheetOpen(false)} style={{flex:1}}/>
      <View testID="discovery-platform-sheet" style={{backgroundColor:s.dark?'#1F1C20':'#FFF9F5',borderTopLeftRadius:28,borderTopRightRadius:28,paddingHorizontal:18,paddingTop:12,paddingBottom:34,gap:8}}>
        <View style={{width:38,height:4,borderRadius:2,backgroundColor:s.subtle+'66',alignSelf:'center',marginBottom:8}}/>
        {platformOptions.map(opt=>{
          const activeChoice:DiscoverPlatformChoice=qishuiTab?'qishui':bodianTab?'bodian':platform;
          const selected=activeChoice===opt.id;
          return <Pressable
            key={opt.id}
            testID={`platform-${opt.id}`}
            accessibilityRole="radio"
            accessibilityLabel={opt.name}
            accessibilityState={{selected}}
            onPress={()=>pickDiscoverPlatform(opt.id)}
            style={{
              minHeight:54,
              paddingHorizontal:14,
              borderRadius:16,
              backgroundColor:selected?s.accent:'transparent',
              flexDirection:'row',
              alignItems:'center',
              gap:13,
            }}
          >
            <PlatformLogo platform={opt.id} size={34} ring={selected}/>
            <Text style={{flex:1,fontSize:16,fontWeight:selected?'700':'600',color:selected?'#FFFFFF':s.ink}}>{opt.name}</Text>
            {selected&&<Ionicons name="checkmark" size={20} color="#FFFFFF"/>}
          </Pressable>;
        })}
      </View>
    </View>
  </Modal>;

  const overlays=<>{platformPickerSheet}<DownloadSubmissionModal services={services} report={downloadReport} onClose={()=>setDownloadReport(null)}/><TrackActions services={services} track={menuTrack} prefix="discovery" onClose={()=>setMenuTrack(null)}/><StyleRecommendationSheet services={services} visible={styleOpen} onClose={()=>setStyleOpen(false)} onOpenPlaylist={item=>{setStyleOpen(false);setPlatform('wy');setCategory(undefined);setTotal(undefined);setView({kind:'detail',id:item.id,title:item.title,rank:false,artwork:item.artwork,description:item.description,returnView:currentTabKind});}}/>{mvPlazaTab&&<MVPlazaModal services={services} visible initialTab={mvPlazaTab} onClose={()=>setMvPlazaTab(null)} onSelectMV={mv=>{setMvPlazaTab(null);setActiveMV(mv);}}/>}{activeMV&&<MVDetail services={services} platform={activeMV.platform} video={activeMV} onClose={()=>setActiveMV(null)}/>}<NeteasePodcastsModal services={services} visible={podcastsOpen} onClose={()=>setPodcastsOpen(false)}/><GlobalRadioModal services={services} visible={radioOpen} onClose={()=>setRadioOpen(false)}/><AudioMatchModal services={services} visible={audioMatchOpen} onClose={()=>setAudioMatchOpen(false)}/>{accountFeature&&<AccountFeatureSheet services={services} feature={accountFeature} onClose={()=>setAccountFeature(null)} onOpenAccounts={openAccounts} onOpenPlaylist={(plat,pl)=>{setPlatform(plat);openCollection(pl,false,currentTabKind);}} onOpenArtist={(plat,ar)=>setNestedCollection({platform:plat,kind:'artist',collection:ar,returnLabel:'返回发现'})} onOpenAlbum={(plat,al)=>setNestedCollection({platform:plat,kind:'album',collection:al,returnLabel:'返回发现'})} onOpenMV={mv=>setActiveMV(mv)}/>}{nestedCollection&&<Discovery services={services} initialCollection={nestedCollection} onClose={()=>setNestedCollection(null)}/>}</>;
  if(embedded)return <><View style={{flex:1}}>{content}</View>{overlays}</>;
  return <>{!initialCollection&&<View style={{marginBottom:18}}>{button('发现 · 分类 · 排行榜 · 歌单导入',()=>setOpen(true))}</View>}<Modal visible={open} animationType="slide" onRequestClose={close}>{content}{overlays}</Modal></>;
}
