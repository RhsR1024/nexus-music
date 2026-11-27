import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Services } from '../app/services.ts';
import type { Track } from '../domain/track.ts';
import { asQishuiMatchedTrack, QISHUI_ROAM_MODES, type QishuiRoamMode } from '../providers/qishui.ts';
import { Cover } from './Cover.tsx';
import { QishuiImport } from './QishuiImport.tsx';
import { Text, TextInput } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { sollinTokens } from './tokens.ts';

export function QishuiDiscoverSection({ services }: { services: Services }) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);
  const softSurface = s.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.52)';

  const [activeMode, setActiveMode] = useState<string>('');
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<readonly Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  async function runMatchedSearch(keyword: string, label: string, modeId = '') {
    const q = keyword.trim();
    if (!q) return;
    setActiveMode(modeId);
    setLoading(true);
    setStatus(`正在为「${label}」匹配可播曲目…`);
    const ctrl = new AbortController();
    try {
      const res = await services.online.search('wy', q, 1, ctrl.signal, 20);
      const mapped = res.items.map(asQishuiMatchedTrack);
      setTracks(mapped);
      setStatus(mapped.length ? `已就绪 ${mapped.length} 首（播放时由 LX 音源跨平台自动解析）` : '暂未找到匹配曲目，请更换关键词');
    } catch {
      setStatus('拉取推荐流失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }

  function startRoam(mode: QishuiRoamMode) {
    void runMatchedSearch(mode.query, mode.title, mode.id);
  }

  return (
    <View testID="qishui-discover-section" style={{ gap: 14, paddingBottom: 20 }}>
      <View style={{ padding: 14, borderRadius: 18, backgroundColor: softSurface, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,214,160,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="musical-notes" size={15} color="#00B886" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: s.ink, fontSize: 15, fontWeight: '700' }}>汽水发现 · 跨源匹配模式</Text>
            <Text style={{ color: s.muted, fontSize: 12 }}>支持漫游场景、关键词搜歌与公开歌单导入，播放走已启用的 LX 多音源自动解析</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            accessibilityLabel="汽水跨源搜歌"
            placeholder="搜索歌曲、歌手或抖音热歌…"
            placeholderTextColor={s.subtle}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void runMatchedSearch(query, query)}
            style={{ flex: 1, color: s.ink, backgroundColor: s.inputBg, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, fontSize: 14 }}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void runMatchedSearch(query, query)}
            disabled={loading || !query.trim()}
            style={{ paddingHorizontal: 16, borderRadius: 13, backgroundColor: s.control, justifyContent: 'center', opacity: loading || !query.trim() ? 0.45 : 1 }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '600' }}>搜索</Text>
          </Pressable>
        </View>
      </View>

      <Text style={{ color: s.ink, fontSize: 18, fontWeight: '700' }}>场景漫游</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {QISHUI_ROAM_MODES.map(mode => {
          const selected = activeMode === mode.id;
          return (
            <Pressable
              key={mode.id}
              accessibilityRole="button"
              onPress={() => startRoam(mode)}
              style={{
                width: '48%',
                flexGrow: 1,
                padding: 13,
                borderRadius: 16,
                backgroundColor: s.dark ? 'rgba(255,255,255,0.08)' : mode.tint,
                borderWidth: selected ? 1.5 : 1,
                borderColor: selected ? '#00B886' : s.cardBorder,
                gap: 4,
              }}
            >
              <Text numberOfLines={1} style={{ color: s.ink, fontSize: 14.5, fontWeight: '700' }}>{mode.title}</Text>
              <Text numberOfLines={1} style={{ color: s.muted, fontSize: 11.5 }}>{mode.subtitle}</Text>
            </Pressable>
          );
        })}
      </View>

      <QishuiImport services={services} />

      {loading && (
        <View style={{ paddingVertical: 16, alignItems: 'center', gap: 8 }}>
          <ActivityIndicator color={s.accent} />
          <Text style={{ color: s.muted, fontSize: 12.5 }}>{status}</Text>
        </View>
      )}
      {!loading && !!status && <Text style={{ color: s.muted, fontSize: 12.5 }}>{status}</Text>}

      {tracks.length > 0 && (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: s.ink, fontSize: 17, fontWeight: '700' }}>漫游曲目 ({tracks.length})</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => services.playTracks(tracks, 0)}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: s.control, flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <Ionicons name="play" size={13} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '600' }}>播放全部</Text>
            </Pressable>
          </View>
          {tracks.map((track, idx) => (
            <Pressable
              key={`${track.origin.id}-${idx}`}
              accessibilityRole="button"
              onPress={() => services.playTracks(tracks, idx)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 8 }}
            >
              <Cover services={services} track={track} size={44} radius={9} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={{ color: s.ink, fontSize: 14.5, fontWeight: '600' }}>{track.title}</Text>
                <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12 }}>{track.artist}{track.album ? ` · ${track.album}` : ''}</Text>
              </View>
              <Ionicons name="play-circle-outline" size={20} color={s.accent} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
