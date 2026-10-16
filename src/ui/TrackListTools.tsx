import {useState} from 'react';
import {Keyboard,Pressable,View} from 'react-native';
import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {trackSortOptions,type TrackSort} from '../domain/trackList.ts';
export function TrackListTools({query,onQuery,sort,onSort,label='搜索列表歌曲歌手专辑'}:{query:string;onQuery:(value:string)=>void;sort:TrackSort;onSort:(value:TrackSort)=>void;label?:string}){
  const {palette:p}=useTheme(),[expanded,setExpanded]=useState(false);
  return <View style={{gap:10}}><TextInput accessibilityLabel={label} value={query} onChangeText={onQuery} placeholder="搜索歌曲、歌手或专辑" placeholderTextColor={p.secondary} autoCorrect={false} returnKeyType="search" onSubmitEditing={()=>Keyboard.dismiss()} style={{color:p.text,borderWidth:1,borderColor:p.border,borderRadius:12,padding:12}}/>
    <View style={{flexDirection:'row',gap:7,flexWrap:'wrap'}}><Pressable accessibilityRole="button" accessibilityLabel="选择歌曲排序" accessibilityState={{expanded}} onPress={()=>{Keyboard.dismiss();setExpanded(value=>!value);}} style={{padding:10,borderRadius:12,backgroundColor:p.surface}}><Text style={{color:p.accent,fontSize:12}}>排序 · {trackSortOptions.find(([value])=>value===sort)?.[1]}</Text></Pressable>
      {!!query&&<Pressable accessibilityRole="button" accessibilityLabel="清空歌曲筛选" onPress={()=>{onQuery('');Keyboard.dismiss();}} style={{padding:10}}><Text style={{color:p.accent,fontSize:12}}>清空筛选</Text></Pressable>}
    </View>
    {expanded&&<View style={{flexDirection:'row',gap:7,flexWrap:'wrap'}}>{trackSortOptions.map(([value,title])=><Pressable key={value} accessibilityRole="radio" accessibilityLabel={title} accessibilityState={{selected:sort===value}} onPress={()=>{onSort(value);setExpanded(false);}} style={{padding:10,borderRadius:12,backgroundColor:sort===value?p.selected:p.surface}}><Text style={{color:sort===value?p.accent:p.secondary,fontSize:12}}>{title}</Text></Pressable>)}</View>}
  </View>;
}
