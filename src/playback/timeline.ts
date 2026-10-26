import {currentEntry} from '../domain/queue.ts';
import type {PlaybackState} from './controller.ts';

// Presentation may use known metadata before the native item is loaded. Keep
// the native duration and readiness authoritative for all seek commands.
export function playbackTimeline(state:PlaybackState){
  const native=Number.isFinite(state.duration)&&state.duration>0?state.duration:0;
  const track=state.media?.matchedTrack??currentEntry(state.queue)?.track;
  const milliseconds=track?.durationMs;
  const metadata=typeof milliseconds==='number'&&Number.isFinite(milliseconds)&&milliseconds>0?milliseconds/1000:0;
  const duration=native||metadata;
  const rawPosition=Number.isFinite(state.position)?Math.max(0,state.position):0;
  const position=duration>0?Math.min(rawPosition,duration):rawPosition;
  return {duration,position,progress:duration>0?position/duration:0,source:native?'native':metadata?'metadata':'unknown',seekable:!!(state.phase==='ready'&&state.token&&native>0)} as const;
}
