import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import type { VideoItem } from '../providers/videos.ts';
import { Modal } from './AdaptiveModal.tsx';
import { Cover } from './Cover.tsx';
import { videoDuration } from './MVDetail.tsx';
import { Text } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { sollinTokens } from './tokens.ts';

export type MVPlazaTab = 'all' | 'latest' | 'top';

const AREAS = ['全部', '内地', '港台', '欧美', '日本', '韩国'] as const;
const ORDERS = ['最热', '最新', '上升最快'] as const;

function formatPlayCount(n?: number): string {
  if (!n || n <= 0) return '';
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}亿`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return String(n);
}

export function MVPlazaModal({
  services,
  visible,
  initialTab = 'all',
  onClose,
  onSelectMV,
}: {
  services: Services;
  visible: boolean;
  initialTab?: MVPlazaTab;
  onClose: () => void;
  onSelectMV: (mv: VideoItem) => void;
}) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [tab, setTab] = useState<MVPlazaTab>(initialTab);
  const [area, setArea] = useState<string>('全部');
  const [order, setOrder] = useState<string>('最热');
  const [items, setItems] = useState<readonly VideoItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (visible) setTab(initialTab);
  }, [visible, initialTab]);

  async function load(nextPage = 1, append = false) {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    setError('');
    try {
      if (tab === 'latest') {
        const list = await services.videos.latestNetease(ctrl.signal, 30);
        if (ctrl.signal.aborted) return;
        setItems(list);
        setPage(1);
        setHasMore(false);
      } else if (tab === 'top') {
        const list = await services.videos.topNetease(ctrl.signal, 50);
        if (ctrl.signal.aborted) return;
        setItems(list);
        setPage(1);
        setHasMore(false);
      } else {
        const res = await services.videos.allNetease({ area, order, page: nextPage, limit: 20 }, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setItems(prev => (append ? [...new Map([...prev, ...res.items].map(v => [v.id, v])).values()] : res.items));
        setPage(res.page);
        setHasMore(res.hasMore);
      }
    } catch (e) {
      if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'MV 列表加载失败，请重试');
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (!visible) return;
    void load(1, false);
    return () => {
      abortRef.current?.abort();
    };
  }, [visible, tab, area, order]);

  const cardWidth = Math.max(140, Math.floor((Math.min(width, 900) - 52) / 2));
  const cardHeight = Math.round((cardWidth * 9) / 16);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <LinearGradient colors={[...s.sheetGradient]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />

        {/* Header */}
        <View style={{ paddingTop: Math.max(insets.top + 8, 50), paddingHorizontal: 18, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            testID="mv-plaza-back"
            accessibilityRole="button"
            accessibilityLabel="返回发现"
            onPress={onClose}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: s.chip, borderWidth: 1, borderColor: s.chipBorder, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={20} color={s.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: s.ink, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 }}>MV 广场</Text>
            <Text style={{ color: s.muted, fontSize: 12 }}>网易云公开精选 MV 目录</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="刷新MV列表"
            onPress={() => void load(1, false)}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: s.chip, borderWidth: 1, borderColor: s.chipBorder, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="refresh" size={18} color={s.ink} />
          </Pressable>
        </View>

        {/* Mode tabs */}
        <View style={{ paddingHorizontal: 18, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, gap: 4 }}>
            {([['all', '全部 MV'], ['latest', '最新 MV'], ['top', 'MV 排行']] as const).map(([key, label]) => {
              const active = tab === key;
              return (
                <Pressable
                  key={key}
                  testID={`mv-plaza-tab-${key}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setTab(key)}
                  style={{ flex: 1, minHeight: 36, borderRadius: 12, backgroundColor: active ? s.accentSoft : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: active ? s.accent : s.muted, fontSize: 13.5, fontWeight: active ? '700' : '500' }}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Area & Order filters when on 'all' tab */}
        {tab === 'all' && (
          <View style={{ gap: 6, paddingBottom: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}>
              {AREAS.map(a => {
                const active = area === a;
                return (
                  <Pressable
                    key={a}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => setArea(a)}
                    style={{ paddingHorizontal: 13, paddingVertical: 6, borderRadius: 14, backgroundColor: active ? s.control : s.chip, borderWidth: 1, borderColor: active ? s.control : s.chipBorder }}
                  >
                    <Text style={{ color: active ? '#FFFFFF' : s.ink, fontSize: 12.5, fontWeight: active ? '700' : '500' }}>{a}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, gap: 8 }}>
              {ORDERS.map(o => {
                const active = order === o;
                return (
                  <Pressable
                    key={o}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => setOrder(o)}
                    style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: 12, backgroundColor: active ? s.accentSoft : 'transparent', borderWidth: 1, borderColor: active ? s.accent + '55' : s.cardBorder }}
                  >
                    <Text style={{ color: active ? s.accent : s.muted, fontSize: 12, fontWeight: active ? '700' : '500' }}>{o}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={item => item.id}
          columnWrapperStyle={{ gap: 12, paddingHorizontal: 18 }}
          contentContainerStyle={{ gap: 14, paddingTop: 6, paddingBottom: Math.max(insets.bottom + 28, 40) }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            !!error ? (
              <View style={{ paddingHorizontal: 18, paddingBottom: 6 }}>
                <Text style={{ color: s.accent, fontSize: 13 }}>{error}</Text>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <Pressable
              testID={`mv-plaza-item-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`播放MV：${item.title}`}
              onPress={() => onSelectMV(item)}
              style={{ width: cardWidth, gap: 6 }}
            >
              <View style={[{ width: cardWidth, height: cardHeight, borderRadius: 14, overflow: 'hidden', backgroundColor: '#161922', position: 'relative' }, s.cardShadow]}>
                <Cover services={services} url={item.artwork} size={cardWidth} aspectRatio={16 / 9} radius={14} />
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.58)']}
                  style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 42 }}
                />
                {tab === 'top' && (
                  <View style={{ position: 'absolute', top: 7, left: 7, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: index < 3 ? '#E83D56' : 'rgba(0,0,0,0.55)' }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{String(index + 1).padStart(2, '0')}</Text>
                  </View>
                )}
                <View style={{ position: 'absolute', left: 8, right: 8, bottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  {item.playCount ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Ionicons name="play" size={10} color="#FFFFFF" />
                      <Text style={{ color: '#FFFFFF', fontSize: 10.5, fontWeight: '600' }}>{formatPlayCount(item.playCount)}</Text>
                    </View>
                  ) : <View />}
                  {item.durationSeconds ? (
                    <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 10.5, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{videoDuration(item.durationSeconds)}</Text>
                  ) : null}
                </View>
              </View>
              <Text numberOfLines={1} style={{ color: s.ink, fontSize: 13.5, fontWeight: '600' }}>{item.title}</Text>
              {!!item.author && <Text numberOfLines={1} style={{ color: s.muted, fontSize: 11.5 }}>{item.author}</Text>}
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={{ paddingVertical: 56, alignItems: 'center', gap: 10 }}>
              {loading ? <ActivityIndicator color={s.accent} /> : <Text style={{ color: s.muted, fontSize: 13.5 }}>暂无 MV 内容</Text>}
            </View>
          }
          ListFooterComponent={
            hasMore ? (
              <View style={{ alignItems: 'center', paddingTop: 6 }}>
                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={() => void load(page + 1, true)}
                  style={{ paddingHorizontal: 22, minHeight: 40, borderRadius: 20, backgroundColor: s.chip, borderWidth: 1, borderColor: s.chipBorder, flexDirection: 'row', alignItems: 'center', gap: 8, opacity: loading ? 0.55 : 1 }}
                >
                  {loading && <ActivityIndicator size="small" color={s.accent} />}
                  <Text style={{ color: s.ink, fontSize: 13.5, fontWeight: '600' }}>{loading ? '加载中…' : '加载更多 MV'}</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      </View>
    </Modal>
  );
}
