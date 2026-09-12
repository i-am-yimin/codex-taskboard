import type { Board, Space, User } from './types';

const key = 'tb:offline-session:v1';

export interface OfflineSnapshot {
  version: 1;
  account: User;
  spaces: Space[];
  boards: Record<string, Board>;
  updatedAt: string;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): StorageLike | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

/**
 * There is deliberately only one offline session. It is a read-only hint for a
 * browser that is already offline, never proof that its account is authenticated.
 */
export function readOfflineSnapshot(storage = browserStorage()): OfflineSnapshot | null {
  if (!storage) return null;
  try {
    const value = JSON.parse(storage.getItem(key) ?? 'null') as Partial<OfflineSnapshot> | null;
    if (
      value?.version !== 1 ||
      !value.account ||
      typeof value.account.id !== 'string' ||
      !Array.isArray(value.spaces) ||
      !value.boards ||
      typeof value.boards !== 'object' ||
      typeof value.updatedAt !== 'string'
    )
      return null;
    return value as OfflineSnapshot;
  } catch {
    return null;
  }
}

export function saveOfflineSnapshot(
  account: User,
  spaces: Space[],
  board: Board,
  storage = browserStorage(),
) {
  if (!storage) return;
  const current = readOfflineSnapshot(storage);
  const permitted = new Set(spaces.map((space) => space.id));
  const boards =
    current?.account.id === account.id
      ? Object.fromEntries(Object.entries(current.boards).filter(([id]) => permitted.has(id)))
      : {};
  const snapshot: OfflineSnapshot = {
    version: 1,
    account,
    spaces,
    boards: permitted.has(board.space.id) ? { ...boards, [board.space.id]: board } : boards,
    updatedAt: new Date().toISOString(),
  };
  storage.setItem(key, JSON.stringify(snapshot));
}

/** Clear only the matching account, so a later account cannot read its predecessor's snapshot. */
export function clearOfflineSnapshot(accountId?: string, storage = browserStorage()) {
  if (!storage) return;
  const current = readOfflineSnapshot(storage);
  if (!accountId || current?.account.id === accountId) storage.removeItem(key);
}

/** A space-level permission loss must not erase drafts from the account's other spaces. */
export function removeOfflineBoard(accountId: string, spaceId: string, storage = browserStorage()) {
  const current = readOfflineSnapshot(storage);
  if (!storage || current?.account.id !== accountId || !current.boards[spaceId]) return;
  const { [spaceId]: _removed, ...boards } = current.boards;
  storage.setItem(
    key,
    JSON.stringify({
      ...current,
      spaces: current.spaces.filter((space) => space.id !== spaceId),
      boards,
      updatedAt: new Date().toISOString(),
    } satisfies OfflineSnapshot),
  );
}
