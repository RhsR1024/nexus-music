import {useState} from 'react';
import {Keyboard,Pressable,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {trackSortOptions,type TrackSort} from '../domain/trackList.ts';
export function TrackListTools({query,onQuery,sort,onSort,label='搜索列表歌曲歌手专辑'}:{query:string;onQuery:(value:string)=>void;sort:TrackSort;onSort:(value:TrackSort)=>void;label?:string}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),[expanded,setExpanded]=useState(false);
  return <View style={{gap:8}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
      <View style={{flex:1,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:12,minHeight:40,borderRadius:16,backgroundColor:s.inputBg,borderWidth:1,borderColor:s.cardBorder}}>
        <Ionicons name="search-outline" size={16} color={s.subtle}/>
        <TextInput accessibilityLabel={label} value={query} onChangeText={onQuery} placeholder="搜索歌曲、歌手或专辑" placeholderTextColor={s.subtle} autoCorrect={false} returnKeyType="search" onSubmitEditing={()=>Keyboard.dismiss()} style={{flex:1,color:s.ink,fontSize:14,paddingVertical:8}}/>
        {!!query&&<Pressable accessibilityRole="button" accessibilityLabel="清空歌曲筛选" onPress={()=>{onQuery('');Keyboard.dismiss();}} style={{width:28,height:28,alignItems:'center',justifyContent:'center'}}><Ionicons name="close-circle" size={17} color={s.subtle}/></Pressable>}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="选择歌曲排序" accessibilityState={{expanded}} onPress={()=>{Keyboard.dismiss();setExpanded(value=>!value);}} style={{minHeight:40,paddingHorizontal:12,borderRadius:16,backgroundColor:expanded?s.accentSoft:s.chip,borderWidth:1,borderColor:expanded?s.control:s.chipBorder,flexDirection:'row',alignItems:'center',gap:5}}>
        <Ionicons name="swap-vertical-outline" size={15} color={expanded?s.control:s.ink}/>
        <Text style={{color:expanded?s.control:s.ink,fontSize:12,fontWeight:'600'}}>排序 · {trackSortOptions.find(([value])=>value===sort)?.[1]}</Text>
      </Pressable>
    </View>
    {expanded&&<View style={{flexDirection:'row',gap:6,flexWrap:'wrap'}}>{trackSortOptions.map(([value,title])=><Pressable key={value} accessibilityRole="radio" accessibilityLabel={title} accessibilityState={{selected:sort===value}} onPress={()=>{onSort(value);setExpanded(false);}} style={{paddingHorizontal:12,paddingVertical:7,borderRadius:14,backgroundColor:sort===value?s.control:s.chip,borderWidth:1,borderColor:sort===value?s.control:s.chipBorder}}><Text style={{color:sort===value?'#FFFFFF':s.muted,fontSize:12,fontWeight:sort===value?'600':'500'}}>{title}</Text></Pressable>)}</View>}
  </View>;
}
