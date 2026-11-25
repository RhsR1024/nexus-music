import {useState,useSyncExternalStore} from 'react';
import {Pressable,StyleSheet,Switch,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {miniActionLabels,miniPlayerDefaults,type MiniAction} from '../domain/miniPlayer.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
const actionIcons:Record<MiniAction,React.ComponentProps<typeof Ionicons>['name']>={
  previous:'play-back',toggle:'play',next:'play-forward',favorite:'heart',queue:'list',
};
export function MiniPlayerSettings({services}:{services:Services}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const value=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),[error,setError]=useState('');
  const save=(action:()=>Promise<void>)=>{setError('');void action().catch(()=>setError('设置未保存：需保留播放暂停，最多四个按钮；请检查后重试。'));};
  return <View style={{gap:14,paddingVertical:12}}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
      <Text style={{color:s.muted,fontSize:13,lineHeight:19,flex:1}}>底栏样式共用以下顺序，播放暂停始终保留，最多选择 4 个按钮。</Text>
      <Text testID="mini-actions-count" style={{color:s.control,fontSize:13,fontWeight:'600'}}>已选 {value.miniActions.length}/4</Text>
    </View>
    <View style={{borderRadius:18,overflow:'hidden',backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder}}>
      {value.miniActions.map((action,index)=><View key={action} style={{paddingHorizontal:14,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:index===value.miniActions.length-1?0:StyleSheet.hairlineWidth,borderBottomColor:s.hairline}}>
        <View style={{width:38,height:38,borderRadius:19,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center'}}><Ionicons name={actionIcons[action]} size={18} color={s.control}/></View>
        <View style={{flex:1,gap:2}}><Text style={{color:s.ink,fontSize:15,fontWeight:'600'}}>{miniActionLabels[action]}</Text><Text style={{color:s.muted,fontSize:12}}>位置 {index+1}</Text></View>
        {([-1,1] as const).map(delta=>{const disabled=index+delta<0||index+delta>=value.miniActions.length;return <Pressable key={delta} testID={`mini-order-${action}-${delta}`} accessibilityRole="button" accessibilityLabel={`${delta<0?'上移':'下移'}迷你按钮：${miniActionLabels[action]}`} disabled={disabled} onPress={()=>save(()=>services.preferences.moveMiniAction(action,delta))} style={{width:38,height:38,alignItems:'center',justifyContent:'center',opacity:disabled?.3:1}}><Ionicons name={delta<0?'chevron-up':'chevron-down'} size={20} color={s.ink}/></Pressable>;})}
      </View>)}
    </View>
    <View style={{gap:8}}>
      <Text style={{color:s.muted,fontSize:13,marginLeft:4}}>选择显示按钮</Text>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{(Object.keys(miniActionLabels) as MiniAction[]).map(action=>{
        const checked=value.miniActions.includes(action);
        return <Pressable key={action} testID={`mini-choice-${action}`} accessibilityRole="checkbox" accessibilityLabel={`迷你按钮：${miniActionLabels[action]}`} accessibilityState={{checked,disabled:action==='toggle'}} disabled={action==='toggle'} onPress={()=>save(()=>services.preferences.toggleMiniAction(action))} style={{paddingHorizontal:14,paddingVertical:10,minHeight:42,borderRadius:21,borderWidth:1,borderColor:checked?s.control:s.chipBorder,backgroundColor:checked?s.accentSoft:s.chip,flexDirection:'row',alignItems:'center',gap:6}}>
          <Ionicons name={actionIcons[action]} size={15} color={checked?s.control:s.muted}/>
          <Text style={{color:checked?s.control:s.ink,fontSize:13,fontWeight:checked?'600':'500'}}>{miniActionLabels[action]}{checked?' ✓':''}</Text>
        </Pressable>;
      })}</View>
    </View>
    <View style={{borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,paddingHorizontal:16,paddingVertical:14,flexDirection:'row',alignItems:'center',gap:12}}>
      <View style={{flex:1,gap:3}}><Text style={{color:s.ink,fontSize:15,fontWeight:'600'}}>迷你歌词预览</Text><Text style={{color:s.muted,fontSize:12,lineHeight:18}}>显示当前录音的一行歌词，打开完整播放页时停止此预览请求。</Text></View>
      <Switch testID="mini-lyrics-enabled" accessibilityLabel="迷你歌词预览" value={value.miniLyrics} onValueChange={miniLyrics=>save(()=>services.preferences.update({miniLyrics}))} trackColor={s.switchTrack} thumbColor={s.switchThumb(value.miniLyrics)}/>
    </View>
    <Pressable testID="mini-reset" accessibilityRole="button" accessibilityLabel="恢复迷你播放器默认设置" onPress={()=>save(()=>services.preferences.update({...miniPlayerDefaults}))} style={{minHeight:46,paddingHorizontal:16,borderRadius:23,borderWidth:1,borderColor:s.control,alignItems:'center',justifyContent:'center'}}><Text style={{color:s.control,fontSize:14,fontWeight:'600'}}>恢复迷你播放器默认设置</Text></Pressable>
    {!!error&&<Text testID="mini-settings-error" accessibilityRole="alert" style={{color:s.accent}}>{error}</Text>}
  </View>;
}
