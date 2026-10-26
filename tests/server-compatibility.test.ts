import { requestLocalRunner } from '../apps/web/src/AgentRunPanel.tsx';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import {
  assessServerCompatibility,
  requiresCollaborationContract,
} from '../packages/core/src/server-contract.ts';
import {
  request,
  checkServerCompatibility,
  resetServerCompatibility,
} from '../apps/web/src/api.ts';
import { CompanionClient } from '../packages/cli/src/main.ts';
import { compatibleServerHealth } from './server-compatibility-fixture.ts';
const envelope = (data: unknown, meta?: unknown) =>
  new Response(JSON.stringify({ data, ...(meta ? { meta } : {}) }), {
    headers: { 'content-type': 'application/json' },
  });
beforeEach(() => {
  resetServerCompatibility();
  vi.stubGlobal('window', {});
});
afterEach(() => {
  resetServerCompatibility();
  vi.unstubAllGlobals();
});
describe('collaboration compatibility contract', () => {
  it('requires an explicitly supported protocol and completed migrations, not a version-shaped string', () => {
    expect(assessServerCompatibility(compatibleServerHealth).status).toBe('compatible');
    for (const value of [
      { status: 'ok', database: 'ok' },
      { ...compatibleServerHealth, apiVersion: 2 },
      { ...compatibleServerHealth, capabilities: { collaborativeWorkflows: 2 } },
      { ...compatibleServerHealth, migrationRequired: true },
      { ...compatibleServerHealth, migrationRequired: undefined },
      { status: 'ok', database: 'ok', serverVersion: '99.0.0' },
    ])
      expect(assessServerCompatibility(value).status).toBe('upgrade_required');
    expect(requiresCollaborationContract('/auth/login', 'POST')).toBe(false);
    expect(requiresCollaborationContract('/tasks/real-id/detail')).toBe(false);
    expect(requiresCollaborationContract('/tasks/real-id/claim', 'POST')).toBe(true);
    expect(requiresCollaborationContract('/me/notifications')).toBe(true);
  });
  it('blocks old-server writes and new reads before sending them while keeping basic reads and auth available', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        calls.push(path);
        return envelope(
          path.endsWith('/health') ? { status: 'ok', database: 'ok' } : { id: 'existing' },
        );
      }),
    );
    await expect(
      request('/tasks/t/claim', { method: 'POST', body: {}, version: 1 }),
    ).rejects.toMatchObject({ code: 'SERVER_UPGRADE_REQUIRED' });
    await expect(request('/me/notifications')).rejects.toMatchObject({
      code: 'SERVER_UPGRADE_REQUIRED',
    });
    await expect(request('/tasks/t/detail')).resolves.toEqual({ id: 'existing' });
    await request('/auth/logout', { method: 'POST' });
    expect(calls.filter((path) => path.endsWith('/health'))).toHaveLength(2);
    expect(calls.some((path) => path.endsWith('/claim'))).toBe(false);
    expect(calls.some((path) => path.endsWith('/me/notifications'))).toBe(false);
  });
  it('rechecks each new write instead of authorizing from an earlier successful probe', async () => {
    let healthy = true;
    const writes: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith('/health'))
          return envelope(healthy ? compatibleServerHealth : { status: 'ok', database: 'ok' });
        if (init?.method === 'POST') writes.push(String(input));
        return envelope({ written: true });
      }),
    );
    await request('/tasks/t/claim', { method: 'POST', body: {}, version: 1 });
    healthy = false;
    await expect(
      request('/tasks/t/submit', { method: 'POST', body: {}, version: 2 }),
    ).rejects.toMatchObject({ code: 'SERVER_UPGRADE_REQUIRED' });
    expect(writes).toHaveLength(1);
  });
  it('distinguishes offline or cached capability from confirmed old capability and preserves a real task 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    await expect(request('/tasks/t/claim', { method: 'POST', body: {} })).rejects.toMatchObject({
      code: 'OFFLINE',
    });
    vi.stubGlobal('window', { __TAURI__: { core: { invoke: async () => 'synthetic-local-key' } } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => envelope(compatibleServerHealth, { source: 'cache', offline: true })),
    );
    await expect(checkServerCompatibility()).rejects.toMatchObject({ code: 'OFFLINE' });
    vi.stubGlobal('window', {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith('/health')
          ? envelope(compatibleServerHealth)
          : new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: '任务不存在' } }), {
              status: 404,
            }),
      ),
    );
    await expect(request('/tasks/missing/runs')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
  it('discards an in-flight compatibility result after account or server reset', async () => {
    let finish: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const checking = checkServerCompatibility();
    resetServerCompatibility();
    finish(envelope(compatibleServerHealth));
    await expect(checking).rejects.toMatchObject({ code: 'SERVER_CHANGED' });
  });
});
describe('taskctl compatibility before shared writes or process start', () => {
  it('refuses old capability without sending mutation/start and preserves local probe/cancel', async () => {
    const calls: string[] = [];
    const client = new CompanionClient({
      key: 'synthetic-local-key',
      fetcher: (async (input: RequestInfo | URL) => {
        const path = new URL(input.toString()).pathname;
        calls.push(path);
        return envelope(
          path === '/v1/api/health' ? { status: 'ok', database: 'ok' } : { local: true },
        );
      }) as typeof fetch,
    });
    await expect(
      client.mutation('/tasks/t/claim', 'POST', {}, 1, 'stable-key'),
    ).rejects.toMatchObject({ code: 'SERVER_UPGRADE_REQUIRED' });
    await expect(client.request('/v1/runners/start', 'POST', {})).rejects.toMatchObject({
      code: 'SERVER_UPGRADE_REQUIRED',
    });
    await client.request('/v1/runners/probe');
    await client.request('/v1/runners/t/r/cancel', 'POST', {});
    expect(calls).toEqual([
      '/v1/api/health',
      '/v1/api/health',
      '/v1/runners/probe',
      '/v1/runners/t/r/cancel',
    ]);
  });
  it('keeps original task not-found errors and sends compatible mutations with the original version and key', async () => {
    let mutation: unknown;
    const client = new CompanionClient({
      key: 'synthetic-local-key',
      fetcher: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(input.toString()).pathname;
        if (path === '/v1/api/health') return envelope(compatibleServerHealth);
        if (init?.method === 'POST') {
          mutation = JSON.parse(String(init.body));
          return envelope({ written: true });
        }
        return new Response(
          JSON.stringify({ error: { code: 'NOT_FOUND', message: 'missing task' } }),
          { status: 404 },
        );
      }) as typeof fetch,
    });
    await expect(client.get('/tasks/missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await client.mutation('/tasks/t/claim', 'POST', {}, 7, 'original-key');
    expect(mutation).toEqual({ body: {}, version: 7, idempotencyKey: 'original-key' });
  });
});

describe('renderer local runner compatibility boundary', () => {
  it('checks fresh capability before creating a pending start key or sending start/sync', async () => {
    let healthy = false;
    const order: string[] = [];
    vi.stubGlobal('window', { __TAURI__: { core: { invoke: async () => 'synthetic-local-key' } } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const path = new URL(String(input), 'http://synthetic.test').pathname;
        order.push(path);
        return envelope(
          path.endsWith('/health')
            ? healthy
              ? compatibleServerHealth
              : { status: 'ok', database: 'ok' }
            : { run: { id: 'synthetic-run' } },
        );
      }),
    );
    const body = () => {
      order.push('pending-key-created');
      return { idempotencyKey: 'synthetic-key' };
    };
    await expect(requestLocalRunner('/start', body)).rejects.toMatchObject({
      code: 'SERVER_UPGRADE_REQUIRED',
    });
    expect(order).toEqual(['/api/v1/health']);
    healthy = true;
    order.length = 0;
    await requestLocalRunner('/start', body);
    expect(order).toEqual(['/api/v1/health', 'pending-key-created', '/v1/browser/runners/start']);
    healthy = false;
    order.length = 0;
    await expect(requestLocalRunner('/task/run/sync', {})).rejects.toMatchObject({
      code: 'SERVER_UPGRADE_REQUIRED',
    });
    expect(order).toEqual(['/api/v1/health']);
  });
  it('does not add a compatibility probe to existing status, cancel or runner capability queries', async () => {
    const paths: string[] = [];
    vi.stubGlobal('window', { __TAURI__: { core: { invoke: async () => 'synthetic-local-key' } } });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        paths.push(new URL(String(input)).pathname);
        return envelope({ observed: true });
      }),
    );
    await requestLocalRunner('/probe');
    await requestLocalRunner('/task/run');
    await requestLocalRunner('/task/run/cancel', {});
    expect(paths).toEqual([
      '/v1/browser/runners/probe',
      '/v1/browser/runners/task/run',
      '/v1/browser/runners/task/run/cancel',
    ]);
  });
});
