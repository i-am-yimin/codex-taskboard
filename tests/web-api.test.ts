import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, request, clearAccountCache } from '../apps/web/src/api.ts';

describe('web API transport', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('uses a local capability without browser cookies for the desktop proxy', async () => {
    vi.stubGlobal('window', { __TAURI__: { core: { invoke: async () => 'local-capability' } } });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal('fetch', fetchMock);
    await request('/spaces');
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:47831/api/v1/spaces');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      credentials: 'omit',
      headers: { 'x-taskboard-companion-key': 'local-capability' },
    });
  });
  it('clears account result drafts while preserving another account', () => {
    const storage: Record<string, unknown> = {
      'tb:result:A:task': 'private result',
      'tb:draft:A:task': 'private draft',
      'tb:result:B:task': 'other account',
      removeItem: (key: string) => {
        delete storage[key];
      },
    };
    vi.stubGlobal('localStorage', storage);
    clearAccountCache('A');
    expect(storage['tb:result:A:task']).toBeUndefined();
    expect(storage['tb:draft:A:task']).toBeUndefined();
    expect(storage['tb:result:B:task']).toBe('other account');
  });

  it('sends version and idempotency headers for a mutation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: 'task-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await request('/tasks/task-1', {
      method: 'PATCH',
      body: { title: '更新' },
      version: 4,
      idempotencyKey: 'stable-key',
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('PATCH');
    expect(init.credentials).toBe('include');
    expect(init.headers).toMatchObject({
      'If-Match': '4',
      'Idempotency-Key': 'stable-key',
      'Content-Type': 'application/json',
    });
  });

  it('keeps a structured server conflict for the conflict dialog', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'CONFLICT', message: '版本已过期' } }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await expect(request('/tasks/task-1', { method: 'PATCH', body: {} })).rejects.toMatchObject({
      code: 'CONFLICT',
      status: 409,
      message: '版本已过期',
    } satisfies Partial<ApiError>);
  });

  it('treats a desktop proxy cache response as offline so the renderer stays read-only', async () => {
    vi.stubGlobal('window', { __TAURI__: { core: { invoke: async () => 'local-capability' } } });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [], meta: { source: 'cache', offline: true } }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await expect(request('/spaces')).rejects.toMatchObject({ code: 'OFFLINE', status: 0 });
  });

  it('uses If-Match and a strict empty body for task acceptance', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await api.accept('task-1', 9);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ 'If-Match': '9' });
    expect(init.body).toBe('{}');
  });
});
