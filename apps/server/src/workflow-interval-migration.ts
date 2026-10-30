import type pg from 'pg';
/** Retain old observations but never count an invalid historical open interval as exact. */
export async function migrateActiveWorkflowIntervals(client: pg.PoolClient): Promise<void> {
  if (
    (
      await client.query(
        "SELECT 1 FROM schema_migrations WHERE id='0009_active_workflow_intervals'",
      )
    ).rowCount
  )
    return;
  await client.query(`
UPDATE task_state_intervals i SET ended_at=now(),precision='legacy_unknown' FROM tasks t JOIN statuses s ON s.id=t.status_id JOIN spaces sp ON sp.id=t.space_id WHERE i.task_id=t.id AND i.ended_at IS NULL AND (t.archived_at IS NOT NULL OR sp.archived_at IS NOT NULL OR s.semantic IN ('done','cancelled') OR (i.kind='blocked' AND NOT t.blocked) OR (i.kind='review_wait' AND s.semantic<>'in_review'));
INSERT INTO task_state_intervals(id,task_id,kind) SELECT gen_random_uuid(),t.id,'blocked' FROM tasks t JOIN statuses s ON s.id=t.status_id JOIN spaces sp ON sp.id=t.space_id WHERE t.blocked AND t.archived_at IS NULL AND sp.archived_at IS NULL AND s.semantic NOT IN ('done','cancelled') ON CONFLICT DO NOTHING;
INSERT INTO task_state_intervals(id,task_id,kind) SELECT gen_random_uuid(),t.id,'review_wait' FROM tasks t JOIN statuses s ON s.id=t.status_id JOIN spaces sp ON sp.id=t.space_id WHERE t.archived_at IS NULL AND sp.archived_at IS NULL AND s.semantic='in_review' ON CONFLICT DO NOTHING;
INSERT INTO schema_migrations(id) VALUES('0009_active_workflow_intervals');
`);
}
