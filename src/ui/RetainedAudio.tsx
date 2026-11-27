import { useRef, useState, useSyncExternalStore } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import type { LocalAudioRecord } from '../storage/localAudio.ts';
import { Modal } from './AdaptiveModal.tsx';
import { Cover } from './Cover.tsx';
import { Text } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { sollinTokens } from './tokens.ts';

export function RetainedAudio({ services, onClose }: { services: Services; onClose: () => void }) {
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);
  const insets = useSafeAreaInsets();
  const files = useSyncExternalStore(services.localAudio.subscribe, services.localAudio.getRetainedSnapshot);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const close = () => {
    if (!locked.current) onClose();
  };

  const run = async (action: () => Promise<string>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage('');
    try {
      setMessage(await action());
    } catch {
      setMessage('操作未完成：音频可能正在使用或记录已变化，原数据保留，请重试。');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  const restore = (ids: readonly string[]) => {
    void run(async () => {
      await services.localAudio.restoreRetained(ids);
      return `已恢复 ${ids.length} 首到列表`;
    });
  };

  const remove = (file: LocalAudioRecord) =>
    Alert.alert(
      '删除此设备保留的音频？',
      `${file.track.title}\n将删除本设备音频、关联封面和该索引记录，不删除最初导入或扫描的原文件。歌单、历史和队列引用保留，需重新导入同一文件才能恢复播放。正在使用的音频不能删除。`,
      [
        { text: '保留', style: 'cancel' },
        {
          text: '删除副本',
          style: 'destructive',
          onPress: () => {
            void run(async () => {
              const result = await services.localAudio.removeRetained(file.id);
              return result.pendingCleanup ? '记录已移除，暂存文件将在下次启动清理' : '本设备保留副本已删除';
            });
          },
        },
      ],
    );

  const totalMiB = (files.reduce((sum, file) => sum + file.bytes, 0) / 1048576).toFixed(2);
  const dangerBg = s.dark ? 'rgba(255,107,129,0.14)' : 'rgba(217,67,85,0.09)';
  const softTile = s.dark ? 'rgba(255,255,255,0.055)' : 'rgba(42,36,31,0.035)';

  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <View accessibilityViewIsModal style={{ flex: 1 }}>
        <LinearGradient colors={[...s.sheetGradient]} start={{ x: 0.12, y: 0 }} end={{ x: 0.88, y: 1 }} style={StyleSheet.absoluteFill} />

        {/* Unified top-left back header */}
        <View style={{ paddingTop: Math.max(insets.top + 8, 22), paddingHorizontal: 18, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            testID="retained-close"
            accessibilityRole="button"
            accessibilityLabel="收起保留副本"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={close}
            style={{
              minHeight: 38,
              paddingHorizontal: 13,
              borderRadius: 19,
              backgroundColor: s.chip,
              borderWidth: 1,
              borderColor: s.chipBorder,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              opacity: busy ? 0.5 : 1,
            }}
          >
            <Ionicons name="chevron-back" size={17} color={s.ink} />
            <Text style={{ color: s.ink, fontSize: 13.5, fontWeight: '600' }}>返回</Text>
          </Pressable>
          <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, color: s.ink, fontSize: 19, fontWeight: '700' }}>
            保留音频副本
          </Text>
        </View>

        <FlatList
          data={files}
          keyExtractor={file => file.id}
          initialNumToRender={10}
          windowSize={5}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: Math.max(insets.bottom + 30, 44), gap: 12 }}
          ListHeaderComponent={
            <View style={{ gap: 12, marginBottom: 4 }}>
              {/* Summary & storage overview card */}
              <View style={[{ padding: 16, borderRadius: 22, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, gap: 12 }, s.cardShadow]}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 13, borderRadius: 15, backgroundColor: softTile, gap: 3 }}>
                    <Ionicons name="albums-outline" size={16} color={s.accent} />
                    <Text style={{ color: s.ink, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{files.length}</Text>
                    <Text style={{ color: s.muted, fontSize: 11.5 }}>保留曲目</Text>
                  </View>
                  <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 13, borderRadius: 15, backgroundColor: softTile, gap: 3 }}>
                    <Ionicons name="server-outline" size={16} color={s.accent} />
                    <Text style={{ color: s.ink, fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{totalMiB}</Text>
                    <Text style={{ color: s.muted, fontSize: 11.5 }}>记录容量 (MiB)</Text>
                  </View>
                </View>

                <Text testID="retained-summary" style={{ color: s.muted, fontSize: 12.5, fontWeight: '600' }}>
                  共 {files.length} 首 · 记录容量 {totalMiB} MiB
                </Text>

                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 11, borderRadius: 14, backgroundColor: softTile }}>
                  <Ionicons name="information-circle-outline" size={16} color={s.muted} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, color: s.muted, fontSize: 12, lineHeight: 18 }}>
                    这些音频已从列表移除或移出扫描范围，仍保存在此设备。恢复不触发播放；扫描范围外的副本将作为独立导入项恢复，不扩大目录授权。
                  </Text>
                </View>

                {files.length > 0 && (
                  <Pressable
                    testID="retained-restore-all"
                    accessibilityRole="button"
                    accessibilityLabel="全部恢复到列表"
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    onPress={() => restore(files.map(file => file.id))}
                    style={{
                      minHeight: 44,
                      borderRadius: 15,
                      backgroundColor: s.control,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 7,
                      opacity: busy ? 0.5 : 1,
                    }}
                  >
                    <Ionicons name="refresh-circle-outline" size={18} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>全部恢复到列表</Text>
                  </Pressable>
                )}
              </View>

              {!!message && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16, backgroundColor: s.accentSoft, borderWidth: 1, borderColor: s.accent + '33' }}>
                  <Ionicons name="checkmark-circle-outline" size={17} color={s.accent} />
                  <Text testID="retained-message" accessibilityLiveRegion="polite" style={{ flex: 1, color: s.accent, fontSize: 13, fontWeight: '600' }}>
                    {message}
                  </Text>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={[{ paddingVertical: 38, paddingHorizontal: 22, borderRadius: 22, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, alignItems: 'center', gap: 10 }, s.cardShadow]}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: s.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="musical-notes-outline" size={24} color={s.accent} />
              </View>
              <Text style={{ color: s.ink, fontSize: 15.5, fontWeight: '700' }}>没有保留副本</Text>
              <Text style={{ color: s.muted, fontSize: 12.5, lineHeight: 19, textAlign: 'center' }}>
                当你从本地列表移除歌曲或排除扫描目录时，已缓存的本机副本会安全暂存到这里，随时可一键恢复。
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View
              testID={`retained-row-${item.id}`}
              style={[{ padding: 14, borderRadius: 20, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, gap: 12 }, s.cardShadow]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Cover services={services} track={item.track} size={48} radius={11} />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text numberOfLines={1} style={{ color: s.ink, fontSize: 15.5, fontWeight: '700' }}>
                    {item.track.title}
                  </Text>
                  <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12.5 }}>
                    {item.track.artist || '未知艺人'} · {(item.bytes / 1048576).toFixed(2)} MiB
                  </Text>
                </View>
                <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: softTile }}>
                  <Text style={{ color: s.muted, fontSize: 11, fontWeight: '600' }}>
                    {item.scanExcluded ? '已移出扫描范围' : '已从列表移除'}
                  </Text>
                </View>
              </View>

              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: s.hairline }} />

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  testID={`retained-restore-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`恢复到列表：${item.track.title}`}
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={() => restore([item.id])}
                  style={{
                    flex: 1,
                    minHeight: 40,
                    paddingHorizontal: 12,
                    borderRadius: 13,
                    backgroundColor: s.chip,
                    borderWidth: 1,
                    borderColor: s.chipBorder,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  <Ionicons name="arrow-undo-outline" size={15} color={s.ink} />
                  <Text style={{ color: s.ink, fontSize: 13.5, fontWeight: '600' }}>恢复到列表</Text>
                </Pressable>
                <Pressable
                  testID={`retained-delete-${item.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`删除副本：${item.track.title}`}
                  accessibilityState={{ disabled: busy }}
                  disabled={busy}
                  onPress={() => remove(item)}
                  style={{
                    flex: 1,
                    minHeight: 40,
                    paddingHorizontal: 12,
                    borderRadius: 13,
                    backgroundColor: dangerBg,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  <Ionicons name="trash-outline" size={15} color={s.accent} />
                  <Text style={{ color: s.accent, fontSize: 13.5, fontWeight: '600' }}>删除副本</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      </View>
    </Modal>
  );
}
