// Pure helper computing character-by-character typewriter reveal for TeletypePlayer (Item #9).
export function teletypeVisibleChars(text: string, elapsedMs: number, durationMs: number): string {
  const chars = [...text];
  if (!chars.length) return '';
  if (!Number.isFinite(durationMs) || durationMs <= 0) return text;
  const ratio = Math.max(0.08, Math.min(1, elapsedMs / Math.max(250, durationMs * 0.85)));
  const count = Math.max(1, Math.ceil(chars.length * ratio));
  return chars.slice(0, count).join('');
}
