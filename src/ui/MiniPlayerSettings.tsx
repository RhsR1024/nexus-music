import {useState,useSyncExternalStore} from 'react';
import {Pressable,StyleSheet,Switch,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {miniActionLabels,miniPlayerDefaults,type MiniAction} from '../domain/miniPlayer.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
const actionIcons:Record<MiniAction,React.ComponentProps<typeof Ionicons>['name']>={
  previous:'play-back',toggle:'pause',next:'play-forward',favorite:'heart',queue:'list',
};
export function MiniPlayerSettings({services}:{services:Services}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const value=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot),[error,setError]=useState('');
  const save=(action:()=>Promise<void>)=>{setError('');void action().catch(()=>setError('设置未保存：需保留播放暂停，最多四个按钮；请检查后重试。'));};
  return <View style={{gap:14,paddingVertical:10}}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
      <Text style={{color:s.muted,fontSize:13,lineHeight:19,flex:1}}>两种底栏样式共用以下顺序，播放/暂停始终保留，最多选择 4 个按钮。</Text>
      <Text testID="mini-actions-count" style={{color:s.control,fontSize:13,fontWeight:'700'}}>已选 {value.miniActions.length}/4</Text>
    </View>
    <View testID="mini-preview-card" accessible accessibilityLabel="迷你播放器实时预览" style={[{paddingHorizontal:12,paddingVertical:10,borderRadius:28,backgroundColor:s.cardElevated,borderWidth:1,borderColor:s.cardBorder,flexDirection:'row',alignItems:'center',gap:10},s.dockShadow]}>
      <View style={{width:38,height:38,borderRadius:10,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center'}}><Ionicons name="musical-notes" size={18} color={s.control}/></View>
      <View style={{flex:1,minWidth:0,gap:1}}>
        <Text numberOfLines={1} style={{color:s.ink,fontSize:13.5,fontWeight:'700'}}>音乐让此刻更动听</Text>
        <Text numberOfLines={1} style={{color:s.muted,fontSize:11.5}}>{value.miniLyrics?'♪ 此刻微风刚好吹过耳畔':'音枢实时预览'}</Text>
      </View>
      <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
        {value.miniActions.map(action=><View key={action} style={{width:30,height:30,borderRadius:15,backgroundColor:action==='toggle'?s.ink:'transparent',alignItems:'center',justifyContent:'center'}}>
          <Ionicons name={actionIcons[action]} size={action==='toggle'?15:17} color={action==='toggle'?(s.dark?'#171717':'#FFFFFF'):action==='favorite'?s.accent:s.ink}/>
        </View>)}
      </View>
    </View>
    <View style={[{borderRadius:20,overflow:'hidden',backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder},s.cardShadow]}>
      {value.miniActions.map((action,index)=><View key={action}>
        {index>0&&<View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:66,backgroundColor:s.hairline}}/>}
        <View style={{paddingHorizontal:14,paddingVertical:11,flexDirection:'row',alignItems:'center',gap:12}}>
          <View style={{width:38,height:38,borderRadius:19,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center'}}><Ionicons name={actionIcons[action]} size={18} color={s.control}/></View>
          <View style={{flex:1,gap:2}}><Text style={{color:s.ink,fontSize:15,fontWeight:'700'}}>{miniActionLabels[action]}</Text><Text style={{color:s.muted,fontSize:12}}>位置 {index+1}</Text></View>
          {([-1,1] as const).map(delta=>{const disabled=index+delta<0||index+delta>=value.miniActions.length;return <Pressable key={delta} testID={`mini-order-${action}-${delta}`} accessibilityRole="button" accessibilityLabel={`${delta<0?'上移':'下移'}迷你按钮：${miniActionLabels[action]}`} disabled={disabled} onPress={()=>save(()=>services.preferences.moveMiniAction(action,delta))} style={{width:38,height:38,borderRadius:19,alignItems:'center',justifyContent:'center',opacity:disabled?.25:1}}><Ionicons name={delta<0?'chevron-up':'chevron-down'} size={19} color={s.ink}/></Pressable>;})}
        </View>
      </View>)}
    </View>
    <View style={{gap:8}}>
      <Text style={{color:s.muted,fontSize:13,fontWeight:'500',marginLeft:6}}>选择显示按钮</Text>
      <View style={[{padding:14,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,flexDirection:'row',flexWrap:'wrap',gap:8},s.cardShadow]}>{(Object.keys(miniActionLabels) as MiniAction[]).map(action=>{
        const checked=value.miniActions.includes(action);
        return <Pressable key={action} testID={`mini-choice-${action}`} accessibilityRole="checkbox" accessibilityLabel={`迷你按钮：${miniActionLabels[action]}`} accessibilityState={{checked,disabled:action==='toggle'}} disabled={action==='toggle'} onPress={()=>save(()=>services.preferences.toggleMiniAction(action))} style={{paddingHorizontal:13,paddingVertical:9,minHeight:40,borderRadius:20,borderWidth:1,borderColor:checked?`${s.control}88`:s.chipBorder,backgroundColor:checked?s.accentSoft:s.chip,flexDirection:'row',alignItems:'center',gap:6}}>
          <Ionicons name={actionIcons[action]} size={15} color={checked?s.control:s.muted}/>
          <Text style={{color:checked?s.control:s.ink,fontSize:13,fontWeight:checked?'700':'500'}}>{miniActionLabels[action]}{checked?' ✓':''}</Text>
        </Pressable>;
      })}</View>
    </View>
    <View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,paddingHorizontal:16,paddingVertical:14,flexDirection:'row',alignItems:'center',gap:12},s.cardShadow]}>
      <View style={{flex:1,gap:2}}><Text style={{color:s.ink,fontSize:15.5,fontWeight:'700'}}>迷你歌词预览</Text><Text style={{color:s.muted,fontSize:12,lineHeight:17}}>在迷你条副标题实时显示当前一行歌词，打开完整播放页时暂停预览。</Text></View>
      <Switch testID="mini-lyrics-enabled" accessibilityLabel="迷你歌词预览" value={value.miniLyrics} onValueChange={miniLyrics=>save(()=>services.preferences.update({miniLyrics}))} trackColor={s.switchTrack} thumbColor={s.switchThumb(value.miniLyrics)}/>
    </View>
    <Pressable testID="mini-reset" accessibilityRole="button" accessibilityLabel="恢复迷你播放器默认设置" onPress={()=>save(()=>services.preferences.update({...miniPlayerDefaults}))} style={{minHeight:46,paddingHorizontal:16,borderRadius:23,borderWidth:1,borderColor:s.control,backgroundColor:s.card,alignItems:'center',justifyContent:'center'}}><Text style={{color:s.control,fontSize:14,fontWeight:'600'}}>恢复迷你播放器默认设置</Text></Pressable>
    {!!error&&<Text testID="mini-settings-error" accessibilityRole="alert" style={{color:s.accent,marginLeft:4}}>{error}</Text>}
  </View>;
}
