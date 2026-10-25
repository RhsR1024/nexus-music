import {addDeviceTracks, createDevicePlaylist, deleteDevicePlaylist, devicePlaylistEntries, normalizeDevicePlaylists, removeDeviceEntry, renameDevicePlaylist, withDefaultDevicePlaylist, type DevicePlaylist, type DevicePlaylistState} from '../domain/devicePlaylist.ts';
import type {Track} from '../domain/track.ts';
import type { Repository } from './repository.ts';

// Device-only playlist storage: the key never joins the library JSON that
// cloud sync and WebDAV backups export, so the two playlist domains stay
// isolated even though both live in the same repository.
const storageKey = 'device.playlists.v1';

export class DevicePlaylistStore {
  private repository: Pick<Repository, 'get' | 'put'>;
  private value: DevicePlaylistState = { version: 1, playlists: [] };
  private listeners = new Set<() => void>();
  private tail: Promise<unknown> = Promise.resolve();
  private uuid: () => string;
  private now: () => number;

  constructor(repository: Pick<Repository, 'get' | 'put'>, uuid: () => string = () => Math.random().toString(36).slice(2), now: () => number = () => Date.now()) { this.repository = repository; this.uuid = uuid; this.now = now; }

  getSnapshot = (): readonly DevicePlaylist[] => this.value.playlists;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  async restore() {
    const stored = await this.repository.get<unknown>(storageKey);
    if (stored === undefined) {
      const seeded: DevicePlaylistState = { version: 1, playlists: withDefaultDevicePlaylist([], this.now()) };
      await this.repository.put(storageKey, seeded);
      this.value = seeded;
      return;
    }
    this.value = normalizeDevicePlaylists(stored);
  }

  create(title: string, tracks: readonly Track[] = []): Promise<string> {
    const id = this.uuid();
    return this.mutate(state => createDevicePlaylist(state, title, devicePlaylistEntries(tracks, () => this.uuid()), id, this.now())).then(() => id);
  }
  rename(id: string, title: string) { return this.mutate(state => renameDevicePlaylist(state, id, title, this.now())); }
  remove(id: string) { return this.mutate(state => deleteDevicePlaylist(state, id)); }
  addTracks(id: string, tracks: readonly Track[]) { return this.mutate(state => addDeviceTracks(state, id, devicePlaylistEntries(tracks, () => this.uuid()), this.now())); }
  removeEntry(id: string, entryId: string) { return this.mutate(state => removeDeviceEntry(state, id, entryId, this.now())); }

  private mutate(patch: (state: DevicePlaylistState) => DevicePlaylistState): Promise<void> {
    const next = this.tail.then(async () => {
      const value = normalizeDevicePlaylists(patch(this.value));
      if (value === this.value) return;
      await this.repository.put(storageKey, value);
      this.value = value;
      for (const listener of this.listeners) listener();
    });
    this.tail = next.catch(() => {});
    return next;
  }
}
