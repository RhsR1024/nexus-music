// Public keyword contracts: Q-1515 547ccfe musicSdk/*/{hot,tip}Search.js
// (Apache-2.0/LX attribution in THIRD_PARTY_NOTICES). Independent reader;
// no account cookies, private tokens, reference runtime or deep-link actions.
import type {OnlinePlatform} from '../domain/track.ts';
import {requestJSON,queryURL,type HTTPClient} from './http.ts';
import {weapiPayload} from './neteaseCrypto.ts';
import {throwIfAborted} from './async.ts';
export type AssistanceMode='hot'|'suggest';
type Row=Record<string,unknown>;
const row=(v:unknown):Row=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Row:{};
const clean=(v:unknown):string=>typeof v==='string'?v.replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/[\u0000-\u001f\u007f]/g,' ').trim().replace(/\s+/g,' '):'';
function songLabel(name:unknown,artists:unknown){const title=clean(name);if(!title)throw Error('关键词响应无效');const author=clean(artists);return title+(author?' - '+author:'');}
export class AssistanceUnavailableError extends Error{constructor(){super('此平台暂不支持关键词建议');}}
export function cleanSearchKeywords(values:unknown):readonly string[]{
 if(!Array.isArray(values)||values.length>1000)throw Error('关键词响应无效');
 const seen=new Set<string>(),result:string[]=[];
 for(const value of values){if(typeof value!=='string')throw Error('关键词响应无效');const text=clean(value),key=text.toLocaleLowerCase();if(!text||text.length>500||seen.has(key))continue;seen.add(key);result.push(text);if(result.length===20)break;}
 return result;
}
export class SearchAssistanceProvider{
 private readonly http:HTTPClient;
 private readonly deps:{http?:HTTPClient;md5:(value:string)=>Promise<string>;deviceId:()=>string;now?:()=>number};
 constructor(deps:SearchAssistanceProvider['deps']){this.deps=deps;this.http=(u,r,s)=>(deps.http??requestJSON)(u,{...r,credentials:'omit'},s);}
 async read(platform:OnlinePlatform,mode:AssistanceMode,query:string,signal:AbortSignal):Promise<readonly string[]>{
  throwIfAborted(signal);query=query.trim();if(mode==='suggest'&&(!query||query.length>500))throw Error('关键词无效');
  let values:unknown;
  if(platform==='wy'){
   const data=mode==='suggest'?{s:query}:{type:1111};
   const body=Object.entries(weapiPayload(data)).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&');
   const response=row(await this.http('https://music.163.com/weapi/search/'+(mode==='suggest'?'suggest/web':'hot'),{method:'POST',headers:{Referer:'https://music.163.com/','Content-Type':'application/x-www-form-urlencoded'},body},signal));
   if(response.code!==200)throw Error('关键词服务不可用');if(!response.result||typeof response.result!=='object'||Array.isArray(response.result))throw Error('关键词响应无效');const result=row(response.result);
   if(mode==='hot')values=Array.isArray(result.hots)?result.hots.map(v=>row(v).first):undefined;
   else{if(result.songs===undefined)values=[];else values=Array.isArray(result.songs)?result.songs.map(v=>{const song=row(v),artists=song.artists;if(!Array.isArray(artists))throw Error('关键词响应无效');return songLabel(song.name,artists.map(a=>clean(row(a).name)).filter(Boolean).join('、'));}):undefined;}
  }else if(platform==='tx'){
   if(mode==='hot'){
    const response=row(await this.http('https://u.y.qq.com/cgi-bin/musicu.fcg',{method:'POST',headers:{Referer:'https://y.qq.com/','Content-Type':'application/json'},body:JSON.stringify({comm:{ct:'19',cv:'1803',guid:'0',uin:'0'},hotkey:{method:'GetHotkeyForQQMusicPC',module:'tencent_musicsoso_hotkey.HotkeyService',param:{search_id:'',uin:0}}})},signal)),part=row(response.hotkey);
    if(response.code!==0||part.code!==0)throw Error('关键词服务不可用');const list=row(part.data).vec_hotkey;values=Array.isArray(list)?list.map(v=>row(v).query):undefined;
   }else{
    const response=row(await this.http(queryURL('https://c.y.qq.com/splcloud/fcgi-bin/smartbox_new.fcg',{format:'json',key:query}),{headers:{Referer:'https://y.qq.com/'}},signal));if(response.code!==0)throw Error('关键词服务不可用');const list=row(row(response.data).song).itemlist;values=Array.isArray(list)?list.map(v=>{const r=row(v);return songLabel(r.name,r.singer);}):undefined;
   }
  }else if(platform==='kw'){
   const response=row(await this.http(mode==='hot'?queryURL('https://hotword.kuwo.cn/hotword.s',{prod:'kwplayer_ar_9.3.0.1',corp:'kuwo',newver:2,plat:'kwplayer_ar',rformat:'json',encoding:'utf8',tabid:1}):queryURL('https://tips.kuwo.cn/t.s',{corp:'kuwo',newver:3,p2p:1,notrace:1,c:'mbox',w:query,encoding:'utf8',rformat:'json'}),{headers:{Referer:'https://www.kuwo.cn/'}},signal));
   if(mode==='hot'?response.status!=='ok':response.STATUS!=='OK')throw Error('关键词服务不可用');const list=mode==='hot'?response.tagvalue:response.WORDITEMS;values=Array.isArray(list)?list.map(v=>row(v)[mode==='hot'?'key':'RELWORD']):undefined;
  }else if(platform==='kg'){
   let url:string;const headers:Record<string,string>={Referer:'https://www.kugou.com/'};
   if(mode==='hot'){
    const mid=await this.deps.md5(this.deps.deviceId()),params={appid:1005,clientver:10026,plat:0,mid,clienttime:Math.floor((this.deps.now??Date.now)()/1000)};
    headers.mid=mid;headers.dfid='-';headers.clienttime=String(params.clienttime);
    const salt='OIlwieks28dk2k092lksi2UIkp',signature=await this.deps.md5(salt+Object.entries(params).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('')+salt);
    throwIfAborted(signal);url=queryURL('https://msearch.kugou.com/api/v3/search/hot_tab',{...params,signature});
   }else url=queryURL('https://searchtip.kugou.com/getSearchTip',{MusicTipCount:10,keyword:query});
   const response=row(await this.http(url,{headers},signal));if(response.status!==1||response.errcode!==undefined&&response.errcode!==0||response.error_code!==undefined&&response.error_code!==0)throw Error('关键词服务不可用');
   const data=response.data;
   if(mode==='suggest'){const list=row(Array.isArray(data)?data[0]:undefined).RecordDatas;values=Array.isArray(list)?list.map(v=>row(v).HintInfo):undefined;}
   else{const list=row(data).list;values=Array.isArray(list)?list.flatMap(v=>{const words=row(v).keywords;if(!Array.isArray(words))throw Error('关键词响应无效');return words.filter(w=>!row(w).jumpurl&&!row(w).url).map(w=>row(w).keyword);}):undefined;}
  }else{
   // The pinned legacy suggest route redirects to an unrelated v5 homepage.
   if(mode==='suggest')throw new AssistanceUnavailableError();
   const response=row(await this.http('https://jadeite.migu.cn/music_search/v3/search/hotword',{},signal));if(response.code!=='000000')throw Error('关键词服务不可用');
   const groups=row(response.data).hotwords,list=row(Array.isArray(groups)?groups[0]:undefined).hotwordList;
   values=Array.isArray(list)?list.filter(v=>{const item=row(v);return item.resourceType==='song'&&typeof item.id==='string'&&/^\d+$/.test(item.id)&&!item.url;}).map(v=>row(v).word):undefined;
  }
  throwIfAborted(signal);return cleanSearchKeywords(values);
 }
}
