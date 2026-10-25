import {Ionicons} from '@expo/vector-icons';
import {Cover} from './Cover.tsx';
import {Text} from './Typography.tsx';
import {useRef,useState,useSyncExternalStore} from 'react';
import {Alert, Animated, FlatList, PanResponder, Pressable, Share, View} from 'react-native';
import {Modal} from './AdaptiveModal.tsx';
import type {Services} from '../app/services.ts';
import {emptyQueue,move,remove,removeAfter,type QueueEntry} from '../domain/queue.ts';
import {useTheme,type Theme} from './theme.tsx';
// Embedded AM panels keep their dark material; standalone sheets use the
// active semantic palette instead of translating incomplete legacy hex inks.
function queueColors(p:Theme['palette'],tone:'auto'|'dark'){
  return tone==='dark'?{
    background:'transparent',surface:'rgba(255,255,255,0.10)',selected:'rgba(255,255,255,0.18)',dragging:'rgba(255,255,255,0.26)',
    text:'#F2EEF5',heading:'#FFFFFF',secondary:'#D5D5DA',artist:'#C9C1D4',accent:'#FFFFFF',border:'rgba(255,255,255,0.12)',
  }:{background:p.background[0],surface:p.surface,selected:p.selected,dragging:p.selected,text:p.text,heading:p.text,secondary:p.secondary,artist:p.secondary,accent:p.accent,border:p.border};
}
const rowHeight=70;
const platformName:Record<string,string>={wy:'网易云',tx:'QQ音乐',kw:'酷我',kg:'酷狗',mg:'咪咕',qishui:'汽水'};
function QueueRow({entry,index,services,tone='auto',locked=false}:{entry:QueueEntry;index:number;services:Services;tone?:'auto'|'dark';locked?:boolean}){
  const theme=useTheme(),translation=useRef(new Animated.Value(0)).current,[dragging,setDragging]=useState(false);
  const colors=queueColors(theme.palette,tone);
  const latest=useRef({index,entry,services});latest.current={index,entry,services};
  const responder=useRef(PanResponder.create({onStartShouldSetPanResponder:()=>true,onMoveShouldSetPanResponder:(_,gesture)=>Math.abs(gesture.dy)>5,
    onPanResponderGrant:()=>{setDragging(true);translation.setValue(0);},onPanResponderMove:(_,gesture)=>translation.setValue(gesture.dy),
    onPanResponderRelease:(_,gesture)=>{const {entry,services}=latest.current,queue=services.playback.controller.getSnapshot().queue,from=queue.entries.findIndex(item=>item.id===entry.id);translation.setValue(0);setDragging(false);if(from>=0){const to=Math.min(queue.entries.length-1,Math.max(0,from+Math.round(gesture.dy/rowHeight)));if(to!==from)services.playback.controller.setQueue(move(queue,entry.id,to));}},
    onPanResponderTerminate:()=>{translation.setValue(0);setDragging(false);}})).current;
  const state=services.playback.controller.getSnapshot(),current=entry.id===state.queue.currentId;
  const action=(label:string,icon:React.ComponentProps<typeof Ionicons>['name'],run:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={`${label}：${entry.track.title}`} onPress={run} style={{width:34,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name={icon} size={19} color={colors.secondary}/></Pressable>;
  const step=(label:string,direction:-1|1,icon:React.ComponentProps<typeof Ionicons>['name'])=><Pressable accessibilityRole="button" accessibilityLabel={`${label}：${entry.track.title}`} disabled={direction===-1?index===0:index===state.queue.entries.length-1} onPress={()=>{const queue=services.playback.controller.getSnapshot().queue;services.playback.controller.setQueue(move(queue,entry.id,index+direction));}} style={{width:26,height:44,alignItems:'center',justifyContent:'center',opacity:(direction===-1?index===0:index===state.queue.entries.length-1)?.35:1}}><Ionicons name={icon} size={15} color={colors.secondary}/></Pressable>;
  const background=dragging?colors.dragging:current?colors.selected:colors.surface;
  const source=entry.track.origin.kind==='online'||entry.track.origin.kind==='imported'?platformName[entry.track.origin.platform]:undefined;
  return <Animated.View style={{minHeight:63,marginBottom:7,transform:[{translateY:translation}],zIndex:dragging?5:0,backgroundColor:background,borderRadius:tone==='dark'?10:14,paddingLeft:9,paddingRight:0,flexDirection:'row',alignItems:'center',gap:7}}>
    <Cover services={services} track={entry.track} size={45} radius={12}/>
    <Pressable accessibilityRole="button" accessibilityLabel={`${index+1}. ${entry.track.title}`} onPress={()=>{const queue=services.playback.controller.getSnapshot().queue;void services.playback.controller.play({...queue,currentId:entry.id,priorityIds:[]});}} style={{flex:1,minWidth:0,justifyContent:'center',gap:5}}>
      <Text numberOfLines={1} style={{fontSize:14,fontWeight:'600',color:current?colors.accent:colors.text}}>{entry.track.title}</Text>
      <Text numberOfLines={1} style={{fontSize:13,color:colors.artist}}>{entry.track.artist}{source?` · ${source}`:''}</Text>
    </Pressable>
    {current&&<View accessible={false} style={{width:17,height:17,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:2}}>{[7,11,17,11,7].map((height,index)=><View key={index} style={{width:1.5,height,borderRadius:1,backgroundColor:colors.heading}}/>)}</View>}
    {!locked&&<>{step('上移',-1,'chevron-up')}{step('下移',1,'chevron-down')}
    {action('移除','trash-outline',()=>{const snapshot=services.playback.controller.getSnapshot(),queue=remove(snapshot.queue,entry.id);if(entry.id===snapshot.queue.currentId&&snapshot.intent==='playing')void services.playback.controller.play(queue);else services.playback.controller.setQueue(queue);})}
    <View {...responder.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={`拖动排序：${entry.track.title}`} accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={event=>{const queue=services.playback.controller.getSnapshot().queue,from=queue.entries.findIndex(item=>item.id===entry.id),to=from+(event.nativeEvent.actionName==='increment'?1:-1);if(to>=0&&to<queue.entries.length)services.playback.controller.setQueue(move(queue,entry.id,to));}} style={{width:34,height:44,justifyContent:'center',alignItems:'center'}}><Ionicons name="reorder-three-outline" size={22} color={colors.secondary}/></View></>}
  </Animated.View>;
}
export function QueueView({services,compact=false}:{services:Services;compact?:boolean}){
  const theme=useTheme(),state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot),[open,setOpen]=useState(false);
  return <><Pressable testID={compact?"mini-action-queue":undefined} accessibilityRole="button" accessibilityLabel={compact?"播放队列":undefined} onPress={()=>setOpen(true)} style={compact?{minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center"}:{padding:14,backgroundColor:theme.palette.selected,borderRadius:12}}>{compact?<Ionicons name="list" size={24} color={theme.palette.text}/>:<Text style={{color:theme.palette.accent}}>完整队列与拖动排序 · {state.queue.entries.length} 首</Text>}</Pressable>
    <Modal visible={open} onRequestClose={()=>setOpen(false)} animationType="slide"><QueuePanel services={services} onClose={()=>setOpen(false)}/></Modal>
  </>;
}

export function QueuePanel({services,onClose,tone='auto'}:{services:Services;onClose?:()=>void;tone?:'auto'|'dark'}){
  const theme=useTheme(),state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot);
  const preferences=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  const list=useRef<FlatList<QueueEntry>>(null);
  const colors=queueColors(theme.palette,tone);
  // IMG_4863 segmented control: 顺序 / 随机 / 单曲 over the real repeat+shuffle prefs.
  const mode=preferences.shuffle?'shuffle':preferences.repeat==='one'?'one':'off';
  const modes=([['off','顺序','repeat'],['shuffle','随机','shuffle'],['one','单曲','repeat']] as const);
  const currentIndex=state.queue.entries.findIndex(entry=>entry.id===state.queue.currentId);
  const locate=()=>{if(currentIndex<0)return;list.current?.scrollToIndex({index:currentIndex,viewPosition:0.4,animated:true});};
  const share=()=>{const list=state.queue.entries.slice(0,50).map((entry,index)=>`${index+1}. ${entry.track.title} · ${entry.track.artist}`).join('\n');void Share.share({message:`播放队列 · ${state.queue.entries.length}\n${list}`}).catch(()=>{});};
  const heading=<View style={{flexDirection:'row',alignItems:'center',gap:4}}><Text style={{color:colors.heading,fontSize:18,fontWeight:'700'}}>播放队列</Text><Text style={{color:colors.heading,fontSize:18,fontWeight:'700'}}>{currentIndex>=0?`· ${currentIndex+1}/${state.queue.entries.length}`:`· ${state.queue.entries.length}`}</Text></View>;
  const header=<View style={{paddingTop:onClose?65:0}}>
      {onClose&&<Pressable accessibilityRole="button" onPress={onClose} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.secondary,fontSize:15}}>收起队列</Text></Pressable>}
      <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingBottom:14}}>
        {heading}
        <View style={{flexDirection:'row',alignItems:'center'}}>
          <Pressable testID="queue-locate" accessibilityRole="button" accessibilityLabel="定位当前播放" onPress={locate} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="locate" size={22} color={colors.secondary}/></Pressable>
          <Pressable testID="queue-lock" accessibilityRole="switch" accessibilityLabel={state.queueLocked?'解锁队列':'锁定队列'} accessibilityState={{selected:state.queueLocked}} onPress={()=>services.playback.controller.setQueueLocked(!state.queueLocked)} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name={state.queueLocked?'lock-closed':'lock-open-outline'} size={22} color={state.queueLocked?colors.accent:colors.secondary}/></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="分享播放队列" onPress={share} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="paper-plane-outline" size={22} color={colors.secondary}/></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="清空播放队列" onPress={()=>Alert.alert('清空播放队列？','当前播放会停止。',[{text:'取消',style:'cancel'},{text:'清空',style:'destructive',onPress:()=>services.playback.controller.setQueue(emptyQueue)}])} style={{width:44,height:44,alignItems:'center',justifyContent:'center'}}><Ionicons name="trash-outline" size={22} color={colors.secondary}/></Pressable>
        </View>
      </View>
      {state.queueLocked&&<Text style={{color:colors.secondary,fontSize:12,marginBottom:10}}>队列已锁定，逐行编辑已隐藏；点按歌曲仍可切换播放。</Text>}
    </View>;
  // IMG_4863 insets the whole queue panel 20pt from the screen edge (AMPlayer
  // widens am-body for it) while the AM header above keeps its 24pt inset.
  return <View style={{flex:1,backgroundColor:colors.background,padding:onClose?24:tone==='dark'?0:12,paddingTop:onClose?0:8}}>
      {header}
      <View testID="queue-mode" style={{flexDirection:'row',borderRadius:20,overflow:'hidden',backgroundColor:colors.surface,marginBottom:14}}>
        {modes.map(([id,label,icon],index)=>{const selected=mode===id;return <Pressable key={id} testID={`queue-mode-${id}`} accessibilityRole="radio" accessibilityState={{selected}} onPress={()=>{void services.preferences.update(id==='off'?{repeat:'off',shuffle:false}:id==='shuffle'?{repeat:'off',shuffle:true}:{repeat:'one',shuffle:false}).catch(()=>Alert.alert('设置未保存','原播放模式保留，请重试。'));}} style={{flex:1,minHeight:40,borderLeftWidth:index?1:0,borderLeftColor:colors.border,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,backgroundColor:selected?colors.selected:'transparent'}}><Ionicons name={icon} size={17} color={selected?colors.accent:colors.secondary}/><Text style={{color:selected?colors.accent:colors.secondary,fontSize:15}}>{label}</Text></Pressable>;})}
      </View>
      <Pressable testID="queue-clear-after" accessibilityRole="button" disabled={currentIndex<0||currentIndex===state.queue.entries.length-1} onPress={()=>{const queue=removeAfter(state.queue,state.queue.currentId!);services.playback.controller.setQueue(queue);}} style={{alignSelf:'flex-start',paddingHorizontal:13,paddingVertical:8,borderRadius:12,backgroundColor:colors.surface,marginBottom:12,opacity:currentIndex<0||currentIndex===state.queue.entries.length-1?.45:1}}>
        <Text style={{color:colors.secondary,fontSize:13}}>清除当前之后（{Math.max(0,state.queue.entries.length-currentIndex-1)} 首）</Text>
      </Pressable>
      <FlatList ref={list} data={state.queue.entries} extraData={state.queue.currentId} keyExtractor={entry=>entry.id} initialNumToRender={10} windowSize={5} onScrollToIndexFailed={parameters=>list.current?.scrollToOffset({offset:Math.max(0,parameters.index*rowHeight-120),animated:false})} getItemLayout={onClose?(_,index)=>({length:rowHeight,offset:rowHeight*index,index}):undefined} renderItem={({item,index})=><QueueRow entry={item} index={index} services={services} tone={tone} locked={state.queueLocked}/>}/>
    </View>;
}
