export function ringFraction(x:number,y:number,size:number,minRadius=1):number|undefined {
  if(![x,y,size,minRadius].every(Number.isFinite)||size<=0)return;
  const dx=x-size/2,dy=y-size/2;
  if(Math.hypot(dx,dy)<minRadius)return;
  return ((Math.atan2(dy,dx)+Math.PI/2)/(Math.PI*2)+1)%1;
}

// Gesture preview belongs to one resolved playback token and duration. It never
// changes playback; only a matching release can produce a seek command.
export class RingSeekGesture {
  private gesture?:{token:string;duration:number;fraction:number;angle:number};
  begin(token:string|undefined,duration:number,fraction:number|undefined){
    this.cancel();
    if(!token||!Number.isFinite(duration)||duration<=0||fraction===undefined||!Number.isFinite(fraction)||fraction<0||fraction>1)return;
    this.gesture={token,duration,fraction,angle:fraction};return fraction;
  }
  preview(token:string|undefined,duration:number){
    if(this.gesture&&(this.gesture.token!==token||this.gesture.duration!==duration))this.cancel();
    return this.gesture?.fraction;
  }
  move(token:string|undefined,duration:number,fraction:number|undefined){
    this.preview(token,duration);const gesture=this.gesture;
    if(!gesture||fraction===undefined||!Number.isFinite(fraction)||fraction<0||fraction>1)return gesture?.fraction;
    let delta=fraction-gesture.angle;
    // Crossing twelve o'clock continues toward the endpoint, instead of
    // jumping between the beginning and end of the recording.
    if(delta>.5)delta-=1;else if(delta<-.5)delta+=1;
    gesture.fraction=Math.min(1,Math.max(0,gesture.fraction+delta));gesture.angle=fraction;
    return gesture.fraction;
  }
  finish(token:string|undefined,duration:number){
    const fraction=this.preview(token,duration);this.cancel();
    return fraction===undefined?undefined:fraction*duration;
  }
  cancel(){this.gesture=undefined;}
}
