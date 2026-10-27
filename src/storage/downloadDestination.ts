import {validateDestinationIntent,validateDestinationRoot,type DestinationRoot,type DownloadDestinationIntent} from '../domain/downloadDestination.ts';
import type {DownloadNaming} from '../domain/downloadNaming.ts';
export interface DestinationNative {
 downloadDestinationStatus():Promise<DestinationRoot|null>;
 pickDownloadDestination():Promise<DestinationRoot|null>;
 forgetDownloadDestination(id:string):Promise<void>;
 saveDownloadFiles(uris:readonly string[],id:string,job:string):Promise<readonly string[]>;
}
export class DownloadDestinationSettings {
 private state:Readonly<{root:DestinationRoot|null;busy:boolean}>={root:null,busy:false};private listeners=new Set<()=>void>();
 constructor(native:DestinationNative,naming:()=>DownloadNaming,uuid:()=>string){this.native=native;this.naming=naming;this.uuid=uuid;}
 private native:DestinationNative;private naming:()=>DownloadNaming;private uuid:()=>string;
 getSnapshot=()=>this.state;subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 private publish(root:DestinationRoot|null,busy=false){this.state={root,busy};for(const listener of this.listeners)listener();}
 async restore(){const value=await this.native.downloadDestinationStatus();this.publish(value?validateDestinationRoot(value):null);}
 async choose(){if(this.state.busy)return;const old=this.state.root;this.publish(old,true);try{const value=await this.native.pickDownloadDestination();this.publish(value?validateDestinationRoot(value):old);}catch(error){this.publish(old);throw error;}}
 async forget(){if(this.state.busy)return;const old=this.state.root;if(!old)return;this.publish(old,true);try{await this.native.forgetDownloadDestination(old.id);this.publish(null);}catch(error){this.publish(old);throw error;}}
 capture():DownloadDestinationIntent|undefined {const root=this.state.root;if(!root||this.state.busy)return;return validateDestinationIntent({...this.naming(),id:root.id,name:root.name,job:this.uuid()});}
 save(uris:readonly string[],intent:DownloadDestinationIntent){if(this.state.busy||this.state.root?.id!==intent.id)throw Error('保存目录授权已改变');return this.native.saveDownloadFiles(uris,intent.id,intent.job);}
}
