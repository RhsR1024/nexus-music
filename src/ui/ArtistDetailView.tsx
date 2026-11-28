// Artist Detail view rendered inside the Player sheet (matching NexusMusic's Sollin visual tokens).
// Supports multi-artist selection, hot songs with live playback indicator, albums with inline album
// tracklist drill-down, and similar artists with stack navigation.

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Services } from '../app/services.ts';
import type { OnlinePlatform, Track } from '../domain/track.ts';
import type { TrackArtistRef } from '../domain/artistNames.ts';
import type { ArtistItem } from '../providers/artists.ts';
import type { BrowseItem } from '../providers/discovery.ts';
import { Cover } from './Cover.tsx';
import { QualityBadge } from './QualityBadge.tsx';
import { TrackActions } from './TrackActions.tsx';
import { TrackPlaybackIndicator, useTrackPlaybackState } from './TrackPlaybackIndicator.tsx';
import { Text } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { sollinTokens } from './tokens.ts';

const PLATFORM_LABELS: Readonly<Record<OnlinePlatform, string>> = {
  wy: '网易云',
  tx: 'QQ 音乐',
  kg: '酷狗',
  kw: '酷我',
  mg: '咪咕',
};

interface ResolvedArtistTarget {
  readonly ref: TrackArtistRef;
  readonly resolvedPlatform?: OnlinePlatform;
  readonly resolvedArtist?: ArtistItem;
}

export function ArtistDetailView({
  services,
  initialArtist,
  pickerArtists,
  onClose,
  onPlayTracks,
}: {
  services: Services;
  initialArtist?: TrackArtistRef;
  pickerArtists?: readonly TrackArtistRef[];
  onClose: () => void;
  onPlayTracks?: (tracks: readonly Track[], index: number) => void;
}) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);
  const trackPlayback = useTrackPlaybackState(services);

  const [stack, setStack] = useState<readonly ResolvedArtistTarget[]>(() =>
    initialArtist ? [{ ref: initialArtist }] : [],
  );
  const [pickingArtists, setPickingArtists] = useState<boolean>(
    () => !initialArtist && !!pickerArtists && pickerArtists.length > 1,
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [platform, setPlatform] = useState<OnlinePlatform>('wy');
  const [artist, setArtist] = useState<ArtistItem | null>(null);
  const [hotSongs, setHotSongs] = useState<readonly Track[]>([]);
  const [showAllSongs, setShowAllSongs] = useState(false);
  const [albums, setAlbums] = useState<readonly BrowseItem[]>([]);
  const [similar, setSimilar] = useState<{ platform: OnlinePlatform; items: readonly ArtistItem[] }>({
    platform: 'tx',
    items: [],
  });
  const [bioExpanded, setBioExpanded] = useState(false);

  const [openedAlbum, setOpenedAlbum] = useState<BrowseItem | null>(null);
  const [albumTracks, setAlbumTracks] = useState<readonly Track[]>([]);
  const [albumMeta, setAlbumMeta] = useState<Partial<BrowseItem>>({});
  const [albumLoading, setAlbumLoading] = useState(false);
  const [albumError, setAlbumError] = useState('');

  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const albumAbortRef = useRef<AbortController | null>(null);

  const currentTarget = stack[stack.length - 1];

  useEffect(() => {
    if (initialArtist) {
      setStack([{ ref: initialArtist }]);
      setPickingArtists(false);
    } else if (pickerArtists?.length === 1) {
      setStack([{ ref: pickerArtists[0]! }]);
      setPickingArtists(false);
    } else if (pickerArtists && pickerArtists.length > 1) {
      setStack([]);
      setPickingArtists(true);
    }
  }, [initialArtist?.name, initialArtist?.id, initialArtist?.platform]);

  useEffect(() => {
    if (!currentTarget) return;
    abortRef.current?.abort();
    albumAbortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError('');
    setHotSongs([]);
    setAlbums([]);
    setSimilar({ platform: 'tx', items: [] });
    setShowAllSongs(false);
    setBioExpanded(false);
    setOpenedAlbum(null);
    setAlbumTracks([]);
    setAlbumError('');

    void (async () => {
      try {
        const resolved =
          currentTarget.resolvedPlatform && currentTarget.resolvedArtist
            ? { platform: currentTarget.resolvedPlatform, artist: currentTarget.resolvedArtist }
            : await services.artists.resolveByName(
                currentTarget.ref.name,
                currentTarget.ref.platform,
                currentTarget.ref.id,
                ctrl.signal,
              );
        if (ctrl.signal.aborted) return;

        setPlatform(resolved.platform);
        setArtist(resolved.artist);

        // Fetch NetEase session if logged in so NetEase similar artists can use native API
        let neteaseSession: Readonly<Record<string, unknown>> | undefined;
        const wyAcct = services.musicAccounts.getSnapshot().find(a => a.platform === 'wy');
        if (wyAcct) {
          try {
            neteaseSession = await services.musicAccounts.session(wyAcct.id);
          } catch {}
        }
        if (ctrl.signal.aborted) return;

        const [songsRes, albumsRes, simRes] = await Promise.allSettled([
          services.artists.songs(resolved.platform, resolved.artist, 1, ctrl.signal, 50),
          services.artists.albums(resolved.platform, resolved.artist, 1, ctrl.signal, 24),
          services.artists.similar(resolved.platform, resolved.artist, ctrl.signal, { neteaseSession }),
        ]);
        if (ctrl.signal.aborted) return;

        let mergedArtist: ArtistItem = resolved.artist;
        if (songsRes.status === 'fulfilled') {
          if (songsRes.value.info) {
            mergedArtist = { ...mergedArtist, ...songsRes.value.info };
          }
          setHotSongs(songsRes.value.items);
        }
        if (albumsRes.status === 'fulfilled') {
          setAlbums(albumsRes.value.items);
          if (albumsRes.value.total !== undefined && mergedArtist.albumCount === undefined) {
            mergedArtist = { ...mergedArtist, albumCount: albumsRes.value.total };
          }
        }
        if (simRes.status === 'fulfilled') {
          setSimilar(simRes.value);
        }
        setArtist(mergedArtist);

        if (songsRes.status === 'rejected' && albumsRes.status === 'rejected') {
          setError(`暂时无法读取「${currentTarget.ref.name}」的歌手主页，请稍后重试`);
        }
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setError(e instanceof Error ? e.message : '暂时无法加载歌手信息，请稍后重试');
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();

    return () => {
      ctrl.abort();
      albumAbortRef.current?.abort();
    };
  }, [currentTarget?.ref.name, currentTarget?.ref.id, currentTarget?.ref.platform, currentTarget?.resolvedArtist?.id, services]);

  const openAlbum = (album: BrowseItem) => {
    albumAbortRef.current?.abort();
    const ctrl = new AbortController();
    albumAbortRef.current = ctrl;
    setOpenedAlbum(album);
    setAlbumTracks([]);
    setAlbumMeta({});
    setAlbumError('');
    setAlbumLoading(true);
    void services.albums
      .detail(platform, album, 1, ctrl.signal, 100)
      .then(page => {
        if (ctrl.signal.aborted) return;
        setAlbumTracks(page.items);
        if (page.info) setAlbumMeta(page.info);
      })
      .catch(e => {
        if (!ctrl.signal.aborted) {
          setAlbumError(e instanceof Error ? e.message : '暂时无法读取专辑曲目，请重试');
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setAlbumLoading(false);
      });
  };

  const playList = (pool: readonly Track[], index: number, shuffle = false) => {
    if (!pool.length) return;
    const startIdx = shuffle ? Math.floor(Math.random() * pool.length) : index;
    const targetTrack = pool[startIdx];
    if (targetTrack) trackPlayback.markPending(targetTrack);
    if (shuffle) {
      void services.preferences
        .update({ repeat: 'off', shuffle: true })
        .catch(() => {})
        .finally(() => {
          if (onPlayTracks) onPlayTracks(pool, startIdx);
          else services.playTracks(pool, startIdx);
        });
    } else if (onPlayTracks) {
      onPlayTracks(pool, startIdx);
    } else {
      services.playTracks(pool, startIdx);
    }
  };

  const handleBack = () => {
    if (openedAlbum) {
      albumAbortRef.current?.abort();
      setOpenedAlbum(null);
      setAlbumTracks([]);
      setAlbumError('');
      return;
    }
    if (stack.length > 1) {
      setStack(prev => prev.slice(0, -1));
      return;
    }
    if (pickerArtists && pickerArtists.length > 1 && !pickingArtists) {
      setPickingArtists(true);
      setStack([]);
      return;
    }
    onClose();
  };

  const softSurface = s.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.58)';
  const cardBg = s.card;

  // Multi-artist collaboration picker view
  if (pickingArtists && pickerArtists && pickerArtists.length > 1) {
    return (
      <View testID="artist-picker-view" style={{ flex: 1, paddingHorizontal: 18, paddingTop: 14, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="返回播放页"
            onPress={onClose}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: softSurface, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={20} color={s.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: s.ink }}>选择要查看的歌手</Text>
            <Text style={{ fontSize: 12, color: s.muted }}>本曲由多位歌手合作演唱，点击进入对应歌手主页</Text>
          </View>
        </View>
        <View style={[{ borderRadius: 20, backgroundColor: cardBg, borderWidth: 1, borderColor: s.cardBorder, overflow: 'hidden' }, s.cardShadow]}>
          {pickerArtists.map((ref, idx) => (
            <Pressable
              key={`${ref.name}-${idx}`}
              testID={`artist-picker-item-${idx}`}
              accessibilityRole="button"
              accessibilityLabel={`查看歌手：${ref.name}`}
              onPress={() => {
                setPickingArtists(false);
                setStack([{ ref }]);
              }}
              style={{
                minHeight: 58,
                paddingHorizontal: 16,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                borderTopColor: s.hairline,
              }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: s.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person" size={18} color={s.accent} />
              </View>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 15.5, fontWeight: '600', color: s.ink }}>
                {ref.name}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={s.subtle} />
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  // Inline Album Tracklist drill-down view
  if (openedAlbum) {
    return (
      <View testID="artist-album-detail-view" style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="返回歌手主页"
            onPress={handleBack}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: softSurface, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={20} color={s.ink} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 17.5, fontWeight: '700', color: s.ink }}>{openedAlbum.title}</Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: s.muted }}>
              {albumMeta.author ?? artist?.title ?? ''}{albumMeta.released ? ` · ${albumMeta.released}` : ''}
            </Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 42, gap: 14 }} showsVerticalScrollIndicator={false}>
          <View style={[{ flexDirection: 'row', gap: 14, padding: 14, borderRadius: 20, backgroundColor: cardBg, borderWidth: 1, borderColor: s.cardBorder }, s.cardShadow]}>
            <Cover services={services} url={openedAlbum.artwork} size={86} radius={14} fallbackText={openedAlbum.title} />
            <View style={{ flex: 1, justifyContent: 'center', gap: 6 }}>
              <Text numberOfLines={2} style={{ fontSize: 16.5, fontWeight: '700', color: s.ink }}>{openedAlbum.title}</Text>
              <Text numberOfLines={1} style={{ fontSize: 12.5, color: s.muted }}>
                {albumLoading ? '正在加载曲目…' : albumError ? '曲目暂不可读取' : `${albumTracks.length} 首曲目`}
              </Text>
              {albumTracks.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => playList(albumTracks, 0)}
                    style={{ paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: s.control, flexDirection: 'row', alignItems: 'center', gap: 5 }}
                  >
                    <Ionicons name="play" size={14} color="#FFFFFF" />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>播放专辑</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => playList(albumTracks, 0, true)}
                    style={{ paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: s.chip, borderWidth: 1, borderColor: s.chipBorder, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <Ionicons name="shuffle" size={14} color={s.ink} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: s.ink }}>随机</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>

          {albumLoading && (
            <View style={{ paddingVertical: 32, alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={s.accent} />
              <Text style={{ fontSize: 13, color: s.muted }}>正在加载专辑曲目…</Text>
            </View>
          )}
          {!!albumError && (
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 16 }}>
              <Text accessibilityRole="alert" style={{ fontSize: 13, color: s.accent, textAlign: 'center' }}>
                {albumError}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => openAlbum(openedAlbum)}
                style={{ paddingHorizontal: 16, height: 34, borderRadius: 17, backgroundColor: s.chip, borderWidth: 1, borderColor: s.chipBorder, justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: s.ink }}>重新加载</Text>
              </Pressable>
            </View>
          )}
          {!albumLoading && albumTracks.length > 0 && (
            <View style={[{ borderRadius: 20, backgroundColor: cardBg, borderWidth: 1, borderColor: s.cardBorder, overflow: 'hidden' }, s.cardShadow]}>
              {albumTracks.map((track, idx) => {
                const rowState = trackPlayback.stateFor(track);
                const isActive = rowState !== 'idle';
                return (
                  <View
                    key={`${track.origin.id}-${idx}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      minHeight: 58,
                      borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                      borderTopColor: s.hairline,
                      backgroundColor: isActive ? s.accentSoft : 'transparent',
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => playList(albumTracks, idx)}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
                    >
                      <Text style={{ width: 24, textAlign: 'center', fontSize: 12, fontWeight: '700', color: isActive ? s.accent : s.subtle, fontVariant: ['tabular-nums'] }}>
                        {String(idx + 1).padStart(2, '0')}
                      </Text>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: isActive ? '700' : '600', color: isActive ? s.accent : s.ink }}>
                          {track.title}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <QualityBadge track={track} />
                          <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: s.muted }}>{track.artist}</Text>
                        </View>
                      </View>
                      <TrackPlaybackIndicator state={rowState} color={s.accent} size={15} />
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => setMenuTrack(track)} style={{ width: 34, height: 38, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="ellipsis-horizontal" size={17} color={s.muted} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
        <TrackActions
          services={services}
          track={menuTrack}
          prefix="artist-album"
          onClose={() => setMenuTrack(null)}
          onSearchArtist={name => {
            setMenuTrack(null);
            setOpenedAlbum(null);
            setStack(prev => [...prev, { ref: { name } }]);
          }}
        />
      </View>
    );
  }

  const displayName = artist?.title || currentTarget?.ref.name || '歌手';
  const visibleSongs = showAllSongs ? hotSongs : hotSongs.slice(0, 10);

  return (
    <View testID="artist-detail-view" style={{ flex: 1 }}>
      {/* Header Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 }}>
        <Pressable
          testID="artist-detail-back"
          accessibilityRole="button"
          accessibilityLabel={stack.length > 1 ? '返回上一位歌手' : '返回播放页'}
          onPress={handleBack}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: softSurface, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={20} color={s.ink} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: '700', color: s.ink }}>{displayName}</Text>
          <Text numberOfLines={1} style={{ fontSize: 11.5, color: s.muted }}>
            歌手主页 · {PLATFORM_LABELS[platform]}
          </Text>
        </View>
        {stack.length > 1 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭歌手主页"
            onPress={onClose}
            style={{ paddingHorizontal: 11, height: 32, borderRadius: 16, backgroundColor: softSurface, justifyContent: 'center' }}
          >
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: s.ink }}>完成</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 44, gap: 18 }} showsVerticalScrollIndicator={false}>
        {/* Artist Hero Card */}
        <View style={[{ padding: 16, borderRadius: 22, backgroundColor: cardBg, borderWidth: 1, borderColor: s.cardBorder, gap: 14 }, s.cardShadow]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ padding: 2.5, borderRadius: 46, borderWidth: 1.5, borderColor: s.accent + '44' }}>
              <Cover services={services} url={artist?.artwork} size={82} radius={41} fallbackText={displayName} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
              <Text numberOfLines={2} style={{ fontSize: 21, fontWeight: '800', color: s.ink }}>{displayName}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {artist?.songCount !== undefined && (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9, backgroundColor: s.chip }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '600', color: s.muted, fontVariant: ['tabular-nums'] }}>
                      {artist.songCount} 首单曲
                    </Text>
                  </View>
                )}
                {artist?.albumCount !== undefined && (
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9, backgroundColor: s.chip }}>
                    <Text style={{ fontSize: 11.5, fontWeight: '600', color: s.muted, fontVariant: ['tabular-nums'] }}>
                      {artist.albumCount} 张专辑
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {!!artist?.description && (
            <Pressable onPress={() => setBioExpanded(v => !v)} style={{ gap: 3 }}>
              <Text numberOfLines={bioExpanded ? undefined : 3} style={{ fontSize: 12.5, lineHeight: 19, color: s.muted }}>
                {artist.description}
              </Text>
              {artist.description.length > 75 && (
                <Text style={{ fontSize: 12, fontWeight: '600', color: s.accent }}>
                  {bioExpanded ? '收起简介' : '展开简介'}
                </Text>
              )}
            </Pressable>
          )}

          {hotSongs.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                testID="artist-play-all"
                accessibilityRole="button"
                onPress={() => playList(hotSongs, 0)}
                style={{ flex: 1, minHeight: 42, borderRadius: 21, backgroundColor: s.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <Ionicons name="play" size={16} color="#FFFFFF" />
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>播放热门 ({hotSongs.length})</Text>
              </Pressable>
              <Pressable
                testID="artist-shuffle-all"
                accessibilityRole="button"
                onPress={() => playList(hotSongs, 0, true)}
                style={{ paddingHorizontal: 18, minHeight: 42, borderRadius: 21, backgroundColor: s.chip, borderWidth: 1, borderColor: s.chipBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }}
              >
                <Ionicons name="shuffle" size={16} color={s.ink} />
                <Text style={{ fontSize: 14, fontWeight: '600', color: s.ink }}>随机</Text>
              </Pressable>
            </View>
          )}
        </View>

        {loading && (
          <View style={{ paddingVertical: 28, alignItems: 'center', gap: 10 }}>
            <ActivityIndicator color={s.accent} />
            <Text style={{ fontSize: 13, color: s.muted }}>正在加载歌手热门单曲、专辑与相似歌手…</Text>
          </View>
        )}

        {!!error && !loading && (
          <View style={{ padding: 16, borderRadius: 18, backgroundColor: cardBg, borderWidth: 1, borderColor: s.cardBorder, alignItems: 'center', gap: 10 }}>
            <Text accessibilityRole="alert" style={{ fontSize: 13.5, color: s.accent, textAlign: 'center' }}>{error}</Text>
          </View>
        )}

        {/* Hot Songs Section */}
        {visibleSongs.length > 0 && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
              <Text style={{ fontSize: 16.5, fontWeight: '700', color: s.ink }}>热门单曲</Text>
              {hotSongs.length > 10 && (
                <Pressable onPress={() => setShowAllSongs(v => !v)} style={{ paddingVertical: 2 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: s.accent }}>
                    {showAllSongs ? '收起' : `查看全部 ${hotSongs.length} 首`}
                  </Text>
                </Pressable>
              )}
            </View>
            <View style={[{ borderRadius: 20, backgroundColor: cardBg, borderWidth: 1, borderColor: s.cardBorder, overflow: 'hidden' }, s.cardShadow]}>
              {visibleSongs.map((track, idx) => {
                const rowState = trackPlayback.stateFor(track);
                const isActive = rowState !== 'idle';
                return (
                  <View
                    key={`${track.origin.id}-${idx}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 10,
                      minHeight: 62,
                      borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0,
                      borderTopColor: s.hairline,
                      backgroundColor: isActive ? s.accentSoft : 'transparent',
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => playList(hotSongs, idx)}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}
                    >
                      <Text style={{ width: 24, textAlign: 'center', fontSize: 12, fontWeight: '700', color: isActive ? s.accent : s.subtle, fontVariant: ['tabular-nums'] }}>
                        {String(idx + 1).padStart(2, '0')}
                      </Text>
                      <Cover services={services} track={track} size={44} radius={9} />
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text numberOfLines={1} style={{ fontSize: 14.5, fontWeight: isActive ? '700' : '600', color: isActive ? s.accent : s.ink }}>
                          {track.title}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                          <QualityBadge track={track} />
                          <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: s.muted }}>
                            {track.album || track.artist}
                          </Text>
                        </View>
                      </View>
                      <TrackPlaybackIndicator state={rowState} color={s.accent} size={15} />
                    </Pressable>
                    <Pressable accessibilityRole="button" onPress={() => setMenuTrack(track)} style={{ width: 34, height: 38, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="ellipsis-horizontal" size={17} color={s.muted} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Albums Shelf */}
        {albums.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 16.5, fontWeight: '700', color: s.ink, paddingHorizontal: 2 }}>
              专辑 ({albums.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 6 }}>
              {albums.map(album => (
                <Pressable
                  key={album.id}
                  accessibilityRole="button"
                  accessibilityLabel={`查看专辑：${album.title}`}
                  onPress={() => openAlbum(album)}
                  style={{ width: 122, gap: 6 }}
                >
                  <Cover services={services} url={album.artwork} size={122} radius={14} fallbackText={album.title} />
                  <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: '600', color: s.ink, lineHeight: 17 }}>
                    {album.title}
                  </Text>
                  {!!album.author && (
                    <Text numberOfLines={1} style={{ fontSize: 11.5, color: s.muted }}>{album.author}</Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Similar Artists Shelf */}
        {similar.items.length > 0 && (
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 16.5, fontWeight: '700', color: s.ink, paddingHorizontal: 2 }}>
              相似歌手
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 6 }}>
              {similar.items.map(sim => (
                <Pressable
                  key={`${similar.platform}-${sim.id}`}
                  testID={`similar-artist-${sim.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`查看相似歌手：${sim.title}`}
                  onPress={() =>
                    setStack(prev => [
                      ...prev,
                      {
                        ref: { name: sim.title, id: sim.id, platform: similar.platform },
                        resolvedPlatform: similar.platform,
                        resolvedArtist: sim,
                      },
                    ])
                  }
                  style={{ width: 82, alignItems: 'center', gap: 6 }}
                >
                  <Cover services={services} url={sim.artwork} size={74} radius={37} fallbackText={sim.title} />
                  <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '600', color: s.ink, textAlign: 'center' }}>
                    {sim.title}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
      <TrackActions
        services={services}
        track={menuTrack}
        prefix="artist-song"
        onClose={() => setMenuTrack(null)}
        onSearchArtist={name => {
          setMenuTrack(null);
          setStack(prev => [...prev, { ref: { name } }]);
        }}
      />
    </View>
  );
}
