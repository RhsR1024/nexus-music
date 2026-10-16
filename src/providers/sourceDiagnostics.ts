import type{LXSource,makeLXRequest}from'./lx.ts';
import type{SourceLifecycle,SourceState}from'./sourceRegistry.ts';
import type{LXTransport}from'./multiSourceResolver.ts';
import type{SourceCatalog}from'./sourceCatalog.ts';
import{throwIfAborted}from'./async.ts';
export interface DiagnosticSession {capabilities:readonly LXSource[];request(payload:ReturnType<typeof makeLXRequest>,signal:AbortSignal):Promise<unknown>;dispose():void}
export type OpenDiagnostic=(source:SourceState,signal:AbortSignal)=>Promise<DiagnosticSession>;
export function createSourceDiagnostics(catalog:Pick<SourceCatalog,'diagnosticDefinition'>,adapter:SourceLifecycle&LXTransport,uuid:()=>string):OpenDiagnostic {
 return async(source,signal)=>{
  throwIfAborted(signal);const original=catalog.diagnosticDefinition(source),id=`health:${uuid()}`,definition={...original,id};let ended=false;
  const end=()=>{if(!ended){ended=true;adapter.destroy(id,1);}};signal.addEventListener('abort',end,{once:true});
  try{const capabilities=await adapter.initialize(definition,1,signal);throwIfAborted(signal);
   const isolated={...source,id,revision:1,capabilities};return{capabilities,request:(payload,child)=>{throwIfAborted(signal);if(ended)throw Error('诊断会话已结束');return adapter.request(isolated,payload,child);},dispose:()=>{signal.removeEventListener('abort',end);end();}};
  }catch(error){signal.removeEventListener('abort',end);end();throw error;}
 };
}
