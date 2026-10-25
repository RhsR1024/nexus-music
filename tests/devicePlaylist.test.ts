import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDeviceTracks, createDevicePlaylist, defaultDevicePlaylistId, defaultDevicePlaylistTitle, deleteDevicePlaylist, normalizeDevicePlaylists, removeDeviceEntry, renameDevicePlaylist, withDefaultDevicePlaylist } from '../src/domain/devicePlaylist.ts';
import { DevicePlaylistStore } from '../src/storage/devicePlaylists.ts';
import { LibraryStore } from '../src/storage/library.ts';
import { track } from './fixtures.ts';
import type { Repository } from '../src/storage/repository.ts';

function setup(){
  let value: string | undefined, counter = 0;
  const repository: Pick<Repository, 'get' | 'put'> = { get: async <T>() => value ? JSON.parse(value) as T : undefined, put: async (_, data) => { value = JSON.stringify(data); } };
  const store = new DevicePlaylistStore(repository, () => `id-${++counter}`, () => 1000 + counter);
  return { store, repository, read: () => value };
}

test('device playlist domain seeds the undeletable default and rejects corrupt state', () => {
  const seeded = withDefaultDevicePlaylist([], 5);
  assert.equal(seeded[0]!.id, defaultDevicePlaylistId);
  assert.equal(seeded[0]!.title, defaultDevicePlaylistTitle);
  let state = normalizeDevicePlaylists({ version: 1, playlists: seeded });
  assert.throws(() => deleteDevicePlaylist(state, defaultDevicePlaylistId), /默认本地歌单不能删除/);
  state = addDeviceTracks(state, defaultDevicePlaylistId, [{ id: 'e1', track }], 9);
  assert.equal(state.playlists[0]!.entries.length, 1);
  state = removeDeviceEntry(state, defaultDevicePlaylistId, 'e1', 10);
  assert.equal(state.playlists[0]!.entries.length, 0);
  assert.throws(() => normalizeDevicePlaylists({ version: 2, playlists: [] }), /本地歌单版本或结构无效/);
  assert.throws(() => normalizeDevicePlaylists({ version: 1, playlists: [{ id: 'x', title: 'p', entries: [{ id: 'e', track: 1 as never }], createdAt: 0, updatedAt: 0 }] }), /无效/);
});

test('device playlists create, add and rename through the store and persist isolated from the library key', async () => {
  const { store, repository, read } = setup();
  await store.restore();
  assert.deepEqual(store.getSnapshot().map(playlist => playlist.id), [defaultDevicePlaylistId]);
  let notified = 0; store.subscribe(() => { notified++; });
  const id = await store.create('夜跑', [track]);
  await store.addTracks(id, [track, track]);
  await store.rename(id, '夜跑精选');
  const renamed = store.getSnapshot().find(playlist => playlist.id === id)!;
  assert.equal(renamed.title, '夜跑精选');
  assert.equal(renamed.entries.length, 3);
  assert.ok(notified >= 3);
  const second = new DevicePlaylistStore(repository, () => 'unused', () => 1); await second.restore();
  assert.equal(second.getSnapshot().find(playlist => playlist.id === id)!.entries.length, 3);
  const stored = JSON.parse(read()!);
  // The stored record only contains the device playlist document.
  assert.deepEqual(Object.keys(stored), ['version', 'playlists']);
});

test('device playlist deletion removes only the named playlist and unknown ids fail loudly', async () => {
  const { store } = setup(); await store.restore();
  const id = await store.create('临时');
  await store.remove(id);
  assert.ok(!store.getSnapshot().some(playlist => playlist.id === id));
  await assert.rejects(store.remove('missing'), /本地歌单不存在/);
  await assert.rejects(store.create('  '), /名称不能为空/);
  await assert.rejects(store.rename(defaultDevicePlaylistId, ' '), /名称不能为空/);
});

test('library playlists keep optional description and cover URL with delete undo restore', async () => {
  let value: string | undefined, counter = 0;
  const repository: Pick<Repository, 'get' | 'put'> = { get: async <T>() => value ? JSON.parse(value) as T : undefined, put: async (_, data) => { value = JSON.stringify(data); } };
  const library = new LibraryStore(repository, () => String(++counter), () => 1000);
  await library.restore();
  const id = await library.createPlaylist('旅行', [track], { description: '在路上', coverUrl: 'https://example.test/cover.jpg' });
  let playlist = library.getSnapshot().playlists[0]!;
  assert.equal(playlist.description, '在路上');
  assert.equal(playlist.coverUrl, 'https://example.test/cover.jpg');
  await library.updatePlaylistMeta(id, { description: '公路之旅' });
  playlist = library.getSnapshot().playlists[0]!;
  assert.equal(playlist.description, '公路之旅');
  const snapshot = playlist;
  await library.deletePlaylist(id);
  assert.equal(library.getSnapshot().playlists.length, 0);
  await library.restorePlaylist(snapshot);
  assert.equal(library.getSnapshot().playlists.length, 1);
  assert.equal(library.getSnapshot().playlists[0]!.title, '旅行');
  assert.equal(library.getSnapshot().playlists[0]!.description, '公路之旅');
  const persisted = JSON.parse(value!);
  assert.ok(persisted.playlists[0].description === '公路之旅');
  await assert.rejects(library.updatePlaylistMeta(id, { description: 'x'.repeat(600) }), /歌单描述无效/);
});
