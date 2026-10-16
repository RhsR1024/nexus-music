import {Text} from './Typography.tsx';
import {useEffect,useState} from 'react';
import {Alert, FlatList, Modal, Pressable, View} from 'react-native';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {useTheme} from './theme.tsx';
import {PlaylistPicker} from './PlaylistPicker.tsx';
import {MatchModal} from './MatchModal.tsx';
export function TrackListModal({services,tracks,entryIds,title,visible,onClose,playlistId,kind}:{services:Services;tracks:readonly Track[];entryIds?:readonly string[];title:string;visible:boolean;onClose:()=>void;playlistId?:string;kind:'favorites'|'history'|'playlist'}){
  const theme=useTheme(),[selected,setSelected]=useState<ReadonlySet<number>>(new Set()),[adding,setAdding]=useState<readonly Track[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [matching,setMatching]=useState<Track|null>(null);
  useEffect(()=>{setSelected(new Set());setMessage('');},[visible,playlistId,kind]);
  const chosen=[...selected].sort((a,b)=>a-b).flatMap(index=>tracks[index]?[tracks[index]!]:[]);
  const button=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={{padding:11,backgroundColor:theme.color('#303A32'),borderRadius:10,opacity:disabled?.4:1}}><Text style={{color:theme.color('#D9F49B')}}>{label}</Text></Pressable>;
  async function removeSelected(){setBusy(true);try{if(playlistId)await services.library.removeEntries(playlistId,[...selected].flatMap(index=>entryIds?.[index]?[entryIds[index]!]:[]));else if(kind==='favorites')await services.library.removeFavorites(chosen);else await services.library.removeHistoryTracks(chosen);setSelected(new Set());setMessage('已移除所选条目');}catch{setMessage('操作未完成，原音乐库保留');}finally{setBusy(false);}}
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><View style={{flex:1,backgroundColor:theme.color('#111318'),paddingHorizontal:24,paddingTop:64}}>
    <View style={{gap:12,paddingBottom:18}}>{button('收起歌曲列表',onClose)}<Text accessibilityRole="header" style={{fontSize:24,color:theme.color('#ECEBF3')}}>{title} · {tracks.length} 首</Text>
      <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{button('播放全部',()=>services.playTracks(tracks,0),!tracks.length)}{button(selected.size===tracks.length?'取消全选':'全选',()=>setSelected(selected.size===tracks.length?new Set():new Set(tracks.map((_,index)=>index))))}</View>
      {!!chosen.length&&<View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>{button(`加入歌单(${chosen.length})`,()=>setAdding(chosen),busy)}{button('所选加入队列',()=>{for(const track of chosen)services.addToQueue(track);setSelected(new Set());},busy)}{button('移除所选',()=>Alert.alert('移除所选条目？',`共 ${chosen.length} 条。此操作仅修改本地音乐库。`,[{text:'取消',style:'cancel'},{text:'移除',style:'destructive',onPress:()=>{void removeSelected();}}]),busy)}</View>}
      {!!message&&<Text style={{color:theme.color('#D6B69A')}}>{message}</Text>}
    </View>
    <FlatList data={tracks} extraData={selected} keyExtractor={(track,index)=>entryIds?.[index]??`${index}-${track.origin.id}`} initialNumToRender={12} windowSize={5} maxToRenderPerBatch={12}
      renderItem={({item,index})=><View style={{paddingVertical:16,borderTopWidth:1,borderColor:theme.color('#303744'),flexDirection:'row',gap:10}}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={`选择歌曲：${item.title}`} accessibilityState={{checked:selected.has(index)}} onPress={()=>setSelected(old=>{const next=new Set(old);if(next.has(index))next.delete(index);else next.add(index);return next;})} style={{width:35,paddingVertical:10}}><Text style={{color:theme.color('#D9F49B'),fontSize:22}}>{selected.has(index)?'☑':'☐'}</Text></Pressable>
        <View style={{flex:1}}><Pressable accessibilityRole="button" onPress={()=>services.playTracks(tracks,index)}><Text style={{color:theme.color('#E1E6F0'),fontSize:16}}>{index+1}. {item.title}</Text><Text style={{color:theme.color('#959EAC'),marginTop:7}}>{item.artist} · {item.album}</Text></Pressable>
          <View style={{flexDirection:'row',gap:10,marginTop:10,flexWrap:'wrap'}}>{button('下一首',()=>services.addToQueue(item,true))}{(item.origin.kind==='imported'||item.origin.kind==='online')&&button('匹配歌曲',()=>setMatching(item))}{playlistId&&index>0&&button('上移',()=>{void services.library.moveEntry(playlistId,entryIds![index]!,index-1).then(()=>setSelected(new Set())).catch(()=>setMessage('移动失败'));})}</View>
        </View>
      </View>}/>
    <PlaylistPicker services={services} tracks={adding} visible={adding.length>0} onClose={()=>setAdding([])}/>
    <MatchModal services={services} track={matching} onClose={()=>setMatching(null)}/>
  </View></Modal>;
}
