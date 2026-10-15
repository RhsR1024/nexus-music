import {select,type QueueState} from './queue.ts';
// Entry IDs, rather than song IDs, preserve intentional duplicates in a queue.
export class ShuffleNavigator {
  private seen=new Set<string>();private history:string[]=[];private forward:string[]=[];private last:string|null=null;
  private random:()=>number;
  constructor(random:()=>number=Math.random){this.random=random;}
  reset(){this.seen.clear();this.history=[];this.forward=[];this.last=null;}
  observe(queue:QueueState){
    const ids=new Set(queue.entries.map(item=>item.id));
    this.seen=new Set([...this.seen].filter(id=>ids.has(id)));this.history=this.history.filter(id=>ids.has(id));this.forward=this.forward.filter(id=>ids.has(id));
    if(queue.currentId!==this.last){
      if(this.last&&ids.has(this.last))this.history.push(this.last);
      this.forward=[];this.last=queue.currentId;if(this.last)this.seen.add(this.last);
    }
    this.history=this.history.slice(-1000);
  }
  next(queue:QueueState,repeat:boolean,direction:1|-1=1):QueueState{
    this.observe(queue);let target:string|undefined;
    if(direction===-1){target=this.history.pop();if(!target)return queue;if(this.last)this.forward.push(this.last);}
    else{
      target=this.forward.pop();
      if(!target){let eligible=queue.entries.filter(item=>!this.seen.has(item.id));
        if(!eligible.length&&repeat){this.seen.clear();if(queue.currentId)this.seen.add(queue.currentId);eligible=queue.entries.filter(item=>item.id!==queue.currentId);if(!eligible.length)eligible=[...queue.entries];}
        if(eligible.length)target=eligible[Math.min(eligible.length-1,Math.max(0,Math.floor(this.random()*eligible.length)))]!.id;
      }
      if(this.last&&target)this.history.push(this.last);
    }
    this.last=target??null;if(target)this.seen.add(target);
    return target?select(queue,target):{...queue,currentId:null,priorityIds:[]};
  }
}
