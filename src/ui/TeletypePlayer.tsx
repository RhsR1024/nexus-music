import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import type { TeletypeTheme } from '../app/preferences.ts';
import { trackKey, type Track } from '../domain/track.ts';
import { displayLyricIndex, lyricLineProgress } from '../lyrics/parser.ts';
import { convertLyricScript } from '../lyrics/chineseScript.ts';
import { lyricOffset } from '../lyrics/settings.ts';
import { teletypeVisibleChars } from '../lyrics/teletype.ts';
import { Cover } from './Cover.tsx';
import { useLyricDocument } from './Lyrics.tsx';
import { PlaybackProgress } from './PlaybackProgress.tsx';
import { Text } from './Typography.tsx';
import { useStablePlaybackStatus } from './usePlaybackStatus.ts';

export { teletypeVisibleChars };

const PALETTES: Record<
  TeletypeTheme,
  { label: string; bg: string; paper: string; ink: string; muted: string; accent: string; border: string; keyBg: string; keyInk: string }
> = {
  paper: {
    label: '复古纸带',
    bg: '#ECE4D5',
    paper: '#F7F2E7',
    ink: '#26211C',
    muted: '#746A5E',
    accent: '#B54032',
    border: '#D6CBB8',
    keyBg: '#DFD5C3',
    keyInk: '#26211C',
  },
  terminal: {
    label: '绿磷终端',
    bg: '#09100C',
    paper: '#0F1913',
    ink: '#78F3A4',
    muted: '#458F62',
    accent: '#A9FFCB',
    border: '#1D3828',
    keyBg: '#16291D',
    keyInk: '#78F3A4',
  },
  amber: {
    label: '琥珀电传',
    bg: '#130E08',
    paper: '#1B140C',
    ink: '#FFB95A',
    muted: '#9C6D32',
    accent: '#FFD48F',
    border: '#3C2A14',
    keyBg: '#2A1D0E',
    keyInk: '#FFB95A',
  },
};

const NEXT_THEME: Record<TeletypeTheme, TeletypeTheme> = {
  paper: 'terminal',
  terminal: 'amber',
  amber: 'paper',
};

const MONO_FONT = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export function TeletypePlayer({
  services,
  track,
  favoriteTrack,
  lyricTrack,
  onMore,
  onStyle,
  onQueue,
  onComments,
}: {
  services: Services;
  track: Track;
  favoriteTrack: Track;
  lyricTrack: Track;
  onMore: () => void;
  onStyle: () => void;
  onQueue: () => void;
  onComments?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const state = useSyncExternalStore(services.playback.controller.subscribe, services.playback.controller.getSnapshot);
  const preferences = useSyncExternalStore(services.preferences.subscribe, services.preferences.getSnapshot);
  useSyncExternalStore(services.songFavorites.subscribe, services.songFavorites.getSnapshot);
  const status = useStablePlaybackStatus(state, { resolving: '正在择源…', buffering: '缓冲中…' });

  const { value: lyricResult } = useLyricDocument(services, lyricTrack);

  const [cursorOn, setCursorOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setCursorOn(v => !v), 520);
    return () => clearInterval(id);
  }, []);

  const themeKey = preferences.teletypeTheme;
  const pal = PALETTES[themeKey];
  const doc = lyricResult?.document;
  const posMs = state.position * 1000;
  const offsetMs = lyricOffset(preferences.lyricOffsetMs, preferences.lyricOffsets, trackKey(lyricTrack.origin));
  const activeIdx = doc?.synced ? displayLyricIndex(doc.lines, posMs, offsetMs) : -1;

  const historyLines = useMemo(() => {
    if (!doc) return [] as { idx: number; text: string; time: string }[];
    if (!doc.synced) {
      return doc.plain.slice(0, 8).map((text, idx) => ({ idx, text: convertLyricScript(text, preferences.lyricChineseMode), time: '--:--' }));
    }
    const end = Math.max(0, activeIdx);
    const start = Math.max(0, end - 5);
    return doc.lines.slice(start, end).map((line, i) => {
      const sec = Math.max(0, Math.floor(line.startMs / 1000));
      const mm = String(Math.floor(sec / 60)).padStart(2, '0');
      const ss = String(sec % 60).padStart(2, '0');
      return { idx: start + i, text: convertLyricScript(line.text, preferences.lyricChineseMode), time: `${mm}:${ss}` };
    });
  }, [doc, activeIdx, preferences.lyricChineseMode]);

  const activeLine = doc?.synced && activeIdx >= 0 ? doc.lines[activeIdx] : undefined;
  const nextLine = doc?.synced && activeIdx >= 0 ? doc.lines[activeIdx + 1] : undefined;
  const activeFull = activeLine ? convertLyricScript(activeLine.text, preferences.lyricChineseMode) : '';
  const progress = activeLine ? lyricLineProgress(activeLine, posMs - offsetMs, nextLine?.startMs) : 0;
  const chars = Array.from(activeFull);
  const typedText = activeLine ? chars.slice(0, Math.max(1, Math.ceil(chars.length * Math.max(0.05, progress)))).join('') : '';

  const isFav = services.songFavorites.isFavorite(favoriteTrack);
  const controller = services.playback.controller;
  const qualityTag = state.media?.quality ? state.media.quality.toUpperCase() : preferences.quality.toUpperCase();

  return (
    <View testID="teletype-player" style={[styles.root, { backgroundColor: pal.bg }]}>
      {/* Top Telegraph Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 52), borderBottomColor: pal.border }]}>
        <View style={{ width: 44 }} />
        <Pressable
          testID="teletype-theme-toggle"
          accessibilityRole="button"
          accessibilityLabel="切换打字机色带"
          onPress={() => void services.preferences.update({ teletypeTheme: NEXT_THEME[themeKey] }).catch(() => {})}
          style={[styles.stampPill, { backgroundColor: pal.keyBg, borderColor: pal.border }]}
        >
          <Text style={{ fontFamily: MONO_FONT, fontSize: 11.5, fontWeight: '700', color: pal.ink }}>
            TTY · {pal.label}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="更多播放控制" onPress={onMore} style={styles.hit}>
          <Ionicons name="ellipsis-horizontal" size={22} color={pal.ink} />
        </Pressable>
      </View>

      {/* Perforated Tape Sheet */}
      <View style={[styles.tapeCard, { backgroundColor: pal.paper, borderColor: pal.border }]}>
        {/* Sprocket holes row */}
        <View style={styles.sprockets}>
          {Array.from({ length: 14 }).map((_, i) => (
            <View key={i} style={[styles.hole, { backgroundColor: pal.bg, borderColor: pal.border }]} />
          ))}
        </View>

        {/* Dispatch Metadata Header */}
        <View style={[styles.dispatchHeader, { borderBottomColor: pal.border }]}>
          <Cover services={services} track={track} size={52} radius={6} />
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <Text numberOfLines={1} style={{ fontFamily: MONO_FONT, fontSize: 16.5, fontWeight: '700', color: pal.ink }}>
              {track.title}
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: MONO_FONT, fontSize: 12, color: pal.muted }}>
              BY: {track.artist}
            </Text>
            <Text numberOfLines={1} style={{ fontFamily: MONO_FONT, fontSize: 10.5, color: pal.accent }}>
              SIG/{qualityTag} · {state.intent === 'playing' ? 'TX-LIVE' : 'STANDBY'}{status.text ? ` · ${status.text}` : ''}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="收藏歌曲"
            onPress={() => void services.songFavorites.toggle(favoriteTrack).catch(() => Alert.alert('收藏未保存'))}
            style={styles.hit}
          >
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? pal.accent : pal.muted} />
          </Pressable>
        </View>

        {/* Scrolling Telegraph Lyrics */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 10 }} showsVerticalScrollIndicator={false}>
          {historyLines.map(line => (
            <View key={line.idx} style={{ flexDirection: 'row', gap: 10 }}>
              <Text style={{ fontFamily: MONO_FONT, fontSize: 11, color: pal.muted, opacity: 0.72, marginTop: 3 }}>{line.time}</Text>
              <Text style={{ flex: 1, fontFamily: MONO_FONT, fontSize: 14.5, lineHeight: 22, color: pal.muted }}>{line.text}</Text>
            </View>
          ))}

          {activeLine ? (
            <View style={[styles.activeRow, { borderLeftColor: pal.accent, backgroundColor: pal.bg + '88' }]}>
              <Text style={{ fontFamily: MONO_FONT, fontSize: 18, fontWeight: '700', lineHeight: 27, color: pal.ink }}>
                {typedText}
                <Text style={{ color: pal.accent, opacity: cursorOn ? 1 : 0.15 }}>▌</Text>
              </Text>
              {!!activeLine.translation && (
                <Text style={{ fontFamily: MONO_FONT, fontSize: 12.5, lineHeight: 19, color: pal.muted, marginTop: 4 }}>
                  {activeLine.translation}
                </Text>
              )}
            </View>
          ) : (
            <Text style={{ fontFamily: MONO_FONT, fontSize: 14, color: pal.muted, paddingVertical: 16 }}>
              {!lyricResult ? '>> RECEIVING LYRIC FEED...' : '>> NO SYNCED TELEGRAPH LYRICS AVAILABLE'}
              <Text style={{ color: pal.accent, opacity: cursorOn ? 1 : 0.15 }}>▌</Text>
            </Text>
          )}
        </ScrollView>
      </View>

      {/* Mechanical Keycap Console */}
      <View style={[styles.console, { paddingBottom: Math.max(insets.bottom + 14, 24) }]}>
        <PlaybackProgress services={services} variant={themeKey === 'paper' ? 'paper' : 'default'} />

        <View style={styles.keyRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="上一首"
            onPress={() => services.playback.next(-1)}
            style={[styles.keycap, { backgroundColor: pal.keyBg, borderColor: pal.border }]}
          >
            <Text style={{ fontFamily: MONO_FONT, fontSize: 13, fontWeight: '700', color: pal.keyInk }}>◀◀ PREV</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={state.intent === 'playing' ? '暂停' : '播放'}
            onPress={() => { if (state.intent === 'playing') controller.pause(); else void controller.play(); }}
            style={[styles.keycapPrimary, { backgroundColor: pal.accent }]}
          >
            <Text style={{ fontFamily: MONO_FONT, fontSize: 14, fontWeight: '800', color: themeKey === 'paper' ? '#FFFFFF' : '#111111' }}>
              {state.intent === 'playing' ? '❚❚ HALT' : '▶ SEND'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="下一首"
            onPress={() => services.playback.next()}
            style={[styles.keycap, { backgroundColor: pal.keyBg, borderColor: pal.border }]}
          >
            <Text style={{ fontFamily: MONO_FONT, fontSize: 13, fontWeight: '700', color: pal.keyInk }}>NEXT ▶▶</Text>
          </Pressable>
        </View>

        <View style={styles.subKeys}>
          <Pressable accessibilityRole="button" onPress={onQueue} style={[styles.miniKey, { backgroundColor: pal.keyBg, borderColor: pal.border }]}>
            <Text style={{ fontFamily: MONO_FONT, fontSize: 11.5, fontWeight: '700', color: pal.keyInk }}>QUEUE</Text>
          </Pressable>
          {onComments && (
            <Pressable accessibilityRole="button" onPress={onComments} style={[styles.miniKey, { backgroundColor: pal.keyBg, borderColor: pal.border }]}>
              <Text style={{ fontFamily: MONO_FONT, fontSize: 11.5, fontWeight: '700', color: pal.keyInk }}>LOG</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" onPress={onStyle} style={[styles.miniKey, { backgroundColor: pal.keyBg, borderColor: pal.border }]}>
            <Text style={{ fontFamily: MONO_FONT, fontSize: 11.5, fontWeight: '700', color: pal.keyInk }}>STYLE</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  stampPill: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  hit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  tapeCard: { flex: 1, marginHorizontal: 16, marginVertical: 12, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  sprockets: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 7 },
  hole: { width: 7, height: 7, borderRadius: 3.5, borderWidth: 1 },
  dispatchHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  activeRow: { padding: 12, borderLeftWidth: 3, borderRadius: 4 },
  console: { paddingHorizontal: 20, gap: 12 },
  keyRow: { flexDirection: 'row', gap: 10 },
  keycap: { flex: 1, minHeight: 48, borderRadius: 8, borderWidth: 1, borderBottomWidth: 3, alignItems: 'center', justifyContent: 'center' },
  keycapPrimary: { flex: 1.25, minHeight: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  subKeys: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  miniKey: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 6, borderWidth: 1 },
});
