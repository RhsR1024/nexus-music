import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import type { OnlinePlatform, Track } from '../domain/track.ts';
import { currentEntry } from '../domain/queue.ts';
import type { ArtistItem } from '../providers/artists.ts';
import type { BrowseItem } from '../providers/discovery.ts';
import type { AccountPlaylist } from '../providers/accountPlaylists.ts';
import type { AccountAlbum } from '../providers/accountAlbums.ts';
import type { AccountMV } from '../providers/accountMVs.ts';
import type { PlayRecordRow } from '../providers/accountDiscovery.ts';
import { formatCacheAge } from '../providers/accountFeatureCache.ts';
import type { VideoItem } from '../providers/videos.ts';
import { Modal } from './AdaptiveModal.tsx';
import { Cover } from './Cover.tsx';
import { QualityBadge } from './QualityBadge.tsx';
import { Toast, useToast } from './Toast.tsx';
import { TrackActions } from './TrackActions.tsx';
import { Text } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { sollinTokens } from './tokens.ts';

export type AccountFeatureKind =
  | 'wy_daily'
  | 'wy_rec_playlists'
  | 'wy_heartbeat'
  | 'wy_sub_playlists'
  | 'wy_created_playlists'
  | 'wy_liked'
  | 'wy_fm'
  | 'wy_recent_songs'
  | 'wy_recent_playlists'
  | 'wy_play_record'
  | 'wy_cloud'
  | 'wy_sub_artists'
  | 'wy_sub_albums'
  | 'wy_sub_mvs'
  | 'tx_liked'
  | 'tx_playlists'
  | 'tx_radar'
  | 'tx_new_songs'
  | 'tx_rec_playlists'
  | 'tx_home_feed'
  | 'kg_daily'
  | 'kg_liked'
  | 'kg_playlists'
  | 'kg_new_songs';

const CACHE_STALE_MS = 10 * 60 * 1000;

const FEATURE_META: Record<AccountFeatureKind, { title: string; platform: OnlinePlatform; requiresLogin: boolean; subtitle: string }> = {
  wy_daily: { title: '网易云 · 每日推荐', platform: 'wy', requiresLogin: true, subtitle: '根据你的听歌口味每日生成' },
  wy_rec_playlists: { title: '网易云 · 推荐歌单', platform: 'wy', requiresLogin: true, subtitle: '为你精选的个性化歌单' },
  wy_heartbeat: { title: '网易云 · 心动模式', platform: 'wy', requiresLogin: true, subtitle: '由你的红心歌曲延伸出的心动旋律' },
  wy_sub_playlists: { title: '网易云 · 收藏的歌单', platform: 'wy', requiresLogin: true, subtitle: '点击歌单快速查看并直接播放' },
  wy_created_playlists: { title: '网易云 · 创建的歌单', platform: 'wy', requiresLogin: true, subtitle: '点击歌单快速查看并直接播放' },
  wy_liked: { title: '网易云 · 我喜欢的音乐', platform: 'wy', requiresLogin: true, subtitle: '云端红心曲库，默认缓存秒开' },
  wy_fm: { title: '网易云 · 私人 FM', platform: 'wy', requiresLogin: true, subtitle: '自动续播的专属音乐电台' },
  wy_recent_songs: { title: '网易云 · 最近播放', platform: 'wy', requiresLogin: true, subtitle: '云端最近收听歌曲记录' },
  wy_recent_playlists: { title: '网易云 · 最近歌单', platform: 'wy', requiresLogin: true, subtitle: '云端最近访问过的歌单' },
  wy_play_record: { title: '网易云 · 听歌排行', platform: 'wy', requiresLogin: true, subtitle: '你的周榜与总榜常听排行' },
  wy_cloud: { title: '网易云 · 我的云盘', platform: 'wy', requiresLogin: true, subtitle: '个人云盘歌曲列表' },
  wy_sub_artists: { title: '网易云 · 收藏歌手', platform: 'wy', requiresLogin: true, subtitle: '点击歌手查看热门歌曲与专辑' },
  wy_sub_albums: { title: '网易云 · 收藏专辑', platform: 'wy', requiresLogin: true, subtitle: '点击专辑查看曲目并播放' },
  wy_sub_mvs: { title: '网易云 · 收藏 MV', platform: 'wy', requiresLogin: true, subtitle: '点击直接原生播放高清 MV' },
  tx_liked: { title: 'QQ 音乐 · 我喜欢', platform: 'tx', requiresLogin: true, subtitle: 'QQ 云端红心收藏，默认缓存秒开' },
  tx_playlists: { title: 'QQ 音乐 · 个人歌单', platform: 'tx', requiresLogin: true, subtitle: '读取 QQ 歌单并默认缓存加速' },
  tx_radar: { title: 'QQ 音乐 · 雷达推荐', platform: 'tx', requiresLogin: true, subtitle: 'QQ 每日推荐与私人雷达' },
  tx_new_songs: { title: 'QQ 音乐 · 新歌推荐', platform: 'tx', requiresLogin: false, subtitle: 'QQ 音乐最新发行单曲' },
  tx_rec_playlists: { title: 'QQ 音乐 · 推荐歌单', platform: 'tx', requiresLogin: false, subtitle: 'QQ 音乐精选推荐歌单' },
  tx_home_feed: { title: 'QQ 音乐 · 个性首页', platform: 'tx', requiresLogin: false, subtitle: '整合雷达推荐、新歌与精选歌单' },
  kg_daily: { title: '酷狗音乐 · 每日推荐', platform: 'kg', requiresLogin: true, subtitle: '酷狗账号专属每日推荐' },
  kg_liked: { title: '酷狗音乐 · 我喜欢', platform: 'kg', requiresLogin: true, subtitle: '酷狗云端红心收藏，默认缓存秒开' },
  kg_playlists: { title: '酷狗音乐 · 个人歌单', platform: 'kg', requiresLogin: true, subtitle: '读取酷狗歌单并默认缓存加速' },
  kg_new_songs: { title: '酷狗音乐 · 新歌速递', platform: 'kg', requiresLogin: false, subtitle: '酷狗音乐最新热门新歌' },
};

const TRACK_CACHE_FEATURES = new Set<AccountFeatureKind>([
  'wy_liked',
  'tx_liked',
  'kg_liked',
  'wy_daily',
  'tx_radar',
  'kg_daily',
  'wy_cloud',
  'wy_recent_songs',
]);

const CATALOG_CACHE_FEATURES = new Set<AccountFeatureKind>([
  'wy_sub_playlists',
  'wy_created_playlists',
  'tx_playlists',
  'kg_playlists',
]);

function findLikedPlaylist(playlists: readonly AccountPlaylist[]): AccountPlaylist | undefined {
  return (
    playlists.find(p => p.kind === 'created' && /我喜欢|喜欢的音乐/.test(p.title)) ??
    playlists.find(p => /我喜欢|喜欢的音乐/.test(p.title)) ??
    playlists.find(p => p.kind === 'created') ??
    playlists[0]
  );
}

export function AccountFeatureSheet({
  services,
  feature,
  onClose,
  onOpenAccounts,
  onOpenPlaylist,
  onOpenArtist,
  onOpenAlbum,
  onOpenMV,
}: {
  services: Services;
  feature: AccountFeatureKind | null;
  onClose: () => void;
  onOpenAccounts?: () => void;
  onOpenPlaylist: (platform: OnlinePlatform, item: BrowseItem) => void;
  onOpenArtist: (platform: OnlinePlatform, item: ArtistItem) => void;
  onOpenAlbum: (platform: OnlinePlatform, item: BrowseItem) => void;
  onOpenMV: (video: VideoItem) => void;
}) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);
  const insets = useSafeAreaInsets();
  const accounts = useSyncExternalStore(services.musicAccounts.subscribe, services.musicAccounts.getSnapshot);
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cacheSyncLabel, setCacheSyncLabel] = useState('');
  const [startingAction, setStartingAction] = useState<null | 'all' | 'shuffle'>(null);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [recordRange, setRecordRange] = useState<1 | 0>(1);

  const [tracks, setTracks] = useState<readonly Track[]>([]);
  const [playRecordRows, setPlayRecordRows] = useState<readonly PlayRecordRow[]>([]);
  const [accountPlaylists, setAccountPlaylists] = useState<readonly AccountPlaylist[]>([]);
  const [browsePlaylists, setBrowsePlaylists] = useState<readonly BrowseItem[]>([]);
  const [artists, setArtists] = useState<readonly ArtistItem[]>([]);
  const [albums, setAlbums] = useState<readonly AccountAlbum[]>([]);
  const [mvs, setMvs] = useState<readonly AccountMV[]>([]);

  const [openedPlaylist, setOpenedPlaylist] = useState<AccountPlaylist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<readonly Track[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistError, setPlaylistError] = useState('');

  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const deferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catalogSyncLabelRef = useRef('');

  const meta = feature ? FEATURE_META[feature] : null;
  const activeAccount = meta ? accounts.find(a => a.platform === meta.platform) : undefined;

  function cancelPendingWork() {
    if (deferTimerRef.current) {
      clearTimeout(deferTimerRef.current);
      deferTimerRef.current = null;
    }
    abortRef.current?.abort();
    abortRef.current = null;
  }

  function closeOpenedPlaylist() {
    cancelPendingWork();
    setOpenedPlaylist(null);
    setPlaylistTracks([]);
    setPlaylistError('');
    setPlaylistLoading(false);
    setRefreshing(false);
    setCacheSyncLabel(catalogSyncLabelRef.current);
  }

  function triggerBatchPlay(pool: readonly Track[], mode: 'all' | 'shuffle') {
    if (!pool.length || startingAction) return;
    setStartingAction(mode);
    toast.show(
      mode === 'shuffle'
        ? `正在准备随机播放（${pool.length} 首）…`
        : `正在载入队列并开始播放（${pool.length} 首）…`,
    );
    // Yield one frame so the loading indicator & toast paint immediately even for 1000+ song playlists.
    setTimeout(() => {
      const startIndex = mode === 'shuffle' ? Math.floor(Math.random() * pool.length) : 0;
      const done = () => setStartingAction(null);
      if (mode === 'shuffle') {
        void services.preferences
          .update({ repeat: 'off', shuffle: true })
          .then(() => services.playTracks(pool, startIndex))
          .catch(() => services.playTracks(pool, startIndex))
          .finally(done);
      } else {
        services.playTracks(pool, 0);
        setTimeout(done, 260);
      }
    }, 16);
  }

  async function loadFeature(target: AccountFeatureKind, range: 1 | 0 = recordRange, forceRefresh = false) {
    cancelPendingWork();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const info = FEATURE_META[target];
    const acct = accounts.find(a => a.platform === info.platform);

    setError('');
    setNeedsLogin(false);
    setOpenedPlaylist(null);
    setPlaylistTracks([]);
    setPlaylistLoading(false);
    setPlaylistError('');
    setCacheSyncLabel('');
    catalogSyncLabelRef.current = '';
    // Always reset all list buckets before checking cache so stale lists from a
    // previous feature never bleed into the current screen or break FlatList virtualization.
    setTracks([]);
    setPlayRecordRows([]);
    setAccountPlaylists([]);
    setBrowsePlaylists([]);
    setArtists([]);
    setAlbums([]);
    setMvs([]);

    if (info.requiresLogin && !acct) {
      setLoading(false);
      setRefreshing(false);
      setNeedsLogin(true);
      return;
    }

    // Serve cached tracks / playlist catalog instantaneously when available
    let servedFromCache = false;
    if (!forceRefresh && acct) {
      if (TRACK_CACHE_FEATURES.has(target)) {
        const cached = services.accountFeatureCache.getTracks(`${acct.id}:${target}`);
        if (cached?.tracks.length) {
          setTracks(cached.tracks);
          setCacheSyncLabel(`已缓存 · ${formatCacheAge(cached.updatedAt)}`);
          servedFromCache = true;
          if (Date.now() - cached.updatedAt < CACHE_STALE_MS) {
            setLoading(false);
            setRefreshing(false);
            return;
          }
        }
      } else if (CATALOG_CACHE_FEATURES.has(target)) {
        const cached = services.accountFeatureCache.getCatalog(`${acct.id}:${target}`);
        if (cached?.playlists.length) {
          setAccountPlaylists(cached.playlists);
          const lbl = `已缓存 · ${formatCacheAge(cached.updatedAt)}`;
          setCacheSyncLabel(lbl);
          catalogSyncLabelRef.current = lbl;
          servedFromCache = true;
          if (Date.now() - cached.updatedAt < CACHE_STALE_MS) {
            setLoading(false);
            setRefreshing(false);
            return;
          }
        }
      }
    }

    if (servedFromCache) {
      setLoading(false);
      setRefreshing(true);
      // Let the modal slide-in animation & cached list render smoothly before starting stale background sync.
      await new Promise<void>(resolve => {
        const timer = setTimeout(() => {
          deferTimerRef.current = null;
          resolve();
        }, 180);
        deferTimerRef.current = timer;
        ctrl.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          if (deferTimerRef.current === timer) deferTimerRef.current = null;
          resolve();
        }, { once: true });
      });
      if (ctrl.signal.aborted) return;
    } else {
      setLoading(true);
      setRefreshing(false);
    }

    try {
      const session = acct ? await services.musicAccounts.session(acct.id) : undefined;
      if (ctrl.signal.aborted) return;

      switch (target) {
        case 'wy_daily':
        case 'tx_radar':
        case 'kg_daily': {
          const res = await services.accountDaily.fetch(acct!, session!, ctrl.signal);
          if (!ctrl.signal.aborted) {
            if (res.tracks.length) {
              setTracks(res.tracks);
              setCacheSyncLabel('已缓存 · 刚刚同步');
              void services.accountFeatureCache.setTracks(`${acct!.id}:${target}`, res.tracks);
            } else if (!servedFromCache) {
              setError(
                res.reason === 'login_required'
                  ? '登录会话已失效，请重新登录账号'
                  : '平台暂未返回今日推荐曲目，请稍后重试',
              );
            }
          }
          break;
        }
        case 'wy_rec_playlists': {
          const items = await services.accountRecommendedPlaylists.list(acct!, session!, ctrl.signal);
          if (!ctrl.signal.aborted) setBrowsePlaylists(items);
          break;
        }
        case 'tx_rec_playlists': {
          if (acct && session) {
            try {
              const items = await services.accountRecommendedPlaylists.list(acct, session, ctrl.signal);
              if (!ctrl.signal.aborted && items.length) {
                setBrowsePlaylists(items);
                break;
              }
            } catch {}
          }
          const page = await services.discovery.playlists('tx', 1, undefined, ctrl.signal, 30);
          if (!ctrl.signal.aborted) setBrowsePlaylists(page.items);
          break;
        }
        case 'wy_heartbeat': {
          const cur = currentEntry(services.playback.controller.getSnapshot().queue)?.track;
          const res = await services.accountHeartbeat.start(acct!, session!, cur, ctrl.signal);
          if (!ctrl.signal.aborted) {
            setTracks(res.tracks);
            if (res.tracks.length) services.playTracks(res.tracks, 0);
          }
          break;
        }
        case 'wy_fm': {
          const batch = await services.accountFmStation.start(acct!, session!, undefined, 0, ctrl.signal);
          if (!ctrl.signal.aborted) setTracks(batch);
          break;
        }
        case 'wy_sub_playlists': {
          const all = await services.accountPlaylists.list(acct!, ctrl.signal);
          const filtered = all.filter(p => p.kind === 'favorite');
          if (!ctrl.signal.aborted) {
            setAccountPlaylists(filtered);
            const lbl = '已缓存 · 刚刚同步';
            setCacheSyncLabel(lbl);
            catalogSyncLabelRef.current = lbl;
            void services.accountFeatureCache.setCatalog(`${acct!.id}:${target}`, filtered);
          }
          break;
        }
        case 'wy_created_playlists': {
          const all = await services.accountPlaylists.list(acct!, ctrl.signal);
          const filtered = all.filter(p => p.kind === 'created');
          if (!ctrl.signal.aborted) {
            setAccountPlaylists(filtered);
            const lbl = '已缓存 · 刚刚同步';
            setCacheSyncLabel(lbl);
            catalogSyncLabelRef.current = lbl;
            void services.accountFeatureCache.setCatalog(`${acct!.id}:${target}`, filtered);
          }
          break;
        }
        case 'tx_playlists':
        case 'kg_playlists': {
          const all = await services.accountPlaylists.list(acct!, ctrl.signal);
          if (!ctrl.signal.aborted) {
            setAccountPlaylists(all);
            const lbl = '已缓存 · 刚刚同步';
            setCacheSyncLabel(lbl);
            catalogSyncLabelRef.current = lbl;
            void services.accountFeatureCache.setCatalog(`${acct!.id}:${target}`, all);
          }
          break;
        }
        case 'wy_liked':
        case 'tx_liked':
        case 'kg_liked': {
          const all = await services.accountPlaylists.list(acct!, ctrl.signal);
          const fav = findLikedPlaylist(all);
          if (!fav) {
            if (!ctrl.signal.aborted && !servedFromCache) setError('未在账号中找到「我喜欢」歌单');
            break;
          }
          const preview = await services.accountPlaylists.preview(
            acct!,
            fav,
            ctrl.signal,
            { lenient: true },
          );
          if (!ctrl.signal.aborted) {
            setTracks(preview.tracks);
            setCacheSyncLabel('已缓存 · 刚刚同步');
            void services.accountFeatureCache.setTracks(`${acct!.id}:${target}`, preview.tracks);
          }
          break;
        }
        case 'wy_recent_songs': {
          const items = await services.accountDiscovery.recentSongs(acct!, session!, ctrl.signal, 100);
          if (!ctrl.signal.aborted) {
            setTracks(items);
            setCacheSyncLabel('已缓存 · 刚刚同步');
            void services.accountFeatureCache.setTracks(`${acct!.id}:${target}`, items);
          }
          break;
        }
        case 'wy_recent_playlists': {
          const items = await services.accountDiscovery.recentPlaylists(acct!, session!, ctrl.signal, 60);
          if (!ctrl.signal.aborted) setBrowsePlaylists(items);
          break;
        }
        case 'wy_play_record': {
          const rows = await services.accountDiscovery.playRecord(acct!, session!, range, ctrl.signal);
          if (!ctrl.signal.aborted) {
            setPlayRecordRows(rows);
            setTracks(rows.map(r => r.track));
          }
          break;
        }
        case 'wy_cloud': {
          const res = await services.accountDiscovery.cloudDrive(acct!, session!, ctrl.signal, 100, 0);
          if (!ctrl.signal.aborted) {
            setTracks(res.items);
            setCacheSyncLabel('已缓存 · 刚刚同步');
            void services.accountFeatureCache.setTracks(`${acct!.id}:${target}`, res.items);
          }
          break;
        }
        case 'wy_sub_artists': {
          const res = await services.accountDiscovery.subscribedArtists(acct!, session!, ctrl.signal, 100, 0);
          if (!ctrl.signal.aborted) setArtists(res.items);
          break;
        }
        case 'wy_sub_albums': {
          const list = await services.accountAlbums.list(acct!, ctrl.signal);
          if (!ctrl.signal.aborted) setAlbums(list);
          break;
        }
        case 'wy_sub_mvs': {
          const list = await services.accountMVs.list(acct!, ctrl.signal);
          if (!ctrl.signal.aborted) setMvs(list);
          break;
        }
        case 'tx_new_songs': {
          const items = await services.accountDiscovery.qqNewSongs(ctrl.signal);
          if (!ctrl.signal.aborted) setTracks(items);
          break;
        }
        case 'kg_new_songs': {
          const items = await services.accountDiscovery.kugouNewSongs(ctrl.signal);
          if (!ctrl.signal.aborted) setTracks(items);
          break;
        }
        case 'tx_home_feed': {
          const [newRes, plRes, dailyRes] = await Promise.allSettled([
            services.accountDiscovery.qqNewSongs(ctrl.signal),
            acct && session
              ? services.accountRecommendedPlaylists.list(acct, session, ctrl.signal)
              : services.discovery.playlists('tx', 1, undefined, ctrl.signal, 18).then(r => r.items),
            acct && session ? services.accountDaily.fetch(acct, session, ctrl.signal) : Promise.resolve(null),
          ]);
          if (ctrl.signal.aborted) return;
          const combinedTracks: Track[] = [];
          if (dailyRes.status === 'fulfilled' && dailyRes.value?.tracks.length) {
            combinedTracks.push(...dailyRes.value.tracks.slice(0, 15));
          }
          if (newRes.status === 'fulfilled' && newRes.value.length) {
            combinedTracks.push(...newRes.value.slice(0, 20));
          }
          setTracks(combinedTracks);
          if (plRes.status === 'fulfilled') setBrowsePlaylists(plRes.value.slice(0, 12));
          if (!combinedTracks.length && (plRes.status !== 'fulfilled' || !plRes.value.length)) {
            setError('QQ 音乐个性首页暂时不可用，请稍后重试');
          }
          break;
        }
      }
    } catch (e) {
      if (!ctrl.signal.aborted && !servedFromCache) {
        const msg = e instanceof Error ? e.message : '读取失败，请稍后重试';
        if (/重新登录|失效/.test(msg)) setNeedsLogin(true);
        setError(msg);
      }
    } finally {
      if (!ctrl.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  async function openAccountPlaylist(pl: AccountPlaylist, forceRefresh = false) {
    if (!activeAccount) return;
    cancelPendingWork();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setOpenedPlaylist(pl);
    setPlaylistError('');
    setError('');

    const cacheKey = `${activeAccount.id}:pl:${pl.id}`;
    let servedFromCache = false;
    if (!forceRefresh) {
      const cached = services.accountFeatureCache.getTracks(cacheKey);
      if (cached?.tracks.length) {
        setPlaylistTracks(cached.tracks);
        setCacheSyncLabel(`已缓存 · ${formatCacheAge(cached.updatedAt)}`);
        servedFromCache = true;
        if (Date.now() - cached.updatedAt < CACHE_STALE_MS) {
          setPlaylistLoading(false);
          setRefreshing(false);
          return;
        }
      }
    }

    if (servedFromCache) {
      setPlaylistLoading(false);
      setRefreshing(true);
      await new Promise<void>(resolve => {
        const timer = setTimeout(() => {
          deferTimerRef.current = null;
          resolve();
        }, 180);
        deferTimerRef.current = timer;
        ctrl.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          if (deferTimerRef.current === timer) deferTimerRef.current = null;
          resolve();
        }, { once: true });
      });
      if (ctrl.signal.aborted) return;
    } else {
      setPlaylistTracks([]);
      setPlaylistLoading(true);
      setRefreshing(false);
    }

    try {
      const preview = await services.accountPlaylists.preview(
        activeAccount,
        pl,
        ctrl.signal,
        { lenient: true },
      );
      if (!ctrl.signal.aborted) {
        setPlaylistTracks(preview.tracks);
        setCacheSyncLabel('已缓存 · 刚刚同步');
        void services.accountFeatureCache.setTracks(cacheKey, preview.tracks);
      }
    } catch (e) {
      if (!ctrl.signal.aborted && !servedFromCache) {
        setPlaylistError(e instanceof Error ? e.message : '暂时无法读取该歌单歌曲，请重试');
      }
    } finally {
      if (!ctrl.signal.aborted) {
        setPlaylistLoading(false);
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    if (!feature) {
      cancelPendingWork();
      return;
    }
    void loadFeature(feature, recordRange, false);
    return () => {
      cancelPendingWork();
    };
  }, [feature, activeAccount?.id]);

  if (!feature || !meta) return null;

  const softSurface = s.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.52)';
  const activeTracks = openedPlaylist ? playlistTracks : tracks;
  const headerTitle = openedPlaylist ? openedPlaylist.title : meta.title;
  const headerSubtitle = openedPlaylist
    ? `${playlistTracks.length || openedPlaylist.count} 首${cacheSyncLabel ? ` · ${cacheSyncLabel}` : ' · 云端歌单'}`
    : cacheSyncLabel
      ? `${meta.subtitle} · ${cacheSyncLabel}`
      : meta.subtitle;

  const isPureTrackList =
    !loading &&
    !playlistLoading &&
    !needsLogin &&
    ((openedPlaylist && playlistTracks.length > 0) ||
      (!openedPlaylist &&
        tracks.length > 0 &&
        !accountPlaylists.length &&
        !browsePlaylists.length &&
        !artists.length &&
        !albums.length &&
        !mvs.length));

  const renderTrackItem = (track: Track, index: number, pool: readonly Track[], badgeText?: string) => (
    <View key={`${track.origin.kind === 'online' ? track.origin.id : index}-${index}`} style={{ height: 64, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          toast.show(`正在播放：${track.title}`);
          services.playTracks(pool, index);
        }}
        style={{ flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 11 }}
      >
        <Text style={{ width: 28, textAlign: 'center', color: s.subtle, fontSize: 12.5, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
          {String(index + 1).padStart(2, '0')}
        </Text>
        <Cover services={services} track={track} size={46} radius={10} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ color: s.ink, fontSize: 14.5, fontWeight: '600' }}>{track.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <QualityBadge track={track} />
            <Text numberOfLines={1} style={{ flex: 1, color: s.muted, fontSize: 12 }}>
              {track.artist}{track.album ? ` · ${track.album}` : ''}
            </Text>
          </View>
        </View>
        {!!badgeText && (
          <Text style={{ color: s.subtle, fontSize: 11.5, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{badgeText}</Text>
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`更多操作：${track.title}`}
        onPress={() => setMenuTrack(track)}
        style={{ width: 36, height: 42, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="ellipsis-horizontal" size={18} color={s.muted} />
      </Pressable>
    </View>
  );

  return (
    <Modal visible={!!feature} animationType="slide" onRequestClose={() => { if (openedPlaylist) closeOpenedPlaylist(); else onClose(); }}>
      <View style={{ flex: 1 }}>
        <LinearGradient colors={[...s.sheetGradient]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={{ flex: 1, paddingTop: Math.max(insets.top + 8, 52), paddingHorizontal: 18 }}>
          {/* Unified top-left back header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12 }}>
            <Pressable
              testID="account-feature-back"
              accessibilityRole="button"
              accessibilityLabel={openedPlaylist ? '返回歌单列表' : '返回发现'}
              onPress={() => { if (openedPlaylist) closeOpenedPlaylist(); else onClose(); }}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: softSurface, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="chevron-back" size={22} color={s.ink} />
            </Pressable>
            <View style={{ flex: 1, gap: 1 }}>
              <Text numberOfLines={1} style={{ color: s.ink, fontSize: 19, fontWeight: '700' }}>{headerTitle}</Text>
              <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12 }}>{headerSubtitle}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="强制刷新云端数据"
              disabled={loading || playlistLoading || refreshing}
              onPress={() => {
                if (openedPlaylist) void openAccountPlaylist(openedPlaylist, true);
                else void loadFeature(feature, recordRange, true);
              }}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: softSurface, alignItems: 'center', justifyContent: 'center', opacity: loading || playlistLoading ? 0.5 : 1 }}
            >
              {refreshing ? <ActivityIndicator size="small" color={s.accent} /> : <Ionicons name="refresh" size={18} color={s.ink} />}
            </Pressable>
          </View>

          {/* Weekly / All-time toggle for 听歌排行 */}
          {feature === 'wy_play_record' && !openedPlaylist && (
            <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 10 }}>
              {([
                [1, '最近一周'],
                [0, '所有时间'],
              ] as const).map(([val, label]) => {
                const selected = recordRange === val;
                return (
                  <Pressable
                    key={val}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setRecordRange(val);
                      void loadFeature('wy_play_record', val, true);
                    }}
                    style={{
                      flex: 1,
                      minHeight: 38,
                      borderRadius: 19,
                      backgroundColor: selected ? s.control : softSurface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: selected ? '#FFFFFF' : s.ink, fontSize: 13.5, fontWeight: '700' }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Play All / Shuffle bar with immediate visual loading feedback */}
          {activeTracks.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 10 }}>
              <Pressable
                testID="account-feature-play-all"
                accessibilityRole="button"
                disabled={!!startingAction}
                onPress={() => triggerBatchPlay(activeTracks, 'all')}
                style={{ flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: s.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: startingAction === 'shuffle' ? 0.55 : 1 }}
              >
                {startingAction === 'all' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="play" size={15} color="#FFFFFF" />
                )}
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
                  {startingAction === 'all' ? '正在缓冲…' : `播放全部 (${activeTracks.length})`}
                </Text>
              </Pressable>
              <Pressable
                testID="account-feature-shuffle"
                accessibilityRole="button"
                disabled={!!startingAction}
                onPress={() => triggerBatchPlay(activeTracks, 'shuffle')}
                style={{ flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: softSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: startingAction === 'all' ? 0.55 : 1 }}
              >
                {startingAction === 'shuffle' ? (
                  <ActivityIndicator size="small" color={s.accent} />
                ) : (
                  <Ionicons name="shuffle" size={16} color={s.ink} />
                )}
                <Text style={{ color: s.ink, fontSize: 14, fontWeight: '600' }}>
                  {startingAction === 'shuffle' ? '正在准备…' : '随机播放'}
                </Text>
              </Pressable>
            </View>
          )}

          {/* Loading / Login required / Error */}
          {(loading || playlistLoading) && (
            <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={s.accent} />
              <Text style={{ color: s.muted, fontSize: 13 }}>正在读取云端歌单数据并写入本地缓存…</Text>
            </View>
          )}

          {!loading && needsLogin && (
            <View style={{ padding: 24, borderRadius: 20, backgroundColor: softSurface, alignItems: 'center', gap: 12, marginTop: 12 }}>
              <Ionicons name="person-circle-outline" size={44} color={s.accent} />
              <Text style={{ color: s.ink, fontSize: 16, fontWeight: '700' }}>登录账号后即可直达使用</Text>
              <Text style={{ color: s.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
                {error || '登录后可直接在发现页快速查看并播放每日推荐、我喜欢、个人歌单与收藏内容。'}
              </Text>
              {onOpenAccounts && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => { onClose(); onOpenAccounts(); }}
                  style={{ paddingHorizontal: 22, paddingVertical: 11, borderRadius: 20, backgroundColor: s.control }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>前往登录账号</Text>
                </Pressable>
              )}
            </View>
          )}

          {!loading && !playlistLoading && !needsLogin && !!(playlistError || error) && (
            <View style={{ padding: 18, borderRadius: 18, backgroundColor: softSurface, gap: 10, marginTop: 8 }}>
              <Text style={{ color: s.accent, fontSize: 13.5, lineHeight: 20 }}>{playlistError || error}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (openedPlaylist) void openAccountPlaylist(openedPlaylist, true);
                  else void loadFeature(feature, recordRange, true);
                }}
                style={{ alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: s.control }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '600' }}>重试</Text>
              </Pressable>
            </View>
          )}

          {/* High-performance virtualized FlatList for large track lists (1000+ songs open & scroll smoothly) */}
          {isPureTrackList && (
            <FlatList
              data={activeTracks}
              keyExtractor={(item, idx) => `${item.origin.kind === 'online' ? item.origin.id : idx}-${idx}`}
              getItemLayout={(_, index) => ({ length: 64, offset: 64 * index, index })}
              initialNumToRender={14}
              maxToRenderPerBatch={14}
              updateCellsBatchingPeriod={40}
              windowSize={5}
              removeClippedSubviews
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 32, 48) }}
              renderItem={({ item, index }) => {
                const rec = !openedPlaylist && feature === 'wy_play_record' ? playRecordRows[index] : undefined;
                const badge = rec?.playCount ? `${rec.playCount}次` : rec?.score ? `${rec.score}分` : undefined;
                return renderTrackItem(item, index, activeTracks, badge);
              }}
            />
          )}

          {/* Non-pure-track mixed / catalog scrollable area */}
          {!loading && !playlistLoading && !needsLogin && !isPureTrackList && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 32, 48), gap: 8 }}>
              {/* Account Playlists list (live tap to drill in & play, with default caching) */}
              {!openedPlaylist && accountPlaylists.length > 0 && accountPlaylists.map(pl => (
                <Pressable
                  key={pl.id}
                  accessibilityRole="button"
                  onPress={() => void openAccountPlaylist(pl)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: softSurface }}
                >
                  <Cover services={services} url={pl.coverUrl || undefined} size={56} radius={12} fallbackText={pl.title} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text numberOfLines={1} style={{ color: s.ink, fontSize: 15, fontWeight: '700' }}>{pl.title}</Text>
                    <Text style={{ color: s.muted, fontSize: 12 }}>{pl.count} 首 · 点击查看与播放</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={s.subtle} />
                </Pressable>
              ))}

              {/* Browse Playlists (Recommended / Recent / Home Feed) */}
              {!openedPlaylist && browsePlaylists.length > 0 && (
                <View style={{ gap: 8 }}>
                  {feature === 'tx_home_feed' && (
                    <Text style={{ color: s.ink, fontSize: 16, fontWeight: '700', marginTop: 4 }}>推荐歌单</Text>
                  )}
                  {browsePlaylists.map(pl => (
                    <Pressable
                      key={pl.id}
                      accessibilityRole="button"
                      onPress={() => {
                        onClose();
                        onOpenPlaylist(meta.platform, pl);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: softSurface }}
                    >
                      <Cover services={services} url={pl.artwork} size={56} radius={12} fallbackText={pl.title} />
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text numberOfLines={1} style={{ color: s.ink, fontSize: 15, fontWeight: '700' }}>{pl.title}</Text>
                        <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12 }}>
                          {[pl.author, pl.count !== undefined ? `${pl.count} 首` : ''].filter(Boolean).join(' · ') || '点击打开歌单'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={17} color={s.subtle} />
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Mixed Home Feed Tracks */}
              {!openedPlaylist && tracks.length > 0 && (
                <View style={{ gap: 2 }}>
                  {feature === 'tx_home_feed' && (
                    <Text style={{ color: s.ink, fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 4 }}>雷达与新歌推荐</Text>
                  )}
                  {tracks.map((t, i) => renderTrackItem(t, i, tracks))}
                </View>
              )}

              {/* Subscribed Artists */}
              {!openedPlaylist && artists.length > 0 && artists.map(ar => (
                <Pressable
                  key={ar.id}
                  accessibilityRole="button"
                  onPress={() => {
                    onClose();
                    onOpenArtist('wy', ar);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: softSurface }}
                >
                  <Cover services={services} url={ar.artwork} size={52} radius={26} fallbackText={ar.title} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={{ color: s.ink, fontSize: 15.5, fontWeight: '700' }}>{ar.title}</Text>
                    <Text style={{ color: s.muted, fontSize: 12 }}>
                      {[ar.albumCount !== undefined ? `${ar.albumCount} 张专辑` : '', ar.songCount !== undefined ? `${ar.songCount} 首歌曲` : ''].filter(Boolean).join(' · ') || '查看歌手歌曲与专辑'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={s.subtle} />
                </Pressable>
              ))}

              {/* Subscribed Albums */}
              {!openedPlaylist && albums.length > 0 && albums.map(al => (
                <Pressable
                  key={al.id}
                  accessibilityRole="button"
                  onPress={() => {
                    onClose();
                    onOpenAlbum('wy', { id: al.id, title: al.title, artwork: al.artwork, author: al.author, count: al.count });
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: softSurface }}
                >
                  <Cover services={services} url={al.artwork} size={54} radius={12} fallbackText={al.title} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={{ color: s.ink, fontSize: 15, fontWeight: '700' }}>{al.title}</Text>
                    <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12 }}>
                      {[al.author, al.count !== undefined ? `${al.count} 首` : ''].filter(Boolean).join(' · ') || '网易云收藏专辑'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={s.subtle} />
                </Pressable>
              ))}

              {/* Subscribed MVs */}
              {!openedPlaylist && mvs.length > 0 && mvs.map(mv => (
                <Pressable
                  key={`${mv.contentKind}:${mv.id}`}
                  accessibilityRole="button"
                  disabled={!mv.canOpen}
                  onPress={() => {
                    if (!mv.canOpen) return;
                    onClose();
                    onOpenMV({ id: mv.id, title: mv.title, platform: 'wy', author: mv.author, artwork: mv.artwork, durationSeconds: mv.durationSeconds });
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: softSurface, opacity: mv.canOpen ? 1 : 0.55 }}
                >
                  <Cover services={services} url={mv.artwork} size={82} aspectRatio={16 / 9} radius={10} fallbackText={mv.title} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text numberOfLines={2} style={{ color: s.ink, fontSize: 14.5, fontWeight: '700' }}>{mv.title}</Text>
                    <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12 }}>
                      {mv.author ?? '网易云 MV'}{mv.canOpen ? '' : ' · 平台视频暂不支持播放'}
                    </Text>
                  </View>
                  {mv.canOpen && <Ionicons name="play-circle-outline" size={22} color={s.accent} />}
                </Pressable>
              ))}

              {!error && !playlistError &&
                !activeTracks.length && !accountPlaylists.length && !browsePlaylists.length &&
                !artists.length && !albums.length && !mvs.length && (
                  <Text style={{ color: s.muted, fontSize: 13.5, textAlign: 'center', paddingTop: 32 }}>暂无可展示内容</Text>
                )}
            </ScrollView>
          )}
        </View>
        <Toast message={toast.message} onDismiss={toast.clear} />
        <TrackActions services={services} track={menuTrack} prefix="account-feature" onClose={() => setMenuTrack(null)} />
      </View>
    </Modal>
  );
}
