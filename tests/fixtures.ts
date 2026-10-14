import type { Track } from '../src/domain/track.ts';
import type { QueueEntry } from '../src/domain/queue.ts';
export const track: Track = {
  origin: { kind: 'online', platform: 'wy', id: '90071992547409931234' },
  title: '去标识测试歌曲', artist: '测试歌手', metadata: { albumId: '42' }, qualities: [],
};
export const entry = (id: string): QueueEntry => ({ id, track });

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, no) => { resolve = ok; reject = no; });
  return { promise, resolve, reject };
}
