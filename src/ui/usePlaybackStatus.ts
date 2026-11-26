import {useEffect,useRef,useState} from 'react';
import type {PlaybackState} from '../playback/controller.ts';

export type PlaybackStatusKind='idle'|'resolving'|'buffering'|'error';

export type StablePlaybackStatus={
  kind:PlaybackStatusKind;
  text:string;
};

export type StatusLabels={
  resolving?:string;
  buffering?:string;
};

const RESOLVING_ENTER_MS=260;
const BUFFERING_ENTER_MS=420;
const RESOLVING_HOLD_MS=650;

/** Pure decision helper for what the raw playback state wants right now. */
export function rawPlaybackStatus(state:Pick<PlaybackState,'phase'|'buffering'|'error'|'intent'|'position'>):PlaybackStatusKind{
  if(state.error)return 'error';
  if(state.phase==='resolving')return 'resolving';
  if(state.buffering&&state.intent==='playing')return 'buffering';
  return 'idle';
}

/**
 * Stabilizes transient resolving/buffering playback phases so multi-source
 * retries (`resolving -> ready(0s) -> retry -> resolving`) and fast cache hits
 * do not flash "正在选择音源…" on and off across the UI.
 */
export function useStablePlaybackStatus(state:PlaybackState,labels?:StatusLabels):StablePlaybackStatus{
  const resolvingLabel=labels?.resolving??'正在选择音源…';
  const bufferingLabel=labels?.buffering??'正在缓冲…';
  const raw=rawPlaybackStatus(state);
  const trackId=state.queue.currentId??'';
  const [shown,setShown]=useState<PlaybackStatusKind>(raw==='error'?'error':'idle');
  const shownRef=useRef<PlaybackStatusKind>(shown);
  shownRef.current=shown;
  const lastTrack=useRef(trackId);
  const lastResolvingAt=useRef(0);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);

  const clearTimer=()=>{
    if(timer.current){clearTimeout(timer.current);timer.current=null;}
  };

  useEffect(()=>{
    clearTimer();
    if(lastTrack.current!==trackId){
      lastTrack.current=trackId;
      lastResolvingAt.current=0;
      if(raw==='error'){setShown('error');return;}
      setShown('idle');
      if(raw==='resolving'){
        lastResolvingAt.current=Date.now();
        timer.current=setTimeout(()=>setShown('resolving'),RESOLVING_ENTER_MS);
      }else if(raw==='buffering'){
        timer.current=setTimeout(()=>setShown('buffering'),BUFFERING_ENTER_MS);
      }
      return clearTimer;
    }

    if(raw==='error'){
      setShown('error');
      return clearTimer;
    }

    if(raw==='resolving'){
      lastResolvingAt.current=Date.now();
      if(shownRef.current==='resolving')return clearTimer;
      timer.current=setTimeout(()=>setShown('resolving'),RESOLVING_ENTER_MS);
      return clearTimer;
    }

    if(raw==='buffering'){
      if(shownRef.current==='resolving'&&state.position<=0.2){
        // Keep the resolving hint steady while the newly selected URL buffers
        // its initial audio frames, instead of rapidly flipping labels.
        return clearTimer;
      }
      if(shownRef.current==='buffering')return clearTimer;
      timer.current=setTimeout(()=>setShown('buffering'),BUFFERING_ENTER_MS);
      return clearTimer;
    }

    // raw === 'idle'
    if(shownRef.current==='resolving'&&state.intent==='playing'&&state.position<=0.15){
      const remaining=RESOLVING_HOLD_MS-(Date.now()-lastResolvingAt.current);
      if(remaining>40){
        timer.current=setTimeout(()=>setShown('idle'),remaining);
        return clearTimer;
      }
    }
    if(shownRef.current!=='idle')setShown('idle');
    return clearTimer;
  },[raw,trackId,state.intent,state.position>0.15]);

  if(state.error)return {kind:'error',text:state.error};
  if(shown==='resolving')return {kind:'resolving',text:resolvingLabel};
  if(shown==='buffering')return {kind:'buffering',text:bufferingLabel};
  return {kind:'idle',text:''};
}
