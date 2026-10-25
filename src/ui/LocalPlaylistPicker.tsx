import {Text,TextInput} from './Typography.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {useState,useSyncExternalStore} from 'react';
import { Pressable, ScrollView, StyleSheet} from 'react-native';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {defaultDevicePlaylistId} from '../domain/devicePlaylist.ts';

// Device-only picker (Sollin E-1248/E-1250): lists only local playlists,
// excludes the default 我喜欢的, prompts creating one when none exists, and
// closes after submitting — unlike the library picker on the search page.
export function LocalPlaylistPicker({services,tracks,visible,onClose,onAdded}:{services:Services;tracks:readonly Track[];visible:boolean;onClose:()=>void;onAdded?:(playlistTitle:string)=>void}) {
  const theme=useTheme();const styles=useThemedStyles(makeStyles);
  const playlists=useSyncExternalStore(services.devicePlaylists.subscribe,services.devicePlaylists.getSnapshot).filter(playlist=>playlist.id!==defaultDevicePlaylistId);
  const [name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function add(id?:string){
    setBusy(true);setError('');
    try{
      const title=id?playlists.find(playlist=>playlist.id===id)?.title??'本地歌单':name.trim();
      if(id)await services.devicePlaylists.addTracks(id,tracks);else await services.devicePlaylists.create(name,tracks);
      setName('');onAdded?.(title);onClose();
    }catch{setError('未能保存，原本地歌单保留，请重试');}
    finally{setBusy(false);}
  }
  if(!visible)return null;
  return <ScrollView keyboardShouldPersistTaps="handled" style={styles.root} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="取消添加到本地歌单" onPress={onClose}><Text style={styles.action}>取消添加</Text></Pressable>
      <Text style={styles.title}>批量添加到本地歌单</Text>
      <Text style={styles.caption}>已选 {tracks.length} 首；只保存在当前设备，不参与云同步。</Text>
      {playlists.map(playlist=><Pressable accessibilityRole="button" accessibilityLabel={`添加到本地歌单：${playlist.title}`} key={playlist.id} disabled={busy} onPress={()=>{void add(playlist.id);}} style={styles.button}><Text style={styles.text}>{playlist.title} · {playlist.entries.length} 首</Text></Pressable>)}
      {!playlists.length&&<Text style={styles.caption}>还没有可用的本地歌单；在本地音频的“歌单”页新建后再添加。</Text>}
      <TextInput accessibilityLabel="新建本地歌单名称" value={name} onChangeText={setName} placeholder="新建本地歌单名称" placeholderTextColor="#768191" style={styles.input}/>
      <Pressable accessibilityRole="button" accessibilityLabel="新建本地歌单并添加" disabled={busy||!name.trim()} onPress={()=>{void add();}} style={[styles.button,!name.trim()&&styles.disabled]}><Text style={styles.action}>新建并添加</Text></Pressable>
      {!!error&&<Text style={styles.caption}>{error}</Text>}
    </ScrollView>;
}
const makeStyles=(theme:Theme)=>StyleSheet.create({root:{flex:1,backgroundColor:theme.color('#111318')},content:{padding:24,paddingTop:24,gap:16},title:{color:theme.color('#EEECE7'),fontSize:24},caption:{color:theme.color('#929CAB'),fontSize:12,lineHeight:22},action:{color:theme.color('#D9F49B'),fontSize:14},text:{color:theme.color('#E5E8EE'),fontSize:14},button:{padding:16,borderRadius:12,backgroundColor:theme.color('#263329')},disabled:{opacity:.5},input:{color:theme.color('#EEECE7'),borderWidth:1,borderColor:theme.color('#414754'),padding:14,borderRadius:12}});
