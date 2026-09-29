import { realpathSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { LocalProject } from '@taskboard/core';

/**
 * Reads the version-bound Codex project mapping from a data directory supplied
 * by the launcher. A visible project label is never enough to identify a root.
 * Missing or ambiguous internal state is treated as no project identity.
 */
export function resolveCodexProject(
  codexHome: string,
  visibleProjectId: string,
): LocalProject | undefined {
  if (
    !isAbsolute(codexHome) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(visibleProjectId)
  )
    return undefined;
  let database: DatabaseSync | undefined;
  try {
    database = new DatabaseSync(join(codexHome, 'state_5.sqlite'), {
      readOnly: true,
    });
    database.exec('PRAGMA query_only = ON');
    const rows = database
      .prepare(
        `SELECT p.id AS id, p.name AS name, r.path AS path
         FROM project_idempotency_keys AS k
         JOIN projects AS p ON p.id = k.project_id
         JOIN project_roots AS r ON r.project_id = p.id
         WHERE k.key = ?`,
      )
      .all(visibleProjectId);
    if (rows.length !== 1) return undefined;
    const row = rows[0];
    if (
      typeof row.id !== 'string' ||
      typeof row.name !== 'string' ||
      typeof row.path !== 'string' ||
      !isAbsolute(row.path)
    ) return undefined;
    return { id: visibleProjectId, name: row.name, path: realpathSync.native(row.path) };
  } catch {
    return undefined;
  } finally {
    database?.close();
  }
}
