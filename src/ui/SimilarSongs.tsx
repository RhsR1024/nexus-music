import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {ActivityIndicator,FlatList,Keyboard,Pressable,StyleSheet,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import type {Services} from '../app/services.ts';
import type {Track} from '../domain/track.ts';
import {trackKey} from '../domain/track.ts';
import {SimilarSongsSession} from '../app/similarSongs.ts';
import {Cover} from './Cover.tsx';
import type {ReactNode} from 'react';
import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,sollinTokens} from './tokens.ts';

export function SimilarSongs({services,track,onBack,onSelect,renderSongActions,backLabel='返回歌曲操作'}:{services:Services;track:Track;onBack:()=>void;onSelect:(tracks:readonly Track[],index:number)=>void;backLabel?:string;renderSongActions:(track:Track|null,onClose:()=>void)=>ReactNode}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const session=useMemo(()=>new SimilarSongsSession(services.similarSongs),[services]),state=useSyncExternalStore(session.subscribe,session.getSnapshot),[menu,setMenu]=useState<Track|null>(null);
  const key=trackKey(track.origin),list=useRef<FlatList<Track>>(null),epoch=useRef(0),[query,setQuery]=useState(''),[busy,setBusy]=useState(false),[actionError,setActionError]=useState('');
  const playback=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot),current=playback.queue.entries.find(entry=>entry.id===playback.queue.currentId)?.track;
  const normalized=query.trim().toLocaleLowerCase(),visible=state.items.filter(item=>!normalized||`${item.title} ${item.artist}`.toLocaleLowerCase().includes(normalized)),currentIndex=current?visible.findIndex(item=>trackKey(item.origin)===trackKey(current.origin)):-1;
  const select=(index:number)=>{if(!busy){epoch.current++;session.cancel();onSelect(state.items,index);}};
  const shuffle=async()=>{const owner=epoch.current,items=state.items;setBusy(true);setActionError('');try{await services.preferences.update({repeat:'off',shuffle:true});if(epoch.current===owner)onSelect(items,0);}catch{if(epoch.current===owner)setActionError('随机模式未能保存，请重试。');}finally{if(epoch.current===owner)setBusy(false);}};
  useEffect(()=>{epoch.current++;setMenu(null);setQuery('');setBusy(false);setActionError('');void session.load(track);return()=>{epoch.current++;session.cancel();};},[session,key]);
  const warnBg=s.dark?'rgba(255,107,129,0.13)':'rgba(217,67,85,0.09)';

  const pill=(id:string,label:string,icon:React.ComponentProps<typeof Ionicons>['name'],run:()=>void,opts?:{disabled?:boolean;primary?:boolean})=>(
    <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} disabled={opts?.disabled||busy} onPress={run} style={{minHeight:40,paddingHorizontal:14,borderRadius:20,backgroundColor:opts?.primary?s.control:s.chip,borderWidth:opts?.primary?0:1,borderColor:s.chipBorder,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,opacity:opts?.disabled||busy?0.42:1}}>
      <Ionicons name={icon} size={15} color={opts?.primary?'#FFFFFF':s.accent}/>
      <Text style={{fontSize:13,fontWeight:'600',color:opts?.primary?'#FFFFFF':s.ink}}>{label}</Text>
    </Pressable>
  );

  return <View style={{flex:1}}>
    <LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFill}/>
    <FlatList ref={list} testID="similar-songs-list" data={visible} onScrollToIndexFailed={info=>list.current?.scrollToOffset({offset:Math.max(0,info.averageItemLength*info.index),animated:false})} keyExtractor={song=>trackKey(song.origin)} contentContainerStyle={{paddingHorizontal:18,paddingTop:10,paddingBottom:36,gap:10}}
      ListHeaderComponent={<View style={{gap:14,paddingBottom:6}}>
        <View style={{alignSelf:'center',width:38,height:4.5,borderRadius:2.25,backgroundColor:s.dark?'rgba(255,255,255,0.28)':'rgba(60,48,50,0.26)'}}/>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}}>
          <Pressable testID="similar-back" accessibilityRole="button" accessibilityLabel={backLabel} disabled={busy} onPress={()=>{epoch.current++;session.cancel();onBack();}} style={{flexDirection:'row',alignItems:'center',gap:5,minHeight:38,paddingHorizontal:13,borderRadius:19,backgroundColor:s.chip,borderWidth:1,borderColor:s.cardBorder,opacity:busy?0.5:1}}>
            <Ionicons name="chevron-back" size={16} color={s.ink}/>
            <Text style={{color:s.ink,fontSize:13.5,fontWeight:'600'}}>{backLabel}</Text>
          </Pressable>
          {state.status==='ready'&&<View style={{paddingHorizontal:10,paddingVertical:4,borderRadius:999,backgroundColor:s.accentSoft}}>
            <Text testID="similar-count" accessibilityLiveRegion="polite" style={{color:s.accent,fontSize:12,fontWeight:'700'}}>{state.items.length?`本次推荐 ${state.items.length} 首`:'暂无相似歌曲'}</Text>
          </View>}
        </View>

        <View style={{gap:4}}>
          <Text accessibilityRole="header" style={{fontSize:26,fontWeight:'700',letterSpacing:-0.3,color:s.ink}}>相似歌曲</Text>
          <Text style={{fontSize:12.5,lineHeight:18,color:s.muted}}>网易云公开推荐 · 选曲将用本次完整结果替换播放队列，播放仍由当前音源解析。</Text>
        </View>

        <View style={[{borderRadius:18,padding:12,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,flexDirection:'row',alignItems:'center',gap:12},s.cardShadow]}>
          <Cover services={services} track={track} size={46} radius={11}/>
          <View style={{flex:1,minWidth:0,gap:2}}>
            <Text style={{fontSize:11.5,fontWeight:'600',color:s.accent}}>基于当前歌曲</Text>
            <Text numberOfLines={1} style={{fontSize:15,fontWeight:'700',color:s.ink}}>{track.title} · {track.artist}</Text>
          </View>
        </View>

        <View style={{flexDirection:'row',alignItems:'center',gap:8,minHeight:44,paddingHorizontal:14,borderRadius:16,backgroundColor:s.inputBg,borderWidth:1,borderColor:s.cardBorder}}>
          <Ionicons name="search-outline" size={17} color={s.subtle}/>
          <TextInput testID="similar-query" accessibilityLabel="在本次推荐中搜索" placeholder="在本次推荐中搜索歌曲或歌手" placeholderTextColor={s.subtle} value={query} onChangeText={setQuery} onSubmitEditing={()=>Keyboard.dismiss()} returnKeyType="search" style={{flex:1,color:s.ink,fontSize:14.5,paddingVertical:10}}/>
          {!!query&&<Pressable testID="similar-clear" accessibilityRole="button" accessibilityLabel="清除推荐内搜索" onPress={()=>setQuery('')} style={{width:28,height:28,borderRadius:14,backgroundColor:s.chip,alignItems:'center',justifyContent:'center'}}><Ionicons name="close" size={15} color={s.muted}/></Pressable>}
        </View>

        <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
          {pill('similar-play-all','播放全部推荐','play',()=>select(0),{disabled:!state.items.length,primary:true})}
          {pill('similar-shuffle','随机播放推荐','shuffle',()=>{void shuffle();},{disabled:!state.items.length})}
          {pill('similar-locate','定位当前播放','locate',()=>list.current?.scrollToIndex({index:currentIndex,animated:true,viewPosition:0.4}),{disabled:currentIndex<0})}
          {pill('similar-refresh','刷新相似歌曲','refresh',()=>{void session.load(track,true);},{disabled:state.status==='loading'})}
        </View>

        {!!actionError&&<View style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:13,paddingVertical:10,borderRadius:14,backgroundColor:warnBg}}>
          <Ionicons name="alert-circle-outline" size={17} color={s.accent}/>
          <Text accessibilityRole="alert" style={{flex:1,fontSize:13,color:s.accent}}>{actionError}</Text>
        </View>}
        {state.status==='loading'&&<View accessibilityLiveRegion="polite" style={{flexDirection:'row',alignItems:'center',gap:10,padding:14,borderRadius:16,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder}}>
          <ActivityIndicator color={s.accent}/><Text style={{color:s.muted,fontSize:13.5}}>正在读取相似歌曲…</Text>
        </View>}
        {state.status==='error'&&<View style={{gap:10,padding:14,borderRadius:18,backgroundColor:warnBg,borderWidth:1,borderColor:s.accent+'33'}}>
          <Text testID="similar-error" accessibilityRole="alert" style={{color:s.accent,fontSize:13.5,lineHeight:19}}>{state.error}</Text>
          <View style={{alignSelf:'flex-start'}}>{pill('similar-retry','重试相似歌曲','refresh',()=>{void session.load(track,true);})}</View>
        </View>}
      </View>}
      ListEmptyComponent={state.status==='ready'&&state.items.length?<View style={{padding:22,borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,alignItems:'center'}}><Text style={{color:s.muted,fontSize:14}}>本次推荐中没有匹配歌曲</Text></View>:null}
      renderItem={({item})=>{
        const idx=state.items.indexOf(item);
        const isCurrent=!!current&&trackKey(item.origin)===trackKey(current.origin);
        return <View style={[{flexDirection:'row',alignItems:'center',gap:10,paddingLeft:12,paddingRight:6,paddingVertical:10,borderRadius:18,backgroundColor:isCurrent?s.accentSoft:s.card,borderWidth:1,borderColor:isCurrent?s.accent+'44':s.cardBorder},s.cardShadow]}>
          <Pressable testID={`similar-play-${idx}`} accessibilityRole="button" accessibilityLabel={`播放相似歌曲：${item.title}`} disabled={busy} onPress={()=>select(idx)} style={{flex:1,minHeight:controls.hit,flexDirection:'row',alignItems:'center',gap:12}}>
            <Cover services={services} track={item} size={46} radius={12}/>
            <View style={{flex:1,minWidth:0,gap:3}}>
              <Text numberOfLines={1} style={{fontSize:15,fontWeight:isCurrent?'700':'600',color:isCurrent?s.accent:s.ink}}>{item.title}</Text>
              <Text numberOfLines={1} style={{fontSize:12.5,color:s.muted}}>{item.artist}{item.album?` · ${item.album}`:''}</Text>
            </View>
          </Pressable>
          <Pressable testID={`similar-more-${idx}`} accessibilityRole="button" accessibilityLabel={`更多操作：${item.title}`} disabled={busy} onPress={()=>setMenu(item)} style={{width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center'}}>
            <Ionicons name="ellipsis-horizontal" size={19} color={s.muted}/>
          </Pressable>
        </View>;
      }}/>
    {renderSongActions(menu,()=>setMenu(null))}
  </View>;
}
