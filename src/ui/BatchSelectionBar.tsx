import {Ionicons} from '@expo/vector-icons';
import {Pressable,StyleSheet,View} from 'react-native';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {radius,space,typography} from './tokens.ts';

export type BatchAction='favorite'|'playlist'|'next'|'download'|'unfavorite'|'delete'
const actionMeta:Readonly<Record<BatchAction,{label:string;icon:React.ComponentProps<typeof Ionicons>['name']}>>={
  favorite:{label:'收藏',icon:'heart-outline'},
  unfavorite:{label:'取消收藏',icon:'heart-dislike-outline'},
  playlist:{label:'加歌单',icon:'albums-outline'},
  next:{label:'下一首',icon:'play-skip-forward'},
  download:{label:'下载',icon:'download-outline'},
  delete:{label:'删除',icon:'trash-outline'},
};

// 已选 N / 总数 panel. Per-action commit behavior stays with the page so the
// documented divergence (favorite/next close, playlist keeps) lives next to
// the contracts that require it.
export function BatchSelectionBar({count,total,actions,onAction,onSelectAll,onCancel,allSelected,busy,testPrefix='batch'}:{
  count:number;total:number;actions:readonly BatchAction[];onAction:(action:BatchAction)=>void;
  onSelectAll:()=>void;onCancel:()=>void;allSelected:boolean;busy?:boolean;testPrefix?:string;
}){
  const theme=useTheme();
  return <View testID={`${testPrefix}-selection-bar`} accessibilityLabel={`已选 ${count} / ${total} 首`} style={[styles.host,{backgroundColor:theme.palette.surface,borderColor:theme.palette.border}]}>
    <View style={styles.header}>
      <Text style={[typography.body,{color:theme.palette.text}]}>已选 {count} / {total} 首</Text>
      <View style={styles.headerControls}>
        <Pressable testID={`${testPrefix}-select-all`} accessibilityRole="button" accessibilityLabel={allSelected?'取消全选':'全选'} disabled={busy} onPress={onSelectAll} style={styles.control}>
          <Text style={[typography.caption,{color:theme.palette.accent}]}>{allSelected?'取消全选':'全选'}</Text>
        </Pressable>
        <Pressable testID={`${testPrefix}-cancel-selection`} accessibilityRole="button" accessibilityLabel="取消选择" disabled={busy} onPress={onCancel} style={styles.control}>
          <Text style={[typography.caption,{color:theme.palette.secondary}]}>取消</Text>
        </Pressable>
      </View>
    </View>
    <View style={styles.actions}>
      {actions.map(action=>{const meta=actionMeta[action];return (
        <Pressable key={action} testID={`${testPrefix}-action-${meta.label}`} accessibilityRole="button" accessibilityLabel={meta.label} disabled={busy||!count} onPress={()=>onAction(action)} style={[styles.action,{backgroundColor:theme.palette.selected,opacity:!count||busy?.5:1}]}>
          <Ionicons name={meta.icon} size={20} color={theme.palette.accent}/>
          <Text style={[typography.caption,{color:theme.palette.text}]}>{meta.label}</Text>
        </Pressable>);})}
    </View>
  </View>;
}
const styles=StyleSheet.create({
  host:{borderRadius:radius.xl,borderWidth:StyleSheet.hairlineWidth,padding:space.lg,gap:space.md},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  headerControls:{flexDirection:'row',gap:space.md},
  control:{minHeight:44,justifyContent:'center',paddingHorizontal:space.sm},
  actions:{flexDirection:'row',flexWrap:'wrap',gap:space.md},
  action:{minHeight:48,paddingHorizontal:space.lg,borderRadius:radius.lg,flexDirection:'row',alignItems:'center',gap:space.sm},
});
