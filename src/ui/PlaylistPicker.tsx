import {Text,TextInput} from './Typography.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {useState,useSyncExternalStore} from 'react';
import {Pressable,ScrollView,StyleSheet,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Modal} from './AdaptiveModal.tsx';
import {Cover} from './Cover.tsx';
import {playlistCoverSource} from '../domain/playlistCover.ts';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';

export function PlaylistPicker({
  services,
  tracks,
  visible,
  onClose,
  inline=false,
  onAdded,
}:{
  services:Services;
  tracks:readonly Track[];
  visible:boolean;
  onClose:()=>void;
  inline?:boolean;
  onAdded?:(playlistTitle:string)=>void;
}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),insets=useSafeAreaInsets();
  const styles=useThemedStyles(makeStyles);
  const library=useSyncExternalStore(services.library.subscribe,services.library.getSnapshot);
  const [name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');

  async function add(id?:string){
    setBusy(true);setError('');
    try{
      const title=id?library.playlists.find(playlist=>playlist.id===id)?.title??'歌单':name.trim();
      if(id)await services.library.addTracks(id,tracks);
      else await services.library.createPlaylist(name,tracks);
      setName('');onAdded?.(title);onClose();
    }catch{
      setError('未能保存，原歌单保留，请重试');
    }finally{
      setBusy(false);
    }
  }

  const content=<View style={[styles.root,{backgroundColor:s.sheetGradient[0]}]}>
    <LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content,inline?styles.inlineContent:{paddingTop:Math.max(insets.top+16,28),paddingBottom:insets.bottom+36}]}>
      <View style={styles.handleWrap}><View style={styles.handle}/></View>
      <View style={styles.header}>
        <View style={{flex:1,gap:2}}>
          <Text accessibilityRole="header" style={styles.title}>加入音枢歌单</Text>
          <Text style={styles.caption}>加入 {tracks.length} 首；已存在的歌曲也会保留为独立条目。</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelBtn}>
          <Text style={styles.action}>取消添加</Text>
        </Pressable>
      </View>

      {library.playlists.length===0?<View style={styles.empty}>
        <Ionicons name="albums-outline" size={32} color={s.subtle}/>
        <Text style={styles.emptyText}>暂无自建歌单</Text>
      </View>:<View style={styles.list}>
        {library.playlists.map(playlist=>{
          const cover=playlistCoverSource(playlist.coverUrl,playlist.entries[0]?.track);
          return <Pressable accessibilityRole="button" accessibilityLabel={`${playlist.title} · ${playlist.entries.length} 首`} key={playlist.id} disabled={busy} onPress={()=>{void add(playlist.id);}} style={[styles.row,busy&&{opacity:.5}]}>
            <Cover services={services} url={cover.url} track={cover.track} size={46} radius={10}/>
            <View style={{flex:1,gap:2}}>
              <Text numberOfLines={1} style={styles.text}>{playlist.title}</Text>
              <Text style={styles.rowSub}>{playlist.entries.length} 首</Text>
            </View>
            <Ionicons name="add-circle-outline" size={21} color={s.accent}/>
          </Pressable>;
        })}
      </View>}

      <View style={styles.createCard}>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
          <Ionicons name="add" size={17} color={s.accent}/>
          <Text style={styles.createTitle}>新建歌单并加入</Text>
        </View>
        <TextInput accessibilityLabel="新建音枢歌单名称" value={name} onChangeText={setName} placeholder="新建歌单名称" placeholderTextColor={s.subtle} style={styles.input}/>
        <Pressable accessibilityRole="button" disabled={busy||!name.trim()} onPress={()=>{void add();}} style={[styles.primaryBtn,(busy||!name.trim())&&{opacity:.42}]}>
          <Text style={styles.primaryBtnText}>新建并添加</Text>
        </Pressable>
      </View>

      {!!error&&<Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
    </ScrollView>
  </View>;

  if(inline)return visible?content:null;
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>{content}</Modal>;
}

const makeStyles=(theme:Theme)=>{
  const s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const soft=s.dark?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.52)';
  return StyleSheet.create({
    root:{flex:1},
    content:{paddingHorizontal:20,gap:16},
    inlineContent:{paddingTop:14,paddingBottom:32},
    handleWrap:{alignItems:'center',paddingBottom:2},
    handle:{width:36,height:4,borderRadius:2,backgroundColor:s.subtle+'66'},
    header:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:12},
    title:{color:s.ink,fontSize:24,fontWeight:'700',letterSpacing:-0.3},
    caption:{color:s.muted,fontSize:12.5,lineHeight:18},
    cancelBtn:{minHeight:36,paddingHorizontal:10,justifyContent:'center'},
    action:{color:s.accent,fontSize:14.5,fontWeight:'600'},
    empty:{paddingVertical:28,alignItems:'center',gap:8,borderRadius:18,backgroundColor:soft},
    emptyText:{color:s.muted,fontSize:14,fontWeight:'500'},
    list:{gap:8},
    row:{flexDirection:'row',alignItems:'center',gap:12,padding:10,borderRadius:16,backgroundColor:soft},
    text:{color:s.ink,fontSize:15,fontWeight:'600'},
    rowSub:{color:s.muted,fontSize:12,fontVariant:['tabular-nums']},
    createCard:{padding:14,borderRadius:18,backgroundColor:soft,gap:10},
    createTitle:{color:s.ink,fontSize:14,fontWeight:'700'},
    input:{color:s.ink,backgroundColor:s.inputBg,paddingHorizontal:14,paddingVertical:12,borderRadius:14,fontSize:15},
    primaryBtn:{minHeight:44,borderRadius:22,backgroundColor:s.accent,alignItems:'center',justifyContent:'center'},
    primaryBtnText:{color:'#FFFFFF',fontSize:15,fontWeight:'600'},
    error:{color:s.accent,fontSize:13,lineHeight:19},
  });
};
