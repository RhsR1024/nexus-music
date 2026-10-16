import {useState,useSyncExternalStore} from 'react';
import {Pressable,Switch,View} from 'react-native';
import type {Services} from '../app/services.ts';
import {miniActionLabels,miniPlayerDefaults,type MiniAction} from '../domain/miniPlayer.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
export function MiniPlayerSettings({services}:{services:Services}){
  const {palette:p}=useTheme(),value=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),[error,setError]=useState('');
  const save=(action:()=>Promise<void>)=>{setError('');void action().catch(()=>setError('设置未保存：需保留播放暂停，最多四个按钮；请检查后重试。'));};
  return <View style={{gap:14,paddingVertical:20}}><Text accessibilityRole="header" style={{color:p.text,fontSize:20,fontWeight:'600'}}>迷你播放器</Text>
    <Text style={{color:p.secondary,lineHeight:20}}>选择最多四个按钮并调整顺序，播放暂停始终保留；小屏可将按钮换行。</Text>
    <Text testID="mini-actions-count" style={{color:p.accent}}>已选 {value.miniActions.length}/4</Text>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>{(Object.keys(miniActionLabels) as MiniAction[]).map(action=><Pressable key={action} testID={`mini-choice-${action}`} accessibilityRole="checkbox" accessibilityLabel={`迷你按钮：${miniActionLabels[action]}`} accessibilityState={{checked:value.miniActions.includes(action),disabled:action==='toggle'}} disabled={action==='toggle'} onPress={()=>save(()=>services.preferences.toggleMiniAction(action))} style={{padding:12,minHeight:44,borderRadius:14,borderWidth:1,borderColor:p.border,backgroundColor:value.miniActions.includes(action)?p.selected:p.surface}}><Text style={{color:p.accent}}>{miniActionLabels[action]}{value.miniActions.includes(action)?' ✓':''}</Text></Pressable>)}</View>
    {value.miniActions.map((action,index)=><View key={action} style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={{color:p.text,flex:1}}>{index+1}. {miniActionLabels[action]}</Text>{([-1,1] as const).map(delta=><Pressable key={delta} testID={`mini-order-${action}-${delta}`} accessibilityRole="button" accessibilityLabel={`${delta<0?'上移':'下移'}迷你按钮：${miniActionLabels[action]}`} disabled={index+delta<0||index+delta>=value.miniActions.length} onPress={()=>save(()=>services.preferences.moveMiniAction(action,delta))} style={{padding:12,minHeight:44,opacity:index+delta<0||index+delta>=value.miniActions.length?.35:1}}><Text style={{color:p.accent}}>{delta<0?'上移':'下移'}</Text></Pressable>)}</View>)}
    <View style={{flexDirection:'row',alignItems:'center',gap:12}}><View style={{flex:1}}><Text style={{color:p.text}}>迷你歌词预览</Text><Text style={{color:p.secondary,fontSize:12,lineHeight:20}}>显示当前录音的一行歌词，沿用已选来源与偏移；打开完整播放页时停止此预览请求。</Text></View><Switch testID="mini-lyrics-enabled" accessibilityLabel="迷你歌词预览" value={value.miniLyrics} onValueChange={miniLyrics=>save(()=>services.preferences.update({miniLyrics}))}/></View>
    <Pressable testID="mini-reset" accessibilityRole="button" accessibilityLabel="恢复迷你播放器默认设置" onPress={()=>save(()=>services.preferences.update({...miniPlayerDefaults}))} style={{minHeight:44,padding:12,borderRadius:14,backgroundColor:p.selected}}><Text style={{color:p.accent}}>恢复迷你播放器默认设置</Text></Pressable>
    {!!error&&<Text testID="mini-settings-error" accessibilityRole="alert" style={{color:p.accent}}>{error}</Text>}
  </View>;
}
