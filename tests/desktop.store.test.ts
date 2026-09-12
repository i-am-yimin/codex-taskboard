import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CompanionStore } from '../apps/companion/src/store.ts';

describe('companion account partitions', () => {
  it('does not expose cache, drafts, or outbox across authenticated users', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'taskboard-store-'));
    const store = new CompanionStore(directory);
    await store.load();
    await store.activate('https://board.example/', 'alice');
    await store.cachePut('remote:/tasks/x', { owner: 'alice' });
    await store.saveDraft('00000000-0000-4000-8000-000000000001', { text: 'private' });
    await store.queue({
      path: '/tasks/x/submit',
      body: { summary: 'x' },
      version: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000009',
    });
    await store.activate('https://board.example', 'bob');
    expect(store.cacheGet('remote:/tasks/x')).toBeUndefined();
    expect(store.drafts()).toEqual([]);
    expect(store.outbox()).toEqual([]);
    await store.clearActiveData();
    await store.activate('https://board.example', 'alice');
    expect(store.cacheGet('remote:/tasks/x')).toEqual({ owner: 'alice' });
  });
  it('serializes concurrent persistence with unique temporary files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'taskboard-store-'));
    const store = new CompanionStore(directory);
    await store.load();
    await store.activate('https://board.example', 'alice');
    await Promise.all(Array.from({ length: 12 }, (_, index) => store.cachePut(`k${index}`, index)));
    const disk = JSON.parse(await readFile(join(directory, 'state.json'), 'utf8')) as {
      accounts: Record<string, { cache: Record<string, unknown> }>;
    };
    expect(Object.values(disk.accounts)[0].cache).toHaveProperty('k11');
  });
  it('retains the active credential identity across restart so a new login can invalidate a different account', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'taskboard-store-'));
    const first = new CompanionStore(directory);
    await first.load();
    await first.activate('https://board.example/', 'alice');
    const restarted = new CompanionStore(directory);
    await restarted.load();
    expect(restarted.activeIdentity()).toMatchObject({
      upstream: 'https://board.example/',
      userId: 'alice',
    });
    await restarted.clearActiveData();
    await restarted.activate('https://board.example', 'bob');
    expect(restarted.activeIdentity()).toMatchObject({ userId: 'bob' });
  });
});
