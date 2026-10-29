import type {OnlinePlatform} from '../domain/track.ts';
import {platforms} from './searchCoordinator.ts';
import {AssistanceUnavailableError,type AssistanceMode,type SearchAssistanceProvider} from './searchAssistance.ts';
export interface AssistanceGroup{platform:OnlinePlatform;items:readonly string[];loading:boolean;error:string|null;retryable:boolean}
export class SearchAssistanceCoordinator{
 private readonly provider:Pick<SearchAssistanceProvider,'read'>;
 private pending=new AbortController();private generation=0;private listeners=new Set<()=>void>();
 private value:{mode:AssistanceMode|null;query:string;groups:readonly AssistanceGroup[]}={mode:null,query:'',groups:[]};
 constructor(provider:Pick<SearchAssistanceProvider,'read'>){this.provider=provider;}
 getSnapshot=()=>this.value;
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private publish(value:typeof this.value){this.value=value;for(const listener of this.listeners)listener();}
 clear=()=>{this.pending.abort();this.pending=new AbortController();this.generation++;this.publish({mode:null,query:'',groups:[]});};
 async load(mode:AssistanceMode,query:string,selected:OnlinePlatform|'all'){
  this.clear();const generation=this.generation;
  this.publish({mode,query,groups:(selected==='all'?platforms:[selected]).map(platform=>({platform,items:[],loading:true,error:null,retryable:true}))});
  await Promise.all(this.value.groups.map(group=>this.request(group.platform,generation)));
 }
 async retry(platform:OnlinePlatform){const group=this.value.groups.find(g=>g.platform===platform);if(!this.value.mode||!group||group.loading||!group.error||!group.retryable)return;
  this.publish({...this.value,groups:this.value.groups.map(g=>g===group?{...g,loading:true,error:null}:g)});await this.request(platform,this.generation);
 }
 private async request(platform:OnlinePlatform,generation:number){
  const {mode,query}=this.value;if(!mode)return;
  try{const items=await this.provider.read(platform,mode,query,this.pending.signal);if(generation!==this.generation||this.pending.signal.aborted)return;
   this.publish({...this.value,groups:this.value.groups.map(g=>g.platform===platform?{...g,items,loading:false,error:null}:g)});
  }catch(error){if(generation!==this.generation||this.pending.signal.aborted)return;
   this.publish({...this.value,groups:this.value.groups.map(g=>g.platform===platform?{...g,loading:false,retryable:!(error instanceof AssistanceUnavailableError),error:error instanceof AssistanceUnavailableError?error.message:mode==='hot'?'热搜词暂时不可用，仍可直接搜索':'建议暂时不可用，仍可直接搜索'}:g)});
  }
 }
}
