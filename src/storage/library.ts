import {InvalidRecordError} from './recovery.ts';
import { trackKey, validateTrack, type Track } from '../domain/track.ts';
import type { Repository } from './repository.ts';
import {originalSignature} from '../domain/matching.ts';
import {cleanTrack} from './cleanTrack.ts';
export interface LocalEntry {id:string;track:Track}
export interface LocalPlaylist {id:string;title:string;entries:readonly LocalEntry[];createdAt:number;updatedAt:number}
export interface TrackMatch {original:Track;target:Track;method:'automatic'|'manual';updatedAt:number}
export interface LibraryState {version:1;favorites:readonly Track[];history:readonly {track:Track;playedAt:number}[];playlists:readonly LocalPlaylist[];matches?:readonly TrackMatch[]}
export const emptyLibrary:LibraryState={version:1,favorites:[],history:[],playlists:[]};
export function validateLibrary(value:unknown):LibraryState {
  if(!value||typeof value!=='object')throw new Error('音乐库格式无效');
  const library=value as LibraryState;
  if(library.version!==1||!Array.isArray(library.favorites)||!Array.isArray(library.history)||!Array.isArray(library.playlists))throw new Error('音乐库版本或结构无效');
  library.favorites.forEach(validateTrack);
  if(new Set(library.favorites.map(track=>trackKey(track.origin))).size!==library.favorites.length)throw new Error('收藏ID重复');
  for(const item of library.history){validateTrack(item.track);if(!Number.isFinite(item.playedAt)||item.playedAt<0)throw new Error('历史数据无效');}
  const playlistIds=new Set<string>();
  for(const playlist of library.playlists){
    if(!playlist||typeof playlist.id!=='string'||!playlist.id||playlistIds.has(playlist.id)||typeof playlist.title!=='string'||!playlist.title.trim()||!Array.isArray(playlist.entries)||!Number.isFinite(playlist.createdAt)||!Number.isFinite(playlist.updatedAt))throw new Error('歌单结构无效');
    playlistIds.add(playlist.id);const entries=new Set<string>();
    for(const entry of playlist.entries){if(!entry||!entry.id||typeof entry.id!=='string'||entries.has(entry.id))throw new Error('歌单条目ID无效');entries.add(entry.id);validateTrack(entry.track);}
  }
  if(library.matches!==undefined){
    if(!Array.isArray(library.matches))throw new Error('匹配记录格式无效');const keys=new Set<string>();
    for(const match of library.matches){validateTrack(match.original);validateTrack(match.target);const key=trackKey(match.original.origin);
      if(!['imported','online'].includes(match.original.origin.kind)||match.target.origin.kind!=='online'||key===trackKey(match.target.origin)||keys.has(key)||!['automatic','manual'].includes(match.method)||!Number.isFinite(match.updatedAt)||match.updatedAt<0)throw new Error('匹配记录无效');keys.add(key);
    }
  }
  return library;
}
export class LibraryStore {
  private repository:Pick<Repository,'get'|'put'>;private uuid:()=>string;private now:()=>number;
  private value:LibraryState=emptyLibrary;private listeners=new Set<()=>void>();private tail:Promise<unknown>=Promise.resolve();
  constructor(repository:Pick<Repository,'get'|'put'>,uuid:()=>string,now:()=>number=Date.now){this.repository=repository;this.uuid=uuid;this.now=now;}
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  async restore(){const value=await this.repository.get<unknown>('library.v1');if(value){try{this.value=validateLibrary(value);}catch{throw new InvalidRecordError();}}}
  private change(run:(current:LibraryState)=>LibraryState) {
    const next=this.tail.then(async()=>{const value=validateLibrary(run(this.value));await this.repository.put('library.v1',value);this.value=value;for(const listener of this.listeners)listener();});
    this.tail=next.catch(()=>{});return next;
  }
  isFavorite(track:Track){const key=trackKey(track.origin);return this.value.favorites.some(item=>trackKey(item.origin)===key);}
  matchFor(track:Track){const signature=originalSignature(track);return this.value.matches?.find(value=>originalSignature(value.original)===signature);}
  setMatch(original:Track,target:Track,method:'automatic'|'manual',guard?:{signal:AbortSignal;previous:TrackMatch|undefined}){
    return this.change(current=>{if(guard){if(guard.signal.aborted)throw guard.signal.reason;const previous=current.matches?.find(item=>originalSignature(item.original)===originalSignature(original));if(previous!==guard.previous)throw new Error('匹配设置已更改');}return({...current,matches:[...(current.matches??[]).filter(value=>trackKey(value.original.origin)!==trackKey(original.origin)),{original:cleanTrack(original),target:cleanTrack(target),method,updatedAt:this.now()}]});});
  }
  removeMatch(original:Track){return this.change(current=>({...current,matches:(current.matches??[]).filter(value=>trackKey(value.original.origin)!==trackKey(original.origin))}));}
  favorite(track:Track){validateTrack(track);return this.change(current=>{const key=trackKey(track.origin),exists=current.favorites.some(item=>trackKey(item.origin)===key);return{...current,favorites:exists?current.favorites.filter(item=>trackKey(item.origin)!==key):[track,...current.favorites]};});}
  played(track:Track){validateTrack(track);return this.change(current=>({...current,history:[{track,playedAt:this.now()},...current.history.filter(item=>trackKey(item.track.origin)!==trackKey(track.origin))].slice(0,300)}));}
  clearHistory(){return this.change(current=>({...current,history:[]}));}
  removeHistory(track:Track){return this.change(current=>({...current,history:current.history.filter(item=>trackKey(item.track.origin)!==trackKey(track.origin))}));}
  async createPlaylist(title:string,tracks:readonly Track[]=[]){tracks.forEach(validateTrack);const id=this.uuid(),time=this.now();await this.change(current=>({...current,playlists:[...current.playlists,{id,title:title.trim(),entries:tracks.map(track=>({id:this.uuid(),track})),createdAt:time,updatedAt:time}]}));return id;}
  renamePlaylist(id:string,title:string){return this.updatePlaylist(id,playlist=>({...playlist,title:title.trim()}));}
  deletePlaylist(id:string){return this.change(current=>({...current,playlists:current.playlists.filter(item=>item.id!==id)}));}
  addTracks(id:string,tracks:readonly Track[]){tracks.forEach(validateTrack);return this.updatePlaylist(id,playlist=>({...playlist,entries:[...playlist.entries,...tracks.map(track=>({id:this.uuid(),track}))]}));}
  removeEntry(id:string,entryId:string){return this.updatePlaylist(id,playlist=>({...playlist,entries:playlist.entries.filter(item=>item.id!==entryId)}));}
  removeEntries(id:string,entryIds:readonly string[]){const wanted=new Set(entryIds);return this.updatePlaylist(id,playlist=>({...playlist,entries:playlist.entries.filter(item=>!wanted.has(item.id))}));}
  removeFavorites(tracks:readonly Track[]){const wanted=new Set(tracks.map(track=>trackKey(track.origin)));return this.change(current=>({...current,favorites:current.favorites.filter(track=>!wanted.has(trackKey(track.origin)))}));}
  removeHistoryTracks(tracks:readonly Track[]){const wanted=new Set(tracks.map(track=>trackKey(track.origin)));return this.change(current=>({...current,history:current.history.filter(item=>!wanted.has(trackKey(item.track.origin)))}));}
  moveEntry(id:string,entryId:string,to:number){return this.updatePlaylist(id,playlist=>{
    const entries=[...playlist.entries],from=entries.findIndex(item=>item.id===entryId);
    if(from<0||!Number.isInteger(to)||to<0||to>=entries.length)throw new Error('移动位置无效');
    const [entry]=entries.splice(from,1);entries.splice(to,0,entry!);return{...playlist,entries};
  });}
  private updatePlaylist(id:string,run:(playlist:LocalPlaylist)=>LocalPlaylist){return this.change(current=>{
    if(!current.playlists.some(item=>item.id===id))throw new Error('歌单不存在');
    return{...current,playlists:current.playlists.map(item=>item.id===id?{...run(item),updatedAt:this.now()}:item)};
  });}
  replace(library:LibraryState){validateLibrary(library);return this.change(()=>library);}
  addPlaylists(playlists:readonly LocalPlaylist[],favorites:readonly Track[]=[]){return this.change(current=>{
    const keys=new Set(current.favorites.map(track=>trackKey(track.origin))),added= favorites.filter(track=>{const key=trackKey(track.origin);if(keys.has(key))return false;keys.add(key);return true;});
    return{...current,playlists:[...current.playlists,...playlists],favorites:[...current.favorites,...added]};
  });}
  importCollections(collections:readonly {title:string;tracks:readonly Track[]}[],favorites:readonly Track[]=[]){
    return this.change(current=>{
      const time=this.now(),playlists=collections.map(item=>({id:this.uuid(),title:item.title,createdAt:time,updatedAt:time,entries:item.tracks.map(track=>({id:this.uuid(),track}))}));
      const keys=new Set(current.favorites.map(track=>trackKey(track.origin))),added=favorites.filter(track=>{const key=trackKey(track.origin);if(keys.has(key))return false;keys.add(key);return true;});
      return{...current,playlists:[...current.playlists,...playlists],favorites:[...current.favorites,...added]};
    });
  }
}
