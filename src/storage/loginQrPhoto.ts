import {requireNativeModule} from 'expo';
import type {LoginQrPhotoNative} from '../providers/kugouQrPhoto.ts';
export const loginQrPhotoNative:LoginQrPhotoNative={
  saveLoginQrPhoto:(id,image,expiresAt)=>requireNativeModule<LoginQrPhotoNative>('NexusFiles').saveLoginQrPhoto(id,image,expiresAt),
  cancelLoginQrPhoto:async id=>{await requireNativeModule<LoginQrPhotoNative>('NexusFiles').cancelLoginQrPhoto(id);},
};
