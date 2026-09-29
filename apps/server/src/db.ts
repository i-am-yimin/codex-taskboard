import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

export type Database = pg.Pool;
type TransactionScope = { database: Database; client: pg.PoolClient; afterCommit: (() => void)[] };
const transactions = new AsyncLocalStorage<TransactionScope | undefined>();

/** Notifications are published only after their underlying transaction commits. */
export function afterCommit(effect: () => void): void {
  const active = transactions.getStore();
  if (active) active.afterCommit.push(effect);
  else effect();
}

export function createDatabase(connectionString = process.env.DATABASE_URL): Database {
  if (!connectionString) throw new Error('DATABASE_URL is required');
  const pool = new pg.Pool({ connectionString, max: Number(process.env.DATABASE_POOL_SIZE ?? 10) });
  // pg emits idle-client failures on the pool. Without a listener, a database
  // restart can terminate the server even though a later query could reconnect.
  pool.on('error', (error) => {
    console.error('PostgreSQL idle connection error:', error.message);
  });
  const database: Database = new Proxy(pool, {
    get(target, property) {
      if (property === 'query')
        return (...args: Parameters<pg.Pool['query']>) => {
          const active = transactions.getStore();
          return active?.database === database
            ? active.client.query(...args)
            : target.query(...args);
        };
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return database;
}

export async function withTransaction<T>(
  db: Database,
  run: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const active = transactions.getStore();
  if (active?.database === db) return run(active.client);
  const client = await db.connect();
  const scope: TransactionScope = { database: db, client, afterCommit: [] };
  try {
    await client.query('BEGIN');
    const result = await transactions.run(scope, () => run(client));
    await client.query('COMMIT');
    for (const effect of scope.afterCommit) transactions.run(undefined, effect);
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
