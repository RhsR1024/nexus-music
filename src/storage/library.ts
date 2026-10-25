import {InvalidRecordError} from './recovery.ts';
import { trackKey, validateTrack, type Track } from '../domain/track.ts';
import type { Repository } from './repository.ts';
import {originalSignature,lyricSignature} from '../domain/matching.ts';
import {cleanTrack} from './cleanTrack.ts';
import {MutationQueue} from './mutations.ts';
export interface LocalEntry {id:string;track:Track}
export interface LocalPlaylist {id:string;title:string;entries:readonly LocalEntry[];createdAt:number;updatedAt:number;description?:string;coverUrl?:string}
export interface TrackMatch {original:Track;target:Track;method:'automatic'|'manual';updatedAt:number}
export interface LyricChoice {original:Track;mode:'original'|'automatic'|'manual';target?:Track;updatedAt:number}
export interface LibraryState {version:1;favorites:readonly Track[];history:readonly {track:Track;playedAt:number}[];playlists:readonly LocalPlaylist[];matches?:readonly TrackMatch[];lyricChoices?:readonly LyricChoice[]}
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
    if(playlist.description!==undefined&&(typeof playlist.description!=='string'||playlist.description.length>512))throw new Error('歌单描述无效');
    if(playlist.coverUrl!==undefined&&(typeof playlist.coverUrl!=='string'||playlist.coverUrl.length>2048))throw new Error('歌单封面地址无效');
    playlistIds.add(playlist.id);const entries=new Set<string>();
    for(const entry of playlist.entries){if(!entry||!entry.id||typeof entry.id!=='string'||entries.has(entry.id))throw new Error('歌单条目ID无效');entries.add(entry.id);validateTrack(entry.track);}
  }
  if(library.matches!==undefined){
    if(!Array.isArray(library.matches))throw new Error('匹配记录格式无效');const keys=new Set<string>();
    for(const match of library.matches){validateTrack(match.original);validateTrack(match.target);const key=trackKey(match.original.origin);
      if(!['imported','online'].includes(match.original.origin.kind)||match.target.origin.kind!=='online'||key===trackKey(match.target.origin)||keys.has(key)||!['automatic','manual'].includes(match.method)||!Number.isFinite(match.updatedAt)||match.updatedAt<0)throw new Error('匹配记录无效');keys.add(key);
    }
  }
  if(library.lyricChoices!==undefined){
    if(!Array.isArray(library.lyricChoices)||library.lyricChoices.length>1000)throw new Error('歌词选择格式无效');const keys=new Set<string>();
    for(const choice of library.lyricChoices){
      validateTrack(choice.original);const key=trackKey(choice.original.origin);
      if(keys.has(key)||!['original','automatic','manual'].includes(choice.mode)||!Number.isFinite(choice.updatedAt)||choice.updatedAt<0)throw new Error('歌词选择无效');keys.add(key);
      if(choice.mode==='manual'){validateTrack(choice.target!);if(choice.target!.origin.kind!=='online')throw new Error('歌词候选必须是公开平台曲目');}
      else if(choice.target!==undefined)throw new Error('非人工歌词不能绑定目标');
      if(choice.mode==='automatic'&&!['online','imported'].includes(choice.original.origin.kind))throw new Error('私人曲目不能自动搜索歌词');
    }
  }
  return library;
}
export class LibraryStore {
  private repository:Pick<Repository,'get'|'put'>;private uuid:()=>string;private now:()=>number;
  private value:LibraryState=emptyLibrary;private listeners=new Set<()=>void>();private tail:Promise<unknown>=Promise.resolve();
  private mutations:MutationQueue;
  constructor(repository:Pick<Repository,'get'|'put'>,uuid:()=>string,now:()=>number=Date.now,mutations=new MutationQueue()){this.repository=repository;this.uuid=uuid;this.now=now;this.mutations=mutations;}
  getSnapshot=()=>this.value;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  async restore(){const value=await this.repository.get<unknown>('library.v1');if(value){try{this.value=validateLibrary(value);}catch{throw new InvalidRecordError();}}for(const listener of this.listeners)listener();}
  settled(){return this.tail;}
  private change(run:(current:LibraryState)=>LibraryState) {
    const next=this.mutations.run(async()=>{const value=validateLibrary(run(this.value));await this.repository.put('library.v1',value);this.value=value;for(const listener of this.listeners)listener();});
    this.tail=next.catch(()=>{});return next;
  }
  isFavorite(track:Track){const key=trackKey(track.origin);return this.value.favorites.some(item=>trackKey(item.origin)===key);}
  matchFor(track:Track){const signature=originalSignature(track);return this.value.matches?.find(value=>originalSignature(value.original)===signature);}
  lyricChoiceFor(track:Track){const signature=lyricSignature(track);return this.value.lyricChoices?.find(value=>lyricSignature(value.original)===signature);}
  setLyricChoice(original:Track,mode:LyricChoice['mode'],target?:Track,signal?:AbortSignal){
    validateTrack(original);if(target)validateTrack(target);
    return this.change(current=>{if(signal?.aborted)throw new Error('操作已取消');return{...current,lyricChoices:[{original:cleanTrack(original),mode,...(target?{target:cleanTrack(target)}:{}),updatedAt:this.now()},...(current.lyricChoices??[]).filter(item=>trackKey(item.original.origin)!==trackKey(original.origin))].slice(0,1000)};});
  }
  setMatch(original:Track,target:Track,method:'automatic'|'manual',guard?:{signal:AbortSignal;previous:TrackMatch|undefined}){
    return this.change(current=>{if(guard){if(guard.signal.aborted)throw guard.signal.reason;const previous=current.matches?.find(item=>originalSignature(item.original)===originalSignature(original));if(previous!==guard.previous)throw new Error('匹配设置已更改');}return({...current,matches:[...(current.matches??[]).filter(value=>trackKey(value.original.origin)!==trackKey(original.origin)),{original:cleanTrack(original),target:cleanTrack(target),method,updatedAt:this.now()}]});});
  }
  removeMatch(original:Track){return this.change(current=>({...current,matches:(current.matches??[]).filter(value=>trackKey(value.original.origin)!==trackKey(original.origin))}));}
  favorite(track:Track){validateTrack(track);return this.change(current=>{const key=trackKey(track.origin),exists=current.favorites.some(item=>trackKey(item.origin)===key);return{...current,favorites:exists?current.favorites.filter(item=>trackKey(item.origin)!==key):[track,...current.favorites]};});}
  setFavorite(track:Track,favorite:boolean,valid:()=>boolean=()=>true){
    validateTrack(track);return this.change(current=>{
      if(!valid())throw new Error('媒体已更改');
      const key=trackKey(track.origin),exists=current.favorites.some(item=>trackKey(item.origin)===key);
      if(exists===favorite)return current;
      return{...current,favorites:favorite?[cleanTrack(track),...current.favorites]:current.favorites.filter(item=>trackKey(item.origin)!==key)};
    });
  }
  played(track:Track){validateTrack(track);return this.change(current=>({...current,history:[{track,playedAt:this.now()},...current.history.filter(item=>trackKey(item.track.origin)!==trackKey(track.origin))].slice(0,300)}));}
  clearHistory(){return this.change(current=>({...current,history:[]}));}
  removeHistory(track:Track){return this.change(current=>({...current,history:current.history.filter(item=>trackKey(item.track.origin)!==trackKey(track.origin))}));}
  async createPlaylist(title:string,tracks:readonly Track[]=[],meta:{description?:string;coverUrl?:string}={}){tracks.forEach(validateTrack);const id=this.uuid(),time=this.now();await this.change(current=>({...current,playlists:[...current.playlists,{id,title:title.trim(),entries:tracks.map(track=>({id:this.uuid(),track})),createdAt:time,updatedAt:time,...(meta.description?.trim()?{description:meta.description.trim()}:{}) , ...(meta.coverUrl?.trim()?{coverUrl:meta.coverUrl.trim()}:{})}]}));return id;}
  // Undo for delete-playlist (Sollin E-1240): put the captured playlist back.
  // A same-id conflict (possible if the user created one in the undo window)
  // falls back to a fresh id so restore never corrupts the list.
  async restorePlaylist(playlist:LocalPlaylist){await this.change(current=>current.playlists.some(item=>item.id===playlist.id)?current:{...current,playlists:[...current.playlists,playlist]});return;}
  updatePlaylistMeta(id:string,meta:{description?:string;coverUrl?:string}){return this.updatePlaylist(id,playlist=>({...playlist,...(meta.description!==undefined?{description:meta.description.trim()||undefined}:{}),...(meta.coverUrl!==undefined?{coverUrl:meta.coverUrl.trim()||undefined}:{})}));}
  renamePlaylist(id:string,title:string){return this.updatePlaylist(id,playlist=>({...playlist,title:title.trim()}));}
  deletePlaylist(id:string){return this.change(current=>({...current,playlists:current.playlists.filter(item=>item.id!==id)}));}
  addTracks(id:string,tracks:readonly Track[]){tracks.forEach(validateTrack);return this.updatePlaylist(id,playlist=>({...playlist,entries:[...playlist.entries,...tracks.map(track=>({id:this.uuid(),track}))]}));}
  removeEntry(id:string,entryId:string){return this.updatePlaylist(id,playlist=>({...playlist,entries:playlist.entries.filter(item=>item.id!==entryId)}));}
  removeEntries(id:string,entryIds:readonly string[]){const wanted=new Set(entryIds);return this.updatePlaylist(id,playlist=>({...playlist,entries:playlist.entries.filter(item=>!wanted.has(item.id))}));}
  removeFavorites(tracks:readonly Track[]){const wanted=new Set(tracks.map(track=>trackKey(track.origin)));return this.change(current=>({...current,favorites:current.favorites.filter(track=>!wanted.has(trackKey(track.origin)))}));}
  // Batch add keeps the argument (selection) order as one block at the front;
  // already-favorited tracks stay untouched instead of toggling off.
  addFavorites(tracks:readonly Track[]){tracks.forEach(validateTrack);return this.change(current=>{
    const missing=tracks.filter(track=>!current.favorites.some(item=>trackKey(item.origin)===trackKey(track.origin))).map(cleanTrack);
    if(!missing.length)return current;
    return{...current,favorites:[...missing,...current.favorites]};
  });}
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
