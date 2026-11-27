import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Services } from '../app/services.ts';
import type { OnlinePlatform, Track } from '../domain/track.ts';
import type { BrowseCategory, BrowseItem, FeaturedHomeData, OfficialToplistPreview } from '../providers/discovery.ts';
import type { VideoItem } from '../providers/videos.ts';
import { Cover } from './Cover.tsx';
import { Text } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { sollinTokens } from './tokens.ts';

function formatPlayCount(n?: number) {
  if (n === undefined || !Number.isFinite(n)) return '';
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)} 亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)} 万`;
  return String(Math.floor(n));
}

function ShelfHeader({
  title,
  actionLabel,
  secondaryLabel,
  onAction,
  onSecondary,
  ink,
  accent,
}: {
  title: string;
  actionLabel?: string;
  secondaryLabel?: string;
  onAction?: () => void;
  onSecondary?: () => void;
  ink: string;
  accent: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
      <Text numberOfLines={1} style={{ flex: 1, color: ink, fontSize: 19, fontWeight: '700', letterSpacing: -0.2 }}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {!!secondaryLabel && onSecondary && (
          <Pressable accessibilityRole="button" onPress={onSecondary} style={{ paddingVertical: 4 }}>
            <Text style={{ color: accent, fontSize: 13, fontWeight: '600' }}>{secondaryLabel}</Text>
          </Pressable>
        )}
        {!!actionLabel && onAction && (
          <Pressable accessibilityRole="button" onPress={onAction} style={{ paddingVertical: 4 }}>
            <Text style={{ color: accent, fontSize: 13, fontWeight: '600' }}>{actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function PlaylistShelf({
  services,
  title,
  items,
  actionLabel,
  onAction,
  onOpenPlaylist,
  ink,
  muted,
  accent,
  shadow,
}: {
  services: Services;
  title: string;
  items: readonly BrowseItem[];
  actionLabel?: string;
  onAction?: () => void;
  onOpenPlaylist: (item: BrowseItem) => void;
  ink: string;
  muted: string;
  accent: string;
  shadow: object;
}) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 10 }}>
      <ShelfHeader title={title} actionLabel={actionLabel} onAction={onAction} ink={ink} accent={accent} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 2 }}>
        {items.slice(0, 12).map(pl => (
          <Pressable
            key={`${title}-${pl.id}`}
            accessibilityRole="button"
            onPress={() => onOpenPlaylist(pl)}
            style={{ width: 112, gap: 6 }}
          >
            <View style={shadow}>
              <Cover services={services} url={pl.artwork} size={112} radius={13} />
            </View>
            <Text numberOfLines={2} style={{ color: ink, fontSize: 13, fontWeight: '600', lineHeight: 17.5 }}>
              {pl.title}
            </Text>
            {pl.playCount !== undefined ? (
              <Text numberOfLines={1} style={{ color: muted, fontSize: 11.5 }}>{formatPlayCount(pl.playCount)}</Text>
            ) : !!pl.author ? (
              <Text numberOfLines={1} style={{ color: muted, fontSize: 11.5 }}>{pl.author}</Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function NumberedSongShelf({
  services,
  title,
  tracks,
  actionLabel,
  onAction,
  ink,
  muted,
  subtle,
  accent,
}: {
  services: Services;
  title: string;
  tracks: readonly Track[];
  actionLabel?: string;
  onAction?: () => void;
  ink: string;
  muted: string;
  subtle: string;
  accent: string;
}) {
  if (!tracks.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <ShelfHeader title={title} actionLabel={actionLabel} onAction={onAction} ink={ink} accent={accent} />
      <View style={{ gap: 2 }}>
        {tracks.map((track, idx) => (
          <Pressable
            key={`${title}-${track.origin.id}-${idx}`}
            accessibilityRole="button"
            onPress={() => services.playTracks(tracks, idx)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 }}
          >
            <Cover services={services} track={track} size={46} radius={10} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={{ color: ink, fontSize: 15, fontWeight: '600' }}>{track.title}</Text>
              <Text numberOfLines={1} style={{ color: muted, fontSize: 12.5 }}>{track.artist}</Text>
            </View>
            <Text style={{ color: subtle, fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 24, textAlign: 'right' }}>
              {String(idx + 1).padStart(2, '0')}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function MvShelf({
  services,
  title,
  items,
  onOpenMV,
  ink,
  muted,
  accent,
  shadow,
}: {
  services: Services;
  title: string;
  items: readonly VideoItem[];
  onOpenMV: (item: VideoItem) => void;
  ink: string;
  muted: string;
  accent: string;
  shadow: object;
}) {
  if (!items.length) return null;
  return (
    <View testID={`featured-mv-shelf-${title}`} style={{ gap: 10 }}>
      <ShelfHeader title={title} ink={ink} accent={accent} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 2 }}>
        {items.slice(0, 12).map(mv => (
          <Pressable
            key={`${title}-${mv.id}`}
            accessibilityRole="button"
            accessibilityLabel={`播放MV：${mv.title}`}
            onPress={() => onOpenMV(mv)}
            style={{ width: 176, gap: 6 }}
          >
            <View style={[{ width: 176, height: 99, borderRadius: 13, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.12)' }, shadow]}>
              <Cover services={services} url={mv.artwork} size={176} radius={13} />
              <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.14)' }]}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.82)', alignItems: 'center', justifyContent: 'center', paddingLeft: 2 }}>
                  <Ionicons name="play" size={16} color="#262020" />
                </View>
              </View>
            </View>
            <Text numberOfLines={1} style={{ color: ink, fontSize: 13.5, fontWeight: '600' }}>{mv.title}</Text>
            {!!mv.author && <Text numberOfLines={1} style={{ color: muted, fontSize: 11.5 }}>{mv.author}</Text>}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export function FeaturedDiscoverFeed({
  services,
  platform,
  data,
  loading,
  error,
  onRetry,
  onOpenPlaylist,
  onOpenAlbum,
  onOpenArtist,
  onOpenRank,
  onOpenCategory,
  onOpenMV,
  onOpenMorePlaylists,
  onOpenMoreRankings,
  onOpenMoreAlbums,
  onOpenMoreArtists,
  onOpenSongShelf,
}: {
  services: Services;
  platform: OnlinePlatform;
  data: FeaturedHomeData | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onOpenPlaylist: (item: BrowseItem) => void;
  onOpenAlbum: (item: BrowseItem) => void;
  onOpenArtist: (artist: { id: string; title: string; artwork?: string }) => void;
  onOpenRank: (rank: OfficialToplistPreview) => void;
  onOpenCategory: (category: BrowseCategory) => void;
  onOpenMV: (item: VideoItem) => void;
  onOpenMorePlaylists: () => void;
  onOpenMoreRankings: () => void;
  onOpenMoreAlbums: () => void;
  onOpenMoreArtists: () => void;
  onOpenSongShelf: (title: string, tracks: readonly Track[]) => void;
}) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);
  const softSurface = s.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.50)';
  const chipBg = s.dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.68)';

  if (loading && !data) {
    return (
      <View style={{ paddingVertical: 36, alignItems: 'center', gap: 10 }}>
        <ActivityIndicator color={s.accent} />
        <Text style={{ color: s.muted, fontSize: 13 }}>正在载入精选发现流…</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ paddingVertical: 28, gap: 10, alignItems: 'center' }}>
        <Text style={{ color: s.accent, fontSize: 13 }}>{error || '精选内容暂不可用'}</Text>
        <Pressable accessibilityRole="button" onPress={onRetry} style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18, backgroundColor: softSurface }}>
          <Text style={{ color: s.ink, fontSize: 13, fontWeight: '600' }}>重试加载</Text>
        </Pressable>
      </View>
    );
  }

  const playlistCats = data.categories.filter(c => c.group !== '语种' && c.group !== '风格').slice(0, 18);
  const styleCats = data.categories.filter(c => c.group === '风格' || c.group === '语种').slice(0, 16);
  const fallbackCats = playlistCats.length ? playlistCats : data.categories.slice(0, 18);

  return (
    <View testID="featured-discover-feed" style={{ gap: 16, paddingBottom: 18 }}>
      {/* 1. 推荐歌单 */}
      <PlaylistShelf
        services={services}
        title="推荐歌单"
        items={data.recommendedPlaylists}
        actionLabel="更多"
        onAction={onOpenMorePlaylists}
        onOpenPlaylist={onOpenPlaylist}
        ink={s.ink}
        muted={s.muted}
        accent={s.accent}
        shadow={s.cardShadow}
      />

      {/* 2. 专属你的「治愈」精选 (01..10) */}
      {!!data.curatedSongs?.tracks.length && (
        <NumberedSongShelf
          services={services}
          title={data.curatedSongs.title}
          tracks={data.curatedSongs.tracks}
          actionLabel="更多"
          onAction={() => onOpenSongShelf(data.curatedSongs!.title, data.curatedSongs!.tracks)}
          ink={s.ink}
          muted={s.muted}
          subtle={s.subtle}
          accent={s.accent}
        />
      )}

      {/* 3. 新歌新碟（01..06 歌曲 + 横向专辑） */}
      {!!data.newSongAlbumTracks.length && (
        <NumberedSongShelf
          services={services}
          title="新歌新碟"
          tracks={data.newSongAlbumTracks}
          actionLabel="更多"
          onAction={() => onOpenSongShelf('新歌新碟', data.newSongAlbumTracks)}
          ink={s.ink}
          muted={s.muted}
          subtle={s.subtle}
          accent={s.accent}
        />
      )}
      {!!data.newSongAlbumCards.length && (
        <PlaylistShelf
          services={services}
          title={data.newSongAlbumTracks.length ? '新碟速览' : '新歌新碟'}
          items={data.newSongAlbumCards}
          actionLabel={platform === 'wy' ? '更多' : undefined}
          onAction={platform === 'wy' ? onOpenMoreAlbums : undefined}
          onOpenPlaylist={onOpenAlbum}
          ink={s.ink}
          muted={s.muted}
          accent={s.accent}
          shadow={s.cardShadow}
        />
      )}

      {/* 4. 网易云音乐的雷达歌单 */}
      <PlaylistShelf
        services={services}
        title="网易云音乐的雷达歌单"
        items={data.radarPlaylists}
        onOpenPlaylist={onOpenPlaylist}
        ink={s.ink}
        muted={s.muted}
        accent={s.accent}
        shadow={s.cardShadow}
      />

      {/* 5. 专属场景歌单 */}
      <PlaylistShelf
        services={services}
        title="专属场景歌单"
        items={data.scenePlaylists}
        onOpenPlaylist={onOpenPlaylist}
        ink={s.ink}
        muted={s.muted}
        accent={s.accent}
        shadow={s.cardShadow}
      />

      {/* 6. 视频合辑 */}
      <PlaylistShelf
        services={services}
        title="视频合辑"
        items={data.videoPlaylists}
        onOpenPlaylist={onOpenPlaylist}
        ink={s.ink}
        muted={s.muted}
        accent={s.accent}
        shadow={s.cardShadow}
      />

      {/* 7. 精品歌单 */}
      <PlaylistShelf
        services={services}
        title="精品歌单"
        items={data.highQualityPlaylists}
        actionLabel="更多"
        onAction={onOpenMorePlaylists}
        onOpenPlaylist={onOpenPlaylist}
        ink={s.ink}
        muted={s.muted}
        accent={s.accent}
        shadow={s.cardShadow}
      />

      {/* 8. 新歌速递 */}
      {!!data.newExpressSongs.length && (
        <NumberedSongShelf
          services={services}
          title="新歌速递"
          tracks={data.newExpressSongs}
          actionLabel="更多"
          onAction={() => onOpenSongShelf('新歌速递', data.newExpressSongs)}
          ink={s.ink}
          muted={s.muted}
          subtle={s.subtle}
          accent={s.accent}
        />
      )}

      {/* 9. 最新专辑 / 新碟上架 */}
      {!!data.newAlbums.length && (
        <PlaylistShelf
          services={services}
          title="最新专辑"
          items={data.newAlbums}
          actionLabel="更多"
          onAction={onOpenMoreAlbums}
          onOpenPlaylist={onOpenAlbum}
          ink={s.ink}
          muted={s.muted}
          accent={s.accent}
          shadow={s.cardShadow}
        />
      )}

      {/* 10. 热门歌手 */}
      {!!data.popularArtists.length && (
        <View style={{ gap: 10 }}>
          <ShelfHeader title="热门歌手" actionLabel="更多" onAction={onOpenMoreArtists} ink={s.ink} accent={s.accent} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 2 }}>
            {data.popularArtists.slice(0, 12).map(artist => (
              <Pressable
                key={`artist-${artist.id}`}
                accessibilityRole="button"
                onPress={() => onOpenArtist(artist)}
                style={{ width: 106, gap: 6 }}
              >
                <View style={s.cardShadow}>
                  <Cover services={services} url={artist.artwork} size={106} radius={13} />
                </View>
                <Text numberOfLines={1} style={{ color: s.ink, fontSize: 13.5, fontWeight: '600' }}>{artist.title}</Text>
                <Text numberOfLines={1} style={{ color: s.muted, fontSize: 11.5 }}>网易云歌手</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 11. 官方榜预览横卡 */}
      {!!data.officialToplists.length && (
        <View style={{ gap: 10 }}>
          <ShelfHeader title="官方榜" actionLabel="全部榜单" onAction={onOpenMoreRankings} ink={s.ink} accent={s.accent} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 2 }}>
            {data.officialToplists.map(rank => (
              <Pressable
                key={`rank-${rank.id}`}
                accessibilityRole="button"
                onPress={() => onOpenRank(rank)}
                style={{ width: 228, padding: 12, borderRadius: 16, backgroundColor: softSurface, flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <Cover services={services} url={rank.artwork} size={62} radius={12} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text numberOfLines={1} style={{ color: s.ink, fontSize: 15, fontWeight: '700' }}>{rank.title}</Text>
                  {!!rank.updateFrequency && <Text numberOfLines={1} style={{ color: s.subtle, fontSize: 11 }}>{rank.updateFrequency}</Text>}
                  {rank.tracks.slice(0, 2).map((tr, i) => (
                    <Text key={`${rank.id}-t-${i}`} numberOfLines={1} style={{ color: s.muted, fontSize: 11.5 }}>
                      {tr.first}{tr.second ? ` - ${tr.second}` : ''}
                    </Text>
                  ))}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* 12. 新歌榜 / 热榜 01..10 */}
      {!!data.newSongChartTracks.length && (
        <NumberedSongShelf
          services={services}
          title={data.newSongChartTitle || '新歌榜'}
          tracks={data.newSongChartTracks}
          actionLabel="更多"
          onAction={onOpenMoreRankings}
          ink={s.ink}
          muted={s.muted}
          subtle={s.subtle}
          accent={s.accent}
        />
      )}

      {/* 13. 歌单分类 & 曲风分类胶囊云 */}
      {!!fallbackCats.length && (
        <View style={{ gap: 10 }}>
          <ShelfHeader title="歌单分类" ink={s.ink} accent={s.accent} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {fallbackCats.map(cat => (
              <Pressable
                key={`cat-${cat.id}`}
                accessibilityRole="button"
                onPress={() => onOpenCategory(cat)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: chipBg, borderWidth: 1, borderColor: s.cardBorder }}
              >
                <Text style={{ color: s.ink, fontSize: 13, fontWeight: '500' }}>{cat.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {!!styleCats.length && (
        <View style={{ gap: 10 }}>
          <ShelfHeader title="曲风分类" ink={s.ink} accent={s.accent} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {styleCats.map(cat => (
              <Pressable
                key={`style-cat-${cat.id}`}
                accessibilityRole="button"
                onPress={() => onOpenCategory(cat)}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: chipBg, borderWidth: 1, borderColor: s.cardBorder }}
              >
                <Text style={{ color: s.ink, fontSize: 13, fontWeight: '500' }}>{cat.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* 14. 最新 MV & MV 排行（16:9 封面 + 播放角标） */}
      <MvShelf
        services={services}
        title="最新 MV"
        items={data.latestMVs}
        onOpenMV={onOpenMV}
        ink={s.ink}
        muted={s.muted}
        accent={s.accent}
        shadow={s.cardShadow}
      />
      <MvShelf
        services={services}
        title="MV 排行"
        items={data.topMVs}
        onOpenMV={onOpenMV}
        ink={s.ink}
        muted={s.muted}
        accent={s.accent}
        shadow={s.cardShadow}
      />
    </View>
  );
}
