export const rootPresentation = Symbol('root presentation');
type Presentation = {parent:symbol;order:number};

// A registry belongs to one application surface. It observes presentation only;
// playback intent and media identity remain in the playback controller.
export class PresentationRegistry {
  private entries=new Map<symbol,Presentation>();
  private listeners=new Set<()=>void>();
  private order=0;
  private current=rootPresentation;
  getSnapshot=()=>this.current;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  activate(id:symbol,parent:symbol){
    if(id===rootPresentation||id===parent)throw new Error('Invalid presentation parent');
    let ancestor:symbol|undefined=parent;
    while(ancestor!==undefined){if(ancestor===id)throw new Error('Presentation cycle');ancestor=this.entries.get(ancestor)?.parent;}
    const entry={parent,order:++this.order};
    this.entries.set(id,entry);this.refresh();
    return()=>{if(this.entries.get(id)===entry){this.entries.delete(id);this.refresh();}};
  }
  private refresh(){
    let next=rootPresentation;
    while(true){
      let child:symbol|undefined,order=0;
      for(const [id,entry] of this.entries){if(entry.parent===next&&entry.order>order){child=id;order=entry.order;}}
      if(child===undefined)break;
      next=child;
    }
    if(next===this.current)return;
    this.current=next;for(const listener of this.listeners)listener();
  }
}

export function coversPresentation(props:{transparent?:boolean|null;presentationStyle?:'fullScreen'|'pageSheet'|'formSheet'|'overFullScreen'|null}){
  return props.transparent!==true&&props.presentationStyle!=='pageSheet'&&props.presentationStyle!=='formSheet';
}
