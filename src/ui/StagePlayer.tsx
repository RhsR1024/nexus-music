import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import type { StageStyle } from '../app/preferences.ts';
import { trackKey, type Track } from '../domain/track.ts';
import { activeLyric, lyricSpokenText, type LyricLine } from '../lyrics/parser.ts';
import { lyricOffset } from '../lyrics/settings.ts';
import { convertLyricScript } from '../lyrics/chineseScript.ts';
import { Lyrics, useLyricDocument } from './Lyrics.tsx';
import { Text } from './Typography.tsx';

export const stageStyles = [['classic', '经典'], ['neon', '霓虹'], ['cyberpunk', '赛博'], ['aurora', '炫彩']] as const;

const backgrounds: Record<StageStyle, readonly [string, string, string]> = {
  classic: ['#060607', '#060607', '#060607'],
  neon: ['#0C1C2D', '#221238', '#07111C'],
  cyberpunk: ['#05212E', '#2D112B', '#080C18'],
  aurora: ['#1B244E', '#3A1F46', '#0D3329'],
};

const activeSweeps: Record<StageStyle, { lit: string; dim: string; glow: string }> = {
  classic: { lit: '#FFFFFF', dim: 'rgba(255,255,255,0.28)', glow: 'transparent' },
  neon: { lit: '#78F3FF', dim: 'rgba(80,220,255,0.34)', glow: '#00D8FF' },
  cyberpunk: { lit: '#FF7CE5', dim: 'rgba(255,90,190,0.34)', glow: '#FF2A9D' },
  aurora: { lit: '#9CFFD6', dim: 'rgba(130,255,215,0.34)', glow: '#52E8A8' },
};

function computeSweepProgress(line: LyricLine, posMs: number, nextStartMs?: number): number {
  if (line.words && line.words.length > 0) {
    const totalChars = line.words.reduce((acc, w) => acc + w.text.length, 0);
    if (totalChars > 0) {
      let litChars = 0;
      for (const w of line.words) {
        const end = Math.max(w.startMs + 80, w.endMs);
        if (posMs >= end) {
          litChars += w.text.length;
        } else if (posMs > w.startMs) {
          const frac = (posMs - w.startMs) / Math.max(80, end - w.startMs);
          litChars += w.text.length * Math.max(0, Math.min(1, frac));
          break;
        } else {
          break;
        }
      }
      return Math.max(0, Math.min(1, litChars / totalChars));
    }
  }
  const endMs = line.endMs ?? nextStartMs ?? (line.startMs + 4200);
  const span = Math.max(1200, endMs - line.startMs);
  return Math.max(0, Math.min(1, (posMs - line.startMs) / span));
}

function stageFontSize(text: string, width: number, fontScale: number): number {
  const len = text.trim().length;
  const base = len <= 6 ? 68 : len <= 12 ? 56 : len <= 20 ? 46 : len <= 30 ? 38 : 32;
  const widthFactor = Math.min(1.12, Math.max(0.78, width / 400));
  return Math.round(Math.min(76, Math.max(26, base * widthFactor * Math.min(1.18, fontScale))));
}

export function StagePlayer({
  services,
  track,
  lyricTrack,
  font,
  controls,
  onMore,
  onStyle,
  onLyricSource,
}: {
  services: Services;
  track: Track;
  lyricTrack: Track;
  font?: string;
  controls: ReactNode;
  onMore: () => void;
  onStyle: () => void;
  onLyricSource?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const prefs = useSyncExternalStore(services.preferences.subscribe, services.preferences.getSnapshot);
  const playback = useSyncExternalStore(services.playback.controller.subscribe, services.playback.controller.getSnapshot);
  const [choosing, setChoosing] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [error, setError] = useState('');
  const [lyricsRequest, setLyricsRequest] = useState(0);
  const { value: lyricResult } = useLyricDocument(services, lyricTrack);
  const doc = lyricResult?.document ?? null;
  const { width, fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.4;

  // High-frequency local clock for smooth 60fps word/char sweep between 500ms native progress ticks
  const [smoothMs, setSmoothMs] = useState(playback.position * 1000);
  const anchorRef = useRef({ posMs: playback.position * 1000, clock: Date.now() });
  useEffect(() => {
    anchorRef.current = { posMs: playback.position * 1000, clock: Date.now() };
    setSmoothMs(playback.position * 1000);
  }, [playback.position, playback.queue.currentId]);

  useEffect(() => {
    if (playback.phase !== 'ready' || playback.intent !== 'playing' || playback.buffering || playback.duration <= 0) return;
    let raf = 0;
    const tick = () => {
      const elapsed = Math.min(300, Math.max(0, (Date.now() - anchorRef.current.clock) * prefs.rate));
      setSmoothMs(anchorRef.current.posMs + elapsed);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playback.phase, playback.intent, playback.buffering, playback.duration, prefs.rate]);

  const key = trackKey(lyricTrack.origin);
  const offset = lyricOffset(prefs.lyricOffsetMs, prefs.lyricOffsets, key);
  const effectiveMs = smoothMs - offset;

  const activeIdx = useMemo(() => {
    if (!doc?.synced || !doc.lines.length) return -1;
    return activeLyric(doc.lines, smoothMs, offset);
  }, [doc, smoothMs, offset]);

  const activeLine = activeIdx >= 0 && doc?.synced ? doc.lines[activeIdx] : undefined;
  const nextLine = activeIdx >= 0 && doc?.synced ? doc.lines[activeIdx + 1] : undefined;

  // Smooth outgoing ghost + incoming kinetic transition
  const prevTextRef = useRef('');
  const [outgoingText, setOutgoingText] = useState('');
  const enterAnim = useRef(new Animated.Value(1)).current;
  const exitAnim = useRef(new Animated.Value(0)).current;

  const currentDisplayText = useMemo(() => {
    if (activeLine) return convertLyricScript(lyricSpokenText(activeLine), prefs.lyricChineseMode);
    if (doc?.synced && doc.lines[0]) return convertLyricScript(lyricSpokenText(doc.lines[0]), prefs.lyricChineseMode);
    if (doc?.plain?.length) return convertLyricScript(doc.plain[0]!, prefs.lyricChineseMode);
    return track.title;
  }, [activeLine, doc, prefs.lyricChineseMode, track.title]);

  useEffect(() => {
    if (prevTextRef.current && prevTextRef.current !== currentDisplayText) {
      setOutgoingText(prevTextRef.current);
      enterAnim.setValue(0);
      exitAnim.setValue(1);
      Animated.parallel([
        Animated.timing(enterAnim, { toValue: 1, duration: 360, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(exitAnim, { toValue: 0, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
    }
    prevTextRef.current = currentDisplayText;
  }, [currentDisplayText]);

  const save = (patch: { stageStyle?: StageStyle; stageBackdrop?: boolean }) => {
    void services.preferences.update(patch).then(() => setError('')).catch(() => setError('舞台设置未保存，原设置保留'));
  };

  const backdrop = prefs.stageBackdrop && prefs.stageStyle !== 'classic';
  const palette = activeSweeps[prefs.stageStyle];
  const sweep = activeLine ? computeSweepProgress(activeLine, effectiveMs, nextLine?.startMs) : 1;
  const chars = useMemo(() => Array.from(currentDisplayText), [currentDisplayText]);
  const litExact = sweep * chars.length;
  const fullLitCount = Math.floor(litExact);
  const partialFrac = litExact - fullLitCount;
  const heroSize = stageFontSize(currentDisplayText, width, fontScale);
  const showTrans = prefs.lyricStyle.showTranslation !== false && !!activeLine?.translation;
  const showRoma = prefs.lyricStyle.showRomanization === true && !!activeLine?.romanization;

  const toggleAux = (field: 'showTranslation' | 'showRomanization') => {
    const cur = field === 'showTranslation' ? prefs.lyricStyle.showTranslation !== false : prefs.lyricStyle.showRomanization === true;
    void services.preferences.updateLyricStyle({ [field]: !cur }).catch(() => {});
  };

  return (
    <View testID="stage-player" style={{ flex: 1, minHeight: 0, backgroundColor: '#060607' }}>
      <Text accessibilityLabel={track.title} style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1, fontSize: 1, color: 'transparent' }}>{track.title}</Text>

      {/* Edge-to-edge full-bleed background */}
      {backdrop && (
        <LinearGradient
          testID="stage-backdrop"
          pointerEvents="none"
          colors={backgrounds[prefs.stageStyle]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Top HUD controls (toggled cleanly by tapping stage) */}
      {chromeVisible && (
        <View style={{ position: 'absolute', top: Math.max(insets.top + 6, 50), right: 14, flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 5 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="切换译文"
            onPress={() => toggleAux('showTranslation')}
            style={{ paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: prefs.lyricStyle.showTranslation !== false ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>译</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="切换罗马音"
            onPress={() => toggleAux('showRomanization')}
            style={{ paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: prefs.lyricStyle.showRomanization === true ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>音</Text>
          </Pressable>
          {onLyricSource && (
            <Pressable accessibilityRole="button" accessibilityLabel="选择歌词来源" onPress={onLyricSource} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="language-outline" size={18} color="rgba(255,255,255,0.62)" />
            </Pressable>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel="打开全部歌词与偏移设置" onPress={() => setLyricsRequest(v => v + 1)} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="text-outline" size={18} color="rgba(255,255,255,0.62)" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="更多播放控制" onPress={onMore} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="ellipsis-horizontal" size={20} color="rgba(255,255,255,0.72)" />
          </Pressable>
        </View>
      )}

      {/* Hidden full-lyrics sheet host triggered by the text-outline button */}
      <View style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} pointerEvents="none">
        <Lyrics services={services} track={lyricTrack} font={font} chromeOnly chrome={false} openRequest={lyricsRequest} />
      </View>

      {/* Full-bleed giant single-line active lyric stage (tap to toggle chrome!) */}
      <Pressable
        testID="stage-lyric-viewport"
        onPress={() => {
          if (choosing) setChoosing(false);
          else setChromeVisible(v => !v);
        }}
        style={{ flex: 1, minHeight: 0, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 22 }}
      >
        {/* Outgoing ghost lyric fading & lifting smoothly */}
        {!!outgoingText && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 22,
              right: 22,
              alignItems: 'center',
              opacity: exitAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.24] }),
              transform: [
                { translateY: exitAnim.interpolate({ inputRange: [0, 1], outputRange: [-46, 0] }) },
                { scale: exitAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.02] }) },
              ],
            }}
          >
            <Text style={{ fontSize: Math.max(24, heroSize * 0.88), lineHeight: Math.round(heroSize * 1.08), fontWeight: '900', color: 'rgba(255,255,255,0.55)', textAlign: 'center', fontFamily: font }}>
              {outgoingText}
            </Text>
          </Animated.View>
        )}

        {/* Incoming & sweeping active giant lyric */}
        <Animated.View
          testID="lyric-stage-group"
          accessible
          accessibilityRole="button"
          accessibilityLabel={currentDisplayText}
          accessibilityValue={{ text: activeLine?.words ? '逐字歌词' : activeLine?.timedCues?.length ? '部分逐字歌词' : '行级歌词' }}
          style={{
            width: '100%',
            alignItems: 'center',
            gap: 14,
            opacity: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
            transform: [
              { translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              { scale: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) },
            ],
          }}
        >
          {/* Chromatic accent offset layer for cyberpunk & aurora */}
          {(prefs.stageStyle === 'cyberpunk' || prefs.stageStyle === 'aurora') && (
            <Text
              pointerEvents="none"
              style={{
                position: 'absolute',
                fontSize: heroSize,
                lineHeight: Math.round(heroSize * 1.18),
                fontWeight: '900',
                color: prefs.stageStyle === 'cyberpunk' ? 'rgba(0,240,255,0.48)' : 'rgba(168,120,255,0.42)',
                textAlign: 'center',
                fontFamily: font,
                transform: prefs.stageStyle === 'cyberpunk' ? [{ translateX: -2.5 }, { translateY: 1.5 }] : [{ translateX: 2.0 }, { translateY: -1.5 }],
              }}
            >
              {currentDisplayText}
            </Text>
          )}

          {/* Character-by-character sweeping highlight (works for BOTH word-timed & LRC lyrics!) */}
          <Text
            style={{
              fontSize: heroSize,
              lineHeight: Math.round(heroSize * 1.18),
              fontWeight: '900',
              letterSpacing: -0.6,
              textAlign: 'center',
              fontFamily: font,
              textShadowColor: prefs.stageStyle === 'classic' ? 'transparent' : palette.glow,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: prefs.stageStyle === 'classic' ? 0 : 18,
            }}
          >
            {chars.map((ch, idx) => {
              const color =
                idx < fullLitCount
                  ? palette.lit
                  : idx === fullLitCount && partialFrac > 0.35
                    ? palette.lit
                    : palette.dim;
              return (
                <Text key={idx} style={{ color, fontSize: heroSize, lineHeight: Math.round(heroSize * 1.18), fontWeight: '900', fontFamily: font }}>
                  {ch}
                </Text>
              );
            })}
          </Text>

          {showTrans && activeLine?.translation && (
            <Text style={{ color: 'rgba(255,255,255,0.68)', fontSize: Math.round(16 * Math.min(1.2, fontScale)), fontWeight: '600', textAlign: 'center', lineHeight: 24 }}>
              {convertLyricScript(activeLine.translation, prefs.lyricChineseMode)}
            </Text>
          )}
          {showRoma && activeLine?.romanization && (
            <Text style={{ color: 'rgba(255,255,255,0.46)', fontSize: Math.round(13.5 * Math.min(1.2, fontScale)), fontWeight: '500', textAlign: 'center', lineHeight: 20 }}>
              {activeLine.romanization}
            </Text>
          )}
        </Animated.View>
      </Pressable>

      {/* Bottom HUD Drawer (hidden smoothly when user taps stage for pure lyrics immersion) */}
      {chromeVisible && (
        <View style={{ flexShrink: 0, gap: 6, paddingHorizontal: 22, paddingBottom: Math.max(insets.bottom + 12, 22) }}>
          {choosing ? (
            <View testID="stage-style-panel" style={{ gap: 8, padding: 14, borderRadius: 20, backgroundColor: 'rgba(20,22,28,0.82)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13.5, fontWeight: '700' }}>舞台视觉风格</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="收起舞台样式" onPress={() => setChoosing(false)} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={18} color="rgba(255,255,255,0.75)" />
                </Pressable>
              </View>
              <ScrollView horizontal={!largeText} showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row', flexWrap: largeText ? 'wrap' : 'nowrap', gap: 8 }}>
                {stageStyles.map(([id, title]) => {
                  const selected = prefs.stageStyle === id;
                  return (
                    <Pressable
                      key={id}
                      testID={`stage-style-${id}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => save({ stageStyle: id })}
                      style={{
                        paddingHorizontal: largeText ? 12 : 18,
                        minHeight: largeText ? 48 : 36,
                        borderRadius: largeText ? 24 : 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selected ? '#FFFFFF' : 'rgba(255,255,255,0.06)',
                        borderWidth: 1,
                        borderColor: selected ? '#FFFFFF' : 'rgba(255,255,255,0.24)',
                      }}
                    >
                      <Text numberOfLines={1} style={{ color: selected ? '#111111' : '#FFFFFF', fontSize: largeText ? 15 : 14, fontWeight: selected ? '700' : '500' }}>{title}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: largeText ? 44 : 34 }}>
                <Text style={{ color: 'rgba(255,255,255,0.88)', flex: 1, fontSize: 14, fontWeight: '500' }}>动态背景</Text>
                <Switch accessibilityLabel="舞台背景" value={prefs.stageBackdrop} onValueChange={value => save({ stageBackdrop: value })} trackColor={{ true: '#B5B7BC', false: 'rgba(255,255,255,0.22)' }} thumbColor="#FFFFFF" />
              </View>
              {!!error && <Text accessibilityRole="alert" style={{ color: '#FFD7BA' }}>{error}</Text>}
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
              <Pressable
                testID="stage-style-selector"
                accessibilityRole="button"
                accessibilityLabel="舞台样式"
                accessibilityValue={{ text: stageStyles.find(([id]) => id === prefs.stageStyle)![1] }}
                onPress={() => setChoosing(true)}
                style={{ minHeight: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)', backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center' }}
              >
                <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '600' }}>舞台样式 · {stageStyles.find(([id]) => id === prefs.stageStyle)![1]}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="调整播放界面" onPress={onStyle} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="options-outline" size={20} color="rgba(255,255,255,0.68)" />
              </Pressable>
            </View>
          )}
          {controls}
        </View>
      )}
    </View>
  );
}
