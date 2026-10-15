import type {OnlinePlatform} from '../domain/track.ts';
export interface PlaylistIdentity {platform:OnlinePlatform;id:string}
export function parsePlaylistLink(input:string,platformHint?:OnlinePlatform):PlaylistIdentity {
  const value=input.trim();if(platformHint&&/^\d{1,30}$/.test(value))return{platform:platformHint,id:value};
  const match=value.match(/https?:\/\/[^\s<>]+/i);if(!match)throw new Error('请输入平台公开歌单分享链接或选择平台后输入ID');
  let url:URL;try{url=new URL(match[0]);}catch{throw new Error('分享链接无效');}
  if(url.username||url.password)throw new Error('分享链接不能包含账号信息');
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
