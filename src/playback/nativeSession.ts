import { requireNativeModule } from 'expo';
import { currentEntry, emptyQueue, advance, select } from '../domain/queue.ts';
import { PlaybackController, type MediaResolver, type PlaybackToken } from './controller.ts';
import type { PreferenceStore } from '../app/preferences.ts';

interface NativePlayback {
  load(json: string, id: string, generation: number): Promise<void>;
  play(id: string, generation: number): Promise<void>;
  pause(generation: number): Promise<void>; stop(generation: number): Promise<void>;
  seek(seconds: number, id: string, generation: number): Promise<void>;
  configureEQ(enabled: boolean, gains: readonly number[]): Promise<void>;
  addListener(event: string, callback: (event: Record<string, unknown>) => void): { remove(): void };
}
export class SpectrumStore {
  private value: { bands: readonly number[]; supported: boolean; headroomDB: number } = { bands: [], supported: false, headroomDB: 0 };
  private listeners = new Set<() => void>();
  getSnapshot = () => this.value;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  update(event: Record<string, unknown>) {
    this.value = { bands: Array.isArray(event.bands) ? event.bands.map(Number) : [], supported: event.supported === true, headroomDB: Number(event.headroomDB) || 0 };
    for (const listener of this.listeners) listener();
  }
}
export function createPlaybackSession(resolver: MediaResolver, preferences: PreferenceStore) {
  const native = requireNativeModule<NativePlayback>('NexusPlayback');
  const spectrum = new SpectrumStore();
  const safe = (work: Promise<unknown>, token?: PlaybackToken) => { void work.catch(() => { if (token) void controller.onError(token); }); };
  const controller = new PlaybackController(resolver, {
    stop: generation => safe(native.stop(generation)), pause: generation => safe(native.pause(generation)),
    load: (media, token) => {
      const track = currentEntry(controller.getSnapshot().queue)?.track;
      safe(native.load(JSON.stringify({ ...media, metadata: track ? { title: track.title, artist: track.artist, album: track.album } : {} }), token.entryId, token.generation), token);
    },
    play: token => safe(native.play(token.entryId, token.generation), token),
    seek: (seconds, token) => safe(native.seek(seconds, token.entryId, token.generation), token),
  }, emptyQueue);
  const next = (direction: 1 | -1 = 1) => {
    const state = controller.getSnapshot(), settings = preferences.getSnapshot();
    const entries = state.queue.entries;
    let queue = advance(state.queue, settings.repeat === 'all' ? 'all' : 'off');
    if (settings.shuffle && entries.length > 1 && !state.queue.priorityIds.length) {
      const eligible = entries.filter(entry => entry.id !== state.queue.currentId);
      queue = select(state.queue, eligible[Math.floor(Math.random() * eligible.length)]!.id);
    } else if (direction === -1) {
      if (state.position > 3) { controller.seek(0); return; }
      const index = entries.findIndex(entry => entry.id === state.queue.currentId);
      const previous = entries[index-1] ?? (settings.repeat === 'all' ? entries.at(-1) : entries[0]);
      if (previous) queue = select(state.queue, previous.id);
    }
    void controller.play(queue);
  };
  native.addListener('playback', event => {
    const token = { entryId: String(event.entryId), generation: Number(event.generation) };
    controller.onProgress(token, Number(event.position), Number(event.duration), event.buffering === true);
    if (event.kind === 'ready') controller.onReady(token);
    if (event.kind === 'error') void controller.onError(token);
    if (event.kind === 'ended' && controller.getSnapshot().intent === 'playing' && controller.getSnapshot().token?.generation === token.generation && controller.getSnapshot().queue.currentId === token.entryId) {
      if (preferences.getSnapshot().repeat === 'one') void controller.play(); else next();
    }
  });
  native.addListener('spectrum', event => {
    if (event.generation === controller.getSnapshot().token?.generation && event.entryId === controller.getSnapshot().queue.currentId) spectrum.update(event);
  });
  native.addListener('remote', event => {
    if (event.action === 'pause') controller.pause(Number(event.generation) || 0);
    else if (event.action === 'play') void controller.play();
    else if (event.action === 'toggle') { if (controller.getSnapshot().intent === 'playing') controller.pause(); else void controller.play(); }
    else if (event.action === 'next') next(); else if (event.action === 'previous') next(-1);
    else if (event.action === 'seek') controller.seek(Number(event.seconds));
  });
  const configure = () => { const value = preferences.getSnapshot(); safe(native.configureEQ(value.eqEnabled, value.gains)); };
  preferences.subscribe(configure); configure();
  return { controller, spectrum, next };
}
