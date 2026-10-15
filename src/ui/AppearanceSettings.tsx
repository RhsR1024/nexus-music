import {useSyncExternalStore} from 'react';
import {Pressable,Text,View} from 'react-native';
import type {Services} from '../app/services.ts';
import {useTheme} from './theme.tsx';
export function AppearanceSettings({services}:{services:Services}){
  const theme=useTheme(),value=useSyncExternalStore(services.preferences.subscribe,services.preferences.getSnapshot);
  return <View style={{gap:14,marginVertical:24}}><Text style={{fontSize:18,color:theme.color('#ECEBF3')}}>外观</Text><View style={{flexDirection:'row',gap:10}}>{(['system','light','dark']as const).map((mode,index)=><Pressable key={mode} testID={`theme-${mode}`} accessibilityRole="radio" accessibilityState={{selected:value.theme===mode}} accessibilityLabel={['跟随系统','浅色主题','深色主题'][index]} onPress={()=>{void services.preferences.update({theme:mode});}} style={{backgroundColor:theme.color('#303A32'),padding:14,borderRadius:12}}><Text style={{color:theme.color('#D9F49B')}}>{value.theme===mode?'● ':''}{['跟随系统','浅色','深色'][index]}</Text></Pressable>)}</View></View>;
}
