import {Text,TextInput} from './Typography.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {useState,useSyncExternalStore} from 'react';
import { Pressable, ScrollView, StyleSheet} from 'react-native';
import {Modal} from './AdaptiveModal.tsx';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
export function PlaylistPicker({services,tracks,visible,onClose,inline=false,onAdded}:{services:Services;tracks:readonly Track[];visible:boolean;onClose:()=>void;inline?:boolean;onAdded?:(playlistTitle:string)=>void}) {
  const theme=useTheme();const styles=useThemedStyles(makeStyles);
  const library=useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const [name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function add(id?:string){setBusy(true);setError('');try{const title=id?library.playlists.find(playlist=>playlist.id===id)?.title??'歌单':name.trim();if(id)await services.library.addTracks(id,tracks);else await services.library.createPlaylist(name,tracks);setName('');onAdded?.(title);onClose();}catch{setError('未能保存，原歌单保留，请重试');}finally{setBusy(false);}}
  const content=<ScrollView keyboardShouldPersistTaps="handled" style={styles.root} contentContainerStyle={[styles.content,inline&&styles.inlineContent]}>
      <Pressable accessibilityRole="button" onPress={onClose}><Text style={styles.action}>取消添加</Text></Pressable>
      <Text style={styles.title}>加入音枢歌单</Text><Text style={styles.caption}>加入 {tracks.length} 首；已存在的歌曲也会保留为独立条目。</Text>
      {library.playlists.map(playlist=><Pressable accessibilityRole="button" key={playlist.id} disabled={busy} onPress={()=>{void add(playlist.id);}} style={styles.button}><Text style={styles.text}>{playlist.title} · {playlist.entries.length} 首</Text></Pressable>)}
      <TextInput accessibilityLabel="新建音枢歌单名称" value={name} onChangeText={setName} placeholder="新建歌单名称" placeholderTextColor="#768191" style={styles.input}/>
      <Pressable accessibilityRole="button" disabled={busy||!name.trim()} onPress={()=>{void add();}} style={styles.button}><Text style={styles.action}>新建并添加</Text></Pressable>
      {!!error&&<Text style={styles.caption}>{error}</Text>}
    </ScrollView>;
  if(inline)return visible?content:null;
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>{content}</Modal>;
}
const makeStyles=(theme:Theme)=>{const s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);return StyleSheet.create({root:{flex:1,backgroundColor:theme.palette.background[0]},content:{padding:24,paddingTop:70,gap:16},inlineContent:{paddingTop:24},title:{color:s.ink,fontSize:26,fontWeight:'700'},caption:{color:s.muted,fontSize:13,lineHeight:20},action:{color:s.accent,fontSize:15,fontWeight:'600'},text:{color:s.ink,fontSize:15,fontWeight:'500'},button:{padding:16,borderRadius:16,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder},input:{color:s.ink,backgroundColor:s.inputBg,borderWidth:1,borderColor:s.cardBorder,padding:14,borderRadius:14,fontSize:15}});};
