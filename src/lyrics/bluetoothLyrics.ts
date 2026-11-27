// Bluetooth Car / Lockscreen Lyrics formatting helper (Item #8).
import type { Track } from '../domain/track.ts';
import type { BluetoothLyricsOrder, SystemLyricsPosition } from '../app/preferences.ts';

export function formatBluetoothLyric(
  line: string | null,
  track: Track | undefined,
  position: SystemLyricsPosition,
  order: BluetoothLyricsOrder,
): string | null {
  const clean = line?.trim();
  if (!clean) return null;
  if (!track || order === 'lyric-first') return clean;
  const prefix = position === 'title' ? track.title.trim() : track.artist.trim();
  if (!prefix) return clean;
  return `${prefix} · ${clean}`;
}
