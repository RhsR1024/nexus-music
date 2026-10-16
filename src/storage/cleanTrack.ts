import type {Track} from "../domain/track.ts";
export function cleanTrack(track:Track):Track {
  const secret=/password|authorization|cookie|api[_-]?key|token|credential|secret|rawscript/i;
  const safeURL=(value:string)=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&![...url.searchParams.keys()].some(key=>secret.test(key)||['u','p','t','s'].includes(key));}catch{return false;}};
  const metadata=JSON.parse(JSON.stringify(track.metadata,(key,value)=>{
    if(secret.test(key))return undefined;
    if(typeof value==='string'&&/^(?:file|ipod-library):\/\//i.test(value))return undefined;
    if(typeof value==='string'&&/^https?:\/\//i.test(value)){
      try{const url=new URL(value);if(url.username||url.password||[...url.searchParams.keys()].some(key=>secret.test(key)||['u','p','t','s'].includes(key)))return undefined;}catch{return undefined;}
    }
    return value;
  })) as Record<string,unknown>;
  return {origin:track.origin.kind==='webdav'?{kind:'webdav',accountId:track.origin.accountId,id:track.origin.id}:track.origin.kind==='device'?{kind:'device',libraryId:track.origin.libraryId,id:track.origin.id}:track.origin.kind==='local'?{kind:'local',id:track.origin.id}:track.origin.kind==='online'?{kind:'online',platform:track.origin.platform,id:track.origin.id}:track.origin.kind==='imported'?{kind:'imported',platform:'qishui',id:track.origin.id}:{kind:'navidrome',accountId:track.origin.accountId,id:track.origin.id},title:track.title,artist:track.artist,
    ...(track.album!==undefined?{album:track.album}:{}),...(track.durationMs!==undefined?{durationMs:track.durationMs}:{}),
    ...(track.origin.kind!=='navidrome'&&track.origin.kind!=='webdav'&&track.artwork&&safeURL(track.artwork)?{artwork:track.artwork}:{}),metadata,qualities:track.qualities.map(item=>({id:item.id,...(item.sizeBytes!==undefined?{sizeBytes:item.sizeBytes}:{})}))};
}
