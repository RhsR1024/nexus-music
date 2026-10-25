export const searchHistoryLimit = 10;
export const searchSuggestionLimit = 5;

export function normalizeSearchQuery(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function queryKey(value: string): string {
  return normalizeSearchQuery(value).toLocaleLowerCase();
}

export function normalizeSearchHistory(value: unknown, limit = searchHistoryLimit): readonly string[] {
  if (!Array.isArray(value)) throw new Error('搜索历史数据无效');
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') throw new Error('搜索历史数据无效');
    const query = normalizeSearchQuery(item);
    if (!query) continue;
    const key = queryKey(query);
    if (result.some(existing => queryKey(existing) === key)) continue;
    result.push(query);
    if (result.length === limit) break;
  }
  return result;
}

export function addSearchHistory(history: readonly string[], query: string, limit = searchHistoryLimit): readonly string[] {
  const cleaned = normalizeSearchQuery(query);
  if (!cleaned) return history;
  const key = queryKey(cleaned);
  return [cleaned, ...history.filter(item => queryKey(item) !== key)].slice(0, limit);
}

export function clearSearchHistory(): readonly string[] {
  return [];
}

export function suggestSearchQueries(history: readonly string[], draft: string, limit = searchSuggestionLimit): readonly string[] {
  const key = queryKey(draft);
  if (!key) return [];
  const prefix: string[] = [], contains: string[] = [];
  for (const item of history) {
    const candidate = queryKey(item);
    if (!candidate || candidate === key) continue;
    if (candidate.startsWith(key)) prefix.push(item);
    else if (candidate.includes(key)) contains.push(item);
  }
  return [...prefix, ...contains].slice(0, limit);
}
