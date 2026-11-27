// Bodian Music (波点音乐) Discovery UI: 精选 | 榜单 | 歌单 + real Bodian account capability bar
// (潮趣日推 / 私人FM / 我喜欢 / 个人歌单 / 最近播放 / 收藏专辑 / 关注歌手), aligned with Coda's real Bodian features.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import { trackKey, type Track } from '../domain/track.ts';
import {
  BODIAN_PLAYLIST_CATEGORIES,
  type BodianAlbumSummary,
  type BodianArtistSummary,
  type BodianChartSummary,
  type BodianHomeModule,
  type BodianPlaylistSummary,
} from '../providers/bodian.ts';
import { Modal } from './AdaptiveModal.tsx';
import { Cover } from './Cover.tsx';
import { QualityBadge } from './QualityBadge.tsx';
import { TrackActions } from './TrackActions.tsx';
import { Text, TextInput } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { sollinTokens } from './tokens.ts';

type BodianSubTab = 'featured' | 'rankings' | 'playlists';
type BodianDrillSheet =
  | null
  | { kind: 'daily' }
  | { kind: 'fm' }
  | { kind: 'liked' }
  | { kind: 'myPlaylists' }
  | { kind: 'recent' }
  | { kind: 'albums' }
  | { kind: 'artists' }
  | { kind: 'playlist'; playlist: BodianPlaylistSummary }
  | { kind: 'chart'; chart: BodianChartSummary }
  | { kind: 'albumDetail'; album: BodianAlbumSummary }
  | { kind: 'artistDetail'; artist: BodianArtistSummary };

export function BodianDiscoverSection({
  services,
  openAccounts,
}: {
  services: Services;
  openAccounts?: () => void;
}) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);
  const insets = useSafeAreaInsets();
  const softSurface = s.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.52)';
  const segmentTrack = s.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.34)';
  const segmentActive = s.dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.86)';

  const bodianAccount = useSyncExternalStore(
    services.bodianAccount.subscribe,
    services.bodianAccount.getSnapshot,
  );

  const [subTab, setSubTab] = useState<BodianSubTab>('featured');
  const [modules, setModules] = useState<readonly BodianHomeModule[]>([]);
  const [recPlaylists, setRecPlaylists] = useState<readonly BodianPlaylistSummary[]>([]);
  const [charts, setCharts] = useState<readonly BodianChartSummary[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number>(0);
  const [catPlaylists, setCatPlaylists] = useState<readonly BodianPlaylistSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [searchTracks, setSearchTracks] = useState<readonly Track[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchHint, setSearchHint] = useState('');

  const [sheet, setSheet] = useState<BodianDrillSheet>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const [sheetTracks, setSheetTracks] = useState<readonly Track[]>([]);
  const [sheetPlaylists, setSheetPlaylists] = useState<readonly BodianPlaylistSummary[]>([]);
  const [sheetAlbums, setSheetAlbums] = useState<readonly BodianAlbumSummary[]>([]);
  const [sheetArtists, setSheetArtists] = useState<readonly BodianArtistSummary[]>([]);
  const [startingPlay, setStartingPlay] = useState<'play' | 'shuffle' | null>(null);
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const sheetAbortRef = useRef<AbortController | null>(null);

  async function loadTab(tab: BodianSubTab, catId = selectedCategory) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError('');
    try {
      const session = await services.bodianAccount.session();
      if (ctrl.signal.aborted) return;
      if (tab === 'featured') {
        const [mods, recs] = await Promise.all([
          services.bodian.homeModules(ctrl.signal, session).catch(() => [] as readonly BodianHomeModule[]),
          services.bodian.recommendedPlaylists(ctrl.signal, session).catch(() => [] as readonly BodianPlaylistSummary[]),
        ]);
        if (!ctrl.signal.aborted) {
          setModules(mods);
          setRecPlaylists(recs);
          if (!mods.length && !recs.length) setError('波点精选内容暂时无法获取，请点击重试');
        }
      } else if (tab === 'rankings') {
        const list = await services.bodian.charts(ctrl.signal, session);
        if (!ctrl.signal.aborted) setCharts(list);
      } else {
        if (catId === 0) {
          const recs = await services.bodian.recommendedPlaylists(ctrl.signal, session);
          if (!ctrl.signal.aborted) setCatPlaylists(recs);
        } else {
          const res = await services.bodian.categoryPlaylists(catId, 1, ctrl.signal, session);
          if (!ctrl.signal.aborted) setCatPlaylists(res.items);
        }
      }
    } catch {
      if (!ctrl.signal.aborted) setError('波点音乐数据获取失败，请稍后重试');
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void loadTab(subTab, selectedCategory);
    return () => {
      abortRef.current?.abort();
    };
  }, [subTab, selectedCategory, bodianAccount.loggedIn, bodianAccount.userId]);

  async function runSearch() {
    const q = query.trim();
    if (!q || searchBusy) return;
    setSearchBusy(true);
    setSearchHint('');
    const ctrl = new AbortController();
    try {
      const session = await services.bodianAccount.session();
      const res = await services.bodian.searchSongs(q, 1, ctrl.signal, session);
      setSearchTracks(res.items);
      setSearchHint(res.items.length ? `找到 ${res.items.length} 首波点歌曲` : '未找到匹配的波点歌曲');
    } catch {
      setSearchHint('波点搜歌失败，请稍后重试');
    } finally {
      setSearchBusy(false);
    }
  }

  async function openSheet(target: NonNullable<BodianDrillSheet>) {
    sheetAbortRef.current?.abort();
    const ctrl = new AbortController();
    sheetAbortRef.current = ctrl;
    setSheet(target);
    setSheetTracks([]);
    setSheetPlaylists([]);
    setSheetAlbums([]);
    setSheetArtists([]);
    setSheetError('');
    setSheetLoading(true);
    try {
      const session = await services.bodianAccount.session();
      if (ctrl.signal.aborted) return;
      const needsAuth = ['liked', 'myPlaylists', 'recent', 'albums', 'artists'].includes(target.kind);
      if (needsAuth && !session) {
        setSheetError('请先扫码登录波点音乐账号后再查看个人曲库');
        return;
      }
      if (target.kind === 'daily') {
        const res = await services.bodian.dailyPicks(ctrl.signal, session, 0);
        if (!ctrl.signal.aborted) setSheetTracks(res.tracks);
      } else if (target.kind === 'fm') {
        const tracks = await services.bodian.personalFM(ctrl.signal, session);
        if (!ctrl.signal.aborted) setSheetTracks(tracks);
      } else if (target.kind === 'liked') {
        const cacheKey = `bodian:${session!.userId}:liked`;
        const cached = services.accountFeatureCache.getTracks(cacheKey);
        if (cached?.tracks.length && !ctrl.signal.aborted) {
          setSheetTracks(cached.tracks);
          setSheetLoading(false);
        }
        const res = await services.bodian.favorites(session!, ctrl.signal);
        if (!ctrl.signal.aborted) {
          setSheetTracks(res.tracks);
          if (res.tracks.length) void services.accountFeatureCache.setTracks(cacheKey, res.tracks);
        }
      } else if (target.kind === 'myPlaylists') {
        const res = await services.bodian.userCollections(session!, ctrl.signal);
        if (!ctrl.signal.aborted) setSheetPlaylists([...res.created, ...res.collectedPlaylists]);
      } else if (target.kind === 'albums') {
        const res = await services.bodian.userCollections(session!, ctrl.signal);
        if (!ctrl.signal.aborted) setSheetAlbums(res.collectedAlbums);
      } else if (target.kind === 'artists') {
        const list = await services.bodian.followedArtists(session!, ctrl.signal);
        if (!ctrl.signal.aborted) setSheetArtists(list);
      } else if (target.kind === 'recent') {
        const list = await services.bodian.recentPlays(session!, ctrl.signal);
        if (!ctrl.signal.aborted) setSheetTracks(list);
      } else if (target.kind === 'playlist') {
        const res = await services.bodian.playlistDetail(target.playlist.id, target.playlist.source, 1, ctrl.signal, session);
        if (!ctrl.signal.aborted) setSheetTracks(res.items);
      } else if (target.kind === 'chart') {
        const res = await services.bodian.chartSongs(target.chart.id, 1, ctrl.signal, session);
        if (!ctrl.signal.aborted) setSheetTracks(res.items);
      } else if (target.kind === 'albumDetail') {
        const list = await services.bodian.albumSongs(target.album.id, ctrl.signal, session);
        if (!ctrl.signal.aborted) setSheetTracks(list);
      } else if (target.kind === 'artistDetail') {
        const list = await services.bodian.artistSongs(target.artist.id, ctrl.signal, session);
        if (!ctrl.signal.aborted) setSheetTracks(list);
      }
    } catch (err) {
      if (!ctrl.signal.aborted) setSheetError(err instanceof Error ? err.message : '读取波点内容失败，请重试');
    } finally {
      if (!ctrl.signal.aborted) setSheetLoading(false);
    }
  }

  function triggerPlayAll(tracks: readonly Track[], shuffle: boolean) {
    if (!tracks.length || startingPlay) return;
    setStartingPlay(shuffle ? 'shuffle' : 'play');
    setTimeout(() => {
      if (shuffle) {
        void services.preferences
          .update({ repeat: 'off', shuffle: true })
          .then(() => services.playTracks(tracks, Math.floor(Math.random() * tracks.length)))
          .catch(() => services.playTracks(tracks, 0))
          .finally(() => setTimeout(() => setStartingPlay(null), 700));
      } else {
        services.playTracks(tracks, 0);
        setTimeout(() => setStartingPlay(null), 700);
      }
    }, 16);
  }

  const shortcuts: { id: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; target: NonNullable<BodianDrillSheet> }[] =
    bodianAccount.loggedIn
      ? [
          { id: 'daily', label: '潮趣日推', icon: 'calendar-outline', target: { kind: 'daily' } },
          { id: 'fm', label: '私人FM', icon: 'radio-outline', target: { kind: 'fm' } },
          { id: 'liked', label: '我喜欢', icon: 'heart', target: { kind: 'liked' } },
          { id: 'playlists', label: '个人歌单', icon: 'albums-outline', target: { kind: 'myPlaylists' } },
          { id: 'recent', label: '最近播放', icon: 'time-outline', target: { kind: 'recent' } },
          { id: 'albums', label: '收藏专辑', icon: 'disc-outline', target: { kind: 'albums' } },
          { id: 'artists', label: '关注歌手', icon: 'people-outline', target: { kind: 'artists' } },
        ]
      : [
          { id: 'daily', label: '潮趣日推', icon: 'calendar-outline', target: { kind: 'daily' } },
          { id: 'fm', label: '私人FM', icon: 'radio-outline', target: { kind: 'fm' } },
        ];

  const renderTrackRow = (track: Track, idx: number, pool: readonly Track[]) => (
    <View key={`${trackKey(track.origin)}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
      <Pressable
        accessibilityRole="button"
        onPress={() => services.playTracks(pool, idx)}
        style={{ flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 11 }}
      >
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
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`更多操作：${track.title}`}
        onPress={() => setMenuTrack(track)}
        style={{ width: 34, height: 38, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="ellipsis-horizontal" size={18} color={s.muted} />
      </Pressable>
    </View>
  );

  const sheetTitle = !sheet
    ? ''
    : sheet.kind === 'daily'
      ? '波点 · 潮趣日推'
      : sheet.kind === 'fm'
        ? '波点 · 私人 FM'
        : sheet.kind === 'liked'
          ? '波点 · 我喜欢'
          : sheet.kind === 'myPlaylists'
            ? '波点 · 个人歌单'
            : sheet.kind === 'recent'
              ? '波点 · 最近播放'
              : sheet.kind === 'albums'
                ? '波点 · 收藏专辑'
                : sheet.kind === 'artists'
                  ? '波点 · 关注歌手'
                  : sheet.kind === 'playlist'
                    ? sheet.playlist.title
                    : sheet.kind === 'chart'
                      ? sheet.chart.title
                      : sheet.kind === 'albumDetail'
                        ? sheet.album.title
                        : sheet.artist.name;

  return (
    <View testID="bodian-discover-section" style={{ gap: 14, paddingBottom: 20 }}>
      {/* 3-segment switcher: 精选 | 榜单 | 歌单 */}
      <View style={{ flexDirection: 'row', padding: 3, borderRadius: 24, backgroundColor: segmentTrack }}>
        {([
          ['featured', '精选'],
          ['rankings', '榜单'],
          ['playlists', '歌单'],
        ] as const).map(([id, label]) => {
          const selected = subTab === id;
          return (
            <Pressable
              key={id}
              testID={`bodian-tab-${id}`}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setSubTab(id)}
              style={[
                { flex: 1, minHeight: 38, borderRadius: 21, backgroundColor: selected ? segmentActive : 'transparent', alignItems: 'center', justifyContent: 'center' },
                selected && s.cardShadow,
              ]}
            >
              <Text style={{ color: selected ? s.ink : s.muted, fontWeight: selected ? '700' : '500', fontSize: 14 }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Bodian capability quick action bar */}
      <View style={{ gap: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 4, paddingHorizontal: 2 }}>
          {shortcuts.map(item => (
            <Pressable
              key={item.id}
              testID={`discovery-bodian-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`波点${item.label}`}
              onPress={() => void openSheet(item.target)}
              style={{ width: 62, alignItems: 'center', gap: 6 }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: s.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={item.icon} size={21} color={s.accent} />
              </View>
              <Text numberOfLines={1} style={{ color: s.ink, fontSize: 11.5, fontWeight: '500' }}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {!bodianAccount.loggedIn && openAccounts && (
          <Pressable
            testID="discovery-login-prompt-bodian"
            accessibilityRole="button"
            onPress={openAccounts}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: softSurface }}
          >
            <Ionicons name="person-circle-outline" size={20} color={s.accent} />
            <Text numberOfLines={1} style={{ flex: 1, color: s.ink, fontSize: 12.5, fontWeight: '600' }}>
              扫码登录波点音乐解锁我喜欢、个人歌单、最近播放与账号会员直连播放
            </Text>
            <Ionicons name="chevron-forward" size={15} color={s.subtle} />
          </Pressable>
        )}
      </View>

      {subTab === 'featured' && (
        <>
          {/* Inline Bodian song search */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              accessibilityLabel="波点音乐搜歌"
              placeholder="搜波点曲库歌曲、歌手或专辑…"
              placeholderTextColor={s.subtle}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void runSearch()}
              style={{ flex: 1, color: s.ink, backgroundColor: s.inputBg, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, fontSize: 14 }}
            />
            <Pressable
              accessibilityRole="button"
              disabled={searchBusy || !query.trim()}
              onPress={() => void runSearch()}
              style={{ paddingHorizontal: 16, borderRadius: 14, backgroundColor: s.control, justifyContent: 'center', opacity: searchBusy || !query.trim() ? 0.45 : 1 }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '600' }}>搜索</Text>
            </Pressable>
          </View>
          {searchBusy && <ActivityIndicator color={s.accent} />}
          {!searchBusy && !!searchHint && <Text style={{ color: s.muted, fontSize: 12 }}>{searchHint}</Text>}
          {searchTracks.length > 0 && (
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: s.ink, fontSize: 16, fontWeight: '700' }}>波点搜索结果 ({searchTracks.length})</Text>
                <Pressable accessibilityRole="button" onPress={() => setSearchTracks([])}>
                  <Text style={{ color: s.muted, fontSize: 12.5 }}>收起</Text>
                </Pressable>
              </View>
              {searchTracks.slice(0, 10).map((t, idx) => renderTrackRow(t, idx, searchTracks))}
            </View>
          )}

          {loading && !modules.length && !recPlaylists.length && (
            <View style={{ paddingVertical: 28, alignItems: 'center' }}><ActivityIndicator color={s.accent} /></View>
          )}
          {!!error && !loading && (
            <View style={{ padding: 14, borderRadius: 16, backgroundColor: softSurface, gap: 8 }}>
              <Text style={{ color: s.accent, fontSize: 13 }}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => void loadTab('featured')} style={{ alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 14, backgroundColor: s.control }}>
                <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '600' }}>重试</Text>
              </Pressable>
            </View>
          )}

          {modules.map(mod => (
            <View key={mod.id} style={{ gap: 8 }}>
              <Text style={{ color: s.ink, fontSize: 18, fontWeight: '700' }}>{mod.title}</Text>
              {mod.kind === 'songs' && mod.songs && (
                <View style={{ gap: 2 }}>
                  {mod.songs.slice(0, 8).map((t, idx) => renderTrackRow(t, idx, mod.songs!))}
                </View>
              )}
              {mod.kind !== 'songs' && mod.playlists && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 2 }}>
                  {mod.playlists.map(pl => (
                    <Pressable
                      key={pl.id}
                      accessibilityRole="button"
                      onPress={() => void openSheet({ kind: 'playlist', playlist: pl })}
                      style={{ width: 136, gap: 6 }}
                    >
                      <View style={s.cardShadow}><Cover services={services} url={pl.artwork} size={136} radius={14} fallbackText={pl.title} /></View>
                      <Text numberOfLines={2} style={{ color: s.ink, fontSize: 13.5, fontWeight: '600', lineHeight: 18 }}>{pl.title}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          ))}

          {recPlaylists.length > 0 && (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: s.ink, fontSize: 18, fontWeight: '700' }}>推荐歌单</Text>
                <Pressable accessibilityRole="button" onPress={() => setSubTab('playlists')}>
                  <Text style={{ color: s.accent, fontSize: 12.5, fontWeight: '600' }}>更多</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {recPlaylists.slice(0, 8).map(pl => (
                  <Pressable
                    key={pl.id}
                    accessibilityRole="button"
                    onPress={() => void openSheet({ kind: 'playlist', playlist: pl })}
                    style={{ width: '47%', flexGrow: 1, gap: 6 }}
                  >
                    <View style={s.cardShadow}><Cover services={services} url={pl.artwork} size={156} radius={14} fallbackText={pl.title} /></View>
                    <Text numberOfLines={2} style={{ color: s.ink, fontSize: 13.5, fontWeight: '600', lineHeight: 18 }}>{pl.title}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </>
      )}

      {subTab === 'rankings' && (
        <View style={{ gap: 10 }}>
          {loading && !charts.length && <View style={{ paddingVertical: 28, alignItems: 'center' }}><ActivityIndicator color={s.accent} /></View>}
          {charts.map(chart => (
            <Pressable
              key={chart.id}
              accessibilityRole="button"
              onPress={() => void openSheet({ kind: 'chart', chart })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 11, borderRadius: 16, backgroundColor: softSurface }}
            >
              <Cover services={services} url={chart.artwork} size={62} radius={12} fallbackText={chart.title} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text numberOfLines={1} style={{ color: s.ink, fontSize: 15.5, fontWeight: '700' }}>{chart.title}</Text>
                {chart.previewTracks.length > 0 ? (
                  chart.previewTracks.map((t, i) => (
                    <Text key={t.origin.id} numberOfLines={1} style={{ color: s.muted, fontSize: 12 }}>
                      {i + 1}. {t.title} - {t.artist}
                    </Text>
                  ))
                ) : (
                  <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12 }}>{chart.description || '波波官方排行榜'}</Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={17} color={s.subtle} />
            </Pressable>
          ))}
        </View>
      )}

      {subTab === 'playlists' && (
        <View style={{ gap: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
            {[{ id: 0, name: '推荐' }, ...BODIAN_PLAYLIST_CATEGORIES].map(cat => {
              const selected = selectedCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedCategory(cat.id)}
                  style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: selected ? s.control : softSurface }}
                >
                  <Text style={{ color: selected ? '#FFFFFF' : s.ink, fontSize: 13, fontWeight: selected ? '700' : '500' }}>{cat.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {loading && !catPlaylists.length && <View style={{ paddingVertical: 28, alignItems: 'center' }}><ActivityIndicator color={s.accent} /></View>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {catPlaylists.map(pl => (
              <Pressable
                key={pl.id}
                accessibilityRole="button"
                onPress={() => void openSheet({ kind: 'playlist', playlist: pl })}
                style={{ width: '47%', flexGrow: 1, gap: 6 }}
              >
                <View style={s.cardShadow}><Cover services={services} url={pl.artwork} size={156} radius={14} fallbackText={pl.title} /></View>
                <Text numberOfLines={2} style={{ color: s.ink, fontSize: 13.5, fontWeight: '600', lineHeight: 18 }}>{pl.title}</Text>
                {pl.trackCount !== undefined && <Text style={{ color: s.muted, fontSize: 11.5 }}>{pl.trackCount} 首</Text>}
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Bodian drill-down detail modal */}
      <Modal visible={sheet !== null} animationType="slide" onRequestClose={() => setSheet(null)}>
        <View style={{ flex: 1 }}>
          <LinearGradient colors={[...s.sheetGradient]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={{ flex: 1, paddingTop: Math.max(insets.top + 8, 52), paddingHorizontal: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="返回波点发现"
                onPress={() => setSheet(null)}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: softSurface, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="chevron-back" size={22} color={s.ink} />
              </Pressable>
              <Text numberOfLines={1} style={{ flex: 1, color: s.ink, fontSize: 19, fontWeight: '700' }}>{sheetTitle}</Text>
              {sheet && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="刷新"
                  onPress={() => void openSheet(sheet)}
                  style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: softSurface, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="refresh" size={18} color={s.ink} />
                </Pressable>
              )}
            </View>

            {sheetTracks.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 10 }}>
                <Pressable
                  accessibilityRole="button"
                  disabled={startingPlay !== null}
                  onPress={() => triggerPlayAll(sheetTracks, false)}
                  style={{ flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: s.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: startingPlay === 'shuffle' ? 0.65 : 1 }}
                >
                  {startingPlay === 'play' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="play" size={15} color="#FFFFFF" />}
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
                    {startingPlay === 'play' ? '正在缓冲播放…' : `播放全部 (${sheetTracks.length})`}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={startingPlay !== null}
                  onPress={() => triggerPlayAll(sheetTracks, true)}
                  style={{ flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: softSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: startingPlay === 'play' ? 0.65 : 1 }}
                >
                  {startingPlay === 'shuffle' ? <ActivityIndicator size="small" color={s.ink} /> : <Ionicons name="shuffle" size={16} color={s.ink} />}
                  <Text style={{ color: s.ink, fontSize: 14, fontWeight: '600' }}>
                    {startingPlay === 'shuffle' ? '正在随机起播…' : '随机播放'}
                  </Text>
                </Pressable>
              </View>
            )}

            {sheetLoading && (
              <View style={{ paddingVertical: 36, alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color={s.accent} />
                <Text style={{ color: s.muted, fontSize: 13 }}>正在读取波点曲库…</Text>
              </View>
            )}

            {!sheetLoading && !!sheetError && (
              <View style={{ padding: 18, borderRadius: 18, backgroundColor: softSurface, gap: 10 }}>
                <Text style={{ color: s.accent, fontSize: 13.5 }}>{sheetError}</Text>
                {openAccounts && sheetError.includes('登录') && (
                  <Pressable accessibilityRole="button" onPress={() => { setSheet(null); openAccounts(); }} style={{ alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: s.control }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>前往登录波点账号</Text>
                  </Pressable>
                )}
              </View>
            )}

            {!sheetLoading && !sheetError && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom + 32, 48), gap: 8 }}>
                {sheetTracks.map((t, i) => renderTrackRow(t, i, sheetTracks))}
                {sheetPlaylists.map(pl => (
                  <Pressable
                    key={pl.id}
                    accessibilityRole="button"
                    onPress={() => void openSheet({ kind: 'playlist', playlist: pl })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: softSurface }}
                  >
                    <Cover services={services} url={pl.artwork} size={54} radius={12} fallbackText={pl.title} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text numberOfLines={1} style={{ color: s.ink, fontSize: 15, fontWeight: '700' }}>{pl.title}</Text>
                      <Text style={{ color: s.muted, fontSize: 12 }}>{pl.trackCount !== undefined ? `${pl.trackCount} 首` : '波点歌单'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={17} color={s.subtle} />
                  </Pressable>
                ))}
                {sheetAlbums.map(al => (
                  <Pressable
                    key={al.id}
                    accessibilityRole="button"
                    onPress={() => void openSheet({ kind: 'albumDetail', album: al })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: softSurface }}
                  >
                    <Cover services={services} url={al.artwork} size={54} radius={12} fallbackText={al.title} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text numberOfLines={1} style={{ color: s.ink, fontSize: 15, fontWeight: '700' }}>{al.title}</Text>
                      <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12 }}>{[al.artist, al.releaseDate].filter(Boolean).join(' · ') || '收藏专辑'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={17} color={s.subtle} />
                  </Pressable>
                ))}
                {sheetArtists.map(ar => (
                  <Pressable
                    key={ar.id}
                    accessibilityRole="button"
                    onPress={() => void openSheet({ kind: 'artistDetail', artist: ar })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: softSurface }}
                  >
                    <Cover services={services} url={ar.artwork} size={50} radius={25} fallbackText={ar.name} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text numberOfLines={1} style={{ color: s.ink, fontSize: 15, fontWeight: '700' }}>{ar.name}</Text>
                      <Text style={{ color: s.muted, fontSize: 12 }}>{ar.songCount !== undefined ? `${ar.songCount} 首歌曲` : '关注歌手'}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={17} color={s.subtle} />
                  </Pressable>
                ))}
                {!sheetTracks.length && !sheetPlaylists.length && !sheetAlbums.length && !sheetArtists.length && (
                  <Text style={{ color: s.muted, fontSize: 13.5, textAlign: 'center', paddingTop: 28 }}>暂无可展示内容</Text>
                )}
              </ScrollView>
            )}
          </View>
          <TrackActions services={services} track={menuTrack} prefix="bodian" onClose={() => setMenuTrack(null)} />
        </View>
      </Modal>
    </View>
  );
}
