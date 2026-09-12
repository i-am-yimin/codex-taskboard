import { describe, expect, it } from 'vitest';
import {
  clearOfflineSnapshot,
  removeOfflineBoard,
  readOfflineSnapshot,
  saveOfflineSnapshot,
} from '../apps/web/src/offlineSnapshot.ts';
import type { Board, Space, User } from '../apps/web/src/types.ts';

type TestStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
function memoryStorage(): TestStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

const account = (id: string): User => ({ id, name: `User ${id}`, email: `${id}@example.test` });
const space = (id: string): Space => ({
  id,
  name: `Space ${id}`,
  icon: '•',
  color: '#4267c8',
  description: '',
  version: 1,
  archived: false,
  role: 'editor',
});
const board = (id: string): Board => ({ space: space(id), statuses: [], tasks: [], members: [] });

describe('offline snapshot', () => {
  it('restores spaces and every visited board after an offline reload', () => {
    const storage = memoryStorage();
    saveOfflineSnapshot(account('A'), [space('one'), space('two')], board('one'), storage);
    saveOfflineSnapshot(account('A'), [space('one'), space('two')], board('two'), storage);

    const restored = readOfflineSnapshot(storage);
    expect(restored?.account.id).toBe('A');
    expect(restored?.spaces.map((item) => item.id)).toEqual(['one', 'two']);
    expect(Object.keys(restored?.boards ?? {})).toEqual(['one', 'two']);
  });

  it('replaces the prior account instead of retaining data that could cross accounts', () => {
    const storage = memoryStorage();
    saveOfflineSnapshot(account('A'), [space('a-space')], board('a-space'), storage);
    saveOfflineSnapshot(account('B'), [space('b-space')], board('b-space'), storage);

    const restored = readOfflineSnapshot(storage);
    expect(restored?.account.id).toBe('B');
    expect(restored?.boards['a-space']).toBeUndefined();
  });

  it('clears a matching logout or revocation snapshot but never guesses at another account', () => {
    const storage = memoryStorage();
    saveOfflineSnapshot(account('A'), [space('one')], board('one'), storage);
    clearOfflineSnapshot('B', storage);
    expect(readOfflineSnapshot(storage)?.account.id).toBe('A');
    clearOfflineSnapshot('A', storage);
    expect(readOfflineSnapshot(storage)).toBeNull();
  });

  it("removes only a revoked space without erasing the account's other cached board", () => {
    const storage = memoryStorage();
    saveOfflineSnapshot(account('A'), [space('one'), space('two')], board('one'), storage);
    saveOfflineSnapshot(account('A'), [space('one'), space('two')], board('two'), storage);
    removeOfflineBoard('A', 'one', storage);

    const restored = readOfflineSnapshot(storage);
    expect(restored?.boards.one).toBeUndefined();
    expect(restored?.boards.two?.space.id).toBe('two');
    expect(restored?.spaces.map((item) => item.id)).toEqual(['two']);
  });

  it('prunes boards that are absent from a newer authorized space list', () => {
    const storage = memoryStorage();
    saveOfflineSnapshot(account('A'), [space('one'), space('two')], board('one'), storage);
    saveOfflineSnapshot(account('A'), [space('one'), space('two')], board('two'), storage);
    saveOfflineSnapshot(account('A'), [space('two')], board('two'), storage);
    expect(readOfflineSnapshot(storage)?.boards.one).toBeUndefined();
  });

  it('does not reinsert a stale board that is no longer in the authorized spaces', () => {
    const storage = memoryStorage();
    saveOfflineSnapshot(account('A'), [space('one')], board('one'), storage);
    saveOfflineSnapshot(account('A'), [space('two')], board('one'), storage);
    expect(readOfflineSnapshot(storage)?.boards.one).toBeUndefined();
  });

  it('ignores malformed local storage rather than treating it as a session', () => {
    const storage = memoryStorage();
    storage.setItem('tb:offline-session:v1', '{not json');
    expect(readOfflineSnapshot(storage)).toBeNull();
  });
});
