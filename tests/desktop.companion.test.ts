import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanion } from '../apps/companion/src/main.ts';
import { SecretStore } from '../apps/companion/src/secret.ts';

describe('companion loopback boundary', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });
  it('serves the embedded demo URL with its query string', async () => {
    const embeddedWebRoot = await mkdtemp(join(tmpdir(), 'taskboard-embedded-web-'));
    await writeFile(join(embeddedWebRoot, 'index.html'), '<!doctype html><title>Taskboard</title>');
    const runtime = await createCompanion({
      dataDirectory: await mkdtemp(join(tmpdir(), 'taskboard-demo-')),
      embeddedWebRoot,
      port: 0,
    });
    try {
      const embeddedUrl = new URL(runtime.embeddedUrl);
      expect(embeddedUrl.searchParams.get('embedded')).toBe('1');
      const path = embeddedUrl.pathname;
      const demo = await runtime.app.inject({ method: 'GET', url: `${path}?demo=1` });
      expect(demo.statusCode).toBe(200);
      expect(demo.headers['content-type']).toContain('text/html');
    } finally { await runtime.stop(); }
  });
  it('does not enable Codex injection from an environment flag alone', { timeout: 60000 }, async () => {
    vi.stubEnv('TASKBOARD_MANAGED_CODEX', 'true');
    vi.stubEnv('TASKBOARD_CODEX_VERSION', '26.901.5280.0');
    const runtime = await createCompanion({
      dataDirectory: await mkdtemp(join(tmpdir(), 'taskboard-')),
      port: 0,
    });
    try {
      const headers = { 'x-taskboard-companion-key': runtime.clientKey };
      const probe = await runtime.app.inject({ method: 'GET', url: '/v1/codex/probe', headers });
      expect(probe.json().data).toMatchObject({
        embedded: false,
        reason: '桌面适配器未由启动器启用',
      });
      const install = await runtime.app.inject({ method: 'POST', url: '/v1/codex/install', headers });
      expect(install.statusCode).toBe(409);
    } finally {
      await runtime.stop();
    }
  });
  it('requires the local bridge key and rejects untrusted origins', { timeout: 60000 }, async () => {
    const runtime = await createCompanion({
      dataDirectory: await mkdtemp(join(tmpdir(), 'taskboard-')),
      port: 0,
      allowedOrigins: new Set(['http://trusted.test']),
    });
    try {
      await expect(runtime.app.inject({ method: 'GET', url: '/health' })).resolves.toMatchObject({
        statusCode: 401,
      });
      await expect(
        runtime.app.inject({
          method: 'GET',
          url: '/health',
          headers: {
            origin: 'http://untrusted.test',
            'x-taskboard-companion-key': runtime.clientKey,
          },
        }),
      ).resolves.toMatchObject({ statusCode: 403 });
      await expect(
        runtime.app.inject({
          method: 'GET',
          url: '/health',
          headers: {
            origin: 'http://trusted.test',
            'x-taskboard-companion-key': runtime.clientKey,
          },
        }),
      ).resolves.toMatchObject({ statusCode: 200 });
    } finally {
      await runtime.stop();
    }
  });
  it(
    'proxies the UI API without returning its remote device credential',
    { timeout: 90000 },
    async () => {
      const calls: Request[] = [];
      vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init);
        calls.push(request);
        if (request.url.endsWith('/auth/login')) {
          const body = (await request.json()) as { tokenKind?: string };
          return new Response(
            JSON.stringify({
              data: {
                user: { id: '00000000-0000-4000-8000-000000000001' },
                ...(body.tokenKind === 'agent' ? { deviceToken: 'test-agent-token' } : {}),
              },
            }),
            {
              headers: {
                'content-type': 'application/json',
                'set-cookie': 'tb_session=browser-session; Path=/; HttpOnly',
              },
            },
          );
        }
        return new Response(JSON.stringify({ data: [{ id: 'task-from-server' }] }), {
          headers: { 'content-type': 'application/json' },
        });
      });
      const directory = await mkdtemp(join(tmpdir(), 'taskboard-'));
      const runtime = await createCompanion({ dataDirectory: directory, port: 0 });
      try {
        const headers = { 'x-taskboard-companion-key': runtime.clientKey };
        const login = await runtime.app.inject({
          method: 'POST',
          url: '/v1/browser/login',
          headers,
          payload: {
            email: 'agent@example.test',
            password: 'long-enough-secret',
            deviceName: 'test',
          },
        });
        expect(login.statusCode).toBe(200);
        expect(login.json()).not.toHaveProperty('data.deviceToken');
        const proxy = await runtime.app.inject({
          method: 'GET',
          url: '/api/v1/spaces/00000000-0000-4000-8000-000000000001/tasks?query=ship&priority=2',
          headers,
        });
        expect(proxy.json()).toMatchObject({ data: [{ id: 'task-from-server' }] });
        expect(calls.at(-1)?.headers.get('cookie')).toBe('tb_session=browser-session');
        expect(calls.at(-1)?.url).toContain('query=ship&priority=2');
        const cliKey = await new SecretStore(join(directory, 'cli-key.dpapi')).read();
        const denied = await runtime.app.inject({
          method: 'POST',
          url: '/api/v1/tasks/00000000-0000-4000-8000-000000000001/accept',
          headers: { 'x-taskboard-companion-key': cliKey! },
          payload: {},
        });
        expect(denied.statusCode).toBe(403);
        const create = await runtime.app.inject({
          method: 'POST',
          url: '/api/v1/spaces',
          headers,
          payload: { name: 'Browser space' },
        });
        expect(create.statusCode).toBe(200);
        expect(await calls.at(-1)!.json()).toEqual({ name: 'Browser space' });
        const agentLogin = await runtime.app.inject({
          method: 'POST',
          url: '/v1/login',
          headers,
          payload: {
            email: 'agent@example.test',
            password: 'long-enough-secret',
            deviceName: 'test',
          },
        });
        expect(agentLogin.statusCode).toBe(200);
        const agentCredential = new SecretStore(join(directory, 'agent-token.dpapi'));
        const logout = await runtime.app.inject({
          method: 'POST',
          url: '/v1/browser/logout',
          headers,
        });
        expect(logout.statusCode).toBe(200);
        expect(
          calls.some(
            (call) =>
              call.url.endsWith('/auth/logout') &&
              call.headers.get('authorization') === 'Bearer test-agent-token',
          ),
        ).toBe(true);
        expect(await agentCredential.read()).toBeUndefined();
      } finally {
        await runtime.stop();
      }
    },
  );
  it('streams browser events only with the browser capability and aborts upstream after client cleanup', async () => {
    let upstreamSignal: AbortSignal | undefined;
    const nativeFetch = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      if (request.url.startsWith('http://127.0.0.1:') && !request.url.includes(':47830/'))
        return nativeFetch(input, init);
      if (request.url.endsWith('/auth/login'))
        return new Response(
          JSON.stringify({ data: { user: { id: '00000000-0000-4000-8000-000000000001' } } }),
          {
            headers: {
              'content-type': 'application/json',
              'set-cookie': 'tb_session=browser-session; Path=/; HttpOnly',
            },
          },
        );
      if (request.url.endsWith('/me'))
        return new Response(JSON.stringify({ data: { id: 'browser-still-active' } }), {
          headers: { 'content-type': 'application/json' },
        });
      upstreamSignal = init?.signal ?? undefined;
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('event: ready\ndata: {}\n\n'));
          },
        }),
        { headers: { 'content-type': 'text/event-stream' } },
      );
    });
    const directory = await mkdtemp(join(tmpdir(), 'taskboard-'));
    const runtime = await createCompanion({ dataDirectory: directory, port: 0 });
    try {
      const headers = { 'x-taskboard-companion-key': runtime.clientKey };
      await runtime.app.inject({
        method: 'POST',
        url: '/v1/browser/login',
        headers,
        payload: {
          email: 'agent@example.test',
          password: 'long-enough-secret',
          deviceName: 'test',
        },
      });
      const cliKey = await new SecretStore(join(directory, 'cli-key.dpapi')).read();
      // The persisted CLI capability is deliberately different from the renderer capability.
      expect(
        (
          await runtime.app.inject({
            method: 'GET',
            url: '/api/v1/spaces/00000000-0000-4000-8000-000000000010/events',
            headers: { 'x-taskboard-companion-key': cliKey! },
          })
        ).statusCode,
      ).toBe(403);
      expect(
        (
          await runtime.app.inject({
            method: 'GET',
            url: '/v1/api/me',
            headers: { 'x-taskboard-companion-key': cliKey! },
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (await runtime.app.inject({ method: 'GET', url: '/api/v1/me', headers })).statusCode,
      ).toBe(200);
      const localController = new AbortController();
      const stream = await nativeFetch(
        `http://127.0.0.1:${runtime.port}/api/v1/spaces/00000000-0000-4000-8000-000000000010/events`,
        {
          headers: { ...headers, origin: 'http://127.0.0.1:4173' },
          signal: localController.signal,
        },
      );
      expect(stream.status).toBe(200);
      expect(stream.headers.get('content-type')).toContain('text/event-stream');
      expect(stream.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:4173');
      const first = await stream.body!.getReader().read();
      expect(new TextDecoder().decode(first.value)).toContain('event: ready');
      localController.abort();
      await vi.waitFor(() => expect(upstreamSignal?.aborted).toBe(true));
    } finally {
      await runtime.stop();
    }
  });
  it('does not erase a newer browser session when a late request from the prior account is rejected', async () => {
    let loginCount = 0;
    let resolveOldRequest!: (response: Response) => void;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      if (request.url.endsWith('/auth/login')) {
        loginCount += 1;
        const id =
          loginCount === 1
            ? '00000000-0000-4000-8000-000000000001'
            : '00000000-0000-4000-8000-000000000002';
        return new Response(JSON.stringify({ data: { user: { id } } }), {
          headers: {
            'content-type': 'application/json',
            'set-cookie': `tb_session=session-${loginCount}; Path=/; HttpOnly`,
          },
        });
      }
      if (request.url.endsWith('/me') && request.headers.get('cookie') === 'tb_session=session-1')
        return new Promise<Response>((resolve) => {
          resolveOldRequest = resolve;
        });
      return new Response(JSON.stringify({ data: { id: 'new-account' } }), {
        headers: { 'content-type': 'application/json' },
      });
    });
    const runtime = await createCompanion({
      dataDirectory: await mkdtemp(join(tmpdir(), 'taskboard-')),
      port: 0,
    });
    try {
      const headers = { 'x-taskboard-companion-key': runtime.clientKey };
      const login = (email: string) =>
        runtime.app.inject({
          method: 'POST',
          url: '/v1/browser/login',
          headers,
          payload: { email, password: 'long-enough-secret', deviceName: 'test' },
        });
      expect((await login('first@example.test')).statusCode).toBe(200);
      const oldRequest = runtime.app.inject({ method: 'GET', url: '/api/v1/me', headers });
      await new Promise((resolve) => setImmediate(resolve));
      expect((await login('second@example.test')).statusCode).toBe(200);
      resolveOldRequest(
        new Response(
          JSON.stringify({ error: { code: 'AUTH_REQUIRED', message: 'old session revoked' } }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          },
        ),
      );
      expect((await oldRequest).statusCode).toBe(409);
      const current = await runtime.app.inject({ method: 'GET', url: '/api/v1/me', headers });
      expect(current.statusCode).toBe(200);
      expect(current.json()).toMatchObject({ data: { id: 'new-account' } });
    } finally {
      await runtime.stop();
    }
  });
  it('keeps a valid browser session after an ordinary upstream permission denial', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      if (request.url.endsWith('/auth/login'))
        return new Response(
          JSON.stringify({ data: { user: { id: '00000000-0000-4000-8000-000000000001' } } }),
          {
            headers: {
              'content-type': 'application/json',
              'set-cookie': 'tb_session=browser-session; Path=/; HttpOnly',
            },
          },
        );
      calls += 1;
      if (calls === 1)
        return new Response(
          JSON.stringify({ error: { code: 'FORBIDDEN', message: 'read-only member' } }),
          {
            status: 403,
            headers: { 'content-type': 'application/json' },
          },
        );
      return new Response(JSON.stringify({ data: { id: 'still-signed-in' } }), {
        headers: { 'content-type': 'application/json' },
      });
    });
    const runtime = await createCompanion({
      dataDirectory: await mkdtemp(join(tmpdir(), 'taskboard-')),
      port: 0,
    });
    try {
      const headers = { 'x-taskboard-companion-key': runtime.clientKey };
      await runtime.app.inject({
        method: 'POST',
        url: '/v1/browser/login',
        headers,
        payload: {
          email: 'agent@example.test',
          password: 'long-enough-secret',
          deviceName: 'test',
        },
      });
      expect(
        (await runtime.app.inject({ method: 'GET', url: '/api/v1/me', headers })).statusCode,
      ).toBe(403);
      const retry = await runtime.app.inject({ method: 'GET', url: '/api/v1/me', headers });
      expect(retry.statusCode).toBe(200);
      expect(retry.json()).toMatchObject({ data: { id: 'still-signed-in' } });
    } finally {
      await runtime.stop();
    }
  });
  it('does not revoke an agent session when the browser-only stream has no browser credential', async () => {
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      if (request.url.endsWith('/auth/login'))
        return new Response(
          JSON.stringify({
            data: {
              user: { id: '00000000-0000-4000-8000-000000000001' },
              deviceToken: 'agent-token',
            },
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      return new Response(JSON.stringify({ data: { id: 'agent-still-active' } }), {
        headers: { 'content-type': 'application/json' },
      });
    });
    const runtime = await createCompanion({
      dataDirectory: await mkdtemp(join(tmpdir(), 'taskboard-')),
      port: 0,
    });
    try {
      const headers = { 'x-taskboard-companion-key': runtime.clientKey };
      expect(
        (
          await runtime.app.inject({
            method: 'POST',
            url: '/v1/login',
            headers,
            payload: {
              email: 'agent@example.test',
              password: 'long-enough-secret',
              deviceName: 'test',
            },
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (
          await runtime.app.inject({
            method: 'GET',
            url: '/api/v1/spaces/00000000-0000-4000-8000-000000000010/events',
            headers,
          })
        ).statusCode,
      ).toBe(401);
      const agent = await runtime.app.inject({ method: 'GET', url: '/v1/api/me', headers });
      expect(agent.statusCode).toBe(200);
      expect(agent.json()).toMatchObject({ data: { id: 'agent-still-active' } });
    } finally {
      await runtime.stop();
    }
  });
  it('serializes a delayed credential commit before a failed later login and gates account reads', async () => {
    let releaseWrite!: () => void;
    let writingB!: () => void;
    const bWriteStarted = new Promise<void>((resolve) => {
      writingB = resolve;
    });
    const bWriteReleased = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const writes = vi.spyOn(SecretStore.prototype, 'write').mockImplementation(async (value) => {
      if (value === 'b-token') {
        writingB();
        await bWriteReleased;
      }
    });
    vi.spyOn(SecretStore.prototype, 'read').mockResolvedValue(undefined);
    let logins = 0;
    vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      if (request.url.endsWith('/auth/login')) {
        logins += 1;
        if (logins === 1)
          return new Response(
            JSON.stringify({
              data: {
                user: { id: '00000000-0000-4000-8000-00000000000b' },
                deviceToken: 'b-token',
              },
            }),
            { headers: { 'content-type': 'application/json' } },
          );
        return new Response(
          JSON.stringify({ error: { code: 'LOGIN_FAILED', message: 'bad C password' } }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
      expect(request.headers.get('authorization')).toBe('Bearer b-token');
      return new Response(
        JSON.stringify({ data: { id: '00000000-0000-4000-8000-00000000000b' } }),
        {
          headers: { 'content-type': 'application/json' },
        },
      );
    });
    const runtime = await createCompanion({
      dataDirectory: await mkdtemp(join(tmpdir(), 'taskboard-')),
      port: 0,
    });
    try {
      const headers = { 'x-taskboard-companion-key': runtime.clientKey };
      const login = (email: string) =>
        runtime.app.inject({
          method: 'POST',
          url: '/v1/login',
          headers,
          payload: { email, password: 'long-enough-secret', deviceName: 'test' },
        });
      const bLogin = login('b@example.test');
      await bWriteStarted;
      const cLogin = login('c@example.test');
      expect(
        (await runtime.app.inject({ method: 'GET', url: '/v1/api/me', headers })).statusCode,
      ).toBe(409);
      releaseWrite();
      expect((await bLogin).statusCode).toBe(200);
      expect((await cLogin).statusCode).toBe(401);
      const me = await runtime.app.inject({ method: 'GET', url: '/v1/api/me', headers });
      expect(me.statusCode).toBe(200);
      expect(me.json()).toMatchObject({ data: { id: '00000000-0000-4000-8000-00000000000b' } });
      expect(writes).toHaveBeenCalledWith('b-token');
    } finally {
      releaseWrite();
      await runtime.stop();
    }
  });
  it('allows only the renderer capability to request an idempotent graceful shutdown', async () => {
    let releaseDispose!: () => void;
    const disposeGate = new Promise<void>((resolve) => {
      releaseDispose = resolve;
    });
    const adapter = { dispose: vi.fn(() => disposeGate) };
    const directory = await mkdtemp(join(tmpdir(), 'taskboard-'));
    const runtime = await createCompanion({
      dataDirectory: directory,
      port: 0,
      adapter: adapter as never,
    });
    try {
      const cliKey = await new SecretStore(join(directory, 'cli-key.dpapi')).read();
      const url = `http://127.0.0.1:${runtime.port}/internal/shutdown`;
      const denied = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(5_000),
        headers: { 'x-taskboard-companion-key': cliKey! },
      });
      expect(denied.status).toBe(403);
      await denied.text();
      const response = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(5_000),
        headers: { 'x-taskboard-companion-key': runtime.clientKey },
      });
      expect(response.status).toBe(202);
      await response.text();
      await vi.waitFor(() => expect(adapter.dispose).toHaveBeenCalledTimes(1));
      releaseDispose();
      await runtime.stop();
      expect(adapter.dispose).toHaveBeenCalledTimes(1);
      await expect(
        fetch(url, { method: 'POST', signal: AbortSignal.timeout(5_000) }),
      ).rejects.toThrow();
    } finally {
      releaseDispose();
      await runtime.stop();
    }
  });
});
