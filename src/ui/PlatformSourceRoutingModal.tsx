import { useState, useSyncExternalStore } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PreferenceStore } from '../app/preferences.ts';
import {
  applyPlatformSourceRouting,
  clearPlatformSourceRule,
  countPlatformRoutingCustomizations,
  moveSourcePriorityForPlatform,
  pinSourceTopForPlatform,
  setSourceExcludedForPlatform,
} from '../domain/platformRouting.ts';
import type { MusicPlatform } from '../domain/track.ts';
import type { SourceCatalog, SourceView } from '../providers/sourceCatalog.ts';
import { SheetModal } from './AdaptiveModal.tsx';
import { PlatformLogo } from './PlatformLogo.tsx';
import { Text } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { sollinTokens } from './tokens.ts';

export const ALL_MUSIC_PLATFORM_ITEMS: readonly {
  readonly id: MusicPlatform;
  readonly label: string;
  readonly short: string;
  readonly directLx: boolean;
}[] = [
  { id: 'wy', label: '网易云音乐', short: '网易云', directLx: true },
  { id: 'tx', label: 'QQ 音乐', short: 'QQ', directLx: true },
  { id: 'kw', label: '酷我音乐', short: '酷我', directLx: true },
  { id: 'kg', label: '酷狗音乐', short: '酷狗', directLx: true },
  { id: 'mg', label: '咪咕音乐', short: '咪咕', directLx: true },
  { id: 'qishui', label: '汽水音乐', short: '汽水', directLx: false },
  { id: 'bodian', label: '波点音乐', short: '波点', directLx: false },
];

const SHORT_PLATFORM_NAMES: Record<MusicPlatform, string> = {
  wy: '网易云',
  tx: 'QQ',
  kw: '酷我',
  kg: '酷狗',
  mg: '咪咕',
  qishui: '汽水',
  bodian: '波点',
};

export function formatDeclaredPlatforms(source: SourceView): string {
  const platforms = [
    ...new Set(
      source.capabilities
        .filter(cap => cap.actions.includes('musicUrl'))
        .map(cap => SHORT_PLATFORM_NAMES[cap.platform]),
    ),
  ];
  return platforms.length ? `支持 ${platforms.join('·')}` : '';
}

export function PlatformSourceRoutingModal({
  catalog,
  preferences,
  visible,
  initialPlatform = 'wy',
  onClose,
}: {
  catalog: SourceCatalog;
  preferences: PreferenceStore;
  visible: boolean;
  initialPlatform?: MusicPlatform;
  onClose: () => void;
}) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);
  const sources = useSyncExternalStore(catalog.subscribe, catalog.getSnapshot);
  const prefs = useSyncExternalStore(preferences.subscribe, preferences.getSnapshot);
  const [platform, setPlatform] = useState<MusicPlatform>(initialPlatform);
  const [error, setError] = useState('');

  const routing = prefs.platformSourceRouting;
  const knownIds = new Set(sources.map(item => item.id));
  const currentMeta = ALL_MUSIC_PLATFORM_ITEMS.find(item => item.id === platform)!;
  const currentRule = routing[platform];
  const currentStats = countPlatformRoutingCustomizations(currentRule, knownIds);

  const excludedSet = new Set(currentRule?.excluded ?? []);
  const allowedSources = applyPlatformSourceRouting(sources, platform, routing);
  const excludedSources = sources.filter(item => excludedSet.has(item.id));
  const allowedOrderIds = allowedSources.map(item => item.id);

  const saveRouting = (next: typeof routing) => {
    setError('');
    void preferences.update({ platformSourceRouting: next }).catch(() => {
      setError('分平台音源配置未保存，请重试。');
    });
  };

  const okColor = s.dark ? '#5EE0A0' : '#1D8A56';
  const warnColor = s.dark ? '#FFB86C' : '#B8640B';
  const warnBg = s.dark ? 'rgba(255,184,108,0.14)' : 'rgba(184,100,11,0.10)';
  const dangerColor = '#E53935';
  const dangerBg = s.dark ? 'rgba(229,57,53,0.18)' : 'rgba(229,57,53,0.10)';

  const supportsSelectedPlatform = (source: SourceView): 'yes' | 'no' | 'unknown' => {
    if (!currentMeta.directLx) return 'unknown';
    if (source.status !== 'ready') return 'unknown';
    return source.capabilities.some(
      cap => cap.platform === platform && cap.actions.includes('musicUrl'),
    )
      ? 'yes'
      : 'no';
  };

  return (
    <SheetModal allowSwipeDismissal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: s.sheetGradient[0] }} edges={['bottom']}>
        <LinearGradient
          pointerEvents="none"
          colors={[...s.sheetGradient]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={{
            alignSelf: 'center',
            width: 38,
            height: 4.5,
            borderRadius: 2.25,
            backgroundColor: s.subtle + '66',
            marginTop: 10,
            marginBottom: 4,
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingTop: 6,
            paddingBottom: 10,
            gap: 12,
          }}
        >
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text accessibilityRole="header" style={{ color: s.ink, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 }}>
              分平台音源优先级与排除
            </Text>
            <Text style={{ color: s.muted, fontSize: 12, lineHeight: 17 }}>
              为 7 个平台单独指定优先顺序与禁用脚本，不打乱全局顺序
            </Text>
          </View>
          <Pressable
            testID="platform-routing-close"
            accessibilityRole="button"
            accessibilityLabel="关闭分平台音源配置"
            onPress={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: s.chip,
              borderWidth: 1,
              borderColor: s.chipBorder,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={20} color={s.ink} />
          </Pressable>
        </View>

        {/* 7-platform selector strip */}
        <View style={{ paddingBottom: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          >
            {ALL_MUSIC_PLATFORM_ITEMS.map(item => {
              const selected = platform === item.id;
              const stats = countPlatformRoutingCustomizations(routing[item.id], knownIds);
              return (
                <Pressable
                  key={item.id}
                  testID={`routing-platform-tab-${item.id}`}
                  accessibilityRole="tab"
                  accessibilityLabel={`${item.label}音源路由`}
                  accessibilityState={{ selected }}
                  onPress={() => setPlatform(item.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 18,
                    backgroundColor: selected ? s.control : s.card,
                    borderWidth: 1,
                    borderColor: selected ? s.control : s.cardBorder,
                  }}
                >
                  <PlatformLogo platform={item.id} size={18} />
                  <Text
                    style={{
                      color: selected ? '#FFFFFF' : s.ink,
                      fontSize: 13,
                      fontWeight: selected ? '700' : '600',
                    }}
                  >
                    {item.short}
                  </Text>
                  {stats.hasCustom && (
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: selected ? '#FFFFFF' : s.accent,
                      }}
                    />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 38, gap: 12 }}
        >
          {/* Guidance banner */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 8,
              padding: 12,
              borderRadius: 16,
              backgroundColor: s.dark ? 'rgba(255,255,255,0.045)' : 'rgba(42,36,31,0.035)',
            }}
          >
            <Ionicons name="information-circle-outline" size={16} color={s.subtle} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, color: s.muted, fontSize: 12, lineHeight: 18 }}>
              {currentMeta.directLx
                ? `${currentMeta.label}解析时将优先按下方顺序调用自定义 LX 音源；加入「已排除」的脚本在本平台绝不会触发。`
                : `${currentMeta.label}优先走官方与账号直连播放；当歌曲受限需回退 LX 音源跨平台换源时，按下方顺序与排除列表执行。`}
            </Text>
          </View>

          {/* Status & reset bar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 }}>
            <Text style={{ color: s.muted, fontSize: 12.5, fontWeight: '600' }}>
              {currentMeta.label} · 参与 {allowedSources.length} 个 · 已排除 {excludedSources.length} 个
            </Text>
            {currentStats.hasCustom && (
              <Pressable
                testID={`routing-reset-${platform}`}
                accessibilityRole="button"
                accessibilityLabel={`恢复${currentMeta.label}为全局默认顺序`}
                onPress={() => saveRouting(clearPlatformSourceRule(routing, platform))}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 12,
                  backgroundColor: s.chip,
                  borderWidth: 1,
                  borderColor: s.chipBorder,
                }}
              >
                <Text style={{ color: s.control, fontSize: 12, fontWeight: '600' }}>恢复全局默认</Text>
              </Pressable>
            )}
          </View>

          {!!error && (
            <Text accessibilityRole="alert" style={{ color: dangerColor, fontSize: 12.5 }}>
              {error}
            </Text>
          )}

          {sources.length === 0 ? (
            <View
              style={[
                {
                  padding: 26,
                  borderRadius: 20,
                  backgroundColor: s.card,
                  borderWidth: 1,
                  borderColor: s.cardBorder,
                  alignItems: 'center',
                  gap: 8,
                },
                s.cardShadow,
              ]}
            >
              <Ionicons name="radio-outline" size={30} color={s.subtle} />
              <Text style={{ color: s.ink, fontSize: 15, fontWeight: '700' }}>尚未导入自定义 LX 音源</Text>
              <Text style={{ color: s.muted, fontSize: 12.5, textAlign: 'center', lineHeight: 18 }}>
                请先在「音乐来源 → LX 音源」中导入脚本，再为各平台定制优先级或排除规则。
              </Text>
            </View>
          ) : (
            <>
              {/* Active / allowed priority list */}
              <View style={{ gap: 6 }}>
                <Text style={{ color: s.muted, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                  优先调用顺序（从上到下依次尝试）
                </Text>
                {allowedSources.length === 0 ? (
                  <View
                    style={[
                      {
                        padding: 18,
                        borderRadius: 18,
                        backgroundColor: s.card,
                        borderWidth: 1,
                        borderColor: s.cardBorder,
                        alignItems: 'center',
                        gap: 4,
                      },
                      s.cardShadow,
                    ]}
                  >
                    <Text style={{ color: s.ink, fontSize: 14, fontWeight: '600' }}>
                      当前平台已排除全部自定义 LX 音源
                    </Text>
                    <Text style={{ color: s.muted, fontSize: 12, textAlign: 'center' }}>
                      播放此平台曲目时仅使用官方/账号直连，如需使用 LX 音源请在下方恢复。
                    </Text>
                  </View>
                ) : (
                  <View
                    style={[
                      {
                        borderRadius: 20,
                        backgroundColor: s.card,
                        borderWidth: 1,
                        borderColor: s.cardBorder,
                        overflow: 'hidden',
                      },
                      s.cardShadow,
                    ]}
                  >
                    {allowedSources.map((source, index) => {
                      const support = supportsSelectedPlatform(source);
                      const declared = formatDeclaredPlatforms(source);
                      const isPinnedFirst = index === 0 && currentStats.priorityCount > 0;
                      return (
                        <View key={source.id}>
                          {index > 0 && (
                            <View
                              accessible={false}
                              style={{ height: StyleSheet.hairlineWidth, marginLeft: 48, backgroundColor: s.hairline }}
                            />
                          )}
                          <View
                            testID={`routing-allowed-${platform}-${source.id}`}
                            style={{
                              minHeight: 64,
                              paddingHorizontal: 14,
                              paddingVertical: 10,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 10,
                            }}
                          >
                            <View
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 12,
                                backgroundColor: isPinnedFirst ? s.accentSoft : s.chip,
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text
                                style={{
                                  color: isPinnedFirst ? s.control : s.muted,
                                  fontSize: 12,
                                  fontWeight: '700',
                                  fontVariant: ['tabular-nums'],
                                }}
                              >
                                {index + 1}
                              </Text>
                            </View>

                            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text numberOfLines={1} style={{ color: s.ink, fontSize: 14.5, fontWeight: '700', flexShrink: 1 }}>
                                  {source.displayName}
                                </Text>
                                {source.status === 'ready' ? (
                                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: okColor }} />
                                ) : (
                                  <View style={{ paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6, backgroundColor: s.chip }}>
                                    <Text style={{ color: s.muted, fontSize: 10, fontWeight: '600' }}>
                                      {source.enabled ? '未就绪' : '未启用'}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                {support === 'no' ? (
                                  <View style={{ paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 6, backgroundColor: warnBg }}>
                                    <Text style={{ color: warnColor, fontSize: 10.5, fontWeight: '600' }}>
                                      脚本未声明支持 {currentMeta.short}
                                    </Text>
                                  </View>
                                ) : null}
                                <Text numberOfLines={1} style={{ color: s.muted, fontSize: 11.5, flexShrink: 1 }}>
                                  {declared || (source.enabled ? '已启用 · 待声明平台' : '未启用脚本')}
                                </Text>
                              </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              {index > 0 && (
                                <Pressable
                                  testID={`routing-pin-${platform}-${source.id}`}
                                  accessibilityRole="button"
                                  accessibilityLabel={`置顶 ${source.displayName}`}
                                  onPress={() =>
                                    saveRouting(
                                      pinSourceTopForPlatform(routing, platform, source.id, allowedOrderIds),
                                    )
                                  }
                                  style={{
                                    width: 30,
                                    height: 30,
                                    borderRadius: 15,
                                    backgroundColor: s.chip,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Ionicons name="arrow-up" size={14} color={s.control} />
                                </Pressable>
                              )}
                              <View style={{ width: 24, alignItems: 'center', gap: 2 }}>
                                <Pressable
                                  testID={`routing-up-${platform}-${source.id}`}
                                  accessibilityRole="button"
                                  accessibilityLabel={`上移 ${source.displayName}`}
                                  disabled={index === 0}
                                  onPress={() =>
                                    saveRouting(
                                      moveSourcePriorityForPlatform(routing, platform, source.id, allowedOrderIds, -1),
                                    )
                                  }
                                  style={{ opacity: index === 0 ? 0.25 : 1, padding: 2 }}
                                >
                                  <Ionicons name="chevron-up" size={14} color={s.muted} />
                                </Pressable>
                                <Pressable
                                  testID={`routing-down-${platform}-${source.id}`}
                                  accessibilityRole="button"
                                  accessibilityLabel={`下移 ${source.displayName}`}
                                  disabled={index === allowedSources.length - 1}
                                  onPress={() =>
                                    saveRouting(
                                      moveSourcePriorityForPlatform(routing, platform, source.id, allowedOrderIds, 1),
                                    )
                                  }
                                  style={{ opacity: index === allowedSources.length - 1 ? 0.25 : 1, padding: 2 }}
                                >
                                  <Ionicons name="chevron-down" size={14} color={s.muted} />
                                </Pressable>
                              </View>
                              <Pressable
                                testID={`routing-exclude-${platform}-${source.id}`}
                                accessibilityRole="button"
                                accessibilityLabel={`在${currentMeta.label}排除 ${source.displayName}`}
                                onPress={() =>
                                  saveRouting(setSourceExcludedForPlatform(routing, platform, source.id, true))
                                }
                                style={{
                                  paddingHorizontal: 9,
                                  paddingVertical: 6,
                                  borderRadius: 12,
                                  backgroundColor: dangerBg,
                                }}
                              >
                                <Text style={{ color: dangerColor, fontSize: 11.5, fontWeight: '700' }}>排除</Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* Excluded list */}
              {excludedSources.length > 0 && (
                <View style={{ gap: 6, marginTop: 4 }}>
                  <Text style={{ color: s.muted, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                    已排除音源（{currentMeta.short} 绝不调用）
                  </Text>
                  <View
                    style={[
                      {
                        borderRadius: 20,
                        backgroundColor: s.card,
                        borderWidth: 1,
                        borderColor: s.cardBorder,
                        overflow: 'hidden',
                      },
                      s.cardShadow,
                    ]}
                  >
                    {excludedSources.map((source, index) => (
                      <View key={source.id}>
                        {index > 0 && (
                          <View
                            accessible={false}
                            style={{ height: StyleSheet.hairlineWidth, marginLeft: 44, backgroundColor: s.hairline }}
                          />
                        )}
                        <View
                          testID={`routing-excluded-${platform}-${source.id}`}
                          style={{
                            minHeight: 56,
                            paddingHorizontal: 14,
                            paddingVertical: 10,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 10,
                          }}
                        >
                          <Ionicons name="ban-outline" size={18} color={s.subtle} />
                          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                            <Text numberOfLines={1} style={{ color: s.muted, fontSize: 14, fontWeight: '600' }}>
                              {source.displayName}
                            </Text>
                            <Text numberOfLines={1} style={{ color: s.subtle, fontSize: 11.5 }}>
                              {formatDeclaredPlatforms(source) || '已从此平台排除'}
                            </Text>
                          </View>
                          <Pressable
                            testID={`routing-restore-${platform}-${source.id}`}
                            accessibilityRole="button"
                            accessibilityLabel={`在${currentMeta.label}恢复 ${source.displayName}`}
                            onPress={() =>
                              saveRouting(setSourceExcludedForPlatform(routing, platform, source.id, false))
                            }
                            style={{
                              paddingHorizontal: 11,
                              paddingVertical: 6,
                              borderRadius: 12,
                              backgroundColor: s.accentSoft,
                            }}
                          >
                            <Text style={{ color: s.control, fontSize: 12, fontWeight: '700' }}>恢复</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </SheetModal>
  );
}
