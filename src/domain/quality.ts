// Preference order, not a claim about codecs or measured output fidelity.
export const qualityOrder = ['master', 'atmos_plus', 'atmos', 'hires', 'flac24bit', 'flac', '320k', '192k', '128k'] as const;
export type Quality = typeof qualityOrder[number];
const aliases: Readonly<Record<string, Quality>> = {
  master: 'master', atmos_plus: 'atmos_plus', atmosplus: 'atmos_plus', atmos: 'atmos',
  hires: 'hires', 'hi-res': 'hires', flac24bit: 'flac24bit', flac24: 'flac24bit',
  '24bit': 'flac24bit', flac: 'flac', lossless: 'flac', '320': '320k', '320k': '320k',
  '192': '192k', '192k': '192k', '128': '128k', '128k': '128k',
};
export function normalizeQuality(value: string): Quality | undefined { return aliases[value.toLowerCase()]; }
export function fallbackQualities(preference: Quality): readonly Quality[] {
  const index = qualityOrder.indexOf(preference);
  if (index < 0) throw new Error('无效的音质偏好');
  return qualityOrder.slice(index);
}
