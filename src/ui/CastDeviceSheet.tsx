import { useEffect, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import { requireNativeView } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import type { Services } from '../app/services.ts';
import { currentEntry } from '../domain/queue.ts';
import type { DlnaDevice } from '../providers/dlna.ts';
import { Text } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { sollinTokens } from './tokens.ts';

const NativeRoutePicker = requireNativeView<ViewProps & { tint: string; activeTint: string }>('NexusNative', 'RoutePicker');

function fmtTime(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function CastDeviceSheet({ services, onBack }: { services: Services; onBack?: () => void }) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);
  const dlna = useSyncExternalStore(services.dlna.subscribe, services.dlna.getSnapshot);
  const playback = useSyncExternalStore(services.playback.controller.subscribe, services.playback.controller.getSnapshot);
  const preferences = useSyncExternalStore(services.preferences.subscribe, services.preferences.getSnapshot);
  const current = currentEntry(playback.queue)?.track;

  useEffect(() => {
    if (!dlna.discovering && dlna.devices.length === 0) {
      void services.dlna.discover(3000);
    }
  }, []);

  async function castTo(device: DlnaDevice) {
    if (!current) {
      Alert.alert('暂无播放曲目', '请先选择一首歌曲后再投屏。');
      return;
    }
    try {
      const mediaUrl = playback.media?.url;
      if (!mediaUrl) {
        Alert.alert('音频尚未就绪', '请先让当前歌曲开始加载或播放，再发起 DLNA 投屏。');
        return;
      }
      services.playback.controller.pause();
      await services.dlna.castTrack(device, mediaUrl, playback.media?.matchedTrack ?? current, playback.media?.headers);
    } catch (err) {
      Alert.alert('投屏失败', err instanceof Error ? err.message : '请确认设备在同一 Wi-Fi 下并开启 DLNA');
    }
  }

  return (
    <View testID="cast-device-sheet" style={{ gap: 14 }}>
      {onBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回播放选项"
          onPress={onBack}
          style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: s.chip, borderWidth: 1, borderColor: s.cardBorder }}
        >
          <Ionicons name="chevron-back" size={16} color={s.ink} />
          <Text style={{ color: s.ink, fontSize: 14, fontWeight: '600' }}>返回播放选项</Text>
        </Pressable>
      )}

      <Text style={{ color: s.ink, fontSize: 24, fontWeight: '700' }}>投屏与音频输出</Text>

      {/* AirPlay & Bluetooth System Route Picker */}
      <View style={[{ borderRadius: 20, padding: 16, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, s.cardShadow]}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: s.ink, fontSize: 16, fontWeight: '700' }}>AirPlay 与蓝牙音频</Text>
          <Text style={{ color: s.muted, fontSize: 12.5 }}>轻触右侧系统按钮切换 AirPlay 音箱、HomePod 或蓝牙设备</Text>
        </View>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: s.chip, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <NativeRoutePicker tint={s.ink} activeTint={s.accent} pointerEvents="auto" style={{ width: 44, height: 44 }} />
        </View>
      </View>

      {/* Active DLNA Cast Session */}
      {dlna.activeDevice && (
        <View testID="dlna-active-session" style={[{ borderRadius: 20, padding: 16, backgroundColor: s.accentSoft, borderWidth: 1, borderColor: s.accent + '66', gap: 12 }, s.cardShadow]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: s.accent, fontSize: 12, fontWeight: '700' }}>DLNA 正在投屏</Text>
              <Text numberOfLines={1} style={{ color: s.ink, fontSize: 16, fontWeight: '700' }}>{dlna.activeDevice.friendlyName}</Text>
              {dlna.activeTrack && (
                <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12.5 }}>
                  {dlna.activeTrack.title} · {dlna.activeTrack.artist}
                </Text>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => void services.dlna.disconnect()}
              style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16, backgroundColor: s.card }}
            >
              <Text style={{ color: s.accent, fontSize: 12.5, fontWeight: '700' }}>断开投屏</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: s.muted, fontSize: 12, fontVariant: ['tabular-nums'] }}>
              {fmtTime(dlna.positionSec)} / {fmtTime(dlna.durationSec)}
            </Text>
            <Text style={{ color: s.muted, fontSize: 12 }}>{dlna.transportState === 'PLAYING' ? '播放中' : dlna.transportState === 'PAUSED_PLAYBACK' ? '已暂停' : dlna.transportState}</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void services.dlna.seek(Math.max(0, dlna.positionSec - 15)).catch(() => {})}
              style={{ paddingHorizontal: 13, paddingVertical: 9, borderRadius: 14, backgroundColor: s.card }}
            >
              <Text style={{ color: s.ink, fontSize: 13, fontWeight: '600' }}>−15秒</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void (dlna.transportState === 'PLAYING' ? services.dlna.pause() : services.dlna.play()).catch(() => {})}
              style={{ flex: 1, minWidth: 88, paddingVertical: 9, borderRadius: 14, backgroundColor: s.control, alignItems: 'center' }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' }}>{dlna.transportState === 'PLAYING' ? '暂停' : '继续播放'}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void services.dlna.seek(dlna.positionSec + 15).catch(() => {})}
              style={{ paddingHorizontal: 13, paddingVertical: 9, borderRadius: 14, backgroundColor: s.card }}
            >
              <Text style={{ color: s.ink, fontSize: 13, fontWeight: '600' }}>＋15秒</Text>
            </Pressable>
          </View>

          {dlna.activeDevice.renderingControlUrl && (
            <View style={{ gap: 6 }}>
              <Text style={{ color: s.muted, fontSize: 12 }}>电视 / 音箱音量 · {dlna.volume}%</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[20, 40, 60, 80, 100].map(v => {
                  const active = Math.abs(dlna.volume - v) <= 10;
                  return (
                    <Pressable
                      key={v}
                      onPress={() => void services.dlna.setVolume(v).catch(() => {})}
                      style={{ flex: 1, minHeight: 36, borderRadius: 10, backgroundColor: active ? s.control : s.card, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text style={{ color: active ? '#FFFFFF' : s.ink, fontSize: 12, fontWeight: '600' }}>{v}%</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      )}

      {/* DLNA LAN Devices */}
      <View style={[{ borderRadius: 20, padding: 16, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, gap: 12 }, s.cardShadow]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: s.ink, fontSize: 16, fontWeight: '700' }}>局域网 DLNA 投屏</Text>
            <Text style={{ color: s.muted, fontSize: 12 }}>支持电视、投影仪、智能音箱与本地文件局域网中继</Text>
          </View>
          <Pressable
            testID="dlna-discover-btn"
            accessibilityRole="button"
            disabled={dlna.discovering}
            onPress={() => void services.dlna.discover(3200)}
            style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16, backgroundColor: s.control, opacity: dlna.discovering ? 0.5 : 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            {dlna.discovering ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="scan-outline" size={14} color="#FFFFFF" />}
            <Text style={{ color: '#FFFFFF', fontSize: 12.5, fontWeight: '700' }}>{dlna.discovering ? '扫描中…' : '扫描设备'}</Text>
          </Pressable>
        </View>

        {!!dlna.error && <Text style={{ color: s.accent, fontSize: 12.5, lineHeight: 18 }}>{dlna.error}</Text>}

        {dlna.devices.map(dev => {
          const active = dlna.activeDevice?.id === dev.id;
          return (
            <Pressable
              key={dev.id}
              accessibilityRole="button"
              disabled={dlna.busy}
              onPress={() => void castTo(dev)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: s.hairline }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: active ? s.accentSoft : s.chip, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="tv-outline" size={20} color={active ? s.accent : s.ink} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={{ color: active ? s.accent : s.ink, fontSize: 14.5, fontWeight: '700' }}>{dev.friendlyName}</Text>
                <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12 }}>{[dev.manufacturer, dev.modelName].filter(Boolean).join(' · ') || 'UPnP MediaRenderer'}</Text>
              </View>
              <Text style={{ color: active ? s.accent : s.muted, fontSize: 12.5, fontWeight: '600' }}>{active ? '已连接' : '投屏'}</Text>
            </Pressable>
          );
        })}

        {dlna.recent.length > 0 && dlna.devices.length === 0 && (
          <View style={{ gap: 6 }}>
            <Text style={{ color: s.muted, fontSize: 12, fontWeight: '600' }}>最近使用过的设备</Text>
            {dlna.recent.map(dev => (
              <Pressable
                key={`recent-${dev.id}`}
                accessibilityRole="button"
                disabled={dlna.busy}
                onPress={() => void castTo(dev)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}
              >
                <Ionicons name="time-outline" size={18} color={s.muted} />
                <Text numberOfLines={1} style={{ flex: 1, color: s.ink, fontSize: 14, fontWeight: '600' }}>{dev.friendlyName}</Text>
                <Text style={{ color: s.accent, fontSize: 12.5, fontWeight: '600' }}>重连</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* App Relative Volume */}
      <View style={[{ borderRadius: 20, padding: 16, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, gap: 12 }, s.cardShadow]}>
        <Text style={{ color: s.ink, fontSize: 15, fontWeight: '600' }}>应用内播放音量 · {Math.round(preferences.volume * 100)}%</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[0.25, 0.5, 0.75, 1].map(v => {
            const active = Math.abs(preferences.volume - v) < 0.04;
            return (
              <Pressable
                key={v}
                accessibilityRole="button"
                onPress={() => void services.preferences.update({ volume: v }).catch(() => {})}
                style={{ flex: 1, minWidth: 64, minHeight: 42, borderRadius: 12, backgroundColor: active ? s.accentSoft : s.chip, borderWidth: 1, borderColor: active ? s.accent : s.cardBorder, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: active ? s.accent : s.ink, fontSize: 13, fontWeight: '600' }}>{Math.round(v * 100)}%</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
