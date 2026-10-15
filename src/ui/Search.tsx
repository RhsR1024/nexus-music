import { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Services } from '../app/services.ts';
import type { OnlinePlatform } from '../domain/track.ts';
import { trackKey } from '../domain/track.ts';
import { platforms } from '../providers/searchCoordinator.ts';
export const platformNames: Readonly<Record<OnlinePlatform,string>> = {wy:'网易云',tx:'QQ音乐',kw:'酷我',kg:'酷狗',mg:'咪咕'};
export function Search({ services }: { services: Services }) {
  const state = useSyncExternalStore(services.search.subscribe,services.search.getSnapshot);
  const [query,setQuery] = useState(state.query), [platform,setPlatform] = useState<OnlinePlatform|'all'>('all');
  const run = () => { void services.search.search(query,platform); };
  return <View>
    <Text style={styles.title}>寻找下一首喜欢的歌</Text>
    <Text style={styles.caption}>五个平台分别搜索、分别展示。导入并启用LX音源后可解析播放。</Text>
    <TextInput accessibilityLabel="搜索歌曲或歌手" placeholder="歌曲、歌手" placeholderTextColor="#768191" autoCorrect={false} value={query} onChangeText={setQuery} onSubmitEditing={run} returnKeyType="search" style={styles.input}/>
    <View style={styles.row}>{(['all',...platforms] as const).map(item => <Pressable key={item} accessibilityRole="radio" accessibilityState={{selected:platform===item}} onPress={() => setPlatform(item)} style={[styles.chip,platform===item&&styles.selected]}><Text style={styles.text}>{item==='all'?'聚合':platformNames[item]}</Text></Pressable>)}</View>
    <Pressable accessibilityRole="button" onPress={run} style={styles.button}><Text style={styles.text}>搜索</Text></Pressable>
    {state.groups.map(group => <View key={group.platform} style={styles.group}>
      <Text style={styles.heading}>{platformNames[group.platform]}　<Text style={styles.caption}>{group.items.length} 首已载入{group.total!==undefined?` / ${group.total}`:''}</Text></Text>
      {group.items.map((track,index) => <View key={trackKey(track.origin)} style={styles.trackRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={`播放${track.title}`} onPress={() => services.playTracks(group.items,index)}>
          <Text style={styles.track}>{track.title}</Text><Text style={styles.caption}>{track.artist}{track.album?` · ${track.album}`:''}</Text>
        </Pressable>
        <View style={styles.row}><Pressable accessibilityRole="button" onPress={() => services.addToQueue(track,true)} style={styles.chip}><Text style={styles.text}>下一首</Text></Pressable><Pressable accessibilityRole="button" onPress={() => services.addToQueue(track)} style={styles.chip}><Text style={styles.text}>加入队列</Text></Pressable></View>
      </View>)}
      {group.loading && <Text style={styles.caption}>正在搜索…</Text>}
      {group.error && <Text style={styles.error}>{group.error}</Text>}
      {!group.loading&&!group.error&&!group.items.length&&<Text style={styles.caption}>没有匹配结果</Text>}
      {(group.hasMore||group.error)&&<Pressable accessibilityRole="button" disabled={group.loading} onPress={() => { void (group.error ? services.search.retry(group.platform) : services.search.more(group.platform)); }} style={styles.button}><Text style={styles.text}>{group.error?'重试':'加载更多'}</Text></Pressable>}
    </View>)}
  </View>;
}
const styles=StyleSheet.create({
  title:{color:'#F1EDE7',fontSize:26,fontWeight:'600'},caption:{color:'#929CAB',fontSize:11,lineHeight:20,marginTop:5},
  input:{color:'#EEECE7',borderWidth:1,borderColor:'#414754',borderRadius:13,padding:14,marginVertical:18,fontSize:15},
  row:{flexDirection:'row',flexWrap:'wrap',gap:8,marginVertical:8},chip:{backgroundColor:'#263329',borderRadius:10,paddingHorizontal:11,paddingVertical:9},selected:{borderWidth:1,borderColor:'#D9F49B'},
  text:{color:'#D9F49B',fontSize:12},button:{backgroundColor:'#303A32',borderRadius:12,padding:13,alignItems:'center',marginVertical:10},
  group:{marginTop:26},heading:{color:'#E5E8E0',fontSize:18},track:{color:'#DFE4EE',fontSize:15,lineHeight:23},trackRow:{paddingVertical:13,borderBottomWidth:1,borderBottomColor:'#2E3440'},error:{color:'#D3AB94',fontSize:12},
});
