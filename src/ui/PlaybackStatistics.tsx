import {useMemo,useState,useSyncExternalStore} from 'react';
import {Alert,FlatList,Pressable,View} from 'react-native';
import {Modal} from './AdaptiveModal.tsx';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Text} from './Typography.tsx';
import {useTheme} from './theme.tsx';
import {controls,radius,space,typography} from './tokens.ts';
import type {Services} from '../app/services.ts';
import {listeningCalendar,listeningDuration,listeningStatistics,type StatisticsGroup,type StatisticsRow,type StatisticsSort} from '../domain/listeningStatistics.ts';
import {trackKey} from '../domain/track.ts';

const layout={rowMinHeight:64,chartHeight:76,barHeight:52} as const;

export function PlaybackStatistics({services}:{services:Services}){
  const {palette:p}=useTheme(),insets=useSafeAreaInsets(),state=useSyncExternalStore(services.playbackStats.subscribe,services.playbackStats.getSnapshot);
  const [open,setOpen]=useState(false),[group,setGroup]=useState<StatisticsGroup>('songs'),[sort,setSort]=useState<StatisticsSort>('duration'),[day,setDay]=useState<string>(),[dates,setDates]=useState(false),[selected,setSelected]=useState<string>(),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const summary=useMemo(()=>listeningStatistics(state,group,sort,day),[state,group,sort,day]);
  const songs=useMemo(()=>listeningStatistics(state,'songs',sort,day),[state,sort,day]);
  const members=new Set(summary.rows.find(row=>row.id===selected)?.tracks.map(track=>trackKey(track.origin))??[]);
  const rows=selected?songs.rows.filter(row=>members.has(row.id)):summary.rows;
  const maximumHour=Math.max(1,...summary.hours.map(x=>x.listenedMs));
  const calendar=listeningCalendar(summary.days,Date.now()),maximumDay=Math.max(1,...calendar.map(x=>x.listenedMs??0));
  const button=(label:string,action:()=>void,chosen=false,id?:string)=><Pressable testID={id} accessibilityRole="button" accessibilityState={{selected:chosen,disabled:busy}} disabled={busy} onPress={action} style={{minHeight:controls.hit,padding:space.md,borderRadius:radius.md,backgroundColor:chosen?p.selected:p.surface,borderWidth:1,borderColor:chosen?p.accent:p.border}}><Text style={{color:chosen?p.accent:p.text}}>{label}</Text></Pressable>;
  function clear(){Alert.alert('清空播放统计？','仅清除本机听歌统计与分时明细。最近播放、歌单、文件和当前播放不变。',[{text:'取消',style:'cancel'},{text:'清空',style:'destructive',onPress:()=>{setBusy(true);void services.playbackStats.clear().then(()=>{setSelected(undefined);setDay(undefined);setMessage('播放统计已清空');}).catch(()=>setMessage('播放统计未清空，请重试')).finally(()=>setBusy(false));}}]);}
  function row(item:StatisticsRow){return <Pressable testID={`statistics-row-${item.id}`} accessibilityRole="button" accessibilityLabel={`${item.title} · ${listeningDuration(item.listenedMs)} · 播放 ${item.playCount} 次`} onPress={()=>{if(group==='songs'||selected){services.playTracks(rows.map(value=>value.tracks[0]!),rows.indexOf(item));setOpen(false);}else setSelected(item.id);}} style={{minHeight:layout.rowMinHeight,paddingVertical:space.md,borderBottomWidth:1,borderColor:p.border,gap:space.xs}}><Text style={{color:p.text,...typography.body,fontWeight:'600'}}>{item.title}</Text><Text style={{color:p.secondary}}>{item.subtitle}{item.subtitle?' · ':''}{listeningDuration(item.listenedMs)} · 播放 {item.playCount} 次{group!=='songs'&&!selected?` · ${item.tracks.length} 首`:''}</Text></Pressable>;}
  return <>
    {button('听歌统计',()=>{setSelected(undefined);setMessage('');setOpen(true);},false,'open-listening-statistics')}
    <Modal visible={open} animationType="slide" onRequestClose={()=>setOpen(false)}><View style={{flex:1,padding:space.xxl,paddingLeft:Math.max(space.xxl,insets.left+space.md),paddingRight:Math.max(space.xxl,insets.right+space.md),paddingTop:insets.top+space.md,paddingBottom:insets.bottom+space.md,backgroundColor:p.background[0],gap:space.md}}>
      <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>{button(selected?'返回统计分组':'收起听歌统计',()=>selected?setSelected(undefined):setOpen(false))}<Text accessibilityRole="header" style={{color:p.text,...typography.title}}>听歌统计</Text></View>
      <FlatList testID="statistics-list" style={{flex:1}} data={rows} keyExtractor={item=>item.id} renderItem={({item})=>row(item)} ListHeaderComponent={<View style={{gap:space.md,paddingBottom:space.md}}>
      <View style={{flexDirection:'row',gap:space.sm}}>{(['songs','artists','albums'] as const).map((value,index)=><View key={value} style={{flex:1}}>{button(['歌曲','歌手','专辑'][index]!,()=>{setGroup(value);setSelected(undefined);},group===value,`statistics-group-${value}`)}</View>)}</View>
      <View style={{flexDirection:'row',gap:space.sm,flexWrap:'wrap'}}>{button('按时长',()=>setSort('duration'),sort==='duration')}{button('按播放次数',()=>setSort('plays'),sort==='plays')}{button(day??'全部日期',()=>setDates(true))}</View>
      <Text testID="statistics-summary" style={{color:p.text}}>{day??'已保存累计'} · {listeningDuration(summary.totalMs)} · 播放 {summary.totalPlays} 次</Text>
      <Text testID="statistics-counts" style={{color:p.secondary}}>歌曲 {summary.songCount} · 已知歌手 {summary.artistCount} · 已知专辑 {summary.albumCount}</Text>
      {!selected&&<View style={{gap:space.sm}}><Text style={{color:p.secondary,...typography.caption}}>近90天日期分布 · 已记录明细</Text><Text style={{color:p.secondary,...typography.micro}}>{calendar[0]!.date} — {calendar[89]!.date}</Text><View style={{flexDirection:'row',gap:space.xs}}>
        {Array.from({length:13},(_,week)=><View key={week} style={{flex:1,alignItems:'center',gap:space.xs}}>{calendar.slice(week*7,week*7+7).map(value=><View key={value.date} accessible={value.listenedMs!==null} accessibilityLabel={`${value.date} · ${value.listenedMs===null?'未记录分时明细':listeningDuration(value.listenedMs)}`} style={{width:space.lg,height:space.lg,borderRadius:radius.sm,borderWidth:1,borderColor:p.border,backgroundColor:value.listenedMs===null?p.surface:p.accent,opacity:value.listenedMs===null?1:.3+.7*Math.sqrt(value.listenedMs/maximumDay)}}/>)}</View>)}
      </View><Text style={{color:p.secondary,...typography.micro}}>有色格为已记录明细；空心格没有明细，不能视作没有播放。</Text></View>}
      {!selected&&<View style={{gap:space.xs}}><Text style={{color:p.secondary,...typography.caption}}>24小时听歌分布</Text><View style={{height:layout.chartHeight,flexDirection:'row',gap:space.xxs}}>
        {summary.hours.map((hour,index)=><View key={index} accessible accessibilityLabel={`${index}时 · ${listeningDuration(hour.listenedMs)} · 播放 ${hour.playCount} 次`} style={{flex:1,minWidth:0,justifyContent:'flex-end',alignItems:'center',gap:space.xs}}><View style={{width:'70%',height:hour.listenedMs?Math.max(space.xxs,layout.barHeight*hour.listenedMs/maximumHour):1,backgroundColor:hour.listenedMs?p.accent:p.border,borderRadius:radius.sm}}/><Text style={{color:p.secondary,...typography.micro}}>{index%3===0?index:' '}</Text></View>)}
      </View></View>}
      <Text style={{color:p.secondary,...typography.caption}}>分时按设备本地时间记录；播放次数按起播计。旧记录及超出明细保留上限的数据只计累计，不补造分布。专辑按名称与艺术家分组。</Text>
      {(summary.undatedMs>0||summary.undatedPlays>0)&&<Text testID="statistics-undated" style={{color:p.secondary,...typography.caption}}>未分时累计 {listeningDuration(summary.undatedMs)} · {summary.undatedPlays} 次</Text>}
      </View>} ListEmptyComponent={<Text style={{paddingVertical:space.xxl,color:p.secondary}}>暂无此范围的听歌统计，实际播放后会出现在这里。</Text>}/>
      {!!message&&<Text accessibilityLiveRegion="polite" style={{color:p.accent}}>{message}</Text>}
      {button('清空本机听歌统计',clear)}
      <Modal visible={dates} animationType="slide" onRequestClose={()=>setDates(false)}><View style={{flex:1,padding:space.xxl,paddingLeft:Math.max(space.xxl,insets.left+space.md),paddingRight:Math.max(space.xxl,insets.right+space.md),paddingTop:insets.top+space.md,paddingBottom:insets.bottom+space.md,backgroundColor:p.background[0],gap:space.sm}}>{button('取消选择日期',()=>setDates(false))}{button('全部日期',()=>{setDay(undefined);setSelected(undefined);setDates(false);},!day)}<FlatList data={summary.days} keyExtractor={item=>item.date} renderItem={({item})=>button(`${item.date} · ${listeningDuration(item.listenedMs)}`,()=>{setDay(item.date);setSelected(undefined);setDates(false);},day===item.date)}/></View></Modal>
    </View></Modal>
  </>;
}
