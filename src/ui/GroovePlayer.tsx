import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Alert, Animated, AppState, Easing, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Services } from '../app/services.ts';
import type { GrooveSpinSpeed } from '../app/preferences.ts';
import { trackKey, type Track } from '../domain/track.ts';
import { activeLyric } from '../lyrics/parser.ts';
import { LyricPreview } from '../lyrics/preview.ts';
import { convertLyricScript } from '../lyrics/chineseScript.ts';
import { lyricOffset } from '../lyrics/settings.ts';
import { SheetModal } from './AdaptiveModal.tsx';
import { Cover } from './Cover.tsx';
import { Lyrics } from './Lyrics.tsx';
import { PlaybackProgress } from './PlaybackProgress.tsx';
import { SkipGlyph } from './SkipGlyph.tsx';
import { Text } from './Typography.tsx';
import { useStablePlaybackStatus } from './usePlaybackStatus.ts';

const SPIN_DURATION_MS: Record<GrooveSpinSpeed, number> = {
  slow: 22000,
  normal: 14000,
  fast: 8800,
};

const SPIN_LABELS: Record<GrooveSpinSpeed, string> = {
  slow: '慢速 0.7x',
  normal: '标准 1x',
  fast: '动感 1.4x',
};

const NEXT_SPEED: Record<GrooveSpinSpeed, GrooveSpinSpeed> = {
  slow: 'normal',
  normal: 'fast',
  fast: 'slow',
};

export function GroovePlayer({
  services,
  track,
  favoriteTrack,
  lyricTrack,
  font,
  onMore,
  onStyle,
  onQueue,
  onComments,
}: {
  services: Services;
  track: Track;
  favoriteTrack: Track;
  lyricTrack: Track;
  font?: string;
  onMore: () => void;
  onStyle: () => void;
  onQueue: () => void;
  onComments?: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const state = useSyncExternalStore(services.playback.controller.subscribe, services.playback.controller.getSnapshot);
  const spectrum = useSyncExternalStore(services.playback.spectrum.subscribe, services.playback.spectrum.getSnapshot);
  const preferences = useSyncExternalStore(services.preferences.subscribe, services.preferences.getSnapshot);
  useSyncExternalStore(services.songFavorites.subscribe, services.songFavorites.getSnapshot);
  const status = useStablePlaybackStatus(state, { resolving: '正在选择音源…', buffering: '缓冲中…' });

  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');

  const preview = useMemo(() => new LyricPreview((t, sig) => services.lyrics.load(t, sig)), [services]);
  const lyricSnap = useSyncExternalStore(preview.subscribe, preview.getSnapshot);
  useEffect(() => {
    void preview.load(lyricTrack);
    return () => preview.clear();
  }, [preview, lyricTrack]);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(v => { if (alive) setReduceMotion(v); });
    const m = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const a = AppState.addEventListener('change', s => setForeground(s === 'active'));
    return () => { alive = false; m.remove(); a.remove(); };
  }, []);

  const playing = state.intent === 'playing' && !state.buffering;
  const spinSpeed = preferences.grooveSpinSpeed;
  const rotation = useMemo(() => new Animated.Value(0), [trackKey(track.origin)]);

  useEffect(() => {
    let active = true;
    let anim: Animated.CompositeAnimation | undefined;
    const dur = SPIN_DURATION_MS[spinSpeed];
    const turn = (v: number) => {
      if (!active) return;
      const phase = ((v % 1) + 1) % 1;
      rotation.setValue(phase);
      anim = Animated.timing(rotation, {
        toValue: phase + 1,
        duration: dur,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      });
      anim.start(({ finished }) => { if (finished && active) turn(phase); });
    };
    rotation.stopAnimation(v => {
      if (active && playing && !reduceMotion && foreground) turn(v);
    });
    return () => { active = false; anim?.stop(); rotation.stopAnimation(); };
  }, [playing, spinSpeed, reduceMotion, foreground, rotation]);

  const doc = lyricSnap.document;
  const offsetMs = lyricOffset(preferences.lyricOffsetMs, preferences.lyricOffsets, trackKey(lyricTrack.origin));
  const activeIdx = doc?.synced ? activeLyric(doc.lines, state.position * 1000, offsetMs) : -1;
  const lineText = (idx: number) => {
    if (!doc) return '';
    if (!doc.synced) return doc.plain[idx]?.trim() ?? '';
    const raw = idx >= 0 && idx < doc.lines.length ? doc.lines[idx]?.text?.trim() ?? '' : '';
    return raw ? convertLyricScript(raw, preferences.lyricChineseMode) : '';
  };
  const prevLine = activeIdx > 0 ? lineText(activeIdx - 1) : '';
  const currLine = doc?.synced ? (activeIdx >= 0 ? lineText(activeIdx) : lineText(0)) : lineText(0);
  const nextLine = doc?.synced && activeIdx >= 0 ? lineText(activeIdx + 1) : '';

  const energy = useMemo(() => {
    if (!playing || !spectrum.bands.length) return 0;
    const sum = spectrum.bands.slice(0, 8).reduce((a, b) => a + b, 0);
    return Math.min(1, sum / 5.5);
  }, [playing, spectrum.bands]);

  const discSize = Math.max(216, Math.min(width - 64, height * 0.37, 326));
  const labelSize = Math.round(discSize * 0.42);
  const isFav = services.songFavorites.isFavorite(favoriteTrack);
  const controller = services.playback.controller;

  const spinTransform = {
    transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
  };

  return (
    <View testID="groove-player" style={styles.root}>
      <LinearGradient colors={['#090A0F', '#151320', '#0D0B14']} start={{ x: 0.2, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* Top right controls */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 8, 52) }]}>
        <View style={{ width: 44 }} />
        <Pressable
          testID="groove-speed-toggle"
          accessibilityRole="button"
          accessibilityLabel="切换黑胶转速"
          onPress={() => void services.preferences.update({ grooveSpinSpeed: NEXT_SPEED[spinSpeed] }).catch(() => {})}
          style={styles.speedPill}
        >
          <Ionicons name="disc-outline" size={14} color="#E9D6B0" />
          <Text style={styles.speedText}>{SPIN_LABELS[spinSpeed]}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="更多播放控制" onPress={onMore} style={styles.topBtn}>
          <Ionicons name="ellipsis-horizontal" size={22} color="#F2EDE6" />
        </Pressable>
      </View>

      {/* Concentric Vinyl Groove Platter + Spectrum Beat Halo */}
      <View style={styles.stage}>
        <View style={{ width: discSize + 36, height: discSize + 36, alignItems: 'center', justifyContent: 'center' }}>
          {/* Reactive ambient energy halo */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              width: discSize + 24 + energy * 16,
              height: discSize + 24 + energy * 16,
              borderRadius: (discSize + 40) / 2,
              backgroundColor: `rgba(232, 168, 108, ${0.09 + energy * 0.16})`,
            }}
          />

          {/* Spinning Disc with concentric spiral grooves */}
          <Animated.View
            style={[
              {
                width: discSize,
                height: discSize,
                borderRadius: discSize / 2,
                backgroundColor: '#111116',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.12)',
              },
              spinTransform,
            ]}
          >
            {[0.94, 0.87, 0.8, 0.73, 0.66, 0.59, 0.52].map((ratio, idx) => {
              const d = discSize * ratio;
              const illuminated = idx === 2 || idx === 3;
              return (
                <View
                  key={idx}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    width: d,
                    height: d,
                    borderRadius: d / 2,
                    borderWidth: illuminated ? 1.1 : 0.7,
                    borderColor: illuminated ? 'rgba(244,200,140,0.28)' : 'rgba(255,255,255,0.09)',
                  }}
                />
              );
            })}
            <View
              style={{
                width: labelSize + 8,
                height: labelSize + 8,
                borderRadius: (labelSize + 8) / 2,
                borderWidth: 3,
                borderColor: '#D6AE7B',
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Cover services={services} track={track} size={labelSize} radius={labelSize / 2} />
            </View>
            <View style={{ position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: '#141418', borderWidth: 2, borderColor: '#E9D6B0' }} />
          </Animated.View>

          {/* Stylus Laser Beam */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              right: 8,
              top: 18,
              width: 3,
              height: discSize * 0.44,
              borderRadius: 1.5,
              backgroundColor: playing ? '#F2C689' : 'rgba(255,255,255,0.28)',
              transform: [{ rotate: playing ? '22deg' : '6deg' }],
            }}
          />
        </View>
      </View>

      {/* Groove Focal Lyric Ribbon */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="查看完整歌词"
        onPress={() => setLyricsOpen(true)}
        style={styles.grooveLyricBand}
      >
        <Text numberOfLines={1} style={styles.lyricDim}>{prevLine || ' '}</Text>
        <Text numberOfLines={2} style={[styles.lyricActive, font ? { fontFamily: font } : undefined]}>
          {currLine || (lyricSnap.loading ? '正在载入螺旋槽歌词…' : '暂无同步歌词，轻触查看全部')}
        </Text>
        <Text numberOfLines={1} style={styles.lyricDim}>{nextLine || ' '}</Text>
      </Pressable>

      {/* Metadata + Progress + Transport */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 14, 24) }]}>
        <View style={styles.metaRow}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text numberOfLines={1} style={styles.title}>{track.title}</Text>
            <Text numberOfLines={1} style={styles.artist}>{track.artist}{track.album ? ` · ${track.album}` : ''}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="收藏歌曲"
            onPress={() => void services.songFavorites.toggle(favoriteTrack).catch(() => Alert.alert('收藏未保存'))}
            style={styles.hit}
          >
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={24} color={isFav ? '#F07A8C' : '#F2EDE6'} />
          </Pressable>
        </View>

        {!!status.text && <Text style={styles.status}>{status.text}</Text>}
        <PlaybackProgress services={services} adaptive variant="immersive" />

        <View style={styles.transport}>
          <Pressable accessibilityRole="button" accessibilityLabel="循环模式" onPress={() => void services.preferences.update({ repeat: preferences.repeat === 'off' ? 'all' : preferences.repeat === 'all' ? 'one' : 'off' }).catch(() => {})} style={styles.hit}>
            <Ionicons name="repeat" size={21} color={preferences.repeat === 'off' ? 'rgba(255,255,255,0.5)' : '#F2C689'} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="上一首" onPress={() => services.playback.next(-1)} style={styles.hit}>
            <SkipGlyph direction="back" width={19} height={24} gap={3.5} color="#FFFFFF" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={state.intent === 'playing' ? '暂停' : '播放'}
            onPress={() => { if (state.intent === 'playing') controller.pause(); else void controller.play(); }}
            style={styles.playBtn}
          >
            <Ionicons name={state.intent === 'playing' ? 'pause' : 'play'} size={30} color="#121018" style={state.intent === 'playing' ? undefined : { marginLeft: 3 }} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="下一首" onPress={() => services.playback.next()} style={styles.hit}>
            <SkipGlyph direction="forward" width={19} height={24} gap={3.5} color="#FFFFFF" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="播放队列" onPress={onQueue} style={styles.hit}>
            <Ionicons name="list" size={23} color="#F2EDE6" />
          </Pressable>
        </View>

        <View style={styles.bottomTools}>
          <Pressable accessibilityRole="button" accessibilityLabel="完整歌词" onPress={() => setLyricsOpen(true)} style={styles.toolChip}>
            <Ionicons name="text-outline" size={16} color="#E9D6B0" />
            <Text style={styles.toolText}>全屏歌词</Text>
          </Pressable>
          {onComments && (
            <Pressable accessibilityRole="button" accessibilityLabel="歌曲评论" onPress={onComments} style={styles.toolChip}>
              <Ionicons name="chatbubbles-outline" size={16} color="#E9D6B0" />
              <Text style={styles.toolText}>评论</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" accessibilityLabel="切换播放界面样式" onPress={onStyle} style={styles.toolChip}>
            <Ionicons name="options-outline" size={16} color="#E9D6B0" />
            <Text style={styles.toolText}>样式</Text>
          </Pressable>
        </View>
      </View>

      <SheetModal visible={lyricsOpen} animationType="slide" allowSwipeDismissal onRequestClose={() => setLyricsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#12101A', padding: 20, paddingTop: 18 }}>
          <Pressable accessibilityRole="button" onPress={() => setLyricsOpen(false)} style={{ alignSelf: 'flex-end', padding: 8 }}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </Pressable>
          <Lyrics services={services} track={lyricTrack} font={font} presentation="immersive" />
        </View>
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  topBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  speedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(233,214,176,0.12)', borderWidth: 1, borderColor: 'rgba(233,214,176,0.28)' },
  speedText: { color: '#E9D6B0', fontSize: 12, fontWeight: '600' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  grooveLyricBand: { paddingHorizontal: 26, paddingVertical: 10, alignItems: 'center', gap: 5 },
  lyricDim: { color: 'rgba(242,237,230,0.38)', fontSize: 13, textAlign: 'center' },
  lyricActive: { color: '#FBE6C2', fontSize: 19, fontWeight: '700', lineHeight: 26, textAlign: 'center' },
  footer: { paddingHorizontal: 24, gap: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: '#FFFFFF', fontSize: 21, fontWeight: '700' },
  artist: { color: 'rgba(255,255,255,0.68)', fontSize: 13.5 },
  status: { color: '#F2C689', fontSize: 12, textAlign: 'center' },
  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 },
  hit: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#F2C689', alignItems: 'center', justifyContent: 'center' },
  bottomTools: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  toolChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.07)' },
  toolText: { color: 'rgba(242,237,230,0.85)', fontSize: 12, fontWeight: '600' },
});
