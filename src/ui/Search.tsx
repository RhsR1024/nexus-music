import {Text,TextInput} from './Typography.tsx';
import {useTheme,useThemedStyles,type Theme} from './theme.tsx';
import { Discovery } from './Discovery.tsx';
import { useEffect, useState, useSyncExternalStore } from 'react';
import {Keyboard, Pressable, StyleSheet, View} from 'react-native';
import type { Services } from '../app/services.ts';
import type { OnlinePlatform } from '../domain/track.ts';
import { trackKey } from '../domain/track.ts';
import { platforms } from '../providers/searchCoordinator.ts';
import {TrackActions} from './TrackActions.tsx';
import {Ionicons} from '@expo/vector-icons';
import type {Track} from '../domain/track.ts';
export const platformNames: Readonly<Record<OnlinePlatform,string>> = {wy:'网易云',tx:'QQ音乐',kw:'酷我',kg:'酷狗',mg:'咪咕'};
export function Search({ services }: { services: Services }) {
  const theme=useTheme();const styles=useThemedStyles(makeStyles);
  const state = useSyncExternalStore(services.search.subscribe,services.search.getSnapshot);
  const [query,setQuery] = useState(state.query), [platform,setPlatform] = useState<OnlinePlatform|'all'>('all');

  const [menuTrack,setMenuTrack]=useState<Track|null>(null);
  const [pages,setPages]=useState<Partial<Record<OnlinePlatform,number>>>({});
  useEffect(()=>setPages({}),[state.query]);
  useEffect(()=>setPages(value=>{
    const next={...value};let changed=false;
    for(const group of state.groups){const max=Math.max(0,Math.ceil(group.items.length/50)-1);if((next[group.platform]??0)>max){next[group.platform]=max;changed=true;}}
    return changed?next:value;
  }),[state.groups]);
  const run = () => { Keyboard.dismiss(); void services.search.search(query,platform); };
  return <View><Discovery services={services}/>
    <Text style={styles.title}>寻找下一首喜欢的歌</Text>
    <Text style={styles.caption}>五个平台分别搜索、分别展示。导入并启用LX音源后可解析播放。</Text>
    <TextInput accessibilityLabel="搜索歌曲或歌手" placeholder="歌曲、歌手" placeholderTextColor="#768191" autoCorrect={false} value={query} onChangeText={setQuery} onSubmitEditing={run} returnKeyType="search" style={styles.input}/>
    <View style={styles.row}>{(['all',...platforms] as const).map(item => <Pressable key={item} accessibilityRole="radio" accessibilityState={{selected:platform===item}} onPress={() => setPlatform(item)} style={[styles.chip,platform===item&&styles.selected]}><Text style={styles.text}>{item==='all'?'聚合':platformNames[item]}</Text></Pressable>)}</View>
    <Pressable testID="run-online-search" accessibilityRole="button" onPress={run} style={styles.button}><Text style={styles.text}>搜索</Text></Pressable>
    {state.groups.map(group => <View key={group.platform} style={styles.group}>
      <Text style={styles.heading}>{platformNames[group.platform]}　<Text style={styles.caption}>{group.items.length} 首已载入{group.total!==undefined?` / ${group.total}`:''}</Text></Text>
      {group.items.slice((pages[group.platform]??0)*50,((pages[group.platform]??0)+1)*50).map((track,relativeIndex) => {const index=(pages[group.platform]??0)*50+relativeIndex;return <View key={`${index}-${trackKey(track.origin)}`} style={styles.trackRow}>
        <Pressable accessibilityRole="button" testID={`search-track-${group.platform}-${index}`} accessibilityLabel={`播放${track.title}`} style={{flex:1,minHeight:44}} onPress={() => services.playTracks(group.items,index)}>
          <Text style={styles.track}>{track.title}</Text><Text style={styles.caption}>{track.artist}{track.album?` · ${track.album}`:''}</Text>
        </Pressable>
        <Pressable testID={`search-more-${group.platform}-${index}`} accessibilityRole="button" accessibilityLabel={`更多操作：${track.title}`} onPress={()=>setMenuTrack(track)} style={styles.more}><Ionicons name="ellipsis-horizontal" size={24} color={theme.palette.accent}/></Pressable>
      </View>;})}
      {group.items.length>50&&<View style={styles.row}>
        <Pressable accessibilityRole="button" disabled={!(pages[group.platform]??0)} onPress={()=>setPages(value=>({...value,[group.platform]:Math.max(0,(value[group.platform]??0)-1)}))} style={styles.chip}><Text style={styles.text}>上一页</Text></Pressable>
        <Text style={styles.caption}>第 {(pages[group.platform]??0)+1} / {Math.ceil(group.items.length/50)} 页</Text>
        <Pressable accessibilityRole="button" disabled={((pages[group.platform]??0)+1)*50>=group.items.length} onPress={()=>setPages(value=>({...value,[group.platform]:(value[group.platform]??0)+1}))} style={styles.chip}><Text style={styles.text}>下一页</Text></Pressable>
      </View>}
      {group.loading && <Text style={styles.caption}>正在搜索…</Text>}
      {group.error && <Text style={styles.error}>{group.error}</Text>}
      {!group.loading&&!group.error&&!group.items.length&&<Text style={styles.caption}>没有匹配结果</Text>}
      {(group.hasMore||group.error)&&<Pressable accessibilityRole="button" disabled={group.loading} onPress={() => { void (group.error ? services.search.retry(group.platform) : services.search.more(group.platform)); }} style={styles.button}><Text style={styles.text}>{group.error?'重试':'加载更多'}</Text></Pressable>}
    </View>)}
    <TrackActions services={services} track={menuTrack} prefix="search" onClose={()=>setMenuTrack(null)} extras/>
  </View>;
}
const makeStyles=(theme:Theme)=>StyleSheet.create({
  title:{color:theme.color('#F1EDE7'),fontSize:26,fontWeight:'600'},caption:{color:theme.color('#929CAB'),fontSize:11,lineHeight:20,marginTop:5},
  input:{color:theme.color('#EEECE7'),borderWidth:1,borderColor:theme.color('#414754'),borderRadius:13,padding:14,marginVertical:18,fontSize:15},
  row:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:8},chip:{backgroundColor:theme.color('#263329'),borderRadius:10,paddingHorizontal:11,paddingVertical:9},selected:{borderWidth:1,borderColor:theme.color('#D9F49B')},
  text:{color:theme.color('#D9F49B'),fontSize:12},button:{backgroundColor:theme.color('#303A32'),borderRadius:12,padding:13,alignItems:'center',marginVertical:10},
  group:{marginTop:26},heading:{color:theme.color('#E5E8E0'),fontSize:18},track:{color:theme.color('#DFE4EE'),fontSize:15,lineHeight:23},more:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},trackRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,paddingVertical:13,borderBottomWidth:1,borderBottomColor:theme.color('#2E3440')},error:{color:theme.color('#D3AB94'),fontSize:12},
});
