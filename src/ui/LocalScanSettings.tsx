import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TextInput } from './Typography.tsx';
import { sollinTokens } from './tokens.ts';
import { useTheme } from './theme.tsx';
import { scanFolderKey, type ScanRoot } from '../domain/localScan.ts';
import type { LocalAudioStore } from '../storage/localAudio.ts';

export function LocalScanSettings({
  store,
  visible,
  onClose,
}: {
  store: LocalAudioStore;
  visible: boolean;
  onClose: () => void;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getScanSnapshot);
  const theme = useTheme();
  const s = sollinTokens(theme.mode, theme.palette.accent, theme.appearance);
  const insets = useSafeAreaInsets();
  const [roots, setRoots] = useState<readonly ScanRoot[]>([]);
  const [minimum, setMinimum] = useState('0');
  const [blocked, setBlocked] = useState<readonly string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [recursive, setRecursive] = useState(true);

  useEffect(() => {
    if (visible) {
      setRoots(state.roots);
      setMinimum(String(state.minimumSeconds));
      setBlocked(state.blocked);
      setMessage('');
    }
  }, [visible]);

  if (!visible) return null;

  const rules = (values = roots) => ({
    roots: values,
    minimumSeconds: minimum.trim() === '' ? NaN : Number(minimum),
    blocked: blocked.filter(key => values.some(root => key.startsWith(root.id + '/'))),
  });

  async function run(action: () => Promise<string>) {
    if (busy) return;
    Keyboard.dismiss();
    setBusy(true);
    setMessage('');
    try {
      setMessage(await action());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '扫描操作未完成，原索引保留');
    } finally {
      setBusy(false);
    }
  }

  function summary(result: { count: number; unreadable: number }) {
    return `扫描完成 · ${result.count} 首${result.unreadable ? ` · ${result.unreadable} 个文件无法读取，原有引用保留` : ''}`;
  }

  const softTile = s.dark ? 'rgba(255,255,255,0.055)' : 'rgba(42,36,31,0.035)';
  const dangerBg = s.dark ? 'rgba(255,107,129,0.14)' : 'rgba(217,67,85,0.09)';
  const okColor = s.dark ? '#5EE0A0' : '#1D8A56';
  const okBg = s.dark ? 'rgba(94,224,160,0.14)' : 'rgba(29,138,86,0.11)';
  const warnBg = s.dark ? 'rgba(245,158,11,0.16)' : 'rgba(217,119,6,0.11)';
  const warnColor = s.dark ? '#FBBF24' : '#B45309';
  const activeFolders = state.folders.filter(folder => roots.some(root => root.id === folder.rootId));

  return (
    <View accessibilityViewIsModal style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[...s.sheetGradient]} start={{ x: 0.12, y: 0 }} end={{ x: 0.88, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* Unified top-left back header */}
      <View style={{ paddingTop: Math.max(insets.top + 8, 22), paddingHorizontal: 18, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          testID="local-scan-close"
          accessibilityRole="button"
          accessibilityLabel="返回本地音频"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={onClose}
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
          <Text style={{ color: s.ink, fontSize: 13.5, fontWeight: '600' }}>返回本地音频</Text>
        </Pressable>
        <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, color: s.ink, fontSize: 19, fontWeight: '700' }}>
          文件夹与扫描
        </Text>
      </View>

      <ScrollView
        testID="local-scan-viewport"
        style={{ flex: 1 }}
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: Math.max(insets.bottom + 36, 48), gap: 14 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Sync status & primary scan actions */}
        <View style={[{ padding: 16, borderRadius: 22, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, gap: 12 }, s.cardShadow]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: s.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="folder-open-outline" size={20} color={s.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: s.ink, fontSize: 16, fontWeight: '700' }}>本机目录扫描</Text>
                <Text style={{ color: s.muted, fontSize: 12 }}>已授权 {roots.length} 个目录 · 屏蔽 {blocked.length} 个子目录</Text>
              </View>
            </View>
            <View style={{ paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: state.dirty ? warnBg : okBg }}>
              <Text style={{ color: state.dirty ? warnColor : okColor, fontSize: 11, fontWeight: '700' }}>
                {state.dirty ? '待重扫' : '已同步'}
              </Text>
            </View>
          </View>

          <Text testID="local-scan-pending" style={{ color: s.muted, fontSize: 12.5, lineHeight: 18 }}>
            {state.dirty ? '已保存的目录或规则有变化，请重新扫描' : '当前索引已按保存的规则扫描'}
          </Text>

          {/* Recursive toggle row */}
          <Pressable
            testID="local-scan-recursive"
            accessibilityRole="button"
            accessibilityLabel={recursive ? '新目录：包含子目录' : '新目录：仅当前文件夹'}
            accessibilityState={{ selected: recursive, disabled: busy }}
            disabled={busy}
            onPress={() => setRecursive(value => !value)}
            style={{
              minHeight: 44,
              paddingHorizontal: 13,
              paddingVertical: 10,
              borderRadius: 14,
              backgroundColor: recursive ? s.accentSoft : softTile,
              borderWidth: 1,
              borderColor: recursive ? s.accent + '44' : 'transparent',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              opacity: busy ? 0.5 : 1,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Ionicons name={recursive ? 'git-branch-outline' : 'folder-outline'} size={17} color={recursive ? s.accent : s.muted} />
              <Text style={{ color: recursive ? s.accent : s.ink, fontSize: 13.5, fontWeight: '600' }}>
                {recursive ? '新目录：包含子目录' : '新目录：仅当前文件夹'}
              </Text>
            </View>
            <Ionicons name={recursive ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={recursive ? s.accent : s.subtle} />
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              testID="local-scan-add"
              accessibilityRole="button"
              accessibilityLabel="添加文件夹并扫描"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => {
                void run(async () => {
                  const picked = await store.pickFolder();
                  if (!picked) return '已取消，目录和索引保留';
                  const next = [...roots.filter(root => root.id !== picked.id), { ...picked, recursive }];
                  await store.saveScanRules(rules(next));
                  setRoots(next);
                  return summary(await store.rescan());
                });
              }}
              style={{
                flex: 1.25,
                minHeight: 44,
                paddingHorizontal: 14,
                borderRadius: 15,
                backgroundColor: s.control,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Ionicons name="add-circle-outline" size={17} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' }}>添加文件夹并扫描</Text>
            </Pressable>
            <Pressable
              testID="local-scan-rescan"
              accessibilityRole="button"
              accessibilityLabel="重新扫描"
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => {
                void run(async () => summary(await store.rescan()));
              }}
              style={{
                flex: 0.85,
                minHeight: 44,
                paddingHorizontal: 14,
                borderRadius: 15,
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
              <Ionicons name="scan-outline" size={16} color={s.ink} />
              <Text style={{ color: s.ink, fontSize: 13.5, fontWeight: '600' }}>重新扫描</Text>
            </Pressable>
          </View>

          {busy && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 4 }}>
              <ActivityIndicator accessibilityLabel="正在扫描本地目录" color={s.accent} />
              <Text style={{ color: s.muted, fontSize: 12.5 }}>正在扫描授权目录，请稍候…</Text>
            </View>
          )}
        </View>

        {!!message && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16, backgroundColor: s.accentSoft, borderWidth: 1, borderColor: s.accent + '33' }}>
            <Ionicons name="sparkles-outline" size={17} color={s.accent} />
            <Text testID="local-scan-message" accessibilityLiveRegion="polite" style={{ flex: 1, color: s.accent, fontSize: 13, fontWeight: '600' }}>
              {message}
            </Text>
          </View>
        )}

        {/* Authorized Scan Roots */}
        <View style={[{ borderRadius: 22, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, overflow: 'hidden' }, s.cardShadow]}>
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: s.ink, fontSize: 15.5, fontWeight: '700' }}>扫描目录</Text>
            <Text style={{ color: s.subtle, fontSize: 12 }}>{roots.length} 个</Text>
          </View>
          {!roots.length ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <Text style={{ color: s.muted, fontSize: 13 }}>尚未添加文件夹，点击上方「添加文件夹并扫描」授权目录。</Text>
            </View>
          ) : (
            roots.map((root, index) => (
              <View key={root.id} style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: s.hairline, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: softTile, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="folder-outline" size={16} color={s.accent} />
                  </View>
                  <Text numberOfLines={2} style={{ flex: 1, color: s.ink, fontSize: 14.5, fontWeight: '600' }}>
                    {root.name}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Pressable
                    testID={`local-scan-root-recursive-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={root.recursive ? '包含子目录' : '仅当前目录'}
                    accessibilityState={{ selected: root.recursive, disabled: busy }}
                    disabled={busy}
                    onPress={() =>
                      setRoots(values => values.map(item => (item.id === root.id ? { ...item, recursive: !item.recursive } : item)))
                    }
                    style={{
                      minHeight: 36,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: root.recursive ? s.accentSoft : s.chip,
                      borderWidth: 1,
                      borderColor: root.recursive ? s.accent + '44' : s.chipBorder,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      opacity: busy ? 0.5 : 1,
                    }}
                  >
                    <Ionicons name={root.recursive ? 'checkmark-circle' : 'folder-outline'} size={14} color={root.recursive ? s.accent : s.muted} />
                    <Text style={{ color: root.recursive ? s.accent : s.ink, fontSize: 12.5, fontWeight: '600' }}>
                      {root.recursive ? '包含子目录' : '仅当前目录'}
                    </Text>
                  </Pressable>
                  <Pressable
                    testID={`local-scan-root-remove-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel="移除此扫描目录"
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    onPress={() => setRoots(values => values.filter(item => item.id !== root.id))}
                    style={{
                      minHeight: 36,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      backgroundColor: dangerBg,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                      opacity: busy ? 0.5 : 1,
                    }}
                  >
                    <Ionicons name="trash-outline" size={14} color={s.accent} />
                    <Text style={{ color: s.accent, fontSize: 12.5, fontWeight: '600' }}>移除此扫描目录</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Duration Filter Card */}
        <View style={[{ padding: 16, borderRadius: 22, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, gap: 10 }, s.cardShadow]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="timer-outline" size={17} color={s.accent} />
            <Text style={{ color: s.ink, fontSize: 15.5, fontWeight: '700' }}>屏蔽低于多少秒的音频</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TextInput
              accessibilityLabel="扫描最小时长秒"
              value={minimum}
              onChangeText={setMinimum}
              editable={!busy}
              keyboardType="decimal-pad"
              placeholder="0 表示不过滤时长"
              placeholderTextColor={s.subtle}
              style={{
                flex: 1,
                minHeight: 44,
                paddingHorizontal: 14,
                color: s.ink,
                backgroundColor: s.inputBg,
                borderWidth: 1,
                borderColor: s.cardBorder,
                borderRadius: 14,
                fontSize: 14.5,
                fontVariant: ['tabular-nums'],
              }}
            />
            <View style={{ paddingHorizontal: 12, height: 44, borderRadius: 14, backgroundColor: softTile, justifyContent: 'center' }}>
              <Text style={{ color: s.muted, fontSize: 13.5, fontWeight: '600' }}>秒</Text>
            </View>
          </View>
          <Text style={{ color: s.muted, fontSize: 12, lineHeight: 17 }}>
            可自动过滤提示音、铃声或短语音；输入 0 则保留全部时长音频。
          </Text>
        </View>

        {/* Blocked Subfolders Card */}
        <View style={[{ borderRadius: 22, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, overflow: 'hidden' }, s.cardShadow]}>
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 3 }}>
            <Text style={{ color: s.ink, fontSize: 15.5, fontWeight: '700' }}>屏蔽文件夹</Text>
            <Text style={{ color: s.muted, fontSize: 12 }}>目录会在首次扫描后列出，屏蔽同时作用于其子目录。</Text>
          </View>
          {!activeFolders.length ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              <Text style={{ color: s.subtle, fontSize: 12.5 }}>首次扫描目录后，可在此精准排除不需要的子目录。</Text>
            </View>
          ) : (
            activeFolders.map((folder, index) => {
              const key = scanFolderKey(folder);
              const active = blocked.includes(key);
              return (
                <View
                  key={key}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 11,
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: s.hairline,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Ionicons name={active ? 'eye-off-outline' : 'folder-outline'} size={16} color={active ? s.accent : s.muted} />
                  <Text numberOfLines={2} style={{ flex: 1, color: s.ink, fontSize: 13.5, fontWeight: '500' }}>
                    {folder.rootName}
                    {folder.path ? ` / ${folder.path}` : ''}
                  </Text>
                  <Pressable
                    testID={`local-scan-block-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={active ? '已屏蔽 · 点击取消' : '屏蔽此文件夹'}
                    accessibilityState={{ selected: active, disabled: busy }}
                    disabled={busy}
                    onPress={() => setBlocked(values => (active ? values.filter(value => value !== key) : [...values, key]))}
                    style={{
                      minHeight: 34,
                      paddingHorizontal: 11,
                      borderRadius: 12,
                      backgroundColor: active ? dangerBg : s.chip,
                      borderWidth: 1,
                      borderColor: active ? s.accent + '44' : s.chipBorder,
                      justifyContent: 'center',
                      opacity: busy ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: active ? s.accent : s.ink, fontSize: 12, fontWeight: '600' }}>
                      {active ? '已屏蔽 · 点击取消' : '屏蔽此文件夹'}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        {/* Save Rules CTA */}
        <Pressable
          testID="local-scan-save"
          accessibilityRole="button"
          accessibilityLabel="保存扫描规则"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={() => {
            void run(async () => {
              await store.saveScanRules(rules());
              return '规则已保存，重新扫描后生效';
            });
          }}
          style={[{
            minHeight: 48,
            borderRadius: 16,
            backgroundColor: s.control,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: busy ? 0.5 : 1,
          }, s.cardShadow]}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>保存扫描规则</Text>
        </Pressable>

        {/* Concise privacy & safety note */}
        <View style={{ paddingHorizontal: 6, gap: 4 }}>
          <Text style={{ color: s.subtle, fontSize: 11.5, lineHeight: 17 }}>
            只读取你授权的目录，音频复制到此设备。移除目录或屏蔽文件夹后需重新扫描；不会删除原文件或正在播放的副本。
          </Text>
          <Text style={{ color: s.subtle, fontSize: 11.5, lineHeight: 17 }}>
            “重新扫描”使用已保存规则；未保存的编辑可返回放弃。授权失效时移除该目录，保存后重新添加。
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
