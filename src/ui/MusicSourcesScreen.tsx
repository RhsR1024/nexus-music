import {useState,useSyncExternalStore} from 'react';
import {Pressable,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {NavidromeSettings} from './NavidromeSettings.tsx';
import {SourceSettings} from './SourceSettings.tsx';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';

type SourceTab='lx'|'navidrome';

export function MusicSourcesScreen({services}:{services:Services}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance);
  const sources=useSyncExternalStore(services.catalog.subscribe,services.catalog.getSnapshot);
  const navidromeAccounts=useSyncExternalStore(services.accounts.subscribe,services.accounts.getSnapshot);
  const [tab,setTab]=useState<SourceTab>('lx');

  const readyLxCount=sources.filter(item=>item.enabled&&item.status==='ready').length;
  const updateCount=sources.filter(item=>item.hasUpdate&&item.allowUpdateAlert).length;
  const okColor=s.dark?'#5EE0A0':'#1D8A56';

  const tabs=[
    {id:'lx' as const,label:'LX 音源',icon:'radio-outline' as const,connected:readyLxCount>0,hasUpdate:updateCount>0},
    {id:'navidrome' as const,label:'Navidrome',icon:'server-outline' as const,connected:navidromeAccounts.length>0,hasUpdate:false},
  ];

  return <View style={{gap:14,paddingTop:4}}>
    <View testID="music-sources-tabs" style={[{flexDirection:'row',padding:4,borderRadius:18,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:4},s.cardShadow]}>
      {tabs.map(item=>{
        const selected=tab===item.id;
        return <Pressable key={item.id} testID={`sources-tab-${item.id}`} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{selected}} onPress={()=>setTab(item.id)} style={{flex:1,minHeight:40,borderRadius:14,backgroundColor:selected?s.accentSoft:'transparent',borderWidth:selected?1:0,borderColor:selected?s.accent+'44':'transparent',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:10}}>
          <Ionicons name={item.icon} size={15} color={selected?s.accent:s.muted}/>
          <Text numberOfLines={1} style={{fontSize:13.5,fontWeight:selected?'700':'500',color:selected?s.accent:s.ink}}>{item.label}</Text>
          {item.hasUpdate?<View testID={`sources-tab-update-dot-${item.id}`} style={{width:7,height:7,borderRadius:3.5,backgroundColor:'#E53935'}}/>
            :item.connected?<View style={{width:6,height:6,borderRadius:3,backgroundColor:okColor}}/>:null}
        </Pressable>;
      })}
    </View>

    {tab==='lx'
      ?<SourceSettings catalog={services.catalog} health={services.sourceHealth} preferences={services.preferences}/>
      :<NavidromeSettings services={services}/>}
  </View>;
}
