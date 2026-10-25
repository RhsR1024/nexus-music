import {useState} from 'react';
import {Keyboard,Pressable,View} from 'react-native';
import {Text,TextInput} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,space} from './tokens.ts';
import {localSortFields,localSortLabels,type LocalSortField,type LocalSortDirection} from '../domain/localAudioSort.ts';

export function LocalAudioTools({query,onQuery,field,direction,onSort}:{query:string;onQuery:(value:string)=>void;field:LocalSortField;direction:LocalSortDirection;onSort:(field:LocalSortField,direction:LocalSortDirection)=>void}){
  const {palette:p}=useTheme(),[expanded,setExpanded]=useState(false);
  const chip={minHeight:controls.hit,padding:space.md,borderRadius:radius.md,justifyContent:'center' as const};
  return <View style={{gap:space.sm}}>
    <TextInput accessibilityLabel="搜索本地歌曲艺术家专辑" value={query} onChangeText={onQuery} placeholder="搜索歌曲、艺术家或专辑" placeholderTextColor={p.secondary} autoCorrect={false} returnKeyType="search" onSubmitEditing={()=>Keyboard.dismiss()} style={{color:p.text,borderWidth:1,borderColor:p.border,borderRadius:radius.md,padding:space.md}}/>
    <View style={{flexDirection:'row',gap:space.sm,flexWrap:'wrap'}}>
      <Pressable testID="local-sort-field" accessibilityRole="button" accessibilityLabel={`排序 · ${localSortLabels[field]}`} accessibilityState={{expanded}} onPress={()=>{Keyboard.dismiss();setExpanded(value=>!value);}} style={{...chip,backgroundColor:p.surface}}><Text style={{color:p.accent}}>排序 · {localSortLabels[field]}</Text></Pressable>
      <Pressable testID="local-sort-direction" accessibilityRole="button" accessibilityLabel={direction==='asc'?'正序':'倒序'} onPress={()=>onSort(field,direction==='asc'?'desc':'asc')} style={{...chip,backgroundColor:p.surface}}><Text style={{color:p.accent}}>{direction==='asc'?'正序 ↑':'倒序 ↓'}</Text></Pressable>
      {!!query&&<Pressable accessibilityRole="button" accessibilityLabel="清空歌曲筛选" onPress={()=>{onQuery('');Keyboard.dismiss();}} style={chip}><Text style={{color:p.accent}}>清空筛选</Text></Pressable>}
    </View>
    {expanded&&<View style={{flexDirection:'row',gap:space.sm,flexWrap:'wrap'}}>{localSortFields.map(value=><Pressable key={value} testID={`local-sort-${value}`} accessibilityRole="radio" accessibilityLabel={localSortLabels[value]} accessibilityState={{selected:field===value}} onPress={()=>{onSort(value,direction);setExpanded(false);}} style={{...chip,backgroundColor:field===value?p.selected:p.surface}}><Text style={{color:field===value?p.accent:p.secondary}}>{localSortLabels[value]}</Text></Pressable>)}</View>}
  </View>;
}
