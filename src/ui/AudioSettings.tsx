import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {useState,useSyncExternalStore} from 'react';
import {Pressable,StyleSheet,Switch,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import type {SmartDegradeMode} from '../app/preferences.ts';
import {qualityOrder,type Quality} from '../domain/quality.ts';
import type {OnlinePlatform} from '../domain/track.ts';

const platformList:readonly {id:OnlinePlatform;label:string}[]=[
  {id:'wy',label:'网易云音乐'},
  {id:'tx',label:'QQ 音乐'},
  {id:'kw',label:'酷我音乐'},
  {id:'kg',label:'酷狗音乐'},
  {id:'mg',label:'咪咕音乐'},
];
const degradeModes:readonly [SmartDegradeMode,string,string][]=[
  ['progressive','逐级降级','从首选音质逐级尝试至 128k'],
  ['direct128k','直降 128k','降音质时直接尝试 128k 兜底'],
];

export function AudioSettings({ services }: { services: Services }) {
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),[error,setError]=useState('');
  const [expandedPlatform,setExpandedPlatform]=useState<OnlinePlatform|null>(null);
  const value = useSyncExternalStore(services.preferences.subscribe, services.preferences.getSnapshot);
  const update=(patch:Parameters<typeof services.preferences.update>[0],msg='音质设置未保存，请重试；之前的设置已保留。')=>{
    setError('');
    void services.preferences.update(patch).catch(()=>setError(msg));
  };
  const setPlatformQuality=(platform:OnlinePlatform,quality?:Quality)=>{
    const next={...value.playbackQualities};
    if(quality===undefined)delete next[platform];else next[platform]=quality;
    update({playbackQualities:next},'分平台播放音质未保存，请重试。');
  };
  const pill=(id:string,label:string,active:boolean,onPress:()=>void,accessibilityLabel=label)=><Pressable key={id} testID={id} accessibilityRole="radio" accessibilityLabel={accessibilityLabel} accessibilityState={{selected:active}} onPress={onPress} style={{paddingHorizontal:12,paddingVertical:7,minHeight:34,borderRadius:17,backgroundColor:active?s.control:s.chip,borderWidth:1,borderColor:active?s.control:s.chipBorder,justifyContent:'center'}}><Text style={{color:active?'#FFFFFF':s.ink,fontSize:12.5,fontWeight:active?'700':'500'}}>{label}</Text></Pressable>;
  return <View style={{gap:14,marginTop:14}}>
    <Text accessibilityRole="header" style={{color:s.muted,fontSize:13,fontWeight:'500',marginLeft:6,marginBottom:-6}}>在线播放与换源</Text>
    <View style={[{padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,gap:12},s.cardShadow]}>
      <View style={{gap:2}}>
        <Text style={{color:s.ink,fontSize:16,fontWeight:'700'}}>在线播放音质</Text>
        <Text style={{color:s.muted,fontSize:12,lineHeight:18}}>全局首选音质 · 播放时优先请求所选音质</Text>
      </View>
      <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{qualityOrder.map(quality => {
        const active=value.quality===quality;
        return <Pressable key={quality} accessibilityRole="radio" accessibilityState={{ selected: active }}
          onPress={() => update({quality})} style={{paddingHorizontal:14,paddingVertical:9,borderRadius:18,backgroundColor:active?s.control:s.chip,borderWidth:1,borderColor:active?s.control:s.chipBorder}}>
          <Text style={{color:active?'#FFFFFF':s.ink,fontSize:13,fontWeight:active?'700':'500'}}>{quality}</Text>
        </Pressable>;
      })}</View>
      <View style={{height:StyleSheet.hairlineWidth,backgroundColor:s.hairline,marginTop:2}}/>
      <View style={{gap:2}}>
        <Text style={{color:s.muted,fontSize:12.5,fontWeight:'600'}}>按平台设置默认音质</Text>
        <Text style={{color:s.subtle,fontSize:11.5,lineHeight:16}}>点击平台可单独指定档位，未设置时自动跟随全局。</Text>
      </View>
      <View style={{borderRadius:16,backgroundColor:s.dark?'rgba(255,255,255,0.04)':'rgba(255,255,255,0.38)',borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'}}>
        {platformList.map((item,index)=>{
          const custom=value.playbackQualities[item.id];
          const open=expandedPlatform===item.id;
          return <View key={item.id}>
            {index>0&&<View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:44,backgroundColor:s.hairline}}/>}
            <Pressable testID={`playback-platform-${item.id}`} accessibilityRole="button" accessibilityLabel={`${item.label}播放音质`} accessibilityState={{expanded:open}} onPress={()=>setExpandedPlatform(open?null:item.id)} style={{minHeight:48,paddingHorizontal:13,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:10}}>
              <Ionicons name="pulse-outline" size={18} color={custom?s.control:s.ink}/>
              <Text style={{flex:1,color:s.ink,fontSize:14.5,fontWeight:'700'}}>{item.label}</Text>
              <Text style={{color:custom?s.control:s.muted,fontSize:12.5,fontWeight:custom?'600':'400'}}>{custom?custom.toUpperCase():'跟随全局'}</Text>
              <Ionicons name={open?'chevron-up':'chevron-forward'} size={15} color={s.subtle}/>
            </Pressable>
            {open&&<View style={{paddingHorizontal:13,paddingBottom:12,paddingTop:2,flexDirection:'row',flexWrap:'wrap',gap:7}}>
              {pill(`playback-quality-${item.id}-follow`,'跟随全局',custom===undefined,()=>setPlatformQuality(item.id,undefined),`${item.label} 跟随全局`)}
              {qualityOrder.map(q=>pill(`playback-quality-${item.id}-${q}`,q.toUpperCase(),custom===q,()=>setPlatformQuality(item.id,q),`${item.label} ${q}`))}
            </View>}
          </View>;
        })}
      </View>
    </View>
    <View style={[{borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,overflow:'hidden'},s.cardShadow]}>
      <View style={{paddingHorizontal:16,paddingTop:15,paddingBottom:12,gap:10}}>
        <View style={{gap:2}}>
          <Text style={{color:s.ink,fontSize:16,fontWeight:'700'}}>智能换源策略</Text>
          <Text style={{color:s.muted,fontSize:12,lineHeight:17}}>首选音源解析失败后的降级与回退规则</Text>
        </View>
        <View style={{gap:6}}>
          <Text style={{color:s.muted,fontSize:12}}>降级方式</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
            {degradeModes.map(([mode,label])=>pill(`smart-degrade-${mode}`,label,value.smartDegradeMode===mode,()=>update({smartDegradeMode:mode},'降级策略未保存')))}
          </View>
          <Text style={{color:s.subtle,fontSize:11.5}}>{degradeModes.find(([mode])=>mode===value.smartDegradeMode)?.[2]}</Text>
        </View>
      </View>
      <View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:54,backgroundColor:s.hairline}}/>
      <View style={{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,paddingVertical:13}}>
        <View style={{width:26,alignItems:'center'}}><Ionicons name="repeat-outline" size={20} color={s.ink}/></View>
        <View style={{flex:1,gap:2}}>
          <Text style={{color:s.ink,fontSize:15.5,fontWeight:'700'}}>跨脚本换源</Text>
          <Text style={{color:s.muted,fontSize:12,lineHeight:17}}>当前音源失败后，依次尝试其他已启用的备用音源脚本</Text>
        </View>
        <Switch testID="smart-cross-script" accessibilityLabel="跨脚本换源" value={value.smartCrossScript} onValueChange={smartCrossScript=>update({smartCrossScript},'跨脚本设置未保存')} trackColor={s.switchTrack} thumbColor={s.switchThumb(value.smartCrossScript)}/>
      </View>
      <View accessible={false} style={{height:StyleSheet.hairlineWidth,marginLeft:54,backgroundColor:s.hairline}}/>
      <View style={{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,paddingVertical:13}}>
        <View style={{width:26,alignItems:'center'}}><Ionicons name="play-skip-forward-outline" size={20} color={s.ink}/></View>
        <View style={{flex:1,gap:2}}>
          <Text style={{color:s.ink,fontSize:15.5,fontWeight:'700'}}>播放失败自动下一首</Text>
          <Text style={{color:s.muted,fontSize:12,lineHeight:17}}>全部解析失败时自动跳至下一首，关闭则停止并提示</Text>
        </View>
        <Switch testID="smart-skip-on-failure" accessibilityLabel="播放失败自动下一首" value={value.smartSkipOnFailure} onValueChange={smartSkipOnFailure=>update({smartSkipOnFailure},'失败跳过设置未保存')} trackColor={s.switchTrack} thumbColor={s.switchThumb(value.smartSkipOnFailure)}/>
      </View>
    </View>
    {!!error&&<Text accessibilityRole="alert" style={{color:s.accent,fontSize:12,lineHeight:18,marginLeft:6}}>{error}</Text>}
  </View>;
}
