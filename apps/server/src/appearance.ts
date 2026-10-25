import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  appearanceSchema,
  BoardError,
  builtinThemeIds,
  canonicalTheme,
  defaultAppearance,
  parseThemeFile,
  type AppearanceRecord,
} from '@taskboard/core';
import type { Database } from './db.ts';

export function registerAppearanceRoutes(
  app: FastifyInstance,
  options: {
    db: Database;
    stored: (
      r: FastifyRequest,
    ) => Promise<{ key: string; cached: { response: unknown; status_code: number } | null }>;
    saveIdempotency: (r: FastifyRequest, key: string, data: unknown) => Promise<void>;
  },
) {
  const { db, stored, saveIdempotency } = options;
  const account = (r: FastifyRequest) => {
    if (r.auth!.agent) throw new BoardError('AGENT_SCOPE_FORBIDDEN', '主题设置仅供用户使用', 403);
    return r.auth!.id;
  };
  const read = async (userId: string): Promise<AppearanceRecord> => {
    const row = (await db.query('SELECT * FROM user_appearance WHERE user_id=$1', [userId]))
      .rows[0];
    return row ? { ...row.preferences, version: row.version } : { ...defaultAppearance };
  };
  const lock = async (userId: string) => {
    // Shares the lock across uploads, selection and deletion; a selected package cannot disappear.
    await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
  };
  app.get('/api/v1/me/appearance', async (r) => ({ data: await read(account(r)) }));
  app.get('/api/v1/me/themes', async (r) => ({
    data: (
      await db.query('SELECT id,manifest FROM user_themes WHERE user_id=$1 ORDER BY id', [
        account(r),
      ])
    ).rows,
  }));
  app.put('/api/v1/me/appearance', async (r) => {
    const userId = account(r);
    const input = appearanceSchema.parse(r.body);
    const c = await stored(r);
    if (c.cached) return { data: c.cached.response };
    await lock(userId);
    const current = await read(userId);
    if (!r.headers['if-match'])
      throw new BoardError('VERSION_REQUIRED', '保存外观必须携带 If-Match 版本', 428);
    if (r.headers['if-match'] !== String(current.version))
      throw new BoardError(
        'VERSION_CONFLICT',
        '其他设备已更新外观，请选择使用云端或保留本次选择',
        409,
        current,
      );
    if (
      !(builtinThemeIds as readonly string[]).includes(input.themeId) &&
      !(
        await db.query('SELECT 1 FROM user_themes WHERE user_id=$1 AND id=$2', [
          userId,
          input.themeId,
        ])
      ).rowCount
    )
      throw new BoardError('THEME_NOT_FOUND', '请先上传主题包', 422);
    const next = { ...input, version: current.version + 1 };
    await db.query(
      `INSERT INTO user_appearance(user_id,preferences,version) VALUES ($1,$2,$3)
      ON CONFLICT(user_id) DO UPDATE SET preferences=$2,version=$3`,
      [userId, input, next.version],
    );
    await saveIdempotency(r, c.key, next);
    return { data: next };
  });
  app.post('/api/v1/me/themes', { bodyLimit: 65536 }, async (r) => {
    const userId = account(r);
    const manifest = parseThemeFile(JSON.stringify(r.body));
    const canonical = canonicalTheme(manifest);
    const id = createHash('sha256').update(canonical).digest('hex');
    const c = await stored(r);
    if (c.cached) return { data: c.cached.response };
    await lock(userId);
    const exists = await db.query('SELECT 1 FROM user_themes WHERE user_id=$1 AND id=$2', [
      userId,
      id,
    ]);
    if (
      !exists.rowCount &&
      Number(
        (await db.query('SELECT count(*) FROM user_themes WHERE user_id=$1', [userId])).rows[0]
          .count,
      ) >= 100
    )
      throw new BoardError('THEME_LIMIT', '最多保存 100 套自定义主题，请先移除不用的主题', 422);
    await db.query(
      'INSERT INTO user_themes(user_id,id,manifest) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [userId, id, manifest],
    );
    const data = { id, manifest };
    await saveIdempotency(r, c.key, data);
    return { data };
  });
  app.delete('/api/v1/me/themes/:id', async (r) => {
    const userId = account(r);
    const id = (r.params as { id: string }).id;
    const c = await stored(r);
    if (c.cached) return { data: c.cached.response };
    await lock(userId);
    const current = await read(userId);
    if (current.themeId === id) {
      const preferences = { themeId: 'glass', mode: current.mode, layout: current.layout };
      await db.query(
        'UPDATE user_appearance SET preferences=$2,version=version+1 WHERE user_id=$1',
        [userId, preferences],
      );
    }
    await db.query('DELETE FROM user_themes WHERE user_id=$1 AND id=$2', [userId, id]);
    const data = await read(userId);
    await saveIdempotency(r, c.key, data);
    return { data };
  });
}
