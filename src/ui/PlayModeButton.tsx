import { Pressable, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Typography.tsx';
import {
  currentPlayMode,
  nextPlayModePatch,
  playModeLabel,
  type PlayMode,
  type RepeatMode,
} from '../domain/playMode.ts';

export { currentPlayMode, nextPlayModePatch, playModeLabel, type PlayMode, type RepeatMode };

export function PlayModeButton({
  repeat,
  shuffle,
  color,
  activeColor,
  mutedColor,
  size = 24,
  style,
  testID = 'play-mode-button',
  onCycle,
}: {
  repeat: RepeatMode;
  shuffle: boolean;
  color: string;
  activeColor?: string;
  mutedColor?: string;
  size?: number;
  style?: ViewStyle;
  testID?: string;
  onCycle: (next: { repeat: RepeatMode; shuffle: boolean; label: string }) => void;
}) {
  const mode = currentPlayMode(repeat, shuffle);
  const label = playModeLabel(repeat, shuffle);
  const tint =
    mode === 'order'
      ? (mutedColor ?? color)
      : mode === 'one' || mode === 'shuffle'
        ? (activeColor ?? color)
        : color;
  const opacity = mode === 'order' ? 0.48 : 1;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`播放模式：${label}`}
      accessibilityValue={{ text: label }}
      onPress={() => {
        const next = nextPlayModePatch(repeat, shuffle);
        onCycle({ repeat: next.repeat, shuffle: next.shuffle, label: next.label });
      }}
      style={[
        {
          minWidth: 44,
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <View style={{ alignItems: 'center', justifyContent: 'center', opacity }}>
        <Ionicons name={mode === 'shuffle' ? 'shuffle' : 'repeat'} size={size} color={tint} />
        {mode === 'one' && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -2,
              right: -5,
              minWidth: 13,
              height: 13,
              borderRadius: 6.5,
              backgroundColor: activeColor ?? tint,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 2,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 8.5, fontWeight: '800', lineHeight: 10 }}>1</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}
