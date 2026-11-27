import { useMemo, useState, useSyncExternalStore } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Services } from '../app/services.ts';
import {
  buildAlbumLibrary,
  filterAndSortAlbums,
  type AlbumLibraryGroup,
  type AlbumLibrarySort,
} from '../domain/albumLibrary.ts';
import { Cover } from './Cover.tsx';
import { Text, TextInput } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { sollinTokens } from './tokens.ts';

function formatMins(ms: number) {
  if (!ms || ms <= 0) return '';
  return `${Math.max(1, Math.round(ms / 60000))} 分钟`;
}

export function AlbumLibrarySection({ services }: { services: Services }) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);
  const library = useSyncExternalStore(services.library.subscribe, services.library.getSnapshot);
  const localFiles = useSyncExternalStore(services.localAudio.subscribe, services.localAudio.getSnapshot);

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<AlbumLibrarySort>('count');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const albums = useMemo(() => buildAlbumLibrary(library, localFiles.map(item => item.track)), [library, localFiles]);
  const shown = useMemo(() => filterAndSortAlbums(albums, query, sort), [albums, query, sort]);
  const selected: AlbumLibraryGroup | undefined = useMemo(
    () => (selectedKey ? albums.find(a => a.key === selectedKey) : undefined),
    [albums, selectedKey],
  );

  const softSurface = s.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.52)';
  const playPrimaryBg = s.dark ? '#F0E8EA' : '#3A3333';
  const playPrimaryInk = s.dark ? '#1F191C' : '#FFFFFF';

  if (selected) {
    return (
      <View testID="album-library-detail" style={{ gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSelectedKey(null)}
          style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: softSurface }}
        >
          <Ionicons name="chevron-back" size={16} color={s.ink} />
          <Text style={{ color: s.ink, fontSize: 13.5, fontWeight: '600' }}>返回专辑库</Text>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: 18, backgroundColor: softSurface }}>
          <View style={s.cardShadow}>
            <Cover services={services} url={selected.artwork} track={selected.tracks[0]} size={92} radius={14} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text numberOfLines={2} style={{ color: s.ink, fontSize: 18, fontWeight: '700' }}>{selected.title}</Text>
            <Text numberOfLines={1} style={{ color: s.muted, fontSize: 13 }}>{selected.artist}</Text>
            <Text style={{ color: s.subtle, fontSize: 12 }}>
              {selected.tracks.length} 首{selected.totalDurationMs > 0 ? ` · ${formatMins(selected.totalDurationMs)}` : ''}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => services.playTracks(selected.tracks, 0)}
            style={{ flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: playPrimaryBg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Ionicons name="play" size={15} color={playPrimaryInk} />
            <Text style={{ color: playPrimaryInk, fontSize: 14, fontWeight: '600' }}>播放整张专辑</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void services.preferences.update({ repeat: 'off', shuffle: true }).then(() => services.playTracks(selected.tracks, 0)).catch(() => {})}
            style={{ flex: 1, minHeight: 44, borderRadius: 14, backgroundColor: softSurface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Ionicons name="shuffle" size={16} color={s.ink} />
            <Text style={{ color: s.ink, fontSize: 14, fontWeight: '600' }}>随机播放</Text>
          </Pressable>
        </View>

        {selected.tracks.map((track, idx) => (
          <Pressable
            key={`${selected.key}-${track.origin.id}-${idx}`}
            accessibilityRole="button"
            onPress={() => services.playTracks(selected.tracks, idx)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}
          >
            <Text style={{ width: 22, textAlign: 'center', color: s.subtle, fontSize: 12.5, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
              {String(idx + 1).padStart(2, '0')}
            </Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={{ color: s.ink, fontSize: 14.5, fontWeight: '600' }}>{track.title}</Text>
              <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12 }}>{track.artist}</Text>
            </View>
            <Ionicons name="play-circle-outline" size={20} color={s.accent} />
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View testID="album-library-section" style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, height: 40, borderRadius: 14, backgroundColor: softSurface }}>
        <Ionicons name="search-outline" size={16} color={s.subtle} />
        <TextInput
          accessibilityLabel="搜索专辑库"
          value={query}
          onChangeText={setQuery}
          placeholder={`搜索 ${albums.length} 张专辑或歌手`}
          placeholderTextColor={s.subtle}
          style={{ flex: 1, color: s.ink, fontSize: 13.5, paddingVertical: 0 }}
        />
        {!!query && (
          <Pressable onPress={() => setQuery('')} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={16} color={s.subtle} />
          </Pressable>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 6 }}>
        {([['count', '曲数最多'], ['title', '专辑名称'], ['artist', '按歌手']] as const).map(([key, label]) => {
          const active = sort === key;
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => setSort(key)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: active ? s.control : softSurface }}
            >
              <Text style={{ color: active ? '#FFFFFF' : s.muted, fontSize: 12, fontWeight: '600' }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {shown.length === 0 ? (
        <Text style={{ color: s.muted, fontSize: 13, textAlign: 'center', paddingVertical: 20 }}>
          {albums.length === 0 ? '收藏歌曲、导入歌单或扫描本地音乐后将自动归集专辑库' : '没有匹配的专辑'}
        </Text>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {shown.slice(0, 60).map(album => (
            <Pressable
              key={album.key}
              accessibilityRole="button"
              onPress={() => setSelectedKey(album.key)}
              style={{ width: '47.5%', gap: 6, padding: 10, borderRadius: 16, backgroundColor: softSurface }}
            >
              <View style={s.cardShadow}>
                <Cover services={services} url={album.artwork} track={album.tracks[0]} size={136} radius={12} />
              </View>
              <Text numberOfLines={1} style={{ color: s.ink, fontSize: 14, fontWeight: '700' }}>{album.title}</Text>
              <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12 }}>{album.artist} · {album.tracks.length} 首</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
