interface Scheduler {schedule:(callback:()=>void,milliseconds:number)=>()=>void}
const scheduler:Scheduler={schedule:(callback,ms)=>{const timer=setTimeout(callback,ms);return()=>clearTimeout(timer);}};
// Presentation only: no media, queue or audio intent belongs to this timer.
export class PhotoActions {
  private visible=false;private active=false;private identity='';private touching=false;private revision=0;
  private cancel:(()=>void)|undefined;private listeners=new Set<()=>void>();
  private clock:Scheduler;
  constructor(clock:Scheduler=scheduler){this.clock=clock;}
  getSnapshot=()=>this.visible;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(value:boolean){if(this.visible===value)return;this.visible=value;for(const listener of this.listeners)listener();}
  configure(identity:string,active:boolean){if(identity!==this.identity||!active){this.touching=false;this.publish(false);}this.identity=identity;this.active=active;this.arm();}
  toggle(){if(!this.active)return;this.publish(!this.visible);this.arm();}
  interact(){this.arm();}
  touch(value:boolean){this.touching=value;this.arm();}
  private arm(){
    this.cancel?.();this.cancel=undefined;const revision=++this.revision;
    if(!this.active||!this.visible||this.touching)return;
    this.cancel=this.clock.schedule(()=>{if(revision!==this.revision||!this.active||this.touching)return;this.cancel=undefined;this.publish(false);},5000);
  }
  dispose(){++this.revision;this.cancel?.();this.cancel=undefined;this.listeners.clear();}
}
