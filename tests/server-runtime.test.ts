import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { initializeRuntimeSecrets, RuntimeLogs } from '../apps/server/src/runtime.ts';

const directories: string[] = [];
afterEach(() => {
  for (const path of directories.splice(0)) {
    const target = resolve(path);
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('taskboard-runtime-'))
      throw new Error('Refusing to remove a directory outside this test runtime');
    rmSync(target, { recursive: true, force: true });
  }
});
describe('managed server runtime', () => {
  it('generates independent secrets once and preserves them across restarts', () => {
    const directory = mkdtempSync(join(tmpdir(), 'taskboard-runtime-'));
    directories.push(directory);
    const first = initializeRuntimeSecrets(directory);
    expect(new Set(Object.values(first)).size).toBe(4);
    for (const value of Object.values(first)) expect(value).toMatch(/^[a-f0-9]{64}$/);
    expect(initializeRuntimeSecrets(directory)).toEqual(first);
    expect(readFileSync(join(directory, 'postgres-password'), 'utf8')).toBe(first.databasePassword);
    writeFileSync(join(directory, 'session-key'), 'broken');
    expect(() => initializeRuntimeSecrets(directory)).toThrow('Invalid persisted secret');
    expect(readFileSync(join(directory, 'session-key'), 'utf8')).toBe('broken');
  });
  it('bounds logs and removes credentials before retention', () => {
    const logs = new RuntimeLogs(['secret-session-value'], false);
    for (let index = 0; index < 1100; index++)
      logs.write(
        JSON.stringify({
          time: Date.now(),
          level: 30,
          msg: `entry ${index} postgres://user:database-password@db/test secret-session-value`,
        }),
      );
    const entries = logs.recent(2000);
    expect(entries).toHaveLength(1000);
    expect(entries[0].message).toContain('entry 100 ');
    expect(JSON.stringify(entries)).not.toContain('database-password');
    expect(JSON.stringify(entries)).not.toContain('secret-session-value');
    entries[0].message = 'modified';
    expect(logs.recent(2000)[0].message).not.toBe('modified');
  });
});
