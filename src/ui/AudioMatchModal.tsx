import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import type { Track } from '../domain/track.ts';
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

  useEffect(() => {
    if (!visible && match.listening) {
      void services.audioMatch.stopListening();
    }
  }, [visible, match.listening]);

  function toggleListen() {
    if (match.listening) {
      void services.audioMatch.stopListening();
    } else {
      services.playback.controller.pause();
      void services.audioMatch.startListening(6000);
    }
  }

  function playCandidate(track: Track, list: readonly Track[], index: number) {
    void services.audioMatch.recordMatch(track, 'lyric-phrase');
    services.playTracks(list, index);
    onClose();
  }

  const ringScale = 1 + Math.min(0.65, match.level * 0.75);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View testID="audio-match-modal" style={{ flex: 1 }}>
        <LinearGradient colors={[...s.sheetGradient]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />

        {/* Header */}
        <View style={{ paddingTop: Math.max(insets.top + 8, 22), paddingHorizontal: 18, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭听歌识曲"
            onPress={onClose}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: s.chip, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="close" size={22} color={s.ink} />
          </Pressable>
          <Text style={{ color: s.ink, fontSize: 18, fontWeight: '700' }}>听歌识曲</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(insets.bottom + 28, 40), gap: 18 }}>
          {/* Pulsing Microphone Orb */}
          <View style={{ alignItems: 'center', paddingVertical: 18, gap: 16 }}>
            <View style={{ width: 176, height: 176, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  position: 'absolute',
                  width: 150,
                  height: 150,
                  borderRadius: 75,
                  backgroundColor: s.accent + '1A',
                  transform: [{ scale: match.listening ? ringScale * 1.15 : 1 }],
                }}
              />
              <View
                style={{
                  position: 'absolute',
                  width: 118,
                  height: 118,
                  borderRadius: 59,
                  backgroundColor: s.accent + '30',
                  transform: [{ scale: match.listening ? ringScale : 1 }],
                }}
              />
              <Pressable
                testID="audio-match-mic-btn"
                accessibilityRole="button"
                accessibilityLabel={match.listening ? '停止采集' : '开始听歌识曲'}
                onPress={toggleListen}
                style={[{ width: 88, height: 88, borderRadius: 44, backgroundColor: s.control, alignItems: 'center', justifyContent: 'center' }, s.cardShadow]}
              >
                <Ionicons name={match.listening ? 'stop' : 'mic'} size={34} color="#FFFFFF" />
              </Pressable>
            </View>

            <Text style={{ color: s.ink, fontSize: 16, fontWeight: '700' }}>
              {match.listening ? `正在采集环境声纹… ${(match.elapsedMs / 1000).toFixed(1)}s` : '点击开始环境声纹采样'}
            </Text>
            <Text style={{ color: s.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center', paddingHorizontal: 10 }}>
              {match.hint}
            </Text>
            {!!match.error && (
              <Text accessibilityRole="alert" style={{ color: s.accent, fontSize: 12.5, textAlign: 'center' }}>
                {match.error}
              </Text>
            )}
          </View>

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
