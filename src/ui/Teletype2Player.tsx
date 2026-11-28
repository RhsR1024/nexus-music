import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View, type ViewProps } from 'react-native';
import { requireNativeView } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import { move, remove, select } from '../domain/queue.ts';
import { trackKey, type Track } from '../domain/track.ts';
import { displayLyricIndex, lyricLineProgress } from '../lyrics/parser.ts';
import { lyricOffset } from '../lyrics/settings.ts';
import { convertLyricScript } from '../lyrics/chineseScript.ts';
import { Modal } from './AdaptiveModal.tsx';
import { useLyricDocument } from './Lyrics.tsx';
import { PlaybackProgress } from './PlaybackProgress.tsx';
import { SliderControl } from './SliderControl.tsx';
import { Text } from './Typography.tsx';

const NativeLocalCanvas = requireNativeView<
  ViewProps & {
    html: string;
    assetsJson?: string;
    stateJson: string;
    onAction?: (event: { nativeEvent: Record<string, unknown> }) => void;
  }
>('NexusNative', 'LocalCanvas');

interface Teletype2Params {
  paperTone: 'cream' | 'kraft' | 'greenbar';
  inkDensity: number;
  ribbonWear: number;
  fontSize: number;
  redChorusRibbon: boolean;
  showTimestamps: boolean;
  showTranslation: boolean;
}

const DEFAULT_PARAMS: Teletype2Params = {
  paperTone: 'cream',
  inkDensity: 0.88,
  ribbonWear: 0.18,
  fontSize: 15,
  redChorusRibbon: true,
  showTimestamps: true,
  showTranslation: true,
};

const TELETYPE2_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#151312;touch-action:none;user-select:none;-webkit-user-select:none;}
  canvas{display:block;width:100%;height:100%;}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
(function(){
  var canvas=document.getElementById('c'),ctx=canvas.getContext('2d');
  var dpr=Math.min(window.devicePixelRatio||1,2.2),W=360,H=420;
  var state={
    title:'',artist:'',playing:false,position:0,duration:180,energy:0,
    activeIndex:0,lineProgress:0,lines:[],
    params:{paperTone:'cream',inkDensity:0.88,ribbonWear:0.18,fontSize:15,redChorusRibbon:true,showTimestamps:true,showTranslation:true}
  };
  var scrollY=0,needle=0.15,carriageX=0,lastNow=performance.now(),pausedLoop=false,rafId=0;

  function resize(){
    W=window.innerWidth||360;H=window.innerHeight||420;
    canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function fmtTime(ms){
    var s=Math.max(0,Math.floor(ms/1000));
    var m=Math.floor(s/60),r=s%60;
    return '['+(m<10?'0':'')+m+':'+(r<10?'0':'')+r+']';
  }

  function draw(now){
    if(pausedLoop){rafId=0;return;}
    var dt=Math.min(0.05,(now-lastNow)/1000);lastNow=now;
    var p=state.params;
    var fasciaH=76;
    var paperTop=8,paperBottom=H-fasciaH+4;
    var paperMargin=10,paperW=W-paperMargin*2,paperH=Math.max(80,paperBottom-paperTop);

    // Dark mechanical chassis backdrop
    ctx.fillStyle='#141211';ctx.fillRect(0,0,W,H);

    // Continuous perforated tractor-feed paper sheet
    var pBg=p.paperTone==='kraft'?'#E4D2B4':p.paperTone==='greenbar'?'#EEF4E8':'#F5EDD8';
    var pStripe=p.paperTone==='kraft'?'rgba(128,92,48,0.065)':p.paperTone==='greenbar'?'rgba(56,132,76,0.085)':'rgba(150,126,92,0.06)';
    ctx.save();
    ctx.beginPath();
    ctx.roundRect?ctx.roundRect(paperMargin,paperTop,paperW,paperH,8):ctx.rect(paperMargin,paperTop,paperW,paperH);
    ctx.fillStyle=pBg;ctx.fill();ctx.clip();

    // Subtle tractor feed paper stripes & vertical perf lines
    var lines=state.lines||[];
    var rowStep=(p.fontSize||15)*(p.showTranslation?2.8:2.1);
    var targetScroll=Math.max(0,state.activeIndex*rowStep);
    scrollY+=(targetScroll-scrollY)*Math.min(1,dt*7.5);

    var stripeH=26;
    var stripeOff=-(scrollY%(stripeH*2));
    ctx.fillStyle=pStripe;
    for(var sy=paperTop+stripeOff;sy<paperBottom;sy+=stripeH*2){
      ctx.fillRect(paperMargin+24,sy,paperW-48,stripeH);
    }

    // Left & right perforation divider rules
    ctx.strokeStyle='rgba(120,104,84,0.22)';ctx.lineWidth=1;ctx.setLineDash([3,3]);
    ctx.beginPath();
    ctx.moveTo(paperMargin+24,paperTop);ctx.lineTo(paperMargin+24,paperBottom);
    ctx.moveTo(paperMargin+paperW-24,paperTop);ctx.lineTo(paperMargin+paperW-24,paperBottom);
    ctx.stroke();ctx.setLineDash([]);

    // Scrolling sprocket holes along left & right edges
    var holePitch=20;
    var holeOff=-(scrollY%holePitch);
    for(var hy=paperTop+holeOff;hy<paperBottom+holePitch;hy+=holePitch){
      [paperMargin+12,paperMargin+paperW-12].forEach(function(hx){
        ctx.beginPath();ctx.arc(hx,hy,4.1,0,Math.PI*2);
        ctx.fillStyle='#1C1917';ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.22)';ctx.lineWidth=0.7;ctx.stroke();
      });
    }

    // Print header masthead on paper top
    var baselineY=paperBottom-34;
    var inkAlpha=Math.max(0.35,Math.min(1,p.inkDensity||0.88));
    var fSize=p.fontSize||15;
    var textLeft=paperMargin+34,textMaxW=paperW-68;

    // Render printed lyrics scrolling up from the strike line
    var activeCursorX=textLeft;
    for(var i=0;i<=Math.min(lines.length-1,state.activeIndex);i++){
      var item=lines[i];
      var y=baselineY-(state.activeIndex-i)*rowStep+(targetScroll-scrollY);
      if(y<paperTop-40||y>paperBottom+24)continue;
      var isAct=i===state.activeIndex;
      var fullText=(p.showTimestamps?fmtTime(item.ms)+' ':'')+(item.t||'');
      var visibleText=isAct?fullText.slice(0,Math.max(1,Math.ceil(fullText.length*Math.max(0.06,state.lineProgress)))):fullText;

      var isRed=p.redChorusRibbon&&item.c;
      var wearJitter=p.ribbonWear?(Math.sin(i*13.7)*p.ribbonWear*0.22):0;
      var alpha=Math.max(0.28,Math.min(1,inkAlpha-wearJitter))*(isAct?1:0.78);

      ctx.font=(isAct?'700 ':'600 ')+fSize+'px "Courier New",Menlo,monospace';
      ctx.fillStyle=isRed?'rgba(176,42,36,'+alpha.toFixed(2)+')':'rgba(34,28,24,'+alpha.toFixed(2)+')';
      ctx.textBaseline='alphabetic';
      ctx.fillText(visibleText,textLeft,y,textMaxW);

      if(isAct){
        var measured=Math.min(textMaxW,ctx.measureText(visibleText).width);
        activeCursorX=textLeft+measured;
        // Strike block cursor
        if(state.playing&&Math.floor(now/260)%2===0){
          ctx.fillStyle=isRed?'#B82B24':'#1E1916';
          ctx.fillRect(activeCursorX+2,y-fSize*0.82,7,fSize*0.92);
        }
      }
      if(p.showTranslation&&item.tr&&(i<state.activeIndex||state.lineProgress>0.72)){
        ctx.font='500 '+Math.max(11,fSize-3)+'px "Courier New",Menlo,monospace';
        ctx.fillStyle='rgba(92,82,72,'+(alpha*0.76).toFixed(2)+')';
        ctx.fillText('  '+item.tr,textLeft,y+fSize*1.12,textMaxW);
      }
    }

    // Subtle paper exit shadow near dark platen bar
    var sh=ctx.createLinearGradient(0,paperBottom-28,0,paperBottom);
    sh.addColorStop(0,'rgba(20,16,12,0)');sh.addColorStop(1,'rgba(20,16,12,0.30)');
    ctx.fillStyle=sh;ctx.fillRect(paperMargin,paperBottom-28,paperW,28);
    ctx.restore();

    // Moving mechanical print-head carriage bar above fascia
    carriageX+=(activeCursorX-carriageX)*Math.min(1,dt*14);
    var headY=paperBottom-4;
    ctx.fillStyle='#2B2725';ctx.fillRect(paperMargin+18,headY-2,paperW-36,4);
    ctx.fillStyle='#4C4642';
    ctx.beginPath();ctx.roundRect?ctx.roundRect(Math.max(paperMargin+24,Math.min(W-paperMargin-46,carriageX-11)),headY-9,22,13,3):ctx.rect(carriageX-11,headY-9,22,13);ctx.fill();
    ctx.fillStyle='#B9312A';ctx.fillRect(Math.max(paperMargin+28,Math.min(W-paperMargin-42,carriageX-7)),headY-5,14,3);

    // Dark Model 33 Teletype Fascia Plate
    var fy=paperBottom+4;
    var fg=ctx.createLinearGradient(0,fy,0,H);
    fg.addColorStop(0,'#262321');fg.addColorStop(1,'#141211');
    ctx.fillStyle=fg;ctx.fillRect(0,fy,W,H-fy);
    ctx.strokeStyle='rgba(255,255,255,0.12)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(0,fy);ctx.lineTo(W,fy);ctx.stroke();

    // Left engraved badge: LN 08/47 · MODEL 33 · TELETYPE
    var lnNum=String(Math.min(lines.length,state.activeIndex+1)).padStart(2,'0');
    var lnTot=String(Math.max(1,lines.length)).padStart(2,'0');
    ctx.font='700 10.5px "Courier New",Menlo,monospace';
    ctx.fillStyle='#9C948A';ctx.textBaseline='middle';
    ctx.fillText('LN '+lnNum+'/'+lnTot+'  ·  MODEL 33  ·  TELETYPE',18,fy+24);

    // Status LED + track line
    ctx.beginPath();ctx.arc(24,fy+48,4,0,Math.PI*2);
    ctx.fillStyle=state.playing?'#44DF7C':'#B65446';ctx.fill();
    ctx.font='600 11px "Courier New",Menlo,monospace';
    ctx.fillStyle='#D6CFC5';
    ctx.fillText((state.playing?'RX LIVE':'STANDBY')+' · '+(state.title||'READY').slice(0,22),36,fy+48);

    // Right analog SIGNAL VU needle meter
    var mx=W-94,my=fy+12,mw=78,mh=48;
    ctx.fillStyle='#ECE2C8';
    ctx.strokeStyle='#4A433D';ctx.lineWidth=2;
    ctx.beginPath();ctx.roundRect?ctx.roundRect(mx,my,mw,mh,6):ctx.rect(mx,my,mw,mh);ctx.fill();ctx.stroke();
    // Scale arc
    ctx.strokeStyle='#3C342E';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(mx+mw/2,my+mh-4,26,-Math.PI*0.82,-Math.PI*0.18);ctx.stroke();
    ctx.strokeStyle='#C2362C';ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(mx+mw/2,my+mh-4,26,-Math.PI*0.34,-Math.PI*0.18);ctx.stroke();
    ctx.font='700 7.5px -apple-system,sans-serif';ctx.fillStyle='#3A322C';
    ctx.fillText('SIGNAL',mx+mw/2-15,my+mh-14);
    var targetNeedle=state.playing?Math.min(0.95,0.25+state.energy*0.75+Math.sin(now*0.015)*0.12):0.06;
    needle+=(targetNeedle-needle)*Math.min(1,dt*10);
    var nAng=-Math.PI*0.80+needle*(Math.PI*0.60);
    ctx.strokeStyle='#B82D24';ctx.lineWidth=1.6;
    ctx.beginPath();
    ctx.moveTo(mx+mw/2,my+mh-4);
    ctx.lineTo(mx+mw/2+Math.cos(nAng)*28,my+mh-4+Math.sin(nAng)*28);
    ctx.stroke();
    ctx.beginPath();ctx.arc(mx+mw/2,my+mh-4,3,0,Math.PI*2);ctx.fillStyle='#221E1B';ctx.fill();

    rafId=requestAnimationFrame(draw);
  }

  window.nexusCanvas={
    setAssets:function(next){
      if(!next||typeof next!=='object')return;
      if(typeof next.title==='string')state.title=next.title;
      if(typeof next.artist==='string')state.artist=next.artist;
      if(Array.isArray(next.lines))state.lines=next.lines;
    },
    setState:function(next){
      if(!next||typeof next!=='object')return;
      state=Object.assign(state,next);
    },
    setPaused:function(flag){
      pausedLoop=!!flag;
      if(pausedLoop&&rafId){cancelAnimationFrame(rafId);rafId=0;}
      else if(!pausedLoop&&!rafId){lastNow=performance.now();rafId=requestAnimationFrame(draw);}
    }
  };
  window.addEventListener('resize',resize);
  resize();
  rafId=requestAnimationFrame(draw);
})();
</script>
</body>
</html>`;

export function Teletype2Player({
  services,
  track,
  favoriteTrack,
  lyricTrack,
  onMore,
}: {
  services: Services;
  track: Track;
  favoriteTrack: Track;
  lyricTrack: Track;
  onMore: () => void;
}) {
  const insets = useSafeAreaInsets();
  const state = useSyncExternalStore(services.playback.controller.subscribe, services.playback.controller.getSnapshot);
  const spectrum = useSyncExternalStore(services.playback.spectrum.subscribe, services.playback.spectrum.getSnapshot);
  const preferences = useSyncExternalStore(services.preferences.subscribe, services.preferences.getSnapshot);
  useSyncExternalStore(services.songFavorites.subscribe, services.songFavorites.getSnapshot);

  const [params, setParams] = useState<Teletype2Params>(DEFAULT_PARAMS);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  const key = trackKey(lyricTrack.origin);
  const { value: lyricResult } = useLyricDocument(services, lyricTrack);
  const doc = lyricResult?.document ?? null;

  const offset = lyricOffset(preferences.lyricOffsetMs, preferences.lyricOffsets, key);
  const playing = state.intent === 'playing' && !state.buffering;
  const posMs = state.position * 1000;
  const activeIdx = useMemo(() => {
    if (!doc?.synced || !doc.lines.length) return 0;
    return Math.max(0, displayLyricIndex(doc.lines, posMs, offset));
  }, [doc, posMs, offset]);

  const lineProgress = useMemo(() => {
    if (!doc?.synced || !doc.lines.length) return 1;
    const cur = doc.lines[activeIdx];
    if (!cur) return 1;
    return Math.max(0.05, lyricLineProgress(cur, posMs - offset, doc.lines[activeIdx + 1]?.startMs));
  }, [doc, activeIdx, posMs, offset]);

  const canvasLines = useMemo(() => {
    const raw = doc?.synced
      ? doc.lines.map(l => ({ ms: l.startMs, t: convertLyricScript(l.text, preferences.lyricChineseMode), tr: l.translation ? convertLyricScript(l.translation, preferences.lyricChineseMode) : '' }))
      : (doc?.plain ?? []).slice(0, 120).map((t, idx) => ({ ms: idx * 3500, t: convertLyricScript(t, preferences.lyricChineseMode), tr: '' }));
    const counts = new Map<string, number>();
    for (const item of raw) {
      const k = item.t.trim().toLowerCase();
      if (k.length >= 4) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return raw.map(item => ({ ...item, c: (counts.get(item.t.trim().toLowerCase()) ?? 0) >= 2 }));
  }, [doc, preferences.lyricChineseMode]);

  const energy = spectrum.bands.length
    ? spectrum.bands.slice(0, 8).reduce((a, b) => a + b, 0) / 8
    : playing ? 0.42 : 0;

  const assetsJson = useMemo(() => JSON.stringify({
    title: track.title,
    artist: track.artist,
    lines: canvasLines,
  }), [track.title, track.artist, canvasLines]);

  const stateJson = useMemo(() => JSON.stringify({
    playing,
    energy: Math.round(energy * 20) / 20,
    activeIndex: activeIdx,
    lineProgress: Math.round(lineProgress * 25) / 25,
    params,
  }), [playing, Math.round(energy * 10), activeIdx, Math.round(lineProgress * 25), params]);

  const isFav = services.songFavorites.isFavorite(favoriteTrack);
  const togglePlay = () => {
    if (state.intent === 'playing') services.playback.controller.pause();
    else void services.playback.controller.play();
  };

  const metalRound = (icon: React.ComponentProps<typeof Ionicons>['name'], label: string, onPress: () => void, testID?: string) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#2B2826',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={17} color="#E6E0D6" />
    </Pressable>
  );

  const keycap = (
    label: string,
    onPress: () => void,
    variant: 'dark' | 'cream' | 'red' = 'dark',
    flex = 1,
    icon?: React.ComponentProps<typeof Ionicons>['name'],
  ) => {
    const bg = variant === 'cream' ? '#EFE6D2' : variant === 'red' ? '#9B352D' : '#2C2826';
    const ink = variant === 'cream' ? '#1E1A17' : '#F4EEE6';
    const border = variant === 'cream' ? '#CFC3AA' : variant === 'red' ? '#C05046' : '#453F3B';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={{
          flex,
          minHeight: 48,
          borderRadius: 12,
          backgroundColor: bg,
          borderWidth: 1,
          borderBottomWidth: 3.5,
          borderColor: border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingHorizontal: 10,
        }}
      >
        {icon && <Ionicons name={icon} size={17} color={ink} />}
        <Text numberOfLines={1} style={{ color: ink, fontSize: 13.5, fontWeight: '700' }}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View testID="teletype2-player" style={{ flex: 1, backgroundColor: '#141211', paddingTop: Math.max(insets.top + 8, 52), paddingBottom: Math.max(insets.bottom + 12, 20) }}>
      {/* Top mechanical header with recessed song plaque & 3 metallic buttons */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 62, paddingRight: 12, gap: 8, paddingBottom: 8, zIndex: 3 }}>
        <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#0D0C0B', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center' }}>
          <Text numberOfLines={1} style={{ color: '#EFE9DF', fontSize: 14.5, fontWeight: '700' }}>{track.title}</Text>
          <Text numberOfLines={1} style={{ color: '#9C948A', fontSize: 11.5 }}>{track.artist}</Text>
        </View>
        {metalRound('options-outline', '打字机参数', () => setParamsOpen(true), 'teletype2-params-open')}
        {metalRound('document-text-outline', '完整纸带歌词', () => setLyricsOpen(true))}
        {metalRound('list-outline', '纸带播放队列', () => setQueueOpen(true), 'teletype2-queue-open')}
      </View>

      {/* High-DPI Tractor-Feed Paper + Model 33 Fascia + Analog VU Meter Canvas */}
      <View style={{ flex: 1, minHeight: 240 }}>
        <NativeLocalCanvas html={TELETYPE2_HTML} assetsJson={assetsJson} stateJson={stateJson} style={StyleSheet.absoluteFill} />
      </View>

      {/* Tactile 3D Mechanical Bottom Console */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 12, backgroundColor: '#191614', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
        <PlaybackProgress services={services} adaptive variant="stage" />

        {/* 4 Beveled Mechanical Keycaps: |< | 暂停/播放 | >| | 从头 */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {keycap('上一首', () => services.playback.next(-1), 'dark', 0.85, 'play-skip-back')}
          {keycap(state.intent === 'playing' ? '暂停' : '播放', togglePlay, 'cream', 1.5, state.intent === 'playing' ? 'pause' : 'play')}
          {keycap('下一首', () => services.playback.next(), 'dark', 0.85, 'play-skip-forward')}
          {keycap('从头', () => services.playback.controller.seek(0), 'red', 0.9, 'refresh')}
        </View>

        {/* Utility row: ♡ | 0.5x 1x 1.5x | ... */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFav ? '取消收藏' : '收藏歌曲'}
            onPress={() => { void services.songFavorites.toggle(favoriteTrack).catch(() => Alert.alert('收藏未保存')); }}
            style={{ width: 42, height: 36, borderRadius: 10, backgroundColor: '#262321', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={18} color={isFav ? '#E25852' : '#D9D2C8'} />
          </Pressable>

          <View style={{ flexDirection: 'row', backgroundColor: '#0E0D0C', borderRadius: 10, padding: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', gap: 4 }}>
            {[0.5, 1, 1.5].map(rate => {
              const active = Math.abs(preferences.rate - rate) < 0.05;
              return (
                <Pressable
                  key={rate}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => { void services.playback.setRate(rate).catch(() => {}); }}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 7, backgroundColor: active ? '#EFE6D2' : 'transparent' }}
                >
                  <Text style={{ color: active ? '#1C1917' : '#A69F95', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{rate}x</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="更多播放控制"
            onPress={onMore}
            style={{ width: 42, height: 36, borderRadius: 10, backgroundColor: '#262321', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color="#D9D2C8" />
          </Pressable>
        </View>
      </View>

      {/* 打字机参数 Dark Sheet */}
      <Modal visible={paramsOpen} animationType="slide" transparent onRequestClose={() => setParamsOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.56)' }}>
          <View style={{ maxHeight: '76%', backgroundColor: '#1C1A18', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: Math.max(insets.bottom + 20, 28) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 }}>
              <Text style={{ color: '#F5EFE6', fontSize: 18, fontWeight: '700' }}>打字机参数</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Pressable accessibilityRole="button" onPress={() => setParams(DEFAULT_PARAMS)}>
                  <Text style={{ color: '#A59E94', fontSize: 13.5, fontWeight: '600' }}>重置</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setParamsOpen(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 15, paddingBottom: 16 }}>
              <View style={{ gap: 8 }}>
                <Text style={{ color: '#A59E94', fontSize: 13 }}>纸张材质</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {([['cream', '米白打孔纸'], ['kraft', '复古牛皮纸'], ['greenbar', '绿条计算机纸']] as const).map(([id, label]) => {
                    const sel = params.paperTone === id;
                    return (
                      <Pressable key={id} accessibilityRole="radio" accessibilityState={{ selected: sel }} onPress={() => setParams(p => ({ ...p, paperTone: id }))} style={{ flex: 1, minHeight: 38, borderRadius: 12, backgroundColor: sel ? '#EFE6D2' : 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
                        <Text numberOfLines={1} style={{ color: sel ? '#1C1917' : '#E5DED3', fontSize: 12, fontWeight: '700' }}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <SliderControl testID="teletype2-ink" label="墨迹浓度" value={params.inkDensity} min={0.45} max={1} step={0.05} format={v => `${Math.round(v * 100)}%`} onChange={inkDensity => setParams(p => ({ ...p, inkDensity }))} />
              <SliderControl testID="teletype2-wear" label="色带磨损" value={params.ribbonWear} min={0} max={0.6} step={0.05} format={v => `${Math.round(v * 100)}%`} onChange={ribbonWear => setParams(p => ({ ...p, ribbonWear }))} />
              <SliderControl testID="teletype2-font" label="字符字号" value={params.fontSize} min={12} max={20} step={1} format={v => `${Math.round(v)}pt`} onChange={fontSize => setParams(p => ({ ...p, fontSize }))} />

              {([
                ['redChorusRibbon', '副歌红色色带', '重复副歌自动切换经典红色双色色带敲击'],
                ['showTimestamps', '打印时间戳', '每行歌词前打印电传时间码 [mm:ss]'],
                ['showTranslation', '打印译文', '在原文下方以淡墨打印双语译文'],
              ] as const).map(([field, title, sub]) => (
                <View key={field} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: '#F5EFE6', fontSize: 14.5, fontWeight: '600' }}>{title}</Text>
                    <Text style={{ color: '#948D84', fontSize: 12 }}>{sub}</Text>
                  </View>
                  <Switch value={params[field]} onValueChange={v => setParams(p => ({ ...p, [field]: v }))} />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Perforated Paper-Tape Queue Sheet (Sollin Screenshot 7) */}
      <Modal visible={queueOpen} animationType="slide" transparent onRequestClose={() => setQueueOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.56)' }}>
          <View style={{ height: '74%', backgroundColor: '#F4ECDA', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 14, paddingBottom: Math.max(insets.bottom + 14, 22) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(80,68,54,0.2)' }}>
              <Text style={{ color: '#241F1B', fontSize: 16, fontWeight: '800' }}>TAPE QUEUE · 播放队列 ({state.queue.entries.length})</Text>
              <Pressable accessibilityRole="button" onPress={() => setQueueOpen(false)} style={{ padding: 6 }}>
                <Ionicons name="close" size={20} color="#241F1B" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8, gap: 6 }}>
              {state.queue.entries.map((entry, idx) => {
                const cur = entry.id === state.queue.currentId;
                return (
                  <View key={entry.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, backgroundColor: cur ? 'rgba(176,42,36,0.10)' : 'transparent', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(80,68,54,0.16)' }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cur ? '#B82B24' : '#352F2A' }} />
                    <Pressable accessibilityRole="button" onPress={() => { void services.playback.controller.play(select(state.queue, entry.id)); }} style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ color: cur ? '#B82B24' : '#241F1B', fontSize: 14, fontWeight: cur ? '800' : '600' }}>
                        {String(idx + 1).padStart(2, '0')} · {entry.track.title}
                      </Text>
                      <Text numberOfLines={1} style={{ color: '#70665B', fontSize: 11.5 }}>{entry.track.artist}</Text>
                    </Pressable>
                    {idx > 0 && (
                      <Pressable accessibilityRole="button" accessibilityLabel="上移" onPress={() => services.playback.controller.setQueue(move(state.queue, entry.id, idx - 1))} style={{ padding: 5 }}>
                        <Ionicons name="arrow-up" size={15} color="#4F473E" />
                      </Pressable>
                    )}
                    {idx < state.queue.entries.length - 1 && (
                      <Pressable accessibilityRole="button" accessibilityLabel="下移" onPress={() => services.playback.controller.setQueue(move(state.queue, entry.id, idx + 1))} style={{ padding: 5 }}>
                        <Ionicons name="arrow-down" size={15} color="#4F473E" />
                      </Pressable>
                    )}
                    <Pressable accessibilityRole="button" accessibilityLabel="移出队列" onPress={() => services.playback.controller.setQueue(remove(state.queue, entry.id))} style={{ padding: 5 }}>
                      <Ionicons name="close" size={16} color="#9B352D" />
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(80,68,54,0.2)' }}>
              <Pressable accessibilityRole="button" onPress={() => { void services.preferences.update({ shuffle: !preferences.shuffle }); }} style={{ flex: 1, minHeight: 38, borderRadius: 10, backgroundColor: preferences.shuffle ? '#241F1B' : 'rgba(36,31,27,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: preferences.shuffle ? '#F4ECDA' : '#241F1B', fontSize: 13, fontWeight: '700' }}>随机：{preferences.shuffle ? '开' : '关'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setQueueOpen(false)} style={{ flex: 1, minHeight: 38, borderRadius: 10, backgroundColor: '#9B352D', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>完成</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Full Paper Lyrics Modal */}
      <Modal visible={lyricsOpen} animationType="slide" transparent onRequestClose={() => setLyricsOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.56)' }}>
          <View style={{ height: '72%', backgroundColor: '#F5EDD8', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 14, paddingBottom: Math.max(insets.bottom + 16, 22) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(80,68,54,0.2)' }}>
              <Text style={{ color: '#241F1B', fontSize: 16, fontWeight: '800' }}>电传完整纸带</Text>
              <Pressable accessibilityRole="button" onPress={() => setLyricsOpen(false)} style={{ padding: 6 }}>
                <Ionicons name="close" size={20} color="#241F1B" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 12 }}>
              {doc?.synced ? doc.lines.map((line, i) => (
                <Pressable key={`${line.startMs}-${i}`} accessibilityRole="button" onPress={() => { services.playback.controller.seek(Math.max(0, (line.startMs + offset) / 1000)); setLyricsOpen(false); }}>
                  <Text style={{ color: i === activeIdx ? '#B82B24' : '#2E2722', fontSize: i === activeIdx ? 16 : 14, fontWeight: i === activeIdx ? '800' : '500' }}>
                    {convertLyricScript(line.text, preferences.lyricChineseMode)}
                  </Text>
                  {!!line.translation && <Text style={{ color: '#786F64', fontSize: 12, marginTop: 2 }}>{line.translation}</Text>}
                </Pressable>
              )) : <Text style={{ color: '#786F64', fontSize: 14 }}>暂无时间轴歌词</Text>}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
