import type {QQTransferNative} from './qqAccountTransfer.ts';
import {requireNativeModule} from 'expo';
import type {MusicWebAuthNative} from './musicWebLogin.ts';
import type {QQDailyAuthNative} from './qqDailyAuthorization.ts';

export interface NeteaseQrNative {
  neteaseQrRequest?(path:string,formBody:string,cookieHeader:string):Promise<string>;
}

export const loadNativeMusicAuth=()=>requireNativeModule<MusicWebAuthNative&QQDailyAuthNative&QQTransferNative&NeteaseQrNative>('NexusMusicAuth');
