import * as SecureStore from 'expo-secure-store';
import type { SecretStore } from '../providers/navidromeAccounts.ts';
export const nativeSecrets:SecretStore={
  get:key=>SecureStore.getItemAsync(key),
  set:(key,value)=>SecureStore.setItemAsync(key,value,{keychainAccessible:SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY}),
  remove:key=>SecureStore.deleteItemAsync(key),
};
