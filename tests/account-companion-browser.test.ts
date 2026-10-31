import { expect, it } from 'vitest';
import { chromium } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createCompanion } from '../apps/companion/src/main.ts';

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing fixture address');
  return `http://127.0.0.1:${address.port}`;
}
const close = (server: Server) =>
  new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );

it(
  'allows real browser profile and avatar preflights while rejecting unknown headers and untrusted origins',
  { timeout: 60000 },
  async () => {
    const userId = '10000000-0000-4000-8000-000000000001';
    let forwarded = 0;
    const upstream = createServer(async (request, response) => {
      forwarded++;
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      response.setHeader('content-type', 'application/json');
      if (request.url === '/api/v1/auth/login') {
        response.setHeader('set-cookie', 'tb_session=synthetic-browser-cookie; Path=/; HttpOnly');
        response.end(JSON.stringify({ data: { user: { id: userId } } }));
      } else if (!request.headers.cookie?.includes('tb_session=synthetic-browser-cookie')) {
        response.writeHead(401).end();
      } else if (request.method === 'POST') {
        response.end(JSON.stringify({ data: { saved: Buffer.concat(chunks).length === 4 } }));
      } else if (request.url?.endsWith('/avatar')) {
        response.setHeader('content-type', 'image/webp');
        response.end(Buffer.from([82, 73, 70, 70]));
      } else {
        response.end(JSON.stringify({ data: { name: 'Synthetic profile', saved: true } }));
      }
    });
    const frontend = createServer((_request, response) => {
      response.setHeader('content-type', 'text/html');
      response.end('<!doctype html><title>Independent CORS fixture</title>');
    });
    const upstreamOrigin = await listen(upstream);
    const frontendOrigin = await listen(frontend);
    const directory = await mkdtemp(join(tmpdir(), 'taskboard-account-cors-'));
    if (
      dirname(resolve(directory)) !== resolve(tmpdir()) ||
      !basename(directory).startsWith('taskboard-account-cors-')
    )
      throw new Error('Unsafe test directory');
    const runtime = await createCompanion({
      upstream: upstreamOrigin,
      dataDirectory: directory,
      port: 0,
      allowedOrigins: new Set([frontendOrigin]),
    });
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(frontendOrigin);
      const result = await page.evaluate(
        async ({ origin, key, userId, upstreamOrigin }) => {
          const headers = { 'x-taskboard-companion-key': key };
          const login = await fetch(`${origin}/v1/browser/login`, {
            method: 'POST',
            headers: { ...headers, 'content-type': 'application/json' },
            body: JSON.stringify({
              email: 'synthetic@example.test',
              password: 'synthetic-test-password',
              deviceName: 'CORS fixture',
            }),
          });
          if (!login.ok) throw new Error('Synthetic login failed');
          const guarded = {
            ...headers,
            'x-taskboard-account-id': userId,
            'x-taskboard-account-origin': upstreamOrigin,
          };
          const profile = await fetch(`${origin}/api/v1/me/profile`, { headers: guarded });
          const saved = await fetch(`${origin}/api/v1/me/profile`, {
            method: 'PATCH',
            headers: {
              ...guarded,
              'content-type': 'application/json',
              'if-match': '1',
              'idempotency-key': crypto.randomUUID(),
            },
            body: JSON.stringify({ name: 'Changed synthetic profile' }),
          });
          const avatar = await fetch(`${origin}/api/v1/users/${userId}/avatar`, {
            headers: guarded,
          });
          const upload = await fetch(`${origin}/api/v1/me/avatar`, {
            method: 'POST',
            headers: {
              ...guarded,
              'content-type': 'image/webp',
              'if-match': '2',
              'idempotency-key': crypto.randomUUID(),
            },
            body: new Uint8Array([82, 73, 70, 70]),
          });
          let unknownHeaderRejected = false;
          try {
            await fetch(`${origin}/api/v1/me/profile`, {
              headers: { ...guarded, 'x-untrusted-test-header': 'reject' },
            });
          } catch {
            unknownHeaderRejected = true;
          }
          return {
            profile: await profile.json(),
            profileStatus: profile.status,
            privateCache: profile.headers.get('cache-control'),
            savedStatus: saved.status,
            avatarStatus: avatar.status,
            avatarBytes: (await avatar.arrayBuffer()).byteLength,
            upload: await upload.json(),
            uploadStatus: upload.status,
            unknownHeaderRejected,
          };
        },
        {
          origin: `http://127.0.0.1:${runtime.port}`,
          key: runtime.clientKey,
          userId,
          upstreamOrigin,
        },
      );
      expect(result).toMatchObject({
        profile: { data: { name: 'Synthetic profile' } },
        profileStatus: 200,
        privateCache: 'no-store',
        savedStatus: 200,
        avatarStatus: 200,
        avatarBytes: 4,
        upload: { data: { saved: true } },
        uploadStatus: 200,
        unknownHeaderRejected: true,
      });
      expect(forwarded).toBe(5);
      await page.goto(frontendOrigin.replace('127.0.0.1', 'localhost'));
      expect(
        await page.evaluate(
          async ({ origin, key }) => {
            try {
              await fetch(`${origin}/api/v1/me/profile`, {
                headers: { 'x-taskboard-companion-key': key },
              });
              return false;
            } catch {
              return true;
            }
          },
          { origin: `http://127.0.0.1:${runtime.port}`, key: runtime.clientKey },
        ),
      ).toBe(true);
      expect(forwarded).toBe(5);
    } finally {
      await browser.close();
      await runtime.stop();
      await close(frontend);
      await close(upstream);
      await rm(directory, { recursive: true, force: true });
    }
  },
);
