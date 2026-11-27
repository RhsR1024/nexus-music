import {Ionicons,MaterialCommunityIcons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import {Cover} from './Cover.tsx';
import {Text} from './Typography.tsx';
import {useRef,useState,useSyncExternalStore} from 'react';
import {Alert, Animated, FlatList, PanResponder, Pressable, Share, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Modal} from './AdaptiveModal.tsx';
import type {Services} from '../app/services.ts';
import {emptyQueue,move,remove,removeAfter,type QueueEntry} from '../domain/queue.ts';
import {useTheme,type Theme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
// Embedded AM panels keep their dark material; standalone/sheet panels use the
// unified sollinTokens design system for frosted card hierarchy.
function queueColors(theme:Theme,tone:'auto'|'dark'){
  const s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  return tone==='dark'?{
    background:'transparent',surface:'rgba(255,255,255,0.09)',selected:'rgba(255,255,255,0.18)',dragging:'rgba(255,255,255,0.26)',
    text:'#F2EEF5',heading:'#FFFFFF',secondary:'rgba(255,255,255,0.72)',artist:'rgba(255,255,255,0.62)',accent:'#FFFFFF',border:'rgba(255,255,255,0.16)',
    chip:'rgba(255,255,255,0.12)',gradient:null as readonly [string,string,string]|null,
  }:{
    background:'transparent',surface:s.card,selected:s.accentSoft,dragging:s.accentSoft,
    text:s.ink,heading:s.ink,secondary:s.muted,artist:s.muted,accent:s.accent,border:s.cardBorder,
    chip:s.chip,gradient:s.sheetGradient,
  };
}
const rowHeight=70;
const platformName:Record<string,string>={wy:'网易云',tx:'QQ音乐',kw:'酷我',kg:'酷狗',mg:'咪咕',qishui:'汽水'};
function QueueRow({entry,index,services,tone='auto',locked=false}:{entry:QueueEntry;index:number;services:Services;tone?:'auto'|'dark';locked?:boolean}){
  const theme=useTheme(),translation=useRef(new Animated.Value(0)).current,[dragging,setDragging]=useState(false);
  const colors=queueColors(theme,tone);
  const latest=useRef({index,entry,services});latest.current={index,entry,services};
  const responder=useRef(PanResponder.create({onStartShouldSetPanResponder:()=>true,onMoveShouldSetPanResponder:(_,gesture)=>Math.abs(gesture.dy)>5,
    onPanResponderGrant:()=>{setDragging(true);translation.setValue(0);},onPanResponderMove:(_,gesture)=>translation.setValue(gesture.dy),
    onPanResponderRelease:(_,gesture)=>{const {entry,services}=latest.current,queue=services.playback.controller.getSnapshot().queue,from=queue.entries.findIndex(item=>item.id===entry.id);translation.setValue(0);setDragging(false);if(from>=0){const to=Math.min(queue.entries.length-1,Math.max(0,from+Math.round(gesture.dy/rowHeight)));if(to!==from)services.playback.controller.setQueue(move(queue,entry.id,to));}},
    onPanResponderTerminate:()=>{translation.setValue(0);setDragging(false);}})).current;
  const state=services.playback.controller.getSnapshot(),current=entry.id===state.queue.currentId;
  const action=(label:string,icon:React.ComponentProps<typeof Ionicons>['name'],run:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={`${label}：${entry.track.title}`} onPress={run} style={{width:34,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={18} color={colors.secondary}/></Pressable>;
  const step=(label:string,direction:-1|1,icon:React.ComponentProps<typeof Ionicons>['name'])=><Pressable accessibilityRole="button" accessibilityLabel={`${label}：${entry.track.title}`} disabled={direction===-1?index===0:index===state.queue.entries.length-1} onPress={()=>{const queue=services.playback.controller.getSnapshot().queue;services.playback.controller.setQueue(move(queue,entry.id,index+direction));}} style={{width:24,height:44,alignItems:'center',justifyContent:'center',opacity:(direction===-1?index===0:index===state.queue.entries.length-1)?.3:1}}><Ionicons name={icon} size={15} color={colors.secondary}/></Pressable>;
  const background=dragging?colors.dragging:current?colors.selected:colors.surface;
  const source=entry.track.origin.kind==='online'||entry.track.origin.kind==='imported'?platformName[entry.track.origin.platform]:undefined;
  return <Animated.View style={{minHeight:62,marginBottom:8,transform:[{translateY:translation}],zIndex:dragging?5:0,backgroundColor:background,borderWidth:1,borderColor:current?colors.accent+'44':colors.border,borderRadius:tone==='dark'?12:16,paddingLeft:10,paddingRight:4,flexDirection:'row',alignItems:'center',gap:10}}>
    <Cover services={services} track={entry.track} size={44} radius={10}/>
    <Pressable accessibilityRole="button" accessibilityLabel={`${index+1}. ${entry.track.title}`} onPress={()=>{const queue=services.playback.controller.getSnapshot().queue;void services.playback.controller.play({...queue,currentId:entry.id,priorityIds:[]});}} style={{flex:1,minWidth:0,justifyContent:'center',gap:3}}>
      <Text numberOfLines={1} style={{fontSize:14.5,fontWeight:current?'700':'600',color:current?colors.accent:colors.text}}>{entry.track.title}</Text>
      <Text numberOfLines={1} style={{fontSize:12,color:colors.artist}}>{entry.track.artist}{source?` · ${source}`:''}</Text>
    </Pressable>
    {current&&<View accessible={false} style={{width:17,height:17,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:2}}>{[7,11,17,11,7].map((height,idx)=><View key={idx} style={{width:1.8,height,borderRadius:1,backgroundColor:colors.accent}}/>)}</View>}
    {!locked&&<>{tone!=='dark'&&<>{step('上移',-1,'chevron-up')}{step('下移',1,'chevron-down')}</>}
    {action('移除','trash-outline',()=>{const snapshot=services.playback.controller.getSnapshot(),queue=remove(snapshot.queue,entry.id);if(entry.id===snapshot.queue.currentId&&snapshot.intent==='playing')void services.playback.controller.play(queue);else services.playback.controller.setQueue(queue);})}
    <View {...responder.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={`拖动排序：${entry.track.title}`} accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={event=>{const queue=services.playback.controller.getSnapshot().queue,from=queue.entries.findIndex(item=>item.id===entry.id),to=from+(event.nativeEvent.actionName==='increment'?1:-1);if(to>=0&&to<queue.entries.length)services.playback.controller.setQueue(move(queue,entry.id,to));}} style={{width:32,height:44,justifyContent:'center',alignItems:'center'}}><Ionicons name="reorder-three-outline" size={21} color={colors.secondary}/></View></>}
  </Animated.View>;
}
export function QueueView({services,compact=false,onOpen}:{services:Services;compact?:boolean;onOpen?:()=>void}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot),[open,setOpen]=useState(false);
  return <><Pressable testID={compact?"mini-action-queue":undefined} accessibilityRole="button" accessibilityLabel={compact?"播放队列":`完整队列与拖动排序 · ${state.queue.entries.length} 首`} onPress={()=>onOpen?onOpen():setOpen(true)} style={compact?{minWidth:40,minHeight:44,alignItems:"center",justifyContent:"center"}:{minHeight:50,paddingHorizontal:16,paddingVertical:12,backgroundColor:s.accentSoft,borderWidth:1,borderColor:s.accent+'33',borderRadius:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}}>
    {compact?<MaterialCommunityIcons name="playlist-music" size={22} color={s.ink}/>:<>
      <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
        <Ionicons name="list-outline" size={19} color={s.accent}/>
        <Text style={{color:s.accent,fontSize:14.5,fontWeight:'700'}}>完整队列与拖动排序 · {state.queue.entries.length} 首</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={s.accent}/>
    </>}
  </Pressable>
    {!onOpen&&<Modal visible={open} onRequestClose={()=>setOpen(false)} animationType="slide"><QueuePanel services={services} onClose={()=>setOpen(false)}/></Modal>}
  </>;
}

export function QueuePanel({services,onClose,tone='auto',inSheet=false}:{services:Services;onClose?:()=>void;tone?:'auto'|'dark';inSheet?:boolean}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),insets=useSafeAreaInsets(),state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const list=useRef<FlatList<QueueEntry>>(null);
  const colors=queueColors(theme,tone);
  // IMG_4863 segmented control: 顺序 / 随机 / 单曲 over the real repeat+shuffle prefs.
  const mode=preferences.shuffle?'shuffle':preferences.repeat==='one'?'one':'off';
  const modes=([['off','顺序'],['shuffle','随机'],['one','单曲']] as const);
  const currentIndex=state.queue.entries.findIndex(entry=>entry.id===state.queue.currentId);
  const locate=()=>{if(currentIndex<0)return;list.current?.scrollToIndex({index:currentIndex,viewPosition:0.4,animated:true});};
  const share=()=>{const rows=state.queue.entries.slice(0,50).map((entry,index)=>`${index+1}. ${entry.track.title} · ${entry.track.artist}`).join('\n');void Share.share({message:`播放队列 · ${state.queue.entries.length}\n${rows}`}).catch(()=>{});};
  const afterCount=Math.max(0,state.queue.entries.length-currentIndex-1);
  const heading=<View style={{flexDirection:'row',alignItems:'baseline',gap:4}}><Text style={{color:colors.heading,fontSize:onClose?22:18,fontWeight:'700'}}>播放队列</Text><Text style={{color:colors.secondary,fontSize:onClose?15:16,fontWeight:'600',fontVariant:['tabular-nums']}}>{currentIndex>=0?`· ${currentIndex+1}/${state.queue.entries.length}`:`· ${state.queue.entries.length}`}</Text></View>;
  const header=<View style={{paddingTop:onClose?(inSheet?10:Math.max(insets.top+10,54)):0}}>
      {onClose&&inSheet&&<View style={{alignSelf:'center',width:38,height:4.5,borderRadius:2.25,backgroundColor:s.dark?'rgba(255,255,255,0.28)':'rgba(60,48,50,0.26)',marginBottom:12}}/>}
      {onClose&&<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12,gap:10}}>
        {heading}
        <Pressable accessibilityRole="button" accessibilityLabel="收起队列" onPress={onClose} style={{minHeight:36,paddingHorizontal:14,borderRadius:18,backgroundColor:colors.chip,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'}}><Text style={{color:colors.heading,fontSize:13.5,fontWeight:'600'}}>收起队列</Text></Pressable>
      </View>}
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingBottom:10}}>
        {onClose?<Pressable testID="queue-clear-after" accessibilityRole="button" disabled={currentIndex<0||currentIndex===state.queue.entries.length-1} onPress={()=>{const queue=removeAfter(state.queue,state.queue.currentId!);services.playback.controller.setQueue(queue);}} style={{paddingHorizontal:12,paddingVertical:6,borderRadius:999,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,opacity:currentIndex<0||currentIndex===state.queue.entries.length-1?.4:1}}>
          <Text style={{color:colors.secondary,fontSize:12,fontWeight:'500'}}>清除当前之后（{afterCount} 首）</Text>
        </Pressable>:heading}
        <View style={{flexDirection:'row',alignItems:'center',gap:2}}>
          <Pressable testID="queue-locate" accessibilityRole="button" accessibilityLabel="定位当前播放" onPress={locate} style={{width:38,height:38,borderRadius:19,backgroundColor:onClose?colors.surface:'transparent',alignItems:'center',justifyContent:'center'}}><Ionicons name="locate" size={19} color={colors.secondary}/></Pressable>
          <Pressable testID="queue-lock" accessibilityRole="switch" accessibilityLabel={state.queueLocked?'解锁队列':'锁定队列'} accessibilityState={{selected:state.queueLocked}} onPress={()=>services.playback.controller.setQueueLocked(!state.queueLocked)} style={{width:38,height:38,borderRadius:19,backgroundColor:state.queueLocked?colors.selected:(onClose?colors.surface:'transparent'),alignItems:'center',justifyContent:'center'}}><Ionicons name={state.queueLocked?'lock-closed':'lock-open-outline'} size={18} color={state.queueLocked?colors.accent:colors.secondary}/></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="分享播放队列" onPress={share} style={{width:38,height:38,borderRadius:19,backgroundColor:onClose?colors.surface:'transparent',alignItems:'center',justifyContent:'center'}}><Ionicons name="paper-plane-outline" size={18} color={colors.secondary}/></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="清空播放队列" onPress={()=>Alert.alert('清空播放队列？','当前播放会停止。',[{text:'取消',style:'cancel'},{text:'清空',style:'destructive',onPress:()=>services.playback.controller.setQueue(emptyQueue)}])} style={{width:38,height:38,borderRadius:19,backgroundColor:onClose?colors.surface:'transparent',alignItems:'center',justifyContent:'center'}}><Ionicons name="trash-outline" size={18} color={colors.secondary}/></Pressable>
        </View>
      </View>
      {state.queueLocked&&<View style={{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:8,borderRadius:12,backgroundColor:colors.selected,marginBottom:10}}>
        <Ionicons name="lock-closed" size={14} color={colors.accent}/>
        <Text style={{color:colors.secondary,fontSize:12,flex:1}}>队列已锁定，逐行编辑已隐藏；点按歌曲仍可切换播放。</Text>
      </View>}
    </View>;
  return <View style={{flex:1,backgroundColor:tone==='dark'?'transparent':theme.palette.background[0]}}>
      {colors.gradient&&!inSheet&&<LinearGradient pointerEvents="none" colors={[...colors.gradient]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFill}/>}
      <View style={{flex:1,paddingHorizontal:onClose?18:tone==='dark'?0:12,paddingTop:onClose?0:8}}>
      {header}
      <View testID="queue-mode" style={{flexDirection:'row',borderRadius:16,padding:3,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,marginBottom:10,gap:3}}>
        {modes.map(([id,label])=>{const selected=mode===id,iconColor=selected?colors.accent:colors.secondary;return <Pressable key={id} testID={`queue-mode-${id}`} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{selected}} onPress={()=>{void services.preferences.update(id==='off'?{repeat:'off',shuffle:false}:id==='shuffle'?{repeat:'off',shuffle:true}:{repeat:'one',shuffle:false}).catch(()=>Alert.alert('设置未保存','原播放模式保留，请重试。'));}} style={{flex:1,minHeight:36,borderRadius:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,backgroundColor:selected?colors.selected:'transparent'}}>{id==='one'?<MaterialCommunityIcons name="repeat-once" size={17} color={iconColor}/>:<Ionicons name={id==='shuffle'?'shuffle':'repeat'} size={16} color={iconColor}/>}<Text style={{color:iconColor,fontSize:14,fontWeight:selected?'700':'500'}}>{label}</Text></Pressable>;})}
      </View>
      {!onClose&&<View style={{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',marginBottom:10}}>
        <Pressable testID="queue-clear-after" accessibilityRole="button" disabled={currentIndex<0||currentIndex===state.queue.entries.length-1} onPress={()=>{const queue=removeAfter(state.queue,state.queue.currentId!);services.playback.controller.setQueue(queue);}} style={{paddingHorizontal:11,paddingVertical:5,borderRadius:999,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,opacity:currentIndex<0||currentIndex===state.queue.entries.length-1?.4:1}}>
          <Text style={{color:colors.secondary,fontSize:12}}>清除当前之后（{afterCount} 首）</Text>
        </Pressable>
      </View>}
      <FlatList ref={list} data={state.queue.entries} extraData={state.queue.currentId} keyExtractor={entry=>entry.id} initialNumToRender={10} windowSize={5} contentContainerStyle={{paddingBottom:onClose?Math.max(insets.bottom+18,28):16}} onScrollToIndexFailed={parameters=>list.current?.scrollToOffset({offset:Math.max(0,parameters.index*rowHeight-120),animated:false})} getItemLayout={onClose?(_,index)=>({length:rowHeight,offset:rowHeight*index,index}):undefined} renderItem={({item,index})=><QueueRow entry={item} index={index} services={services} tone={tone} locked={state.queueLocked}/>} showsVerticalScrollIndicator={false}/>
      </View>
    </View>;
}
