import type {OnlinePlatform} from '../domain/track.ts';
import {bounded,throwIfAborted} from './async.ts';
export interface PlaylistIdentity {platform:OnlinePlatform;id:string}
export type PlaylistLinkExpander=(url:string,signal:AbortSignal)=>Promise<string>;
const shortHosts=['163cn.tv','.163cn.tv'];
const trailingPunctuation=/[),.;:!?，。；：！？）】》〉」』]+$/;

function cleanedInput(input:string){
  return input.replace(/&(?:amp|#0*38|#x0*26);/gi,'&').replace(/[\u200b-\u200d\u2060\ufeff]/g,'').trim();
}

function shareURL(input:string){
  const match=cleanedInput(input).match(/https?:\/\/[^\s<>"']+/i);
  if(!match)throw new Error('请输入平台公开歌单分享链接或选择平台后输入ID');
  let url:URL;
  try{url=new URL(match[0].replace(trailingPunctuation,''));}catch{throw new Error('分享链接无效');}
  if(url.username||url.password)throw new Error('分享链接不能包含账号信息');
  if(!['http:','https:'].includes(url.protocol)||url.port)throw new Error('分享链接无效');
  return url;
}

function isShortLink(url:URL){const host=url.hostname.toLowerCase();return shortHosts.some(value=>host===value||value.startsWith('.')&&host.endsWith(value));}

export function parsePlaylistLink(input:string,platformHint?:OnlinePlatform):PlaylistIdentity {
  const value=cleanedInput(input);if(platformHint&&/^\d{1,30}$/.test(value))return{platform:platformHint,id:value};
  const url=shareURL(value);
  const host=url.hostname.toLowerCase(),path=url.pathname+url.hash;
  let platform:OnlinePlatform|undefined,id:string|undefined;
  if(host==='music.163.com'||host==='y.music.163.com'){platform='wy';id=url.searchParams.get('id')??path.match(/[?&]id=(\d+)/)?.[1];}
  else if(host==='y.qq.com'||host==='i.y.qq.com'){platform='tx';id=url.searchParams.get('id')??url.searchParams.get('disstid')??path.match(/\/(?:playlist|playsquare)\/(\d+)/)?.[1];}
  else if(host==='www.kuwo.cn'||host==='m.kuwo.cn'||host==='h5app.kuwo.cn'){platform='kw';id=url.searchParams.get('pid')??url.searchParams.get('playlistId')??path.match(/\/(?:playlist_detail|playlist)\/(\d+)/)?.[1];}
  else if(host==='www.kugou.com'||host==='m.kugou.com'){platform='kg';id=path.match(/\/(?:single|list)\/(\d+)/)?.[1]??url.searchParams.get('specialid')??undefined;}
  else if(host==='music.migu.cn'||host==='h5.nf.migu.cn'){platform='mg';id=url.searchParams.get('id')??path.match(/\/playlist\/(\d+)/)?.[1];}
  if(!platform||!id||!/^\d{1,30}$/.test(id))throw new Error('尚未识别此分享链接，请展开链接或输入公开歌单ID');
  if(platformHint&&platformHint!==platform)throw new Error('分享链接与所选平台不同');
  return{platform,id};
}

const fetchPlaylistLink:PlaylistLinkExpander=async(url,signal)=>{
  const response=await fetch(url,{method:'GET',credentials:'omit',signal});
  if(!response.ok)throw new Error('短链接服务暂时不可用');
  const expanded=response.url;try{await response.body?.cancel();}catch{/* React Native may not expose a readable body. */}
  return expanded;
};

export async function resolvePlaylistLink(input:string,platformHint:OnlinePlatform,signal:AbortSignal,expand:PlaylistLinkExpander=fetchPlaylistLink,timeoutMs=12000){
  throwIfAborted(signal);
  try{return parsePlaylistLink(input,platformHint);}
  catch(directError){
    const url=shareURL(input);
    if(!isShortLink(url))throw directError;
    const expanded=await bounded(child=>expand(url.toString(),child),signal,timeoutMs);
    throwIfAborted(signal);
    return parsePlaylistLink(expanded,platformHint);
  }
}
