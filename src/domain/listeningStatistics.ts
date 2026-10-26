import {trackKey,type Track} from './track.ts';
import type {PlaybackStatsState} from '../storage/playbackStats.ts';
import {listeningPeriod} from './listeningActivity.ts';
export type StatisticsGroup='songs'|'artists'|'albums';
export type StatisticsSort='duration'|'plays';
export interface StatisticsRow {id:string;title:string;subtitle:string;tracks:readonly Track[];listenedMs:number;playCount:number}
const unknownArtists=new Set(['未知艺术家','未知歌手','unknown artist','<unknown>']);
const unknownAlbums=new Set(['未知专辑','unknown album','<unknown>']);
export function listeningStatistics(state:PlaybackStatsState,group:StatisticsGroup,sort:StatisticsSort,day?:string){
  const groups=new Map<string,StatisticsRow>(),days=new Map<string,{listenedMs:number;playCount:number}>(),artists=new Set<string>(),albums=new Set<string>();let songCount=0;
  const hours=Array.from({length:24},()=>({listenedMs:0,playCount:0}));let totalMs=0,totalPlays=0,undatedMs=0,undatedPlays=0;
  for(const item of state.items){
    let datedMs=0,datedPlays=0,selectedMs=0,selectedPlays=0;
    for(const bucket of item.activity??[]){
      datedMs+=bucket.listenedMs;datedPlays+=bucket.playCount;
      const current=days.get(bucket.day)??{listenedMs:0,playCount:0};current.listenedMs+=bucket.listenedMs;current.playCount+=bucket.playCount;days.set(bucket.day,current);
      if(!day||bucket.day===day){selectedMs+=bucket.listenedMs;selectedPlays+=bucket.playCount;hours[bucket.hour]!.listenedMs+=bucket.listenedMs;hours[bucket.hour]!.playCount+=bucket.playCount;}
    }
    undatedMs+=Math.max(0,item.listenedMs-datedMs);undatedPlays+=Math.max(0,item.playCount-datedPlays);
    const ms=day?selectedMs:item.listenedMs,plays=day?selectedPlays:item.playCount;
    if(day&&ms===0&&plays===0)continue;
    totalMs+=ms;totalPlays+=plays;
    const rawArtist=item.track.artist.trim(),rawAlbum=item.track.album?.trim()??'';
    // Native imports retain a display fallback when ID3 has no artist. It is
    // still missing metadata and must not manufacture a known artist count.
    const artist=unknownArtists.has(rawArtist.toLowerCase())?'':rawArtist,album=unknownAlbums.has(rawAlbum.toLowerCase())?'':rawAlbum;
    songCount++;if(artist)artists.add(artist);if(album)albums.add(JSON.stringify([album,artist]));
    const id=group==='songs'?trackKey(item.track.origin):JSON.stringify(group==='artists'?[artist]:[album,artist]);
    const previous=groups.get(id),title=group==='songs'?item.track.title:group==='artists'?artist||'未知艺术家':album||'未知专辑';
    const subtitle=group==='songs'?artist||'未知艺术家':group==='albums'?artist||'未知艺术家':'';
    if(previous){previous.listenedMs+=ms;previous.playCount+=plays;previous.tracks=[...previous.tracks,item.track];}
    else groups.set(id,{id,title,subtitle,tracks:[item.track],listenedMs:ms,playCount:plays});
  }
  const rows=[...groups.values()].sort((a,b)=>(sort==='duration'?b.listenedMs-a.listenedMs:b.playCount-a.playCount)||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
  return {rows,hours,totalMs,totalPlays,undatedMs,undatedPlays,songCount,artistCount:artists.size,albumCount:albums.size,days:[...days].sort(([a],[b])=>b.localeCompare(a)).map(([date,counts])=>({date,...counts}))};
}
export function listeningCalendar(days:readonly {date:string;listenedMs:number;playCount:number}[],now:number){
  const today=listeningPeriod(now).day,end=Date.parse(today+'T00:00:00Z'),known=new Map(days.map(day=>[day.date,day]));
  return Array.from({length:90},(_,index)=>{const date=new Date(end-(89-index)*86400000).toISOString().slice(0,10);return {date,listenedMs:known.get(date)?.listenedMs??null,playCount:known.get(date)?.playCount??null};});
}
export function listeningDuration(ms:number){const seconds=Math.floor(ms/1000),hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60);return hours?`${hours}小时${minutes}分`:`${minutes}分${seconds%60}秒`;}
