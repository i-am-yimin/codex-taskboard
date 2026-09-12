/* eslint-disable @typescript-eslint/no-explicit-any -- PostgreSQL rows are dynamically shaped at the API boundary. */
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import { openapiDocument } from './openapi.ts';
import rateLimit from '@fastify/rate-limit';
import staticFiles from '@fastify/static';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { hash, verify, Algorithm } from '@node-rs/argon2';
import { z } from 'zod';
import {
  BoardError,
  requireRole,
  roles,
  spaceSchema,
  statusSchema,
  taskPatchSchema,
  taskSchema,
  type Role,
  type Task,
} from '@taskboard/core';
import { createDatabase, type Database, withTransaction, afterCommit } from './db.ts';
import type pg from 'pg';

type Auth = {
  id: string;
  name: string;
  email: string;
  instanceAdmin: boolean;
  deviceId: string | null;
  agent: boolean;
  sessionId?: string;
};
declare module 'fastify' {
  interface FastifyRequest {
    auth?: Auth;
  }
}
type AppOptions = {
  db?: Database;
  sessionSecret?: string;
  origin?: string;
  logger?: boolean;
};
const id = () => randomUUID();
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const publicPaths = new Set([
  '/api/v1/health',
  '/api/v1/openapi.json',
  '/api/v1/auth/login',
  '/api/v1/auth/invitations/accept',
  '/api/v1/auth/recovery/complete',
]);
const defaultStatuses = [
  ['待办', 'todo', '#94a3b8'],
  ['进行中', 'in_progress', '#6366f1'],
  ['待验收', 'in_review', '#f59e0b'],
  ['已完成', 'done', '#22c55e'],
  ['已取消', 'cancelled', '#64748b'],
] as const;

function asJson(value: unknown) {
  return JSON.stringify(value ?? null);
}
function rowUser(row: any) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    instanceAdmin: row.instance_admin,
  };
}
function rowSpace(row: any, role?: Role) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    description: row.description,
    version: row.version,
    archived: Boolean(row.archived_at),
    role: role ?? row.role,
  };
}
function rowStatus(row: any) {
  return {
    id: row.id,
    spaceId: row.space_id,
    name: row.name,
    semantic: row.semantic,
    position: row.position,
    color: row.color,
  };
}
function rowTask(row: any): Task {
  return {
    id: row.id,
    spaceId: row.space_id,
    number: row.number,
    title: row.title,
    description: row.description,
    statusId: row.status_id,
    priority: row.priority,
    assigneeId: row.assignee_id,
    labels: row.labels ?? [],
    checklist: row.checklist ?? [],
    repository: row.repository,
    blocked: row.blocked,
    blockedReason: row.blocked_reason,
    position: row.position,
    version: row.version,
    archived: Boolean(row.archived_at),
    updatedAt: row.updated_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}
function rowExecution(row: any) {
  return {
    id: row.id,
    taskId: row.task_id,
    actorId: row.actor_id,
    deviceId: row.device_id,
    threadId: row.thread_id,
    phase: row.phase,
    summary: row.summary,
    verification: row.verification,
    createdAt: row.created_at.toISOString(),
  };
}
function numberHeader(value: unknown) {
  const n = Number(String(value ?? '').replaceAll('"', ''));
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
function body<T>(request: FastifyRequest, schema: z.ZodType<T>): T {
  const parsed = schema.safeParse(request.body);
  if (!parsed.success)
    throw new BoardError('VALIDATION_ERROR', '请求参数无效', 422, parsed.error.flatten());
  return parsed.data;
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const db = options.db ?? createDatabase();
  const secret =
    options.sessionSecret ??
    process.env.SESSION_KEY ??
    'development-only-change-this-to-a-64-char-secret-development-only-change-this';
  if (
    process.env.NODE_ENV === 'production' &&
    !/^[a-fA-F0-9]{64}$/.test(options.sessionSecret ?? process.env.SESSION_KEY ?? '')
  )
    throw new Error('SESSION_KEY must be 64 random hexadecimal characters in production');
  // Caddy is the sole reverse proxy in production. Do not accept arbitrary
  // truthy values, because trusting client-provided forwarding headers would
  // weaken origin and rate-limit decisions.
  const trustProxy =
    process.env.TRUST_PROXY === '1'
      ? (_address: string, hop: number) => hop < 1
      : process.env.TRUST_PROXY === 'loopback'
        ? 'loopback'
        : false;
  const app = Fastify({
    trustProxy,
    logger: options.logger
      ? {
          redact: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.body.password',
            'req.body.token',
          ],
        }
      : false,
  });
  const origin = options.origin ?? process.env.PUBLIC_ORIGIN;
  const subscribers = new Map<string, Set<(event: unknown) => void>>();
  const closeSubscriptions = new Set<() => void>();
  const recheckSubscriptions = () =>
    afterCommit(() =>
      subscribers.forEach((list) =>
        list.forEach((send) => send({ type: 'authorization.changed' })),
      ),
    );
  const emit = (spaceId: string, event: unknown) =>
    afterCommit(() => {
      subscribers.get(spaceId)?.forEach((send) => send(event));
    });
  // Every mutation and its idempotency response share one SQL transaction. Route
  // handlers return an envelope; Fastify sends it only after COMMIT succeeds.
  app.addHook('onRoute', (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    if (
      !route.url.startsWith('/api/v1') ||
      methods.every((method) => ['GET', 'HEAD', 'OPTIONS'].includes(method))
    )
      return;
    const handler = route.handler;
    route.handler = async function (request, reply) {
      return withTransaction(db, async () => {
        const params = request.params as Record<string, string>;
        let spaceId = params?.spaceId;
        if (!spaceId && params?.taskId)
          spaceId = (await db.query('SELECT space_id FROM tasks WHERE id=$1', [params.taskId]))
            .rows[0]?.space_id;
        if (!spaceId && params?.statusId)
          spaceId = (await db.query('SELECT space_id FROM statuses WHERE id=$1', [params.statusId]))
            .rows[0]?.space_id;
        // Small trusted teams favor deterministic space mutations over parallel
        // writes racing permission changes, state migration and task claims.
        if (spaceId) {
          const space = await db.query('SELECT id,archived_at FROM spaces WHERE id=$1 FOR UPDATE', [
            spaceId,
          ]);
          if (space.rows[0]?.archived_at && !request.url.split('?')[0].endsWith('/restore'))
            throw new BoardError('SPACE_ARCHIVED', '归档空间不能修改', 409);
        }
        return handler.call(this, request, reply);
      });
    };
  });
  app.register(cookie, { secret, hook: 'onRequest' });
  app.register(rateLimit, { global: true, max: 300, timeWindow: '1 minute' });
  app.addHook('onRequest', async (request, _reply) => {
    if (!request.url.startsWith('/api/')) return;
    if (origin && request.headers.origin && request.headers.origin !== origin)
      throw new BoardError('ORIGIN_FORBIDDEN', '请求来源不受信任', 403);
    if (publicPaths.has(request.url.split('?')[0])) return;
    const bearer = request.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    if (bearer) {
      const found = await db.query(
        `SELECT u.*, d.id device_id FROM devices d JOIN users u ON u.id=d.user_id WHERE d.token_hash=$1 AND d.revoked_at IS NULL AND u.archived_at IS NULL`,
        [sha(bearer)],
      );
      if (found.rowCount) {
        const u = found.rows[0];
        request.auth = { ...rowUser(u), deviceId: u.device_id, agent: true };
        return;
      }
    }
    const raw = request.cookies.tb_session;
    if (raw) {
      const unsigned = request.unsignCookie(raw);
      if (unsigned.valid) {
        const found = await db.query(
          `SELECT u.*, s.device_id FROM sessions s JOIN users u ON u.id=s.user_id JOIN devices d ON d.id=s.device_id WHERE s.id=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.archived_at IS NULL AND d.revoked_at IS NULL`,
          [unsigned.value],
        );
        if (found.rowCount) {
          const u = found.rows[0];
          request.auth = {
            ...rowUser(u),
            deviceId: u.device_id,
            agent: false,
            sessionId: unsigned.value,
          };
          return;
        }
      }
    }
    throw new BoardError('UNAUTHENTICATED', '请先登录', 401);
  });
  app.addHook('preHandler', async (request) => {
    if (!request.auth?.agent || ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
    const path = request.url.split('?')[0];
    const allowed =
      path === '/api/v1/auth/logout' ||
      /^\/api\/v1\/spaces\/[^/]+\/tasks$/.test(path) ||
      /^\/api\/v1\/tasks\/[^/]+\/(claim|submit|release|comments|executions)$/.test(path) ||
      (request.method === 'PATCH' && /^\/api\/v1\/tasks\/[^/]+$/.test(path));
    if (!allowed)
      throw new BoardError(
        'AGENT_SCOPE_FORBIDDEN',
        'Agent 令牌只能处理任务，不能变更空间、成员或工作流',
        403,
      );
  });
  app.setErrorHandler(async (error, _request, reply) => {
    const known =
      error instanceof BoardError
        ? error
        : error instanceof z.ZodError
          ? new BoardError('VALIDATION_ERROR', '请求参数无效', 422)
          : (error as { code?: string }).code === '22P02'
            ? new BoardError('VALIDATION_ERROR', '标识或参数格式无效', 422)
            : (error as { code?: string }).code === '23505'
              ? new BoardError('CONFLICT', '记录已存在或排序位置冲突', 409)
              : (error as { statusCode?: number }).statusCode === 429
                ? new BoardError('RATE_LIMITED', '请求过于频繁，请稍后重试', 429)
                : new BoardError('INTERNAL_ERROR', '服务器发生错误', 500);
    if (!(error instanceof BoardError)) app.log.error(error);
    reply.status(known.status).send({
      error: {
        code: known.code,
        message: known.message,
        details: known.details,
      },
    });
  });
  function ok(reply: any, data: unknown, status = 200) {
    reply.status(status);
    return { data };
  }
  async function member(spaceId: string, userId: string) {
    const found = await db.query(
      'SELECT role FROM space_members WHERE space_id=$1 AND user_id=$2',
      [spaceId, userId],
    );
    if (!found.rowCount) throw new BoardError('FORBIDDEN', '没有此空间的访问权限', 403);
    return found.rows[0].role as Role;
  }
  async function taskAndRole(taskId: string, userId: string) {
    const result = await db.query(
      `SELECT t.*, m.role FROM tasks t JOIN space_members m ON m.space_id=t.space_id AND m.user_id=$2 WHERE t.id=$1`,
      [taskId, userId],
    );
    if (!result.rowCount) throw new BoardError('NOT_FOUND', '任务不存在或无权访问', 404);
    return result.rows[0];
  }
  function assertWrite(request: FastifyRequest) {
    const key = request.headers['idempotency-key'];
    if (!key || typeof key !== 'string' || key.length > 200)
      throw new BoardError('IDEMPOTENCY_REQUIRED', '写操作必须携带 Idempotency-Key', 428);
    return key;
  }
  async function stored(request: FastifyRequest) {
    const key = assertWrite(request);
    const auth = request.auth!;
    const requestHash = sha(
      `${request.method}:${request.url}:${asJson(request.body)}:${request.headers['if-match'] ?? ''}:${auth.agent ? 'agent' : 'browser'}`,
    );
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`${auth.id}:${key}`]);
    const found = await db.query(
      'SELECT request_hash,response,status_code FROM idempotency_keys WHERE user_id=$1 AND key=$2',
      [auth.id, key],
    );
    if (found.rowCount && found.rows[0].request_hash !== requestHash)
      throw new BoardError('IDEMPOTENCY_MISMATCH', '相同 Idempotency-Key 不能用于不同请求', 409);
    return { key, requestHash, cached: found.rowCount ? found.rows[0] : null };
  }
  async function saveIdempotency(
    request: FastifyRequest,
    key: string,
    result: unknown,
    status = 200,
  ) {
    const requestHash = sha(
      `${request.method}:${request.url}:${asJson(request.body)}:${request.headers['if-match'] ?? ''}:${request.auth!.agent ? 'agent' : 'browser'}`,
    );
    await db.query(
      'INSERT INTO idempotency_keys(user_id,key,request_hash,response,status_code) VALUES ($1,$2,$3,$4::jsonb,$5)',
      [request.auth!.id, key, requestHash, asJson(result), status],
    );
  }
  async function activity(
    taskId: string,
    actorId: string,
    kind: string,
    text = '',
    executor: Pick<pg.Pool, 'query'> | pg.PoolClient = db,
  ) {
    await executor.query(
      'INSERT INTO activities (id,task_id,actor_id,kind,body) VALUES ($1,$2,$3,$4,$5)',
      [id(), taskId, actorId, kind, text],
    );
  }
  function patchFrom(input: Record<string, unknown>) {
    const fields: string[] = [];
    const values: unknown[] = [];
    const map: Record<string, string> = {
      title: 'title',
      description: 'description',
      statusId: 'status_id',
      priority: 'priority',
      assigneeId: 'assignee_id',
      labels: 'labels',
      checklist: 'checklist',
      repository: 'repository',
      blocked: 'blocked',
      blockedReason: 'blocked_reason',
      position: 'position',
      archived: 'archived_at',
    };
    for (const [key, column] of Object.entries(map))
      if (key in input) {
        fields.push(
          `${column}=$${values.length + 1}${key === 'labels' || key === 'checklist' ? '::jsonb' : ''}`,
        );
        values.push(
          key === 'labels' || key === 'checklist'
            ? asJson(input[key])
            : key === 'archived'
              ? (input[key] as boolean)
                ? new Date()
                : null
              : input[key],
        );
      }
    return { fields, values };
  }

  app.get('/api/v1/health', async (_request, reply) => {
    await db.query('SELECT 1');
    return ok(reply, { status: 'ok', database: 'ok' });
  });
  app.get('/api/v1/openapi.json', async () => openapiDocument);
  app.post('/api/v1/auth/login', async (request, reply) => {
    const input = body(
      request,
      z
        .object({
          email: z
            .string()
            .email()
            .max(254)
            .transform((v) => v.toLowerCase()),
          password: z.string().min(12).max(256),
          deviceName: z.string().min(1).max(80).default('浏览器'),
          tokenKind: z.enum(['browser', 'agent']).default('browser'),
        })
        .strict(),
    );
    const found = await db.query('SELECT * FROM users WHERE email=$1 AND archived_at IS NULL', [
      input.email,
    ]);
    if (!found.rowCount || !(await verify(found.rows[0].password_hash, input.password)))
      throw new BoardError('INVALID_CREDENTIALS', '邮箱或密码错误', 401);
    const user = found.rows[0];
    const deviceId = id();
    const rawToken = input.tokenKind === 'agent' ? `${randomUUID()}${randomUUID()}` : null;
    await db.query('INSERT INTO devices (id,user_id,name,token_hash) VALUES ($1,$2,$3,$4)', [
      deviceId,
      user.id,
      input.deviceName,
      rawToken ? sha(rawToken) : null,
    ]);
    if (input.tokenKind === 'browser') {
      const sessionId = id();
      await db.query(
        "INSERT INTO sessions (id,user_id,device_id,expires_at) VALUES ($1,$2,$3,now()+interval '30 days')",
        [sessionId, user.id, deviceId],
      );
      reply.setCookie('tb_session', sessionId, {
        signed: true,
        httpOnly: true,
        sameSite: 'lax',
        secure: Boolean(origin?.startsWith('https://')),
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return ok(reply, {
      user: rowUser(user),
      device: { id: deviceId, name: input.deviceName },
      ...(rawToken ? { deviceToken: rawToken } : {}),
    });
  });
  app.post('/api/v1/auth/logout', async (request, reply) => {
    const raw = request.cookies.tb_session;
    if (raw) {
      const parsed = request.unsignCookie(raw);
      if (parsed.valid)
        await db.query('UPDATE sessions SET revoked_at=now() WHERE id=$1', [parsed.value]);
    }
    reply.clearCookie('tb_session', { path: '/' });
    if (request.auth?.agent)
      await db.query('UPDATE devices SET revoked_at=now() WHERE id=$1', [request.auth.deviceId]);
    recheckSubscriptions();
    return ok(reply, { loggedOut: true });
  });
  app.get('/api/v1/me', async (request, reply) =>
    ok(reply, {
      id: request.auth!.id,
      name: request.auth!.name,
      email: request.auth!.email,
      instanceAdmin: request.auth!.instanceAdmin,
    }),
  );
  app.post('/api/v1/auth/invitations/accept', async (request, reply) => {
    const input = body(
      request,
      z
        .object({
          token: z.string().min(20),
          name: z.string().trim().min(1).max(80),
          email: z
            .string()
            .email()
            .max(254)
            .transform((v) => v.toLowerCase()),
          password: z.string().min(12).max(256),
        })
        .strict(),
    );
    const userId = await withTransaction(db, async (client) => {
      const invitation = await client.query(
        'SELECT * FROM invitations WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE',
        [sha(input.token)],
      );
      if (
        !invitation.rowCount ||
        (invitation.rows[0].email && invitation.rows[0].email !== input.email)
      )
        throw new BoardError('INVALID_INVITATION', '邀请无效或已过期', 400);
      const inv = invitation.rows[0];
      const existing = await client.query(
        'SELECT id,password_hash FROM users WHERE email=$1 AND archived_at IS NULL FOR UPDATE',
        [input.email],
      );
      const acceptedUserId = existing.rows[0]?.id ?? id();
      if (existing.rowCount && !(await verify(existing.rows[0].password_hash, input.password)))
        throw new BoardError('INVALID_CREDENTIALS', '已有账号请使用当前账号密码接受邀请', 401);
      if (!existing.rowCount)
        await client.query('INSERT INTO users (id,email,name,password_hash) VALUES ($1,$2,$3,$4)', [
          acceptedUserId,
          input.email,
          input.name,
          await hash(input.password, { algorithm: Algorithm.Argon2id }),
        ]);
      if (inv.space_id)
        await client.query(
          'INSERT INTO space_members (space_id,user_id,role) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [inv.space_id, acceptedUserId, inv.role],
        );
      await client.query('UPDATE invitations SET used_at=now() WHERE id=$1', [inv.id]);
      return acceptedUserId;
    });
    return ok(reply, { userId }, 201);
  });
  app.post('/api/v1/auth/recovery/complete', async (request, reply) => {
    const input = body(
      request,
      z
        .object({
          token: z.string().min(20),
          password: z.string().min(12).max(256),
        })
        .strict(),
    );
    await withTransaction(db, async (c) => {
      const found = await c.query(
        'SELECT * FROM recovery_links WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE',
        [sha(input.token)],
      );
      if (!found.rowCount) throw new BoardError('INVALID_RECOVERY', '恢复链接无效或已过期', 400);
      await c.query('UPDATE users SET password_hash=$1 WHERE id=$2', [
        await hash(input.password, { algorithm: Algorithm.Argon2id }),
        found.rows[0].user_id,
      ]);
      await c.query('UPDATE recovery_links SET used_at=now() WHERE id=$1', [found.rows[0].id]);
      await c.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1', [
        found.rows[0].user_id,
      ]);
      await c.query('UPDATE devices SET revoked_at=now() WHERE user_id=$1', [
        found.rows[0].user_id,
      ]);
    });
    recheckSubscriptions();
    return ok(reply, { reset: true });
  });

  app.get('/api/v1/devices', async (r, p) => {
    const devices = await db.query(
      'SELECT id,name,created_at,revoked_at FROM devices WHERE user_id=$1 ORDER BY created_at DESC',
      [r.auth!.id],
    );
    return ok(
      p,
      devices.rows.map((d) => ({
        id: d.id,
        name: d.name,
        createdAt: d.created_at,
        revokedAt: d.revoked_at,
        current: d.id === r.auth!.deviceId,
      })),
    );
  });
  app.post('/api/v1/devices/:deviceId/revoke', async (r, p) => {
    const { deviceId } = r.params as { deviceId: string };
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response);
    const changed = await db.query(
      'UPDATE devices SET revoked_at=now() WHERE id=$1 AND user_id=$2 RETURNING id',
      [deviceId, r.auth!.id],
    );
    if (!changed.rowCount) throw new BoardError('NOT_FOUND', '设备不存在', 404);
    await db.query('UPDATE sessions SET revoked_at=now() WHERE device_id=$1', [deviceId]);
    const data = { revoked: true };
    await saveIdempotency(r, c.key, data);
    recheckSubscriptions();
    return ok(p, data);
  });
  app.post('/api/v1/admin/recovery', async (r, p) => {
    if (!r.auth!.instanceAdmin)
      throw new BoardError('FORBIDDEN', '仅实例管理员可以签发恢复链接', 403);
    const input = body(
      r,
      z.object({ email: z.email().transform((v) => v.toLowerCase()) }).strict(),
    );
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response);
    const user = await db.query('SELECT id FROM users WHERE email=$1 AND archived_at IS NULL', [
      input.email,
    ]);
    if (!user.rowCount) throw new BoardError('NOT_FOUND', '账号不存在', 404);
    const token = `tb_recovery_${id()}${id()}`;
    await db.query(
      "INSERT INTO recovery_links(id,user_id,token_hash,expires_at) VALUES ($1,$2,$3,now()+interval '24 hours')",
      [id(), user.rows[0].id, sha(token)],
    );
    const data = { url: `${origin ?? ''}/#recovery=${encodeURIComponent(token)}` };
    await saveIdempotency(r, c.key, data, 201);
    return ok(p, data, 201);
  });

  app.get('/api/v1/spaces', async (request, reply) => {
    const result = await db.query(
      `SELECT s.*,m.role FROM spaces s JOIN space_members m ON m.space_id=s.id WHERE m.user_id=$1 AND ($2::boolean OR s.archived_at IS NULL) ORDER BY s.updated_at DESC`,
      [request.auth!.id, (request.query as { archived?: string }).archived === 'true'],
    );
    return ok(
      reply,
      result.rows.map((row) => rowSpace(row)),
    );
  });
  app.post('/api/v1/spaces', async (request, reply) => {
    const cache = await stored(request);
    if (cache.cached) return ok(reply, cache.cached.response, cache.cached.status_code);
    const input = body(request, spaceSchema);
    const spaceId = id();
    await withTransaction(db, async (c) => {
      await c.query('INSERT INTO spaces (id,name,icon,color,description) VALUES ($1,$2,$3,$4,$5)', [
        spaceId,
        input.name,
        input.icon,
        input.color,
        input.description,
      ]);
      await c.query("INSERT INTO space_members (space_id,user_id,role) VALUES ($1,$2,'owner')", [
        spaceId,
        request.auth!.id,
      ]);
      for (let i = 0; i < defaultStatuses.length; i++) {
        const s = defaultStatuses[i];
        await c.query(
          'INSERT INTO statuses (id,space_id,name,semantic,position,color) VALUES ($1,$2,$3,$4,$5,$6)',
          [id(), spaceId, s[0], s[1], i, s[2]],
        );
      }
    });
    const data = rowSpace({ id: spaceId, ...input, version: 1 }, 'owner');
    await saveIdempotency(request, cache.key, data, 201);
    emit(spaceId, { type: 'space.created' });
    return ok(reply, data, 201);
  });
  app.get('/api/v1/spaces/:spaceId/board', async (request, reply) => {
    const { spaceId } = request.params as any;
    const role = await member(spaceId, request.auth!.id);
    const [s, st, t, m] = await Promise.all([
      db.query('SELECT * FROM spaces WHERE id=$1', [spaceId]),
      db.query('SELECT * FROM statuses WHERE space_id=$1 ORDER BY position', [spaceId]),
      db.query('SELECT * FROM tasks WHERE space_id=$1 AND archived_at IS NULL ORDER BY position', [
        spaceId,
      ]),
      db.query(
        'SELECT u.id,u.name,u.email,sm.role FROM space_members sm JOIN users u ON u.id=sm.user_id WHERE sm.space_id=$1 ORDER BY u.name',
        [spaceId],
      ),
    ]);
    if (!s.rowCount) throw new BoardError('NOT_FOUND', '空间不存在', 404);
    return ok(reply, {
      space: rowSpace(s.rows[0], role),
      statuses: st.rows.map(rowStatus),
      tasks: t.rows.map(rowTask),
      members: m.rows.map((x: any) => ({ ...rowUser(x), role: x.role })),
    });
  });
  app.patch('/api/v1/spaces/:spaceId', async (request, reply) => {
    const { spaceId } = request.params as any;
    requireRole(await member(spaceId, request.auth!.id), 'admin');
    const input = body(request, spaceSchema.partial());
    const version = numberHeader(request.headers['if-match']);
    if (!version) throw new BoardError('VERSION_REQUIRED', '更新必须携带 If-Match 版本', 428);
    const cache = await stored(request);
    if (cache.cached) return ok(reply, cache.cached.response, cache.cached.status_code);
    const result = await db.query(
      'UPDATE spaces SET name=COALESCE($1,name),icon=COALESCE($2,icon),color=COALESCE($3,color),description=COALESCE($4,description),version=version+1,updated_at=now() WHERE id=$5 AND version=$6 RETURNING *',
      [
        input.name ?? null,
        input.icon ?? null,
        input.color ?? null,
        input.description ?? null,
        spaceId,
        version,
      ],
    );
    if (!result.rowCount) throw new BoardError('VERSION_CONFLICT', '空间已被其他设备修改', 409);
    const data = rowSpace(result.rows[0], await member(spaceId, request.auth!.id));
    await saveIdempotency(request, cache.key, data);
    emit(spaceId, { type: 'space.updated' });
    return ok(reply, data);
  });
  app.post('/api/v1/spaces/:spaceId/archive', async (r, p) => {
    const { spaceId } = r.params as any;
    requireRole(await member(spaceId, r.auth!.id), 'admin');
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response, c.cached.status_code);
    await db.query('UPDATE spaces SET archived_at=now(),version=version+1 WHERE id=$1', [spaceId]);
    const data = { archived: true };
    await saveIdempotency(r, c.key, data);
    emit(spaceId, { type: 'space.archived' });
    return ok(p, data);
  });
  app.post('/api/v1/spaces/:spaceId/restore', async (r, p) => {
    const { spaceId } = r.params as any;
    requireRole(await member(spaceId, r.auth!.id), 'admin');
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response, c.cached.status_code);
    await db.query('UPDATE spaces SET archived_at=NULL,version=version+1 WHERE id=$1', [spaceId]);
    const data = { archived: false };
    await saveIdempotency(r, c.key, data);
    emit(spaceId, { type: 'space.restored' });
    return ok(p, data);
  });

  app.get('/api/v1/spaces/:spaceId/members', async (r, p) => {
    const { spaceId } = r.params as any;
    await member(spaceId, r.auth!.id);
    const found = await db.query(
      'SELECT u.id,u.name,u.email,u.instance_admin,sm.role FROM space_members sm JOIN users u ON u.id=sm.user_id WHERE sm.space_id=$1',
      [spaceId],
    );
    return ok(
      p,
      found.rows.map((x: any) => ({ ...rowUser(x), role: x.role })),
    );
  });
  app.post('/api/v1/spaces/:spaceId/invitations', async (r, p) => {
    const { spaceId } = r.params as any;
    requireRole(await member(spaceId, r.auth!.id), 'admin');
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response, c.cached.status_code);
    const input = body(
      r,
      z
        .object({
          email: z.string().email().max(254).nullable().default(null),
          role: z.enum(['admin', 'editor', 'viewer']).default('editor'),
          expiresInHours: z
            .number()
            .int()
            .min(1)
            .max(24 * 30)
            .default(72),
        })
        .strict(),
    );
    const raw = `tb_${randomUUID()}${randomUUID()}`;
    const inviteId = id();
    await db.query(
      "INSERT INTO invitations (id,token_hash,email,role,space_id,created_by,expires_at) VALUES ($1,$2,$3,$4,$5,$6,now()+($7 || ' hours')::interval)",
      [
        inviteId,
        sha(raw),
        input.email,
        input.role,
        spaceId,
        r.auth!.id,
        String(input.expiresInHours),
      ],
    );
    const data = {
      id: inviteId,
      token: raw,
      expiresInHours: input.expiresInHours,
    };
    await saveIdempotency(r, c.key, data, 201);
    return ok(p, data, 201);
  });
  app.patch('/api/v1/spaces/:spaceId/members/:userId', async (r, p) => {
    const q = r.params as any;
    requireRole(await member(q.spaceId, r.auth!.id), 'admin');
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response, c.cached.status_code);
    const input = body(r, z.object({ role: z.enum(roles) }).strict());
    if (input.role === 'owner')
      throw new BoardError('OWNER_TRANSFER_REQUIRED', '请使用所有者转移接口', 422);
    const updated = await db.query(
      "UPDATE space_members SET role=$1 WHERE space_id=$2 AND user_id=$3 AND role <> 'owner' RETURNING role",
      [input.role, q.spaceId, q.userId],
    );
    if (!updated.rowCount) throw new BoardError('NOT_FOUND', '成员不存在', 404);
    const data = { userId: q.userId, role: input.role };
    await saveIdempotency(r, c.key, data);
    emit(q.spaceId, { type: 'member.updated', userId: q.userId });
    return ok(p, data);
  });
  app.delete('/api/v1/spaces/:spaceId/members/:userId', async (r, p) => {
    const q = r.params as any;
    requireRole(await member(q.spaceId, r.auth!.id), 'admin');
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response, c.cached.status_code);
    const result = await db.query(
      "DELETE FROM space_members WHERE space_id=$1 AND user_id=$2 AND role <> 'owner' RETURNING user_id",
      [q.spaceId, q.userId],
    );
    if (!result.rowCount)
      throw new BoardError('OWNER_TRANSFER_REQUIRED', '请先转移空间所有权', 422);
    const data = { removed: true };
    await saveIdempotency(r, c.key, data);
    emit(q.spaceId, { type: 'member.revoked', userId: q.userId });
    return ok(p, data);
  });
  app.post('/api/v1/spaces/:spaceId/transfer-owner', async (r, p) => {
    const { spaceId } = r.params as any;
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response, c.cached.status_code);
    requireRole(await member(spaceId, r.auth!.id), 'owner');
    const input = body(r, z.object({ userId: z.string().uuid() }).strict());
    await withTransaction(db, async (client) => {
      const target = await client.query(
        'SELECT 1 FROM space_members WHERE space_id=$1 AND user_id=$2',
        [spaceId, input.userId],
      );
      if (!target.rowCount) throw new BoardError('NOT_FOUND', '目标成员不存在', 404);
      await client.query("UPDATE space_members SET role='admin' WHERE space_id=$1 AND user_id=$2", [
        spaceId,
        r.auth!.id,
      ]);
      await client.query("UPDATE space_members SET role='owner' WHERE space_id=$1 AND user_id=$2", [
        spaceId,
        input.userId,
      ]);
    });
    const data = { ownerId: input.userId };
    await saveIdempotency(r, c.key, data);
    emit(spaceId, { type: 'member.ownerTransferred' });
    return ok(p, data);
  });

  app.post('/api/v1/spaces/:spaceId/statuses', async (r, p) => {
    const { spaceId } = r.params as any;
    requireRole(await member(spaceId, r.auth!.id), 'editor');
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response, c.cached.status_code);
    const input = body(r, statusSchema);
    const statusId = id();
    await db.query(
      'INSERT INTO statuses (id,space_id,name,semantic,position,color) VALUES ($1,$2,$3,$4,$5,$6)',
      [statusId, spaceId, input.name, input.semantic, input.position, input.color],
    );
    const data = rowStatus({ id: statusId, space_id: spaceId, ...input });
    await saveIdempotency(r, c.key, data, 201);
    emit(spaceId, { type: 'status.created' });
    return ok(p, data, 201);
  });
  app.patch('/api/v1/statuses/:statusId', async (r, p) => {
    const { statusId } = r.params as any;
    const status = await db.query('SELECT * FROM statuses WHERE id=$1', [statusId]);
    if (!status.rowCount) throw new BoardError('NOT_FOUND', '状态不存在', 404);
    requireRole(await member(status.rows[0].space_id, r.auth!.id), 'editor');
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response, c.cached.status_code);
    const input = body(r, statusSchema.partial());
    const result = await db.query(
      'UPDATE statuses SET name=COALESCE($1,name),semantic=COALESCE($2,semantic),position=COALESCE($3,position),color=COALESCE($4,color) WHERE id=$5 RETURNING *',
      [
        input.name ?? null,
        input.semantic ?? null,
        input.position ?? null,
        input.color ?? null,
        statusId,
      ],
    );
    const data = rowStatus(result.rows[0]);
    await saveIdempotency(r, c.key, data);
    emit(data.spaceId, { type: 'status.updated' });
    return ok(p, data);
  });
  app.post('/api/v1/spaces/:spaceId/statuses/reorder', async (r, p) => {
    const { spaceId } = r.params as { spaceId: string };
    requireRole(await member(spaceId, r.auth!.id), 'admin');
    const input = body(r, z.object({ statusIds: z.array(z.uuid()).min(1).max(100) }).strict());
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response);
    const current = await db.query('SELECT id FROM statuses WHERE space_id=$1', [spaceId]);
    if (
      new Set(input.statusIds).size !== current.rowCount ||
      input.statusIds.length !== current.rowCount ||
      current.rows.some((s) => !input.statusIds.includes(s.id))
    )
      throw new BoardError('INVALID_ORDER', '排序必须包含当前空间的全部状态且不重复', 422);
    for (let i = 0; i < input.statusIds.length; i++)
      await db.query('UPDATE statuses SET position=$1 WHERE id=$2 AND space_id=$3', [
        -(i + 1),
        input.statusIds[i],
        spaceId,
      ]);
    for (let i = 0; i < input.statusIds.length; i++)
      await db.query('UPDATE statuses SET position=$1 WHERE id=$2 AND space_id=$3', [
        i,
        input.statusIds[i],
        spaceId,
      ]);
    const result = (
      await db.query('SELECT * FROM statuses WHERE space_id=$1 ORDER BY position', [spaceId])
    ).rows.map(rowStatus);
    await saveIdempotency(r, c.key, result);
    emit(spaceId, { type: 'status.reordered' });
    return ok(p, result);
  });
  app.delete('/api/v1/statuses/:statusId', async (r, p) => {
    const { statusId } = r.params as any;
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response, c.cached.status_code);
    const old = await db.query('SELECT * FROM statuses WHERE id=$1', [statusId]);
    if (!old.rowCount) throw new BoardError('NOT_FOUND', '状态不存在', 404);
    requireRole(await member(old.rows[0].space_id, r.auth!.id), 'admin');
    const input = body(r, z.object({ targetStatusId: z.string().uuid() }).strict());
    if (input.targetStatusId === statusId)
      throw new BoardError('VALIDATION_ERROR', '迁移目标必须不同', 422);
    await withTransaction(db, async (client) => {
      const target = await client.query('SELECT 1 FROM statuses WHERE id=$1 AND space_id=$2', [
        input.targetStatusId,
        old.rows[0].space_id,
      ]);
      if (!target.rowCount)
        throw new BoardError('INVALID_STATUS_TARGET', '迁移目标不属于当前空间', 422);
      await client.query(
        'UPDATE tasks SET status_id=$1,version=version+1,updated_at=now() WHERE status_id=$2',
        [input.targetStatusId, statusId],
      );
      await client.query('DELETE FROM statuses WHERE id=$1', [statusId]);
    });
    const data = { deleted: true, migratedTo: input.targetStatusId };
    await saveIdempotency(r, c.key, data);
    emit(old.rows[0].space_id, { type: 'status.deleted' });
    return ok(p, data);
  });

  app.get('/api/v1/spaces/:spaceId/tasks', async (r, p) => {
    const { spaceId } = r.params as any;
    await member(spaceId, r.auth!.id);
    const q = r.query as any;
    const values: unknown[] = [spaceId];
    const where = ['space_id=$1'];
    if (q.statusId) {
      values.push(q.statusId);
      where.push(`status_id=$${values.length}`);
    }
    if (q.assigneeId) {
      values.push(q.assigneeId);
      where.push(`assignee_id=$${values.length}`);
    }
    if (q.priority !== undefined) {
      values.push(Number(q.priority));
      where.push(`priority=$${values.length}`);
    }
    if (q.query) {
      values.push(`%${q.query}%`);
      where.push(`(title ILIKE $${values.length} OR description ILIKE $${values.length})`);
    }
    const found = await db.query(
      `SELECT * FROM tasks WHERE ${where.join(' AND ')} ORDER BY position`,
      values,
    );
    return ok(p, found.rows.map(rowTask));
  });
  app.post('/api/v1/spaces/:spaceId/tasks', async (r, p) => {
    const { spaceId } = r.params as any;
    requireRole(await member(spaceId, r.auth!.id), 'editor');
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response, c.cached.status_code);
    const input = body(r, taskSchema);
    if (
      input.assigneeId &&
      !(
        await db.query('SELECT 1 FROM space_members WHERE space_id=$1 AND user_id=$2', [
          spaceId,
          input.assigneeId,
        ])
      ).rowCount
    )
      throw new BoardError('INVALID_ASSIGNEE', '负责人必须是当前空间成员', 422);
    const belongs = await db.query('SELECT semantic FROM statuses WHERE id=$1 AND space_id=$2', [
      input.statusId,
      spaceId,
    ]);
    if (!belongs.rowCount) throw new BoardError('INVALID_STATUS', '状态不属于当前空间', 422);
    if (r.auth!.agent && belongs.rows[0].semantic === 'done')
      throw new BoardError('AGENT_CANNOT_COMPLETE', 'Agent 不能直接创建已完成任务', 422);
    const taskId = id();
    const data = await withTransaction(db, async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [spaceId]);
      const seq = await client.query(
        'SELECT COALESCE(MAX(number),0)+1 n FROM tasks WHERE space_id=$1',
        [spaceId],
      );
      const result = await client.query(
        'INSERT INTO tasks (id,space_id,number,title,description,status_id,priority,assignee_id,labels,checklist,repository,blocked,blocked_reason,position) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12,$13,$14) RETURNING *',
        [
          taskId,
          spaceId,
          seq.rows[0].n,
          input.title,
          input.description,
          input.statusId,
          input.priority,
          input.assigneeId,
          asJson(input.labels),
          asJson(input.checklist),
          input.repository,
          input.blocked,
          input.blockedReason,
          input.position,
        ],
      );
      await activity(taskId, r.auth!.id, 'task.created', '', client);
      return rowTask(result.rows[0]);
    });
    await saveIdempotency(r, c.key, data, 201);
    emit(spaceId, { type: 'task.created', taskId });
    return ok(p, data, 201);
  });
  app.get('/api/v1/tasks/:taskId', async (r, p) => {
    const { taskId } = r.params as any;
    const found = await taskAndRole(taskId, r.auth!.id);
    return ok(p, rowTask(found));
  });
  app.post('/api/v1/tasks/:taskId/executions', async (r, p) => {
    const { taskId } = r.params as { taskId: string };
    const task = await taskAndRole(taskId, r.auth!.id);
    requireRole(task.role, 'editor');
    if (!r.auth!.deviceId) throw new BoardError('DEVICE_REQUIRED', '关联会话需要设备身份', 422);
    const input = body(
      r,
      z
        .object({ threadId: z.string().min(1).max(200), phase: z.literal('released').optional() })
        .strict(),
    );
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response, c.cached.status_code);
    const existing = await db.query(
      'SELECT * FROM executions WHERE task_id=$1 AND device_id=$2 AND thread_id=$3 ORDER BY created_at DESC LIMIT 1',
      [taskId, r.auth!.deviceId, input.threadId],
    );
    const linked = existing.rowCount
      ? existing
      : await db.query(
          "INSERT INTO executions(id,task_id,actor_id,device_id,thread_id,phase) VALUES ($1,$2,$3,$4,$5,'released') RETURNING *",
          [id(), taskId, r.auth!.id, r.auth!.deviceId, input.threadId],
        );
    const data = rowExecution(linked.rows[0]);
    await activity(taskId, r.auth!.id, 'execution.linked');
    await saveIdempotency(r, c.key, data, 201);
    emit(task.space_id, { type: 'execution.linked', taskId });
    return ok(p, data, 201);
  });
  app.get('/api/v1/spaces/:spaceId/export', async (r, p) => {
    const { spaceId } = r.params as { spaceId: string };
    const role = await member(spaceId, r.auth!.id);
    const [s, statuses, tasks, activities, executions] = await Promise.all([
      db.query('SELECT * FROM spaces WHERE id=$1', [spaceId]),
      db.query('SELECT * FROM statuses WHERE space_id=$1 ORDER BY position', [spaceId]),
      db.query('SELECT * FROM tasks WHERE space_id=$1 ORDER BY number', [spaceId]),
      db.query(
        'SELECT a.id,a.task_id,a.actor_id,a.kind,a.body,a.created_at FROM activities a JOIN tasks t ON t.id=a.task_id WHERE t.space_id=$1',
        [spaceId],
      ),
      db.query('SELECT e.* FROM executions e JOIN tasks t ON t.id=e.task_id WHERE t.space_id=$1', [
        spaceId,
      ]),
    ]);
    return ok(p, {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      space: rowSpace(s.rows[0], role),
      statuses: statuses.rows.map(rowStatus),
      tasks: tasks.rows.map(rowTask),
      activities: activities.rows,
      executions: executions.rows.map(rowExecution),
    });
  });
  app.get('/api/v1/tasks/:taskId/detail', async (r, p) => {
    const { taskId } = r.params as any;
    const task = await taskAndRole(taskId, r.auth!.id);
    const [a, e] = await Promise.all([
      db.query(
        'SELECT a.*,u.name actor_name FROM activities a JOIN users u ON u.id=a.actor_id WHERE a.task_id=$1 ORDER BY a.created_at DESC',
        [taskId],
      ),
      db.query('SELECT * FROM executions WHERE task_id=$1 ORDER BY created_at DESC', [taskId]),
    ]);
    return ok(p, {
      task: rowTask(task),
      activities: a.rows.map((x: any) => ({
        id: x.id,
        taskId: x.task_id,
        actorId: x.actor_id,
        actorName: x.actor_name,
        kind: x.kind,
        body: x.body,
        createdAt: x.created_at.toISOString(),
      })),
      executions: e.rows.map(rowExecution),
    });
  });
  app.patch('/api/v1/tasks/:taskId', async (r, p) => {
    const { taskId } = r.params as any;
    const existing = await taskAndRole(taskId, r.auth!.id);
    requireRole(existing.role, 'editor');
    const version = numberHeader(r.headers['if-match']);
    if (!version) throw new BoardError('VERSION_REQUIRED', '更新必须携带 If-Match 版本', 428);
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response, c.cached.status_code);
    const input = body(r, taskPatchSchema) as Record<string, unknown>;
    if (input.assigneeId) {
      const assignee = await db.query(
        'SELECT 1 FROM space_members WHERE space_id=$1 AND user_id=$2',
        [existing.space_id, input.assigneeId],
      );
      if (!assignee.rowCount)
        throw new BoardError('INVALID_ASSIGNEE', '负责人必须是当前空间成员', 422);
    }
    if (r.auth!.agent && 'statusId' in input) {
      const status = await db.query('SELECT semantic FROM statuses WHERE id=$1', [input.statusId]);
      if (status.rows[0]?.semantic === 'done')
        throw new BoardError('AGENT_CANNOT_COMPLETE', 'Agent 不能直接完成任务，请提交验收', 422);
    }
    if (input.statusId) {
      const belongs = await db.query('SELECT 1 FROM statuses WHERE id=$1 AND space_id=$2', [
        input.statusId,
        existing.space_id,
      ]);
      if (!belongs.rowCount) throw new BoardError('INVALID_STATUS', '状态不属于当前空间', 422);
    }
    const { fields, values } = patchFrom(input);
    if (!fields.length) throw new BoardError('VALIDATION_ERROR', '没有可更新字段', 422);
    values.push(taskId, version);
    const result = await db.query(
      `UPDATE tasks SET ${fields.join(',')},version=version+1,updated_at=now() WHERE id=$${values.length - 1} AND version=$${values.length} RETURNING *`,
      values,
    );
    if (!result.rowCount) throw new BoardError('VERSION_CONFLICT', '任务已被其他设备修改', 409);
    const data = rowTask(result.rows[0]);
    await activity(taskId, r.auth!.id, 'task.updated');
    await saveIdempotency(r, c.key, data);
    emit(data.spaceId, { type: 'task.updated', taskId });
    return ok(p, data);
  });
  app.post('/api/v1/tasks/:taskId/comments', async (r, p) => {
    const { taskId } = r.params as any;
    const t = await taskAndRole(taskId, r.auth!.id);
    requireRole(t.role, 'editor');
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response, c.cached.status_code);
    const input = body(r, z.object({ body: z.string().trim().min(1).max(10000) }).strict());
    const commentId = id();
    const result = await db.query(
      'INSERT INTO comments (id,task_id,actor_id,body) VALUES ($1,$2,$3,$4) RETURNING *',
      [commentId, taskId, r.auth!.id, input.body],
    );
    await activity(taskId, r.auth!.id, 'comment.added', input.body);
    const data = {
      id: commentId,
      taskId,
      actorId: r.auth!.id,
      body: input.body,
      createdAt: result.rows[0].created_at.toISOString(),
    };
    await saveIdempotency(r, c.key, data, 201);
    emit(t.space_id, { type: 'comment.created', taskId });
    return ok(p, data, 201);
  });
  app.post('/api/v1/tasks/:taskId/claim', async (r, p) => {
    const { taskId } = r.params as any;
    const task = await taskAndRole(taskId, r.auth!.id);
    requireRole(task.role, 'editor');
    if (!r.auth!.deviceId) throw new BoardError('DEVICE_REQUIRED', '领取任务需要已注册设备', 422);
    const version = numberHeader(r.headers['if-match']);
    if (!version) throw new BoardError('VERSION_REQUIRED', '领取必须携带 If-Match 版本', 428);
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response, c.cached.status_code);
    const input = body(
      r,
      z.object({ threadId: z.string().max(200).nullable().default(null) }).strict(),
    );
    const executionId = id();
    try {
      const data = await withTransaction(db, async (client) => {
        const locked = await client.query(
          'SELECT t.*, s.semantic FROM tasks t JOIN statuses s ON s.id=t.status_id WHERE t.id=$1 FOR UPDATE',
          [taskId],
        );
        if (!locked.rowCount)
          throw new BoardError('TASK_ALREADY_CLAIMED', '任务状态已变化，请刷新后重试', 409);
        if (locked.rows[0].archived_at || ['done', 'cancelled'].includes(locked.rows[0].semantic))
          throw new BoardError('TASK_NOT_CLAIMABLE', '已完成、已取消或已归档任务不能领取', 422);
        if (locked.rows[0].version !== version)
          throw new BoardError('VERSION_CONFLICT', '任务已被其他设备修改', 409);
        const inProgress = await client.query(
          "SELECT id FROM statuses WHERE space_id=$1 AND semantic='in_progress' ORDER BY position LIMIT 1",
          [task.space_id],
        );
        if (!inProgress.rowCount)
          throw new BoardError('MISSING_IN_PROGRESS_STATUS', '空间未配置进行中状态', 422);
        const result = await client.query(
          "INSERT INTO executions (id,task_id,actor_id,device_id,thread_id,phase) VALUES ($1,$2,$3,$4,$5,'running') RETURNING *",
          [executionId, taskId, r.auth!.id, r.auth!.deviceId, input.threadId],
        );
        const updated = await client.query(
          'UPDATE tasks SET status_id=$1,version=version+1,updated_at=now() WHERE id=$2 RETURNING *',
          [inProgress.rows[0].id, taskId],
        );
        await activity(taskId, r.auth!.id, 'execution.claimed', '', client);
        return {
          task: rowTask(updated.rows[0]),
          execution: rowExecution(result.rows[0]),
        };
      });
      await saveIdempotency(r, c.key, data, 201);
      emit(task.space_id, { type: 'execution.claimed', taskId });
      return ok(p, data, 201);
    } catch (error: any) {
      if (error?.code === '23505') {
        throw new BoardError('TASK_ALREADY_CLAIMED', '任务已被其他成员领取', 409);
      }
      throw error;
    }
  });
  app.post('/api/v1/tasks/:taskId/submit', async (r, p) => {
    const { taskId } = r.params as any;
    const task = await taskAndRole(taskId, r.auth!.id);
    requireRole(task.role, 'editor');
    if (!r.auth!.deviceId) throw new BoardError('DEVICE_REQUIRED', '提交需要设备身份', 422);
    const version = numberHeader(r.headers['if-match']);
    if (!version) throw new BoardError('VERSION_REQUIRED', '提交必须携带 If-Match 版本', 428);
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response, c.cached.status_code);
    const input = body(
      r,
      z
        .object({
          summary: z.string().trim().min(1).max(20000),
          verification: z.string().trim().min(1).max(20000),
        })
        .strict(),
    );
    const data = await withTransaction(db, async (client) => {
      const exe = await client.query(
        "UPDATE executions SET phase='submitted',summary=$1,verification=$2,updated_at=now() WHERE task_id=$3 AND actor_id=$4 AND device_id=$5 AND phase='running' RETURNING *",
        [input.summary, input.verification, taskId, r.auth!.id, r.auth!.deviceId],
      );
      if (!exe.rowCount) throw new BoardError('NO_ACTIVE_CLAIM', '没有可提交的任务领取记录', 409);
      const review = await client.query(
        "SELECT id FROM statuses WHERE space_id=$1 AND semantic='in_review' ORDER BY position LIMIT 1",
        [task.space_id],
      );
      if (!review.rowCount)
        throw new BoardError('MISSING_REVIEW_STATUS', '空间未配置待验收状态', 422);
      const updated = await client.query(
        'UPDATE tasks SET status_id=$1,version=version+1,updated_at=now() WHERE id=$2 AND version=$3 RETURNING *',
        [review.rows[0].id, taskId, version],
      );
      if (!updated.rowCount) throw new BoardError('VERSION_CONFLICT', '任务已被其他设备修改', 409);
      await activity(taskId, r.auth!.id, 'execution.submitted', input.summary, client);
      return {
        task: rowTask(updated.rows[0]),
        execution: rowExecution(exe.rows[0]),
      };
    });
    await saveIdempotency(r, c.key, data);
    emit(task.space_id, { type: 'execution.submitted', taskId });
    return ok(p, data);
  });
  app.post('/api/v1/tasks/:taskId/accept', async (r, p) => {
    const { taskId } = r.params as any;
    if (r.auth!.agent)
      throw new BoardError('AGENT_CANNOT_COMPLETE', 'Agent 不能验收并完成任务', 422);
    const task = await taskAndRole(taskId, r.auth!.id);
    requireRole(task.role, 'editor');
    const version = numberHeader(r.headers['if-match']);
    if (!version) throw new BoardError('VERSION_REQUIRED', '验收必须携带 If-Match 版本', 428);
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response, c.cached.status_code);
    const data = await withTransaction(db, async (client) => {
      const current = await client.query(
        'SELECT s.semantic FROM tasks t JOIN statuses s ON s.id=t.status_id WHERE t.id=$1 FOR UPDATE',
        [taskId],
      );
      if (!current.rowCount || current.rows[0].semantic !== 'in_review')
        throw new BoardError('TASK_NOT_READY_FOR_ACCEPTANCE', '只有待验收任务可以完成', 422);
      const running = await client.query(
        "SELECT 1 FROM executions WHERE task_id=$1 AND phase='running' LIMIT 1",
        [taskId],
      );
      if (running.rowCount)
        throw new BoardError('TASK_STILL_RUNNING', '任务仍有进行中的执行记录', 409);
      const done = await client.query(
        "SELECT id FROM statuses WHERE space_id=$1 AND semantic='done' ORDER BY position LIMIT 1",
        [task.space_id],
      );
      if (!done.rowCount) throw new BoardError('MISSING_DONE_STATUS', '空间未配置已完成状态', 422);
      const result = await client.query(
        'UPDATE tasks SET status_id=$1,version=version+1,updated_at=now() WHERE id=$2 AND version=$3 RETURNING *',
        [done.rows[0].id, taskId, version],
      );
      if (!result.rowCount) throw new BoardError('VERSION_CONFLICT', '任务已被其他设备修改', 409);
      await client.query(
        "UPDATE executions SET phase='released',updated_at=now() WHERE task_id=$1 AND phase='submitted'",
        [taskId],
      );
      await activity(taskId, r.auth!.id, 'task.accepted', '', client);
      return rowTask(result.rows[0]);
    });
    await saveIdempotency(r, c.key, data);
    emit(task.space_id, { type: 'task.accepted', taskId });
    return ok(p, data);
  });
  app.post('/api/v1/tasks/:taskId/release', async (r, p) => {
    const { taskId } = r.params as any;
    const task = await taskAndRole(taskId, r.auth!.id);
    requireRole(task.role, 'editor');
    const version = numberHeader(r.headers['if-match']);
    if (!version) throw new BoardError('VERSION_REQUIRED', '释放必须携带 If-Match 版本', 428);
    const c = await stored(r);
    if (c.cached) return ok(p, c.cached.response, c.cached.status_code);
    const input = body(r, z.object({ reason: z.string().trim().min(1).max(2000) }).strict());
    const data = await withTransaction(db, async (client) => {
      const running = await client.query(
        "SELECT * FROM executions WHERE task_id=$1 AND phase='running' FOR UPDATE",
        [taskId],
      );
      if (!running.rowCount)
        throw new BoardError('NO_ACTIVE_CLAIM', '没有可释放的任务领取记录', 409);
      const execution = running.rows[0];
      if (execution.actor_id !== r.auth!.id && task.role !== 'admin' && task.role !== 'owner')
        throw new BoardError('FORBIDDEN', '只能释放自己的执行记录，或由空间管理员恢复任务', 403);
      const updated = await client.query(
        'UPDATE tasks SET version=version+1,updated_at=now() WHERE id=$1 AND version=$2 RETURNING *',
        [taskId, version],
      );
      if (!updated.rowCount) throw new BoardError('VERSION_CONFLICT', '任务已被其他设备修改', 409);
      const result = await client.query(
        "UPDATE executions SET phase='released',updated_at=now() WHERE id=$1 RETURNING *",
        [execution.id],
      );
      await activity(taskId, r.auth!.id, 'execution.released', input.reason, client);
      return { task: rowTask(updated.rows[0]), execution: rowExecution(result.rows[0]) };
    });
    await saveIdempotency(r, c.key, data);
    emit(task.space_id, { type: 'execution.released', taskId });
    return ok(p, data);
  });
  app.get('/api/v1/spaces/:spaceId/events', async (r, p) => {
    const { spaceId } = r.params as any;
    await member(spaceId, r.auth!.id);
    p.hijack();
    p.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    p.raw.write(`event: ready\ndata: ${JSON.stringify({ spaceId })}\n\n`);
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(check);
      list.delete(send);
      closeSubscriptions.delete(close);
      if (!list.size) subscribers.delete(spaceId);
      p.raw.end();
    };
    const authorized = async () => {
      const auth = r.auth!;
      const active = auth.agent
        ? await db.query(
            'SELECT 1 FROM devices d JOIN users u ON u.id=d.user_id WHERE d.id=$1 AND d.user_id=$2 AND d.revoked_at IS NULL AND u.archived_at IS NULL',
            [auth.deviceId, auth.id],
          )
        : await db.query(
            'SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id JOIN devices d ON d.id=s.device_id WHERE s.id=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND d.revoked_at IS NULL AND u.archived_at IS NULL',
            [auth.sessionId],
          );
      if (!active.rowCount) return false;
      const membership = await db.query(
        'SELECT 1 FROM space_members WHERE space_id=$1 AND user_id=$2',
        [spaceId, auth.id],
      );
      return Boolean(membership.rowCount);
    };
    let queue = Promise.resolve();
    const send = (event: unknown) => {
      queue = queue
        .then(async () => {
          if (closed) return;
          if (!(await authorized())) {
            p.raw.write('event: revoked\ndata: {}\n\n');
            close();
            return;
          }
          p.raw.write(`event: board\ndata: ${JSON.stringify(event)}\n\n`);
        })
        .catch(() => close());
    };
    const list = subscribers.get(spaceId) ?? new Set();
    list.add(send);
    subscribers.set(spaceId, list);
    const check = setInterval(() => send({ type: 'heartbeat' }), 10000);
    closeSubscriptions.add(close);
    p.raw.on('close', close);
  });
  app.addHook('preClose', async () => {
    closeSubscriptions.forEach((close) => close());
  });
  const webRoot = resolve(process.env.WEB_ROOT ?? 'dist/web');
  if (existsSync(resolve(webRoot, 'index.html'))) {
    app.register(staticFiles, { root: webRoot, prefix: '/' });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method))
        return reply.code(404).send({ error: { code: 'NOT_FOUND', message: '接口不存在' } });
      return reply.sendFile('index.html');
    });
  }
  app.addHook('onClose', async () => {
    if (!options.db) await db.end();
  });
  return app;
}
