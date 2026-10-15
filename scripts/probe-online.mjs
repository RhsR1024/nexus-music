import { OnlineProvider } from '../src/providers/online.ts';
import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const provider = new OnlineProvider({ md5: async value => createHash('md5').update(value).digest('hex'), sha1: async value => createHash('sha1').update(value).digest('hex'), deviceId: randomUUID });
const results = await Promise.all(['wy','tx','kw','kg','mg'].map(async platform => {
  try { const page = await provider.search(platform, 'test', 1, new AbortController().signal, 3);
    return { platform, count: page.items.length, hasMore: page.hasMore, metadataRetained: page.items.every(item => typeof item.origin.id === 'string' && Object.keys(item.metadata).length > 0) };
  } catch { return { platform, failed: true }; }
}));
writeFileSync('build/logs/online-search.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
