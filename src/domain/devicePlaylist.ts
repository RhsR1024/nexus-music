import { validateTrack, type Track } from './track.ts';

// Device-only playlists (Sollin E-1247–E-1251): a playlist domain that never
// joins the music-library JSON sync domain. The default "我喜欢的" playlist is
// always present and cannot be deleted. Callers mint entry ids.
export interface DevicePlaylistEntry { id: string; track: Track }
export interface DevicePlaylist { id: string; title: string; entries: readonly DevicePlaylistEntry[]; createdAt: number; updatedAt: number }
export interface DevicePlaylistState { version: 1; playlists: readonly DevicePlaylist[] }

export const defaultDevicePlaylistId = 'liked-local';
export const defaultDevicePlaylistTitle = '我喜欢的';

export function devicePlaylistEntries(tracks: readonly Track[], entryId: (index: number) => string): readonly DevicePlaylistEntry[] {
  tracks.forEach(validateTrack);
  return tracks.map((track, index) => ({ id: entryId(index), track }));
}

export function withDefaultDevicePlaylist(playlists: readonly DevicePlaylist[], now = 0): readonly DevicePlaylist[] {
  if (playlists.some(playlist => playlist.id === defaultDevicePlaylistId)) return [...playlists];
  return [{ id: defaultDevicePlaylistId, title: defaultDevicePlaylistTitle, entries: [], createdAt: now, updatedAt: now }, ...playlists];
}

export function normalizeDevicePlaylists(value: unknown): DevicePlaylistState {
  if (!value || typeof value !== 'object') throw new Error('本地歌单数据无效');
  const state = value as DevicePlaylistState;
  if (state.version !== 1 || !Array.isArray(state.playlists)) throw new Error('本地歌单版本或结构无效');
  const ids = new Set<string>();
  for (const playlist of state.playlists) {
    if (!playlist || typeof playlist.id !== 'string' || !playlist.id || ids.has(playlist.id) || typeof playlist.title !== 'string' || !playlist.title.trim() || !Array.isArray(playlist.entries) || !Number.isFinite(playlist.createdAt) || !Number.isFinite(playlist.updatedAt)) throw new Error('本地歌单结构无效');
    ids.add(playlist.id);
    const entries = new Set<string>();
    for (const entry of playlist.entries) {
      if (!entry || typeof entry.id !== 'string' || !entry.id || entries.has(entry.id)) throw new Error('本地歌单条目ID无效');
      entries.add(entry.id);
      validateTrack(entry.track);
    }
  }
  if (!ids.has(defaultDevicePlaylistId)) throw new Error('本地歌单缺少默认歌单');
  return state;
}

export function createDevicePlaylist(state: DevicePlaylistState, title: string, entries: readonly DevicePlaylistEntry[], id: string, now: number): DevicePlaylistState {
  const cleaned = title.trim();
  if (!cleaned) throw new Error('本地歌单名称不能为空');
  if (state.playlists.some(playlist => playlist.id === id)) throw new Error('本地歌单ID已存在');
  return { ...state, playlists: [...state.playlists, { id, title: cleaned, entries, createdAt: now, updatedAt: now }] };
}

export function renameDevicePlaylist(state: DevicePlaylistState, id: string, title: string, now: number): DevicePlaylistState {
  const cleaned = title.trim();
  if (!cleaned) throw new Error('本地歌单名称不能为空');
  if (!state.playlists.some(playlist => playlist.id === id)) throw new Error('本地歌单不存在');
  return { ...state, playlists: state.playlists.map(playlist => playlist.id === id ? { ...playlist, title: cleaned, updatedAt: now } : playlist) };
}

export function deleteDevicePlaylist(state: DevicePlaylistState, id: string): DevicePlaylistState {
  if (id === defaultDevicePlaylistId) throw new Error('默认本地歌单不能删除');
  const playlists = state.playlists.filter(playlist => playlist.id !== id);
  if (playlists.length === state.playlists.length) throw new Error('本地歌单不存在');
  return { ...state, playlists };
}

export function addDeviceTracks(state: DevicePlaylistState, id: string, entries: readonly DevicePlaylistEntry[], now: number): DevicePlaylistState {
  if (!state.playlists.some(playlist => playlist.id === id)) throw new Error('本地歌单不存在');
  const existing = new Set<string>();
  for (const playlist of state.playlists) if (playlist.id === id) for (const entry of playlist.entries) existing.add(entry.id);
  const fresh = new Set<string>();
  for (const entry of entries) {
    if (existing.has(entry.id) || fresh.has(entry.id)) throw new Error('本地歌单条目ID已存在');
    fresh.add(entry.id);
  }
  return { ...state, playlists: state.playlists.map(playlist => playlist.id === id ? { ...playlist, entries: [...playlist.entries, ...entries], updatedAt: now } : playlist) };
}

export function removeDeviceEntry(state: DevicePlaylistState, id: string, entryId: string, now: number): DevicePlaylistState {
  if (!state.playlists.some(playlist => playlist.id === id)) throw new Error('本地歌单不存在');
  return { ...state, playlists: state.playlists.map(playlist => playlist.id === id ? { ...playlist, entries: playlist.entries.filter(entry => entry.id !== entryId), updatedAt: now } : playlist) };
}

// Batch removal commits once: a multi-row removal either lands whole or keeps
// the previous playlist, matching the single-row entry contract.
export function removeDeviceEntries(state: DevicePlaylistState, id: string, entryIds: readonly string[], now: number): DevicePlaylistState {
  if (!state.playlists.some(playlist => playlist.id === id)) throw new Error('本地歌单不存在');
  const gone = new Set(entryIds);
  return { ...state, playlists: state.playlists.map(playlist => playlist.id === id ? { ...playlist, entries: playlist.entries.filter(entry => !gone.has(entry.id)), updatedAt: now } : playlist) };
}
