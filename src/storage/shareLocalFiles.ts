import { Platform, Share } from 'react-native';
import { requireNativeModule } from 'expo';

interface NativeFileExporter {
  exportAudioFiles(uris: readonly string[]): Promise<boolean>;
}

/**
 * Cross-platform local file share helper.
 * On iOS, React Native's Share.share({ url }) opens the native share sheet directly.
 * On Android, Share.share ignores `url`, so we delegate to NexusFiles (FileProvider + ACTION_SEND).
 */
export async function shareLocalFile(uri: string, title: string): Promise<void> {
  if (Platform.OS === 'android') {
    await requireNativeModule<NativeFileExporter>('NexusFiles').exportAudioFiles([uri]);
    return;
  }
  await Share.share({ url: uri, title });
}
