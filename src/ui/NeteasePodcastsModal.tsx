import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import type { PodcastCategory, PodcastProgram, PodcastRadio } from '../providers/neteasePodcasts.ts';
import { Modal } from './AdaptiveModal.tsx';
import { Cover } from './Cover.tsx';
import { Text } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { sollinTokens } from './tokens.ts';

function formatCount(n?: number) {
  if (n === undefined) return '';
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)} 亿`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)} 万`;
  return String(n);
}

function formatDuration(ms?: number) {
  if (!ms || ms <= 0) return '';
  const sec = Math.floor(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

export function NeteasePodcastsModal({
  services,
  visible,
  onClose,
}: {
  services: Services;
  visible: boolean;
  onClose: () => void;
}) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState<readonly PodcastCategory[]>([]);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [radios, setRadios] = useState<readonly PodcastRadio[]>([]);
  const [radiosLoading, setRadiosLoading] = useState(false);
  const [radiosError, setRadiosError] = useState('');

  const [selectedRadio, setSelectedRadio] = useState<PodcastRadio | null>(null);
  const [programs, setPrograms] = useState<readonly PodcastProgram[]>([]);
  const [programsTotal, setProgramsTotal] = useState(0);
  const [programsMore, setProgramsMore] = useState(false);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [programsError, setProgramsError] = useState('');
  const programPage = useRef(1);

  useEffect(() => {
    if (!visible) return;
    const ctrl = new AbortController();
    void services.podcasts.categories(ctrl.signal).then(cats => {
      if (!ctrl.signal.aborted) setCategories(cats);
    }).catch(() => {});
    return () => ctrl.abort();
  }, [visible, services]);

  useEffect(() => {
    if (!visible || selectedRadio) return;
    const ctrl = new AbortController();
    setRadiosLoading(true);
    setRadiosError('');
    void services.podcasts.radios(categoryId, 1, ctrl.signal, 24).then(res => {
      if (!ctrl.signal.aborted) setRadios(res.items);
    }).catch(e => {
      if (!ctrl.signal.aborted) setRadiosError(e instanceof Error ? e.message : '播客加载失败');
    }).finally(() => {
      if (!ctrl.signal.aborted) setRadiosLoading(false);
    });
    return () => ctrl.abort();
  }, [visible, categoryId, selectedRadio, services]);

  async function loadPrograms(radio: PodcastRadio, page = 1, append = false) {
    const ctrl = new AbortController();
    setProgramsLoading(true);
    setProgramsError('');
    try {
      const res = await services.podcasts.programs(radio.id, page, ctrl.signal, 30);
      setPrograms(prev => (append ? [...prev, ...res.programs] : res.programs));
      setProgramsTotal(res.total);
      setProgramsMore(res.hasMore);
      programPage.current = page;
    } catch (e) {
      setProgramsError(e instanceof Error ? e.message : '节目加载失败');
    } finally {
      setProgramsLoading(false);
    }
  }

  function openRadio(radio: PodcastRadio) {
    setSelectedRadio(radio);
    setPrograms([]);
    programPage.current = 1;
    void loadPrograms(radio, 1, false);
  }

  const softSurface = s.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.52)';
  const tracks = programs.map(p => p.track);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => (selectedRadio ? setSelectedRadio(null) : onClose())}>
      <View style={{ flex: 1, backgroundColor: theme.palette.background[0], paddingTop: insets.top + 8, paddingBottom: insets.bottom }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={selectedRadio ? '返回播客列表' : '关闭播客'}
            onPress={() => (selectedRadio ? setSelectedRadio(null) : onClose())}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: softSurface, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={20} color={s.ink} />
          </Pressable>
          <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: s.ink, marginHorizontal: 10 }}>
            {selectedRadio ? selectedRadio.title : '网易云播客'}
          </Text>
          <View style={{ width: 38 }} />
        </View>

        {selectedRadio ? (
          <FlatList
            data={programs}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 32, gap: 8 }}
            ListHeaderComponent={
              <View style={{ gap: 14, paddingBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={s.cardShadow}>
                    <Cover services={services} url={selectedRadio.artwork} size={108} radius={16} />
                  </View>
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text numberOfLines={2} style={{ color: s.ink, fontSize: 19, fontWeight: '700' }}>{selectedRadio.title}</Text>
                    <Text numberOfLines={1} style={{ color: s.muted, fontSize: 13 }}>{selectedRadio.creator}</Text>
                    <Text style={{ color: s.subtle, fontSize: 12 }}>
                      共 {programsTotal || selectedRadio.programCount || programs.length} 期节目
                      {selectedRadio.subCount ? ` · ${formatCount(selectedRadio.subCount)} 订阅` : ''}
                    </Text>
                  </View>
                </View>
                {!!selectedRadio.description && (
                  <Text numberOfLines={3} style={{ color: s.muted, fontSize: 13, lineHeight: 19 }}>{selectedRadio.description}</Text>
                )}
                {tracks.length > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => services.playTracks(tracks, 0)}
                    style={{ minHeight: 44, borderRadius: 14, backgroundColor: s.control, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <Ionicons name="play" size={16} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>顺序播放全部节目</Text>
                  </Pressable>
                )}
                {!!programsError && <Text style={{ color: s.accent, fontSize: 13 }}>{programsError}</Text>}
              </View>
            }
            renderItem={({ item, index }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => services.playTracks(tracks, index)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: softSurface }}
              >
                <Cover services={services} url={item.artwork} size={46} radius={10} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text numberOfLines={1} style={{ color: s.ink, fontSize: 14.5, fontWeight: '600' }}>{item.title}</Text>
                  <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12 }}>
                    {formatDuration(item.durationMs)}
                    {item.listenerCount !== undefined ? ` · ${formatCount(item.listenerCount)} 播放` : ''}
                  </Text>
                </View>
                <Ionicons name="play-circle-outline" size={22} color={s.accent} />
              </Pressable>
            )}
            ListFooterComponent={
              <View style={{ paddingVertical: 16, alignItems: 'center', gap: 10 }}>
                {programsLoading && <ActivityIndicator color={s.accent} />}
                {programsMore && !programsLoading && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => void loadPrograms(selectedRadio, programPage.current + 1, true)}
                    style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18, backgroundColor: softSurface }}
                  >
                    <Text style={{ color: s.ink, fontSize: 13, fontWeight: '600' }}>加载更多节目</Text>
                  </Pressable>
                )}
              </View>
            }
           showsVerticalScrollIndicator={false}/>
        ) : (
          <View style={{ flex: 1 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 12, gap: 8 }}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: !categoryId }}
                onPress={() => setCategoryId(undefined)}
                style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: !categoryId ? s.control : softSurface }}
              >
                <Text style={{ color: !categoryId ? '#FFFFFF' : s.ink, fontSize: 13, fontWeight: '600' }}>热门精选</Text>
              </Pressable>
              {categories.map(cat => {
                const active = categoryId === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => setCategoryId(cat.id)}
                    style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, backgroundColor: active ? s.control : softSurface }}
                  >
                    <Text style={{ color: active ? '#FFFFFF' : s.ink, fontSize: 13, fontWeight: '600' }}>{cat.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <FlatList
              data={radios}
              numColumns={2}
              keyExtractor={item => item.id}
              columnWrapperStyle={{ gap: 12 }}
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 32, gap: 14 }}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openRadio(item)}
                  style={{ flex: 1, gap: 6, padding: 10, borderRadius: 16, backgroundColor: softSurface }}
                >
                  <View style={s.cardShadow}>
                    <Cover services={services} url={item.artwork} size={146} radius={12} />
                  </View>
                  <Text numberOfLines={2} style={{ color: s.ink, fontSize: 14, fontWeight: '600', lineHeight: 19 }}>{item.title}</Text>
                  <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12 }}>
                    {item.creator}{item.programCount !== undefined ? ` · ${item.programCount} 期` : ''}
                  </Text>
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={{ paddingVertical: 40, alignItems: 'center', gap: 10 }}>
                  {radiosLoading ? <ActivityIndicator color={s.accent} /> : <Text style={{ color: s.muted, fontSize: 13 }}>{radiosError || '暂无播客内容'}</Text>}
                </View>
              }
             showsVerticalScrollIndicator={false}/>
          </View>
        )}
      </View>
    </Modal>
  );
}
