import {Text} from './Typography.tsx';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Alert,FlatList,Pressable,View} from 'react-native';
import {Modal} from './AdaptiveModal.tsx';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {trackRows,viewTrackRows,selectedTrackRows,type TrackRow,type TrackSort} from '../domain/trackList.ts';
import {useTheme} from './theme.tsx';
import {PlaylistPicker} from './PlaylistPicker.tsx';
import {MatchModal} from './MatchModal.tsx';
import {Cover} from './Cover.tsx';
import {TrackListTools} from './TrackListTools.tsx';
import {SwipeRemoveRow} from './SwipeRemoveRow.tsx';
import {playlistCoverSource} from '../domain/playlistCover.ts';
import {TrackActions} from './TrackActions.tsx';
import {DownloadSubmissionView} from './DownloadSubmission.tsx';
import type {DownloadSubmission} from '../app/downloadSubmission.ts';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
export function TrackListModal({services,tracks,entryIds,title,coverUrl,visible,onClose,playlistId,kind}:{services:Services;tracks:readonly Track[];entryIds?:readonly string[];title:string;coverUrl?:string;visible:boolean;onClose:()=>void;playlistId?:string;kind:'favorites'|'history'|'playlist'}){
  const {palette:p}=useTheme(),[selected,setSelected]=useState<ReadonlySet<string>>(new Set()),[adding,setAdding]=useState<readonly Track[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const insets=useSafeAreaInsets();
  const [query,setQuery]=useState(''),[sort,setSort]=useState<TrackSort>('original'),[matching,setMatching]=useState<Track|null>(null);
  const [menu,setMenu]=useState<Track|null>(null),[downloadReport,setDownloadReport]=useState<DownloadSubmission|null>(null);
  const removing=useRef(false),submitting=useRef(false),generation=useRef(0),isVisible=useRef(visible);isVisible.current=visible;
  useEffect(()=>{generation.current++;submitting.current=false;setBusy(false);setSelected(new Set());setMessage('');setQuery('');setSort('original');setMenu(null);setAdding([]);setMatching(null);setDownloadReport(null);return()=>{generation.current++;};},[visible,playlistId,kind]);
  const rows=useMemo(()=>trackRows(tracks,entryIds),[tracks,entryIds]);
  const shown=useMemo(()=>viewTrackRows(rows,query,sort),[rows,query,sort]),shownTracks=useMemo(()=>shown.map(row=>row.track),[shown]);
  useEffect(()=>{const valid=new Set(rows.map(row=>row.key));setSelected(old=>[...old].every(key=>valid.has(key))?old:new Set([...old].filter(key=>valid.has(key))));},[rows]);
  // Filtering does not silently discard selected rows. Every selected entry
  // follows the current sort, including entries temporarily outside the filter.
  const chosen=useMemo(()=>selectedTrackRows(viewTrackRows(rows,'',sort),selected),[rows,sort,selected]);
  const cover=playlistCoverSource(coverUrl,tracks[0]);
  const allShownSelected=shown.length>0&&shown.every(row=>selected.has(row.key));
  const button=(label:string,action:()=>void,disabled=false,testID?:string,accessibilityLabel=label)=><Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel} disabled={disabled} onPress={action} style={{padding:11,backgroundColor:p.selected,borderRadius:10,opacity:disabled?.4:1}}><Text style={{color:p.accent}}>{label}</Text></Pressable>;
  async function removeRows(wanted:readonly TrackRow[]){
    if(removing.current)return;removing.current=true;setBusy(true);
    try{
      if(playlistId)await services.library.removeEntries(playlistId,wanted.map(row=>row.key));
      else if(kind==='favorites')await services.library.removeFavorites(wanted.map(row=>row.track));
      else await services.library.removeHistoryTracks(wanted.map(row=>row.track));
      const removed=new Set(wanted.map(row=>row.key));setSelected(old=>new Set([...old].filter(key=>!removed.has(key))));setMessage(`已移除 ${wanted.length} 条`);
    }catch{setMessage('操作未完成，原音乐库与选择保留');}finally{removing.current=false;setBusy(false);}
  }
  const confirmRemove=(wanted:readonly TrackRow[])=>Alert.alert('移除所选条目？',`共 ${wanted.length} 条。此操作仅修改本地音乐库。`,[{text:'取消',style:'cancel'},{text:'移除',style:'destructive',onPress:()=>{void removeRows(wanted);}}]);
  async function downloadSelected(){
    if(!chosen.length||busy||submitting.current)return;
    submitting.current=true;setBusy(true);setMessage('');const owner=generation.current;
    try{
      const report=await services.submitDownloads(chosen.map(row=>row.track));
      if(generation.current===owner&&isVisible.current){setDownloadReport(report);if(report.entries.every(item=>item.disposition!=='failed'))setSelected(new Set());}
    }catch{if(generation.current===owner&&isVisible.current)setMessage('下载提交未完成，请查看下载管理中的已有任务');}
    finally{if(generation.current===owner){submitting.current=false;setBusy(false);}}
  }
  const header=<View style={{gap:14,paddingBottom:20}}>
    <View style={{flexDirection:'row',gap:16,alignItems:'center'}}><Cover services={services} url={cover.url} track={cover.track} size={88} testID="track-list-cover"/><View style={{flex:1}}><Text accessibilityRole="header" style={{fontSize:24,color:p.text}}>{title}</Text><Text testID="track-list-count" style={{color:p.secondary,marginTop:7}}>显示 {shown.length} / {rows.length} 首 · 已选 {chosen.length} 条</Text></View></View>
    <TrackListTools query={query} onQuery={setQuery} sort={sort} onSort={setSort}/>
    <Text style={{color:p.secondary,fontSize:12}}>搜索不清除已选条目，批量操作按当前排序处理；向左滑动歌曲可移除此条。</Text>
    <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{button('播放当前结果',()=>services.playTracks(shownTracks,0),!shown.length)}{button(allShownSelected?'取消全选':'全选当前结果',()=>setSelected(old=>{const next=new Set(old);for(const row of shown)if(allShownSelected)next.delete(row.key);else next.add(row.key);return next;}),!shown.length||busy)}{chosen.length>0&&button('清除选择',()=>setSelected(new Set()),busy)}</View>
    {chosen.length>0&&<View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{button(`加入歌单(${chosen.length})`,()=>setAdding(chosen.map(row=>row.track)),busy)}{button('所选下一首播放',()=>{services.addTracksToQueue(chosen.map(row=>row.track),true);setMessage(`已添加 ${chosen.length} 首到下一首播放`);setSelected(new Set());},busy)}{button('所选加入队列',()=>{services.addTracksToQueue(chosen.map(row=>row.track));setSelected(new Set());},busy)}{button('下载所选歌曲',()=>{void downloadSelected();},busy)}{button(kind==='favorites'?'取消所选本地收藏':'移除所选',()=>confirmRemove(chosen),busy)}</View>}
    {!!message&&<Text accessibilityLiveRegion="polite" style={{color:p.accent}}>{message}</Text>}
  </View>;
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>{downloadReport?<View style={{flex:1,paddingTop:insets.top,paddingBottom:insets.bottom,backgroundColor:p.background[0]}}><DownloadSubmissionView services={services} report={downloadReport} onClose={()=>setDownloadReport(null)}/></View>:<View style={{flex:1,backgroundColor:p.background[0],paddingHorizontal:24,paddingTop:64}}>
    <View style={{paddingBottom:14}}>{button('收起歌曲列表',onClose,busy)}</View>
    <FlatList data={shown} extraData={selected} keyExtractor={row=>row.key} keyboardShouldPersistTaps="handled" initialNumToRender={12} windowSize={5} maxToRenderPerBatch={12} ListHeaderComponent={header} contentContainerStyle={{paddingBottom:30}} ListEmptyComponent={<Text style={{color:p.secondary,paddingVertical:24}}>没有匹配歌曲</Text>}
      renderItem={({item:row,index})=><SwipeRemoveRow key={row.key} label={row.track.title} disabled={busy} onRemove={()=>confirmRemove([row])}><View style={{paddingVertical:16,borderTopWidth:1,borderColor:p.border,flexDirection:'row',gap:10}}>
        <Pressable testID={`track-select-${row.originalIndex}`} accessibilityRole="checkbox" accessibilityLabel={`选择歌曲：${row.track.title}`} accessibilityState={{checked:selected.has(row.key)}} disabled={busy} onPress={()=>setSelected(old=>{const next=new Set(old);if(next.has(row.key))next.delete(row.key);else next.add(row.key);return next;})} style={{width:36,paddingVertical:10}}><Text style={{color:p.accent,fontSize:22}}>{selected.has(row.key)?'☑':'☐'}</Text></Pressable>
        <View style={{flex:1}}><Pressable testID={`track-row-${row.originalIndex}`} accessibilityRole="button" onPress={()=>services.playTracks(shownTracks,index)}><Text style={{color:p.text,fontSize:16}}>{index+1}. {row.track.title}</Text><Text style={{color:p.secondary,marginTop:7}}>{row.track.artist}{row.track.album?` · ${row.track.album}`:''}</Text></Pressable>
          <View style={{flexDirection:'row',gap:8,marginTop:10,flexWrap:'wrap'}}>{button('下一首',()=>services.addToQueue(row.track,true))}{button('移除此条',()=>confirmRemove([row]),busy)}{(row.track.origin.kind==='imported'||row.track.origin.kind==='online')&&button('匹配歌曲',()=>setMatching(row.track))}{button('更多',()=>setMenu(row.track),busy,`library-list-more-${row.originalIndex}`,`更多操作：${row.track.title}`)}{playlistId&&row.originalIndex>0&&button('上移',()=>{const current=services.library.getSnapshot().playlists.find(item=>item.id===playlistId),at=current?.entries.findIndex(item=>item.id===row.key)??-1;if(at>0)void services.library.moveEntry(playlistId,row.key,at-1).catch(()=>setMessage('移动失败'));},busy)}</View>
        </View>
      </View></SwipeRemoveRow>}/>
    <PlaylistPicker services={services} tracks={adding} visible={adding.length>0} onClose={()=>setAdding([])}/><MatchModal services={services} track={matching} onClose={()=>setMatching(null)}/>
    <TrackActions services={services} track={menu} prefix="library-list" favoriteScope="library" extras onClose={()=>setMenu(null)}/>
  </View>}</Modal>;
}
