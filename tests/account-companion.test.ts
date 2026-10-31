import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { createCompanion } from '../apps/companion/src/main.ts';
import { SecretStore } from '../apps/companion/src/secret.ts';

describe('account browser companion boundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it('forwards bounded binary avatars with browser cookies, denies CLI account APIs, and never serves private data from offline cache', async () => {
    const userId = '10000000-0000-4000-8000-000000000001';
    let cliKey = '';
    let offline = false;
    let wrongType = false;
    let oversized = false;
    const calls: Request[] = [];
    vi.spyOn(SecretStore.prototype, 'read').mockResolvedValue(undefined);
    vi.spyOn(SecretStore.prototype, 'write').mockImplementation(async (value) => {
      if (!cliKey) cliKey = value;
    });
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      calls.push(request);
      if (offline) throw new TypeError('synthetic offline');
      if (request.url.endsWith('/auth/login')) {
        const body = await request.json();
        return new Response(
          JSON.stringify({
            data: {
              user: { id: userId },
              ...(body.tokenKind === 'agent' ? { deviceToken: 'synthetic-agent' } : {}),
            },
          }),
          {
            headers: {
              'content-type': 'application/json',
              'set-cookie': 'tb_session=synthetic-browser-cookie; Path=/; HttpOnly',
            },
          },
        );
      }
      if (request.url.endsWith('/me/avatar')) {
        expect((await request.arrayBuffer()).byteLength).toBe(1500000);
        return Response.json({ data: { saved: true } });
      }
      if (request.url.endsWith('/avatar'))
        return new Response(
          oversized ? new Uint8Array(2097153) : new Uint8Array([82, 73, 70, 70]),
          { headers: { 'content-type': wrongType ? 'text/html' : 'image/webp' } },
        );
      return Response.json({
        data: {
          name: 'synthetic user',
          contacts: { phone: { value: 'private-phone', visibility: 'private' } },
        },
      });
    });
    const dataDirectory = await mkdtemp(join(tmpdir(), 'taskboard-account-proxy-'));
    const target = resolve(dataDirectory);
    if (
      dirname(target) !== resolve(tmpdir()) ||
      !basename(target).startsWith('taskboard-account-proxy-')
    )
      throw new Error('Unsafe test cleanup');
    const runtime = await createCompanion({
      dataDirectory,
      upstream: 'https://board.example.test',
      port: 0,
    });
    try {
      const headers = {
        'x-taskboard-companion-key': runtime.clientKey,
        'x-taskboard-account-id': userId,
        'x-taskboard-account-origin': 'https://board.example.test',
      };
      expect(
        (
          await runtime.app.inject({
            method: 'POST',
            url: '/v1/browser/login',
            headers,
            payload: {
              email: 'synthetic@example.test',
              password: 'synthetic-long-password',
              deviceName: 'test',
            },
          })
        ).statusCode,
      ).toBe(200);
      const profile = await runtime.app.inject({ url: '/api/v1/me/profile', headers });
      expect(profile.statusCode).toBe(200);
      expect(profile.headers['cache-control']).toBe('no-store');
      const upload = await runtime.app.inject({
        method: 'POST',
        url: '/api/v1/me/avatar',
        headers: {
          ...headers,
          'content-type': 'image/webp',
          'if-match': '1',
          'idempotency-key': 'synthetic-avatar-upload',
        },
        payload: Buffer.alloc(1500000),
      });
      expect(upload.statusCode).toBe(200);
      expect(calls.at(-1)?.headers.get('cookie')).toBe('tb_session=synthetic-browser-cookie');
      expect(calls.at(-1)?.headers.has('authorization')).toBe(false);
      const picture = await runtime.app.inject({ url: `/api/v1/users/${userId}/avatar`, headers });
      expect(picture.statusCode).toBe(200);
      expect(picture.rawPayload).toEqual(Buffer.from([82, 73, 70, 70]));
      expect(picture.headers['cache-control']).toBe('no-store');
      wrongType = true;
      expect(
        (await runtime.app.inject({ url: `/api/v1/users/${userId}/avatar`, headers })).statusCode,
      ).toBe(502);
      wrongType = false;
      oversized = true;
      expect(
        (await runtime.app.inject({ url: `/api/v1/users/${userId}/avatar`, headers })).statusCode,
      ).toBe(413);
      oversized = false;
      const before = calls.length;
      expect(
        (
          await runtime.app.inject({
            method: 'PATCH',
            url: '/api/v1/me/profile',
            headers: {
              ...headers,
              'x-taskboard-account-origin': 'https://old-server.example.test',
            },
            payload: { name: 'stale editor' },
          })
        ).statusCode,
      ).toBe(409);
      expect(calls).toHaveLength(before);
      expect(
        (
          await runtime.app.inject({
            url: '/v1/api/me/profile',
            headers: { 'x-taskboard-companion-key': cliKey },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await runtime.app.inject({
            url: `/v1/api/users/${userId}/avatar`,
            headers: { 'x-taskboard-companion-key': cliKey },
          })
        ).statusCode,
      ).toBe(403);
      expect(calls).toHaveLength(before);
      offline = true;
      const cached = await runtime.app.inject({ url: '/api/v1/me/profile', headers });
      expect(cached.statusCode).toBe(503);
      expect(cached.body).not.toContain('private-phone');
    } finally {
      await runtime.stop();
      await rm(target, { recursive: true, force: true });
    }
  });
});
