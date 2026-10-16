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
export function TrackListModal({services,tracks,entryIds,title,visible,onClose,playlistId,kind}:{services:Services;tracks:readonly Track[];entryIds?:readonly string[];title:string;visible:boolean;onClose:()=>void;playlistId?:string;kind:'favorites'|'history'|'playlist'}){
  const {palette:p}=useTheme(),[selected,setSelected]=useState<ReadonlySet<string>>(new Set()),[adding,setAdding]=useState<readonly Track[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [query,setQuery]=useState(''),[sort,setSort]=useState<TrackSort>('original'),[matching,setMatching]=useState<Track|null>(null);
  useEffect(()=>{setSelected(new Set());setMessage('');setQuery('');setSort('original');},[visible,playlistId,kind]);
  const removing=useRef(false);
  const rows=useMemo(()=>trackRows(tracks,entryIds),[tracks,entryIds]);
  const shown=useMemo(()=>viewTrackRows(rows,query,sort),[rows,query,sort]),shownTracks=useMemo(()=>shown.map(row=>row.track),[shown]);
  useEffect(()=>{const valid=new Set(rows.map(row=>row.key));setSelected(old=>[...old].every(key=>valid.has(key))?old:new Set([...old].filter(key=>valid.has(key))));},[rows]);
  const chosen=useMemo(()=>selectedTrackRows(rows,selected),[rows,selected]);
  const allShownSelected=shown.length>0&&shown.every(row=>selected.has(row.key));
  const button=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={{padding:11,backgroundColor:p.selected,borderRadius:10,opacity:disabled?.4:1}}><Text style={{color:p.accent}}>{label}</Text></Pressable>;
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
  const header=<View style={{gap:14,paddingBottom:20}}>
    <View style={{flexDirection:'row',gap:16,alignItems:'center'}}><Cover services={services} track={tracks[0]} size={88}/><View style={{flex:1}}><Text accessibilityRole="header" style={{fontSize:24,color:p.text}}>{title}</Text><Text testID="track-list-count" style={{color:p.secondary,marginTop:7}}>显示 {shown.length} / {rows.length} 首 · 已选 {chosen.length} 条</Text></View></View>
    <TrackListTools query={query} onQuery={setQuery} sort={sort} onSort={setSort}/>
    <Text style={{color:p.secondary,fontSize:12}}>搜索和排序只改变显示顺序；向左滑动歌曲可移除此条。</Text>
    <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{button('播放当前结果',()=>services.playTracks(shownTracks,0),!shown.length)}{button(allShownSelected?'取消全选':'全选当前结果',()=>setSelected(old=>{const next=new Set(old);for(const row of shown)if(allShownSelected)next.delete(row.key);else next.add(row.key);return next;}),!shown.length||busy)}{chosen.length>0&&button('清除选择',()=>setSelected(new Set()),busy)}</View>
    {chosen.length>0&&<View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{button(`加入歌单(${chosen.length})`,()=>setAdding(chosen.map(row=>row.track)),busy)}{button('所选加入队列',()=>{services.addTracksToQueue(chosen.map(row=>row.track));setSelected(new Set());},busy)}{button('移除所选',()=>confirmRemove(chosen),busy)}</View>}
    {!!message&&<Text accessibilityLiveRegion="polite" style={{color:p.accent}}>{message}</Text>}
  </View>;
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><View style={{flex:1,backgroundColor:p.background[0],paddingHorizontal:24,paddingTop:64}}>
    <View style={{paddingBottom:14}}>{button('收起歌曲列表',onClose,busy)}</View>
    <FlatList data={shown} extraData={selected} keyExtractor={row=>row.key} keyboardShouldPersistTaps="handled" initialNumToRender={12} windowSize={5} maxToRenderPerBatch={12} ListHeaderComponent={header} contentContainerStyle={{paddingBottom:30}} ListEmptyComponent={<Text style={{color:p.secondary,paddingVertical:24}}>没有匹配歌曲</Text>}
      renderItem={({item:row,index})=><SwipeRemoveRow key={row.key} label={row.track.title} disabled={busy} onRemove={()=>confirmRemove([row])}><View style={{paddingVertical:16,borderTopWidth:1,borderColor:p.border,flexDirection:'row',gap:10}}>
        <Pressable testID={`track-select-${row.originalIndex}`} accessibilityRole="checkbox" accessibilityLabel={`选择歌曲：${row.track.title}`} accessibilityState={{checked:selected.has(row.key)}} disabled={busy} onPress={()=>setSelected(old=>{const next=new Set(old);if(next.has(row.key))next.delete(row.key);else next.add(row.key);return next;})} style={{width:36,paddingVertical:10}}><Text style={{color:p.accent,fontSize:22}}>{selected.has(row.key)?'☑':'☐'}</Text></Pressable>
        <View style={{flex:1}}><Pressable testID={`track-row-${row.originalIndex}`} accessibilityRole="button" onPress={()=>services.playTracks(shownTracks,index)}><Text style={{color:p.text,fontSize:16}}>{index+1}. {row.track.title}</Text><Text style={{color:p.secondary,marginTop:7}}>{row.track.artist}{row.track.album?` · ${row.track.album}`:''}</Text></Pressable>
          <View style={{flexDirection:'row',gap:8,marginTop:10,flexWrap:'wrap'}}>{button('下一首',()=>services.addToQueue(row.track,true))}{button('移除此条',()=>confirmRemove([row]),busy)}{(row.track.origin.kind==='imported'||row.track.origin.kind==='online')&&button('匹配歌曲',()=>setMatching(row.track))}{playlistId&&row.originalIndex>0&&button('上移',()=>{const current=services.library.getSnapshot().playlists.find(item=>item.id===playlistId),at=current?.entries.findIndex(item=>item.id===row.key)??-1;if(at>0)void services.library.moveEntry(playlistId,row.key,at-1).catch(()=>setMessage('移动失败'));},busy)}</View>
        </View>
      </View></SwipeRemoveRow>}/>
    <PlaylistPicker services={services} tracks={adding} visible={adding.length>0} onClose={()=>setAdding([])}/><MatchModal services={services} track={matching} onClose={()=>setMatching(null)}/>
  </View></Modal>;
}
