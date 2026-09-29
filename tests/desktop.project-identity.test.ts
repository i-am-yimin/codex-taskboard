import { mkdtempSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveCodexProject } from '../packages/adapter-codex/src/project-identity.ts';

const directories: string[] = [];
const visibleId = 'f3f87941-d392-45d9-8c05-d7fdf1f134b1';

function fixture() {
  const home = mkdtempSync(join(tmpdir(), 'taskboard-codex-project-'));
  directories.push(home);
  const root = join(home, 'repo');
  mkdirSync(root);
  const database = new DatabaseSync(join(home, 'state_5.sqlite'));
  database.exec(`
    CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE project_idempotency_keys (key TEXT NOT NULL, project_id TEXT NOT NULL);
    CREATE TABLE project_roots (project_id TEXT NOT NULL, path TEXT NOT NULL);
  `);
  database.prepare('INSERT INTO projects VALUES (?, ?)').run('local-project', 'repo');
  database.prepare('INSERT INTO project_idempotency_keys VALUES (?, ?)').run(visibleId, 'local-project');
  database.prepare('INSERT INTO project_roots VALUES (?, ?)').run('local-project', root);
  return { home, root, database };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('Codex local project identity', () => {
  it('maps the exact visible ID to one existing local root', () => {
    const { home, root, database } = fixture();
    database.close();
    expect(resolveCodexProject(home, visibleId)).toEqual({
      id: visibleId,
      name: 'repo',
      path: realpathSync.native(root),
    });
    expect(resolveCodexProject(home, '00000000-0000-4000-8000-000000000000')).toBeUndefined();
  });

  it('refuses an ambiguous root or missing database', () => {
    const { home, root, database } = fixture();
    database.prepare('INSERT INTO project_roots VALUES (?, ?)').run('local-project', root);
    database.close();
    expect(resolveCodexProject(home, visibleId)).toBeUndefined();
    expect(resolveCodexProject(join(home, 'missing'), visibleId)).toBeUndefined();
  });

  it('refuses changed schema and a root that no longer exists', () => {
    const first = fixture();
    first.database.exec('DROP TABLE project_idempotency_keys');
    first.database.close();
    expect(resolveCodexProject(first.home, visibleId)).toBeUndefined();

    const second = fixture();
    second.database.close();
    rmSync(second.root, { recursive: true });
    expect(resolveCodexProject(second.home, visibleId)).toBeUndefined();
  });
});
