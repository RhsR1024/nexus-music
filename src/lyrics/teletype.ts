// Pure helper computing character-by-character typewriter reveal for TeletypePlayer (Item #9).
export function teletypeVisibleChars(text: string, elapsedMs: number, durationMs: number): string {
  const chars = [...text];
  if (!chars.length) return '';
  if (!Number.isFinite(durationMs) || durationMs <= 0) return text;
  const ratio = Math.max(0.08, Math.min(1, elapsedMs / Math.max(250, durationMs * 0.85)));
  const count = Math.max(1, Math.ceil(chars.length * ratio));
  return chars.slice(0, count).join('');
}

// Pure helper for Teletype 2 (Model 33): immediately outputs the full timestamp prefix
// at line onset and applies progressive typing strictly to the lyric body characters
// so the timestamp never delays or offsets the vocal-synced lyric reveal.
export function formatTeletype2Line(
  timestampPrefix: string,
  lyricBody: string,
  lineProgress: number,
  isActive: boolean,
): { prefix: string; body: string } {
  if (!isActive) return { prefix: timestampPrefix, body: lyricBody };
  const chars = [...lyricBody];
  if (!chars.length) return { prefix: timestampPrefix, body: '' };
  const clamped = Math.max(0, Math.min(1, Number.isFinite(lineProgress) ? lineProgress : 0));
  const count = Math.min(chars.length, Math.max(1, Math.ceil(chars.length * clamped)));
  return { prefix: timestampPrefix, body: chars.slice(0, count).join('') };
}
