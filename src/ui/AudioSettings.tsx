import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {useState,useSyncExternalStore} from 'react';
import {Pressable, View} from 'react-native';
import type { Services } from '../app/services.ts';
import { qualityOrder } from '../domain/quality.ts';
export function AudioSettings({ services }: { services: Services }) {
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),[error,setError]=useState('');
  const value = useSyncExternalStore(services.preferences.subscribe, services.preferences.getSnapshot);
  const update=(quality:Parameters<typeof services.preferences.update>[0]['quality'])=>{setError('');void services.preferences.update({quality}).catch(()=>setError('音质设置未保存，请重试；之前的设置已保留。'));};
  return <View style={{padding:16,marginTop:14,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:12}}>
    <View style={{gap:2}}>
      <Text style={{color:s.ink,fontSize:16,fontWeight:'700'}}>在线播放音质</Text>
      <Text style={{color:s.muted,fontSize:12,lineHeight:18}}>首选音质 · 同档跨源后逐级降档</Text>
    </View>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{qualityOrder.map(quality => {
      const active=value.quality===quality;
      return <Pressable key={quality} accessibilityRole="radio" accessibilityState={{ selected: active }}
        onPress={() => update(quality)} style={{paddingHorizontal:14,paddingVertical:9,borderRadius:18,backgroundColor:active?s.control:s.chip,borderWidth:1,borderColor:active?s.control:s.chipBorder}}>
        <Text style={{color:active?'#FFFFFF':s.ink,fontSize:13,fontWeight:active?'700':'500'}}>{quality}</Text>
      </Pressable>;
    })}</View>
    {!!error&&<Text accessibilityRole="alert" style={{color:s.accent,fontSize:12,lineHeight:18}}>{error}</Text>}
  </View>;
}
