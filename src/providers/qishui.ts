import type {Track} from '../domain/track.ts';
import {trackKey} from '../domain/track.ts';
import type {Repository} from '../storage/repository.ts';
import {cleanTrack} from '../storage/backup.ts';
import {bounded,throwIfAborted} from './async.ts';
import {requestJSON,type HTTPClient} from './http.ts';
type Row=Record<string,unknown>;
const row=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const list=(value:unknown):unknown[]=>Array.isArray(value)?value:[];
const text=(value:unknown)=>typeof value==='string'?value:typeof value==='number'&&Number.isSafeInteger(value)?String(value):'';
const hosts=['qishui.douyin.com','music.douyin.com','qishui.com','www.qishui.com','beta-luna.douyin.com'];
function shareURL(input:string){
  const match=input.match(/https?:\/\/[^\s<>"'，。；）】]+/i);if(!match)throw new Error('请输入汽水公开歌单链接或ID');
  const url=new URL(match[0]);if(!hosts.includes(url.hostname.toLowerCase())||url.username||url.password||!['https:','http:'].includes(url.protocol)||url.port)throw new Error('只支持汽水官方公开歌单链接');return url;
}
function urlID(url:URL){const id=url.searchParams.get('playlist_id')??url.searchParams.get('playlistId')??url.searchParams.get('playlistid')??url.pathname.match(/\/playlist(?:_v\d+)?\/(\d+)/)?.[1];return id&&/^\d{1,30}$/.test(id)?id:undefined;}
export function qishuiID(input:string){const value=input.trim();return /^\d{1,30}$/.test(value)?value:urlID(shareURL(value));}
function identifier(value:unknown){const id=text(value);if(!/^\d{1,30}$/.test(id))throw new Error('汽水返回的ID无效');return id;}
function cover(raw:unknown){const value=row(raw);if(typeof value.url==='string')return value.url;const prefix=text(list(value.urls)[0]),uri=text(value.uri);return prefix&&uri?prefix+uri:'';}
function qishuiTrack(value:unknown):Track {
  const media=row(value),entity=row(media.entity);let raw=row(row(entity.track_wrapper).track??entity.track??media.track);let kind='track';
  if(!Object.keys(raw).length){raw=row(row(entity.video_wrapper).video??entity.video??media.video);kind='video';}
  const id=text(raw.id??raw.video_id??raw.vid??media.id),album=row(raw.album);
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw new Error('汽水曲目ID无效');
  const artist=list(raw.artists).map(v=>{const a=row(v);return text(a.name??a.artist_name??a.simple_display_name);}).filter(Boolean).join(' / ');
  const duration=Number(raw.duration??raw.duration_ms);
  return cleanTrack({origin:{kind:'imported',platform:'qishui',id},title:text(raw.name??raw.title??raw.description)||'未知或已下架内容',artist,album:text(album.name),
    ...(Number.isFinite(duration)&&duration>=0?{durationMs:duration}:{}),artwork:cover(raw.url_cover??raw.cover_url)||cover(album.url_cover)||undefined,
    metadata:{originalPlatform:'qishui',originalId:id,mediaKind:kind},qualities:[]});
}
export interface QishuiPlaylist {id:string;title:string;tracks:readonly Track[]}
export interface QishuiRoamMode {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly query: string;
  readonly icon: string;
  readonly tint: string;
  readonly accent: string;
  readonly primary?: boolean;
}
export interface QishuiCuratedCollection {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly tag: string;
  readonly query: string;
  readonly gradient: readonly [string, string];
}
export interface QishuiBoundPlaylist {
  readonly id: string;
  readonly title: string;
  readonly trackCount: number;
  readonly artwork?: string;
  readonly syncedAt: number;
  readonly tracks: readonly Track[];
}
export interface QishuiAccountSnapshot {
  readonly nickname: string;
  readonly activeModeId: string;
  readonly playlists: readonly QishuiBoundPlaylist[];
  readonly liked: readonly Track[];
  readonly recent: readonly Track[];
}

// Aligned with Wayferar-Music scene modes & Sollin 2.0 Qishui 音乐漫游 layout
export const QISHUI_ROAM_MODES: readonly QishuiRoamMode[] = [
  { id: 'for_you', title: '为你推荐', subtitle: '个性精选 · 每日懂你', query: '抖音热歌 热门流行', icon: 'sparkles', tint: 'rgba(255,108,92,0.16)', accent: '#E85D4A', primary: true },
  { id: 'fresh', title: '新鲜发现', subtitle: '小众宝藏 · 每日上新', query: '独立流行 宝藏新歌', icon: 'compass-outline', tint: 'rgba(0,196,154,0.16)', accent: '#00A882', primary: true },
  { id: 'chill', title: 'Chill 放松', subtitle: '微醺舒缓 · 轻享时光', query: 'Chill 治愈 轻音乐', icon: 'cafe-outline', tint: 'rgba(116,92,196,0.16)', accent: '#725CC4', primary: true },
  { id: 'familiar', title: '熟悉的歌', subtitle: '常听回味 · 安心循环', query: '华语经典 高分热单', icon: 'heart-outline', tint: 'rgba(232,76,120,0.16)', accent: '#D8436E', primary: true },
  { id: 'workout', title: '动感健身', subtitle: '高燃节拍 · 运动充能', query: '运动 健身 动感电音', icon: 'flash-outline', tint: 'rgba(242,148,42,0.17)', accent: '#DF7F18', primary: true },
  { id: 'happy', title: '快乐时光', subtitle: '元气明快 · 好心情歌单', query: '元气 轻快 流行', icon: 'sunny-outline', tint: 'rgba(64,176,102,0.16)', accent: '#2FA15A', primary: true },
  { id: 'night', title: '深夜微醺', subtitle: '晚安民谣 · 独处片刻', query: '深夜 民谣 晚安', icon: 'moon-outline', tint: 'rgba(72,112,208,0.16)', accent: '#4870D0' },
  { id: 'drive', title: '公路兜风', subtitle: '节奏电音 · 车载必备', query: '车载 兜风 节奏', icon: 'car-outline', tint: 'rgba(43,140,255,0.16)', accent: '#2B8CFF' },
  { id: 'study', title: '专注学习', subtitle: '纯音氛围 · 沉浸效率', query: '纯音乐 钢琴 专注', icon: 'book-outline', tint: 'rgba(52,168,148,0.16)', accent: '#289480' },
  { id: 'retro', title: '复古金曲', subtitle: '粤语经典 · 时代记忆', query: '粤语 经典 怀旧', icon: 'disc-outline', tint: 'rgba(214,82,110,0.16)', accent: '#C64462' },
  { id: 'rap', title: '说唱律动', subtitle: '潮流说唱 · 街头节拍', query: '中文说唱 R&B', icon: 'mic-outline', tint: 'rgba(230,118,52,0.16)', accent: '#D66728' },
  { id: 'acg', title: '二次元燃曲', subtitle: 'ACG 热单 · 动漫原声', query: 'ACG 动漫 日语热歌', icon: 'planet-outline', tint: 'rgba(154,96,220,0.16)', accent: '#8E52D6' },
];

export const QISHUI_CURATED_COLLECTIONS: readonly QishuiCuratedCollection[] = [
  { id: 'q-hot-pop', title: '汽水热歌风向标', subtitle: '全网高播旋律与短视频热曲', tag: '热播', query: '抖音 热门 流行', gradient: ['#1E3A5F', '#0F6B73'] },
  { id: 'q-chill-vibe', title: '都市微醺 R&B', subtitle: '丝滑人声与深夜松弛节拍', tag: '微醺', query: '中文 R&B 氛围', gradient: ['#3B2667', '#7B3F8C'] },
  { id: 'q-indie-folk', title: '独立宝藏民谣', subtitle: '小众乐队与清澈吉他叙事', tag: '宝藏', query: '独立 民谣 乐队', gradient: ['#1E4D3B', '#3E7C59'] },
  { id: 'q-workout', title: '燃脂暴汗节拍', subtitle: '130 BPM 动感电子与节奏律动', tag: '健身', query: '电音 燃脂 跑步', gradient: ['#7C2D12', '#C2410C'] },
  { id: 'q-cantopop', title: '港乐黄金年代', subtitle: '历久弥新的粤语流行精选', tag: '复古', query: '粤语 经典 港乐', gradient: ['#5B1E31', '#9F2B4B'] },
  { id: 'q-lofi', title: '白噪与纯音书桌', subtitle: '无词轻音 · 专注阅读与工作', tag: '专注', query: 'Lo-Fi 轻音乐 钢琴', gradient: ['#1F3A4D', '#35607A'] },
];

export function asQishuiMatchedTrack(source: Track): Track {
  return cleanTrack({
    origin: { kind: 'imported', platform: 'qishui', id: `roam-${source.origin.kind === 'online' ? source.origin.platform : 'mix'}-${source.origin.id}` },
    title: source.title,
    artist: source.artist,
    ...(source.album ? { album: source.album } : {}),
    ...(source.durationMs !== undefined ? { durationMs: source.durationMs } : {}),
    ...(source.artwork ? { artwork: source.artwork } : {}),
    metadata: { originalPlatform: 'qishui', matchedFrom: source.origin.kind === 'online' ? source.origin.platform : source.origin.kind },
    qualities: source.qualities,
  });
}

export class QishuiAccountStore {
  private readonly repository: Pick<Repository, 'get' | 'put'>;
  private snapshot: QishuiAccountSnapshot = {
    nickname: '',
    activeModeId: 'for_you',
    playlists: [],
    liked: [],
    recent: [],
  };
  private readonly listeners = new Set<() => void>();

  constructor(repository: Pick<Repository, 'get' | 'put'>) {
    this.repository = repository;
  }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(next: QishuiAccountSnapshot) {
    this.snapshot = next;
    for (const l of this.listeners) l();
  }

  private async commit(next: QishuiAccountSnapshot) {
    await this.repository.put('qishui.account.v1', next);
    this.publish(next);
  }

  async restore() {
    const saved = await this.repository.get<QishuiAccountSnapshot>('qishui.account.v1');
    if (!saved || typeof saved !== 'object') return;
    const validMode = QISHUI_ROAM_MODES.some(m => m.id === saved.activeModeId) ? saved.activeModeId : 'for_you';
    const playlists = Array.isArray(saved.playlists)
      ? saved.playlists.filter(p => p && typeof p.id === 'string' && typeof p.title === 'string' && Array.isArray(p.tracks)).slice(0, 40)
      : [];
    const liked = Array.isArray(saved.liked) ? saved.liked.filter(t => t && typeof t.title === 'string').slice(0, 300) : [];
    const recent = Array.isArray(saved.recent) ? saved.recent.filter(t => t && typeof t.title === 'string').slice(0, 120) : [];
    this.publish({
      nickname: typeof saved.nickname === 'string' ? saved.nickname.trim().slice(0, 40) : '',
      activeModeId: validMode,
      playlists,
      liked,
      recent,
    });
  }

  async setNickname(nickname: string) {
    await this.commit({ ...this.snapshot, nickname: nickname.trim().slice(0, 40) });
  }

  async setActiveMode(modeId: string) {
    if (!QISHUI_ROAM_MODES.some(m => m.id === modeId) || modeId === this.snapshot.activeModeId) return;
    await this.commit({ ...this.snapshot, activeModeId: modeId });
  }

  async bindPlaylist(playlist: QishuiPlaylist) {
    const bound: QishuiBoundPlaylist = {
      id: playlist.id,
      title: playlist.title,
      trackCount: playlist.tracks.length,
      ...(playlist.tracks.find(t => t.artwork)?.artwork ? { artwork: playlist.tracks.find(t => t.artwork)!.artwork } : {}),
      syncedAt: Date.now(),
      tracks: playlist.tracks.slice(0, 500),
    };
    const playlists = [bound, ...this.snapshot.playlists.filter(p => p.id !== bound.id)].slice(0, 40);
    await this.commit({ ...this.snapshot, playlists });
    return bound;
  }

  async removePlaylist(id: string) {
    await this.commit({ ...this.snapshot, playlists: this.snapshot.playlists.filter(p => p.id !== id) });
  }

  isLiked(track: Track) {
    const key = trackKey(track.origin);
    return this.snapshot.liked.some(t => trackKey(t.origin) === key);
  }

  async toggleLike(track: Track) {
    const key = trackKey(track.origin);
    const exists = this.snapshot.liked.some(t => trackKey(t.origin) === key);
    const liked = exists
      ? this.snapshot.liked.filter(t => trackKey(t.origin) !== key)
      : [track, ...this.snapshot.liked].slice(0, 300);
    await this.commit({ ...this.snapshot, liked });
  }

  async recordRecent(track: Track) {
    const key = trackKey(track.origin);
    const recent = [track, ...this.snapshot.recent.filter(t => trackKey(t.origin) !== key)].slice(0, 120);
    await this.commit({ ...this.snapshot, recent });
  }

  async clearProfile() {
    await this.commit({ nickname: '', activeModeId: 'for_you', playlists: [], liked: [], recent: [] });
  }
}

export class QishuiProvider {
  private http:HTTPClient;private expand:(url:string,signal:AbortSignal)=>Promise<string>;
  constructor(http:HTTPClient=requestJSON,expand=(url:string,signal:AbortSignal)=>bounded(async child=>{const result=await fetch(url,{signal:child});if(!result.ok)throw new Error('短链接展开失败');const expanded=result.url;try{await result.body?.cancel();}catch{/* RN may not expose a readable body. */}return expanded;},signal,12000)){this.http=http;this.expand=expand;}
  async complete(input:string,signal:AbortSignal):Promise<QishuiPlaylist>{
    throwIfAborted(signal);let id=qishuiID(input);
    if(!id)id=urlID(shareURL(await this.expand(shareURL(input).toString(),signal)));
    if(!id)throw new Error('无法识别汽水短链接，请粘贴完整歌单地址或ID');
    let cursor='0',title='',total:number|undefined;const visited=new Set<string>(),tracks:Track[]=[];
    for(let page=0;page<100;page++){
      throwIfAborted(signal);if(visited.has(cursor))throw new Error('汽水歌单分页未推进，未导入不完整数据');visited.add(cursor);
      const raw=row(await this.http('https://beta-luna.douyin.com/luna/playlist/detail',{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'Luna/19.1.0 Android'},body:JSON.stringify({playlist_id:id,cursor,count:200})},signal));
      throwIfAborted(signal);const playlist=row(raw.playlist),count=Number(playlist.count_tracks);
      if(identifier(playlist.id)!==id||!Number.isInteger(count)||count<0||count>20000||!Array.isArray(raw.media_resources)||typeof raw.has_more!=='boolean')throw new Error('无法完整读取此汽水公开歌单');
      if(total===undefined){total=count;title=text(playlist.title??playlist.name)||'汽水公开歌单';}else if(total!==count)throw new Error('汽水歌单在读取中改变，请重试');
      tracks.push(...list(raw.media_resources).map(qishuiTrack));if(tracks.length>total)throw new Error('汽水歌曲数量与歌单不一致');
      if(raw.has_more!==true){if(tracks.length!==total)throw new Error('汽水歌单歌曲不完整，未导入');return{id,title,tracks};}
      const next=text(raw.next_cursor);if(!next||!list(raw.media_resources).length)throw new Error('汽水分页缺少下一页');cursor=next;
    }
    throw new Error('汽水歌单超过分页上限，未导入');
  }
}
