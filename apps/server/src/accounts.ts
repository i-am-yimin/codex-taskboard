import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { hash, verify, Algorithm } from '@node-rs/argon2';
import sharp from 'sharp';
import { z } from 'zod';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  BoardError,
  MAX_AVATAR_BYTES,
  profileInputSchema,
  accountEmailSchema,
  accountPasswordSchema,
  smtpInputSchema,
  type AccountProfile,
} from '@taskboard/core';
import type { Database } from './db.ts';
import { audit, activeTakeover } from './account-access.ts';
import { createAccountMail, type MailOptions } from './account-mail.ts';

type Write = { key: string; cached: { response: unknown; status_code: number } | null };
type Options = {
  db: Database;
  stored: (r: FastifyRequest) => Promise<Write>;
  saveIdempotency: (
    r: FastifyRequest,
    key: string,
    data: unknown,
    status?: number,
  ) => Promise<void>;
  origin: () => Promise<string | null | undefined>;
  changed: (userId: string) => void;
  recheck: () => void;
  mail?: MailOptions;
};
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('base64url');
const parse = <T>(r: FastifyRequest, schema: z.ZodType<T>) => schema.parse(r.body);
const human = (r: FastifyRequest) => {
  if (!r.auth || r.auth.agent || !r.auth.sessionId)
    throw new BoardError('FORBIDDEN', '此操作需要用户网页登录会话', 403);
  return r.auth;
};
const admin = (r: FastifyRequest) => {
  const auth = human(r);
  if (!auth.instanceAdmin) throw new BoardError('FORBIDDEN', '此操作需要服务器最高管理员权限', 403);
  return auth;
};
const profileRow = (row: Record<string, unknown>): AccountProfile => ({
  id: String(row.id),
  name: String(row.name),
  email: String(row.email),
  emailVerified: Boolean(row.email_verified_at),
  avatarVersion: Number(row.avatar_version),
  hasAvatar: Boolean(row.has_avatar),
  version: Number(row.profile_version),
  contacts: profileInputSchema.shape.contacts.parse(row.contacts),
});

export function registerAccountRoutes(app: FastifyInstance, options: Options) {
  const { db, stored, saveIdempotency } = options;
  const mail = createAccountMail(db, options.mail);
  app.decorate('runAccountMail', mail.run);
  let timer: ReturnType<typeof setInterval> | undefined;
  app.addHook('onReady', async () => {
    if (mail.enabled) {
      timer = setInterval(
        () => void mail.run().catch(() => app.log.error('Account mail worker failed')),
        10000,
      );
      timer.unref();
    }
  });
  app.addHook('onClose', async () => {
    clearInterval(timer);
    await mail.settled();
  });
  const replyData = (p: FastifyReply, data: unknown, status = 200) => {
    p.header('cache-control', 'no-store').code(status);
    return { data };
  };
  const checkPassword = async (r: FastifyRequest, password: string) => {
    human(r);
    const user = await db.query(
      'SELECT password_hash FROM users WHERE id=$1 AND archived_at IS NULL',
      [r.auth!.id],
    );
    if (!user.rowCount || !(await verify(user.rows[0].password_hash, password)))
      throw new BoardError('INVALID_CREDENTIALS', '当前密码不正确', 403);
  };
  const readProfile = async (userId: string) => {
    const result = await db.query(
      'SELECT u.*,EXISTS(SELECT 1 FROM user_avatars a WHERE a.user_id=u.id) has_avatar FROM users u WHERE u.id=$1 AND u.archived_at IS NULL',
      [userId],
    );
    if (!result.rowCount) throw new BoardError('NOT_FOUND', '用户不存在', 404);
    return profileRow(result.rows[0]);
  };
  const version = async (r: FastifyRequest) => {
    const row = (
      await db.query('SELECT profile_version FROM users WHERE id=$1 FOR UPDATE', [human(r).id])
    ).rows[0];
    if (!r.headers['if-match']) throw new BoardError('VERSION_REQUIRED', '保存资料需要版本号', 428);
    if (r.headers['if-match'] !== String(row.profile_version))
      throw new BoardError('VERSION_CONFLICT', '资料已被其他设备修改，请重新读取后保存', 409);
  };
  const finish = async (r: FastifyRequest, p: FastifyReply, write: Write, data: unknown) => {
    await saveIdempotency(r, write.key, data);
    return replyData(p, data);
  };
  const securityPassword = z.object({ currentPassword: accountPasswordSchema }).strict();
  const invalidate = async (userId: string, currentSession?: string) => {
    await db.query(
      'UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND ($2::uuid IS NULL OR id<>$2)',
      [userId, currentSession ?? null],
    );
    await db.query(
      'UPDATE devices SET revoked_at=now() WHERE user_id=$1 AND token_hash IS NOT NULL',
      [userId],
    );
    await db.query('UPDATE space_takeovers SET revoked_at=now() WHERE user_id=$1', [userId]);
    options.recheck();
  };
  const link = async (kind: string, value: string) => {
    const origin = await options.origin();
    if (!origin) throw new BoardError('PUBLIC_ORIGIN_REQUIRED', '请先配置服务器对外访问地址', 503);
    return `${origin}/#${kind}=${encodeURIComponent(value)}`;
  };
  const limitMail = async (userId: string) => {
    // Serialize per-account issuance across sessions and worker instances.
    await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
    const count = await db.query(
      "SELECT (SELECT count(*) FROM account_verifications WHERE user_id=$1 AND created_at>now()-interval '1 hour')+(SELECT count(*) FROM recovery_links WHERE user_id=$1 AND created_at>now()-interval '1 hour') total",
      [userId],
    );
    if (Number(count.rows[0].total) >= 5)
      throw new BoardError('RATE_LIMITED', '邮件申请过于频繁，请稍后重试', 429);
  };
  app.get('/api/v1/me/profile', async (r, p) => replyData(p, await readProfile(human(r).id)));
  app.patch('/api/v1/me/profile', async (r, p) => {
    const auth = human(r);
    const input = parse(r, profileInputSchema);
    const write = await stored(r);
    if (write.cached) return replyData(p, write.cached.response);
    await version(r);
    await db.query(
      'UPDATE users SET name=$2,contacts=$3,profile_version=profile_version+1 WHERE id=$1',
      [auth.id, input.name, input.contacts],
    );
    options.changed(auth.id);
    // Private contacts deliberately never enter generic idempotency response storage.
    return finish(r, p, write, { saved: true, version: (await readProfile(auth.id)).version });
  });
  app.addContentTypeParser(
    ['image/jpeg', 'image/png', 'image/webp'],
    { parseAs: 'buffer', bodyLimit: MAX_AVATAR_BYTES },
    (_r, body, done) => done(null, body),
  );
  app.post('/api/v1/me/avatar', { bodyLimit: MAX_AVATAR_BYTES }, async (r, p) => {
    const auth = human(r);
    const write = await stored(r);
    if (write.cached) return replyData(p, write.cached.response);
    await version(r);
    if (!Buffer.isBuffer(r.body))
      throw new BoardError('INVALID_AVATAR', '请选择 JPG、PNG 或 WebP 图片', 422);
    let image: Buffer;
    try {
      const imageBytes = r.body;
      const isPng = imageBytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const isJpeg = imageBytes[0] === 255 && imageBytes[1] === 216 && imageBytes[2] === 255;
      const isWebp =
        imageBytes.toString('ascii', 0, 4) === 'RIFF' &&
        imageBytes.toString('ascii', 8, 12) === 'WEBP';
      if (!isPng && !isJpeg && !isWebp) throw new Error('Unsupported avatar signature');
      const decoder = sharp(r.body, { limitInputPixels: 16000000, failOn: 'warning' });
      const metadata = await decoder.metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1)
        throw new Error('Unsupported avatar');
      image = await decoder
        .rotate()
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 80 })
        .toBuffer();
      if (image.length > 131072) throw new Error('Avatar too large');
    } catch {
      throw new BoardError(
        'INVALID_AVATAR',
        '图片无法读取，请使用不超过 1600 万像素的静态 JPG、PNG 或 WebP',
        422,
      );
    }
    await db.query(
      'INSERT INTO user_avatars(user_id,image) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET image=$2',
      [auth.id, image],
    );
    await db.query(
      'UPDATE users SET avatar_version=avatar_version+1,profile_version=profile_version+1 WHERE id=$1',
      [auth.id],
    );
    options.changed(auth.id);
    return finish(r, p, write, { saved: true });
  });
  app.delete('/api/v1/me/avatar', async (r, p) => {
    const auth = human(r);
    const write = await stored(r);
    if (write.cached) return replyData(p, write.cached.response);
    await version(r);
    await db.query('DELETE FROM user_avatars WHERE user_id=$1', [auth.id]);
    await db.query(
      'UPDATE users SET avatar_version=avatar_version+1,profile_version=profile_version+1 WHERE id=$1',
      [auth.id],
    );
    options.changed(auth.id);
    return finish(r, p, write, { removed: true });
  });
  const visibleUser = async (r: FastifyRequest) => {
    const auth = human(r);
    const { userId } = z.object({ userId: z.uuid() }).parse(r.params);
    if (
      userId !== auth.id &&
      !(
        await db.query(
          'SELECT 1 FROM space_members a JOIN space_members b ON a.space_id=b.space_id JOIN spaces s ON s.id=a.space_id WHERE a.user_id=$1 AND b.user_id=$2 AND s.archived_at IS NULL LIMIT 1',
          [auth.id, userId],
        )
      ).rowCount
    )
      throw new BoardError('NOT_FOUND', '用户不存在或没有共同空间', 404);
    return userId;
  };
  app.get('/api/v1/users/:userId/profile', async (r, p) => {
    const userId = await visibleUser(r);
    const value = await readProfile(userId);
    return replyData(p, {
      id: value.id,
      name: value.name,
      avatarVersion: value.avatarVersion,
      hasAvatar: value.hasAvatar,
      contacts: Object.fromEntries(
        Object.entries(value.contacts)
          .filter(([, v]) => v.visibility === 'members')
          .map(([k, v]) => [k, v.value]),
      ),
    });
  });
  app.get('/api/v1/users/:userId/avatar', async (r, p) => {
    const userId = await visibleUser(r);
    const found = await db.query('SELECT image FROM user_avatars WHERE user_id=$1', [userId]);
    if (!found.rowCount) throw new BoardError('NOT_FOUND', '用户尚未设置头像', 404);
    return p
      .header('cache-control', 'no-store')
      .header('x-content-type-options', 'nosniff')
      .type('image/webp')
      .send(found.rows[0].image);
  });
  app.post('/api/v1/me/password', async (r, p) => {
    const auth = human(r);
    const input = parse(r, securityPassword.extend({ newPassword: accountPasswordSchema }));
    const write = await stored(r);
    if (write.cached) return replyData(p, write.cached.response);
    await checkPassword(r, input.currentPassword);
    await db.query('UPDATE users SET password_hash=$2 WHERE id=$1', [
      auth.id,
      await hash(input.newPassword, { algorithm: Algorithm.Argon2id }),
    ]);
    await db.query('UPDATE recovery_links SET used_at=now() WHERE user_id=$1 AND used_at IS NULL', [
      auth.id,
    ]);
    await db.query(
      'UPDATE account_verifications SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',
      [auth.id],
    );
    await invalidate(auth.id, auth.sessionId);
    await audit(db, auth.id, 'password.changed', auth.id);
    return finish(r, p, write, { changed: true });
  });
  app.post(
    '/api/v1/me/email/request',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (r, p) => {
      const auth = human(r);
      const input = parse(r, securityPassword.extend({ email: accountEmailSchema.optional() }));
      const write = await stored(r);
      if (write.cached) return replyData(p, write.cached.response);
      await checkPassword(r, input.currentPassword);
      await limitMail(auth.id);
      const email = input.email ?? auth.email;
      const kind = email === auth.email ? 'verify_email' : 'change_email';
      if (
        kind === 'change_email' &&
        (await db.query('SELECT 1 FROM users WHERE email=$1', [email])).rowCount
      )
        throw new BoardError('EMAIL_IN_USE', '此邮箱已被使用', 409);
      const raw = token();
      await db.query(
        'UPDATE account_verifications SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',
        [auth.id],
      );
      await db.query(
        "INSERT INTO account_verifications(id,user_id,kind,email,token_hash,expires_at,session_id) VALUES($1,$2,$3,$4,$5,now()+interval '30 minutes',$6)",
        [randomUUID(), auth.id, kind, email, sha(raw), auth.sessionId],
      );
      const mailId = await mail.enqueue(
        {
          to: email,
          subject: kind === 'change_email' ? '确认新的 Taskboard 邮箱' : '验证 Taskboard 邮箱',
          text: `请在 30 分钟内打开以下链接并确认：\n${await link('verify', raw)}\n如果不是你发起的操作，请忽略。`,
        },
        kind,
        auth.id,
      );
      await audit(db, auth.id, `email.${kind}.requested`, auth.id);
      return finish(r, p, write, { queued: true, mailId });
    },
  );
  app.post('/api/v1/auth/email/complete', async (r, p) => {
    const input = parse(r, z.object({ token: z.string().min(20).max(200) }).strict());
    const found = await db.query(
      'SELECT * FROM account_verifications WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE',
      [sha(input.token)],
    );
    if (!found.rowCount) throw new BoardError('INVALID_VERIFICATION', '验证链接无效或已过期', 400);
    const row = found.rows[0];
    const user = (
      await db.query('SELECT email FROM users WHERE id=$1 AND archived_at IS NULL FOR UPDATE', [
        row.user_id,
      ])
    ).rows[0];
    if (!user) throw new BoardError('INVALID_VERIFICATION', '验证链接无效或已过期', 400);
    if (row.kind === 'verify_email' && user.email !== row.email)
      throw new BoardError('INVALID_VERIFICATION', '邮箱已发生变化，请重新申请验证', 400);
    if (row.kind === 'change_email') {
      await mail.enqueue(
        {
          to: user.email,
          subject: 'Taskboard 登录邮箱已变更',
          text: '你的 Taskboard 登录邮箱刚刚发生变更。如非本人操作，请立即联系服务器管理员。',
        },
        'email_changed_notice',
        row.user_id,
      );
      await invalidate(row.user_id, row.session_id);
    }
    try {
      await db.query(
        'UPDATE users SET email=$2,email_verified_at=now(),profile_version=profile_version+1 WHERE id=$1',
        [row.user_id, row.email],
      );
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505')
        throw new BoardError('EMAIL_IN_USE', '此邮箱已被其他账号使用，请重新申请变更', 409);
      throw error;
    }
    await db.query('UPDATE account_verifications SET used_at=now() WHERE id=$1', [row.id]);
    options.changed(row.user_id);
    await audit(db, row.user_id, 'email.verified', row.user_id);
    return replyData(p, { verified: true, relogin: row.kind === 'change_email' });
  });
  const recovery = async (userId: string, email: string) => {
    await limitMail(userId);
    const raw = token();
    await db.query('UPDATE recovery_links SET used_at=now() WHERE user_id=$1 AND used_at IS NULL', [
      userId,
    ]);
    await db.query(
      "INSERT INTO recovery_links(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')",
      [randomUUID(), userId, sha(raw)],
    );
    return mail.enqueue(
      {
        to: email,
        subject: '重设 Taskboard 密码',
        text: `请在 30 分钟内打开以下链接重设密码：\n${await link('recovery', raw)}\n如果不是你发起的操作，请忽略。`,
      },
      'password_recovery',
      userId,
    );
  };
  app.post(
    '/api/v1/auth/recovery/request',
    { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (r, p) => {
      const input = parse(r, z.object({ email: accountEmailSchema }).strict());
      await mail.ready();
      const user = (
        await db.query('SELECT id,email FROM users WHERE email=$1 AND archived_at IS NULL', [
          input.email,
        ])
      ).rows[0];
      if (user) {
        const count = await db.query(
          "SELECT count(*) FROM recovery_links WHERE user_id=$1 AND created_at>now()-interval '1 hour'",
          [user.id],
        );
        if (Number(count.rows[0].count) < 5) {
          try {
            await recovery(user.id, user.email);
          } catch (error) {
            if (!(error instanceof BoardError) || error.code !== 'RATE_LIMITED') throw error;
          }
        }
      }
      return replyData(p, { requested: true, message: '如果该邮箱存在有效账号，将收到恢复邮件。' });
    },
  );
  app.post('/api/v1/devices/revoke-others', async (r, p) => {
    const auth = human(r);
    const write = await stored(r);
    if (write.cached) return replyData(p, write.cached.response);
    await db.query('UPDATE devices SET revoked_at=now() WHERE user_id=$1 AND id<>$2', [
      auth.id,
      auth.deviceId,
    ]);
    await db.query('UPDATE sessions SET revoked_at=now() WHERE user_id=$1 AND id<>$2', [
      auth.id,
      auth.sessionId,
    ]);
    options.recheck();
    await audit(db, auth.id, 'sessions.revoked_others', auth.id);
    return finish(r, p, write, { revoked: true });
  });
  registerManagement();

  function registerManagement() {
    app.get('/api/v1/admin/users', async (r, p) => {
      admin(r);
      const { search } = z.object({ search: z.string().max(100).default('') }).parse(r.query);
      const found = await db.query(
        `SELECT u.id,u.name,u.email,u.instance_admin,u.archived_at,u.email_verified_at,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'role',m.role)) FROM space_members m JOIN spaces s ON s.id=m.space_id WHERE m.user_id=u.id),'[]') spaces
        FROM users u WHERE u.name ILIKE $1 OR u.email ILIKE $1 ORDER BY u.created_at DESC LIMIT 200`,
        [`%${search}%`],
      );
      return replyData(
        p,
        found.rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          instanceAdmin: row.instance_admin,
          disabled: Boolean(row.archived_at),
          emailVerified: Boolean(row.email_verified_at),
          spaces: row.spaces,
        })),
      );
    });
    app.patch('/api/v1/admin/users/:userId', async (r, p) => {
      const auth = admin(r);
      const { userId } = z.object({ userId: z.uuid() }).parse(r.params);
      const input = parse(
        r,
        securityPassword.extend({
          disabled: z.boolean().optional(),
          instanceAdmin: z.boolean().optional(),
          reason: z.string().trim().min(1).max(500),
        }),
      );
      const write = await stored(r);
      if (write.cached) return replyData(p, write.cached.response);
      await checkPassword(r, input.currentPassword);
      await db.query("SELECT pg_advisory_xact_lock(hashtext('taskboard:account-governance'))");
      const user = (await db.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [userId])).rows[0];
      if (!user) throw new BoardError('NOT_FOUND', '用户不存在', 404);
      if (input.disabled && userId === auth.id)
        throw new BoardError('SELF_DISABLE_FORBIDDEN', '不能停用当前管理员账号', 409);
      if (
        input.disabled &&
        (await db.query("SELECT 1 FROM space_members WHERE user_id=$1 AND role='owner'", [userId]))
          .rowCount
      )
        throw new BoardError('OWNER_TRANSFER_REQUIRED', '请先转移此用户拥有的空间', 409);
      if (
        user.instance_admin &&
        !user.archived_at &&
        (input.disabled || input.instanceAdmin === false) &&
        !(
          await db.query(
            'SELECT 1 FROM users WHERE instance_admin AND archived_at IS NULL AND id<>$1',
            [userId],
          )
        ).rowCount
      )
        throw new BoardError('LAST_ADMIN', '必须保留至少一名有效最高管理员', 409);
      await db.query(
        'UPDATE users SET archived_at=CASE WHEN $2::boolean IS NULL THEN archived_at WHEN $2 THEN now() ELSE NULL END,instance_admin=COALESCE($3,instance_admin) WHERE id=$1',
        [userId, input.disabled ?? null, input.instanceAdmin ?? null],
      );
      if (input.disabled || input.instanceAdmin === false) await invalidate(userId);
      if (input.disabled) {
        await db.query(
          'UPDATE account_verifications SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',
          [userId],
        );
        await db.query(
          'UPDATE recovery_links SET used_at=now() WHERE user_id=$1 AND used_at IS NULL',
          [userId],
        );
      }
      await audit(db, auth.id, 'user.governed', userId, input.reason);
      return finish(r, p, write, { updated: true });
    });
    app.post('/api/v1/admin/users/:userId/recovery', async (r, p) => {
      const auth = admin(r);
      const { userId } = z.object({ userId: z.uuid() }).parse(r.params);
      const input = parse(r, securityPassword);
      const write = await stored(r);
      if (write.cached) return replyData(p, write.cached.response);
      await checkPassword(r, input.currentPassword);
      const user = (
        await db.query('SELECT email FROM users WHERE id=$1 AND archived_at IS NULL', [userId])
      ).rows[0];
      if (!user) throw new BoardError('NOT_FOUND', '用户不存在', 404);
      const mailId = await recovery(userId, user.email);
      await audit(db, auth.id, 'user.recovery_requested', userId);
      return finish(r, p, write, { queued: true, mailId });
    });
    app.get('/api/v1/admin/invitations', async (r, p) => {
      admin(r);
      return replyData(
        p,
        (
          await db.query(
            'SELECT i.id,i.email,i.role,i.space_id,i.expires_at,i.used_at,i.revoked_at,s.name space_name FROM invitations i LEFT JOIN spaces s ON s.id=i.space_id ORDER BY i.created_at DESC LIMIT 200',
          )
        ).rows,
      );
    });
    const invite = async (r: FastifyRequest, p: FastifyReply, resend = false) => {
      const auth = admin(r);
      let email: string;
      let spaceId: string | null;
      let role: string;
      const write = await stored(r);
      if (write.cached) return replyData(p, write.cached.response);
      if (resend) {
        const { invitationId } = z.object({ invitationId: z.uuid() }).parse(r.params);
        const previous = (
          await db.query('SELECT * FROM invitations WHERE id=$1 AND used_at IS NULL FOR UPDATE', [
            invitationId,
          ])
        ).rows[0];
        if (!previous?.email) throw new BoardError('NOT_FOUND', '邀请不存在或已使用', 404);
        email = previous.email;
        spaceId = previous.space_id;
        role = previous.role;
        await db.query('UPDATE invitations SET revoked_at=now() WHERE id=$1', [invitationId]);
      } else {
        const input = parse(
          r,
          z
            .object({
              email: accountEmailSchema,
              spaceId: z.uuid().nullable().default(null),
              role: z.enum(['admin', 'editor', 'viewer']).default('editor'),
            })
            .strict(),
        );
        email = input.email;
        spaceId = input.spaceId;
        role = input.role;
      }
      if (
        spaceId &&
        !(await db.query('SELECT 1 FROM spaces WHERE id=$1 AND archived_at IS NULL', [spaceId]))
          .rowCount
      )
        throw new BoardError('NOT_FOUND', '空间不存在或已归档', 404);
      const raw = token();
      const invitationId = randomUUID();
      await db.query(
        "INSERT INTO invitations(id,token_hash,email,role,space_id,created_by,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '72 hours')",
        [invitationId, sha(raw), email, role, spaceId, auth.id],
      );
      const mailId = await mail.enqueue(
        {
          to: email,
          subject: '邀请你加入 Taskboard',
          text: `请使用受邀邮箱，在 72 小时内打开以下链接加入：\n${await link('invite', raw)}`,
        },
        'invitation',
        null,
      );
      await audit(db, auth.id, resend ? 'invitation.resent' : 'invitation.created', invitationId);
      return finish(r, p, write, { id: invitationId, mailId, queued: true });
    };
    app.post('/api/v1/admin/invitations', async (r, p) => invite(r, p));
    app.post('/api/v1/admin/invitations/:invitationId/resend', async (r, p) => invite(r, p, true));
    app.delete('/api/v1/admin/invitations/:invitationId', async (r, p) => {
      const auth = admin(r);
      const { invitationId } = z.object({ invitationId: z.uuid() }).parse(r.params);
      const write = await stored(r);
      if (write.cached) return replyData(p, write.cached.response);
      const changed = await db.query(
        'UPDATE invitations SET revoked_at=now() WHERE id=$1 AND used_at IS NULL RETURNING id',
        [invitationId],
      );
      if (!changed.rowCount) throw new BoardError('NOT_FOUND', '邀请不存在或已使用', 404);
      await audit(db, auth.id, 'invitation.revoked', invitationId);
      return finish(r, p, write, { revoked: true });
    });
    app.get('/api/v1/admin/smtp', async (r, p) => {
      admin(r);
      return replyData(p, await mail.status());
    });
    app.put('/api/v1/admin/smtp', async (r, p) => {
      const auth = admin(r);
      const input = parse(r, smtpInputSchema.extend({ currentPassword: accountPasswordSchema }));
      const write = await stored(r);
      if (write.cached) return replyData(p, write.cached.response);
      await checkPassword(r, input.currentPassword);
      const { currentPassword, ...settings } = input;
      void currentPassword;
      await mail.save(settings);
      await audit(db, auth.id, 'smtp.updated', 'instance');
      return finish(r, p, write, { saved: true });
    });
    app.post(
      '/api/v1/admin/smtp/test',
      { config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
      async (r, p) => {
        const auth = admin(r);
        const input = parse(r, securityPassword);
        const write = await stored(r);
        if (write.cached) return replyData(p, write.cached.response);
        await checkPassword(r, input.currentPassword);
        const mailId = await mail.enqueue(
          {
            to: auth.email,
            subject: 'Taskboard 测试邮件',
            text: '这是一封由你发起的 Taskboard SMTP 测试邮件。',
          },
          'test',
          auth.id,
        );
        await audit(db, auth.id, 'smtp.test_requested', 'instance');
        return finish(r, p, write, { queued: true, mailId });
      },
    );
    app.get('/api/v1/admin/mail', async (r, p) => {
      admin(r);
      return replyData(
        p,
        (
          await db.query(
            'SELECT id,kind,status,attempts,created_at,accepted_at,last_error FROM mail_outbox ORDER BY created_at DESC LIMIT 100',
          )
        ).rows,
      );
    });
    app.post('/api/v1/admin/mail/:mailId/retry', async (r, p) => {
      const auth = admin(r);
      const { mailId } = z.object({ mailId: z.uuid() }).parse(r.params);
      const write = await stored(r);
      if (write.cached) return replyData(p, write.cached.response);
      const changed = await db.query(
        "UPDATE mail_outbox SET status='pending',attempts=0,next_attempt_at=now() WHERE id=$1 AND status='failed' AND payload_encrypted IS NOT NULL RETURNING id",
        [mailId],
      );
      if (!changed.rowCount) throw new BoardError('NOT_FOUND', '没有可重试的邮件', 404);
      await audit(db, auth.id, 'mail.retried', mailId);
      return finish(r, p, write, { queued: true });
    });
    app.get('/api/v1/admin/audit', async (r, p) => {
      admin(r);
      const { action } = z.object({ action: z.string().max(100).default('') }).parse(r.query);
      return replyData(
        p,
        (
          await db.query(
            'SELECT a.*,u.name actor_name FROM account_audit a LEFT JOIN users u ON u.id=a.actor_id WHERE a.action ILIKE $1 ORDER BY a.created_at DESC,a.id DESC LIMIT 200',
            [`%${action}%`],
          )
        ).rows,
      );
    });
    app.get('/api/v1/admin/spaces', async (r, p) => {
      admin(r);
      const rows = (
        await db.query(
          "SELECT s.id,s.name,s.archived_at,u.name owner_name,u.id owner_id,(SELECT count(*) FROM space_members m WHERE m.space_id=s.id) member_count FROM spaces s LEFT JOIN space_members o ON o.space_id=s.id AND o.role='owner' LEFT JOIN users u ON u.id=o.user_id ORDER BY s.updated_at DESC LIMIT 200",
        )
      ).rows;
      return replyData(p, rows);
    });
    app.post('/api/v1/admin/spaces/:spaceId/takeover', async (r, p) => {
      const auth = admin(r);
      const { spaceId } = z.object({ spaceId: z.uuid() }).parse(r.params);
      const input = parse(
        r,
        securityPassword.extend({ reason: z.string().trim().min(1).max(500) }),
      );
      const write = await stored(r);
      if (write.cached) return replyData(p, write.cached.response);
      await checkPassword(r, input.currentPassword);
      if (!(await db.query('SELECT 1 FROM spaces WHERE id=$1', [spaceId])).rowCount)
        throw new BoardError('NOT_FOUND', '空间不存在', 404);
      await db.query(
        'UPDATE space_takeovers SET revoked_at=now() WHERE session_id=$1 AND space_id=$2 AND revoked_at IS NULL',
        [auth.sessionId, spaceId],
      );
      const grant = (
        await db.query(
          "INSERT INTO space_takeovers(id,space_id,user_id,session_id,reason,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '30 minutes') RETURNING id,expires_at",
          [randomUUID(), spaceId, auth.id, auth.sessionId, input.reason],
        )
      ).rows[0];
      await audit(db, auth.id, 'space.takeover_started', spaceId, input.reason);
      return finish(r, p, write, {
        id: grant.id,
        spaceId,
        expiresAt: grant.expires_at.toISOString(),
      });
    });
    app.delete('/api/v1/admin/spaces/:spaceId/takeover', async (r, p) => {
      const auth = admin(r);
      const { spaceId } = z.object({ spaceId: z.uuid() }).parse(r.params);
      const write = await stored(r);
      if (write.cached) return replyData(p, write.cached.response);
      await db.query(
        'UPDATE space_takeovers SET revoked_at=now() WHERE space_id=$1 AND session_id=$2 AND revoked_at IS NULL',
        [spaceId, auth.sessionId],
      );
      options.recheck();
      await audit(db, auth.id, 'space.takeover_ended', spaceId);
      return finish(r, p, write, { revoked: true });
    });
    app.post('/api/v1/admin/spaces/:spaceId/transfer-owner', async (r, p) => {
      const auth = admin(r);
      const { spaceId } = z.object({ spaceId: z.uuid() }).parse(r.params);
      const input = parse(
        r,
        securityPassword.extend({ userId: z.uuid(), reason: z.string().trim().min(1).max(500) }),
      );
      const write = await stored(r);
      if (write.cached) return replyData(p, write.cached.response);
      await checkPassword(r, input.currentPassword);
      if (!(await activeTakeover(db, spaceId, auth.id)))
        throw new BoardError('TAKEOVER_REQUIRED', '请先显式接管此空间', 403);
      const target = await db.query(
        'SELECT 1 FROM space_members m JOIN users u ON u.id=m.user_id WHERE m.space_id=$1 AND m.user_id=$2 AND u.archived_at IS NULL',
        [spaceId, input.userId],
      );
      if (!target.rowCount)
        throw new BoardError('INVALID_OWNER', '新所有者必须是此空间的有效成员', 422);
      await db.query("UPDATE space_members SET role='admin' WHERE space_id=$1 AND role='owner'", [
        spaceId,
      ]);
      await db.query("UPDATE space_members SET role='owner' WHERE space_id=$1 AND user_id=$2", [
        spaceId,
        input.userId,
      ]);
      await audit(db, auth.id, 'space.owner_transferred', spaceId, input.reason);
      options.recheck();
      return finish(r, p, write, { transferred: true });
    });
  }
  return { checkPassword, mail };
}
