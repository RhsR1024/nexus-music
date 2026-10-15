import {useRef,useState,useSyncExternalStore} from 'react';
import {Alert,Animated,FlatList,Modal,PanResponder,Pressable,Text,View} from 'react-native';
import type {Services} from '../app/services.ts';
import {emptyQueue,move,remove,type QueueEntry} from '../domain/queue.ts';
import {useTheme} from './theme.tsx';
const rowHeight=120;
function QueueRow({entry,index,services}:{entry:QueueEntry;index:number;services:Services}){
  const theme=useTheme(),translation=useRef(new Animated.Value(0)).current,[dragging,setDragging]=useState(false);
  const latest=useRef({index,entry,services});latest.current={index,entry,services};
  const responder=useRef(PanResponder.create({onStartShouldSetPanResponder:()=>true,onMoveShouldSetPanResponder:(_,gesture)=>Math.abs(gesture.dy)>5,
    onPanResponderGrant:()=>{setDragging(true);translation.setValue(0);},onPanResponderMove:(_,gesture)=>translation.setValue(gesture.dy),
    onPanResponderRelease:(_,gesture)=>{const {entry,services}=latest.current,queue=services.playback.controller.getSnapshot().queue,from=queue.entries.findIndex(item=>item.id===entry.id);translation.setValue(0);setDragging(false);if(from>=0){const to=Math.min(queue.entries.length-1,Math.max(0,from+Math.round(gesture.dy/rowHeight)));if(to!==from)services.playback.controller.setQueue(move(queue,entry.id,to));}},
    onPanResponderTerminate:()=>{translation.setValue(0);setDragging(false);}})).current;
  const state=services.playback.controller.getSnapshot();
  const button=(label:string,action:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={`${label}：${entry.track.title}`} onPress={action} style={{padding:9}}><Text style={{color:theme.color('#D9F49B')}}>{label}</Text></Pressable>;
  return <Animated.View style={{height:rowHeight,transform:[{translateY:translation}],zIndex:dragging?5:0,backgroundColor:theme.color(dragging?'#263329':'#111318'),paddingVertical:10,borderBottomWidth:1,borderColor:theme.color('#303744'),flexDirection:'row',gap:8}}>
    <View style={{flex:1}}><Pressable accessibilityRole="button" onPress={()=>{const queue=services.playback.controller.getSnapshot().queue;void services.playback.controller.play({...queue,currentId:entry.id,priorityIds:[]});}}>
      <Text numberOfLines={1} style={{fontSize:16,color:theme.color(entry.id===state.queue.currentId?'#D9F49B':'#E1E6F0')}}>{index+1}. {entry.track.title}</Text><Text numberOfLines={1} style={{color:theme.color('#959EAC'),marginTop:7}}>{entry.track.artist}</Text>
    </Pressable><View style={{flexDirection:'row'}}>{index>0&&button('上移',()=>{const queue=services.playback.controller.getSnapshot().queue;services.playback.controller.setQueue(move(queue,entry.id,index-1));})}
      {button('移除',()=>{const state=services.playback.controller.getSnapshot(),queue=remove(state.queue,entry.id);if(entry.id===state.queue.currentId&&state.intent==='playing')void services.playback.controller.play(queue);else services.playback.controller.setQueue(queue);})}</View>
    </View>
    <View {...responder.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={`拖动排序：${entry.track.title}`} accessibilityActions={[{name:'increment'},{name:'decrement'}]} onAccessibilityAction={event=>{const queue=services.playback.controller.getSnapshot().queue,from=queue.entries.findIndex(item=>item.id===entry.id),to=from+(event.nativeEvent.actionName==='increment'?1:-1);if(to>=0&&to<queue.entries.length)services.playback.controller.setQueue(move(queue,entry.id,to));}} style={{width:50,justifyContent:'center',alignItems:'center'}}><Text style={{fontSize:28,color:theme.color('#959EAC')}}>☰</Text></View>
  </Animated.View>;
}
export function QueueView({services}:{services:Services}){
  const theme=useTheme(),state=useSyncExternalStore(services.playback.controller.subscribe,services.playback.controller.getSnapshot),[open,setOpen]=useState(false);
  return <><Pressable accessibilityRole="button" onPress={()=>setOpen(true)} style={{padding:14,backgroundColor:theme.color('#303A32'),borderRadius:12}}><Text style={{color:theme.color('#D9F49B')}}>完整队列与拖动排序 · {state.queue.entries.length} 首</Text></Pressable>
    <Modal visible={open} onRequestClose={()=>setOpen(false)} animationType="slide"><View style={{flex:1,backgroundColor:theme.color('#111318'),padding:24,paddingTop:65}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',paddingBottom:24}}><Pressable accessibilityRole="button" onPress={()=>setOpen(false)}><Text style={{color:theme.color('#D9F49B'),fontSize:18}}>收起队列</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>Alert.alert('清空播放队列？','当前播放会停止。',[{text:'取消',style:'cancel'},{text:'清空',style:'destructive',onPress:()=>services.playback.controller.setQueue(emptyQueue)}])}><Text style={{color:theme.color('#D6B69A')}}>清空队列</Text></Pressable></View>
      <Text style={{color:theme.color('#959EAC'),marginBottom:12}}>拖动右侧手柄调整顺序；下一首插入仍按先后次序。</Text>
      <FlatList data={state.queue.entries} extraData={state.queue.currentId} keyExtractor={entry=>entry.id} initialNumToRender={10} windowSize={5} getItemLayout={(_,index)=>({length:rowHeight,offset:rowHeight*index,index})} renderItem={({item,index})=><QueueRow entry={item} index={index} services={services}/>}/>
    </View></Modal>
  </>;
}
