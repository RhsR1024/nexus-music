import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import type { Track } from '../domain/track.ts';
import {
  DEFAULT_CLOUD_CONFIG,
  type AudioMatchCloudProvider,
} from '../providers/audioMatch.ts';
import { Modal } from './AdaptiveModal.tsx';
import { Cover } from './Cover.tsx';
import { Text, TextInput } from './Typography.tsx';
import { useTheme } from './theme.tsx';
import { sollinTokens } from './tokens.ts';

export function AudioMatchModal({
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
  const match = useSyncExternalStore(services.audioMatch.subscribe, services.audioMatch.getSnapshot);
  const [phrase, setPhrase] = useState('');
  const [editingKey, setEditingKey] = useState(false);
  const normalizeUiProvider = (p: AudioMatchCloudProvider): 'shazam' | 'acrcloud' | 'off' =>
    p === 'acrcloud' || p === 'off' ? p : 'shazam';
  const [provider, setProvider] = useState<'shazam' | 'acrcloud' | 'off'>(normalizeUiProvider(match.cloudConfig.provider));
  const [acrHost, setAcrHost] = useState(match.cloudConfig.acrHost);
  const [acrKey, setAcrKey] = useState(match.cloudConfig.acrAccessKey);
  const [acrSecret, setAcrSecret] = useState(match.cloudConfig.acrAccessSecret);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    setProvider(normalizeUiProvider(match.cloudConfig.provider));
    setAcrHost(match.cloudConfig.acrHost || DEFAULT_CLOUD_CONFIG.acrHost);
    setAcrKey(match.cloudConfig.acrAccessKey);
    setAcrSecret(match.cloudConfig.acrAccessSecret);
  }, [match.cloudConfig]);

  useEffect(() => {
    if (!visible && match.listening) {
      void services.audioMatch.stopListening();
    }
  }, [visible, match.listening]);

  async function selectMode(next: 'shazam' | 'acrcloud' | 'off') {
    setProvider(next);
    if (next === 'off') {
      setEditingKey(false);
      await services.audioMatch.saveCloudConfig({ provider: 'off' });
      return;
    }
    if (next === 'shazam') {
      setEditingKey(false);
      await services.audioMatch.saveCloudConfig({ provider: 'shazam' });
      return;
    }
    // ACRCloud requires host + key + secret; expand inline setup if missing
    if (acrKey.trim() && acrSecret.trim()) {
      await services.audioMatch.saveCloudConfig({
        provider: 'acrcloud',
        acrHost,
        acrAccessKey: acrKey,
        acrAccessSecret: acrSecret,
      });
      setEditingKey(false);
    } else {
      setEditingKey(true);
    }
  }

  function toggleListen() {
    if (match.listening) {
      void services.audioMatch.stopListening();
      return;
    }
    if (provider === 'acrcloud' && (!match.cloudConfig.acrAccessKey.trim() || !match.cloudConfig.acrAccessSecret.trim())) {
      setEditingKey(true);
      return;
    }
    services.playback.controller.pause();
    if (provider === 'shazam' && match.cloudConfig.provider !== 'shazam') {
      void services.audioMatch.saveCloudConfig({ provider: 'shazam' }).then(() => services.audioMatch.startListening(6000));
      return;
    }
    void services.audioMatch.startListening(6000);
  }

  async function saveCloudSettings() {
    if (savingConfig) return;
    setSavingConfig(true);
    try {
      await services.audioMatch.saveCloudConfig({
        provider,
        acrHost,
        acrAccessKey: acrKey,
        acrAccessSecret: acrSecret,
      });
      setEditingKey(false);
    } finally {
      setSavingConfig(false);
    }
  }

  function playCandidate(track: Track, list: readonly Track[], index: number) {
    void services.audioMatch.recordMatch(track, match.lastCloudMatch ? 'cloud-clip' : 'lyric-phrase');
    services.playTracks(list, index);
    onClose();
  }

  const ringScale = 1 + Math.min(0.65, match.level * 0.75);
  const softTile = s.dark ? 'rgba(255,255,255,0.055)' : 'rgba(42,36,31,0.035)';
  const okColor = s.dark ? '#5EE0A0' : '#1D8A56';
  const okBg = s.dark ? 'rgba(94,224,160,0.14)' : 'rgba(29,138,86,0.11)';
  const acrReady = Boolean(match.cloudConfig.acrAccessKey.trim() && match.cloudConfig.acrAccessSecret.trim());
  const busyNow = match.identifying;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View testID="audio-match-modal" style={{ flex: 1 }}>
        <LinearGradient colors={[...s.sheetGradient]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />

        {/* Clean unified top-left back header (no redundant top-right Key button) */}
        <View style={{ paddingTop: Math.max(insets.top + 8, 22), paddingHorizontal: 18, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭听歌识曲"
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
            }}
          >
            <Ionicons name="chevron-back" size={17} color={s.ink} />
            <Text style={{ color: s.ink, fontSize: 13.5, fontWeight: '600' }}>返回</Text>
          </Pressable>
          <Text style={{ flex: 1, color: s.ink, fontSize: 18.5, fontWeight: '700' }}>听歌识曲</Text>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: Math.max(insets.bottom + 32, 44), gap: 16 }} showsVerticalScrollIndicator={false}>
          {/* Pulsing Microphone Orb — records live clip & auto-uploads via selected recognition mode */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 2, gap: 13 }}>
            <View style={{ width: 168, height: 168, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  position: 'absolute',
                  width: 146,
                  height: 146,
                  borderRadius: 73,
                  backgroundColor: s.accent + '1A',
                  transform: [{ scale: match.listening ? ringScale * 1.15 : 1 }],
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 114,
                  height: 114,
                  borderRadius: 57,
                  backgroundColor: s.accent + '30',
                  transform: [{ scale: match.listening ? ringScale : 1 }],
                }}
              />
              <Pressable
                testID="audio-match-mic-btn"
                accessibilityRole="button"
                accessibilityLabel={match.listening ? '停止采集' : '开始听歌识曲'}
                disabled={busyNow}
                onPress={toggleListen}
                style={[{ width: 86, height: 86, borderRadius: 43, backgroundColor: s.control, alignItems: 'center', justifyContent: 'center', opacity: busyNow ? 0.65 : 1 }, s.cardShadow]}
              >
                {busyNow ? (
                  <ActivityIndicator color="#FFFFFF" size="large" />
                ) : (
                  <Ionicons name={match.listening ? 'stop' : 'mic'} size={34} color="#FFFFFF" />
                )}
              </Pressable>
            </View>

            <Text style={{ color: s.ink, fontSize: 16.5, fontWeight: '700' }}>
              {match.listening
                ? `正在录制环境片段… ${(match.elapsedMs / 1000).toFixed(1)}s`
                : busyNow
                  ? `正在通过 ${provider === 'acrcloud' ? 'ACRCloud' : 'Shazam'} 识别…`
                  : '轻触麦克风听歌识曲'}
            </Text>
            <Text style={{ color: s.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center', paddingHorizontal: 8 }}>
              {match.hint}
            </Text>

            {!!match.error && (
              <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: s.dark ? 'rgba(255,107,129,0.14)' : 'rgba(217,67,85,0.09)', width: '100%' }}>
                <Text accessibilityRole="alert" style={{ color: s.accent, fontSize: 12.5, lineHeight: 18, textAlign: 'center' }}>
                  {match.error}
                </Text>
              </View>
            )}
          </View>

          {/* Streamlined Recognition Mode Selector (Shazam 免Key | ACRCloud | 仅歌词秒搜) + inline ACRCloud Key config */}
          <View testID="audio-match-cloud-card" style={[{ padding: 14, borderRadius: 20, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, gap: 12 }, s.cardShadow]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: s.ink, fontSize: 14.5, fontWeight: '700' }}>识别方式</Text>
              {provider === 'acrcloud' && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setEditingKey(v => !v)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 }}
                >
                  <Ionicons name={editingKey ? 'chevron-up' : 'key-outline'} size={13} color={s.accent} />
                  <Text style={{ color: s.accent, fontSize: 12, fontWeight: '600' }}>
                    {editingKey ? '收起 Key 配置' : acrReady ? '修改 ACRCloud Key' : '填入 ACRCloud Key'}
                  </Text>
                </Pressable>
              )}
            </View>

            <View style={{ flexDirection: 'row', gap: 6 }}>
              {([
                ['shazam', 'Shazam 免Key'],
                ['acrcloud', 'ACRCloud'],
                ['off', '仅歌词秒搜'],
              ] as const).map(([key, label]) => {
                const active = provider === key;
                return (
                  <Pressable
                    key={key}
                    testID={`audio-match-provider-${key}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => void selectMode(key)}
                    style={{
                      flex: 1,
                      minHeight: 38,
                      borderRadius: 12,
                      backgroundColor: active ? s.control : softTile,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: active ? '#FFFFFF' : s.ink, fontSize: 13, fontWeight: '700' }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {provider === 'off' && (
              <Text style={{ color: s.muted, fontSize: 12, lineHeight: 17 }}>
                仅采集本地声纹特征并配合下方歌词秒搜；切换至 Shazam（免费免 Key）或 ACRCloud（华语/翻唱曲库更全）即可自动听歌识曲。
              </Text>
            )}

            {provider === 'shazam' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, backgroundColor: okBg }}>
                <Ionicons name="checkmark-circle" size={15} color={okColor} />
                <Text style={{ flex: 1, color: okColor, fontSize: 12, fontWeight: '600' }}>
                  Shazam 免 Key 已就绪 · 轻触麦克风录制片段自动识曲（支持华语主流与全球曲库）
                </Text>
              </View>
            )}

            {provider === 'acrcloud' && !editingKey && acrReady && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 12, backgroundColor: okBg }}>
                <Ionicons name="checkmark-circle" size={15} color={okColor} />
                <Text style={{ flex: 1, color: okColor, fontSize: 12, fontWeight: '600' }}>
                  ACRCloud 个人 Key 已就绪 · 轻触麦克风自动录制并识别（华语/翻唱识别最强）
                </Text>
              </View>
            )}

            {editingKey && provider === 'acrcloud' && (
              <View style={{ gap: 9 }}>
                <View style={{ padding: 11, borderRadius: 13, backgroundColor: softTile, gap: 5 }}>
                  <Text style={{ color: s.ink, fontSize: 12.5, fontWeight: '700' }}>ACRCloud 创建项目勾选指南（国内研发 · 华语曲库最全）</Text>
                  <Text style={{ color: s.muted, fontSize: 11.5, lineHeight: 17 }}>
                    1. Audio Source 勾选「Recorded Audio」（麦克风录音场景）{'\n'}
                    2. Audio Engine 选「Audio Fingerprinting」（勿只选 Humming 哼唱）{'\n'}
                    3. Buckets 下拉勾选「ACRCloud Music」后点 Confirm 创建{'\n'}
                    4. 复制项目详情里的 Host（如 identify-ap-southeast-1.acrcloud.com）、Access Key 与 Access Secret 填入下方
                  </Text>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => void Linking.openURL('https://console.acrcloud.com/')}
                    style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 2 }}
                  >
                    <Ionicons name="open-outline" size={13} color={s.accent} />
                    <Text style={{ color: s.accent, fontSize: 12, fontWeight: '700' }}>前往 ACRCloud 控制台</Text>
                  </Pressable>
                </View>
                <TextInput
                  testID="audio-match-acr-host"
                  accessibilityLabel="ACRCloud Host"
                  placeholder="Host，如 identify-ap-southeast-1.acrcloud.com"
                  placeholderTextColor={s.subtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={acrHost}
                  onChangeText={setAcrHost}
                  style={{ color: s.ink, backgroundColor: s.inputBg, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: s.cardBorder, fontSize: 13.5 }}
                />
                <TextInput
                  testID="audio-match-acr-key"
                  accessibilityLabel="ACRCloud Access Key"
                  placeholder="Access Key"
                  placeholderTextColor={s.subtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={acrKey}
                  onChangeText={setAcrKey}
                  style={{ color: s.ink, backgroundColor: s.inputBg, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: s.cardBorder, fontSize: 13.5 }}
                />
                <TextInput
                  testID="audio-match-acr-secret"
                  accessibilityLabel="ACRCloud Access Secret"
                  placeholder="Access Secret（仅存本机钥匙串）"
                  placeholderTextColor={s.subtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  value={acrSecret}
                  onChangeText={setAcrSecret}
                  style={{ color: s.ink, backgroundColor: s.inputBg, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: s.cardBorder, fontSize: 13.5 }}
                />
                <Pressable
                  testID="audio-match-cloud-save"
                  accessibilityRole="button"
                  disabled={savingConfig}
                  onPress={() => void saveCloudSettings()}
                  style={{ minHeight: 42, borderRadius: 14, backgroundColor: s.control, alignItems: 'center', justifyContent: 'center', opacity: savingConfig ? 0.5 : 1 }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
                    {savingConfig ? '正在保存…' : '保存 ACRCloud Key'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Cloud Recognition Match Highlight Card */}
          {match.lastCloudMatch && (
            <View style={[{ padding: 14, borderRadius: 20, backgroundColor: okBg, borderWidth: 1, borderColor: okColor + '44', gap: 4 }, s.cardShadow]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={17} color={okColor} />
                <Text style={{ color: okColor, fontSize: 12.5, fontWeight: '700' }}>
                  识曲命中 · {match.lastCloudMatch.provider === 'acrcloud' ? 'ACRCloud' : match.lastCloudMatch.provider === 'shazam' ? 'Shazam' : 'AudD'}
                  {match.lastCloudMatch.score !== undefined ? ` (${match.lastCloudMatch.score}%)` : ''}
                </Text>
              </View>
              <Text style={{ color: s.ink, fontSize: 16, fontWeight: '800' }}>{match.lastCloudMatch.title}</Text>
              <Text style={{ color: s.muted, fontSize: 13 }}>
                {match.lastCloudMatch.artist}
                {match.lastCloudMatch.album ? ` · ${match.lastCloudMatch.album}` : ''}
                {match.lastCloudMatch.releaseDate ? ` · ${match.lastCloudMatch.releaseDate}` : ''}
              </Text>
            </View>
          )}

          {/* Lyric / Hum Phrase Instant Multi-Platform Search */}
          <View style={[{ padding: 14, borderRadius: 20, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, gap: 10 }, s.cardShadow]}>
            <Text style={{ color: s.ink, fontSize: 15, fontWeight: '700' }}>歌词片段 / 关键词秒搜</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                testID="audio-match-phrase-input"
                accessibilityLabel="输入听到的歌词或关键词"
                placeholder="输入听到的任意一句歌词、歌名或歌手…"
                placeholderTextColor={s.subtle}
                value={phrase}
                onChangeText={setPhrase}
                onSubmitEditing={() => void services.audioMatch.searchByLyricOrPhrase(phrase)}
                style={{ flex: 1, color: s.ink, backgroundColor: s.inputBg, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 13, fontSize: 14 }}
              />
              <Pressable
                testID="audio-match-search-btn"
                accessibilityRole="button"
                disabled={match.searching || !phrase.trim()}
                onPress={() => void services.audioMatch.searchByLyricOrPhrase(phrase)}
                style={{ paddingHorizontal: 15, borderRadius: 13, backgroundColor: s.control, justifyContent: 'center', opacity: match.searching || !phrase.trim() ? 0.45 : 1 }}
              >
                {match.searching ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' }}>识曲</Text>}
              </Pressable>
            </View>
          </View>

          {/* Search / Match Candidates */}
          {match.results.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: s.ink, fontSize: 16, fontWeight: '700' }}>候选匹配 ({match.results.length})</Text>
              <View style={[{ borderRadius: 20, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, overflow: 'hidden' }, s.cardShadow]}>
                {match.results.map((track, idx) => (
                  <Pressable
                    key={`${track.origin.id}-${idx}`}
                    accessibilityRole="button"
                    onPress={() => playCandidate(track, match.results, idx)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: s.hairline }}
                  >
                    <Cover services={services} track={track} size={46} radius={10} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text numberOfLines={1} style={{ color: s.ink, fontSize: 14.5, fontWeight: '700' }}>{track.title}</Text>
                      <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12 }}>{track.artist}{track.album ? ` · ${track.album}` : ''}</Text>
                    </View>
                    <Ionicons name="play-circle" size={24} color={s.accent} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Recognition History */}
          {match.history.length > 0 && (
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: s.ink, fontSize: 16, fontWeight: '700' }}>最近识别记录</Text>
                <Pressable onPress={() => void services.audioMatch.clearHistory()}>
                  <Text style={{ color: s.muted, fontSize: 12.5 }}>清空</Text>
                </Pressable>
              </View>
              <View style={[{ borderRadius: 20, backgroundColor: s.card, borderWidth: 1, borderColor: s.cardBorder, overflow: 'hidden' }, s.cardShadow]}>
                {match.history.map((item, idx) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    onPress={() => playCandidate(item.track, match.history.map(h => h.track), idx)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: idx > 0 ? StyleSheet.hairlineWidth : 0, borderTopColor: s.hairline }}
                  >
                    <Cover services={services} track={item.track} size={42} radius={9} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text numberOfLines={1} style={{ color: s.ink, fontSize: 14, fontWeight: '600' }}>{item.track.title}</Text>
                      <Text numberOfLines={1} style={{ color: s.muted, fontSize: 12 }}>{item.track.artist}</Text>
                    </View>
                    <Ionicons name="play-outline" size={18} color={s.accent} />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
