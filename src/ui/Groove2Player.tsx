import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View, type ViewProps } from 'react-native';
import { requireNativeView } from 'expo';
import { File } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import { trackKey, type Track } from '../domain/track.ts';
import type { TrackArtistRef } from '../domain/artistNames.ts';
import { displayLyricIndex, lyricLineProgress } from '../lyrics/parser.ts';
import { lyricOffset } from '../lyrics/settings.ts';
import { convertLyricScript } from '../lyrics/chineseScript.ts';
import { Modal } from './AdaptiveModal.tsx';
import { ClickableArtistLine } from './ClickableArtistLine.tsx';
import { useLyricDocument } from './Lyrics.tsx';
import { PlaybackProgress } from './PlaybackProgress.tsx';
import { SkipGlyph } from './SkipGlyph.tsx';
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

type Groove2Material = 'wood' | 'metal' | 'transparent';
type Groove2SpinMode = 'lyric' | 'constant';

interface Groove2Params {
  material: Groove2Material;
  spinMode: Groove2SpinMode;
  loupe: boolean;
  loupeZoom: number;
  diffraction: number;
  fanWidth: number;
  chorusVinyl: boolean;
  needleBounce: boolean;
  dust: boolean;
  fingerprint: boolean;
}

const DEFAULT_PARAMS: Groove2Params = {
  material: 'wood',
  spinMode: 'lyric',
  loupe: true,
  loupeZoom: 2.5,
  diffraction: 0.55,
  fanWidth: 0.45,
  chorusVinyl: true,
  needleBounce: true,
  dust: true,
  fingerprint: true,
};

const GROOVE2_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
  html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;touch-action:none;user-select:none;-webkit-user-select:none;}
  canvas{display:block;width:100%;height:100%;}
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
(function(){
  var canvas=document.getElementById('c'),ctx=canvas.getContext('2d');
  var dpr=Math.min(window.devicePixelRatio||1,2.2),W=360,H=460;
  var state={
    title:'',artist:'',playing:false,position:0,duration:180,energy:0,
    activeIndex:0,lineProgress:0.5,lines:[],chorusSet:{},coverData:'',
    params:{material:'wood',spinMode:'lyric',loupe:true,loupeZoom:2.5,diffraction:0.55,fanWidth:0.45,chorusVinyl:true,needleBounce:true,dust:true,fingerprint:true}
  };
  var coverImg=null,coverSrc='',pausedLoop=false,rafId=0;
  var angle=0,targetAngle=0,lastNow=performance.now();
  var dustMotes=[];
  for(var i=0;i<26;i++)dustMotes.push({a:Math.random()*6.28,r:0.36+Math.random()*0.60,s:0.6+Math.random()*1.4,p:Math.random()*6.28});

  // Pre-build spiral character layout whenever lines change
  var spiralChars=[],lineCharBounds=[],lastLinesKey='';
  function buildSpiralLayout(){
    var lines=state.lines||[];
    var key=lines.length+':'+(lines[0]?lines[0].t:'')+(lines.length>1?lines[lines.length-1].t:'');
    if(key===lastLinesKey)return;
    lastLinesKey=key;
    spiralChars=[];lineCharBounds=[];
    if(!lines.length){
      var fallback=(state.title||'音枢 · 黑胶螺旋槽 2')+'  ·  '+(state.artist||'PURE VINYL GROOVE');
      lines=[{t:fallback,c:false},{t:fallback,c:false},{t:fallback,c:false}];
    }
    var rOuter=0.91,rInner=0.37,turns=5.2;
    var flat=[];
    for(var i=0;i<lines.length;i++){
      var txt=(lines[i].t||'').trim();
      if(!txt)continue;
      var start=flat.length;
      for(var j=0;j<txt.length;j++){
        flat.push({ch:txt[j],line:i,chorus:!!lines[i].c});
      }
      flat.push({ch:' ',line:i,chorus:false});
      flat.push({ch:'·',line:i,chorus:false});
      flat.push({ch:' ',line:i,chorus:false});
      lineCharBounds[i]={start:start,end:flat.length-3};
    }
    if(!flat.length)return;
    // Distribute characters cleanly along Archimedean spiral so adjacent rings stay separated
    var totalTheta=turns*Math.PI*2;
    var step=totalTheta/Math.max(flat.length,110);
    var theta=0;
    for(var k=0;k<flat.length;k++){
      var frac=Math.min(1,k/Math.max(1,flat.length-1));
      var r=rOuter-(rOuter-rInner)*frac;
      var adv=(flat[k].ch.charCodeAt(0)>127?0.062:0.038)/Math.max(0.37,r);
      spiralChars.push({ch:flat[k].ch,line:flat[k].line,chorus:flat[k].chorus,theta:theta,r:r});
      theta+=Math.max(step*0.65,adv);
    }
  }

  function resize(){
    W=window.innerWidth||360;H=window.innerHeight||460;
    canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }

  function drawBackdrop(g){
    var mat=state.params.material;
    if(mat==='transparent'){g.clearRect(0,0,W,H);return;}
    var bg=g.createLinearGradient(0,0,0,H);
    if(mat==='metal'){
      bg.addColorStop(0,'#1D1F24');bg.addColorStop(0.5,'#14161A');bg.addColorStop(1,'#0D0E11');
    }else{
      bg.addColorStop(0,'#1C1510');bg.addColorStop(0.5,'#130E0B');bg.addColorStop(1,'#0C0806');
    }
    g.fillStyle=bg;g.fillRect(0,0,W,H);
    // Subtle brushed grain lines (wood or anodized metal)
    g.save();
    for(var y=0;y<H;y+=3){
      var v=(Math.sin(y*0.37)*0.5+0.5)*0.045;
      g.fillStyle=mat==='metal'?'rgba(255,255,255,'+v.toFixed(3)+')':'rgba(170,118,74,'+(v*0.95).toFixed(3)+')';
      g.fillRect(0,y,W,1.2);
    }
    g.restore();
  }

  function drawDisc(g,cx,cy,R,rot,isLoupe){
    var p=state.params;
    // Outer drop shadow
    if(!isLoupe){
      g.save();
      g.shadowColor='rgba(0,0,0,0.72)';g.shadowBlur=34;g.shadowOffsetY=14;
      g.beginPath();g.arc(cx,cy,R,0,Math.PI*2);g.fillStyle='#09090B';g.fill();
      g.restore();
    }

    // Matte black vinyl body + subtle bevel
    var discG=g.createRadialGradient(cx,cy,R*0.18,cx,cy,R);
    discG.addColorStop(0,'#121316');
    discG.addColorStop(0.35,'#0B0B0D');
    discG.addColorStop(0.95,'#09090C');
    discG.addColorStop(1,'#24262C');
    g.beginPath();g.arc(cx,cy,R,0,Math.PI*2);g.fillStyle=discG;g.fill();

    // Fine concentric vinyl micro-grooves
    g.save();
    g.lineWidth=0.65;
    for(var rr=R*0.35;rr<R*0.97;rr+=4.2){
      g.beginPath();g.arc(cx,cy,rr,0,Math.PI*2);
      g.strokeStyle='rgba(255,255,255,0.042)';g.stroke();
    }
    g.restore();

    // Iridescent diffraction light fan (fixed relative to viewer light source)
    if(p.diffraction>0.02){
      g.save();
      g.beginPath();g.arc(cx,cy,R*0.97,0,Math.PI*2);g.arc(cx,cy,R*0.33,0,Math.PI*2,true);g.clip('evenodd');
      var fanHalf=0.22+p.fanWidth*0.62;
      var fans=[-Math.PI*0.72,Math.PI*0.28];
      for(var f=0;f<fans.length;f++){
        var baseA=fans[f];
        var grad=g.createConicGradient?g.createConicGradient(baseA-fanHalf,cx,cy):null;
        if(grad){
          grad.addColorStop(0,'rgba(255,255,255,0)');
          grad.addColorStop(0.06,'rgba(110,232,178,'+(0.16*p.diffraction).toFixed(3)+')');
          grad.addColorStop(0.11,'rgba(255,255,255,'+(0.22*p.diffraction).toFixed(3)+')');
          grad.addColorStop(0.16,'rgba(130,190,255,'+(0.14*p.diffraction).toFixed(3)+')');
          grad.addColorStop(0.24,'rgba(255,255,255,0)');
          g.fillStyle=grad;g.fillRect(cx-R,cy-R,R*2,R*2);
        }
      }
      g.restore();
    }

    // Subtle fingerprint smudge near outer edge
    if(p.fingerprint){
      g.save();
      g.translate(cx+R*0.62,cy+R*0.42);
      g.rotate(rot+0.8);
      for(var fp=1;fp<=5;fp++){
        g.beginPath();g.ellipse(0,0,fp*4.2,fp*6.2,0.3,0,Math.PI*2);
        g.strokeStyle='rgba(255,255,255,0.028)';g.lineWidth=1.1;g.stroke();
      }
      g.restore();
    }

    // Engraved Archimedean spiral lyrics!
    g.save();
    g.translate(cx,cy);
    g.rotate(rot);
    var active=state.activeIndex;
    var fontSize=Math.max(8.5,R*0.056);
    g.textAlign='center';g.textBaseline='middle';
    for(var k=0;k<spiralChars.length;k++){
      var item=spiralChars[k];
      var isAct=item.line===active;
      var isChorus=p.chorusVinyl&&item.chorus;
      var rPx=item.r*R;
      g.save();
      g.rotate(item.theta);
      g.translate(0,-rPx);
      if(isChorus){
        g.fillStyle=isAct?(isLoupe?'rgba(86,216,130,0.22)':'rgba(108,242,148,0.26)'):(isLoupe?'rgba(78,196,118,0.09)':'rgba(78,196,118,0.14)');
        g.fillRect(-fontSize*0.58,-fontSize*0.64,fontSize*1.16,fontSize*1.28);
      }
      if(isAct){
        g.font='700 '+(fontSize*(isLoupe?1.16:1.08)).toFixed(1)+'px -apple-system,BlinkMacSystemFont,sans-serif';
        g.shadowColor=isLoupe?'rgba(0,0,0,0.65)':(isChorus?'rgba(128,255,168,0.85)':'rgba(255,255,255,0.75)');
        g.shadowBlur=isLoupe?4:5;
        g.fillStyle=isLoupe?'#FFFFFF':(isChorus?'#C8FFD4':'#FFFFFF');
      }else{
        g.font='500 '+fontSize.toFixed(1)+'px -apple-system,BlinkMacSystemFont,sans-serif';
        g.shadowBlur=0;
        g.fillStyle=isLoupe?(isChorus?'rgba(126,232,158,0.28)':'rgba(218,214,206,0.18)'):(isChorus?'rgba(126,232,158,0.54)':'rgba(218,214,206,0.28)');
      }
      g.fillText(item.ch,0,0);
      g.restore();
    }

    // Center artwork label + curved title rim
    var labelR=R*0.305;
    g.beginPath();g.arc(0,0,labelR+6,0,Math.PI*2);g.fillStyle='#101114';g.fill();
    g.strokeStyle='rgba(255,255,255,0.12)';g.lineWidth=1;g.stroke();

    // Curved rim text "Title · Artist" around center label
    var rimTxt=(state.title||'')+(state.artist?' · '+state.artist:'');
    if(rimTxt){
      g.font='600 '+Math.max(7.5,R*0.042).toFixed(1)+'px -apple-system,sans-serif';
      g.fillStyle='rgba(235,232,226,0.72)';
      var rimR=labelR+1.5;
      var span=Math.min(Math.PI*1.3,rimTxt.length*0.085);
      for(var c=0;c<rimTxt.length;c++){
        var a=-span/2+(c/Math.max(1,rimTxt.length-1))*span;
        g.save();g.rotate(a);g.translate(0,-rimR);g.fillText(rimTxt[c],0,0);g.restore();
      }
    }

    // Album cover image inside center label
    g.save();
    g.beginPath();g.arc(0,0,labelR-4,0,Math.PI*2);g.clip();
    if(coverImg&&coverImg.complete&&coverImg.naturalWidth>0){
      g.drawImage(coverImg,-labelR+4,-labelR+4,(labelR-4)*2,(labelR-4)*2);
    }else{
      var cg=g.createLinearGradient(-labelR,-labelR,labelR,labelR);
      cg.addColorStop(0,'#3D4E42');cg.addColorStop(1,'#18211C');
      g.fillStyle=cg;g.fillRect(-labelR,-labelR,labelR*2,labelR*2);
    }
    g.restore();

    // Silver center spindle hole
    g.beginPath();g.arc(0,0,5.2,0,Math.PI*2);g.fillStyle='#C8CCD2';g.fill();
    g.beginPath();g.arc(0,0,2.2,0,Math.PI*2);g.fillStyle='#1A1C20';g.fill();
    g.restore();

    // Outer silver rim glint
    g.beginPath();g.arc(cx,cy,R,0,Math.PI*2);
    g.strokeStyle='rgba(255,255,255,0.12)';g.lineWidth=1.2;g.stroke();

    // Floating dust specks
    if(p.dust&&!isLoupe){
      g.save();
      var t=performance.now()*0.001;
      for(var d=0;d<dustMotes.length;d++){
        var m=dustMotes[d];
        var da=m.a+rot*0.85;
        var dr=m.r*R+(p.needleBounce&&state.playing?Math.sin(t*7+m.p)*state.energy*2.4:0);
        g.fillStyle='rgba(240,235,220,'+(0.12+0.12*Math.sin(t*2+m.p)).toFixed(2)+')';
        g.beginPath();g.arc(cx+Math.cos(da)*dr,cy+Math.sin(da)*dr,m.s,0,Math.PI*2);g.fill();
      }
      g.restore();
    }
  }

  function drawTonearm(g,cx,cy,R,stylusX,stylusY){
    var pivotX=Math.min(W-24,cx+R*0.92);
    var pivotY=Math.max(24,cy-R*0.92);
    // Gimbal base
    g.save();
    g.shadowColor='rgba(0,0,0,0.6)';g.shadowBlur=12;g.shadowOffsetY=5;
    g.beginPath();g.arc(pivotX,pivotY,16,0,Math.PI*2);
    var pg=g.createRadialGradient(pivotX-4,pivotY-4,2,pivotX,pivotY,16);
    pg.addColorStop(0,'#6A6D75');pg.addColorStop(1,'#1C1E22');
    g.fillStyle=pg;g.fill();
    // Counterweight tail
    var armAng=Math.atan2(stylusY-pivotY,stylusX-pivotX);
    g.beginPath();
    g.moveTo(pivotX-Math.cos(armAng)*10,pivotY-Math.sin(armAng)*10);
    g.lineTo(pivotX-Math.cos(armAng)*28,pivotY-Math.sin(armAng)*28);
    g.strokeStyle='#2E3138';g.lineWidth=9;g.lineCap='round';g.stroke();
    // Metallic tonearm tube
    g.beginPath();g.moveTo(pivotX,pivotY);g.lineTo(stylusX,stylusY);
    g.strokeStyle='#DCE0E6';g.lineWidth=3.6;g.lineCap='round';g.stroke();
    g.beginPath();g.moveTo(pivotX,pivotY);g.lineTo(stylusX,stylusY);
    g.strokeStyle='rgba(255,255,255,0.55)';g.lineWidth=1.2;g.stroke();
    // Center pivot cap
    g.beginPath();g.arc(pivotX,pivotY,4.5,0,Math.PI*2);g.fillStyle='#F2F4F7';g.fill();

    // Headshell cartridge + glowing green LED
    g.translate(stylusX,stylusY);
    g.rotate(armAng);
    g.fillStyle='#1C1E22';
    g.strokeStyle='rgba(255,255,255,0.32)';g.lineWidth=1;
    g.beginPath();g.roundRect?g.roundRect(-14,-6,26,12,3):g.rect(-14,-6,26,12);g.fill();g.stroke();
    g.fillStyle=state.playing?'#4DF58E':'#8C929C';
    if(state.playing){g.shadowColor='#4DF58E';g.shadowBlur=10;}
    g.fillRect(-2,-3,10,6);
    g.restore();
  }

  function frame(now){
    if(pausedLoop){rafId=0;return;}
    var dt=Math.min(0.05,(now-lastNow)/1000);
    lastNow=now;
    buildSpiralLayout();

    var p=state.params;
    // Track exact character along active spiral line using word/line progress
    var activeBound=lineCharBounds[state.activeIndex];
    var lp=Math.max(0,Math.min(1,typeof state.lineProgress==='number'?state.lineProgress:0.5));
    var activeCharIdx=activeBound
      ?Math.min(spiralChars.length-1,Math.max(activeBound.start,Math.floor(activeBound.start+(activeBound.end-activeBound.start)*lp)))
      :0;
    var activeChar=spiralChars[activeCharIdx]||{theta:0,r:0.68};
    if(p.spinMode==='lyric'){
      targetAngle=-activeChar.theta;
      var diff=targetAngle-angle;
      while(diff>Math.PI)diff-=Math.PI*2;
      while(diff<-Math.PI)diff+=Math.PI*2;
      angle+=diff*Math.min(1,dt*5.5);
    }else if(state.playing){
      angle=(angle+dt*0.58)%(Math.PI*2);
    }

    var cx=W*0.5,cy=H*0.455,R=Math.min(W*0.47,H*0.44);
    var bounce=(p.needleBounce&&state.playing)?Math.sin(now*0.025)*state.energy*2.0:0;
    var stylusR=(activeChar.r||0.66)*R;
    var liveTheta=activeChar.theta+angle;
    var focusX=cx+Math.sin(liveTheta)*stylusR;
    var focusY=cy-Math.cos(liveTheta)*stylusR;
    var loupeR=Math.min(58,R*0.31);
    var lx=cx-R*0.11;
    var ly=Math.max(cy-R*0.64,Math.min(cy-R*0.34,cy-stylusR*0.72));
    var stylusX=(p.loupe?lx:cx-R*0.06)+bounce;
    var stylusY=(p.loupe?(ly-loupeR-1):(cy-stylusR))+bounce*0.5;

    drawBackdrop(ctx);
    drawDisc(ctx,cx,cy,R,angle,false);

    // Optical Magnifying Glass Loupe: mathematically pins the currently sung character
    // (focusX, focusY) to the exact dead-center (lx, ly) of the circular lens, rotated upright!
    if(p.loupe){
      ctx.save();
      ctx.beginPath();ctx.arc(lx,ly,loupeR,0,Math.PI*2);ctx.clip();
      ctx.fillStyle='#0A0B0D';ctx.fillRect(lx-loupeR,ly-loupeR,loupeR*2,loupeR*2);
      var z=p.loupeZoom||2.5;
      ctx.translate(lx,ly);
      ctx.rotate(-liveTheta);
      ctx.scale(z,z);
      ctx.translate(-focusX,-focusY);
      drawDisc(ctx,cx,cy,R,angle,true);
      ctx.restore();

      // Subtle vertical reading hairline from stylus rim toward lens center + glass reflection bezel
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lx,ly-loupeR+3);
      ctx.lineTo(lx,ly-loupeR*0.34);
      ctx.strokeStyle='rgba(255,255,255,0.42)';ctx.lineWidth=1;ctx.stroke();
      var glass=ctx.createRadialGradient(lx-loupeR*0.30,ly-loupeR*0.30,loupeR*0.08,lx,ly,loupeR);
      glass.addColorStop(0,'rgba(255,255,255,0.22)');
      glass.addColorStop(0.55,'rgba(255,255,255,0.02)');
      glass.addColorStop(1,'rgba(0,0,0,0.38)');
      ctx.beginPath();ctx.arc(lx,ly,loupeR,0,Math.PI*2);ctx.fillStyle=glass;ctx.fill();
      ctx.lineWidth=2.2;ctx.strokeStyle='rgba(220,226,236,0.78)';ctx.stroke();
      ctx.restore();
    }

    drawTonearm(ctx,cx,cy,R,stylusX,stylusY);
    rafId=requestAnimationFrame(frame);
  }

  window.nexusCanvas={
    setAssets:function(next){
      if(!next||typeof next!=='object')return;
      if(typeof next.title==='string')state.title=next.title;
      if(typeof next.artist==='string')state.artist=next.artist;
      if(Array.isArray(next.lines)){state.lines=next.lines;lastLinesKey='';}
      if(typeof next.coverData==='string'&&next.coverData!==coverSrc){
        coverSrc=next.coverData;
        if(coverSrc){var img=new Image();img.src=coverSrc;coverImg=img;}else{coverImg=null;}
      }
    },
    setState:function(next){
      if(!next||typeof next!=='object')return;
      state=Object.assign(state,next);
      if(next.coverData&&next.coverData!==coverSrc){
        coverSrc=next.coverData;
        var img=new Image();img.src=coverSrc;coverImg=img;
      }
    },
    setPaused:function(flag){
      pausedLoop=!!flag;
      if(pausedLoop&&rafId){cancelAnimationFrame(rafId);rafId=0;}
      else if(!pausedLoop&&!rafId){lastNow=performance.now();rafId=requestAnimationFrame(frame);}
    }
  };
  window.addEventListener('resize',resize);
  resize();
  rafId=requestAnimationFrame(frame);
})();
</script>
</body>
</html>`;

export function Groove2Player({
  services,
  track,
  favoriteTrack,
  lyricTrack,
  onMore,
  onQueue,
  onArtistPress,
}: {
  services: Services;
  track: Track;
  favoriteTrack: Track;
  lyricTrack: Track;
  onMore: () => void;
  onQueue: () => void;
  onArtistPress?: (artist: TrackArtistRef) => void;
}) {
  const insets = useSafeAreaInsets();
  const state = useSyncExternalStore(services.playback.controller.subscribe, services.playback.controller.getSnapshot);
  const spectrum = useSyncExternalStore(services.playback.spectrum.subscribe, services.playback.spectrum.getSnapshot);
  const preferences = useSyncExternalStore(services.preferences.subscribe, services.preferences.getSnapshot);
  useSyncExternalStore(services.songFavorites.subscribe, services.songFavorites.getSnapshot);

  const [params, setParams] = useState<Groove2Params>(DEFAULT_PARAMS);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [coverData, setCoverData] = useState('');

  const key = trackKey(lyricTrack.origin);
  const { value: lyricResult } = useLyricDocument(services, lyricTrack);
  const doc = lyricResult?.document ?? null;

  useEffect(() => {
    const abort = new AbortController();
    setCoverData('');
    void services.covers.loadTrack(track, abort.signal, 512).then(async uri => {
      if (abort.signal.aborted || !uri) return;
      try {
        const b64 = await new File(uri).base64();
        if (!abort.signal.aborted && b64) setCoverData(`data:image/jpeg;base64,${b64}`);
      } catch {}
    }).catch(() => {});
    return () => abort.abort();
  }, [services, trackKey(track.origin), track.artwork]);

  const offset = lyricOffset(preferences.lyricOffsetMs, preferences.lyricOffsets, key);
  const playing = state.intent === 'playing' && !state.buffering;
  const posMs = state.position * 1000;
  const activeIdx = useMemo(() => {
    if (!doc?.synced || !doc.lines.length) return 0;
    return Math.max(0, displayLyricIndex(doc.lines, posMs, offset));
  }, [doc, posMs, offset]);

  const lineProgress = useMemo(() => {
    if (!doc?.synced || !doc.lines.length) return 0.5;
    const cur = doc.lines[activeIdx];
    if (!cur) return 0.5;
    return lyricLineProgress(cur, posMs - offset, doc.lines[activeIdx + 1]?.startMs);
  }, [doc, activeIdx, posMs, offset]);

  const canvasLines = useMemo(() => {
    const rawLines = doc?.synced
      ? doc.lines.map(l => convertLyricScript(l.text, preferences.lyricChineseMode))
      : (doc?.plain ?? []).slice(0, 120).map(l => convertLyricScript(l, preferences.lyricChineseMode));
    const counts = new Map<string, number>();
    for (const t of rawLines) {
      const k = t.trim().toLowerCase();
      if (k.length >= 4) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return rawLines.slice(0, 220).map(t => ({
      t,
      c: (counts.get(t.trim().toLowerCase()) ?? 0) >= 2,
    }));
  }, [doc, preferences.lyricChineseMode]);

  const energy = spectrum.bands.length
    ? spectrum.bands.slice(0, 8).reduce((a, b) => a + b, 0) / 8
    : playing ? 0.35 : 0;

  // Heavy static payloads (cover base64 + all engraved lyrics) only transfer once per song/lyric change.
  const assetsJson = useMemo(() => JSON.stringify({
    title: track.title,
    artist: track.artist,
    lines: canvasLines,
    coverData,
  }), [track.title, track.artist, canvasLines, coverData]);

  // Lightweight playback tick state (<200 bytes) keeps WebKit main thread responsive and dead-on synced.
  const clampedActive = canvasLines.length ? Math.min(activeIdx, canvasLines.length - 1) : 0;
  const stateJson = useMemo(() => JSON.stringify({
    playing,
    energy: Math.round(energy * 20) / 20,
    activeIndex: clampedActive,
    lineProgress: Math.round(lineProgress * 25) / 25,
    params,
  }), [playing, Math.round(energy * 10), clampedActive, Math.round(lineProgress * 20), params]);

  const isFav = services.songFavorites.isFavorite(favoriteTrack);
  const togglePlay = () => {
    if (state.intent === 'playing') services.playback.controller.pause();
    else void services.playback.controller.play();
  };

  const pillBtn = (label: string, icon: React.ComponentProps<typeof Ionicons>['name'], active: boolean, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 13,
        minHeight: 34,
        borderRadius: 17,
        backgroundColor: active ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: active ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.16)',
      }}
    >
      <Ionicons name={icon} size={14} color={active ? '#FFFFFF' : 'rgba(255,255,255,0.68)'} />
      <Text style={{ color: active ? '#FFFFFF' : 'rgba(255,255,255,0.78)', fontSize: 12.5, fontWeight: active ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );

  return (
    <View testID="groove2-player" style={{ flex: 1, backgroundColor: params.material === 'transparent' ? 'transparent' : '#0E0B09', paddingTop: Math.max(insets.top + 8, 52), paddingBottom: Math.max(insets.bottom + 12, 22) }}>
      {/* Top header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 62, paddingRight: 14, minHeight: 44, zIndex: 3 }}>
        <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 6 }}>
          <Text numberOfLines={1} style={{ color: '#F5F2EE', fontSize: 16.5, fontWeight: '700' }}>{track.title}</Text>
          <ClickableArtistLine track={track} onArtistPress={onArtistPress} centered containerStyle={{ marginTop: 1 }} textStyle={{ color: 'rgba(245,242,238,0.60)', fontSize: 12.5 }} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable testID="groove2-params-open" accessibilityRole="button" accessibilityLabel="刻槽参数" onPress={() => setParamsOpen(true)} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="options-outline" size={20} color="#ECE8E2" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="查看歌词" onPress={() => setLyricsOpen(true)} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="document-text-outline" size={20} color="#ECE8E2" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="播放队列" onPress={onQueue} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="list-outline" size={21} color="#ECE8E2" />
          </Pressable>
        </View>
      </View>

      {/* High-DPI Interactive Spiral Vinyl Canvas */}
      <View style={{ flex: 1, minHeight: 260 }}>
        <NativeLocalCanvas html={GROOVE2_HTML} assetsJson={assetsJson} stateJson={stateJson} style={StyleSheet.absoluteFill} />
      </View>

      {/* Bottom 3 quick pills matching Sollin Groove 2 */}
      <View style={{ paddingHorizontal: 20, gap: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
          {pillBtn('放大镜', 'search-outline', params.loupe, () => setParams(p => ({ ...p, loupe: !p.loupe })))}
          {pillBtn(params.spinMode === 'lyric' ? '歌词驱动' : '恒速', 'refresh-outline', params.spinMode === 'lyric', () => setParams(p => ({ ...p, spinMode: p.spinMode === 'lyric' ? 'constant' : 'lyric' })))}
          {pillBtn('副歌彩胶', 'contrast-outline', params.chorusVinyl, () => setParams(p => ({ ...p, chorusVinyl: !p.chorusVinyl })))}
        </View>

        <PlaybackProgress services={services} adaptive variant="stage" />

        {/* 5-button transport */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFav ? '取消收藏' : '收藏歌曲'}
            onPress={() => { void services.songFavorites.toggle(favoriteTrack).catch(() => Alert.alert('收藏未保存')); }}
            style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={23} color={isFav ? '#FF6B78' : '#ECE8E2'} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="上一首" onPress={() => services.playback.next(-1)} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
            <SkipGlyph direction="back" width={20} height={26} gap={3.5} color="#FFFFFF" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={state.intent === 'playing' ? '暂停' : '播放'} onPress={togglePlay} style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
            {state.intent === 'playing' ? (
              <View style={{ flexDirection: 'row', gap: 9 }}>
                <View style={{ width: 8, height: 30, borderRadius: 4, backgroundColor: '#FFFFFF' }} />
                <View style={{ width: 8, height: 30, borderRadius: 4, backgroundColor: '#FFFFFF' }} />
              </View>
            ) : (
              <Ionicons name="play" size={40} color="#FFFFFF" style={{ marginLeft: 4 }} />
            )}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="下一首" onPress={() => services.playback.next()} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
            <SkipGlyph direction="forward" width={20} height={26} gap={3.5} color="#FFFFFF" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="更多播放控制" onPress={onMore} style={{ width: 46, height: 46, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="ellipsis-horizontal" size={22} color="#ECE8E2" />
          </Pressable>
        </View>
      </View>

      {/* 刻槽参数 Sheet */}
      <Modal visible={paramsOpen} animationType="slide" transparent onRequestClose={() => setParamsOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.52)' }}>
          <View style={{ maxHeight: '78%', backgroundColor: '#1B1918', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: Math.max(insets.bottom + 20, 28) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>刻槽参数</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Pressable accessibilityRole="button" onPress={() => setParams(DEFAULT_PARAMS)}>
                  <Text style={{ color: '#9EA4B0', fontSize: 13.5, fontWeight: '600' }}>重置</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setParamsOpen(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 16 }}>
              <View style={{ gap: 8 }}>
                <Text style={{ color: '#A8A39D', fontSize: 13 }}>背景材质</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {([['wood', '木纹'], ['metal', '金属'], ['transparent', '透明（共享背景）']] as const).map(([id, label]) => {
                    const sel = params.material === id;
                    return (
                      <Pressable key={id} accessibilityRole="radio" accessibilityState={{ selected: sel }} onPress={() => setParams(p => ({ ...p, material: id }))} style={{ flex: 1, minHeight: 38, borderRadius: 14, backgroundColor: sel ? '#FFFFFF' : 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 }}>
                        <Text numberOfLines={1} style={{ color: sel ? '#141210' : '#E6E2DC', fontSize: 12.5, fontWeight: '700' }}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <SliderControl testID="groove2-loupe-zoom" label="放大镜倍率" value={params.loupeZoom} min={1.6} max={3.2} step={0.1} format={v => `${v.toFixed(1)}x`} onChange={loupeZoom => setParams(p => ({ ...p, loupeZoom }))} />
              <SliderControl testID="groove2-diffraction" label="衍射光扇强度" value={params.diffraction} min={0} max={1} step={0.05} format={v => `${Math.round(v * 100)}%`} onChange={diffraction => setParams(p => ({ ...p, diffraction }))} />
              <SliderControl testID="groove2-fan-width" label="光扇宽度" value={params.fanWidth} min={0.1} max={1} step={0.05} format={v => `${Math.round(v * 100)}%`} onChange={fanWidth => setParams(p => ({ ...p, fanWidth }))} />

              {([
                ['loupe', '光学放大镜', '唱针上方开启凸透镜放大正在演唱的螺旋刻字'],
                ['chorusVinyl', '副歌彩胶', '为重复副歌音槽点亮荧光绿彩胶高光'],
                ['needleBounce', '唱针跳拍', '随音频低频能量微幅律动唱针与尘埃'],
                ['dust', '唱片尘埃弹起', '还原模拟黑胶表面的细微悬浮微尘'],
                ['fingerprint', '唱片边缘指纹', '保留真实把玩黑胶盘面的细腻质感'],
              ] as const).map(([field, title, sub]) => (
                <View key={field} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: '#F5F2EE', fontSize: 14.5, fontWeight: '600' }}>{title}</Text>
                    <Text style={{ color: '#8E8A84', fontSize: 12 }}>{sub}</Text>
                  </View>
                  <Switch value={params[field]} onValueChange={v => setParams(p => ({ ...p, [field]: v }))} />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Light Lyrics Sheet (tap line to seek) */}
      <Modal visible={lyricsOpen} animationType="slide" transparent onRequestClose={() => setLyricsOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.48)' }}>
          <View style={{ height: '72%', backgroundColor: '#F7F4F0', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 16, paddingBottom: Math.max(insets.bottom + 16, 24) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 }}>
              <View>
                <Text style={{ color: '#1F1B18', fontSize: 17, fontWeight: '700' }}>{track.title}</Text>
                <Text style={{ color: '#746D67', fontSize: 12 }}>{track.artist}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setLyricsOpen(false)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.06)', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={18} color="#1F1B18" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 24 }}>
              {doc?.synced ? doc.lines.map((line, i) => {
                const isAct = i === activeIdx;
                return (
                  <Pressable key={`${line.startMs}-${i}`} accessibilityRole="button" onPress={() => { services.playback.controller.seek(Math.max(0, (line.startMs + offset) / 1000)); setLyricsOpen(false); }} style={{ paddingVertical: 6 }}>
                    <Text style={{ color: isAct ? '#1F1B18' : '#7D7670', fontSize: isAct ? 18 : 15, fontWeight: isAct ? '800' : '500' }}>
                      {convertLyricScript(line.text, preferences.lyricChineseMode)}
                    </Text>
                    {!!line.translation && <Text style={{ color: '#978F88', fontSize: 12.5, marginTop: 2 }}>{line.translation}</Text>}
                  </Pressable>
                );
              }) : (
                <Text style={{ color: '#7D7670', fontSize: 14, paddingTop: 20 }}>暂无逐行时间轴歌词</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
