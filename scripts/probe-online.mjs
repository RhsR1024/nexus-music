import { OnlineProvider } from '../src/providers/online.ts';
import { AlbumProvider } from '../src/providers/albums.ts';
import { ArtistProvider } from '../src/providers/artists.ts';
import { createHash, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const dependencies = {
  md5: async value => createHash('md5').update(value).digest('hex'),
  sha1: async value => createHash('sha1').update(value).digest('hex'),
  deviceId: randomUUID,
};
const providers = {
  song: new OnlineProvider(dependencies),
  album: new AlbumProvider(dependencies),
  artist: new ArtistProvider(dependencies),
};
const query = 'Taylor Swift';
const signal = () => AbortSignal.timeout(20000);
const results = [];

for (const platform of ['wy', 'tx', 'kw', 'kg', 'mg']) {
  for (const type of ['song', 'album', 'artist']) {
    try {
      const page = await providers[type].search(platform, query, 1, signal(), 3);
      const identities = page.items.filter(item => type === 'song'
        ? item.origin.kind === 'online' && item.origin.platform === platform && item.origin.id.length > 0
        : typeof item.id === 'string' && item.id.length > 0).length;
      results.push({
        platform,
        type,
        ok: identities === page.items.length,
        count: page.items.length,
        identities,
        total: page.total ?? null,
        hasMore: page.hasMore,
        ...(type === 'song' ? { metadataRetained: page.items.every(item => Object.keys(item.metadata).length > 0) } : {}),
      });
    } catch {
      results.push({ platform, type, ok: false, failed: true });
    }
  }
}

writeFileSync('build/logs/online-search.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results));
if (results.some(result => !result.ok)) process.exitCode = 1;
