import * as Crypto from 'expo-crypto';
import { openRepository } from '../storage/nativeDatabase.ts';
import { loadNativeLX } from '../providers/nativeLX.ts';
import { SourceRegistry } from '../providers/sourceRegistry.ts';
import { SourceCatalog } from '../providers/sourceCatalog.ts';
import { PreferenceStore } from './preferences.ts';
import { MultiSourceResolver } from '../providers/multiSourceResolver.ts';
import { createPlaybackSession } from '../playback/nativeSession.ts';
import { OnlineProvider } from '../providers/online.ts';
import { SearchCoordinator } from '../providers/searchCoordinator.ts';
import { makeQueue, append, enqueueNext } from '../domain/queue.ts';
import type { Track } from '../domain/track.ts';

async function initialize() {
  const repository = await openRepository();
  const preferences = new PreferenceStore(repository); await preferences.restore();
  const nativeLX = loadNativeLX();
  const registry = new SourceRegistry(nativeLX);
  const catalog = new SourceCatalog(registry, repository, script => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, script));
  await catalog.restore();
  void catalog.restoreEnabled();
  const resolver = new MultiSourceResolver(registry, nativeLX, () => preferences.getSnapshot().quality);
  const playback = createPlaybackSession(resolver, preferences);
  const online = new OnlineProvider({ md5: value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, value), sha1: value => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA1, value), deviceId: Crypto.randomUUID });
  const search = new SearchCoordinator(online);
  const playTracks = (tracks: readonly Track[], index: number) => {
    const entries = tracks.map(track => ({id:Crypto.randomUUID(),track}));
    if (entries[index]) void playback.controller.play(makeQueue(entries, entries[index]!.id));
  };
  const addToQueue = (track: Track, next = false) => {
    const entry = {id:Crypto.randomUUID(),track}, queue = playback.controller.getSnapshot().queue;
    playback.controller.setQueue(next ? enqueueNext(queue,entry) : append(queue,entry));
  };
  return { repository, nativeLX, registry, catalog, preferences, resolver, playback, online, search, playTracks, addToQueue };
}
export type Services = Awaited<ReturnType<typeof initialize>>;
let pending: Promise<Services> | undefined;
export function getServices() {
  if (!pending) pending = initialize().catch(error => { pending = undefined; throw error; });
  return pending;
}
