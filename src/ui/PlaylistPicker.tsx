import {Text,TextInput} from './Typography.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {useState,useSyncExternalStore} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet} from 'react-native';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
export function PlaylistPicker({services,tracks,visible,onClose}:{services:Services;tracks:readonly Track[];visible:boolean;onClose:()=>void}) {
  const theme=useTheme();const styles=useThemedStyles(makeStyles);
  const library=useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const [name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function add(id?:string){setBusy(true);setError('');try{if(id)await services.library.addTracks(id,tracks);else await services.library.createPlaylist(name,tracks);setName('');onClose();}catch{setError('未能保存，原歌单保留，请重试');}finally{setBusy(false);}}
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <ScrollView keyboardShouldPersistTaps="handled" style={styles.root} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onClose}><Text style={styles.action}>取消添加</Text></Pressable>
      <Text style={styles.title}>加入音枢歌单</Text><Text style={styles.caption}>加入 {tracks.length} 首；已存在的歌曲也会保留为独立条目。</Text>
      {library.playlists.map(playlist=><Pressable accessibilityRole="button" key={playlist.id} disabled={busy} onPress={()=>{void add(playlist.id);}} style={styles.button}><Text style={styles.text}>{playlist.title} · {playlist.entries.length} 首</Text></Pressable>)}
      <TextInput accessibilityLabel="新建音枢歌单名称" value={name} onChangeText={setName} placeholder="新建歌单名称" placeholderTextColor="#768191" style={styles.input}/>
      <Pressable accessibilityRole="button" disabled={busy||!name.trim()} onPress={()=>{void add();}} style={styles.button}><Text style={styles.action}>新建并添加</Text></Pressable>
      {!!error&&<Text style={styles.caption}>{error}</Text>}
    </ScrollView>
  </Modal>;
}
const makeStyles=(theme:Theme)=>StyleSheet.create({root:{flex:1,backgroundColor:theme.color('#111318')},content:{padding:24,paddingTop:70,gap:18},title:{color:theme.color('#EEECE7'),fontSize:26},caption:{color:theme.color('#929CAB'),fontSize:12,lineHeight:22},action:{color:theme.color('#D9F49B'),fontSize:14},text:{color:theme.color('#E5E8EE'),fontSize:14},button:{padding:16,borderRadius:12,backgroundColor:theme.color('#263329')},input:{color:theme.color('#EEECE7'),borderWidth:1,borderColor:theme.color('#414754'),padding:14,borderRadius:12}});
