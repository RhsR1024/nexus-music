import type { Track } from '../domain/track.ts';
import { HTTPResponseError, requestJSON, type HTTPClient } from './http.ts';
import { throwIfAborted } from './async.ts';

type Row = Record<string,unknown>;
const object = (value:unknown):Row => value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const array = (value:unknown):unknown[] => Array.isArray(value)?value:[];
const text = (value:unknown) => typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
const numeric = (value:unknown) => {if(value===undefined||value===null||value==='')return undefined;const number=Number(value);return Number.isFinite(number)&&number>=0?number:undefined;};
export interface NavidromeAccount { id:string; url:string; username:string }
export interface NavidromeCredentials { username:string; password:string }
export class NavidromeError extends Error {
  readonly kind:'authentication'|'permission'|'protocol'|'network'|'not-found'; readonly code?:number;
  constructor(kind:NavidromeError['kind'],code?:number) {
    super({authentication:'认证失败，请检查账号密码',permission:'服务器未授权此操作',protocol:'服务器协议或响应不兼容',network:'无法连接服务器，请检查网络和地址','not-found':'服务器上没有找到此内容'}[kind]);
    this.kind=kind; this.code=code;
  }
}
export function normalizeServerURL(value:string) {
  let parsed:URL;
  try {parsed=new URL(value.trim());} catch {throw new NavidromeError('protocol');}
  if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname||parsed.username||parsed.password||parsed.search||parsed.hash) throw new NavidromeError('protocol');
  return parsed.toString().replace(/\/+$/,'').replace(/\/rest$/,'');
}
export function navidromeTrack(accountId:string,raw:unknown):Track {
  const value=object(raw),id=text(value.id),duration=numeric(value.duration);
  if(!id||!text(value.title)) throw new NavidromeError('protocol');
  return {origin:{kind:'navidrome',accountId,id},title:text(value.title),artist:text(value.artist),album:text(value.album),
    ...(duration!==undefined?{durationMs:duration*1000}:{}),metadata:{albumId:text(value.albumId),artistId:text(value.artistId),coverArtId:text(value.coverArt),
      suffix:text(value.suffix),contentType:text(value.contentType),bitRate:numeric(value.bitRate),sizeBytes:numeric(value.size),samplingRate:numeric(value.samplingRate),bitDepth:numeric(value.bitDepth),starred:!!value.starred},qualities:[]};
}
export interface ServerAlbum { id:string; title:string; artist:string; coverArtId?:string; songCount?:number }
export interface ServerPlaylist { id:string; title:string; owner:string; songCount?:number; public:boolean }
type Params=Readonly<Record<string,string|number|boolean|readonly string[]|readonly number[]|undefined>>;
export class NavidromeClient {
  readonly account:NavidromeAccount;
  private credentials:NavidromeCredentials; private http:HTTPClient; private md5:(value:string)=>Promise<string>; private salt:()=>string;
  constructor(account:NavidromeAccount,credentials:NavidromeCredentials,dependencies:{http?:HTTPClient;md5:(value:string)=>Promise<string>;salt:()=>string}) {
    this.account={...account,url:normalizeServerURL(account.url)}; this.credentials=credentials; this.http=dependencies.http??requestJSON; this.md5=dependencies.md5; this.salt=dependencies.salt;
  }
  private async parameters(params:Params,signal:AbortSignal) {
    throwIfAborted(signal); const salt=this.salt();
    if(salt.length<6) throw new NavidromeError('protocol');
    const token=await this.md5(this.credentials.password+salt); throwIfAborted(signal);
    const values:Params={u:this.credentials.username,t:token,s:salt,v:'1.16.1',c:'NexusMusic',f:'json',...params};
    return Object.entries(values).flatMap(([key,value])=>value===undefined?[]:(Array.isArray(value)?value:[value]).map(item=>`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`)).join('&');
  }
  async request(method:string,params:Params={},signal:AbortSignal=new AbortController().signal):Promise<Row> {
    const body=await this.parameters(params,signal); let raw:unknown;
    try {raw=await this.http(`${this.account.url}/rest/${method}.view`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body},signal);}
    catch(error) {
      throwIfAborted(signal);
      if(error instanceof HTTPResponseError) throw new NavidromeError(error.status===401?'authentication':error.status===403?'permission':'network');
      throw new NavidromeError('network');
    }
    const response=object(object(raw)['subsonic-response']);
    if(response.status==='failed') {
      const code=Number(object(response.error).code);
      throw new NavidromeError([40,41,42,43,44].includes(code)?'authentication':code===50?'permission':code===70?'not-found':'protocol',code);
    }
    if(response.status!=='ok') throw new NavidromeError('protocol');
    return response;
  }
  async connect(signal?:AbortSignal) {
    const ping=await this.request('ping',{},signal); let extensions:unknown[]=[];
    try {extensions=array((await this.request('getOpenSubsonicExtensions',{},signal)).openSubsonicExtensions);}
    catch(error) {if(error instanceof NavidromeError&&error.kind==='authentication') throw error; if(signal) throwIfAborted(signal);}
    return {protocolVersion:text(ping.version),serverVersion:text(ping.serverVersion),serverType:text(ping.type),extensions:extensions.map(item=>({name:text(object(item).name),versions:array(object(item).versions).filter(value=>typeof value==='number')}))};
  }
  async songs(query:string,offset=0,count=100,signal?:AbortSignal) {
    const response=await this.request('search3',{query,songOffset:offset,songCount:count,albumCount:0,artistCount:0},signal);
    const songs=array(object(response.searchResult3).song).map(value=>navidromeTrack(this.account.id,value));
    return {items:songs,hasMore:songs.length===count,offset};
  }
  async albums(type='newest',offset=0,size=100,signal?:AbortSignal) {
    const response=await this.request('getAlbumList2',{type,offset,size},signal);
    const items=array(object(response.albumList2).album).map(value=>this.album(value));
    return {items,hasMore:items.length===size};
  }
  private album(raw:unknown):ServerAlbum {
    const value=object(raw); return {id:text(value.id),title:text(value.name),artist:text(value.artist),coverArtId:text(value.coverArt)||undefined,songCount:numeric(value.songCount)};
  }
  async albumDetail(id:string,signal?:AbortSignal) {
    const value=object((await this.request('getAlbum',{id},signal)).album);
    return {...this.album(value),tracks:array(value.song).map(song=>navidromeTrack(this.account.id,song))};
  }
  async artists(signal?:AbortSignal) {
    const response=await this.request('getArtists',{},signal);
    return array(object(response.artists).index).flatMap(index=>array(object(index).artist)).map(raw=>{
      const value=object(raw);return {id:text(value.id),name:text(value.name),albumCount:numeric(value.albumCount)};
    });
  }
  async artistDetail(id:string,signal?:AbortSignal) {
    const value=object((await this.request('getArtist',{id},signal)).artist);
    return {id:text(value.id),name:text(value.name),albums:array(value.album).map(album=>this.album(album))};
  }
  async playlists(signal?:AbortSignal):Promise<ServerPlaylist[]> {
    return array(object((await this.request('getPlaylists',{},signal)).playlists).playlist).map(raw=>this.playlist(raw));
  }
  private playlist(raw:unknown):ServerPlaylist {
    const value=object(raw);return {id:text(value.id),title:text(value.name),owner:text(value.owner),songCount:numeric(value.songCount),public:value.public===true};
  }
  async playlistDetail(id:string,signal?:AbortSignal) {
    const value=object((await this.request('getPlaylist',{id},signal)).playlist);
    return {...this.playlist(value),tracks:array(value.entry).map(song=>navidromeTrack(this.account.id,song))};
  }
  async star(id:string,starred:boolean,signal?:AbortSignal) {await this.request(starred?'star':'unstar',{id},signal);}
  async savePlaylist(name:string,songIds:readonly string[],playlistId?:string,signal?:AbortSignal) {
    const response=await this.request('createPlaylist',{name,songId:songIds,playlistId},signal);
    return this.playlist(response.playlist);
  }
  async renamePlaylist(playlistId:string,name:string,signal?:AbortSignal) {await this.request('updatePlaylist',{playlistId,name},signal);}
  async changePlaylist(playlistId:string,add:readonly string[],remove:readonly number[],signal?:AbortSignal) {await this.request('updatePlaylist',{playlistId,songIdToAdd:add,songIndexToRemove:remove},signal);}
  async deletePlaylist(id:string,signal?:AbortSignal) {await this.request('deletePlaylist',{id},signal);}
  async mediaURL(method:'stream'|'getCoverArt',params:Params,signal:AbortSignal) {return `${this.account.url}/rest/${method}.view?${await this.parameters(params,signal)}`;}
  async resolve(track:Track,signal:AbortSignal) {
    if(track.origin.kind!=='navidrome'||track.origin.accountId!==this.account.id) throw new NavidromeError('protocol');
    return {url:await this.mediaURL('stream',{id:track.origin.id,format:'raw'},signal),quality:'original'};
  }
  async lyrics(id:string,artist:string,title:string,signal?:AbortSignal):Promise<unknown> {
    try {return (await this.request('getLyricsBySongId',{id},signal)).lyricsList;}
    catch(error) {if(error instanceof NavidromeError&&['authentication','permission','network'].includes(error.kind)) throw error;}
    return (await this.request('getLyrics',{artist,title},signal)).lyrics;
  }
}
