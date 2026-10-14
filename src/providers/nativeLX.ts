import { requireNativeModule } from 'expo';
import { createNativeLX } from './nativeLXAdapter.ts';

export function loadNativeLX() {
  return createNativeLX(requireNativeModule<Parameters<typeof createNativeLX>[0]>('NexusNative'));
}
