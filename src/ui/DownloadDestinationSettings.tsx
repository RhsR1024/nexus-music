import {useState,useSyncExternalStore} from 'react';
import {Alert,Pressable,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import type {Services} from '../app/services.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';

export function DownloadDestinationSettings({services}:{services:Services}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),state=useSyncExternalStore(services.downloadDestination.subscribe,services.downloadDestination.getSnapshot),jobs=useSyncExternalStore(services.downloadDelivery.subscribe,services.downloadDelivery.getSnapshot),[message,setMessage]=useState('');
  const busy=state.busy||jobs.some(job=>job.state==='copying');
  const action=(run:()=>Promise<unknown>)=>{setMessage('');void run().catch(()=>setMessage('目录未更改，请重试；原音频保留'));};
  const pill=(id:string,label:string,run:()=>void,primary=false)=>(
    <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{disabled:busy}} disabled={busy} onPress={run} style={{minHeight:42,paddingHorizontal:15,paddingVertical:10,borderRadius:21,backgroundColor:primary?s.control:s.chip,borderWidth:primary?0:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center',opacity:busy?0.45:1}}>
      <Text style={{fontSize:13.5,fontWeight:'600',color:primary?'#FFFFFF':s.ink}}>{label}</Text>
    </Pressable>
  );
  return <View style={[{gap:12,padding:16,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder},s.cardShadow]}>
    <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
      <View style={{width:34,height:34,borderRadius:10,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center'}}>
        <Ionicons name="folder-open-outline" size={18} color={s.accent}/>
      </View>
      <View style={{flex:1,minWidth:0}}>
        <Text accessibilityRole="header" style={{fontSize:16,fontWeight:'700',color:s.ink}}>自动另存目录</Text>
        <Text testID="download-destination-summary" style={{fontSize:12.5,color:s.muted,marginTop:2}}>{state.root?`已选择 · ${state.root.name}`:'未选择 · 仅保存在App内'}</Text>
      </View>
    </View>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
      {pill('download-destination-choose',state.root?'更换目录':'选择保存目录',()=>action(()=>services.downloadDestination.choose()),true)}
      {state.root&&pill('download-destination-forget','停止自动另存',()=>Alert.alert('停止自动另存？','移除本机目录授权，尚未开始的任务不再写入。目录内已有用户副本保留。',[{text:'保持',style:'cancel'},{text:'停止另存',style:'destructive',onPress:()=>action(()=>services.downloadDestination.forget())}]))}
    </View>
    <Text style={{fontSize:12,lineHeight:18,color:s.muted}}>选择后仅对新下载自动另存；所选附加文件就绪后一起写入，重名组使用统一后缀，不覆盖已有文件。旧任务可在完成卡片明确另存。目录授权只保存在本机，与扫描目录分开；删除App内音频不会删除用户副本。</Text>
    {busy&&<Text accessibilityLiveRegion="polite" style={{fontSize:12,color:s.accent}}>正在选择或保存文件，请稍后更改目录。</Text>}
    {!!message&&<Text accessibilityRole="alert" style={{fontSize:12,color:s.accent}}>{message}</Text>}
  </View>;
}
