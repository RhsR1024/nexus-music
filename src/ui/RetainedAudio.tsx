import {useRef,useState,useSyncExternalStore} from 'react';
import {Alert,FlatList,Pressable,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Services} from '../app/services.ts';
import type {LocalAudioRecord} from '../storage/localAudio.ts';
import {Modal} from './AdaptiveModal.tsx';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,space,radius,typography} from './tokens.ts';

export function RetainedAudio({services,onClose}:{services:Services;onClose:()=>void}){
  const {palette:p}=useTheme(),insets=useSafeAreaInsets(),files=useSyncExternalStore(services.localAudio.subscribe,services.localAudio.getRetainedSnapshot),locked=useRef(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const close=()=>{if(!locked.current)onClose();};
  const run=async(action:()=>Promise<string>)=>{if(locked.current)return;locked.current=true;setBusy(true);setMessage('');try{setMessage(await action());}catch{setMessage('操作未完成：音频可能正在使用或记录已变化，原数据保留，请重试。');}finally{locked.current=false;setBusy(false);}};
  const restore=(ids:readonly string[])=>{void run(async()=>{await services.localAudio.restoreRetained(ids);return `已恢复 ${ids.length} 首到列表`;});};
  const remove=(file:LocalAudioRecord)=>Alert.alert('删除此设备保留的音频？',`${file.track.title}\n将删除本设备音频、关联封面和该索引记录，不删除最初导入或扫描的原文件。歌单、历史和队列引用保留，需重新导入同一文件才能恢复播放。正在使用的音频不能删除。`,[{text:'保留',style:'cancel'},{text:'删除副本',style:'destructive',onPress:()=>{void run(async()=>{const result=await services.localAudio.removeRetained(file.id);return result.pendingCleanup?'记录已移除，暂存文件将在下次启动清理':'本设备保留副本已删除';});}}]);
  const button=(label:string,action:()=>void,id?:string)=><Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:busy}} disabled={busy} onPress={action} style={{minHeight:controls.hit,maxWidth:'100%',padding:space.md,borderRadius:radius.md,backgroundColor:p.surface,justifyContent:'center',opacity:busy?.5:1}}><Text style={{...typography.body,color:p.accent}}>{label}</Text></Pressable>;
  return <Modal visible animationType="slide" onRequestClose={close}><View accessibilityViewIsModal style={{flex:1,paddingHorizontal:space.lg,paddingTop:insets.top+space.md,paddingBottom:insets.bottom+space.md,gap:space.md,backgroundColor:p.background[0]}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:space.md}}><Text accessibilityRole="header" style={{flex:1,...typography.title,color:p.text}}>保留音频副本</Text>{button('收起保留副本',close,'retained-close')}</View>
    <Text testID="retained-summary" style={{color:p.secondary}}>共 {files.length} 首 · 记录容量 {(files.reduce((sum,file)=>sum+file.bytes,0)/1048576).toFixed(2)} MiB</Text>
    <Text style={{...typography.body,color:p.secondary}}>这些音频已从列表移除或移出扫描范围，仍保存在此设备。恢复不触发播放；扫描范围外的副本将作为独立导入项恢复，不扩大目录授权。</Text>
    {files.length>0&&button('全部恢复到列表',()=>restore(files.map(file=>file.id)),'retained-restore-all')}
    {!!message&&<Text testID="retained-message" accessibilityLiveRegion="polite" style={{color:p.accent}}>{message}</Text>}
    <FlatList data={files} keyExtractor={file=>file.id} initialNumToRender={10} windowSize={5} ListEmptyComponent={<Text style={{color:p.secondary}}>没有保留副本</Text>} renderItem={({item})=><View testID={`retained-row-${item.id}`} style={{gap:space.sm,paddingVertical:space.md,borderBottomWidth:1,borderBottomColor:p.border}}>
      <Text style={{...typography.heading,color:p.text}}>{item.track.title}</Text><Text style={{color:p.secondary}}>{item.track.artist} · {(item.bytes/1048576).toFixed(2)} MiB · {item.scanExcluded?'已移出扫描范围':'已从列表移除'}</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:space.sm}}>{button(`恢复到列表：${item.track.title}`,()=>restore([item.id]),`retained-restore-${item.id}`)}{button(`删除副本：${item.track.title}`,()=>remove(item),`retained-delete-${item.id}`)}</View>
    </View>}/>
  </View></Modal>;
}
