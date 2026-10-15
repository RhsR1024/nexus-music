export interface EQPreset { name: string; gains: readonly number[]; preampDB: number }
export const eqFrequencies = [31,62,125,250,500,1000,2000,4000,8000,16000] as const;
export function validGains(values: unknown): values is number[] {
  return Array.isArray(values) && values.length === 10 && values.every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 12);
}
export function validPreamp(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 12; }
export function normalizePresets(values: unknown): EQPreset[] {
  if (!Array.isArray(values) || values.length > 24) throw new Error('最多保存24个声音预设');
  const names = new Set<string>();
  return values.map(value => {
    if (!value || typeof value.name !== 'string' || !value.name.trim() || value.name.trim().length > 32 || /[\x00-\x1f]/.test(value.name) || !validGains(value.gains) || !validPreamp(value.preampDB)) throw new Error('声音预设无效');
    const name = value.name.trim(); if (names.has(name)) throw new Error('预设名称重复'); names.add(name);
    return { name, gains: [...value.gains], preampDB: value.preampDB };
  });
}
export function dbAtY(y: number, height: number): number { return Math.round(Math.max(-12, Math.min(12, 12 - y / Math.max(1,height) * 24)) * 10) / 10; }
export const builtInEQ: readonly EQPreset[] = [
  {name:'平直',gains:[0,0,0,0,0,0,0,0,0,0],preampDB:0},
  {name:'低音增强',gains:[5,4,3,1,0,0,0,0,0,0],preampDB:0},
  {name:'人声',gains:[-2,-2,0,2,3,3,2,0,-1,-2],preampDB:0},
  {name:'摇滚',gains:[4,3,1,-1,-2,0,2,3,4,3],preampDB:0},
  {name:'流行',gains:[-1,1,3,4,2,0,-1,-1,0,1],preampDB:0},
  {name:'古典',gains:[2,1,0,-1,-1,0,1,2,3,2],preampDB:0},
  {name:'爵士',gains:[3,2,0,1,-1,-1,0,2,3,2],preampDB:0},
];
