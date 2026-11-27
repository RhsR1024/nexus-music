import {useMemo,useState,useSyncExternalStore} from 'react';
import {Alert,FlatList,Pressable,StyleSheet,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import {Modal} from './AdaptiveModal.tsx';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Text} from './Typography.tsx';
import {Cover} from './Cover.tsx';
import {bestQualityLabel} from './QualityBadge.tsx';
import {useTheme} from './theme.tsx';
import {controls,sollinTokens,space} from './tokens.ts';
import type {Services} from '../app/services.ts';
import type {PlaybackStatsState} from '../storage/playbackStats.ts';
import {listeningPeriod} from '../domain/listeningActivity.ts';
import {listeningCalendar,listeningDuration,listeningStatistics,type StatisticsGroup,type StatisticsRow,type StatisticsSort} from '../domain/listeningStatistics.ts';
import {trackKey} from '../domain/track.ts';

type TimeRange='7d'|'30d'|'year'|'all';
const rangeLabels:readonly [TimeRange,string][]=[['7d','近7天'],['30d','近30天'],['year','今年'],['all','全部']];
const weekdayMarks:Record<number,string>={0:'一',2:'三',4:'五'};

function startDayForRange(range:TimeRange,now:number):string|undefined {
  if(range==='all')return undefined;
  const today=listeningPeriod(now).day;
  if(range==='year')return `${today.slice(0,4)}-01-01`;
  const end=Date.parse(today+'T00:00:00Z');
  const span=range==='7d'?6:29;
  return new Date(end-span*86400000).toISOString().slice(0,10);
}

function filterStateByRange(state:PlaybackStatsState,range:TimeRange,now:number):PlaybackStatsState {
  const startDay=startDayForRange(range,now);
  if(!startDay)return state;
  const items=state.items.flatMap(item=>{
    const matched=(item.activity??[]).filter(bucket=>bucket.day>=startDay);
    if(matched.length>0){
      const listenedMs=matched.reduce((sum,b)=>sum+b.listenedMs,0);
      const playCount=matched.reduce((sum,b)=>sum+b.playCount,0);
      if(listenedMs<=0&&playCount<=0)return [];
      return [{...item,listenedMs,playCount,activity:matched}];
    }
    if(!item.activity?.length&&item.lastPlayedAt>0){
      const lastDay=listeningPeriod(item.lastPlayedAt).day;
      if(lastDay>=startDay)return [item];
    }
    return [];
  });
  return {version:1,items};
}

function compactDuration(ms:number):string {
  const totalMinutes=Math.floor(ms/60000);
  const hours=Math.floor(totalMinutes/60);
  const minutes=totalMinutes%60;
  if(hours>0)return `${hours} h ${minutes} m`;
  if(minutes>0)return `${minutes} m`;
  return `${Math.floor(ms/1000)} s`;
}

export function PlaybackStatistics({
  services,
  triggerTestID='open-listening-statistics',
  triggerLabel='听歌统计',
  triggerSubtitle,
  triggerVariant='card',
}:{
  services:Services;
  triggerTestID?:string;
  triggerLabel?:string;
  triggerSubtitle?:string;
  triggerVariant?:'card'|'row'|'compact';
}){
  const theme=useTheme(),s=sollinTokens(theme.mode,theme.palette.accent,theme.appearance),insets=useSafeAreaInsets();
  const state=useSyncExternalStore(services.playbackStats.subscribe,services.playbackStats.getSnapshot);
  const [open,setOpen]=useState(false);
  const [range,setRange]=useState<TimeRange>('all');
  const [group,setGroup]=useState<StatisticsGroup>('songs');
  const [sort,setSort]=useState<StatisticsSort>('duration');
  const [day,setDay]=useState<string>();
  const [dates,setDates]=useState(false);
  const [selected,setSelected]=useState<string>();
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);

  const now=Date.now();
  const scopedState=useMemo(()=>filterStateByRange(state,range,now),[state,range]);
  const fullSummary=useMemo(()=>listeningStatistics(state,'songs','duration'),[state]);
  const summary=useMemo(()=>listeningStatistics(scopedState,group,sort,day),[scopedState,group,sort,day]);
  const songs=useMemo(()=>listeningStatistics(scopedState,'songs',sort,day),[scopedState,sort,day]);
  const members=new Set(summary.rows.find(row=>row.id===selected)?.tracks.map(track=>trackKey(track.origin))??[]);
  const rows=selected?songs.rows.filter(row=>members.has(row.id)):summary.rows;

  const maximumHour=Math.max(1,...summary.hours.map(x=>x.listenedMs));
  const peakHour=useMemo(()=>{
    let best=0;
    for(let i=1;i<summary.hours.length;i++){
      if(summary.hours[i]!.listenedMs>summary.hours[best]!.listenedMs)best=i;
    }
    return summary.hours[best]!.listenedMs>0?`${String(best).padStart(2,'0')}:00`:'暂无';
  },[summary.hours]);

  const calendar=useMemo(()=>listeningCalendar(fullSummary.days,now),[fullSummary.days]);
  const maximumDay=Math.max(1,...calendar.map(x=>x.listenedMs??0));

  const qualityBreakdown=useMemo(()=>{
    const counts=new Map<string,number>();
    let total=0,lossless=0;
    for(const item of scopedState.items){
      const label=bestQualityLabel(item.track);
      if(!label)continue;
      total++;
      counts.set(label,(counts.get(label)??0)+1);
      if(label==='FLAC'||label==='Hi-Res'||label==='Master'||label==='WAV'||label==='ALAC')lossless++;
    }
    const entries=[...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4);
    return {entries,total,losslessRatio:total?Math.round(lossless/total*1000)/10:0};
  },[scopedState]);

  const softCard=s.dark?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.56)';
  const segTrack=s.dark?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.34)';
  const segActive=s.dark?'rgba(255,255,255,0.16)':'rgba(255,255,255,0.84)';
  const rangeTitle=rangeLabels.find(([k])=>k===range)?.[1]??'全部';

  const pill=(label:string,action:()=>void,chosen=false,id?:string)=><Pressable testID={id} accessibilityRole="button" accessibilityState={{selected:chosen,disabled:busy}} disabled={busy} onPress={action} style={{minHeight:38,paddingHorizontal:14,paddingVertical:8,borderRadius:19,backgroundColor:chosen?s.accent:softCard,justifyContent:'center',alignItems:'center',opacity:busy?.45:1}}><Text style={{color:chosen?'#FFFFFF':s.ink,fontSize:13,fontWeight:'600'}}>{label}</Text></Pressable>;

  function clear(){
    Alert.alert('清空播放统计？','仅清除本机听歌统计与分时明细。最近播放、歌单、文件和当前播放不变。',[
      {text:'取消',style:'cancel'},
      {text:'清空',style:'destructive',onPress:()=>{setBusy(true);void services.playbackStats.clear().then(()=>{setSelected(undefined);setDay(undefined);setRange('all');setMessage('播放统计已清空');}).catch(()=>setMessage('播放统计未清空，请重试')).finally(()=>setBusy(false));}},
    ]);
  }

  function renderMetricCard(value:string,label:string,icon:React.ComponentProps<typeof Ionicons>['name'],half=true){
    return <View style={{flex:half?1:undefined,width:half?undefined:'48.5%',minHeight:88,borderRadius:18,backgroundColor:softCard,padding:14,justifyContent:'space-between',overflow:'hidden'}}>
      <Text style={{color:s.ink,fontSize:24,fontWeight:'800',fontVariant:['tabular-nums'],letterSpacing:-0.4}}>{value}</Text>
      <Text style={{color:s.muted,fontSize:12.5,fontWeight:'500'}}>{label}</Text>
      <Ionicons name={icon} size={36} color={s.accent} style={{position:'absolute',right:12,bottom:10,opacity:s.dark?0.22:0.16}}/>
    </View>;
  }

  function row(item:StatisticsRow,index:number){
    const coverTrack=item.tracks[0];
    return <Pressable testID={`statistics-row-${item.id}`} accessibilityRole="button" accessibilityLabel={`${item.title} · ${listeningDuration(item.listenedMs)} · 播放 ${item.playCount} 次`} onPress={()=>{if(group==='songs'||selected){services.playTracks(rows.map(value=>value.tracks[0]!),index);setOpen(false);}else setSelected(item.id);}} style={{minHeight:62,paddingVertical:9,paddingHorizontal:4,flexDirection:'row',alignItems:'center',gap:11,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:s.hairline}}>
      <Text style={{width:24,textAlign:'center',color:index<3?s.accent:s.subtle,fontSize:13,fontWeight:'700',fontVariant:['tabular-nums']}}>{String(index+1).padStart(2,'0')}</Text>
      {coverTrack&&<Cover services={services} track={coverTrack} size={44} radius={10}/>}
      <View style={{flex:1,gap:2}}>
        <Text numberOfLines={1} style={{color:s.ink,fontSize:15,fontWeight:'600'}}>{item.title}</Text>
        <Text numberOfLines={1} style={{color:s.muted,fontSize:12,fontVariant:['tabular-nums']}}>{item.subtitle}{item.subtitle?' · ':''}{listeningDuration(item.listenedMs)} · 播放 {item.playCount} 次{group!=='songs'&&!selected?` · ${item.tracks.length} 首`:''}</Text>
      </View>
      <Ionicons name={group==='songs'||selected?'play-circle-outline':'chevron-forward'} size={19} color={s.subtle}/>
    </Pressable>;
  }

  const selectedTitle=selected?summary.rows.find(item=>item.id===selected)?.title:undefined;
  const triggerSub=triggerSubtitle??`${fullSummary.songCount} 首 · ${fullSummary.totalPlays} 次 · ${listeningDuration(fullSummary.totalMs)}`;
  const openModal=()=>{setSelected(undefined);setMessage('');setOpen(true);};

  return <>
    {triggerVariant==='row'?<Pressable testID={triggerTestID} accessibilityRole="button" accessibilityLabel={triggerLabel} disabled={busy} onPress={openModal} style={{minHeight:60,paddingHorizontal:16,paddingVertical:12,flexDirection:'row',alignItems:'center',gap:12,opacity:busy?.45:1}}>
      <View style={{width:34,height:34,borderRadius:10,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center'}}>
        <Ionicons name="stats-chart-outline" size={18} color={s.accent}/>
      </View>
      <View style={{flex:1,minWidth:0,gap:2}}>
        <Text style={{color:s.ink,fontSize:15,fontWeight:'600'}}>{triggerLabel}</Text>
        <Text numberOfLines={1} style={{color:s.muted,fontSize:12,fontVariant:['tabular-nums']}}>{triggerSub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={s.subtle}/>
    </Pressable>:triggerVariant==='compact'?<Pressable testID={triggerTestID} accessibilityRole="button" accessibilityLabel={triggerLabel} disabled={busy} onPress={openModal} style={{minHeight:48,paddingHorizontal:12,paddingVertical:9,borderRadius:14,backgroundColor:s.dark?'rgba(255,255,255,0.06)':'rgba(255,255,255,0.62)',borderWidth:1,borderColor:s.cardBorder,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,opacity:busy?.45:1}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:10,flex:1,minWidth:0}}>
        <View style={{width:30,height:30,borderRadius:9,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center'}}>
          <Ionicons name="stats-chart" size={15} color={s.accent}/>
        </View>
        <View style={{flex:1,minWidth:0,gap:1}}>
          <Text style={{color:s.ink,fontSize:14,fontWeight:'600'}}>{triggerLabel}</Text>
          <Text numberOfLines={1} style={{color:s.muted,fontSize:11.5}}>{triggerSub}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={s.subtle}/>
    </Pressable>:<Pressable testID={triggerTestID} accessibilityRole="button" accessibilityLabel={triggerLabel} disabled={busy} onPress={openModal} style={[{minHeight:controls.hit,paddingHorizontal:16,paddingVertical:11,borderRadius:20,backgroundColor:s.card,borderWidth:1,borderColor:s.cardBorder,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},s.cardShadow]}>
      <View style={{flexDirection:'row',alignItems:'center',gap:10,flex:1,minWidth:0}}>
        <View style={{width:34,height:34,borderRadius:10,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center'}}>
          <Ionicons name="stats-chart" size={17} color={s.accent}/>
        </View>
        <View style={{flex:1,minWidth:0,gap:1}}>
          <Text style={{color:s.ink,fontSize:15,fontWeight:'600'}}>{triggerLabel}</Text>
          <Text numberOfLines={1} style={{color:s.muted,fontSize:12,fontVariant:['tabular-nums']}}>{triggerSub}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={s.subtle}/>
    </Pressable>}

    <Modal visible={open} animationType="slide" onRequestClose={()=>selected?setSelected(undefined):setOpen(false)}>
      <View style={{flex:1,backgroundColor:s.sheetGradient[0]}}>
        <LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
        <View style={{flex:1,paddingTop:insets.top,paddingBottom:insets.bottom+12}}>
          <View style={{minHeight:52,paddingHorizontal:16,paddingLeft:Math.max(12,insets.left+6),paddingRight:Math.max(12,insets.right+6),flexDirection:'row',alignItems:'center',justifyContent:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:s.hairline}}>
            <Pressable testID="statistics-back" accessibilityRole="button" accessibilityLabel={selected?'返回统计分组':'收起听歌统计'} disabled={busy} onPress={()=>selected?setSelected(undefined):setOpen(false)} style={{position:'absolute',left:Math.max(8,insets.left+4),width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',opacity:busy?.45:1}}>
              <Ionicons name="chevron-back" size={26} color={s.ink}/>
            </Pressable>
            <Text accessibilityRole="header" numberOfLines={1} style={{color:s.ink,fontSize:19,fontWeight:'700',letterSpacing:-0.3,marginHorizontal:48,textAlign:'center'}}>{selectedTitle??'听歌统计'}</Text>
          </View>
          <View style={{flex:1,paddingHorizontal:20,paddingLeft:Math.max(20,insets.left+12),paddingRight:Math.max(20,insets.right+12),paddingTop:12,gap:12}}>

          <FlatList testID="statistics-list" style={{flex:1}} data={rows} keyExtractor={item=>item.id} renderItem={({item,index})=>row(item,index)} contentContainerStyle={{paddingBottom:20}} ListHeaderComponent={<View style={{gap:12,paddingBottom:12}}>
            {/* Time range segmented bar: 近7天 / 近30天 / 今年 / 全部 */}
            <View style={{flexDirection:'row',padding:3,borderRadius:20,backgroundColor:segTrack}}>
              {rangeLabels.map(([key,label])=>{
                const active=range===key&&!day;
                return <Pressable key={key} testID={`statistics-range-${key}`} accessibilityRole="tab" accessibilityState={{selected:active}} onPress={()=>{setRange(key);setDay(undefined);setSelected(undefined);}} style={[{flex:1,minHeight:34,borderRadius:17,alignItems:'center',justifyContent:'center',backgroundColor:active?segActive:'transparent'},active&&s.cardShadow]}>
                  <Text style={{color:active?s.ink:s.muted,fontSize:12.5,fontWeight:active?'700':'500'}}>{label}</Text>
                </Pressable>;
              })}
            </View>

            {/* Group & sort filters kept above the fold so top() in UITest always hits immediately */}
            <View style={{flexDirection:'row',padding:3,borderRadius:20,backgroundColor:segTrack}}>
              {(['songs','artists','albums'] as const).map((value,index)=>{
                const active=group===value;
                return <Pressable key={value} testID={`statistics-group-${value}`} accessibilityRole="button" accessibilityState={{selected:active,disabled:busy}} disabled={busy} onPress={()=>{setGroup(value);setSelected(undefined);}} style={[{flex:1,minHeight:36,borderRadius:17,alignItems:'center',justifyContent:'center',backgroundColor:active?segActive:'transparent'},active&&s.cardShadow]}>
                  <Text style={{color:active?s.ink:s.muted,fontSize:13,fontWeight:active?'700':'500'}}>{['歌曲','歌手','专辑'][index]!}</Text>
                </Pressable>;
              })}
            </View>
            <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
              {pill('按时长',()=>setSort('duration'),sort==='duration')}
              {pill('按播放次数',()=>setSort('plays'),sort==='plays')}
              {pill(day??'全部日期',()=>setDates(true),!!day)}
            </View>

            {/* Sollin 203-stats-open: 2x2 + 1 metric card grid */}
            {!selected&&<View style={{gap:10}}>
              <View style={{flexDirection:'row',gap:10}}>
                {renderMetricCard(String(summary.songCount),'统计歌曲','musical-note')}
                {renderMetricCard(String(summary.albumCount),'专辑','grid')}
              </View>
              <View style={{flexDirection:'row',gap:10}}>
                {renderMetricCard(String(summary.artistCount),'歌手','person-outline')}
                {renderMetricCard(compactDuration(summary.totalMs),'累计时长','time-outline')}
              </View>
              {renderMetricCard(`${summary.totalPlays} 次`,'累计播放','pulse',false)}
            </View>}

            <View style={{gap:2}}>
              <Text testID="statistics-summary" style={{color:s.ink,fontSize:13,fontWeight:'600',fontVariant:['tabular-nums']}}>{day??(range==='all'?'已保存累计':rangeTitle)} · {listeningDuration(summary.totalMs)} · 播放 {summary.totalPlays} 次</Text>
              <Text testID="statistics-counts" style={{color:s.muted,fontSize:12,fontVariant:['tabular-nums']}}>歌曲 {summary.songCount} · 已知歌手 {summary.artistCount} · 已知专辑 {summary.albumCount}</Text>
            </View>

            {/* Sollin 203-stats-open: 聆听足迹 (90-day heatmap card) */}
            {!selected&&<View style={{borderRadius:18,backgroundColor:softCard,padding:14,gap:10}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                <Text style={{color:s.ink,fontSize:15,fontWeight:'700'}}>聆听足迹</Text>
                <Text style={{color:s.muted,fontSize:12}}>近 90 天</Text>
              </View>
              <View style={{flexDirection:'row',gap:4,alignItems:'stretch'}}>
                <View style={{justifyContent:'space-between',paddingVertical:1,marginRight:2}}>
                  {Array.from({length:7},(_,d)=><Text key={d} style={{color:s.subtle,fontSize:9.5,lineHeight:14}}>{weekdayMarks[d]??' '}</Text>)}
                </View>
                <View style={{flex:1,flexDirection:'row',gap:3}}>
                  {Array.from({length:13},(_,week)=><View key={week} style={{flex:1,alignItems:'center',gap:3}}>
                    {calendar.slice(week*7,week*7+7).map(value=>{
                      const ratio=value.listenedMs===null?0:Math.sqrt(value.listenedMs/maximumDay);
                      const bg=value.listenedMs===null?(s.dark?'rgba(255,255,255,0.06)':'rgba(232,61,86,0.08)'):s.accent;
                      const alpha=value.listenedMs===null?1:Math.min(1,0.28+0.72*ratio);
                      return <View key={value.date} accessible={value.listenedMs!==null} accessibilityLabel={`${value.date} · ${value.listenedMs===null?'未记录分时明细':listeningDuration(value.listenedMs)}`} style={{width:'100%',aspectRatio:1,maxWidth:15,borderRadius:4,backgroundColor:bg,opacity:alpha}}/>;
                    })}
                  </View>)}
                </View>
              </View>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                <Text style={{color:s.subtle,fontSize:10.5,fontVariant:['tabular-nums']}}>{calendar[0]!.date} — {calendar[89]!.date}</Text>
                <View style={{flexDirection:'row',alignItems:'center',gap:3}}>
                  <Text style={{color:s.subtle,fontSize:10.5}}>少</Text>
                  {[0.14,0.34,0.56,0.78,1].map((op,idx)=><View key={idx} style={{width:10,height:10,borderRadius:3,backgroundColor:s.accent,opacity:op}}/>)}
                  <Text style={{color:s.subtle,fontSize:10.5}}>多</Text>
                </View>
              </View>
            </View>}

            {/* Sollin 204-stats-scroll-lower: 播放时段 (24h distribution card) */}
            {!selected&&<View style={{borderRadius:18,backgroundColor:softCard,padding:14,gap:10}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                <Text style={{color:s.ink,fontSize:15,fontWeight:'700'}}>播放时段</Text>
                <Text style={{color:s.muted,fontSize:12,fontVariant:['tabular-nums']}}>高峰 {peakHour}</Text>
              </View>
              <View style={{height:76,flexDirection:'row',gap:2,alignItems:'flex-end'}}>
                {summary.hours.map((hour,index)=><View key={index} accessible accessibilityLabel={`${index}时 · ${listeningDuration(hour.listenedMs)} · 播放 ${hour.playCount} 次`} style={{flex:1,minWidth:0,justifyContent:'flex-end',alignItems:'center',gap:4}}>
                  <View style={{width:'72%',height:hour.listenedMs?Math.max(4,54*hour.listenedMs/maximumHour):2,backgroundColor:hour.listenedMs?s.accent:(s.dark?'rgba(255,255,255,0.10)':'rgba(232,61,86,0.14)'),borderRadius:3}}/>
                  <Text style={{color:s.subtle,fontSize:9.5,fontVariant:['tabular-nums']}}>{index%6===0?String(index).padStart(2,'0'):' '}</Text>
                </View>)}
              </View>
            </View>}

            {/* Sollin 204-stats-scroll-lower: 音质构成 card when quality metadata exists */}
            {!selected&&qualityBreakdown.total>0&&<View style={{borderRadius:18,backgroundColor:softCard,padding:14,gap:10}}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                <Text style={{color:s.ink,fontSize:15,fontWeight:'700'}}>音质构成</Text>
                <Text style={{color:s.muted,fontSize:12}}>{qualityBreakdown.entries.length} 种音质 · 无损 {qualityBreakdown.losslessRatio}%</Text>
              </View>
              <View style={{gap:7}}>
                {qualityBreakdown.entries.map(([q,cnt])=>{
                  const pct=Math.round(cnt/qualityBreakdown.total*1000)/10;
                  return <View key={q} style={{gap:4}}>
                    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                      <View style={{flexDirection:'row',alignItems:'center',gap:6}}><View style={{width:7,height:7,borderRadius:3.5,backgroundColor:s.accent}}/><Text style={{color:s.ink,fontSize:13,fontWeight:'600'}}>{q}</Text></View>
                      <Text style={{color:s.muted,fontSize:12,fontVariant:['tabular-nums']}}>{cnt} 首 · {pct}%</Text>
                    </View>
                    <View style={{height:5,borderRadius:2.5,backgroundColor:s.accentSoft,overflow:'hidden'}}><View style={{width:`${Math.max(4,pct)}%`,height:'100%',borderRadius:2.5,backgroundColor:s.accent}}/></View>
                  </View>;
                })}
              </View>
            </View>}

            <Text style={{color:s.subtle,fontSize:11.5,lineHeight:17}}>分时按设备本地时间记录；播放次数按起播计。旧记录及超出明细保留上限的数据只计累计，不补造分布。专辑按名称与艺术家分组。</Text>
            {(summary.undatedMs>0||summary.undatedPlays>0)&&<Text testID="statistics-undated" style={{color:s.muted,fontSize:12}}>未分时累计 {listeningDuration(summary.undatedMs)} · {summary.undatedPlays} 次</Text>}
          </View>} ListEmptyComponent={<Text style={{paddingVertical:space.xxl,color:s.muted,textAlign:'center',fontSize:13.5}}>暂无此范围的听歌统计，实际播放后会出现在这里。</Text>} showsVerticalScrollIndicator={false}/>

          {!!message&&<Text accessibilityLiveRegion="polite" style={{color:s.accent,fontSize:13}}>{message}</Text>}
          <Pressable accessibilityRole="button" disabled={busy} onPress={clear} style={{minHeight:42,borderRadius:21,backgroundColor:s.accentSoft,alignItems:'center',justifyContent:'center',opacity:busy?.45:1}}>
            <Text style={{color:s.accent,fontSize:13.5,fontWeight:'600'}}>清空本机听歌统计</Text>
          </Pressable>

          <Modal visible={dates} animationType="slide" onRequestClose={()=>setDates(false)}>
            <View style={{flex:1,backgroundColor:s.sheetGradient[0]}}>
              <LinearGradient pointerEvents="none" colors={[...s.sheetGradient]} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
              <View style={{flex:1,paddingTop:insets.top,paddingBottom:insets.bottom+space.md}}>
                <View style={{minHeight:52,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:s.hairline}}>
                  <Pressable accessibilityRole="button" accessibilityLabel="取消选择日期" onPress={()=>setDates(false)} style={{position:'absolute',left:8,width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center'}}>
                    <Ionicons name="chevron-back" size={26} color={s.ink}/>
                  </Pressable>
                  <Text accessibilityRole="header" style={{color:s.ink,fontSize:19,fontWeight:'700'}}>按日期筛选</Text>
                </View>
                <View style={{flex:1,padding:space.xl,paddingLeft:Math.max(space.xl,insets.left+space.md),paddingRight:Math.max(space.xl,insets.right+space.md),gap:10}}>
                  {pill('全部日期',()=>{setDay(undefined);setSelected(undefined);setDates(false);},!day)}
                  <FlatList data={fullSummary.days} keyExtractor={item=>item.date} contentContainerStyle={{gap:8,paddingTop:4}} renderItem={({item})=>pill(`${item.date} · ${listeningDuration(item.listenedMs)}`,()=>{setDay(item.date);setRange('all');setSelected(undefined);setDates(false);},day===item.date)} showsVerticalScrollIndicator={false}/>
                </View>
              </View>
            </View>
          </Modal>
          </View>
        </View>
      </View>
    </Modal>
  </>;
}
