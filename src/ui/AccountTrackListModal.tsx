import {useEffect,useMemo,useState} from 'react';
import {FlatList,Pressable,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Services} from '../app/services.ts';
import type {DownloadSubmission} from '../app/downloadSubmission.ts';
import {trackKey,type Track} from '../domain/track.ts';
import {selectionByListOrder,selectionByTapOrder,selectionCount,selectionEnter,selectionHas,selectionNone,selectionToggle,selectionToggleAll,type SelectionModel} from '../domain/selection.ts';
import {Modal} from './AdaptiveModal.tsx';
import {BatchSelectionBar,SelectionMark,type BatchAction} from './BatchSelectionBar.tsx';
import {Cover} from './Cover.tsx';
import {DownloadSubmissionModal} from './DownloadSubmission.tsx';
import {PlaylistPicker} from './PlaylistPicker.tsx';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';

/** Read-only platform list. Playback always replaces the authoritative queue
 * with the exact platform order visible here; no local collection is mutated. */
export function AccountTrackListModal({services,tracks,title,subtitle,note,visible,onClose,prefix,selectionEnabled=false}:{
  services:Services;
  tracks:readonly Track[];
  title:string;
  subtitle:string;
  note?:string;
  visible:boolean;
  onClose:()=>void;
  prefix:string;
  selectionEnabled?:boolean;
}){
  const {palette:p}=useTheme(),insets=useSafeAreaInsets(),[message,setMessage]=useState('');
  const [selection,setSelection]=useState<SelectionModel>(selectionNone),[picking,setPicking]=useState(false),[busy,setBusy]=useState(false),[downloadReport,setDownloadReport]=useState<DownloadSubmission|null>(null);
  const rowKeys=useMemo(()=>tracks.map((track,index)=>`${trackKey(track.origin)}-${index}`),[tracks]);
  const rows=useMemo(()=>tracks.map((track,index)=>({track,key:rowKeys[index]!})),[rowKeys,tracks]);
  useEffect(()=>{setSelection(selectionNone);setPicking(false);setDownloadReport(null);},[tracks,selectionEnabled]);
  useEffect(()=>{if(!visible){setSelection(selectionNone);setPicking(false);setMessage('');setDownloadReport(null);}},[visible]);
  function clearSelection(){setSelection(selectionNone);setPicking(false);}
  async function runBatch(action:BatchAction){
    const count=selectionCount(selection);
    if(!count||busy)return;
    const tapTracks=selectionByTapOrder(selection,rows,row=>row.key).map(row=>row.track);
    const listTracks=selectionByListOrder(selection,rows,row=>row.key).map(row=>row.track);
    if(action==='favorite'){
      setBusy(true);
      try{await services.library.addFavorites(tapTracks);setMessage(`已收藏 ${count} 首（仅本机）`);clearSelection();}
      catch{setMessage('收藏未保存，原音乐库保留');}
      finally{setBusy(false);}
    }else if(action==='next'){
      services.addTracksToQueue(listTracks,true);setMessage(`已添加 ${count} 首到下一首播放`);clearSelection();
    }else if(action==='download'){
      setBusy(true);
      try{
        const report=await services.submitDownloads(listTracks);setDownloadReport(report);
        if(report.entries.every(entry=>entry.disposition!=='failed'))clearSelection();
      }catch{setMessage('下载提交未完成，请查看下载管理中的已有任务');}
      finally{setBusy(false);}
    }else if(action==='playlist')setPicking(true);
  }
  const button=(label:string,onPress:()=>void,testID:string)=><Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{minHeight:44,paddingHorizontal:14,borderRadius:12,backgroundColor:p.selected,alignItems:'center',justifyContent:'center'}}><Text style={{fontSize:13,fontWeight:'600',color:p.accent}}>{label}</Text></Pressable>;
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <View testID={`${prefix}-full`} style={{flex:1,backgroundColor:p.background[0],paddingTop:insets.top+14,paddingHorizontal:20}}>
      <View style={{gap:12,paddingBottom:14,borderBottomWidth:1,borderColor:p.border}}>
        <View style={{flexDirection:'row',alignItems:'flex-start',gap:12}}>
          <View style={{flex:1}}>
            <Text accessibilityRole="header" style={{fontSize:24,fontWeight:'600',color:p.text}}>{title}</Text>
            <Text testID={`${prefix}-full-count`} style={{fontSize:12,lineHeight:20,color:p.secondary,marginTop:5}}>共 {tracks.length} 首 · {subtitle}</Text>
          </View>
          {button('收起完整列表',onClose,`${prefix}-full-close`)}
        </View>
        {!!note&&<Text accessibilityLiveRegion="polite" style={{fontSize:12,lineHeight:20,color:p.secondary}}>{note}</Text>}
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
          {button(`播放全部 ${tracks.length} 首`,()=>services.playTracks(tracks,0),`${prefix}-full-play`)}
          {button('全部加入队列',()=>{services.addTracksToQueue(tracks);setMessage(`已按平台顺序加入 ${tracks.length} 首`);},`${prefix}-full-queue`)}
        </View>
        {!!message&&<Text accessibilityLiveRegion="polite" style={{fontSize:12,color:p.accent}}>{message}</Text>}
      </View>
      {selectionEnabled&&selection.active&&!picking&&<View style={{paddingTop:12}}><BatchSelectionBar count={selectionCount(selection)} total={rows.length} allSelected={rows.length>0&&selectionCount(selection)===rows.length} actions={['favorite','playlist','next','download']} busy={busy} testPrefix={prefix}
        onSelectAll={()=>setSelection(current=>selectionToggleAll(current,rowKeys))}
        onCancel={clearSelection}
        onAction={action=>{void runBatch(action);}}/></View>}
      {selectionEnabled&&selection.active&&picking?<View style={{flex:1}}><PlaylistPicker inline services={services} tracks={selectionByListOrder(selection,rows,row=>row.key).map(row=>row.track)} visible onClose={()=>setPicking(false)} onAdded={title=>{setMessage(`已添加 ${selectionCount(selection)} 首到 ${title}`);clearSelection();}}/></View>:<FlatList data={rows} keyExtractor={row=>row.key} initialNumToRender={12} maxToRenderPerBatch={12} windowSize={7}
        contentContainerStyle={{paddingTop:6,paddingBottom:insets.bottom+30}}
        ListEmptyComponent={<Text style={{fontSize:12,color:p.secondary,paddingVertical:24}}>平台暂未返回歌曲</Text>}
        renderItem={({item:{track,key},index})=>{const checked=selectionHas(selection,key);return <View testID={`${prefix}-full-track-${index}`} style={{minHeight:66,paddingVertical:8,borderBottomWidth:1,borderColor:p.border,flexDirection:'row',alignItems:'center',gap:10}}>
          <Pressable testID={`${prefix}-full-play-${index}`} accessibilityRole="button" accessibilityState={{selected:checked}} accessibilityLabel={`${selection.active?checked?'取消选择':'选择':'播放第'} ${selection.active?'':`${index+1} 首：`}${track.title}`} onLongPress={selectionEnabled?()=>{setPicking(false);setSelection(selectionEnter(key));}:undefined} onPress={()=>{if(selection.active)setSelection(selectionToggle(selection,key));else services.playTracks(tracks,index);}} style={{flex:1,minHeight:50,flexDirection:'row',alignItems:'center',gap:12}}>
            {selection.active&&<SelectionMark selected={checked}/>}
            <Cover services={services} track={track} size={44}/>
            <View style={{flex:1}}>
              <Text numberOfLines={1} style={{fontSize:15,color:p.text}}>{index+1}. {track.title}</Text>
              <Text numberOfLines={1} style={{fontSize:12,color:p.secondary,marginTop:4}}>{track.artist}{track.album?` · ${track.album}`:''}</Text>
            </View>
          </Pressable>
          {!selection.active&&<Pressable testID={`${prefix}-full-next-${index}`} accessibilityRole="button" accessibilityLabel={`下一首播放：${track.title}`} onPress={()=>{services.addToQueue(track,true);setMessage(`已将「${track.title}」加入下一首播放`);}} style={{minHeight:44,paddingHorizontal:8,alignItems:'center',justifyContent:'center'}}>
            <Text style={{fontSize:12,color:p.accent}}>下一首</Text>
          </Pressable>}
        </View>;}}/>}
      <DownloadSubmissionModal services={services} report={downloadReport} onClose={()=>setDownloadReport(null)}/>
    </View>
  </Modal>;
}
