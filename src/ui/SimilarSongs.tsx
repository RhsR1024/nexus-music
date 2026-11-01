import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,FlatList,Keyboard,Pressable,View} from 'react-native';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {trackKey} from '../domain/track.ts';
import {SimilarSongsSession} from '../app/similarSongs.ts';
import {Cover} from './Cover.tsx';
import type {ReactNode} from 'react';
import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,space,typography} from './tokens.ts';

export function SimilarSongs({services,track,onBack,onSelect,renderSongActions,backLabel='返回歌曲操作'}:{services:Services;track:Track;onBack:()=>void;onSelect:(tracks:readonly Track[],index:number)=>void;backLabel?:string;renderSongActions:(track:Track|null,onClose:()=>void)=>ReactNode}){
 const {palette:p}=useTheme(),session=useMemo(()=>new SimilarSongsSession(services.similarSongs),[services]),state=useSyncExternalStore(session.subscribe,session.getSnapshot),[menu,setMenu]=useState<Track|null>(null);
 const key=trackKey(track.origin),list=useRef<FlatList<Track>>(null),epoch=useRef(0),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[actionError,setActionError]=useState('');
 const playback=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot),current=playback.queue.entries.find(entry=>entry.id===playback.queue.currentId)?.track;
 const normalized=query.trim().toLocaleLowerCase(),visible=state.items.filter(item=>!normalized||`${item.title} ${item.artist}`.toLocaleLowerCase().includes(normalized)),currentIndex=current?visible.findIndex(item=>trackKey(item.origin)===trackKey(current.origin)):-1;
 const select=(index:number)=>{if(!busy){epoch.current++;session.cancel();onSelect(state.items,index);}};
 const shuffle=async()=>{const owner=epoch.current,items=state.items;setBusy(true);setActionError('');try{await services.preferences.update({shuffle:true});if(epoch.current===owner)onSelect(items,0);}catch{if(epoch.current===owner)setActionError('随机模式未能保存，请重试。');}finally{if(epoch.current===owner)setBusy(false);}};
 useEffect(()=>{epoch.current++;setMenu(null);setQuery('');setBusy(false);setActionError('');void session.load(track);return()=>{epoch.current++;session.cancel();};},[session,key]);
 const button=(id:string,label:string,run:()=>void,disabled=false)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} disabled={disabled||busy} onPress={run} style={{minHeight:controls.hit,padding:space.md,borderRadius:radius.md,backgroundColor:p.surface,justifyContent:'center',opacity:disabled||busy?0.5:1}}><Text style={{...typography.body,color:p.accent}}>{label}</Text></Pressable>;
 return <View style={{flex:1,backgroundColor:p.background[0]}}><FlatList ref={list} testID="similar-songs-list" data={visible} onScrollToIndexFailed={info=>list.current?.scrollToOffset({offset:Math.max(0,info.averageItemLength*info.index),animated:false})} keyExtractor={song=>trackKey(song.origin)} contentContainerStyle={{padding:space.lg,gap:space.md,paddingBottom:space.xxl}}
  ListHeaderComponent={<View style={{gap:space.md,paddingBottom:space.md}}>
   {button('similar-back',backLabel,()=>{epoch.current++;session.cancel();onBack();})}
   <Text accessibilityRole="header" style={{...typography.title,color:p.text}}>相似歌曲</Text>
   <Text style={{...typography.body,color:p.text}}>{track.title} · {track.artist}</Text>
   <Text style={{...typography.caption,color:p.secondary}}>网易云公开推荐 · 选曲将用本次完整结果替换播放队列，播放仍由当前音源解析。</Text>
   <TextInput testID="similar-query" accessibilityLabel="在本次推荐中搜索" placeholder="在本次推荐中搜索歌曲或歌手" value={query} onChangeText={setQuery} onSubmitEditing={()=>Keyboard.dismiss()} returnKeyType="search" style={{...typography.body,color:p.text,minHeight:controls.hit,padding:space.md,borderRadius:radius.md,backgroundColor:p.surface}}/>
   {!!query&&button('similar-clear','清除推荐内搜索',()=>setQuery(''))}
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:space.sm}}>{button('similar-play-all','播放全部推荐',()=>select(0),!state.items.length)}
   {button('similar-shuffle','随机播放推荐',()=>{void shuffle();},!state.items.length)}
   {button('similar-locate','定位当前播放',()=>list.current?.scrollToIndex({index:currentIndex,animated:true,viewPosition:0.4}),currentIndex<0)}
   {button('similar-refresh','刷新相似歌曲',()=>{void session.load(track,true);},state.status==='loading')}</View>
   {!!actionError&&<Text accessibilityRole="alert" style={{color:p.accent}}>{actionError}</Text>}
   {state.status==='loading'&&<View accessibilityLiveRegion="polite" style={{flexDirection:'row',gap:space.sm}}><ActivityIndicator color={p.accent}/><Text style={{color:p.secondary}}>正在读取相似歌曲…</Text></View>}
   {state.status==='error'&&<><Text testID="similar-error" accessibilityRole="alert" style={{color:p.accent}}>{state.error}</Text>{button('similar-retry','重试相似歌曲',()=>{void session.load(track,true);})}</>}
   {state.status==='ready'&&<Text testID="similar-count" accessibilityLiveRegion="polite" style={{...typography.caption,color:p.secondary}}>{state.items.length?`本次推荐 ${state.items.length} 首`:'暂无相似歌曲'}</Text>}
  </View>}
  ListEmptyComponent={state.status==='ready'&&state.items.length?<Text style={{color:p.secondary}}>本次推荐中没有匹配歌曲</Text>:null}
  renderItem={({item})=><View style={{flexDirection:'row',alignItems:'center',gap:space.sm,padding:space.md,borderRadius:radius.lg,backgroundColor:p.surface}}>
   <Pressable testID={`similar-play-${state.items.indexOf(item)}`} accessibilityRole="button" accessibilityLabel={`播放相似歌曲：${item.title}`} disabled={busy} onPress={()=>select(state.items.indexOf(item))} style={{flex:1,minHeight:controls.hit,flexDirection:'row',alignItems:'center',gap:space.md}}>
    <Cover services={services} track={item} size={controls.hit}/><View style={{flex:1}}><Text numberOfLines={2} style={{...typography.body,color:p.text}}>{item.title}</Text><Text numberOfLines={2} style={{...typography.caption,color:p.secondary}}>{item.artist}</Text></View>
   </Pressable>
   <Pressable testID={`similar-more-${state.items.indexOf(item)}`} accessibilityRole="button" accessibilityLabel={`更多操作：${item.title}`} disabled={busy} onPress={()=>setMenu(item)} style={{minWidth:controls.hit,minHeight:controls.hit,alignItems:'center',justifyContent:'center'}}><Text style={{...typography.title,color:p.accent}}>…</Text></Pressable>
  </View>}/>
  {renderSongActions(menu,()=>setMenu(null))}
 </View>;
}
