export type SQLValue = string | number | null;
export interface SQLConnection {
  exec(sql: string): Promise<void>;
  run(sql: string, ...params: SQLValue[]): Promise<unknown>;
  all<T>(sql: string, ...params: SQLValue[]): Promise<T[]>;
}
export interface SQLDatabase extends SQLConnection {
  transaction<T>(run: (connection: SQLConnection) => Promise<T>): Promise<T>;
}

export class Repository {
  private db: SQLDatabase;
  private tail: Promise<unknown> = Promise.resolve();
  constructor(db: SQLDatabase) { this.db = db; }
  async migrate() {
    const version = (await this.db.all<{ user_version: number }>('PRAGMA user_version'))[0]!.user_version;
    if (version > 1) throw new Error('数据版本较新，请使用更新版本的音枢');
    if (version === 0) await this.db.transaction(async tx => {
      await tx.exec('CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL); PRAGMA user_version = 1;');
    });
  }
  async get<T>(key: string): Promise<T | undefined> {
    await this.tail;
    const row = (await this.db.all<{ value: string }>('SELECT value FROM records WHERE key = ?', key))[0];
    return row ? JSON.parse(row.value) as T : undefined;
  }
  put(key: string, value: unknown) { return this.putMany([[key, value]]); }
  quarantine(key:string,backupKey:string):Promise<void> {
    const next=this.tail.then(()=>this.db.transaction(async tx=>{
      await tx.run('INSERT INTO records(key,value) SELECT ?,value FROM records WHERE key = ?',backupKey,key);
      await tx.run('DELETE FROM records WHERE key = ?',key);
    }));
    this.tail=next.catch(()=>{});return next;
  }
  putMany(entries: readonly (readonly [string, unknown])[]): Promise<void> {
    // Serialize before touching the database; invalid/circular values cannot
    // leave a partially written snapshot. One failed write does not poison later writes.
    const values = entries.map(([key, value]) => {
      const json = JSON.stringify(value);
      if (json === undefined) throw new Error('数据不可序列化');
      return [key, json] as const;
    });
    const next = this.tail.then(() => this.db.transaction(async tx => {
      for (const [key, json] of values) await tx.run('INSERT INTO records(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, json);
    }));
    this.tail = next.catch(() => {});
    return next;
  }
}
