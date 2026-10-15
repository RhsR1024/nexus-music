import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Repository, type SQLConnection } from '../src/storage/repository.ts';
import { SourceCatalog } from '../src/providers/sourceCatalog.ts';
import { SourceRegistry } from '../src/providers/sourceRegistry.ts';

function store(path = ':memory:') {
  const db = new DatabaseSync(path);
  const connection: SQLConnection = {
    exec: async sql => { db.exec(sql); },
    run: async (sql, ...params) => db.prepare(sql).run(...params),
    all: async <T>(sql: string, ...params: (string | number | null)[]) => db.prepare(sql).all(...params) as T[],
  };
  const repository = new Repository({ ...connection, transaction: async run => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = await run(connection); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  } });
  return { db, repository };
}
const hash = async (script: string) => createHash('sha256').update(script).digest('hex');
function registry() {
  return new SourceRegistry({ initialize: async source => {
    if (source.name === 'bad') throw new Error('fixture');
    return [{ platform: 'wy', name: 'fixture', actions: ['musicUrl'], qualities: ['128k'] }];
  }, destroy: () => {} });
}
const script = (name: string, version = '1') => `/**\n * @name ${name}\n * @version ${version}\n */\nlx.send('inited',{sources:{}});`;

test('SQLite snapshots survive reopen and preserve strings, order and duplicates', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'nexus-sqlite-'));
  try {
    const path = join(dir, 'test.sqlite');
    const first = store(path); await first.repository.migrate();
    const entries = [{ id: '90071992547409931234' }, { id: '90071992547409931234' }];
    await first.repository.put('queue', entries); first.db.close();
    const second = store(path); await second.repository.migrate();
    assert.deepEqual(await second.repository.get('queue'), entries); second.db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('failed SQLite transaction keeps old snapshots and subsequent writes still succeed', async () => {
  const { repository, db } = store(); await repository.migrate();
  await repository.put('first', 'old');
  db.exec("CREATE TRIGGER reject_fixture BEFORE INSERT ON records WHEN NEW.key='reject' BEGIN SELECT RAISE(ABORT,'fixture'); END");
  await assert.rejects(repository.putMany([['first', 'new'], ['reject', 1]]));
  assert.equal(await repository.get('first'), 'old');
  await repository.put('after', true); assert.equal(await repository.get('after'), true); db.close();
});

test('newer database versions are rejected without modifying records', async () => {
  const { db, repository } = store(); db.exec('PRAGMA user_version=99');
  await assert.rejects(repository.migrate());
  assert.equal((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version, 99); db.close();
});

test('source imports serialize concurrent mutations, deduplicate and restore enabled order', async () => {
  const { repository, db } = store(); await repository.migrate();
  const catalog = new SourceCatalog(registry(), repository, hash);
  const [a, b] = await Promise.all([catalog.import(script('a'), 'a.js'), catalog.import(script('b'), 'b.js')]);
  assert.equal((await catalog.import(script('a'), 'duplicate.js')).duplicate, true);
  await catalog.batch([a.id, b.id], 'enable');
  await catalog.move(b.id,-1);
  const next = new SourceCatalog(registry(), repository, hash); await next.restore(); await next.restoreEnabled();
  assert.deepEqual(next.getSnapshot().map(item => item.id), [b.id, a.id]);
  assert.ok(next.getSnapshot().every(item => item.status === 'ready'));
  assert.ok(!JSON.stringify(next.getSnapshot()).includes('lx.send'));
  db.close();
});

test('batch initialization failure preserves enabled intent without breaking other sources', async () => {
  const { repository, db } = store(); await repository.migrate();
  const catalog = new SourceCatalog(registry(), repository, hash);
  const a = await catalog.import(script('bad'), 'a.js'), b = await catalog.import(script('good'), 'b.js');
  assert.deepEqual(await catalog.batch([a.id, b.id], 'enable'), { failed: [a.id], succeeded: [b.id] });
  const saved = await repository.get<Array<{ enabled: boolean }>>('sources.v1');
  assert.ok(saved!.every(item => item.enabled));
  assert.deepEqual(catalog.getSnapshot().map(item => item.status), ['failed', 'ready']); db.close();
});

test('update retains a reversible old version and requires explicit re-enable', async () => {
  const { repository, db } = store(); await repository.migrate();
  const catalog = new SourceCatalog(registry(), repository, hash);
  const a = await catalog.import(script('a'), 'a.js'); await catalog.batch([a.id], 'enable');
  await catalog.update(a.id, script('a', '2'));
  assert.equal(catalog.getSnapshot()[0]!.version, '2');
  assert.equal(catalog.getSnapshot()[0]!.status, 'disabled');
  await catalog.rollback(a.id); assert.equal(catalog.getSnapshot()[0]!.version, '1');
  await catalog.batch([a.id], 'delete');
  assert.deepEqual(await repository.get('sources.v1'), []); db.close();
});

test('failed source persistence does not alter runtime or existing catalog', async () => {
  const { repository, db } = store(); await repository.migrate();
  const catalog = new SourceCatalog(registry(), repository, hash);
  const a = await catalog.import(script('a'), 'a.js');
  db.exec("CREATE TRIGGER fail_update BEFORE UPDATE ON records BEGIN SELECT RAISE(ABORT,'fixture'); END");
  await assert.rejects(catalog.batch([a.id], 'enable'));
  assert.equal(catalog.getSnapshot()[0]!.status, 'disabled'); db.close();
});

test('quarantine preserves exact malformed JSON atomically before removing the active record',async()=>{
  const {db,repository}=store();await repository.migrate();
  db.prepare('INSERT INTO records(key,value) VALUES(?,?)').run('broken','{malformed private payload');
  await assert.rejects(repository.get('broken'),SyntaxError);
  await repository.quarantine('broken','recovery.broken.fixture');
  assert.equal(await repository.get('broken'),undefined);
  assert.equal((db.prepare('SELECT value FROM records WHERE key=?').get('recovery.broken.fixture') as {value:string}).value,'{malformed private payload');
  await repository.put('broken',{version:1});assert.deepEqual(await repository.get('broken'),{version:1});db.close();
});

test('source version fingerprints change on update while an older routing snapshot retains its digest',async()=>{
  const {db,repository}=store();await repository.migrate();const runtime=registry();const catalog=new SourceCatalog(runtime,repository,hash);
  const imported=await catalog.import(script('fixture','1'),'fixture.js');await catalog.batch([imported.id],'enable');const old=runtime.getSnapshot()[0]!;
  await catalog.update(imported.id,script('fixture','2'));const current=runtime.getSnapshot()[0]!;
  assert.equal(old.fingerprint,await hash(script('fixture','1')));assert.equal(current.fingerprint,await hash(script('fixture','2')));assert.notEqual(old.fingerprint,current.fingerprint);assert.equal(old.id,current.id);db.close();
});
