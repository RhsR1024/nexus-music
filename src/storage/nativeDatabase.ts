import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { Repository, type SQLConnection } from './repository.ts';

function connection(db: Pick<SQLiteDatabase, 'execAsync' | 'runAsync' | 'getAllAsync'>): SQLConnection {
  return {
    exec: sql => db.execAsync(sql),
    run: (sql, ...params) => db.runAsync(sql, params),
    all: <T>(sql: string, ...params: (string | number | null)[]) => db.getAllAsync<T>(sql, params),
  };
}
export async function openRepository() {
  const db = await openDatabaseAsync('nexus.sqlite');
  await db.execAsync('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
  const repository = new Repository({ ...connection(db), async transaction<T>(run: (tx: SQLConnection) => Promise<T>) {
    let value!: T;
    await db.withExclusiveTransactionAsync(async tx => { value = await run(connection(tx)); });
    return value;
  } });
  await repository.migrate();
  return repository;
}
