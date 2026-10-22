import {requireNativeModule} from 'expo';
import type {MusicWebAuthNative} from './musicWebLogin.ts';

export const loadNativeMusicAuth=()=>requireNativeModule<MusicWebAuthNative>('NexusMusicAuth');
