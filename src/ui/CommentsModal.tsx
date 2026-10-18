import {Text} from './Typography.tsx';
import {useEffect,useMemo,useSyncExternalStore} from 'react';
import {Pressable,SectionList,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {SheetModal} from './AdaptiveModal.tsx';
import {CommentSession,type SongComment} from '../providers/comments.ts';
import type {Track} from '../domain/track.ts';
import type {Services} from '../app/services.ts';
import {useTheme} from './theme.tsx';

export function CommentsModal({services,track,onClose,embedded=false}:{services:Services;track:Track|null;onClose:()=>void;embedded?:boolean}){
 const {palette:p}=useTheme(),session=useMemo(()=>new CommentSession(services.comments),[services.comments]),state=useSyncExternalStore(session.subscribe,session.getSnapshot);
 useEffect(()=>{if(track)session.select(track);else session.close();return()=>session.close();},[track,session]);
 const sections=useMemo(()=>[{title:'热门评论',data:state.hot},{title:'最新评论',data:state.items}].filter(section=>section.data.length>0),[state.hot,state.items]);
 const button=(title:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={action} style={{padding:14,borderRadius:14,backgroundColor:p.selected,opacity:disabled?.5:1}}><Text style={{color:p.accent}}>{title}</Text></Pressable>;
 const comment=(item:SongComment)=><View style={{paddingVertical:16,gap:8,borderBottomWidth:1,borderColor:p.border}}><Text style={{color:p.text,fontWeight:'600'}}>{item.userName}</Text><Text selectable style={{color:p.text,lineHeight:24}}>{item.content}</Text>{item.reply&&<View style={{backgroundColor:p.selected,padding:10,borderRadius:8}}><Text style={{color:p.secondary,lineHeight:21}}>{item.reply.userName}：{item.reply.content}</Text></View>}<Text style={{color:p.secondary,fontSize:12}}>{item.time!==undefined?new Date(item.time).toLocaleDateString():''}{item.likes!==undefined?`　${item.likes} 赞`:''}</Text></View>;
 const close=()=>{session.close();onClose();};
 const content=<View testID="comments-content" style={{flex:1,paddingHorizontal:18,paddingTop:12,backgroundColor:p.background[0]}}>
  <View testID="comments-header" style={{flexDirection:'row',alignItems:'center',gap:8,paddingBottom:8}}>
   <Pressable accessibilityRole="button" accessibilityLabel="收起歌曲评论" onPress={close} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="chevron-down" size={24} color={p.text}/></Pressable>
   <Text testID="comments-title" accessibilityRole="header" numberOfLines={1} style={{flex:1,minWidth:0,fontSize:22,fontWeight:'700',color:p.text}}>{track?.title??'歌曲'} · 评论</Text>
   {state.supported&&<Pressable accessibilityRole="button" accessibilityLabel="刷新评论" accessibilityState={{disabled:state.loading}} disabled={state.loading} onPress={()=>{void session.load(true);}} style={{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',opacity:state.loading?.5:1}}><Ionicons name="refresh" size={23} color={p.accent}/></Pressable>}
  </View>
  <SectionList testID="comments-list" style={{flex:1}} sections={sections} keyExtractor={item=>item.id} initialNumToRender={12} windowSize={5} stickySectionHeadersEnabled={false} contentContainerStyle={{paddingBottom:18}} renderItem={({item})=>comment(item)} renderSectionHeader={({section})=><Text accessibilityRole="header" style={{fontSize:17,fontWeight:'700',color:p.text,paddingTop:18,paddingBottom:4}}>{section.title}</Text>}
   ListHeaderComponent={<View style={{gap:10}}><Text style={{color:p.secondary}}>{track?.artist}</Text><Text style={{color:p.secondary,lineHeight:21}}>评论归属原曲平台，播放换源不影响评论。</Text>{state.supported?state.total!==undefined&&<Text style={{color:p.secondary}}>共 {state.total} 条评论</Text>:<Text style={{color:p.secondary}}>此来源暂不支持公开评论；当前支持网易云在线歌曲。</Text>}</View>}
   ListEmptyComponent={state.supported&&!state.loading&&!state.error?<Text style={{color:p.secondary,paddingVertical:20}}>本次未取得可展示的评论。</Text>:null}
   ListFooterComponent={<View style={{gap:14,paddingTop:18}}>{state.loading&&<Text accessibilityLiveRegion="polite" style={{color:p.secondary}}>正在载入评论…</Text>}{state.error&&<><Text accessibilityRole="alert" style={{color:p.text}}>{state.error}</Text>{button('重试评论',()=>{void session.retry();})}</>}{state.hasMore&&!state.error&&button('加载更多评论',()=>{void session.load();},state.loading)}{state.limited&&<Text style={{color:p.secondary}}>已停止继续加载：达到显示上限或平台未提供新的评论。可刷新重新检查。</Text>}</View>}/>
 </View>;
 return embedded?content:<SheetModal allowSwipeDismissal visible={!!track} animationType="slide" onRequestClose={close}><SafeAreaProvider><SafeAreaView style={{flex:1,backgroundColor:p.background[0]}}>{content}</SafeAreaView></SafeAreaProvider></SheetModal>;
}
