// Splits collaborative track artist credits into individual clickable artist references,
// pairing each name with its platform-specific artist ID when available in track.metadata.

import type { OnlinePlatform, Track } from './track.ts';

export interface TrackArtistRef {
  readonly name: string;
  readonly id?: string;
  readonly platform?: OnlinePlatform;
}

const VALID_ONLINE = new Set<OnlinePlatform>(['wy', 'tx', 'kw', 'kg', 'mg']);

function normalizeArtistIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const s = typeof item === 'string' ? item.trim() : typeof item === 'number' && Number.isSafeInteger(item) ? String(item) : '';
    out.push(s);
  }
  return out;
}

/**
 * Splits a raw artist credit string (e.g. "林俊杰 / 麻吉 / JJ陆", "周杰伦、费玉清",
 * "许嵩 (with 何曼婷)", "Jay Chou feat. Lara") into clean individual artist names.
 */
export function splitArtistNames(raw: string, expectedCount?: number): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Normalize parenthetical featured-artist credits like "(with 何曼婷)" or "(feat. A)"
  const unwrapped = trimmed.replace(
    /\s*[（(]\s*(?:feat\.?|ft\.?|featuring|with)\s+([^)）]+)[)）]/gi,
    ' / $1',
  );

  // Split on explicit collaboration separators first (/, 、, feat., ft., featuring)
  let parts = unwrapped
    .split(/\s*(?:\/|、|；|;|\bfeat\.?(?=\s|$)|\bft\.?(?=\s|$)|\bfeaturing\b)\s*/i)
    .map(p => p.trim())
    .filter(Boolean);

  // Split on " & " or ", " when either multiple IDs exist or the delimiter clearly separates distinct names
  if (parts.length === 1 && (expectedCount === undefined || expectedCount > 1)) {
    const single = parts[0]!;
    if (/\s+&\s+/.test(single) && (expectedCount === undefined ? !/^[A-Z0-9.\s]+&\s*[A-Z0-9.\s]+$/.test(single) || single.length > 12 : true)) {
      parts = single.split(/\s+&\s+/).map(p => p.trim()).filter(Boolean);
    } else if (/[,，]/.test(single) && (expectedCount === undefined || expectedCount > 1)) {
      const commaParts = single.split(/\s*[,，]\s*/).map(p => p.trim()).filter(Boolean);
      if (commaParts.length >= 2 && commaParts.every(p => p.length <= 32)) {
        parts = commaParts;
      }
    }
  }

  // Deduplicate preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(p);
  }
  return unique;
}

/**
 * Extracts clickable individual artist references from any Track (online, imported, or local).
 */
export function extractTrackArtists(track: Track): readonly TrackArtistRef[] {
  const platform: OnlinePlatform | undefined =
    track.origin.kind === 'online' && VALID_ONLINE.has(track.origin.platform)
      ? track.origin.platform
      : undefined;

  const meta = track.metadata ?? {};
  const ids = normalizeArtistIds(meta.artistIds);
  const validIds = ids.filter(id => /^[A-Za-z0-9_-]{1,128}$/.test(id) && id !== '0');
  const names = splitArtistNames(track.artist, validIds.length > 0 ? validIds.length : undefined);

  if (!names.length) return [];

  return names.map((name, index) => {
    const candidateId = ids[index];
    const hasValidId = !!platform && !!candidateId && /^[A-Za-z0-9_-]{1,128}$/.test(candidateId) && candidateId !== '0';
    return {
      name,
      ...(hasValidId ? { id: candidateId, platform } : platform ? { platform } : {}),
    };
  });
}
