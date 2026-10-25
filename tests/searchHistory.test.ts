import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { addSearchHistory, normalizeSearchHistory, normalizeSearchQuery, searchHistoryLimit, searchSuggestionLimit, suggestSearchQueries } from '../src/domain/searchHistory.ts';
import { SearchHistoryStore } from '../src/storage/searchHistory.ts';
import { Repository, type SQLConnection } from '../src/storage/repository.ts';

function store() {
  const db = new DatabaseSync(':memory:');
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

test('search queries trim and collapse whitespace while corrupt history is rejected', () => {
  assert.equal(normalizeSearchQuery('  shape \n of\t you  '), 'shape of you');
  assert.deepEqual(normalizeSearchHistory(['  a  ', 'A', 'b c']), ['a', 'b c']);
  assert.throws(() => normalizeSearchHistory('a'), /搜索历史数据无效/);
  assert.throws(() => normalizeSearchHistory(['a', 1]), /搜索历史数据无效/);
  assert.deepEqual(normalizeSearchHistory(Array.from({ length: 15 }, (_, index) => `q${index}`)).length, searchHistoryLimit);
});

test('recording a query moves it to the front without case duplicates and keeps the latest ten', () => {
  let history: readonly string[] = [];
  for (let index = 0; index < 12; index++) history = addSearchHistory(history, `query ${index}`);
  assert.equal(history.length, searchHistoryLimit);
  assert.equal(history[0], 'query 11');
  const repeated = addSearchHistory(history, '  QUERY  5 ');
  assert.equal(repeated[0], 'QUERY 5');
  assert.equal(repeated.filter(item => item.toLowerCase() === 'query 5').length, 1);
  assert.equal(addSearchHistory(repeated, '   '), repeated);
});

test('typed suggestions prefer prefix matches, exclude the draft and stop at five', () => {
  const history = ['yellow', 'mellow', 'hello', 'yell', 'yesterday', 'yellow submarine', 'bye'];
  assert.deepEqual(suggestSearchQueries(history, ' yell '), ['yellow', 'yellow submarine']);
  assert.deepEqual(suggestSearchQueries(history, 'ell'), ['yellow', 'mellow', 'hello', 'yell', 'yellow submarine']);
  assert.deepEqual(suggestSearchQueries(history, 'hello'), []);
  assert.deepEqual(suggestSearchQueries(history, '   '), []);
  assert.equal(suggestSearchQueries(['ab1', 'ab2', 'ab3', 'ab4', 'ab5', 'ab6', 'ab7'], 'ab').length, searchSuggestionLimit);
});

test('history store keeps tap order across restart and clears immediately', async () => {
  const { db, repository } = store(); await repository.migrate();
  const first = new SearchHistoryStore(repository); await first.restore();
  let notified = 0; first.subscribe(() => { notified++; });
  first.record('alpha'); await first.record('beta'); await first.record('ALPHA');
  assert.deepEqual(first.getSnapshot(), ['ALPHA', 'beta']);
  assert.ok(notified >= 2);

  const second = new SearchHistoryStore(repository); await second.restore();
  assert.deepEqual(second.getSnapshot(), ['ALPHA', 'beta']);
  await second.clear();
  assert.deepEqual(second.getSnapshot(), []);
  const third = new SearchHistoryStore(repository); await third.restore();
  assert.deepEqual(third.getSnapshot(), []);
  db.close();
});

test('failed history writes keep the previous snapshot and later writes still succeed', async () => {
  const { db, repository } = store(); await repository.migrate();
  const history = new SearchHistoryStore(repository); await history.restore();
  await history.record('kept');
  db.exec("CREATE TRIGGER reject_history BEFORE INSERT ON records WHEN NEW.key='search.history.v1' BEGIN SELECT RAISE(ABORT,'fixture'); END");
  await assert.rejects(history.record('dropped'));
  assert.deepEqual(history.getSnapshot(), ['kept']);
  db.exec('DROP TRIGGER reject_history');
  await history.record('later');
  assert.deepEqual(history.getSnapshot(), ['later', 'kept']);
  db.close();
});
