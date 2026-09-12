import { createDatabase } from './db.ts';
import { migrate } from './migrate.ts';
const db = createDatabase();
try {
  await migrate(db);
} finally {
  await db.end();
}
