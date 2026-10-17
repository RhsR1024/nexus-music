export type AM2Content='cover'|'lyrics'|'queue'|'comments';
export interface AM2View {readonly content:AM2Content;readonly fullscreen:boolean}
interface Context {identity:string;active:boolean;automatic:boolean;delaySeconds:number}
export interface AM2Clock {schedule:(callback:()=>void,milliseconds:number)=>()=>void}
const clock:AM2Clock={schedule:(callback,milliseconds)=>{const handle=setTimeout(callback,milliseconds);return()=>clearTimeout(handle);}};
// Owns presentation only. No media, queue, position or audio intent is stored here.
export class AM2Presentation {
  private view:AM2View={content:'cover',fullscreen:false};
  private context:Context={identity:'',active:false,automatic:true,delaySeconds:5};
  private listeners=new Set<()=>void>();private cancel:(()=>void)|undefined;private revision=0;private touching=false;
  private clock:AM2Clock;
  constructor(scheduler:AM2Clock=clock){this.clock=scheduler;}
  getSnapshot=()=>this.view;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(view:AM2View){if(view.content===this.view.content&&view.fullscreen===this.view.fullscreen)return;this.view=view;for(const listener of this.listeners)listener();}
  configure(context:Context){
    const previous=this.context;this.context=context;
    if(previous.identity!==context.identity){this.touching=false;this.publish({content:'cover',fullscreen:false});}
    else if(!context.active||!context.automatic)this.publish({...this.view,fullscreen:false});
    this.arm();
  }
  select(content:AM2Content){this.publish({content:content===this.view.content?'cover':content,fullscreen:false});this.arm();}
  toggleFullscreen(){if(this.view.content!=='lyrics')return;this.publish({...this.view,fullscreen:!this.view.fullscreen});this.arm();}
  setTouching(touching:boolean){if(this.touching===touching)return;this.touching=touching;this.arm();}
  private arm(){
    this.cancel?.();this.cancel=undefined;const revision=++this.revision,context=this.context;
    if(!context.active||!context.automatic||this.touching||this.view.content!=='lyrics'||this.view.fullscreen)return;
    const seconds=Number.isFinite(context.delaySeconds)?Math.max(1,Math.min(60,context.delaySeconds)):5;
    this.cancel=this.clock.schedule(()=>{
      if(revision!==this.revision||!this.context.active||this.touching||this.view.content!=='lyrics')return;
      this.cancel=undefined;this.publish({...this.view,fullscreen:true});
    },seconds*1000);
  }
  dispose(){++this.revision;this.cancel?.();this.cancel=undefined;this.listeners.clear();}
}
// Original accessibility policy: use two columns only when each has usable width.
export function am2Columns(width:number,height:number,fontScale:number):boolean {
  return Number.isFinite(width)&&Number.isFinite(height)&&width>=650&&(width>height||width>=900)&&fontScale<1.8;
}
