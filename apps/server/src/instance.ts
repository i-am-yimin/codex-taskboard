import { randomUUID, timingSafeEqual } from 'node:crypto';
import { hash, verify, Algorithm } from '@node-rs/argon2';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { BoardError } from '@taskboard/core';
import type { Database } from './db.ts';
import { afterCommit } from './db.ts';
import type { RuntimeLogs } from './runtime.ts';
import serverPackage from '../package.json';

export const instanceSettingsSchema = z
  .object({
    publicOrigin: z
      .string()
      .max(2048)
      .refine((value) => {
        try {
          const url = new URL(value);
          return (
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash &&
            url.pathname === '/' &&
            (url.protocol === 'https:' ||
              (url.protocol === 'http:' &&
                ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
          );
        } catch {
          return false;
        }
      }, '使用 HTTPS 根地址；本机测试允许 HTTP 回环地址')
      .transform((value) => new URL(value).origin),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  })
  .strict();

export async function readInstanceSettings(db: Database) {
  const result = await db.query('SELECT public_origin,log_level FROM instance_settings WHERE id=1');
  return {
    publicOrigin: (result.rows[0]?.public_origin ?? null) as string | null,
    logLevel: (result.rows[0]?.log_level ?? 'info') as 'debug' | 'info' | 'warn' | 'error',
  };
}

type WriteContext = { key: string; cached: { response: unknown; status_code: number } | null };
type InstanceOptions = {
  db: Database;
  setupToken?: string;
  environmentOrigin?: string;
  sessionKey: string;
  databaseUrl?: string;
  managedSecrets: boolean;
  logs: RuntimeLogs;
  beginWrite: (request: FastifyRequest) => Promise<WriteContext>;
  finishWrite: (
    request: FastifyRequest,
    key: string,
    data: unknown,
    status?: number,
  ) => Promise<void>;
};
function parse<T>(request: FastifyRequest, schema: z.ZodType<T>): T {
  const value = schema.safeParse(request.body);
  if (!value.success)
    throw new BoardError('VALIDATION_ERROR', '请检查填写内容', 422, value.error.flatten());
  return value.data;
}
function webAdmin(request: FastifyRequest) {
  if (!request.auth?.instanceAdmin || request.auth.agent)
    throw new BoardError('FORBIDDEN', '此操作需要实例管理员的网页登录会话', 403);
}
const passwordSchema = z.string().min(12).max(256);
const emailSchema = z
  .string()
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());

export function registerInstanceRoutes(app: FastifyInstance, options: InstanceOptions): void {
  const { db, logs, environmentOrigin } = options;
  const respond = (reply: FastifyReply, data: unknown, status = 200) => {
    reply.header('Cache-Control', 'no-store').status(status);
    return { data };
  };
  const checkPassword = async (request: FastifyRequest, password: string) => {
    const user = await db.query(
      'SELECT password_hash FROM users WHERE id=$1 AND archived_at IS NULL',
      [request.auth!.id],
    );
    if (!user.rowCount || !(await verify(user.rows[0].password_hash, password)))
      throw new BoardError('INVALID_CREDENTIALS', '当前管理员密码不正确', 403);
  };
  const database = () => {
    const url = options.databaseUrl ? new URL(options.databaseUrl) : null;
    return {
      host: url?.hostname ?? '未提供',
      port: Number(url?.port || 5432),
      name: url?.pathname.slice(1) ?? '未提供',
      user: url ? decodeURIComponent(url.username) : '未提供',
      passwordConfigured: Boolean(url?.password),
      managed: options.managedSecrets,
    };
  };
  app.get('/api/v1/setup', async (_request, reply) => {
    const existing = await db.query('SELECT 1 FROM users WHERE instance_admin=true LIMIT 1');
    return respond(reply, {
      required: Boolean(options.setupToken) && !existing.rowCount,
      initialized: Boolean(existing.rowCount),
    });
  });
  app.post(
    '/api/v1/setup',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const input = parse(
        request,
        z
          .object({
            token: z.string().min(1).max(256),
            name: z.string().trim().min(1).max(80),
            email: emailSchema,
            password: passwordSchema,
            publicOrigin: instanceSettingsSchema.shape.publicOrigin,
          })
          .strict(),
      );
      const supplied = Buffer.from(input.token);
      const expected = Buffer.from(options.setupToken ?? '');
      if (
        !expected.length ||
        supplied.length !== expected.length ||
        !timingSafeEqual(supplied, expected)
      )
        throw new BoardError('SETUP_TOKEN_INVALID', '初始化口令不正确，请查看容器启动日志', 403);
      if (environmentOrigin && input.publicOrigin !== environmentOrigin)
        throw new BoardError('ORIGIN_CONFIGURED', '访问地址由 PUBLIC_ORIGIN 环境变量固定', 422);
      const passwordHash = await hash(input.password, { algorithm: Algorithm.Argon2id });
      // Shared with CLI bootstrap: two initialization requests cannot create two owners.
      await db.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      if ((await db.query('SELECT 1 FROM users WHERE instance_admin=true LIMIT 1')).rowCount)
        throw new BoardError('ALREADY_INITIALIZED', '实例已经初始化，请使用管理员账号登录', 409);
      const userId = randomUUID();
      await db.query(
        'INSERT INTO users(id,email,name,password_hash,instance_admin) VALUES ($1,$2,$3,$4,true)',
        [userId, input.email, input.name, passwordHash],
      );
      await db.query(
        "INSERT INTO instance_settings(id,public_origin,log_level) VALUES (1,$1,'info') ON CONFLICT(id) DO UPDATE SET public_origin=excluded.public_origin",
        [input.publicOrigin],
      );
      afterCommit(() => app.log.info('Instance initialized through browser setup'));
      return respond(reply, { initialized: true }, 201);
    },
  );
  app.get('/api/v1/admin/instance', async (request, reply) => {
    webAdmin(request);
    const settings = await readInstanceSettings(db);
    await db.query('SELECT 1');
    return respond(reply, {
      ...settings,
      publicOrigin: environmentOrigin ?? settings.publicOrigin,
      originLocked: Boolean(environmentOrigin),
      database: { ...database(), status: 'ok' },
      sessionKeyConfigured: Boolean(options.sessionKey),
      uptimeSeconds: Math.floor(process.uptime()),
      version: serverPackage.version,
    });
  });
  app.patch('/api/v1/admin/instance', async (request, reply) => {
    webAdmin(request);
    const write = await options.beginWrite(request);
    if (write.cached) return respond(reply, write.cached.response, write.cached.status_code);
    const input = parse(request, instanceSettingsSchema);
    if (environmentOrigin && input.publicOrigin !== environmentOrigin)
      throw new BoardError('ORIGIN_CONFIGURED', '访问地址由 PUBLIC_ORIGIN 环境变量固定', 422);
    await db.query(
      'INSERT INTO instance_settings(id,public_origin,log_level) VALUES(1,$1,$2) ON CONFLICT(id) DO UPDATE SET public_origin=excluded.public_origin,log_level=excluded.log_level',
      [input.publicOrigin, input.logLevel],
    );
    await options.finishWrite(request, write.key, input);
    afterCommit(() => {
      app.log.level = input.logLevel;
      app.log.info('Instance settings updated');
    });
    return respond(reply, input);
  });
  app.patch('/api/v1/admin/account', async (request, reply) => {
    webAdmin(request);
    const write = await options.beginWrite(request);
    if (write.cached) return respond(reply, write.cached.response, write.cached.status_code);
    const input = parse(
      request,
      z
        .object({
          name: z.string().trim().min(1).max(80),
          email: emailSchema,
          currentPassword: passwordSchema,
          newPassword: passwordSchema.optional(),
        })
        .strict(),
    );
    await checkPassword(request, input.currentPassword);
    if (input.newPassword) {
      await db.query('UPDATE users SET password_hash=$1 WHERE id=$2', [
        await hash(input.newPassword, { algorithm: Algorithm.Argon2id }),
        request.auth!.id,
      ]);
      await db.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND id<>$2', [
        request.auth!.id,
        request.auth!.sessionId,
      ]);
      await db.query(
        'UPDATE devices SET revoked_at=now() WHERE user_id=$1 AND token_hash IS NOT NULL',
        [request.auth!.id],
      );
    }
    await db.query('UPDATE users SET name=$1,email=$2 WHERE id=$3', [
      input.name,
      input.email,
      request.auth!.id,
    ]);
    const data = { name: input.name, email: input.email };
    await options.finishWrite(request, write.key, data);
    afterCommit(() => app.log.info('Instance administrator account updated'));
    return respond(reply, data);
  });
  app.get('/api/v1/admin/logs', async (request, reply) => {
    webAdmin(request);
    return respond(reply, { entries: logs.recent(), scope: 'current-process', capacity: 1000 });
  });
  app.post(
    '/api/v1/admin/secrets/reveal',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      webAdmin(request);
      const input = parse(request, z.object({ currentPassword: passwordSchema }).strict());
      await checkPassword(request, input.currentPassword);
      const url = options.databaseUrl ? new URL(options.databaseUrl) : null;
      // Never put plaintext secrets in the idempotency table or audit log.
      return respond(reply, {
        databasePassword: url ? decodeURIComponent(url.password) : null,
        sessionKey: options.sessionKey,
      });
    },
  );
}
