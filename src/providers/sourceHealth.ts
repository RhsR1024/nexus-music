import {qualityOrder,normalizeQuality,type Quality} from '../domain/quality.ts';
import type {OnlinePlatform,Track} from '../domain/track.ts';
import {makeLXRequest} from './lx.ts';
import type {OnlineProvider} from './online.ts';
import type {DiagnosticSession,OpenDiagnostic} from './sourceDiagnostics.ts';
import type {SourceRegistry,SourceState} from './sourceRegistry.ts';
import {bounded,DeadlineError,throwIfAborted} from './async.ts';
import type {AudioProbe,AudioProbeResult} from './audioProbe.ts';
export type HealthStatus=AudioProbeResult['state']|'pending'|'initializing'|'init-error'|'searching'|'resolving'|'probing'|'not-ready'|'unsupported'|'search-error'|'no-song'|'url-error'|'source-changed';
export interface HealthRow {id:string;sourceId:string;sourceName:string;revision:number;fingerprint?:string;platform?:OnlinePlatform;quality?:Quality;scriptQuality?:string;status:HealthStatus;song?:string;elapsedMs:number;initializationMs?:number;resolutionMs?:number;probeMs?:number;httpStatus?:number;format?:AudioProbeResult['format'];bytes?:number}
export interface HealthSnapshot {version:1;startedAt:number;finishedAt?:number;running:boolean;cancelled:boolean;rows:readonly HealthRow[]}
const active=new Set<HealthStatus>(['pending','initializing','searching','resolving','probing']);
const platforms:readonly OnlinePlatform[]=['wy','tx','kw','kg','mg'];
const label=(value:string)=>value.replace(/[\x00-\x1f\x7f]/g,' ').replace(/https?:\/\/\S+/gi,'[地址隐藏]').slice(0,180);
interface Dependencies {registry:Pick<SourceRegistry,'getSnapshot'|'isCurrent'|'subscribe'>;open:OpenDiagnostic;online:Pick<OnlineProvider,'search'>;probe:AudioProbe;now?:()=>number;timeoutMs?:number}
export class SourceHealth {
  private deps:Dependencies;private now:()=>number;private generation=0;private pending?:AbortController;private children=new Map<string,{source:SourceState;abort:AbortController}>();private listeners=new Set<()=>void>();private unsubscribe:()=>void;
  private value:HealthSnapshot={version:1,startedAt:0,running:false,cancelled:false,rows:[]};
  constructor(deps:Dependencies){this.deps=deps;this.now=deps.now??Date.now;this.unsubscribe=deps.registry.subscribe(()=>{
    for(const {source,abort} of this.children.values())if(!deps.registry.isCurrent(source))abort.abort();
    const sources=deps.registry.getSnapshot(),rows=this.value.rows.map(row=>{const current=sources.find(s=>s.id===row.sourceId);return!current||current.revision!==row.revision||(row.platform!==undefined&&!deps.registry.isCurrent(current))?{...row,status:'source-changed' as const}:row;});
    if(rows.some((row,i)=>row!==this.value.rows[i]))this.publish({...this.value,rows});
  });}
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private publish(value:HealthSnapshot){this.value=value;for(const listener of this.listeners)listener();}
  cancel(){this.pending?.abort();this.pending=undefined;for(const child of this.children.values())child.abort.abort();this.children.clear();if(this.value.running)this.publish({...this.value,running:false,cancelled:true,finishedAt:this.now(),rows:this.value.rows.map(row=>active.has(row.status)?{...row,status:'cancelled'}:row)});}
  dispose(){this.cancel();this.unsubscribe();this.listeners.clear();}
  report(){return JSON.stringify({...this.value,rows:this.value.rows.map(row=>({...row}))},null,2);}
  async run(ids:readonly string[],keyword:string,qualities:readonly Quality[]=qualityOrder):Promise<void>{
    const query=keyword.trim();if(!query||query.length>250||!ids.length||ids.length>32||!qualities.length||qualities.some(q=>!qualityOrder.includes(q)))throw new Error('请选择音源、音质并输入250字以内关键词');
    const selected=[...new Set(ids)].map(id=>this.deps.registry.getSnapshot().find(source=>source.id===id));if(selected.some(s=>!s))throw new Error('部分音源已删除，请重新选择');
    this.cancel();const generation=++this.generation,pending=new AbortController();this.pending=pending;const signal=pending.signal,rows:HealthRow[]=[],jobs:Array<{source:SourceState;rows:HealthRow[]}>=[];
    for(const source of selected as SourceState[]){const group:HealthRow[]=[];
      if(this.deps.registry.isCurrent(source))for(const platform of platforms){const capability=source.capabilities.find(c=>c.platform===platform&&c.actions.includes('musicUrl'));if(!capability)continue;
        for(const quality of qualityOrder.filter(q=>qualities.includes(q))){const scriptQuality=capability.qualities.find(q=>normalizeQuality(q)===quality);if(scriptQuality)group.push({id:JSON.stringify([source.id,source.revision,platform,quality]),sourceId:source.id,sourceName:label(source.name),revision:source.revision,fingerprint:source.fingerprint,platform,quality,scriptQuality,status:'pending',elapsedMs:0});}
      }
      if(!group.length)group.push({id:JSON.stringify([source.id,source.revision]),sourceId:source.id,sourceName:label(source.name),revision:source.revision,fingerprint:source.fingerprint,status:this.deps.registry.isCurrent(source)?'unsupported':'not-ready',elapsedMs:0});
      rows.push(...group);jobs.push({source,rows:group});
    }
    this.publish({version:1,startedAt:this.now(),running:true,cancelled:false,rows});
    const update=(row:HealthRow,patch:Partial<HealthRow>)=>{if(generation!==this.generation||signal.aborted)return;const status=this.value.rows.find(r=>r.id===row.id)?.status;if(status==='source-changed')return;this.publish({...this.value,rows:this.value.rows.map(r=>r.id===row.id?{...r,...patch}:r)});};
    const searches=new Map<OnlinePlatform,Promise<Track|undefined>>();
    const search=(platform:OnlinePlatform)=>{let result=searches.get(platform);if(!result){result=bounded(child=>this.deps.online.search(platform,query,1,child,1),signal,this.deps.timeoutMs??8000).then(result=>result.items.find(track=>track.origin.kind==='online'&&track.origin.platform===platform));searches.set(platform,result);}return result;};
    let next=0;
    const worker=async()=>{while(next<jobs.length&&!signal.aborted&&generation===this.generation){const job=jobs[next++]!,source=job.source,abort=new AbortController();let session:DiagnosticSession|undefined;this.children.set(source.id,{source,abort});const parentAbort=()=>abort.abort();signal.addEventListener('abort',parentAbort,{once:true});if(signal.aborted)abort.abort();
      try{
        if(!job.rows.some(row=>row.platform))continue;
        const initStart=this.now();for(const row of job.rows)update(row,{status:'initializing'});
        try{session=await bounded(async child=>{const opened=await this.deps.open(source,child);if(child.aborted){opened.dispose();throwIfAborted(child);}return opened;},abort.signal,20000);}
        catch(error){for(const row of job.rows)update(row,{status:!this.deps.registry.isCurrent(source)?'source-changed':error instanceof DeadlineError?'timeout':'init-error',elapsedMs:this.now()-initStart});continue;}
        for(const row of job.rows)update(row,{status:'pending',initializationMs:this.now()-initStart});
        for(const row of job.rows){if(!row.platform)continue;if(signal.aborted||generation!==this.generation)break;if(!this.deps.registry.isCurrent(source)){update(row,{status:'source-changed'});continue;}
        const start=this.now();let stage:HealthStatus='searching';update(row,{status:stage});
        try{const track=await bounded(()=>search(row.platform!),abort.signal,this.deps.timeoutMs??8000);throwIfAborted(abort.signal);if(!track){update(row,{status:'no-song',elapsedMs:this.now()-start});continue;}
          stage='resolving';update(row,{status:stage,song:label(`${track.title} · ${track.artist}`)});const resolutionStart=this.now();
          const capability=session.capabilities.find(c=>c.platform===row.platform&&c.actions.includes('musicUrl')),scriptQuality=capability?.qualities.find(q=>normalizeQuality(q)===row.quality);
          if(!capability||!scriptQuality){update(row,{status:'unsupported',elapsedMs:this.now()-start});continue;}update(row,{scriptQuality});
          const result=await bounded(child=>session!.request(makeLXRequest(track,scriptQuality,capability),child),abort.signal,this.deps.timeoutMs??8000);throwIfAborted(abort.signal);
          const resolutionMs=this.now()-resolutionStart,raw=typeof result==='string'?result:result&&typeof result==='object'?(result as {url?:unknown}).url:undefined;let url:URL|undefined;try{if(typeof raw==='string'&&raw.length<=8192)url=new URL(raw);}catch{/* No private response in reports. */}
          if(!url||!['http:','https:'].includes(url.protocol)||!url.hostname||url.username||url.password){update(row,{status:'url-error',resolutionMs,elapsedMs:this.now()-start});continue;}
          stage='probing';update(row,{status:stage,resolutionMs});const probeStart=this.now(),probe=await bounded(child=>this.deps.probe(url.toString(),child),abort.signal,14000);throwIfAborted(abort.signal);
          if(!this.deps.registry.isCurrent(source)){update(row,{status:'source-changed'});continue;}
          update(row,{status:probe.state,httpStatus:probe.status,bytes:probe.bytes,format:probe.format,probeMs:this.now()-probeStart,elapsedMs:this.now()-start});
        }catch(error){if(signal.aborted||generation!==this.generation)break;update(row,{status:!this.deps.registry.isCurrent(source)?'source-changed':error instanceof DeadlineError?'timeout':stage==='searching'?'search-error':stage==='resolving'?'url-error':'network-error',elapsedMs:this.now()-start});}
      }}finally{session?.dispose();signal.removeEventListener('abort',parentAbort);if(this.children.get(source.id)?.abort===abort)this.children.delete(source.id);}
    }};
    await Promise.all([worker(),worker()]);if(generation===this.generation&&!signal.aborted){this.pending=undefined;this.publish({...this.value,running:false,finishedAt:this.now()});pending.abort();}
  }
}
