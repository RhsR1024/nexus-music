import {Text} from './Typography.tsx';
import {useMemo,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator, Alert, FlatList, Modal, Pressable, View, useWindowDimensions} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {File,Paths} from 'expo-file-system';
import type {Services} from '../app/services.ts';
import {trackRows,viewTrackRows,type TrackSort} from '../domain/trackList.ts';
import {TrackListTools} from './TrackListTools.tsx';
import {Cover} from './Cover.tsx';
import {PlaylistPicker} from './PlaylistPicker.tsx';
import type {Track} from '../domain/track.ts';
import {useTheme} from './theme.tsx';
export function LocalAudioLibrary({services}:{services:Services}) {
  const {width}=useWindowDimensions();
  const {palette:p}=useTheme(),files=useSyncExternalStore(services.localAudio.subscribe,services.localAudio.getSnapshot);
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[query,setQuery]=useState(''),[mode,setMode]=useState<'songs'|'albums'|'artists'>('songs'),[group,setGroup]=useState<string|null>(null),[message,setMessage]=useState(''),[adding,setAdding]=useState<readonly Track[]>();
  const [sort,setSort]=useState<TrackSort>('original');
  const filtered=useMemo(()=>viewTrackRows(trackRows(files.map(file=>file.track),files.map(file=>file.id)),query,sort).map(row=>files[row.originalIndex]!),[files,query,sort]);
  const groupKey=(file:typeof filtered[number])=>mode==='albums'?JSON.stringify([file.track.album||'未知专辑',file.track.artist]):file.track.artist;
  const groups=useMemo(()=>{const values=new Map<string,typeof filtered>();for(const file of filtered){const key=groupKey(file),list=values.get(key);if(list)list.push(file);else values.set(key,[file]);}return [...values].map(([key,files])=>({key,name:mode==='albums'?files[0]!.track.album||'未知专辑':files[0]!.track.artist,files})).sort((a,b)=>a.name.localeCompare(b.name,'zh'));},[filtered,mode]);
  const shown=useMemo(()=>group?filtered.filter(file=>groupKey(file)===group):filtered,[filtered,mode,group]);
  async function importFiles() {
    setBusy(true);setMessage('');let assets:readonly {uri:string;name:string}[]=[];
    try {
      const result=await DocumentPicker.getDocumentAsync({type:'*/*',multiple:true,copyToCacheDirectory:true});if(result.canceled)return;assets=result.assets;
      const value=await services.localAudio.import(assets);setMessage(`已导入 ${value.added} 首，相同内容 ${value.duplicates} 首已跳过`);
    }catch(error){setMessage(error instanceof Error?error.message:'导入失败，原曲库保留');}
    finally{for(const asset of assets)if(asset.uri.startsWith(Paths.cache.uri)){try{const file=new File(asset.uri);if(file.exists)file.delete();}catch{}}setBusy(false);}
  }
  const button=(label:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={{padding:12,borderRadius:16,backgroundColor:p.selected,opacity:disabled?.5:1}}><Text style={{color:p.accent}}>{label}</Text></Pressable>;
  return <View style={{gap:12,marginVertical:18}}>{button(`本地音频 · ${files.length} 首`,()=>setOpen(true))}
    <Modal visible={open} animationType="slide" onRequestClose={()=>setOpen(false)}><View style={{flex:1,padding:22,paddingTop:64,backgroundColor:p.background[0],gap:14}}>
      {button('收起本地音频',()=>setOpen(false))}<Text style={{fontSize:30,fontWeight:'700',color:p.text}}>本地音频</Text>
      <Text style={{color:p.secondary,fontSize:12,lineHeight:19}}>从文件App导入MP3、FLAC、AAC、M4A、WAV、AIFF；复制到此设备，音频不包含在音乐库JSON备份中。每批最多50首、单文件1GiB。</Text>
      {button('导入音频文件',()=>{void importFiles();},busy)}{busy&&<ActivityIndicator accessibilityLabel="正在导入音频" color={p.accent}/>}
      {!!message&&<Text accessibilityLiveRegion="polite" style={{color:p.accent}}>{message}</Text>}
      <TrackListTools label="搜索本地歌曲艺术家专辑" query={query} onQuery={value=>{setQuery(value);setGroup(null);}} sort={sort} onSort={setSort}/>
      <View style={{flexDirection:'row',gap:12}}>{(['songs','albums','artists'] as const).map(value=><View key={value}>{button({songs:'歌曲',albums:'专辑',artists:'艺术家'}[value],()=>{setMode(value);setGroup(null);})}</View>)}</View>
      {group&&button(`返回${mode==='albums'?'专辑':'艺术家'}`,()=>setGroup(null))}
      {mode==='songs'||group?<FlatList data={shown} keyboardShouldPersistTaps="handled" keyExtractor={file=>file.id} initialNumToRender={12} windowSize={5} ListEmptyComponent={<Text style={{color:p.secondary}}>没有匹配的本地音频</Text>} renderItem={({item,index})=><View style={{paddingVertical:12,gap:10,borderBottomWidth:1,borderBottomColor:p.border}}>
        <Pressable accessibilityRole="button" onPress={()=>services.playTracks(shown.map(file=>file.track),index)} style={{flexDirection:'row',gap:12,alignItems:'center'}}><Cover services={services} track={item.track} size={54}/><View style={{flex:1}}><Text style={{color:p.text,fontWeight:'600'}}>{item.track.title}</Text><Text style={{color:p.secondary,fontSize:12}}>{item.track.artist} · {item.extension.toUpperCase()} · {(item.bytes/1048576).toFixed(1)} MB</Text></View></Pressable>
        <View style={{flexDirection:'row',gap:10}}>{button('收藏',()=>{void services.library.favorite(item.track).catch(()=>setMessage('收藏未保存'));})}{button('下一首',()=>services.addToQueue(item.track,true))}{button('加入歌单',()=>setAdding([item.track]))}{button('删除音频',()=>Alert.alert('删除此设备的音频？','歌单引用仍保留，可重新导入同一文件恢复；正在使用的音频不能删除。',[{text:'取消',style:'cancel'},{text:'删除',style:'destructive',onPress:()=>{void services.localAudio.remove(item.id).then(result=>setMessage(result.pendingCleanup?'已移出曲库，暂存文件将在下次启动清理':'音频已删除')).catch(()=>setMessage('音频正在使用或删除失败，原数据保留'));}}]))}</View>
      </View>}/>:<FlatList key={`groups-${mode}`} data={groups} numColumns={mode==='albums'?2:1} columnWrapperStyle={mode==='albums'?{justifyContent:'space-between'}:undefined} keyExtractor={group=>group.key} renderItem={({item})=><Pressable accessibilityRole="button" accessibilityLabel={`${item.name} · ${item.files.length}首`} onPress={()=>setGroup(item.key)} style={{width:mode==='albums'?'48%':'100%',marginVertical:7,padding:12,borderRadius:20,backgroundColor:p.surface,gap:10,flexDirection:mode==='albums'?'column':'row',alignItems:mode==='albums'?'flex-start':'center'}}><Cover services={services} track={item.files[0]!.track} size={mode==='albums'?Math.min(180,Math.max(80,(width-76)/2-24)):48}/><View style={{gap:5,flexShrink:1}}><Text numberOfLines={2} style={{color:p.text,fontWeight:'600'}}>{item.name}</Text><Text style={{color:p.secondary,fontSize:12}}>{item.files.length} 首</Text></View></Pressable>}/>}
      <PlaylistPicker services={services} tracks={adding??[]} visible={!!adding} onClose={()=>setAdding(undefined)}/>
    </View></Modal>
  </View>;
}
