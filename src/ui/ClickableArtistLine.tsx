// Renders a track's artist credit with individually clickable artist links for collaborations
// (e.g. "林俊杰 / 麻吉 / JJ陆" lets the listener tap each artist separately to open their page).

import { Pressable, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import type { Track } from '../domain/track.ts';
import { extractTrackArtists, type TrackArtistRef } from '../domain/artistNames.ts';
import { Text } from './Typography.tsx';

export function ClickableArtistLine({
  track,
  onArtistPress,
  suffix,
  prefix,
  textStyle,
  containerStyle,
  centered = false,
  testID,
}: {
  track: Track;
  onArtistPress?: (artist: TrackArtistRef) => void;
  suffix?: string;
  prefix?: string;
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  centered?: boolean;
  testID?: string;
}) {
  const artists = extractTrackArtists(track);

  if (!onArtistPress || !artists.length) {
    return (
      <Text numberOfLines={1} style={textStyle}>
        {prefix ?? ''}
        {track.artist}
        {suffix ?? ''}
      </Text>
    );
  }

  return (
    <View
      testID={testID}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'nowrap',
          maxWidth: '100%',
          overflow: 'hidden',
          ...(centered ? { justifyContent: 'center' } : {}),
        },
        containerStyle,
      ]}
    >
      {!!prefix && (
        <Text numberOfLines={1} style={textStyle}>
          {prefix}
        </Text>
      )}
      {artists.map((artist, idx) => (
        <View
          key={`${artist.name}-${idx}`}
          style={{ flexDirection: 'row', alignItems: 'center', flexShrink: idx === artists.length - 1 ? 1 : 0 }}
        >
          {idx > 0 && (
            <Text style={[textStyle, { opacity: 0.72 }]}> / </Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`查看歌手：${artist.name}`}
            hitSlop={{ top: 8, bottom: 8, left: 3, right: 3 }}
            onPress={() => onArtistPress(artist)}
            style={({ pressed }) => ({ opacity: pressed ? 0.58 : 1, flexShrink: 1 })}
          >
            <Text numberOfLines={1} style={textStyle}>
              {artist.name}
            </Text>
          </Pressable>
        </View>
      ))}
      {!!suffix && (
        <Text numberOfLines={1} style={[textStyle, { flexShrink: 2 }]}>
          {suffix}
        </Text>
      )}
    </View>
  );
}
