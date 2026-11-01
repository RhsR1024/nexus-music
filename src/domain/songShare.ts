import type {Track} from './track.ts';

// Construct only public detail URLs from typed identifiers. Playback URLs,
// account origins, headers and arbitrary provider metadata are never shared.
export function publicSongURL(track:Track):string|undefined{
 if(track.origin.kind!=='online')return;
 const {platform,id}=track.origin,numeric=/^[1-9]\d{0,23}$/;
 if(platform==='wy'&&numeric.test(id))return `https://music.163.com/#/song?id=${id}`;
 if(platform==='tx'&&/^[A-Za-z0-9]{10,32}$/.test(id))return `https://y.qq.com/n/yqq/song/${id}.html`;
 if(platform==='kw'&&numeric.test(id))return `https://www.kuwo.cn/play_detail/${id}`;
 if(platform==='kg'){
  const hash=typeof track.metadata.hash==='string'?track.metadata.hash:id;
  if(!/^[a-f\d]{32}$/i.test(hash))return;
  const album=typeof track.metadata.albumId==='string'&&numeric.test(track.metadata.albumId)?track.metadata.albumId:undefined;
  return `https://www.kugou.com/song/#hash=${hash.toUpperCase()}${album?`&album_id=${album}`:''}`;
 }
 if(platform==='mg'){
  const copyright=typeof track.metadata.copyrightId==='string'?track.metadata.copyrightId:undefined;
  if(copyright&&/^[A-Za-z0-9]{5,40}$/.test(copyright))return `https://music.migu.cn/v3/music/song/${copyright}`;
 }
}
const display=(value:string)=>Array.from(value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()).slice(0,160).join('');
export function songShareText(track:Track){
 const title=display(track.title)||'未命名歌曲',artist=display(track.artist),url=publicSongURL(track);
 return `${title}${artist?` — ${artist}`:''}${url?`\n${url}`:''}`;
}
