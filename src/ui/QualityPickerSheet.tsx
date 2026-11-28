import { useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import { trackPlatform, type Track } from '../domain/track.ts';
import { normalizeQuality, type Quality } from '../domain/quality.ts';
import { Modal } from './AdaptiveModal.tsx';
import { Text } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { sollinTokens } from './tokens.ts';

export interface QualityTierItem {
  readonly id: Quality;
  readonly badge: string;
  readonly description: string;
  readonly spatial?: boolean;
}

export const PLAYBACK_QUALITY_TIERS: readonly QualityTierItem[] = [
  { id: 'master', badge: 'Master', description: '母带级音质' },
  { id: 'atmos', badge: 'Atmos', description: '沉浸式空间音频', spatial: true },
  { id: 'hires', badge: 'Hi-Res', description: '高解析度/高清环绕音质' },
  { id: 'flac24bit', badge: '24Bit', description: '24 Bit 无损音质' },
  { id: 'flac', badge: 'FLAC', description: '无损音质' },
  { id: '320k', badge: '320K', description: '高品质音频' },
  { id: '128k', badge: '128K', description: '标准音质，兼容性最好' },
];

export function qualityBadgeText(raw?: string | null): string {
  if (!raw) return 'FLAC';
  const q = normalizeQuality(raw);
  if (q === 'master') return 'Master';
  if (q === 'atmos' || q === 'atmos_plus') return 'Atmos';
  if (q === 'hires') return 'Hi-Res';
  if (q === 'flac24bit') return '24Bit';
  if (q === 'flac') return 'FLAC';
  if (q === '320k') return '320K';
  if (q === '192k') return '192K';
  if (q === '128k') return '128K';
  return raw.toUpperCase();
}

export function QualityPill({
  label,
  dark = false,
  accent,
  onPress,
  testID = 'player-quality-pill',
}: {
  label: string;
  dark?: boolean;
  accent?: string;
  onPress: () => void;
  testID?: string;
}) {
  const pillAccent = accent ?? (dark ? '#F5E7DD' : '#B55B34');
  const bg = dark ? 'rgba(255,255,255,0.14)' : 'rgba(181,91,52,0.12)';
  const border = dark ? 'rgba(255,255,255,0.28)' : 'rgba(181,91,52,0.26)';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`当前音质 ${label}，轻触切换播放音质`}
      onPress={onPress}
      style={{
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 3.5,
        borderRadius: 10,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
      }}
    >
      <Ionicons name="pulse" size={12} color={pillAccent} />
      <Text style={{ fontSize: 11.5, fontWeight: '700', color: pillAccent, letterSpacing: 0.2 }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function QualityPickerSheet({
  services,
  track,
  visible,
  onClose,
  onSelected,
}: {
  services: Services;
  track: Track;
  visible: boolean;
  onClose: () => void;
  onSelected?: (label: string) => void;
}) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);
  const insets = useSafeAreaInsets();
  const preferences = useSyncExternalStore(services.preferences.subscribe, services.preferences.getSnapshot);
  const playback = useSyncExternalStore(services.playback.controller.subscribe, services.playback.controller.getSnapshot);
  const [switching, setSwitching] = useState<Quality | null>(null);
  const [error, setError] = useState('');

  const platform = trackPlatform(track);
  const activeQuality =
    (platform ? preferences.playbackQualities?.[platform] : undefined) ??
    normalizeQuality(playback.media?.quality ?? '') ??
    preferences.quality;
  const selectedId: Quality = activeQuality === 'atmos_plus' ? 'atmos' : activeQuality === '192k' ? '320k' : activeQuality;

  const choose = async (tier: QualityTierItem) => {
    if (switching) return;
    setSwitching(tier.id);
    setError('');
    try {
      const patch = platform
        ? { quality: tier.id, playbackQualities: { ...preferences.playbackQualities, [platform]: tier.id } }
        : { quality: tier.id };
      await services.preferences.update(patch);
      if (track.origin.kind !== 'local') {
        void services.playback.controller.reloadAtCurrentPosition();
      }
      onSelected?.(`已切换为 ${tier.badge} · ${tier.description}`);
      onClose();
    } catch {
      setError('音质偏好未保存，请重试');
    } finally {
      setSwitching(null);
    }
  };

  const sheetBg = s.dark ? '#1C1A1E' : '#FAF7F5';
  const rowBg = s.dark ? 'rgba(255,255,255,0.06)' : '#F2ECE9';
  const rowSelectedBg = s.dark ? 'rgba(218,128,96,0.16)' : '#EFE4DE';
  const badgeBg = s.dark ? 'rgba(218,128,96,0.16)' : 'rgba(181,91,52,0.10)';
  const badgeBorder = s.dark ? 'rgba(218,128,96,0.34)' : 'rgba(181,91,52,0.28)';
  const warmAccent = s.dark ? '#E89B74' : '#8A482B';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(14,10,12,0.46)' }}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="关闭播放音质选择" onPress={onClose} />
        <View
          testID="quality-picker-sheet"
          style={{
            maxHeight: '80%',
            backgroundColor: sheetBg,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 18,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom + 14, 22),
            gap: 12,
          }}
        >
          <View style={{ alignSelf: 'center', width: 38, height: 4.5, borderRadius: 2.25, backgroundColor: s.dark ? 'rgba(255,255,255,0.24)' : 'rgba(60,48,50,0.20)' }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, paddingTop: 2 }}>
            <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: warmAccent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '800', letterSpacing: -0.3 }}>HQ</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={{ color: s.ink, fontSize: 18, fontWeight: '700' }}>播放音质</Text>
              <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12.5 }}>{track.title}</Text>
            </View>
          </View>

          {!!error && <Text accessibilityRole="alert" style={{ color: s.accent, fontSize: 12.5, paddingHorizontal: 4 }}>{error}</Text>}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingBottom: 6 }}>
            {PLAYBACK_QUALITY_TIERS.map(tier => {
              const selected = selectedId === tier.id;
              const isLoading = switching === tier.id;
              return (
                <Pressable
                  key={tier.id}
                  testID={`quality-option-${tier.id}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`${tier.badge} ${tier.description}`}
                  accessibilityState={{ selected }}
                  disabled={switching !== null}
                  onPress={() => { void choose(tier); }}
                  style={{
                    minHeight: 58,
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 11,
                    backgroundColor: selected ? rowSelectedBg : rowBg,
                    borderWidth: selected ? 1.4 : 1,
                    borderColor: selected ? warmAccent : (s.dark ? 'rgba(255,255,255,0.06)' : 'rgba(60,48,50,0.06)'),
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      minWidth: 78,
                      paddingHorizontal: 9,
                      paddingVertical: 4,
                      borderRadius: 10,
                      backgroundColor: badgeBg,
                      borderWidth: 1,
                      borderColor: badgeBorder,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <Ionicons name={tier.spatial ? 'person-outline' : 'pulse'} size={12} color={warmAccent} />
                    <Text style={{ color: warmAccent, fontSize: 12, fontWeight: '700' }}>{tier.badge}</Text>
                  </View>
                  <Text style={{ flex: 1, color: s.ink, fontSize: 15, fontWeight: selected ? '700' : '500' }}>
                    {tier.description}
                  </Text>
                  {isLoading ? (
                    <ActivityIndicator size="small" color={warmAccent} />
                  ) : selected ? (
                    <Ionicons name="checkmark-circle" size={22} color={warmAccent} />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={s.subtle} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
