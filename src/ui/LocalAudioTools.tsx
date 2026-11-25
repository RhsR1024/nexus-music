import {useState} from 'react';
import {Keyboard,Pressable,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {sollinTokens} from './tokens.ts';
import {localSortFields,localSortLabels,type LocalSortField,type LocalSortDirection} from '../domain/localAudioSort.ts';

export function LocalAudioTools({query,onQuery,field,direction,onSort}:{query:string;onQuery:(value:string)=>void;field:LocalSortField;direction:LocalSortDirection;onSort:(field:LocalSortField,direction:LocalSortDirection)=>void}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),[expanded,setExpanded]=useState(false);
  return <View style={{gap:8}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
      <View style={{flex:1,flexDirection:'row',alignItems:'center',gap:8,minHeight:40,paddingHorizontal:12,borderRadius:18,backgroundColor:s.inputBg,borderWidth:1,borderColor:s.cardBorder}}>
        <Ionicons name="search-outline" size={16} color={s.subtle}/>
        <TextInput accessibilityLabel="搜索本地歌曲艺术家专辑" value={query} onChangeText={onQuery} placeholder="搜索歌曲、艺术家或专辑" placeholderTextColor={s.subtle} autoCorrect={false} returnKeyType="search" onSubmitEditing={()=>Keyboard.dismiss()} style={{flex:1,color:s.ink,fontSize:14,paddingVertical:7}}/>
        {!!query&&<Pressable accessibilityRole="button" accessibilityLabel="清空歌曲筛选" onPress={()=>{onQuery('');Keyboard.dismiss();}} style={{width:28,height:28,alignItems:'center',justifyContent:'center'}}><Ionicons name="close-circle" size={17} color={s.subtle}/></Pressable>}
      </View>
      <Pressable testID="local-sort-field" accessibilityRole="button" accessibilityLabel={`排序 · ${localSortLabels[field]}`} accessibilityState={{expanded}} onPress={()=>{Keyboard.dismiss();setExpanded(value=>!value);}} style={{minHeight:40,paddingHorizontal:11,borderRadius:18,backgroundColor:expanded?s.accentSoft:s.chip,borderWidth:1,borderColor:expanded?s.control:s.chipBorder,flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="swap-vertical-outline" size={15} color={expanded?s.control:s.ink}/><Text style={{color:expanded?s.control:s.ink,fontSize:12,fontWeight:'600'}}>{localSortLabels[field]}</Text></Pressable>
      <Pressable testID="local-sort-direction" accessibilityRole="button" accessibilityLabel={direction==='asc'?'正序':'倒序'} onPress={()=>onSort(field,direction==='asc'?'desc':'asc')} style={{width:40,height:40,borderRadius:20,backgroundColor:s.chip,borderWidth:1,borderColor:s.chipBorder,alignItems:'center',justifyContent:'center'}}><Ionicons name={direction==='asc'?'arrow-up':'arrow-down'} size={16} color={s.ink}/></Pressable>
    </View>
    {expanded&&<View style={{flexDirection:'row',gap:6,flexWrap:'wrap'}}>{localSortFields.map(value=><Pressable key={value} testID={`local-sort-${value}`} accessibilityRole="radio" accessibilityLabel={localSortLabels[value]} accessibilityState={{selected:field===value}} onPress={()=>{onSort(value,direction);setExpanded(false);}} style={{paddingHorizontal:12,paddingVertical:7,borderRadius:15,backgroundColor:field===value?s.control:s.chip,borderWidth:1,borderColor:field===value?s.control:s.chipBorder}}><Text style={{color:field===value?'#FFFFFF':s.muted,fontSize:12,fontWeight:field===value?'600':'500'}}>{localSortLabels[value]}</Text></Pressable>)}</View>}
  </View>;
}
