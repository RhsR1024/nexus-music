import type {QQTransferNative} from './qqAccountTransfer.ts';
import {requireNativeModule} from 'expo';
import type {MusicWebAuthNative} from './musicWebLogin.ts';
import type {QQDailyAuthNative} from './qqDailyAuthorization.ts';

export const loadNativeMusicAuth=()=>requireNativeModule<MusicWebAuthNative&QQDailyAuthNative&QQTransferNative>('NexusMusicAuth');
