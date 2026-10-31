import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { BoardError, type Role } from '@taskboard/core';
import type { Database } from './db.ts';

type AccessIdentity = { id: string; agent: boolean; instanceAdmin: boolean; sessionId?: string };
const access = new AsyncLocalStorage<AccessIdentity | undefined>();
export const withAccountAccess = <T>(identity: AccessIdentity | undefined, run: () => T): T =>
  access.run(identity, run);
export async function audit(
  db: Database,
  actor: string | null,
  action: string,
  target: string | null,
  reason = '',
  outcome = 'success',
) {
  await db.query(
    'INSERT INTO account_audit(id,actor_id,action,target_id,reason,outcome) VALUES($1,$2,$3,$4,$5,$6)',
    [randomUUID(), actor, action, target, reason, outcome],
  );
}
export async function activeTakeover(
  db: Database,
  spaceId: string,
  userId: string,
  identity = access.getStore(),
) {
  if (
    !identity ||
    identity.agent ||
    identity.id !== userId ||
    !identity.instanceAdmin ||
    !identity.sessionId
  )
    return null;
  const found = await db.query(
    `SELECT g.id,g.expires_at FROM space_takeovers g
    JOIN users u ON u.id=g.user_id JOIN sessions s ON s.id=g.session_id JOIN devices d ON d.id=s.device_id
    WHERE g.space_id=$1 AND g.user_id=$2 AND g.session_id=$3 AND g.revoked_at IS NULL
    AND g.expires_at>clock_timestamp() AND u.instance_admin AND u.archived_at IS NULL
    AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND d.revoked_at IS NULL
    ORDER BY g.created_at DESC LIMIT 1`,
    [spaceId, userId, identity.sessionId],
  );
  return (found.rows[0] as { id: string; expires_at: Date } | undefined) ?? null;
}
export async function spaceRole(db: Database, spaceId: string, userId: string): Promise<Role> {
  const found = await db.query<{ role: Role }>(
    'SELECT role FROM space_members WHERE space_id=$1 AND user_id=$2',
    [spaceId, userId],
  );
  if (await activeTakeover(db, spaceId, userId))
    return found.rows[0]?.role === 'owner' ? 'owner' : 'admin';
  if (!found.rowCount) throw new BoardError('FORBIDDEN', '没有此空间的访问权限', 403);
  return found.rows[0].role;
}
