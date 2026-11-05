import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playlistCoverSource} from '../src/domain/playlistCover.ts';
import {track} from './fixtures.ts';

test('playlist cover prefers a safe public URL and otherwise falls back to its first track',()=>{
  assert.deepEqual(playlistCoverSource('  https://images.example/playlist.jpg  ',track),{url:'https://images.example/playlist.jpg'});
  assert.deepEqual(playlistCoverSource('http://127.0.0.1:18439/playlist-cover.png',track),{url:'http://127.0.0.1:18439/playlist-cover.png'});
  assert.deepEqual(playlistCoverSource(undefined,track),{track});
  assert.deepEqual(playlistCoverSource('   ',track),{track});
  for(const value of ['file:///tmp/cover.jpg','javascript:alert(1)','https://user:pass@example.test/cover.jpg','https://example.test/cover.jpg?token=secret']){
    assert.deepEqual(playlistCoverSource(value,track),{track},value);
  }
});
