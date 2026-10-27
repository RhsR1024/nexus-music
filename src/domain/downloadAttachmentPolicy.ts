import {downloadCoverSize,downloadCoverSizes,type DownloadCoverPreferences,type DownloadCoverSize} from './downloadCover.ts';
import {validateDownloadAttachments,type DownloadAttachments} from './downloadAttachments.ts';
import type {Track} from './track.ts';
export interface DownloadAttachmentPolicy extends DownloadAttachments {coverSize:DownloadCoverSize}
export function validateAttachmentPolicy(value:unknown):DownloadAttachmentPolicy{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('附加文件策略无效');const p=value as DownloadAttachmentPolicy;validateDownloadAttachments(p);if(!downloadCoverSizes.includes(p.coverSize))throw Error('附加封面尺寸无效');return Object.freeze({downloadAttachLyrics:p.downloadAttachLyrics,downloadAttachCover:p.downloadAttachCover,downloadAttachMetadata:p.downloadAttachMetadata,coverSize:p.coverSize});
}
export function captureAttachmentPolicy(track:Track,preferences:DownloadAttachments&DownloadCoverPreferences):DownloadAttachmentPolicy|undefined{
 validateDownloadAttachments(preferences);if(!preferences.downloadAttachLyrics&&!preferences.downloadAttachCover&&!preferences.downloadAttachMetadata)return;
 return validateAttachmentPolicy({...preferences,coverSize:downloadCoverSize(track,preferences.downloadCoverSizes)});
}
