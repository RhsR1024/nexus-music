import { Image, View } from 'react-native';
import { PLATFORM_LOGO_URIS, type MusicPlatformId } from './platformLogoAssets.ts';

export { PLATFORM_LOGO_URIS, type MusicPlatformId };

export function PlatformLogo({
  platform,
  size = 32,
  ring = false,
}: {
  platform: MusicPlatformId;
  size?: number;
  ring?: boolean;
}) {
  const radius = platform === 'qishui' ? Math.round(size * 0.26) : size / 2;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
        ...(ring ? { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.72)' } : {}),
      }}
    >
      <Image
        source={{ uri: PLATFORM_LOGO_URIS[platform] }}
        style={{ width: size, height: size, borderRadius: radius }}
        resizeMode="cover"
      />
    </View>
  );
}
