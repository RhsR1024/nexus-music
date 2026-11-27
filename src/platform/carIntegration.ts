// CarPlay / Siri Shortcuts / Android Auto catalog synchronization & command execution bridge (Item #4).
import type { Track } from '../domain/track.ts';
import type { LibraryState, LibraryStore } from '../storage/library.ts';

export interface CarCatalogItem {
  readonly title: string;
  readonly artist: string;
  readonly album?: string;
}

export interface CarCatalogPlaylist {
  readonly id: string;
  readonly title: string;
  readonly count: number;
}

export interface CarCatalogPayload {
  readonly version: 1;
  readonly updatedAt: number;
  readonly favorites: readonly CarCatalogItem[];
  readonly playlists: readonly CarCatalogPlaylist[];
  readonly recent: readonly CarCatalogItem[];
}

export interface CarIntegrationStatus {
  readonly platform: string;
  readonly carPlayCodeReady: boolean;
  readonly carPlayEntitlementActive: boolean;
  readonly siriIntentsAvailable: boolean;
  readonly androidAutoServiceReady: boolean;
  readonly catalogTracks: number;
  readonly catalogPlaylists: number;
}

export interface CarCommand {
  readonly source?: string;
  readonly action?: string;
  readonly section?: string;
  readonly id?: string;
  readonly index?: number;
}

export interface CarNativeBridge {
  updateCarCatalog?(json: string): Promise<void>;
  consumePendingCarCommands?(): Promise<readonly CarCommand[]>;
  carIntegrationStatus?(): Promise<CarIntegrationStatus>;
  addListener?(event: string, listener: (cmd: CarCommand) => void): { remove(): void };
}

export function buildCarCatalogSnapshot(library: Pick<LibraryState, 'favorites' | 'playlists' | 'history'>, now = Date.now()): CarCatalogPayload {
  return {
    version: 1,
    updatedAt: now,
    favorites: library.favorites.slice(0, 50).map(t => ({
      title: t.title,
      artist: t.artist,
      ...(t.album ? { album: t.album } : {}),
    })),
    playlists: library.playlists.slice(0, 30).map(pl => ({
      id: pl.id,
      title: pl.title,
      count: pl.entries.length,
    })),
    recent: library.history.slice(0, 40).map(h => ({
      title: h.track.title,
      artist: h.track.artist,
      ...(h.track.album ? { album: h.track.album } : {}),
    })),
  };
}

export class CarIntegrationCoordinator {
  private native: CarNativeBridge | null;
  private library: Pick<LibraryStore, 'getSnapshot' | 'subscribe'>;
  private actions: {
    playTracks: (tracks: readonly Track[], index: number) => void;
    resume: () => void;
    pause: () => void;
    next: (dir?: 1 | -1) => void;
  };
  private lastDigest = '';
  private sub: { remove(): void } | null = null;
  private unsubLibrary: (() => void) | null = null;

  constructor(deps: {
    native: CarNativeBridge | null;
    library: Pick<LibraryStore, 'getSnapshot' | 'subscribe'>;
    actions: {
      playTracks: (tracks: readonly Track[], index: number) => void;
      resume: () => void;
      pause: () => void;
      next: (dir?: 1 | -1) => void;
    };
  }) {
    this.native = deps.native;
    this.library = deps.library;
    this.actions = deps.actions;
  }

  start(): void {
    this.stop();
    void this.syncCatalog();
    this.unsubLibrary = this.library.subscribe(() => {
      void this.syncCatalog();
    });
    this.sub = this.native?.addListener?.('onCarCommand', cmd => {
      this.executeCommand(cmd);
    }) ?? null;
    void this.drainPendingCommands();
  }

  stop(): void {
    this.sub?.remove();
    this.sub = null;
    this.unsubLibrary?.();
    this.unsubLibrary = null;
  }

  async syncCatalog(force = false): Promise<CarCatalogPayload> {
    const payload = buildCarCatalogSnapshot(this.library.getSnapshot());
    const digest = JSON.stringify([payload.favorites, payload.playlists, payload.recent]);
    if (force || digest !== this.lastDigest) {
      this.lastDigest = digest;
      await this.native?.updateCarCatalog?.(JSON.stringify(payload)).catch(() => {});
    }
    return payload;
  }

  async drainPendingCommands(): Promise<number> {
    if (!this.native?.consumePendingCarCommands) return 0;
    try {
      const pending = await this.native.consumePendingCarCommands();
      for (const cmd of pending) this.executeCommand(cmd);
      return pending.length;
    } catch {
      return 0;
    }
  }

  executeCommand(cmd: CarCommand): boolean {
    const lib = this.library.getSnapshot();
    switch (cmd.action) {
      case 'resume':
        this.actions.resume();
        return true;
      case 'pause':
        this.actions.pause();
        return true;
      case 'next':
        this.actions.next(1);
        return true;
      case 'previous':
        this.actions.next(-1);
        return true;
      case 'playFavorites':
        if (lib.favorites.length > 0) {
          this.actions.playTracks(lib.favorites, 0);
          return true;
        }
        return false;
      case 'playSectionTrack': {
        const list = cmd.section === 'recent' ? lib.history.map(h => h.track) : lib.favorites;
        const idx = Math.max(0, Math.min(list.length - 1, Number(cmd.index) || 0));
        if (list.length > 0) {
          this.actions.playTracks(list, idx);
          return true;
        }
        return false;
      }
      case 'playPlaylist': {
        const pl = lib.playlists.find(p => p.id === cmd.id);
        if (pl && pl.entries.length > 0) {
          this.actions.playTracks(pl.entries.map(e => e.track), 0);
          return true;
        }
        return false;
      }
      default:
        return false;
    }
  }

  async status(): Promise<CarIntegrationStatus> {
    const fallback: CarIntegrationStatus = {
      platform: 'unknown',
      carPlayCodeReady: false,
      carPlayEntitlementActive: false,
      siriIntentsAvailable: false,
      androidAutoServiceReady: false,
      catalogTracks: this.library.getSnapshot().favorites.length + this.library.getSnapshot().history.length,
      catalogPlaylists: this.library.getSnapshot().playlists.length,
    };
    if (!this.native?.carIntegrationStatus) return fallback;
    try {
      return await this.native.carIntegrationStatus();
    } catch {
      return fallback;
    }
  }
}
