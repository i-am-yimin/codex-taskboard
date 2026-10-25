import type pg from 'pg';
export async function migrateRunRecovery(db: pg.PoolClient): Promise<void> {
  if ((await db.query("SELECT 1 FROM schema_migrations WHERE id='0007_run_recovery'")).rowCount)
    return;
  await db.query(`ALTER TABLE task_runs ADD COLUMN resolved_by uuid REFERENCES users(id), ADD COLUMN resolved_at timestamptz, ADD COLUMN resolution_reason text NOT NULL DEFAULT '';
    ALTER TABLE task_runs ADD CONSTRAINT run_resolution_consistent CHECK ((resolved_by IS NULL AND resolved_at IS NULL AND resolution_reason='') OR (phase='unknown' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL AND length(trim(resolution_reason))>0));
    INSERT INTO schema_migrations(id) VALUES('0007_run_recovery');`);
}
