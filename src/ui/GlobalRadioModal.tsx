import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, View, type ViewProps } from 'react-native';
import { requireNativeView } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import {
  distanceKm,
  RADIO_GLOBE_HTML,
  stationToTrack,
  type RadioFacet,
  type RadioStation,
} from '../providers/globalRadio.ts';
import { Modal } from './AdaptiveModal.tsx';
import { Text, TextInput } from './Typography.tsx';

type FacetKind = 'countries' | 'states' | 'languages' | 'tags' | 'codecs';
type DrawerTab = 'discover' | 'favorites' | 'recent';

const NativeRadioGlobe = requireNativeView<
  ViewProps & {
    html: string;
    pointsJson: string;
    commandJson: string;
    onSelect: (event: { nativeEvent: { type?: string; uuid?: string; lat?: number; lng?: number } }) => void;
  }
>('NexusNative', 'RadioGlobe');

const FACET_LABELS: Record<FacetKind, string> = {
  countries: '国家/地区',
  states: '州/省',
  languages: '语言',
  tags: '内容分类',
  codecs: '编码',
};

export function GlobalRadioModal({
  services,
  visible,
  onClose,
}: {
  services: Services;
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const radioState = useSyncExternalStore(services.radioStore.subscribe, services.radioStore.getSnapshot);

  const [tab, setTab] = useState<DrawerTab>('discover');
  const [listOnly, setListOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Partial<Record<FacetKind, { label: string; value: string }>>>({});
  const [stations, setStations] = useState<readonly RadioStation[]>([]);
  const [selected, setSelected] = useState<RadioStation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [commandJson, setCommandJson] = useState('');

  const [pickerKind, setPickerKind] = useState<FacetKind | null>(null);
  const [facetItems, setFacetItems] = useState<readonly RadioFacet[]>([]);
  const [facetLoading, setFacetLoading] = useState(false);
  const cmdSeq = useRef(0);
  const searchAbort = useRef<AbortController | null>(null);

  const sendCommand = (cmd: Record<string, unknown>) => {
    cmdSeq.current += 1;
    setCommandJson(JSON.stringify({ ...cmd, _seq: cmdSeq.current }));
  };

  async function fetchStations() {
    searchAbort.current?.abort();
    const ctrl = new AbortController();
    searchAbort.current = ctrl;
    setLoading(true);
    setError('');
    try {
      const list = await services.radioApi.search(
        {
          name: query.trim() || undefined,
          countryCode: filters.countries?.value,
          state: filters.states?.value,
          language: filters.languages?.value,
          tag: filters.tags?.value,
          codec: filters.codecs?.value,
          hasGeoInfo: !query.trim() && !Object.keys(filters).length,
          limit: 120,
        },
        ctrl.signal,
      );
      if (ctrl.signal.aborted) return;
      setStations(list);
      if (list.length > 0 && (!selected || !list.some(s => s.uuid === selected.uuid))) {
        setSelected(list[0]!);
      }
    } catch (e) {
      if (!ctrl.signal.aborted) {
        setError(e instanceof Error ? e.message : '全球电台加载失败，请重试');
      }
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (!visible) return;
    void fetchStations();
    return () => {
      searchAbort.current?.abort();
    };
  }, [visible, filters]);

  async function openFacetPicker(kind: FacetKind) {
    setPickerKind(kind);
    setFacetLoading(true);
    setFacetItems([]);
    const ctrl = new AbortController();
    try {
      const list = await services.radioApi.facets(kind, ctrl.signal, filters.countries?.label);
      setFacetItems(list);
    } catch {
      setFacetItems([]);
    } finally {
      setFacetLoading(false);
    }
  }

  function playStation(station: RadioStation) {
    setSelected(station);
    if (station.lat !== undefined && station.lng !== undefined) {
      sendCommand({ type: 'focus', lat: station.lat, lng: station.lng, zoom: 1.45 });
    }
    void services.radioStore.recordRecent(station).catch(() => {});
    void services.radioApi.reportClick(station.uuid, new AbortController().signal).catch(() => {});
    services.playTracks([stationToTrack(station)], 0);
  }

  function roamRandom() {
    const pool = stations.length ? stations : radioState.favorites;
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)]!;
    playStation(pick);
  }

  const visibleList = useMemo(() => {
    if (tab === 'favorites') return radioState.favorites;
    if (tab === 'recent') return radioState.recent;
    return stations;
  }, [tab, stations, radioState.favorites, radioState.recent]);

  const pointsJson = useMemo(() => {
    const geoPoints = stations
      .filter(s => s.lat !== undefined && s.lng !== undefined)
      .slice(0, 200)
      .map(s => ({ id: s.uuid, name: s.name, lat: s.lat!, lng: s.lng! }));
    return JSON.stringify({ points: geoPoints, selected: selected?.uuid ?? '' });
  }, [stations, selected?.uuid]);

  const featuredStation = selected ?? visibleList[0] ?? null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top + 6, paddingBottom: insets.bottom }]}>
        {/* Top bar matching Sollin Global Radio dark-teal aesthetic */}
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭全球电台" onPress={onClose} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={22} color="#EBF4F6" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>全球电台</Text>
            <Text style={styles.headerSub}>转动地球，听见世界</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="随机调频" onPress={roamRandom} style={styles.iconBtn}>
            <Ionicons name="shuffle" size={19} color="#5CE5CF" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={listOnly ? '显示3D地球' : '纯列表模式'} onPress={() => setListOnly(v => !v)} style={styles.iconBtn}>
            <Ionicons name={listOnly ? 'earth-outline' : 'list-outline'} size={20} color="#EBF4F6" />
          </Pressable>
        </View>

        {/* Search input */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={17} color="#7B9BA8" />
          <TextInput
            accessibilityLabel="搜索全球电台"
            placeholder="搜索电台，探索世界"
            placeholderTextColor="#7B9BA8"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void fetchStations()}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {!!query && (
            <Pressable accessibilityRole="button" onPress={() => { setQuery(''); setTimeout(() => void fetchStations(), 0); }} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={16} color="#7B9BA8" />
            </Pressable>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel="执行搜索" onPress={() => void fetchStations()} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
            <Ionicons name="options-outline" size={17} color="#5CE5CF" />
          </Pressable>
        </View>

        {/* 5 Filter Facet Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.facetsRow}>
          {(['countries', 'states', 'languages', 'tags', 'codecs'] as const).map(kind => {
            const active = filters[kind];
            return (
              <Pressable
                key={kind}
                accessibilityRole="button"
                onPress={() => void openFacetPicker(kind)}
                style={[styles.facetChip, active && styles.facetChipActive]}
              >
                <Text numberOfLines={1} style={[styles.facetText, active && { color: '#5CE5CF', fontWeight: '700' }]}>
                  {active ? active.label : FACET_LABELS[kind]}
                </Text>
                <Ionicons name="chevron-down" size={12} color={active ? '#5CE5CF' : '#8BAAB7'} />
              </Pressable>
            );
          })}
          {Object.keys(filters).length > 0 && (
            <Pressable accessibilityRole="button" onPress={() => setFilters({})} style={[styles.facetChip, { borderColor: '#5CE5CF66' }]}>
              <Text style={{ color: '#5CE5CF', fontSize: 12, fontWeight: '600' }}>清空筛选</Text>
            </Pressable>
          )}
        </ScrollView>

        {/* 3D Interactive Globe Area */}
        {!listOnly && (
          <View style={styles.globeStage}>
            <NativeRadioGlobe
              html={RADIO_GLOBE_HTML}
              pointsJson={pointsJson}
              commandJson={commandJson}
              onSelect={event => {
                const ev = event.nativeEvent;
                if (ev.type === 'station' && ev.uuid) {
                  const hit = stations.find(s => s.uuid === ev.uuid);
                  if (hit) setSelected(hit);
                } else if (ev.type === 'area' && typeof ev.lat === 'number' && typeof ev.lng === 'number') {
                  const ranked = stations
                    .filter(s => s.lat !== undefined && s.lng !== undefined)
                    .map(s => ({ s, d: distanceKm(ev.lat!, ev.lng!, s.lat!, s.lng!) }))
                    .sort((a, b) => a.d - b.d);
                  if (ranked[0]) setSelected(ranked[0].s);
                }
              }}
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={styles.globeBadge}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#5CE5CF' }} />
              <Text style={{ color: '#C6DDE4', fontSize: 12, fontWeight: '600' }}>
                {loading ? '正在发现电台…' : `已发现电台 · ${stations.length}`}
              </Text>
            </View>
            <View style={styles.globeControls}>
              <Pressable accessibilityRole="button" accessibilityLabel="放大地球" onPress={() => sendCommand({ type: 'zoom', factor: 1.25 })} style={styles.globeCtrlBtn}>
                <Ionicons name="add" size={19} color="#EBF4F6" />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="缩小地球" onPress={() => sendCommand({ type: 'zoom', factor: 0.8 })} style={styles.globeCtrlBtn}>
                <Ionicons name="remove" size={19} color="#EBF4F6" />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="重置地球视角" onPress={() => sendCommand({ type: 'reset' })} style={styles.globeCtrlBtn}>
                <Ionicons name="earth" size={17} color="#EBF4F6" />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="随机定位电台" onPress={roamRandom} style={styles.globeCtrlBtn}>
                <Ionicons name="locate" size={18} color="#5CE5CF" />
              </Pressable>
            </View>
          </View>
        )}

        {/* Bottom Drawer Panel: 发现 | 收藏 | 最近 */}
        <View style={styles.drawer}>
          <View style={styles.drawerHandle} />
          <View style={styles.drawerTabsRow}>
            <View style={styles.drawerTabs}>
              {([['discover', '发现'], ['favorites', `收藏 (${radioState.favorites.length})`], ['recent', '最近']] as const).map(([key, label]) => {
                const active = tab === key;
                return (
                  <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => setTab(key)} style={[styles.drawerTab, active && styles.drawerTabActive]}>
                    <Text style={{ color: active ? '#5CE5CF' : '#96B0BC', fontSize: 13.5, fontWeight: active ? '700' : '500' }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="刷新电台" onPress={() => void fetchStations()} style={{ padding: 6 }}>
              <Ionicons name="refresh" size={17} color="#8BAAB7" />
            </Pressable>
          </View>

          <FlatList
            data={visibleList}
            keyExtractor={item => item.uuid}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
            ListHeaderComponent={
              <>
                {!!error && <Text style={{ color: '#FF8A80', fontSize: 12.5, marginBottom: 6 }}>{error}</Text>}
                {tab === 'discover' && featuredStation && (
                  <View style={styles.tunedCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={styles.tunedIcon}>
                        <Ionicons name="radio" size={22} color="#5CE5CF" />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ color: '#5CE5CF', fontSize: 11, fontWeight: '700' }}>为你调频</Text>
                        <Text numberOfLines={1} style={{ color: '#F2F9FA', fontSize: 16, fontWeight: '700' }}>{featuredStation.name}</Text>
                        <Text numberOfLines={1} style={{ color: '#9BB4BF', fontSize: 12 }}>
                          {[featuredStation.country, featuredStation.state].filter(Boolean).join(' · ') || '全球广播'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                      <Text style={{ color: '#86A3B0', fontSize: 12 }}>
                        {featuredStation.codec}{featuredStation.bitrate > 0 ? ` · ${featuredStation.bitrate} kbps` : ''}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="电台详情"
                          onPress={() =>
                            Alert.alert(
                              featuredStation.name,
                              `国家/地区：${featuredStation.country || '未知'}\n语言：${featuredStation.language || '未知'}\n编码：${featuredStation.codec} ${featuredStation.bitrate ? `${featuredStation.bitrate}kbps` : ''}\n标签：${featuredStation.tags.join(' / ') || '无'}`,
                            )
                          }
                          style={styles.tunedActionIcon}
                        >
                          <Ionicons name="information-circle-outline" size={20} color="#C3DCE4" />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="收藏电台"
                          onPress={() => void services.radioStore.toggleFavorite(featuredStation)}
                          style={styles.tunedActionIcon}
                        >
                          <Ionicons name={services.radioStore.isFavorite(featuredStation.uuid) ? 'heart' : 'heart-outline'} size={19} color={services.radioStore.isFavorite(featuredStation.uuid) ? '#FF6B81' : '#C3DCE4'} />
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`播放电台 ${featuredStation.name}`}
                          onPress={() => playStation(featuredStation)}
                          style={styles.playCircle}
                        >
                          <Ionicons name="play" size={18} color="#082028" />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                )}
              </>
            }
            renderItem={({ item }) => {
              const fav = services.radioStore.isFavorite(item.uuid);
              const isSelected = selected?.uuid === item.uuid;
              return (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => playStation(item)}
                  style={[styles.stationRow, isSelected && { borderColor: '#5CE5CF66', backgroundColor: '#132D3B' }]}
                >
                  <View style={styles.stationBadge}>
                    <Ionicons name="radio-outline" size={17} color="#5CE5CF" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text numberOfLines={1} style={{ color: '#EDF6F8', fontSize: 14.5, fontWeight: '600' }}>{item.name}</Text>
                    <Text numberOfLines={1} style={{ color: '#8CA7B4', fontSize: 12 }}>
                      {[item.country, item.codec, item.bitrate > 0 ? `${item.bitrate}kbps` : ''].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => void services.radioStore.toggleFavorite(item)} style={{ padding: 6 }}>
                    <Ionicons name={fav ? 'heart' : 'heart-outline'} size={18} color={fav ? '#FF6B81' : '#7E9AA7'} />
                  </Pressable>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={{ paddingVertical: 28, alignItems: 'center' }}>
                {loading ? <ActivityIndicator color="#5CE5CF" /> : <Text style={{ color: '#7D9AA7', fontSize: 13 }}>{tab === 'favorites' ? '暂无收藏电台' : tab === 'recent' ? '暂无最近收听记录' : '暂无匹配电台'}</Text>}
              </View>
            }
          />
        </View>

        {/* Facet Picker Sheet */}
        {pickerKind && (
          <View style={styles.pickerOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setPickerKind(null)} />
            <View style={styles.pickerSheet}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ color: '#EDF6F8', fontSize: 16, fontWeight: '700' }}>选择{FACET_LABELS[pickerKind]}</Text>
                <Pressable onPress={() => { setFilters(prev => { const next = { ...prev }; delete next[pickerKind]; return next; }); setPickerKind(null); }}>
                  <Text style={{ color: '#5CE5CF', fontSize: 13, fontWeight: '600' }}>不限</Text>
                </Pressable>
              </View>
              {facetLoading ? (
                <ActivityIndicator color="#5CE5CF" style={{ marginVertical: 24 }} />
              ) : (
                <FlatList
                  data={facetItems}
                  keyExtractor={item => `${item.value}-${item.name}`}
                  style={{ maxHeight: 340 }}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => {
                        setFilters(prev => ({ ...prev, [pickerKind]: { label: item.name, value: item.value } }));
                        setPickerKind(null);
                      }}
                      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' }}
                    >
                      <Text numberOfLines={1} style={{ color: '#E8F3F5', fontSize: 14, flex: 1 }}>{item.name}</Text>
                      <Text style={{ color: '#7E9CA9', fontSize: 12 }}>{item.stationCount}</Text>
                    </Pressable>
                  )}
                />
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07121E' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 10 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  headerTitle: { color: '#F0F7F9', fontSize: 18, fontWeight: '700' },
  headerSub: { color: '#7D9AA7', fontSize: 11.5 },
  searchBar: { marginHorizontal: 14, height: 42, borderRadius: 21, paddingHorizontal: 14, backgroundColor: '#102130', borderWidth: 1, borderColor: 'rgba(120,185,205,0.18)', flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchInput: { flex: 1, color: '#EEF6F8', fontSize: 14, paddingVertical: 0 },
  facetsRow: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, alignItems: 'center' },
  facetChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#0F202E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  facetChipActive: { backgroundColor: '#13313C', borderColor: 'rgba(92,229,207,0.45)' },
  facetText: { color: '#C1D8E0', fontSize: 12.5, maxWidth: 110 },
  globeStage: { height: 268, width: '100%', position: 'relative', overflow: 'hidden' },
  globeBadge: { position: 'absolute', left: 14, top: 8, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(7,18,30,0.68)' },
  globeControls: { position: 'absolute', right: 12, top: 28, gap: 6, padding: 5, borderRadius: 18, backgroundColor: 'rgba(13,29,42,0.78)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  globeCtrlBtn: { width: 34, height: 34, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  drawer: { flex: 1, backgroundColor: '#0C1A24', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)', paddingTop: 8 },
  drawerHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', alignSelf: 'center', marginBottom: 8 },
  drawerTabsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  drawerTabs: { flexDirection: 'row', gap: 6 },
  drawerTab: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 15 },
  drawerTabActive: { backgroundColor: '#13313C' },
  tunedCard: { padding: 14, borderRadius: 18, backgroundColor: '#132B34', borderWidth: 1, borderColor: 'rgba(92,229,207,0.22)', marginBottom: 4 },
  tunedIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(92,229,207,0.14)', alignItems: 'center', justifyContent: 'center' },
  tunedActionIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' },
  playCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6BE3C8', alignItems: 'center', justifyContent: 'center', paddingLeft: 2 },
  stationRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 11, borderRadius: 14, backgroundColor: '#10222E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  stationBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(92,229,207,0.1)', alignItems: 'center', justifyContent: 'center' },
  pickerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: '#0F202D', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 32 },
});
