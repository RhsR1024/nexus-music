import type { Track } from '../domain/track.ts';
import { trackKey } from '../domain/track.ts';
import { makeLXActionRequest } from '../providers/lx.ts';
import type { LXTransport } from '../providers/multiSourceResolver.ts';
import type { SourceRegistry } from '../providers/sourceRegistry.ts';
import { bounded, throwIfAborted } from '../providers/async.ts';
import { requestJSON, queryURL, type HTTPClient } from '../providers/http.ts';
import { normalizeLyrics, type LyricResult } from './normalize.ts';
const row=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'?value as Record<string,unknown>:{};
const usable=(value:LyricResult)=>value.document.lines.length>0||value.document.plain.length>0;
export class LyricService {
  private cache=new Map<string,{expires:number;value:LyricResult}>();
  private registry:SourceRegistry;private transport:LXTransport;private privateLyrics:(track:Track,signal:AbortSignal)=>Promise<unknown>;private http:HTTPClient;private krcDecoder?: (value:string)=>Promise<string>;private qrcDecoder?: (value:string)=>Promise<string>;
  constructor(registry:SourceRegistry,transport:LXTransport,privateLyrics:(track:Track,signal:AbortSignal)=>Promise<unknown>,http:HTTPClient=requestJSON,krcDecoder?:(value:string)=>Promise<string>,qrcDecoder?:(value:string)=>Promise<string>){this.qrcDecoder=qrcDecoder;this.krcDecoder=krcDecoder;this.registry=registry;this.transport=transport;this.privateLyrics=privateLyrics;this.http=http;}
  clear(){this.cache.clear();}
  async load(track:Track,signal:AbortSignal):Promise<LyricResult>{
    throwIfAborted(signal);
    const sources=this.registry.getSnapshot().filter(source=>this.registry.isCurrent(source));
    const key=JSON.stringify([trackKey(track.origin),sources.map(source=>[source.id,source.revision])]);
    const cached=this.cache.get(key);if(cached&&cached.expires>Date.now())return cached.value;
    const save=(value:LyricResult)=>{throwIfAborted(signal);if(usable(value)){this.cache.delete(key);this.cache.set(key,{value,expires:Date.now()+1800000});while(this.cache.size>20)this.cache.delete(this.cache.keys().next().value!);}return value;};
    if(track.origin.kind==='navidrome')return save(normalizeLyrics(await this.privateLyrics(track,signal)));
    const platform=track.origin.platform;
    for(const source of sources){
      const capability=source.capabilities.find(item=>item.platform===platform&&item.actions.includes('lyric'));
      if(!capability)continue;
      try{
        const raw=await bounded(child=>this.transport.request(source,makeLXActionRequest(track,'lyric',capability),child),signal,6000);
        throwIfAborted(signal);if(!this.registry.isCurrent(source))continue;
        const value=normalizeLyrics(raw);if(usable(value))return save(value);
      }catch{throwIfAborted(signal);}
    }
    return save(normalizeLyrics(await this.online(track,signal)));
  }
  private async online(track:Track,signal:AbortSignal):Promise<unknown>{
    if(track.origin.kind!=='online')return '';
    const {platform,id}=track.origin;
    if(platform==='wy')return this.http(queryURL('https://music.163.com/api/song/lyric',{id,lv:-1,kv:-1,tv:-1,rv:-1}),{},signal);
    if(platform==='tx'){
      const songID=Number(track.metadata.id);
      if(this.qrcDecoder&&Number.isSafeInteger(songID)&&songID>0){
        try{
          const raw=row(await this.http('https://u.y.qq.com/cgi-bin/musicu.fcg',{method:'POST',headers:{Referer:'https://y.qq.com/','Content-Type':'application/json'},body:JSON.stringify({comm:{ct:'19',cv:'1859',uin:'0'},req:{method:'GetPlayLyricInfo',module:'music.musichallSong.PlayLyricInfo',param:{format:'json',crypt:1,ct:19,cv:1873,interval:0,lrc_t:0,qrc:1,qrc_t:0,roma:1,roma_t:0,songID,trans:1,trans_t:0,type:-1}}})},signal)),req=row(raw.req),data=row(req.data);
          if(raw.code!==0||req.code!==0)throw new Error('逐字歌词暂不可用');
          const decode=async(value:unknown)=>typeof value==='string'&&value?bounded(()=>this.qrcDecoder!(value),signal,6000):'';
          // Optional variants fail independently; a broken translation must not
          // discard usable main lyric timing.
          const qrc=await decode(data.lyric);let tlyric='',rlyric='';
          try{tlyric=await decode(data.trans);}catch{throwIfAborted(signal);}
          try{rlyric=await decode(data.roma);}catch{throwIfAborted(signal);}
          const decoded={qrc,tlyric,rlyric};if(usable(normalizeLyrics(decoded)))return decoded;
        }catch{throwIfAborted(signal);}
      }
      const raw=row(await this.http(queryURL('https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg',{songmid:track.metadata.songId??id,format:'json',nobase64:1,g_tk:5381}),{headers:{Referer:'https://y.qq.com/'}},signal));
      return{lyric:raw.lyric,tlyric:raw.trans};
    }
    if(platform==='kw'){
      const raw=row(row(await this.http(queryURL('https://m.kuwo.cn/newh5/singles/songinfoandlrc',{musicId:id}),{},signal)).data);
      const lines=Array.isArray(raw.lrclist)?raw.lrclist:[];
      return lines.map(value=>{const item=row(value),seconds=Number(item.time);return Number.isFinite(seconds)&&seconds>=0?`[${Math.floor(seconds/60)}:${(seconds%60).toFixed(3).padStart(6,'0')}]${typeof item.lineLyric==='string'?item.lineLyric:''}`:'';}).join('\n');
    }
    if(platform==='mg'&&typeof track.metadata.lrcUrl==='string'){
      const url=new URL(track.metadata.lrcUrl);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('歌词地址无效');
      return bounded(async child=>{const response=await fetch(url.toString(),{signal:child});if(!response.ok)throw new Error('歌词获取失败');const text=await response.text();if(text.length>2097152)throw new Error('歌词过大');return text;},signal,10000);
    }
    if(platform==='kg'){
      const search=row(await this.http(queryURL('https://lyrics.kugou.com/search',{ver:1,man:'yes',client:'pc',keyword:track.title,hash:track.metadata.hash??'',timelength:track.durationMs??0,lrctxt:1}),{},signal));
      const candidate=row(Array.isArray(search.candidates)?search.candidates[0]:undefined);
      if(!candidate.id||!candidate.accesskey)return '';
      if(this.krcDecoder){try{const compressed=row(await this.http(queryURL('https://lyrics.kugou.com/download',{ver:1,client:'pc',id:candidate.id,accesskey:candidate.accesskey,fmt:'krc',charset:'utf8'}),{},signal));if(typeof compressed.content==='string')return await this.krcDecoder(compressed.content);}catch{throwIfAborted(signal);}}
      const result=row(await this.http(queryURL('https://lyrics.kugou.com/download',{ver:1,client:'pc',id:candidate.id,accesskey:candidate.accesskey,fmt:'lrc',charset:'utf8'}),{},signal));
      return typeof result.content==='string'?decodeBase64Text(result.content):'';
    }
    return '';
  }
}

export function decodeBase64Text(value:string){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',input=value.replace(/\s/g,'');
  if(input.length>3*1024*1024||input.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(input))throw new Error('歌词编码无效');
  let bits=0,count=0,encoded='';
  for(const character of input){if(character==='=')break;bits=(bits<<6)|alphabet.indexOf(character);count+=6;if(count>=8){count-=8;encoded+='%'+((bits>>count)&255).toString(16).padStart(2,'0');}}
  try{return decodeURIComponent(encoded);}catch{throw new Error('歌词编码无效');}
}
