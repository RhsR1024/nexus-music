import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Animated, Easing, View } from 'react-native';
import type { Services } from '../app/services.ts';
import { currentEntry } from '../domain/queue.ts';
import { trackKey, type Track } from '../domain/track.ts';
import { resolveTrackRowPlayState, type TrackRowPlayState } from '../domain/trackRowPlayback.ts';

export { resolveTrackRowPlayState, type TrackRowPlayState };

export function PlayingWaveBars({ color, paused = false, size = 16 }: { color: string; paused?: boolean; size?: number }) {
  const b0 = useRef(new Animated.Value(0.45)).current;
  const b1 = useRef(new Animated.Value(0.85)).current;
  const b2 = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    if (paused) {
      b0.setValue(0.42);
      b1.setValue(0.72);
      b2.setValue(0.52);
      return;
    }
    const pulse = (val: Animated.Value, low: number, high: number, duration: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: high, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(val, { toValue: low, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
    const anims = [
      pulse(b0, 0.28, 0.96, 360, 0),
      pulse(b1, 0.34, 1.0, 310, 120),
      pulse(b2, 0.25, 0.9, 390, 220),
    ];
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [paused, b0, b1, b2]);

  const barW = Math.max(2.5, Math.round(size * 0.19));
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: 1,
        paddingVertical: 1,
      }}
    >
      {[b0, b1, b2].map((val, idx) => (
        <Animated.View
          key={idx}
          style={{
            width: barW,
            height: size - 2,
            borderRadius: barW / 2,
            backgroundColor: color,
            opacity: paused ? 0.6 : 0.96,
            transform: [{ scaleY: val }],
          }}
        />
      ))}
    </View>
  );
}

export function TrackPlaybackIndicator({
  state,
  color,
  size = 16,
}: {
  state: TrackRowPlayState;
  color: string;
  size?: number;
}) {
  if (state === 'idle') return null;
  if (state === 'loading') {
    return (
      <View testID="track-row-loading" style={{ width: size + 4, height: size + 4, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="small" color={color} />
      </View>
    );
  }
  return (
    <View testID={state === 'playing' ? 'track-row-playing' : 'track-row-paused'} style={{ width: size + 4, height: size + 4, alignItems: 'center', justifyContent: 'center' }}>
      <PlayingWaveBars color={color} paused={state === 'paused'} size={size} />
    </View>
  );
}

export function useTrackPlaybackState(services: Services) {
  const playback = useSyncExternalStore(
    services.playback.controller.subscribe,
    services.playback.controller.getSnapshot,
  );
  const [pendingKey, setPendingKey] = useState<string | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTrack = currentEntry(playback.queue)?.track;
  const activeTrackKey = activeTrack ? trackKey(activeTrack.origin) : undefined;

  useEffect(() => {
    if (pendingKey && activeTrackKey === pendingKey) {
      setPendingKey(undefined);
    }
  }, [activeTrackKey, pendingKey]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const markPending = (track: Track) => {
    const key = trackKey(track.origin);
    setPendingKey(key);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setPendingKey(undefined), 2500);
  };

  const stateFor = (track: Track): TrackRowPlayState =>
    resolveTrackRowPlayState({
      rowKey: trackKey(track.origin),
      activeTrackKey,
      pendingTrackKey: pendingKey,
      phase: playback.phase,
      intent: playback.intent,
      buffering: playback.buffering,
    });

  return {
    hasCurrentTrack: !!activeTrack,
    activeTrackKey,
    markPending,
    stateFor,
  };
}
