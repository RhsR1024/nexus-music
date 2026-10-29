import {useState,useSyncExternalStore} from 'react';
import {Alert,Pressable,View} from 'react-native';
import type {Services} from '../app/services.ts';
import {catalogKey,type CatalogTarget} from '../storage/catalogFavorites.ts';
import {Text} from './Typography.tsx';
import {controls,radius,space} from './tokens.ts';
import {useTheme} from './theme.tsx';
export const catalogNames={playlist:'歌单',album:'专辑',mv:'MV'} as const;
export function CatalogFavoriteButton({services,target}:{services:Services;target:CatalogTarget}){
 const theme=useTheme(),library=useSyncExternalStore(services.library.subscribe,services.library.getSnapshot),key=catalogKey(target),saved=library.catalogFavorites?.find(item=>catalogKey(item)===key);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function save(remove=false){setBusy(true);setMessage('');try{if(remove&&saved)await services.library.removeCatalogFavorite(target,saved.savedId);else await services.library.addCatalogFavorite(target);setMessage(remove?'已从本机收藏移除':'已保存到音枢本机收藏');}catch(error){setMessage(error instanceof Error&&error.message.includes('重新确认')?error.message:'收藏未保存，请重试');}finally{setBusy(false);}}
 const label=`${saved?'已收藏':'收藏'}${catalogNames[target.kind]}`;
 return <View style={{gap:space.xs}}><Pressable testID="catalog-favorite" accessibilityRole="button" accessibilityLabel={`${label}（本机）`} accessibilityState={{selected:!!saved,disabled:busy}} disabled={busy} onPress={()=>saved?Alert.alert(`取消收藏${catalogNames[target.kind]}？`,`${target.title}。只从音枢本机目录收藏移除，不删除歌曲、音频或平台数据。`,[{text:'取消',style:'cancel'},{text:'移除收藏',style:'destructive',onPress:()=>{void save(true);}}]):void save()} style={{minHeight:controls.hit,paddingHorizontal:space.md,justifyContent:'center',borderRadius:radius.md,backgroundColor:theme.palette.selected,opacity:busy?.5:1}}><Text style={{color:theme.palette.accent}}>{busy?'正在保存…':`${label} · 本机`}</Text></Pressable>{!!message&&<Text accessibilityLiveRegion="polite" style={{color:theme.palette.secondary}}>{message}</Text>}</View>;
}
