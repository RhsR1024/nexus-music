import {requireNativeView} from 'expo';
import {useContext,useEffect,useMemo,useRef,useState,useSyncExternalStore,type PropsWithChildren} from 'react';
import {AccessibilityInfo,Animated,AppState,Easing,View,type GestureResponderEvent,type ViewProps} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {RingSeekGesture,ringFraction} from '../domain/ringSeek.ts';
import type {Services} from '../app/services.ts';
import {trackKey,type Track} from '../domain/track.ts';
import {Cover} from './Cover.tsx';
import {usePresentationVisible} from './AdaptiveModal.tsx';
import {paper} from './tokens.ts';
import {VisualSamplingContext} from './VisualSampling.ts';
const NativeVinylReflection=requireNativeView<ViewProps>('NexusNative','VinylReflection');
// IMG_4851 deck local units: 370.33x351pt deck, 300pt record at (10.33,33),
// 66.67pt base ring at (280.33,12.67), black arm-rest at (293.83,127.33).
// The current 12.3pt tonearm engages at 21.6deg; material reconstruction
// and the 60pt base remain approximate pending the frozen visual gates.
export function Vinyl({services,track,width,playing}:{services:Services;track:Track;width:number;playing:boolean}){
  const visible=usePresentationVisible(),sampling=useContext(VisualSamplingContext);
  const sampledPhase=sampling&&Number.isFinite(sampling.recordPhase)?((sampling.recordPhase%1)+1)%1:undefined;
  const identity=trackKey(track.origin);
  const rotation=useMemo(()=>new Animated.Value(0),[identity]),tonearm=useRef(new Animated.Value(playing?1:0)).current;
  const [reduce,setReduce]=useState(true),[foreground,setForeground]=useState(AppState.currentState==='active');
  useEffect(()=>{let active=true;void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(active)setReduce(value);});const motion=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduce),app=AppState.addEventListener('change',value=>setForeground(value==='active'));return()=>{active=false;motion.remove();app.remove();};},[]);
  useEffect(()=>{
    if(sampledPhase!==undefined){rotation.stopAnimation();rotation.setValue(sampledPhase);return;}
    let active=true,animation:Animated.CompositeAnimation|undefined;
    // Wrap at complete turns so long sessions do not accumulate float error.
    // stopAnimation returns the actual native phase; stale callbacks cannot
    // restart a hidden, replaced or unmounted turntable.
    const turn=(value:number)=>{
      if(!active)return;
      const phase=((value%1)+1)%1;rotation.setValue(phase);
      animation=Animated.timing(rotation,{toValue:phase+1,duration:13513.514,easing:Easing.linear,useNativeDriver:true,isInteraction:false});
      animation.start(({finished})=>{if(finished&&active)turn(phase);});
    };
    rotation.stopAnimation(value=>{if(active&&playing&&visible&&!reduce&&foreground)turn(value);});
    return()=>{active=false;animation?.stop();rotation.stopAnimation();};
  },[identity,playing,visible,reduce,foreground,rotation,sampledPhase]);
  useEffect(()=>{
    const target=playing?1:0;
    tonearm.stopAnimation();
    if(reduce||!foreground||!visible){tonearm.setValue(target);return;}
    // Separate from the disc: pausing returns the needle without seeking or
    // restarting audio. RN performs interpolation on the native animation driver.
    const animation=Animated.timing(tonearm,{toValue:target,duration:playing?620:480,easing:Easing.inOut(Easing.cubic),useNativeDriver:true,isInteraction:false});
    animation.start();return()=>{animation.stop();tonearm.stopAnimation();};
  },[playing,visible,reduce,foreground,tonearm]);
  // Record and arm use deck-local coordinates (design 370.33x351), so the
  // narrow left band and the arm's right bay keep their measured proportions.
  const s=width/370.33,h=351*s,record=300*s,label=139.33*s,photo=128*s,labelBorder=(label-photo)/2;
  const baseD=60*s,baseX=315*s,baseY=45*s,jointD=21.67*s,jointX=309*s,jointY=56*s;
  const resting=tonearm.interpolate({inputRange:[0,1],outputRange:['0deg','21.6deg']});
  return <View testID="vinyl-turntable" collapsable={false} accessible={false} pointerEvents="none" style={{height:h,alignItems:'center'}}>
    <View testID="vinyl-canvas" collapsable={false} style={{width,height:h}}>
      <LinearGradient testID="vinyl-deck" collapsable={false} colors={['#3B302A','#2A2521','#1B1918','#13171B']} locations={[0,.18,.58,1]} start={{x:0,y:0}} end={{x:1,y:1}} style={{position:'absolute',left:0,top:0,width,height:h,borderRadius:17*s,boxShadow:'0px 16px 36px rgba(52,36,26,0.42)'}}>
        <View style={{position:'absolute',left:0,right:0,top:0,bottom:0,borderRadius:17*s,borderWidth:1,borderColor:'rgba(255,255,255,0.05)'}}/>
      </LinearGradient>
      <View style={{position:'absolute',left:0,top:0,width,height:h,borderRadius:17*s,overflow:'hidden'}}>
        <View testID="vinyl-platter" collapsable={false} style={{position:'absolute',left:10.33*s,top:33*s,width:record,height:record,borderRadius:record/2,backgroundColor:'#0A0A0A',alignItems:'center',justifyContent:'center'}}>
          <NativeVinylReflection style={{position:'absolute',left:0,top:0,width:record,height:record}}/>
          <Animated.View testID="vinyl-record" collapsable={false} style={{width:record,height:record,borderRadius:record/2,backgroundColor:'transparent',alignItems:'center',justifyContent:'center',transform:[{rotate:rotation.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']})}]}}>
            {[76,78.7,83,85.3,87.7,90,92.3,94.7,99.7,104.3,106.7,109,111.3,113.7,118.3,125.3].map((r,i)=><View key={`g${i}`} style={{position:'absolute',left:(150-r)*s,top:(150-r)*s,width:2*r*s,height:2*r*s,borderRadius:r*s,borderWidth:.33,borderColor:'#1E1E1E'}}/>)}
            {[77,79.7,84,86.3,88.7,91,93.3,95.7,100.7,105.3,107.7,110,112.3,114.7,119.3,126.3].map((r,i)=><View key={`d${i}`} style={{position:'absolute',left:(150-r)*s,top:(150-r)*s,width:2*r*s,height:2*r*s,borderRadius:r*s,borderWidth:.33,borderColor:'#050505'}}/>)}
            {[[131.3,4.6,'#030303'],[136,4,'#0E0E0E'],[138.7,2,'#020202'],[149.7,11,'#0C0C0C'],[150,.5,'#1A1A1A']].map(([r,w,c],i)=><View key={`o${i}`} style={{position:'absolute',left:(150-(r as number))*s,top:(150-(r as number))*s,width:2*(r as number)*s,height:2*(r as number)*s,borderRadius:(r as number)*s,borderWidth:(w as number)*s,borderColor:c as string}}/>)}
            <View style={{width:label,height:label,borderRadius:label/2,overflow:'hidden',borderWidth:labelBorder,borderColor:'#1F3041'}}><Cover services={services} track={track} size={photo} radius={photo/2}/></View>
          </Animated.View>
          <View testID="vinyl-spindle" collapsable={false} style={{position:'absolute',width:9*s,height:9*s,borderRadius:4.5*s,backgroundColor:'#BABDBA',borderWidth:2*s,borderColor:'#53585B'}}/>
        </View>
        {/* Deck-mounted arm rest: 41.6x41.5pt block with a 30.7x5.3pt silver bar. */}
        <View collapsable={false} style={{position:'absolute',left:297*s,top:155.1*s,width:41.6*s,height:41.5*s,borderRadius:8*s,backgroundColor:'#090A09'}}>
          <View style={{position:'absolute',left:1*s,top:11.2*s,width:30.7*s,height:5.3*s,borderRadius:2.65*s,backgroundColor:'#6F716E'}}/>
        </View>
        <Animated.View testID="vinyl-tonearm-rear" collapsable={false} style={{position:'absolute',left:jointX,top:jointY,width:1,height:1,transform:[{rotate:resting}],transformOrigin:'left top'}}>
          <Animated.View testID="vinyl-counterweight" collapsable={false} style={{transform:[{translateY:tonearm.interpolate({inputRange:[0,1],outputRange:[10*s,0]})}],position:'absolute',left:-10*s,top:-66*s,width:20*s,height:34*s,borderRadius:5*s,overflow:'hidden',backgroundColor:'#8C8F8B'}}>
            <LinearGradient colors={['#6E716D','#AEB1AC','#C9CCC7','#9B9E99','#6A6D69']} locations={[0,.24,.5,.76,1]} start={{x:0,y:0}} end={{x:1,y:0}} style={{position:'absolute',left:0,top:0,width:20*s,height:34*s}}/>
            <View style={{position:'absolute',left:2.6*s,top:3*s,width:1.2*s,height:28*s,borderRadius:.6*s,backgroundColor:'rgba(255,255,255,0.38)'}}/>
          </Animated.View>
          <LinearGradient colors={['#555854','#A9ACA7','#D2D5D0','#B4B7B2','#8A8D88','#4A4D49']} locations={[0,.18,.45,.7,.88,1]} start={{x:0,y:.4}} end={{x:1,y:.4}} style={{position:'absolute',left:-6.15*s,top:-31*s,width:12.3*s,height:31*s,borderRadius:6.15*s,borderWidth:.4,borderColor:'#333633'}}/>
        </Animated.View>
        <View testID="vinyl-pivot" collapsable={false} style={{position:'absolute',left:baseX-baseD/2,top:baseY-baseD/2,width:baseD,height:baseD,borderRadius:baseD/2}}>
          <View style={{position:'absolute',left:-5*s,top:-3*s,width:baseD+10*s,height:baseD+10*s,borderRadius:(baseD+10*s)/2,backgroundColor:'rgba(0,0,0,0.30)'}}/>
          <LinearGradient colors={['#C4C7C2','#7E817C','#454845','#262826','#171817']} locations={[0,.14,.36,.68,1]} start={{x:.18,y:.03}} end={{x:.86,y:.97}} style={{position:'absolute',left:0,top:0,width:baseD,height:baseD,borderRadius:baseD/2,boxShadow:'0px 8px 22px rgba(0,0,0,0.60)'}}/>
          <View style={{position:'absolute',left:12.365*s,top:12.365*s,width:35.27*s,height:35.27*s,borderRadius:17.635*s,backgroundColor:'#181918',borderWidth:1.6*s,borderColor:'rgba(0,0,0,0.62)'}}/>
        </View>
        <Animated.View testID="vinyl-tonearm" collapsable={false} style={{position:'absolute',left:jointX,top:jointY,width:1,height:1,transform:[{rotate:resting}],transformOrigin:'left top'}}>
          <LinearGradient colors={['#555854','#A9ACA7','#D2D5D0','#B4B7B2','#8A8D88','#4A4D49']} locations={[0,.18,.45,.7,.88,1]} start={{x:0,y:.4}} end={{x:1,y:.4}} style={{position:'absolute',left:-6.15*s,top:0,width:12.3*s,height:130*s,borderRadius:6.15*s,borderWidth:.4,borderColor:'#333633'}}/>
          <View style={{position:'absolute',left:-7.5*s,top:126*s,width:15*s,height:3.5*s,borderRadius:1.75*s,backgroundColor:'#6E716D',borderWidth:.4,borderColor:'#3A3D3A'}}/>
          <View testID="vinyl-cartridge" collapsable={false} style={{position:'absolute',left:-12.5*s,top:128.7*s,width:25*s,height:34*s,borderRadius:1.5*s,backgroundColor:'#1C1F1D',borderWidth:.4,borderColor:'#3A3D3A'}}>
            <View style={{position:'absolute',left:-5*s,top:30*s,width:13*s,height:10*s,borderRadius:2*s,backgroundColor:'#151715'}}/>
            <View style={{position:'absolute',left:2*s,top:.8*s,width:21*s,height:.5,backgroundColor:'rgba(255,255,255,0.10)'}}/>
            <View style={{position:'absolute',left:-2.15*s,top:15.15*s,width:4.3*s,height:4.3*s,borderRadius:2.15*s,backgroundColor:'#D5D6D1'}}/>
            <View style={{position:'absolute',left:-2.15*s,top:27.75*s,width:4.3*s,height:4.3*s,borderRadius:2.15*s,backgroundColor:'#D5D6D1'}}/>
          </View>
          <View style={{position:'absolute',left:-26.65*s,top:177.55*s,width:10.3*s,height:2.7*s,borderRadius:1.35*s,backgroundColor:'#E5C88A',transform:[{rotate:'-21.6deg'}]}}/>
        </Animated.View>
        <View collapsable={false} style={{position:'absolute',left:299.05*s,top:50.08*s,width:18.5*s,height:18.5*s,borderRadius:9.25*s,backgroundColor:'#555956',borderWidth:.5,borderColor:'#2B2D2B',alignItems:'center',justifyContent:'center'}}>
          <View style={{width:5.2*s,height:5.2*s,borderRadius:2.6*s,backgroundColor:'#8F918F'}}/>
        </View>
      </View>
    </View>
  </View>;
}
export function FrequencyHalo({services,playing,children}:PropsWithChildren<{services:Services;playing:boolean}>){
  const spectrum=useSyncExternalStore(services.playback.spectrum.subscribe,services.playback.spectrum.getSnapshot);
  const controller=services.playback.controller,state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  const gesture=useRef(new RingSeekGesture()).current,[preview,setPreview]=useState<number>();
  const token=state.phase==='ready'&&state.token?JSON.stringify(state.token):undefined;
  const current=()=>{const value=controller.getSnapshot();return {token:value.phase==='ready'&&value.token?JSON.stringify(value.token):undefined,duration:value.duration};};
  useEffect(()=>{setPreview(gesture.preview(token,state.duration));},[gesture,token,state.duration]);
  useEffect(()=>()=>gesture.cancel(),[gesture]);
  useEffect(()=>{const listener=AppState.addEventListener('change',value=>{if(value!=='active'){gesture.cancel();setPreview(undefined);}});return()=>listener.remove();},[gesture]);
  const cancel=()=>{gesture.cancel();setPreview(undefined);};
  const fraction=(event:GestureResponderEvent)=>ringFraction(event.nativeEvent.locationX,event.nativeEvent.locationY,148,26);
  const clock=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  const enabled=!!token&&Number.isFinite(state.duration)&&state.duration>0;
  const effectivePreview=gesture.preview(token,state.duration)===undefined?undefined:preview;
  const progress=effectivePreview??(enabled?Math.max(0,Math.min(1,state.position/state.duration)):0);
  const position=effectivePreview===undefined?state.position:effectivePreview*state.duration;
  const showSpectrum=playing&&spectrum.supported&&spectrum.bands.length>=32;
  return <View style={{width:148,height:148,alignItems:'center',justifyContent:'center'}}>
    <View testID="wave-seek-ring" accessible accessibilityRole="adjustable" accessibilityLabel="环形播放进度" accessibilityHint="沿外环拖动，松手定位；中心按钮播放或暂停" accessibilityState={{disabled:!enabled}} accessibilityValue={{min:0,max:Math.floor(state.duration),now:Math.floor(position),text:`${clock(position)} / ${clock(state.duration)}`}} accessibilityActions={[{name:'increment'},{name:'decrement'}]}
      onAccessibilityAction={event=>{if(enabled){cancel();controller.seek(controller.getSnapshot().position+(event.nativeEvent.actionName==='increment'?10:-10));}}}
      onStartShouldSetResponder={event=>{const {locationX:x,locationY:y,touches}=event.nativeEvent,radius=Math.hypot(x-74,y-74);return enabled&&touches.length===1&&radius>=52&&radius<=74;}}
      onResponderGrant={event=>{const value=current();setPreview(gesture.begin(value.token,value.duration,fraction(event)));}}
      onResponderMove={event=>{if(event.nativeEvent.touches.length!==1){cancel();return;}const value=current();setPreview(gesture.move(value.token,value.duration,fraction(event)));}}
      onResponderRelease={event=>{const value=current();if(fraction(event)===undefined){cancel();return;}gesture.move(value.token,value.duration,fraction(event));const seconds=gesture.finish(value.token,value.duration);setPreview(undefined);if(seconds!==undefined)controller.seek(seconds);}}
      onResponderTerminationRequest={()=>false} onResponderTerminate={cancel} style={{position:'absolute',width:148,height:148}}>
      <View pointerEvents="none" accessible={false} style={{width:148,height:148}}>{Array.from({length:60},(_,i)=>{const angle=i/60*Math.PI*2-Math.PI/2;return <View key={i} style={{position:'absolute',left:72+Math.cos(angle)*57,top:72+Math.sin(angle)*57,width:3,height:3,borderRadius:2,backgroundColor:i/60<progress?'#FFFFFF':'rgba(255,255,255,0.22)'}}/>;})}</View>
    </View>
    {showSpectrum&&<View testID="wave-spectrum-bars" pointerEvents="none" accessible={false} style={{position:'absolute',width:148,height:148}}>{Array.from({length:32},(_,i)=>{const angle=(i/32)*Math.PI*2,length=3+Math.min(1,Math.max(0,spectrum.bands[i]??0))*13;return <View key={i} accessible={false} style={{position:'absolute',width:3,height:length,borderRadius:2,backgroundColor:'rgba(255,255,255,0.66)',left:72+Math.cos(angle)*64,top:72+Math.sin(angle)*64-length/2,transform:[{rotate:`${angle+Math.PI/2}rad`}]}}/>;})}</View>}
    <View style={{width:104,height:104,borderRadius:52,borderWidth:3,borderColor:'rgba(255,255,255,0.5)',alignItems:'center',justifyContent:'center'}}>{children}</View>
  </View>;
}
