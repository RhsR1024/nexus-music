import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Services } from '../app/services.ts';
import type { Track } from '../domain/track.ts';
import { trackKey } from '../domain/track.ts';
import {
  asQishuiMatchedTrack,
  QISHUI_CURATED_COLLECTIONS,
  QISHUI_ROAM_MODES,
  type QishuiBoundPlaylist,
  type QishuiCuratedCollection,
  type QishuiRoamMode,
} from '../providers/qishui.ts';
import { Cover } from './Cover.tsx';
import { Modal } from './AdaptiveModal.tsx';
import { QishuiImport } from './QishuiImport.tsx';
import { Text, TextInput } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { sollinTokens } from './tokens.ts';

type QishuiTab = 'featured' | 'roam' | 'playlists';
type PersonalSheet =
  | null
  | { kind: 'liked' }
  | { kind: 'recent' }
  | { kind: 'playlists' }
  | { kind: 'bound'; playlist: QishuiBoundPlaylist }
  | { kind: 'curated'; collection: QishuiCuratedCollection };

export function QishuiDiscoverSection({ services }: { services: Services }) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);
  const softSurface = s.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.52)';
  const segmentTrack = s.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.34)';
  const segmentActive = s.dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.86)';

  const qishuiAccount = useSyncExternalStore(
    services.qishuiAccount.subscribe,
    services.qishuiAccount.getSnapshot,
  );

  const [subTab, setSubTab] = useState<QishuiTab>('featured');
  const [expandedModes, setExpandedModes] = useState(false);
  const [query, setQuery] = useState('');
  const [searchTracks, setSearchTracks] = useState<readonly Track[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');

  // Wayferar-Music 292 style non-resetting mode cache: switching roam modes preserves loaded pools & scroll state.
  const [roamCache, setRoamCache] = useState<Record<string, readonly Track[]>>({});
  const [roamLoading, setRoamLoading] = useState(false);
  const [roamError, setRoamError] = useState('');
  const roamAbort = useRef<AbortController | null>(null);

  const [sheet, setSheet] = useState<PersonalSheet>(null);
  const [curatedTracks, setCuratedTracks] = useState<readonly Track[]>([]);
  const [curatedLoading, setCuratedLoading] = useState(false);
  const [bindInput, setBindInput] = useState('');
  const [bindLoading, setBindLoading] = useState(false);
  const [bindMessage, setBindMessage] = useState('');

  const activeMode = useMemo(
    () => QISHUI_ROAM_MODES.find(m => m.id === qishuiAccount.activeModeId) ?? QISHUI_ROAM_MODES[0]!,
    [qishuiAccount.activeModeId],
  );
  const activeRoamTracks = roamCache[activeMode.id] ?? [];

  async function loadModeTracks(mode: QishuiRoamMode, force = false) {
    if (!force && roamCache[mode.id]?.length) return;
    roamAbort.current?.abort();
    const ctrl = new AbortController();
    roamAbort.current = ctrl;
    setRoamLoading(true);
    setRoamError('');
    try {
      const res = await services.online.search('wy', mode.query, force ? 2 : 1, ctrl.signal, 24);
      if (ctrl.signal.aborted) return;
      const mapped = res.items.map(asQishuiMatchedTrack);
      setRoamCache(prev => ({ ...prev, [mode.id]: mapped }));
    } catch {
      if (!ctrl.signal.aborted) setRoamError('拉取漫游流失败，请稍后重试');
    } finally {
      if (!ctrl.signal.aborted) setRoamLoading(false);
    }
  }

  useEffect(() => {
    void loadModeTracks(activeMode);
    return () => {
      roamAbort.current?.abort();
    };
  }, [activeMode.id]);

  function selectMode(mode: QishuiRoamMode) {
    void services.qishuiAccount.setActiveMode(mode.id).catch(() => {});
    void loadModeTracks(mode);
  }

  function playQishuiTracks(tracks: readonly Track[], index: number) {
    const picked = tracks[index];
    if (picked) void services.qishuiAccount.recordRecent(picked).catch(() => {});
    services.playTracks(tracks, index);
  }

  async function runSearch() {
    const q = query.trim();
    if (!q) return;
    setSearchLoading(true);
    setSearchStatus(`正在跨源匹配「${q}」…`);
    const ctrl = new AbortController();
    try {
      const res = await services.online.search('wy', q, 1, ctrl.signal, 24);
      const mapped = res.items.map(asQishuiMatchedTrack);
      setSearchTracks(mapped);
      setSearchStatus(mapped.length ? `匹配到 ${mapped.length} 首曲目，点击即可通过 LX 音源播放` : '未找到匹配曲目，请更换关键词');
    } catch {
      setSearchStatus('跨源搜索失败，请稍后重试');
    } finally {
      setSearchLoading(false);
    }
  }

  async function openCuratedCollection(collection: QishuiCuratedCollection) {
    setSheet({ kind: 'curated', collection });
    setCuratedTracks([]);
    setCuratedLoading(true);
    const ctrl = new AbortController();
    try {
      const res = await services.online.search('wy', collection.query, 1, ctrl.signal, 24);
      setCuratedTracks(res.items.map(asQishuiMatchedTrack));
    } catch {
      setCuratedTracks([]);
    } finally {
      setCuratedLoading(false);
    }
  }

  async function bindPublicPlaylist() {
    const raw = bindInput.trim();
    if (!raw || bindLoading) return;
    setBindLoading(true);
    setBindMessage('');
    const ctrl = new AbortController();
    try {
      const parsed = await services.qishui.complete(raw, ctrl.signal);
      await services.qishuiAccount.bindPlaylist(parsed);
      setBindInput('');
      setBindMessage(`已绑定「${parsed.title}」（${parsed.tracks.length} 首）`);
    } catch (e) {
      setBindMessage(e instanceof Error ? e.message : '读取公开歌单失败，请检查链接或 ID');
    } finally {
      setBindLoading(false);
    }
  }

  const visibleModes = expandedModes ? QISHUI_ROAM_MODES : QISHUI_ROAM_MODES.slice(0, 6);

  const renderTrackRow = (track: Track, idx: number, pool: readonly Track[]) => {
    const liked = qishuiAccount.liked.some(t => trackKey(t.origin) === trackKey(track.origin));
    return (
      <View key={`${trackKey(track.origin)}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => playQishuiTracks(pool, idx)}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 }}
        >
          <Cover services={services} track={track} size={46} radius={10} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text numberOfLines={1} style={{ color: s.ink, fontSize: 14.5, fontWeight: '600' }}>{track.title}</Text>
            <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12 }}>
              {track.artist}{track.album ? ` · ${track.album}` : ''}
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={liked ? '取消汽水喜欢' : '加入汽水喜欢'}
          onPress={() => { void services.qishuiAccount.toggleLike(track).catch(() => {}); }}
          style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={liked ? '#E83D56' : s.muted} />
        </Pressable>
      </View>
    );
  };

  return (
    <View testID="qishui-discover-section" style={{ gap: 14, paddingBottom: 20 }}>
      {/* Sollin-aligned 3-segment switcher: 精选 | 漫游 | 歌单 */}
      <View style={{ flexDirection: 'row', padding: 3, borderRadius: 24, backgroundColor: segmentTrack }}>
        {([
          ['featured', '精选'],
          ['roam', '漫游'],
          ['playlists', '歌单'],
        ] as const).map(([id, label]) => {
          const selected = subTab === id;
          return (
            <Pressable
              key={id}
              testID={`qishui-tab-${id}`}
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

      {/* Personal Hub strip: 喜欢的歌 · 我的歌单 · 最近播放 (matches Sollin Qishui) */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[
          { id: 'liked' as const, label: '喜欢的歌', count: `${qishuiAccount.liked.length} 首`, icon: 'heart' as const, color: '#E84C78' },
          { id: 'playlists' as const, label: '我的歌单', count: `${qishuiAccount.playlists.length} 个`, icon: 'albums' as const, color: '#00B886' },
          { id: 'recent' as const, label: '最近播放', count: `${qishuiAccount.recent.length} 首`, icon: 'time' as const, color: '#5A78E6' },
        ].map(hub => (
          <Pressable
            key={hub.id}
            testID={`qishui-hub-${hub.id}`}
            accessibilityRole="button"
            onPress={() => setSheet({ kind: hub.id })}
            style={{
              flex: 1,
              paddingVertical: 11,
              paddingHorizontal: 10,
              borderRadius: 16,
              backgroundColor: softSurface,
              borderWidth: 1,
              borderColor: s.cardBorder,
              alignItems: 'center',
              gap: 5,
            }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: `${hub.color}22`, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={hub.icon} size={17} color={hub.color} />
            </View>
            <Text numberOfLines={1} style={{ color: s.ink, fontSize: 13, fontWeight: '700' }}>{hub.label}</Text>
            <Text numberOfLines={1} style={{ color: s.muted, fontSize: 11 }}>{hub.count}</Text>
          </Pressable>
        ))}
      </View>

      {subTab === 'featured' && (
        <>
          {/* Compact cross-source search box */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              accessibilityLabel="汽水跨源搜歌"
              placeholder="搜汽水热歌、歌手或氛围关键词…"
              placeholderTextColor={s.subtle}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void runSearch()}
              style={{ flex: 1, color: s.ink, backgroundColor: s.inputBg, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 14, fontSize: 14 }}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => void runSearch()}
              disabled={searchLoading || !query.trim()}
              style={{ paddingHorizontal: 16, borderRadius: 14, backgroundColor: s.control, justifyContent: 'center', opacity: searchLoading || !query.trim() ? 0.45 : 1 }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '600' }}>搜索</Text>
            </Pressable>
          </View>

          {searchLoading && <ActivityIndicator color={s.accent} />}
          {!searchLoading && !!searchStatus && <Text style={{ color: s.muted, fontSize: 12 }}>{searchStatus}</Text>}
          {searchTracks.length > 0 && (
            <View style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: s.ink, fontSize: 16, fontWeight: '700' }}>搜索结果 ({searchTracks.length})</Text>
                <Pressable accessibilityRole="button" onPress={() => setSearchTracks([])}>
                  <Text style={{ color: s.muted, fontSize: 12.5 }}>收起</Text>
                </Pressable>
              </View>
              {searchTracks.slice(0, 8).map((t, idx) => renderTrackRow(t, idx, searchTracks))}
            </View>
          )}

          {/* 音乐漫游 2x3 + expandable scene mode grid */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: s.ink, fontSize: 18, fontWeight: '700' }}>音乐漫游</Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: 'rgba(0,184,134,0.16)' }}>
                  <Text style={{ color: '#00A882', fontSize: 11, fontWeight: '700' }}>{activeMode.title}</Text>
                </View>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setExpandedModes(v => !v)}>
                <Text style={{ color: s.accent, fontSize: 12.5, fontWeight: '600' }}>
                  {expandedModes ? '收起模式' : `全部 ${QISHUI_ROAM_MODES.length} 种`}
                </Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
              {visibleModes.map(mode => {
                const selected = mode.id === activeMode.id;
                return (
                  <Pressable
                    key={mode.id}
                    testID={`qishui-mode-${mode.id}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => selectMode(mode)}
                    style={{
                      width: '31%',
                      flexGrow: 1,
                      padding: 11,
                      borderRadius: 15,
                      backgroundColor: s.dark ? 'rgba(255,255,255,0.08)' : mode.tint,
                      borderWidth: selected ? 1.6 : 1,
                      borderColor: selected ? mode.accent : s.cardBorder,
                      gap: 5,
                    }}
                  >
                    <Ionicons name={mode.icon as React.ComponentProps<typeof Ionicons>['name']} size={18} color={mode.accent} />
                    <Text numberOfLines={1} style={{ color: s.ink, fontSize: 13.5, fontWeight: '700' }}>{mode.title}</Text>
                    <Text numberOfLines={1} style={{ color: s.muted, fontSize: 10.5 }}>{mode.subtitle}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Active Roam Preview Strip */}
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: s.ink, fontSize: 17, fontWeight: '700' }}>{activeMode.title} · 漫游曲流</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void loadModeTracks(activeMode, true)}
                  style={{ paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, backgroundColor: softSurface }}
                >
                  <Text style={{ color: s.ink, fontSize: 12, fontWeight: '600' }}>换一批</Text>
                </Pressable>
                {activeRoamTracks.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => playQishuiTracks(activeRoamTracks, 0)}
                    style={{ paddingHorizontal: 13, paddingVertical: 6, borderRadius: 14, backgroundColor: s.control, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <Ionicons name="play" size={12} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>播放</Text>
                  </Pressable>
                )}
              </View>
            </View>
            {roamLoading && !activeRoamTracks.length && (
              <View style={{ paddingVertical: 14, alignItems: 'center' }}><ActivityIndicator color={s.accent} /></View>
            )}
            {!!roamError && <Text style={{ color: s.accent, fontSize: 12.5 }}>{roamError}</Text>}
            {activeRoamTracks.slice(0, 6).map((t, idx) => renderTrackRow(t, idx, activeRoamTracks))}
            {activeRoamTracks.length > 6 && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setSubTab('roam')}
                style={{ alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: softSurface }}
              >
                <Text style={{ color: s.ink, fontSize: 12.5, fontWeight: '600' }}>查看全部 {activeRoamTracks.length} 首漫游歌曲 →</Text>
              </Pressable>
            )}
          </View>

          {/* 精选歌单 2-column visual cards */}
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: s.ink, fontSize: 18, fontWeight: '700' }}>精选歌单</Text>
              <Pressable accessibilityRole="button" onPress={() => setSubTab('playlists')}>
                <Text style={{ color: s.accent, fontSize: 12.5, fontWeight: '600' }}>更多</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {QISHUI_CURATED_COLLECTIONS.slice(0, 4).map(col => (
                <Pressable
                  key={col.id}
                  accessibilityRole="button"
                  onPress={() => void openCuratedCollection(col)}
                  style={{ width: '48%', flexGrow: 1, height: 112, borderRadius: 16, overflow: 'hidden', padding: 13, justifyContent: 'space-between' }}
                >
                  <LinearGradient colors={[col.gradient[0], col.gradient[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.22)' }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' }}>{col.tag}</Text>
                  </View>
                  <View style={{ gap: 2 }}>
                    <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>{col.title}</Text>
                    <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.82)', fontSize: 11.5 }}>{col.subtitle}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      )}

      {subTab === 'roam' && (
        <View style={{ gap: 12 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
            {QISHUI_ROAM_MODES.map(mode => {
              const selected = mode.id === activeMode.id;
              return (
                <Pressable
                  key={mode.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => selectMode(mode)}
                  style={{
                    paddingHorizontal: 13,
                    paddingVertical: 8,
                    borderRadius: 18,
                    backgroundColor: selected ? mode.accent : softSurface,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Ionicons name={mode.icon as React.ComponentProps<typeof Ionicons>['name']} size={14} color={selected ? '#FFFFFF' : mode.accent} />
                  <Text style={{ color: selected ? '#FFFFFF' : s.ink, fontSize: 13, fontWeight: selected ? '700' : '500' }}>{mode.title}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ gap: 2 }}>
              <Text style={{ color: s.ink, fontSize: 18, fontWeight: '700' }}>{activeMode.title}</Text>
              <Text style={{ color: s.muted, fontSize: 12 }}>{activeMode.subtitle} · 切换模式不重置浏览进度</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable accessibilityRole="button" onPress={() => void loadModeTracks(activeMode, true)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 15, backgroundColor: softSurface }}>
                <Text style={{ color: s.ink, fontSize: 12.5, fontWeight: '600' }}>刷新</Text>
              </Pressable>
              {activeRoamTracks.length > 0 && (
                <Pressable accessibilityRole="button" onPress={() => playQishuiTracks(activeRoamTracks, 0)} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 15, backgroundColor: s.control, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="play" size={13} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' }}>播放全部</Text>
                </Pressable>
              )}
            </View>
          </View>

          {roamLoading && !activeRoamTracks.length ? (
            <View style={{ paddingVertical: 24, alignItems: 'center' }}><ActivityIndicator color={s.accent} /></View>
          ) : (
            activeRoamTracks.map((t, idx) => renderTrackRow(t, idx, activeRoamTracks))
          )}
        </View>
      )}

      {subTab === 'playlists' && (
        <View style={{ gap: 14 }}>
          <View style={{ padding: 14, borderRadius: 18, backgroundColor: softSurface, gap: 10 }}>
            <Text style={{ color: s.ink, fontSize: 15.5, fontWeight: '700' }}>绑定汽水公开歌单</Text>
            <Text style={{ color: s.muted, fontSize: 12, lineHeight: 17 }}>
              粘贴汽水音乐 App 分享链接或歌单 ID，绑定后可在「我的歌单」中随时直达播放（支持 LX 多音源跨平台解析）。
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                accessibilityLabel="绑定汽水公开歌单链接或ID"
                placeholder="粘贴汽水歌单分享链接或 ID…"
                placeholderTextColor={s.subtle}
                value={bindInput}
                onChangeText={setBindInput}
                autoCapitalize="none"
                autoCorrect={false}
                style={{ flex: 1, color: s.ink, backgroundColor: s.inputBg, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, fontSize: 13.5 }}
              />
              <Pressable
                accessibilityRole="button"
                disabled={bindLoading || !bindInput.trim()}
                onPress={() => void bindPublicPlaylist()}
                style={{ paddingHorizontal: 15, borderRadius: 13, backgroundColor: s.control, justifyContent: 'center', opacity: bindLoading || !bindInput.trim() ? 0.45 : 1 }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '700' }}>{bindLoading ? '读取中…' : '绑定'}</Text>
              </Pressable>
            </View>
            {!!bindMessage && <Text style={{ color: s.accent, fontSize: 12 }}>{bindMessage}</Text>}
          </View>

          {qishuiAccount.playlists.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: s.ink, fontSize: 17, fontWeight: '700' }}>已绑定的汽水歌单 ({qishuiAccount.playlists.length})</Text>
              {qishuiAccount.playlists.map(pl => (
                <Pressable
                  key={pl.id}
                  accessibilityRole="button"
                  onPress={() => setSheet({ kind: 'bound', playlist: pl })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 15, backgroundColor: softSurface }}
                >
                  <Cover services={services} url={pl.artwork} size={50} radius={10} fallbackText={pl.title} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={{ color: s.ink, fontSize: 15, fontWeight: '700' }}>{pl.title}</Text>
                    <Text style={{ color: s.muted, fontSize: 12 }}>{pl.trackCount} 首 · 点击直接播放</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`移除 ${pl.title}`}
                    onPress={() => Alert.alert('移除绑定歌单？', `将从汽水「我的歌单」移除「${pl.title}」。`, [
                      { text: '取消', style: 'cancel' },
                      { text: '移除', style: 'destructive', onPress: () => { void services.qishuiAccount.removePlaylist(pl.id); } },
                    ])}
                    style={{ padding: 6 }}
                  >
                    <Ionicons name="trash-outline" size={17} color={s.muted} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={{ color: s.ink, fontSize: 17, fontWeight: '700' }}>全部精选主题歌单</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {QISHUI_CURATED_COLLECTIONS.map(col => (
              <Pressable
                key={col.id}
                accessibilityRole="button"
                onPress={() => void openCuratedCollection(col)}
                style={{ width: '48%', flexGrow: 1, height: 112, borderRadius: 16, overflow: 'hidden', padding: 13, justifyContent: 'space-between' }}
              >
                <LinearGradient colors={[col.gradient[0], col.gradient[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.22)' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '700' }}>{col.tag}</Text>
                </View>
                <View style={{ gap: 2 }}>
                  <Text numberOfLines={1} style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>{col.title}</Text>
                  <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.82)', fontSize: 11.5 }}>{col.subtitle}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          <QishuiImport services={services} />
        </View>
      )}

      {/* Unified In-App Detail Modal for 喜欢的歌 / 我的歌单 / 最近播放 / 精选主题歌单 */}
      <Modal visible={sheet !== null} animationType="slide" onRequestClose={() => setSheet(null)}>
        <View style={{ flex: 1 }}>
          <LinearGradient colors={[...s.sheetGradient]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={{ flex: 1, paddingTop: 54, paddingHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 14 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="返回" onPress={() => setSheet(null)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: softSurface, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="chevron-back" size={22} color={s.ink} />
              </Pressable>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 20, fontWeight: '700', color: s.ink }}>
                {sheet?.kind === 'liked' ? '汽水 · 喜欢的歌'
                  : sheet?.kind === 'recent' ? '汽水 · 最近播放'
                  : sheet?.kind === 'playlists' ? '汽水 · 我的歌单'
                  : sheet?.kind === 'bound' ? sheet.playlist.title
                  : sheet?.kind === 'curated' ? sheet.collection.title : ''}
              </Text>
              {(() => {
                const tracks =
                  sheet?.kind === 'liked' ? qishuiAccount.liked
                    : sheet?.kind === 'recent' ? qishuiAccount.recent
                    : sheet?.kind === 'bound' ? sheet.playlist.tracks
                    : sheet?.kind === 'curated' ? curatedTracks : [];
                if (!tracks.length) return null;
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => playQishuiTracks(tracks, 0)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: s.control, flexDirection: 'row', alignItems: 'center', gap: 5 }}
                  >
                    <Ionicons name="play" size={13} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' }}>全部播放</Text>
                  </Pressable>
                );
              })()}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, gap: 6 }}>
              {sheet?.kind === 'playlists' && (
                qishuiAccount.playlists.length ? qishuiAccount.playlists.map(pl => (
                  <Pressable
                    key={pl.id}
                    accessibilityRole="button"
                    onPress={() => setSheet({ kind: 'bound', playlist: pl })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: softSurface }}
                  >
                    <Cover services={services} url={pl.artwork} size={52} radius={10} fallbackText={pl.title} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text numberOfLines={1} style={{ color: s.ink, fontSize: 15, fontWeight: '700' }}>{pl.title}</Text>
                      <Text style={{ color: s.muted, fontSize: 12 }}>{pl.trackCount} 首</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={17} color={s.subtle} />
                  </Pressable>
                )) : (
                  <View style={{ padding: 24, alignItems: 'center', gap: 10 }}>
                    <Text style={{ color: s.muted, fontSize: 14, textAlign: 'center' }}>尚未绑定汽水公开歌单，可切到「歌单」栏粘贴分享链接绑定。</Text>
                    <Pressable accessibilityRole="button" onPress={() => { setSheet(null); setSubTab('playlists'); }} style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18, backgroundColor: s.control }}>
                      <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' }}>去绑定汽水歌单</Text>
                    </Pressable>
                  </View>
                )
              )}

              {sheet?.kind === 'liked' && (
                qishuiAccount.liked.length ? qishuiAccount.liked.map((t, i) => renderTrackRow(t, i, qishuiAccount.liked))
                  : <Text style={{ color: s.muted, fontSize: 14, textAlign: 'center', paddingTop: 28 }}>还没有在汽水频道点亮红心的歌曲。</Text>
              )}

              {sheet?.kind === 'recent' && (
                qishuiAccount.recent.length ? qishuiAccount.recent.map((t, i) => renderTrackRow(t, i, qishuiAccount.recent))
                  : <Text style={{ color: s.muted, fontSize: 14, textAlign: 'center', paddingTop: 28 }}>暂无汽水频道播放记录。</Text>
              )}

              {sheet?.kind === 'bound' && sheet.playlist.tracks.map((t, i) => renderTrackRow(t, i, sheet.playlist.tracks))}

              {sheet?.kind === 'curated' && (
                curatedLoading ? <ActivityIndicator color={s.accent} style={{ marginTop: 28 }} />
                  : curatedTracks.length ? curatedTracks.map((t, i) => renderTrackRow(t, i, curatedTracks))
                  : <Text style={{ color: s.muted, fontSize: 14, textAlign: 'center', paddingTop: 28 }}>暂未获取到该主题歌单曲目，请稍后重试。</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
