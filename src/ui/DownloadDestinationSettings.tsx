import {useState,useSyncExternalStore} from 'react';
import {Alert,Pressable,View} from 'react-native';
import type {Services} from '../app/services.ts';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,space,typography} from './tokens.ts';
export function DownloadDestinationSettings({services}:{services:Services}){
 const {palette:p}=useTheme(),state=useSyncExternalStore(services.downloadDestination.subscribe,services.downloadDestination.getSnapshot),jobs=useSyncExternalStore(services.downloadDelivery.subscribe,services.downloadDelivery.getSnapshot),[message,setMessage]=useState('');
 const busy=state.busy||jobs.some(job=>job.state==='copying');
 const action=(run:()=>Promise<unknown>)=>{setMessage('');void run().catch(()=>setMessage('目录未更改，请重试；原音频保留'));};
 const button=(id:string,label:string,run:()=>void)=><Pressable testID={id} accessibilityRole="button" accessibilityState={{disabled:busy}} disabled={busy} onPress={run} style={{minHeight:controls.hit,padding:space.md,borderRadius:radius.md,backgroundColor:p.selected,opacity:busy?0.45:1}}><Text style={{...typography.body,color:p.accent}}>{label}</Text></Pressable>;
 return <View style={{gap:space.md}}><Text accessibilityRole="header" style={{...typography.heading,color:p.text}}>自动另存目录</Text>
  <Text testID="download-destination-summary" style={{...typography.body,color:p.secondary}}>{state.root?`已选择 · ${state.root.name}`:'未选择 · 仅保存在App内'}</Text>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:space.sm}}>{button('download-destination-choose',state.root?'更换目录':'选择保存目录',()=>action(()=>services.downloadDestination.choose()))}{state.root&&button('download-destination-forget','停止自动另存',()=>Alert.alert('停止自动另存？','移除本机目录授权，尚未开始的任务不再写入。目录内已有用户副本保留。',[{text:'保持',style:'cancel'},{text:'停止另存',style:'destructive',onPress:()=>action(()=>services.downloadDestination.forget())}]))}</View>
  <Text style={{...typography.caption,color:p.secondary}}>选择后仅对新下载自动另存；所选附加文件就绪后一起写入，重名组使用统一后缀，不覆盖已有文件。旧任务可在完成卡片明确另存。目录授权只保存在本机，与扫描目录分开；删除App内音频不会删除用户副本。</Text>
  {busy&&<Text accessibilityLiveRegion="polite" style={{...typography.caption,color:p.secondary}}>正在选择或保存文件，请稍后更改目录。</Text>}{!!message&&<Text accessibilityRole="alert" style={{...typography.caption,color:p.secondary}}>{message}</Text>}
 </View>;
}
