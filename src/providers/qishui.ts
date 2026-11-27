// Qishui Music (汽水音乐) PC account session, 48 official listening modes (3 core + 45 scene/genre),
// public/authenticated playlist reader, official PC charts/mix discovery, direct unencrypted playback,
// and lyrics reader. All calls target official HTTPS endpoints directly (zero third-party signer).
// Protocol reference only (zero code/assets copied): Wow-CaiCai/Coda commit 22bc58e (AGPL-3.0/GPL-3.0).
import type { Quality } from '../domain/quality.ts';
import type { Track } from '../domain/track.ts';
import { trackKey } from '../domain/track.ts';
import type { Repository } from '../storage/repository.ts';
import { cleanTrack, safePublicURL } from '../storage/cleanTrack.ts';
import { bounded, throwIfAborted } from './async.ts';
import { queryURL, requestJSON, type HTTPClient } from './http.ts';
import type { MusicSecretStore } from './musicAccounts.ts';
import { MUSIC_WEB_LOGIN_URLS, musicCookieHeader, parseQishuiCookiePayload, type MusicWebAuthNative } from './musicWebLogin.ts';

type Row = Record<string, unknown>;
const row = (value: unknown): Row =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Row) : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown) =>
  typeof value === 'string'
    ? value
    : typeof value === 'number' && Number.isSafeInteger(value)
      ? String(value)
      : '';
const num = (value: unknown): number => {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : 0;
};

const hosts = ['qishui.douyin.com', 'music.douyin.com', 'qishui.com', 'www.qishui.com', 'beta-luna.douyin.com', 'api.qishui.com'];
const LUNA_PC_UA = 'LunaPC/3.3.0(359450208)';

function shareURL(input: string) {
  const match = input.match(/https?:\/\/[^\s<>"'，。；）】]+/i);
  if (!match) throw new Error('请输入汽水公开歌单链接或ID');
  const url = new URL(match[0]);
  if (!hosts.includes(url.hostname.toLowerCase()) || url.username || url.password || !['https:', 'http:'].includes(url.protocol) || url.port) {
    throw new Error('只支持汽水官方公开歌单链接');
  }
  return url;
}

function urlID(url: URL) {
  const id =
    url.searchParams.get('playlist_id') ??
    url.searchParams.get('playlistId') ??
    url.searchParams.get('playlistid') ??
    url.pathname.match(/\/playlist(?:_v\d+)?\/(\d+)/)?.[1];
  return id && /^\d{1,30}$/.test(id) ? id : undefined;
}

export function qishuiID(input: string) {
  const value = input.trim();
  return /^\d{1,30}$/.test(value) ? value : urlID(shareURL(value));
}

function identifier(value: unknown) {
  const id = text(value);
  if (!/^\d{1,30}$/.test(id)) throw new Error('汽水返回的ID无效');
  return id;
}

function cover(raw: unknown): string {
  if (typeof raw === 'string') return raw.replace(/^http:\/\//i, 'https://');
  const value = row(raw);
  const uri = text(value.uri);
  const templatePrefix = text(value.template_prefix);
  if (uri && templatePrefix && !uri.includes('://')) {
    return `https://p3-luna.douyinpic.com/img/${uri}~${templatePrefix}-resize:960:960.png`;
  }
  if (typeof value.url === 'string' && value.url) return value.url.replace(/^http:\/\//i, 'https://');
  const first = text(list(value.urls)[0]);
  if (first) {
    const resolved = !uri || first.includes(uri) || !first.endsWith('/') ? first : first + uri;
    return resolved.replace(/^http:\/\//i, 'https://');
  }
  return '';
}

function qishuiTrackFromRaw(raw: Row, fallbackId?: string, kind = 'track'): Track | null {
  const id = text(raw.id ?? raw.video_id ?? raw.vid ?? fallbackId);
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
  const album = row(raw.album);
  const artist = list(raw.artists)
    .map(v => {
      const a = row(v);
      return text(a.name ?? a.artist_name ?? a.simple_display_name ?? row(a.user_info).nickname);
    })
    .filter(Boolean)
    .join(' / ');
  const duration = Number(raw.duration ?? raw.duration_ms);
  const artwork = cover(raw.url_cover ?? raw.cover_url) || cover(album.url_cover ?? album.cover_url) || undefined;
  return cleanTrack({
    origin: { kind: 'imported', platform: 'qishui', id },
    title: text(raw.name ?? raw.title ?? raw.description) || '未知或已下架内容',
    artist,
    ...(text(album.name) ? { album: text(album.name) } : {}),
    ...(Number.isFinite(duration) && duration >= 0 ? { durationMs: duration } : {}),
    ...(artwork && safePublicURL(artwork) ? { artwork } : {}),
    metadata: { originalPlatform: 'qishui', originalId: id, mediaKind: kind },
    qualities: [],
  });
}

function qishuiTrack(value: unknown): Track {
  const media = row(value);
  const entity = row(media.entity);
  let raw = row(row(entity.track_wrapper).track ?? entity.track ?? media.track);
  let kind = 'track';
  if (!Object.keys(raw).length) {
    raw = row(row(entity.video_wrapper).video ?? entity.video ?? media.video);
    kind = 'video';
  }
  if (!Object.keys(raw).length && media.id && (media.name || media.title)) {
    raw = media;
  }
  const built = qishuiTrackFromRaw(raw, text(media.id), kind);
  if (!built) throw new Error('汽水曲目ID无效');
  return built;
}

export interface QishuiPlaylist {
  id: string;
  title: string;
  tracks: readonly Track[];
}

export interface QishuiCloudPlaylistSummary {
  readonly id: string;
  readonly title: string;
  readonly artwork?: string;
  readonly trackCount: number;
  readonly isFavorite?: boolean;
}

export interface QishuiChartSummary {
  readonly id: string;
  readonly title: string;
  readonly artwork?: string;
  readonly previewTracks: readonly Track[];
}

export type QishuiModeCategory = 'core' | 'mood' | 'scene' | 'genre';

export interface QishuiRoamMode {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly query: string;
  readonly icon: string;
  readonly tint: string;
  readonly accent: string;
  readonly category: QishuiModeCategory;
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
  readonly loggedIn: boolean;
  readonly userId?: string;
  readonly avatar?: string;
  readonly isVip?: boolean;
  readonly loggedInAt?: number;
  readonly nickname: string;
  readonly activeModeId: string;
  readonly playlists: readonly QishuiBoundPlaylist[];
  readonly liked: readonly Track[];
  readonly recent: readonly Track[];
}

// 3 core default modes + all 45 Qishui listening scene/genre modes (48 total)
export const QISHUI_ROAM_MODES: readonly QishuiRoamMode[] = [
  // ── 3 Core Default Modes ──
  { id: 'default', title: '默认模式', subtitle: '默认推荐 · 个性懂你', query: '抖音热歌 热门流行', icon: 'sparkles', tint: 'rgba(255,108,92,0.16)', accent: '#E85D4A', category: 'core', primary: true },
  { id: 'familiar', title: '熟悉模式', subtitle: '常听回味 · 安心循环', query: '华语经典 高分热单', icon: 'heart-outline', tint: 'rgba(232,76,120,0.16)', accent: '#D8436E', category: 'core', primary: true },
  { id: 'fresh', title: '新鲜模式', subtitle: '小众宝藏 · 每日上新', query: '独立流行 宝藏新歌', icon: 'compass-outline', tint: 'rgba(0,196,154,0.16)', accent: '#00A882', category: 'core', primary: true },

  // ── 12 Mood & Atmosphere Modes ──
  { id: 'chill', title: 'Chill 放松', subtitle: '微醺舒缓 · 轻享时光', query: 'Chill 治愈 轻音乐', icon: 'cafe-outline', tint: 'rgba(116,92,196,0.16)', accent: '#725CC4', category: 'mood', primary: true },
  { id: 'happy', title: '快乐时光', subtitle: '元气明快 · 好心情歌单', query: '元气 轻快 快乐流行', icon: 'sunny-outline', tint: 'rgba(64,176,102,0.16)', accent: '#2FA15A', category: 'mood', primary: true },
  { id: 'emo', title: 'Emo 时刻', subtitle: '深夜情绪 · 温柔共鸣', query: '伤感 emo 抒情华语', icon: 'rainy-outline', tint: 'rgba(92,116,196,0.16)', accent: '#5A72C4', category: 'mood' },
  { id: 'heal', title: '治愈系', subtitle: '温暖人声 · 抚平疲惫', query: '治愈 温暖 抒情 华语', icon: 'leaf-outline', tint: 'rgba(54,186,142,0.16)', accent: '#28A67D', category: 'mood' },
  { id: 'calm', title: '安静平和', subtitle: '清澈舒缓 · 静心片刻', query: '安静 轻柔 舒缓 流行', icon: 'water-outline', tint: 'rgba(78,162,216,0.16)', accent: '#3B91C9', category: 'mood' },
  { id: 'love_song', title: '甜蜜情歌', subtitle: '心动告白 · 浪漫旋律', query: '甜蜜 情歌 浪漫 对唱', icon: 'heart-circle-outline', tint: 'rgba(240,94,136,0.16)', accent: '#DF4874', category: 'mood' },
  { id: 'breakup', title: '失恋疗伤', subtitle: '释怀告别 · 苦情金曲', query: '失恋 伤感 情歌 经典', icon: 'heart-dislike-outline', tint: 'rgba(148,108,176,0.16)', accent: '#8A5CA8', category: 'mood' },
  { id: 'drunk', title: '深夜微醺', subtitle: '爵士蓝调 · 城市夜色', query: '微醺 爵士 R&B 夜晚', icon: 'wine-outline', tint: 'rgba(168,86,140,0.16)', accent: '#A64684', category: 'mood' },
  { id: 'lucky', title: '好运来袭', subtitle: '喜悦轻扬 · 元气加持', query: '欢快 好运 青春 流行', icon: 'star-outline', tint: 'rgba(244,172,56,0.16)', accent: '#DC961A', category: 'mood' },
  { id: 'lying_flat', title: '躺平摆烂', subtitle: '慵懒松弛 · 放空自我', query: '慵懒 卧室流行 Lo-Fi', icon: 'bed-outline', tint: 'rgba(132,148,186,0.16)', accent: '#6B7EA8', category: 'mood' },
  { id: 'slow_motion', title: '慢放时光', subtitle: '舒缓节奏 · 悠然慢听', query: '慢歌 抒情 舒缓 民谣', icon: 'hourglass-outline', tint: 'rgba(110,164,154,0.16)', accent: '#549689', category: 'mood' },
  { id: 'sweet_girl', title: '甜妹日常', subtitle: '元气甜歌 · 轻盈少女感', query: '甜美 女声 轻快 抖音', icon: 'flower-outline', tint: 'rgba(246,126,166,0.16)', accent: '#E46390', category: 'mood' },

  // ── 16 Daily Scene Modes ──
  { id: 'sport', title: '运动健身', subtitle: '高燃节拍 · 运动充能', query: '运动 健身 动感电音', icon: 'flash-outline', tint: 'rgba(242,148,42,0.17)', accent: '#DF7F18', category: 'scene', primary: true },
  { id: 'car_mode', title: '开车模式', subtitle: '节奏畅行 · 车载必备', query: '车载 兜风 节奏流行', icon: 'car-outline', tint: 'rgba(43,140,255,0.16)', accent: '#2B8CFF', category: 'scene' },
  { id: 'focus', title: '专注学习', subtitle: '沉浸效率 · 心无旁骛', query: '专注 学习 轻音乐 钢琴', icon: 'book-outline', tint: 'rgba(52,168,148,0.16)', accent: '#289480', category: 'scene' },
  { id: 'commute', title: '通勤路上', subtitle: '早晚节奏 · 城市漫步', query: '通勤 城市流行 轻快', icon: 'train-outline', tint: 'rgba(72,146,220,0.16)', accent: '#3980CC', category: 'scene' },
  { id: 'bedtime', title: '助眠晚安', subtitle: '温柔入梦 · 静谧安眠', query: '晚安 助眠 轻柔 钢琴', icon: 'cloudy-night-outline', tint: 'rgba(76,102,192,0.16)', accent: '#4862BA', category: 'scene' },
  { id: 'night_time', title: '深夜独处', subtitle: '晚安民谣 · 独处片刻', query: '深夜 民谣 独处 吉他', icon: 'moon-outline', tint: 'rgba(72,112,208,0.16)', accent: '#4870D0', category: 'scene' },
  { id: 'get_up', title: '元气起床', subtitle: '清晨阳光 · 唤醒活力', query: '清晨 早安 元气 流行', icon: 'partly-sunny-outline', tint: 'rgba(244,162,62,0.16)', accent: '#DE8B26', category: 'scene' },
  { id: 'bath', title: '洗澡欢唱', subtitle: '浴室歌神 · 放声高歌', query: '华语热歌 洗澡 必唱', icon: 'water', tint: 'rgba(56,184,218,0.16)', accent: '#1F9CC0', category: 'scene' },
  { id: 'clean_up', title: '居家打扫', subtitle: '轻快节拍 · 整理心情', query: '轻快 节奏 居家 欧美', icon: 'home-outline', tint: 'rgba(84,186,136,0.16)', accent: '#3DA673', category: 'scene' },
  { id: 'travel', title: '旅途风景', subtitle: '在路上的自由旋律', query: '旅行 公路 民谣 流行', icon: 'airplane-outline', tint: 'rgba(58,158,214,0.16)', accent: '#298BC4', category: 'scene' },
  { id: 'beach', title: '海边度假', subtitle: '海风落日 · 热带松弛', query: '海边 夏日 热带 流行', icon: 'umbrella-outline', tint: 'rgba(32,188,186,0.16)', accent: '#17A2A0', category: 'scene' },
  { id: 'rain', title: '雨天听歌', subtitle: '听雨思绪 · 温柔氛围', query: '雨天 抒情 吉他 民谣', icon: 'rainy', tint: 'rgba(98,136,190,0.16)', accent: '#547CB4', category: 'scene' },
  { id: 'library', title: '自习书房', subtitle: '安静书桌 · 纯音伴读', query: '自习 书房 Lo-Fi 钢琴', icon: 'library-outline', tint: 'rgba(94,154,132,0.16)', accent: '#4B8772', category: 'scene' },
  { id: 'game', title: '游戏高燃', subtitle: '电音摇滚 · 战意拉满', query: '游戏 高燃 踩点 电音', icon: 'game-controller-outline', tint: 'rgba(154,96,220,0.16)', accent: '#8E52D6', category: 'scene' },
  { id: 'fish', title: '摸鱼划水', subtitle: '办公摸鱼 · 轻松律动', query: '摸鱼 轻松 律动 流行', icon: 'fish-outline', tint: 'rgba(64,178,204,0.16)', accent: '#2B9CB6', category: 'scene' },
  { id: 'child', title: '亲子时光', subtitle: '童趣轻快 · 温馨陪伴', query: '儿歌 亲子 轻快 动画', icon: 'balloon-outline', tint: 'rgba(244,142,96,0.16)', accent: '#DF7A4B', category: 'scene' },

  // ── 17 Genre & Language Modes ──
  { id: 'douyin_roam', title: '抖音热歌', subtitle: '爆款热单 · 全网传唱', query: '抖音 热门 爆款 热歌', icon: 'flame-outline', tint: 'rgba(238,76,84,0.16)', accent: '#DC3B44', category: 'genre' },
  { id: 'ktv', title: 'KTV 必点', subtitle: '全场大合唱经典金曲', query: 'KTV 必点 合唱 华语', icon: 'mic', tint: 'rgba(232,102,68,0.16)', accent: '#D85432', category: 'genre' },
  { id: 'cantonese', title: '粤语经典', subtitle: '港乐黄金年代回味', query: '粤语 经典 港乐 老歌', icon: 'disc-outline', tint: 'rgba(214,82,110,0.16)', accent: '#C64462', category: 'genre' },
  { id: 'chinese_style', title: '国风古韵', subtitle: '戏腔古风 · 诗意旋律', query: '古风 国风 戏腔 华语', icon: 'brush-outline', tint: 'rgba(206,94,74,0.16)', accent: '#B84B38', category: 'genre' },
  { id: 'classic', title: '华语金曲', subtitle: '时代经典 · 永不过时', query: '华语 金曲 经典 流行', icon: 'trophy-outline', tint: 'rgba(220,148,48,0.16)', accent: '#C47F1C', category: 'genre' },
  { id: 'nostalgic', title: '怀旧老歌', subtitle: '青春回忆 · 经典复刻', query: '怀旧 老歌 80后 90后', icon: 'radio-outline', tint: 'rgba(182,124,84,0.16)', accent: '#A66C44', category: 'genre' },
  { id: 'english', title: '欧美流行', subtitle: 'Billboard 热单精选', query: '欧美 流行 热门 英文歌', icon: 'globe-outline', tint: 'rgba(66,134,234,0.16)', accent: '#3675D6', category: 'genre' },
  { id: 'jpop', title: '日语 J-Pop', subtitle: '日系流行与动漫原声', query: '日语 J-Pop 动漫 热歌', icon: 'planet-outline', tint: 'rgba(164,104,224,0.16)', accent: '#9458D2', category: 'genre' },
  { id: 'kpop', title: '韩语 K-Pop', subtitle: '节奏舞曲与韩系热单', query: '韩语 K-Pop 女团 男团', icon: 'headset-outline', tint: 'rgba(228,88,166,0.16)', accent: '#CE4492', category: 'genre' },
  { id: 'rock', title: '摇滚现场', subtitle: '吉他失真 · 热血呐喊', query: '摇滚 乐队 现场 华语', icon: 'thunderstorm-outline', tint: 'rgba(216,66,66,0.16)', accent: '#C43434', category: 'genre' },
  { id: 'rap', title: '说唱嘻哈', subtitle: '潮流说唱 · 街头节拍', query: '中文说唱 Hip-Hop 饶舌', icon: 'mic-outline', tint: 'rgba(230,118,52,0.16)', accent: '#D66728', category: 'genre' },
  { id: 'rnb', title: '丝滑 R&B', subtitle: '都市灵魂与丝滑转音', query: '中文 R&B 陶喆 方大同', icon: 'musical-notes-outline', tint: 'rgba(128,96,210,0.16)', accent: '#6F50BE', category: 'genre' },
  { id: 'electronic', title: '电子律动', subtitle: '合成器与迷幻节拍', query: '电音 EDM 电子音乐', icon: 'pulse-outline', tint: 'rgba(46,164,232,0.16)', accent: '#1F90D4', category: 'genre' },
  { id: 'dj', title: 'DJ 嗨曲', subtitle: '重低音律动 · 全场燃爆', query: 'DJ 舞曲 车载 重低音', icon: 'disc', tint: 'rgba(226,72,138,0.16)', accent: '#CA3274', category: 'genre' },
  { id: 'folk', title: '民谣吉他', subtitle: '木吉他与城市诗意', query: '民谣 吉他 独立乐队', icon: 'musical-note-outline', tint: 'rgba(72,168,118,0.16)', accent: '#369464', category: 'genre' },
  { id: 'country', title: '乡村民谣', subtitle: '原声吉他与旷野风情', query: '乡村 音乐 欧美 民谣', icon: 'bonfire-outline', tint: 'rgba(198,132,62,0.16)', accent: '#B4722C', category: 'genre' },
  { id: 'non_vocal', title: '纯音乐', subtitle: '无词旋律 · 钢琴弦乐', query: '纯音乐 钢琴 轻音乐', icon: 'prism-outline', tint: 'rgba(84,146,196,0.16)', accent: '#4482B8', category: 'genre' },
];

export const QISHUI_CURATED_COLLECTIONS: readonly QishuiCuratedCollection[] = [
  { id: 'q-hot-pop', title: '汽水热歌风向标', subtitle: '全网高播旋律与短视频热曲', tag: '热播', query: '抖音 热门 流行', gradient: ['#1E3A5F', '#0F6B73'] },
  { id: 'q-chill-vibe', title: '都市微醺 R&B', subtitle: '丝滑人声与深夜松弛节拍', tag: '微醺', query: '中文 R&B 氛围', gradient: ['#3B2667', '#7B3F8C'] },
  { id: 'q-indie-folk', title: '独立宝藏民谣', subtitle: '小众乐队与清澈吉他叙事', tag: '宝藏', query: '独立 民谣 乐队', gradient: ['#1E4D3B', '#3E7C59'] },
  { id: 'q-workout', title: '燃脂暴汗节拍', subtitle: '130 BPM 动感电子与节奏律动', tag: '健身', query: '电音 燃脂 跑步', gradient: ['#7C2D12', '#C2410C'] },
  { id: 'q-cantopop', title: '港乐黄金年代', subtitle: '历久弥新的粤语流行精选', tag: '复古', query: '粤语 经典 港乐', gradient: ['#5B1E31', '#9F2B4B'] },
  { id: 'q-lofi', title: '白噪与纯音书桌', subtitle: '无词轻音 · 专注阅读与工作', tag: '专注', query: 'Lo-Fi 轻音乐 钢琴', gradient: ['#1F3A4D', '#35607A'] },
];

function normalizeModeId(id: unknown): string {
  if (typeof id !== 'string') return 'default';
  if (id === 'for_you') return 'default';
  if (id === 'workout') return 'sport';
  if (id === 'night') return 'night_time';
  if (id === 'drive') return 'car_mode';
  if (id === 'study') return 'focus';
  if (id === 'retro') return 'cantonese';
  if (id === 'acg') return 'jpop';
  return QISHUI_ROAM_MODES.some(m => m.id === id) ? id : 'default';
}

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

const QISHUI_SECRET_KEY = 'nexus.music.qishui.v1';

export class QishuiAccountStore {
  private readonly repository: Pick<Repository, 'get' | 'put'>;
  private readonly secrets?: MusicSecretStore;
  private snapshot: QishuiAccountSnapshot = {
    loggedIn: false,
    nickname: '',
    activeModeId: 'default',
    playlists: [],
    liked: [],
    recent: [],
  };
  private readonly listeners = new Set<() => void>();

  constructor(repository: Pick<Repository, 'get' | 'put'>, secrets?: MusicSecretStore) {
    this.repository = repository;
    this.secrets = secrets;
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
    const validMode = normalizeModeId(saved.activeModeId);
    const playlists = Array.isArray(saved.playlists)
      ? saved.playlists.filter(p => p && typeof p.id === 'string' && typeof p.title === 'string' && Array.isArray(p.tracks)).slice(0, 40)
      : [];
    const liked = Array.isArray(saved.liked) ? saved.liked.filter(t => t && typeof t.title === 'string').slice(0, 300) : [];
    const recent = Array.isArray(saved.recent) ? saved.recent.filter(t => t && typeof t.title === 'string').slice(0, 120) : [];
    const hasSecret = this.secrets ? Boolean(await this.secrets.get(QISHUI_SECRET_KEY).catch(() => null)) : Boolean(saved.loggedIn);
    const safeAvatar = typeof saved.avatar === 'string' && safePublicURL(saved.avatar) ? saved.avatar : undefined;
    this.publish({
      loggedIn: Boolean(saved.loggedIn) && hasSecret,
      ...(typeof saved.userId === 'string' && saved.userId ? { userId: saved.userId.slice(0, 64) } : {}),
      ...(safeAvatar ? { avatar: safeAvatar } : {}),
      ...(typeof saved.isVip === 'boolean' ? { isVip: saved.isVip } : {}),
      ...(typeof saved.loggedInAt === 'number' && Number.isFinite(saved.loggedInAt) ? { loggedInAt: saved.loggedInAt } : {}),
      nickname: typeof saved.nickname === 'string' ? saved.nickname.trim().slice(0, 40) : '',
      activeModeId: validMode,
      playlists,
      liked,
      recent,
    });
  }

  async sessionCookieHeader(): Promise<string | undefined> {
    if (!this.secrets) return undefined;
    const raw = await this.secrets.get(QISHUI_SECRET_KEY).catch(() => null);
    if (!raw) return undefined;
    try {
      const cookies = parseQishuiCookiePayload(raw);
      return musicCookieHeader(cookies);
    } catch {
      return undefined;
    }
  }

  private async fetchProfileFromCookies(
    cookieHeader: string,
    http: HTTPClient,
  ): Promise<{ nickname?: string; userId?: string; avatar?: string; isVip?: boolean }> {
    const endpoints = [
      { url: 'https://api.qishui.com/luna/pc/me?aid=386088', ua: LUNA_PC_UA },
      { url: 'https://beta-luna.douyin.com/luna/pc/me?aid=386088', ua: LUNA_PC_UA },
    ];
    for (const ep of endpoints) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const res = row(
          await http(
            ep.url,
            {
              method: 'GET',
              credentials: 'omit',
              headers: {
                Cookie: cookieHeader,
                Referer: 'https://music.douyin.com/qishui',
                'User-Agent': ep.ua,
                Accept: 'application/json',
              },
            },
            ctrl.signal,
          ),
        );
        const user = row(res.my_info ?? res.user_info ?? res.user ?? row(res.data).my_info ?? row(res.data).user_info ?? res.data);
        const nick = text(user.nickname ?? user.nick_name ?? user.name).trim();
        const uid = text(user.id ?? user.user_id ?? user.uid).trim();
        const av = cover(user.medium_avatar_url ?? user.thumb_avatar_url ?? user.avatar_url ?? user.avatar);
        const vipFlag = user.is_vip ?? row(res.my_info).is_vip ?? row(res.data).is_vip;
        const isVip = vipFlag === true || vipFlag === 1 || vipFlag === '1' || vipFlag === 'true';
        if (nick || uid) {
          return {
            ...(nick ? { nickname: nick.slice(0, 40) } : {}),
            ...(uid ? { userId: uid.slice(0, 64) } : {}),
            ...(av && safePublicURL(av) ? { avatar: av } : {}),
            ...(vipFlag !== undefined ? { isVip } : {}),
          };
        }
      } catch {
        // try next official host
      } finally {
        clearTimeout(timer);
      }
    }
    return {};
  }

  async loginWithWebView(deps: {
    native: MusicWebAuthNative;
    uuid: () => string;
    http?: HTTPClient;
  }): Promise<QishuiAccountSnapshot> {
    const attempt = deps.uuid();
    const raw = await deps.native.open(attempt, 'qishui', MUSIC_WEB_LOGIN_URLS.qishui);
    const cookies = parseQishuiCookiePayload(raw);
    if (this.secrets) {
      await this.secrets.set(QISHUI_SECRET_KEY, JSON.stringify(cookies));
    }
    const cookieHeader = musicCookieHeader(cookies);
    const profile = await this.fetchProfileFromCookies(cookieHeader, deps.http ?? requestJSON);
    const nickname = profile.nickname || this.snapshot.nickname || '汽水音乐用户';
    const userId = profile.userId || cookies.uid_tt?.slice(0, 32) || cookies.uid_tt_ss?.slice(0, 32) || 'qishui';
    const avatar = profile.avatar || this.snapshot.avatar;
    const next: QishuiAccountSnapshot = {
      ...this.snapshot,
      loggedIn: true,
      userId,
      nickname,
      ...(avatar ? { avatar } : {}),
      ...(profile.isVip !== undefined ? { isVip: profile.isVip } : {}),
      loggedInAt: Date.now(),
    };
    await this.commit(next);
    return next;
  }

  async logout() {
    if (this.secrets) {
      await this.secrets.remove(QISHUI_SECRET_KEY).catch(() => {});
    }
    await this.commit({
      ...this.snapshot,
      loggedIn: false,
      userId: undefined,
      avatar: undefined,
      isVip: undefined,
      loggedInAt: undefined,
    });
  }

  async setNickname(nickname: string) {
    await this.commit({ ...this.snapshot, nickname: nickname.trim().slice(0, 40) });
  }

  async setActiveMode(modeId: string) {
    const normalized = normalizeModeId(modeId);
    if (normalized === this.snapshot.activeModeId) return;
    await this.commit({ ...this.snapshot, activeModeId: normalized });
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
    if (this.secrets) {
      await this.secrets.remove(QISHUI_SECRET_KEY).catch(() => {});
    }
    await this.commit({ loggedIn: false, nickname: '', activeModeId: 'default', playlists: [], liked: [], recent: [] });
  }
}

export class QishuiProvider {
  private http: HTTPClient;
  private expand: (url: string, signal: AbortSignal) => Promise<string>;

  constructor(
    http: HTTPClient = requestJSON,
    expand = (url: string, signal: AbortSignal) =>
      bounded(
        async child => {
          const result = await fetch(url, { signal: child });
          if (!result.ok) throw new Error('短链接展开失败');
          const expanded = result.url;
          try {
            await result.body?.cancel();
          } catch {
            /* RN may not expose a readable body. */
          }
          return expanded;
        },
        signal,
        12000,
      ),
  ) {
    this.http = http;
    this.expand = expand;
  }

  private pcGet(path: string, query: Record<string, string | number>, signal: AbortSignal, cookieHeader?: string) {
    return this.http(
      queryURL(`https://api.qishui.com${path}`, { aid: '386088', ...query }),
      {
        method: 'GET',
        credentials: 'omit',
        headers: {
          Accept: 'application/json',
          'User-Agent': LUNA_PC_UA,
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      },
      signal,
    );
  }

  async complete(input: string, signal: AbortSignal, cookieHeader?: string): Promise<QishuiPlaylist> {
    throwIfAborted(signal);
    let id = qishuiID(input);
    if (!id) id = urlID(shareURL(await this.expand(shareURL(input).toString(), signal)));
    if (!id) throw new Error('无法识别汽水短链接，请粘贴完整歌单地址或ID');
    let cursor = '0';
    let title = '';
    let total: number | undefined;
    const visited = new Set<string>();
    const tracks: Track[] = [];
    for (let page = 0; page < 100; page++) {
      throwIfAborted(signal);
      if (visited.has(cursor)) throw new Error('汽水歌单分页未推进，未导入不完整数据');
      visited.add(cursor);
      const raw = row(
        await this.http(
          'https://beta-luna.douyin.com/luna/playlist/detail',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Luna/19.1.0 Android',
              ...(cookieHeader ? { Cookie: cookieHeader } : {}),
            },
            body: JSON.stringify({ playlist_id: id, cursor, count: 200 }),
          },
          signal,
        ),
      );
      throwIfAborted(signal);
      const playlist = row(raw.playlist);
      const count = Number(playlist.count_tracks);
      if (identifier(playlist.id) !== id || !Number.isInteger(count) || count < 0 || count > 20000 || !Array.isArray(raw.media_resources) || typeof raw.has_more !== 'boolean') {
        throw new Error('无法完整读取此汽水公开歌单');
      }
      if (total === undefined) {
        total = count;
        title = text(playlist.title ?? playlist.name) || '汽水公开歌单';
      } else if (total !== count) {
        throw new Error('汽水歌单在读取中改变，请重试');
      }
      tracks.push(...list(raw.media_resources).map(qishuiTrack));
      if (tracks.length > total) throw new Error('汽水歌曲数量与歌单不一致');
      if (raw.has_more !== true) {
        if (tracks.length !== total) throw new Error('汽水歌单歌曲不完整，未导入');
        return { id, title, tracks };
      }
      const next = text(raw.next_cursor);
      if (!next || !list(raw.media_resources).length) throw new Error('汽水分页缺少下一页');
      cursor = next;
    }
    throw new Error('汽水歌单超过分页上限，未导入');
  }

  /** Reads a Qishui playlist via official PC endpoint first, falling back to app endpoint. */
  async playlistTracks(playlistId: string, signal: AbortSignal, cookieHeader?: string): Promise<QishuiPlaylist> {
    throwIfAborted(signal);
    try {
      const tracks: Track[] = [];
      const seen = new Set<string>();
      let cursor = '';
      let title = '汽水歌单';
      for (let page = 0; page < 40; page++) {
        const res = row(
          await this.pcGet(
            '/luna/pc/playlist/detail',
            { playlist_id: playlistId, cursor, count: 50, app_name: 'luna_pc', device_platform: 'windows', version_code: '30030000' },
            signal,
            cookieHeader,
          ),
        );
        const body = Object.keys(row(res.data)).length ? row(res.data) : res;
        const meta = row(body.playlist);
        if (page === 0) {
          title = text(meta.public_title ?? meta.title ?? meta.name) || title;
        }
        const resources = list(body.media_resources);
        for (const r of resources) {
          try {
            const t = qishuiTrack(r);
            const k = trackKey(t.origin);
            if (!seen.has(k)) {
              seen.add(k);
              tracks.push(t);
            }
          } catch {
            // Skip non-track UGC video entries cleanly
          }
        }
        const hasMore = body.has_more === true || body.has_more === 1 || body.has_more === '1';
        const next = text(body.next_cursor);
        if (!hasMore || !next || next === cursor) break;
        cursor = next;
      }
      if (tracks.length) return { id: playlistId, title, tracks };
    } catch (err) {
      throwIfAborted(signal);
      void err;
    }
    return this.complete(playlistId, signal, cookieHeader);
  }

  /** Official authenticated PC playlists (`/luna/pc/me/playlist` + `/luna/me/collection/mixed`). */
  async fetchUserPlaylists(cookieHeader: string, signal: AbortSignal): Promise<readonly QishuiCloudPlaylistSummary[]> {
    throwIfAborted(signal);
    const out: QishuiCloudPlaylistSummary[] = [];
    const seen = new Set<string>();
    const pushItem = (rawPl: unknown, favoriteHint = false) => {
      const pl = row(rawPl);
      const id = text(pl.id);
      if (!id || seen.has(id)) return;
      seen.add(id);
      const title = text(pl.public_title ?? pl.title ?? pl.name) || '汽水歌单';
      const artwork = cover(pl.url_cover ?? pl.cover_url) || undefined;
      const trackCount = num(pl.count_tracks ?? pl.track_count);
      const isFavorite = favoriteHint || /我喜欢|喜欢的音乐/.test(title) || num(pl.type) === 1;
      out.push({ id, title, ...(artwork && safePublicURL(artwork) ? { artwork } : {}), trackCount, isFavorite });
    };

    try {
      const res = row(
        await this.pcGet('/luna/pc/me/playlist', { version_code: '30020100', cursor: '', count: 50 }, signal, cookieHeader),
      );
      for (const item of list(res.playlists ?? row(res.data).playlists)) pushItem(item, false);
    } catch (err) {
      throwIfAborted(signal);
      void err;
    }

    try {
      const col = row(
        await this.pcGet(
          '/luna/me/collection/mixed',
          { item_types: 'playlist', cursor: '', count: 50, version_code: '30020100' },
          signal,
          cookieHeader,
        ),
      );
      for (const entry of list(col.mixed_collections ?? row(col.data).mixed_collections)) {
        const pl = row(row(entry).playlist ?? entry);
        pushItem(pl, false);
      }
    } catch (err) {
      throwIfAborted(signal);
      void err;
    }

    return out;
  }

  /** Official authenticated PC recently played songs (`/luna/pc/me/recently-played-media`). */
  async fetchRecentPlays(cookieHeader: string, signal: AbortSignal, limit = 50): Promise<readonly Track[]> {
    throwIfAborted(signal);
    const res = row(
      await this.pcGet(
        '/luna/pc/me/recently-played-media',
        { iid: '27960026095955', version_code: '30030000', device_platform: 'windows', cursor: '', count: Math.min(50, limit), media_type: 'track', scene: '' },
        signal,
        cookieHeader,
      ),
    );
    const out: Track[] = [];
    const seen = new Set<string>();
    for (const entry of list(res.media ?? row(res.data).media)) {
      try {
        const t = qishuiTrack(entry);
        const k = trackKey(t.origin);
        if (!seen.has(k)) {
          seen.add(k);
          out.push(t);
        }
      } catch {
        // skip unsupported entries
      }
    }
    return out;
  }

  /** Official public PC charts (`/luna/pc/discover`) & chart tracks (`/luna/pc/charts/{id}`). */
  async fetchCharts(signal: AbortSignal): Promise<readonly QishuiChartSummary[]> {
    throwIfAborted(signal);
    const res = row(await this.pcGet('/luna/pc/discover', {}, signal));
    const blocks = list(res.blocks ?? row(res.data).blocks);
    const out: QishuiChartSummary[] = [];
    const seen = new Set<string>();
    for (const b of blocks) {
      const block = row(b);
      for (const rawChart of list(block.resources ?? block.charts ?? block.items)) {
        const entity = row(row(rawChart).entity ?? rawChart);
        const chart = row(entity.chart ?? entity.rank ?? entity);
        const id = text(chart.id);
        const title = text(chart.title ?? chart.name);
        if (!id || !title || seen.has(id)) continue;
        seen.add(id);
        const artwork = cover(chart.url_cover ?? chart.cover_url) || undefined;
        const previewTracks = list(chart.tracks)
          .map(t => qishuiTrackFromRaw(row(t)))
          .filter((t): t is Track => !!t)
          .slice(0, 3);
        out.push({ id, title, ...(artwork && safePublicURL(artwork) ? { artwork } : {}), previewTracks });
      }
    }
    return out;
  }

  async fetchChartTracks(chartId: string, signal: AbortSignal): Promise<readonly Track[]> {
    throwIfAborted(signal);
    const res = row(await this.pcGet(`/luna/pc/charts/${encodeURIComponent(chartId)}`, {}, signal));
    const rawTracks = list(res.tracks ?? row(res.chart).tracks ?? row(res.data).tracks);
    return rawTracks
      .map(item => {
        try {
          return qishuiTrack(item);
        } catch {
          return qishuiTrackFromRaw(row(item));
        }
      })
      .filter((t): t is Track => !!t);
  }

  /** Official direct playback via `/luna/pc/track_v2` & `/luna/h5/seo_track` — unencrypted full tracks only. */
  async directPlayback(
    track: Track,
    cookieHeader: string | undefined,
    signal: AbortSignal,
  ): Promise<{ readonly url: string; readonly quality: Quality } | null> {
    if (track.origin.kind !== 'imported' || track.origin.platform !== 'qishui') return null;
    if (!/^\d{5,30}$/.test(track.origin.id)) return null;
    const endpoints = [
      queryURL('https://api.qishui.com/luna/pc/track_v2', {
        track_id: track.origin.id,
        media_type: 'track',
        aid: '386088',
        device_platform: 'web',
        channel: 'pc_web',
      }),
      queryURL('https://api.qishui.com/luna/h5/seo_track', { track_id: track.origin.id }),
    ];
    for (const url of endpoints) {
      try {
        const res = row(
          await bounded(
            child =>
              this.http(
                url,
                {
                  method: 'GET',
                  credentials: 'omit',
                  headers: {
                    Accept: 'application/json',
                    'User-Agent': LUNA_PC_UA,
                    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
                  },
                },
                child,
              ),
            signal,
            8_000,
          ),
        );
        const trackInfo = row(res.track ?? row(res.seo_track).track ?? row(res.data).track);
        const fullDurMs = num(trackInfo.duration ?? track.durationMs);
        const player = row(res.track_player ?? row(res.seo_track).track_player ?? res.player ?? row(res.data).track_player);
        // Reject encrypted (spade_a) streams and short preview clips (< 70% of track length)
        if (text(player.spade_a) || text(player.spadeA)) continue;
        const playDurMs = num(player.duration ?? player.expire_time ? player.duration : 0);
        if (fullDurMs > 45_000 && playDurMs > 0 && playDurMs < fullDurMs * 0.7) continue;
        const streamUrl = text(player.url_player_info ?? player.url ?? player.play_url).replace(/^http:\/\//i, 'https://');
        if (streamUrl && safePublicURL(streamUrl)) {
          const bitrate = num(player.bitrate ?? player.bit_rate);
          const quality: Quality = bitrate >= 700_000 ? 'flac' : bitrate >= 250_000 ? '320k' : '128k';
          return { url: streamUrl, quality };
        }
      } catch (err) {
        throwIfAborted(signal);
        void err;
      }
    }
    return null;
  }

  /** Official Qishui lyric reader via `/luna/pc/track_v2` & `/luna/h5/seo_track`. */
  async lyric(track: Track, cookieHeader: string | undefined, signal: AbortSignal): Promise<{ readonly lyric: string; readonly tlyric?: string } | string> {
    if (track.origin.kind !== 'imported' || track.origin.platform !== 'qishui') return '';
    if (!/^\d{5,30}$/.test(track.origin.id)) return '';
    try {
      const res = row(
        await this.pcGet(
          '/luna/pc/track_v2',
          { track_id: track.origin.id, media_type: 'track', device_platform: 'web', channel: 'pc_web' },
          signal,
          cookieHeader,
        ),
      );
      const lrcObj = row(res.lyric ?? row(res.data).lyric);
      const raw = text(lrcObj.content ?? lrcObj.lrc);
      const trans = text(row(lrcObj.translations).zh ?? lrcObj.translation);
      if (raw) return { lyric: raw, ...(trans ? { tlyric: trans } : {}) };
    } catch (err) {
      throwIfAborted(signal);
      void err;
    }
    return '';
  }
}
