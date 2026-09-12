import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LightMyRequestResponse } from 'fastify';

const controls = vi.hoisted(() => ({ failRename: false }));
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    rename: async (...args: Parameters<typeof actual.rename>) => {
      if (controls.failRename) {
        controls.failRename = false;
        throw new Error('simulated rename failure');
      }
      return actual.rename(...args);
    },
  };
});

import { CompanionStore } from '../apps/companion/src/store.ts';
import { createCompanion } from '../apps/companion/src/main.ts';
import { SecretStore } from '../apps/companion/src/secret.ts';

const directory = () => mkdtemp(join(tmpdir(), 'taskboard-upstream-state-'));

describe('upstream persistence ordering', () => {
  const secrets = new Map<string, string>();
  const secretPath = (store: SecretStore) => (store as unknown as { path: string }).path;
  beforeEach(() => {
    vi.spyOn(SecretStore.prototype, 'read').mockImplementation(async function (this: SecretStore) {
      return secrets.get(secretPath(this));
    });
    vi.spyOn(SecretStore.prototype, 'write').mockImplementation(async function (
      this: SecretStore,
      value,
    ) {
      secrets.set(secretPath(this), value);
    });
    vi.spyOn(SecretStore.prototype, 'clear').mockImplementation(async function (this: SecretStore) {
      secrets.delete(secretPath(this));
    });
  });
  afterEach(() => {
    controls.failRename = false;
    secrets.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('keeps the old upstream through a failed atomic write while a mapping save is queued', async () => {
    const dataDirectory = await directory();
    const store = new CompanionStore(dataDirectory);
    await store.load();
    controls.failRename = true;
    const failed = store.setUpstream('https://failed.example.test/');
    const mapped = store.mapRepository('https://github.com/example/repo', 'C:/workspace');
    await expect(failed).rejects.toThrow('simulated rename failure');
    await mapped;
    expect(store.configuredUpstream()).toBeUndefined();
    const restarted = new CompanionStore(dataDirectory);
    await restarted.load();
    expect(restarted.configuredUpstream()).toBeUndefined();
    expect(restarted.localPath('https://github.com/example/repo')).toBe('C:/workspace');
  });

  it('persists the committed upstream when a normal save is queued after it', async () => {
    const dataDirectory = await directory();
    const store = new CompanionStore(dataDirectory);
    await store.load();
    await Promise.all([
      store.setUpstream('https://saved.example.test/'),
      store.mapRepository('https://github.com/example/repo', 'C:/workspace'),
    ]);
    const restarted = new CompanionStore(dataDirectory);
    await restarted.load();
    expect(restarted.configuredUpstream()).toBe('https://saved.example.test/');
    expect(restarted.localPath('https://github.com/example/repo')).toBe('C:/workspace');
  });

  it('gives environment and options precedence over a persisted value', async () => {
    const dataDirectory = await directory();
    const store = new CompanionStore(dataDirectory);
    await store.load();
    await store.setUpstream('https://saved.example.test/');
    vi.stubEnv('TASKBOARD_UPSTREAM', 'https://environment.example.test');
    const environment = await createCompanion({ dataDirectory, port: 0 });
    try {
      const result = await environment.app.inject({
        method: 'GET',
        url: '/v1/browser/upstream',
        headers: {
          'x-taskboard-companion-key': environment.clientKey,
          origin: 'tauri://localhost',
        },
      });
      expect(result.json()).toMatchObject({
        data: { upstream: 'https://environment.example.test/', locked: true },
      });
    } finally {
      await environment.stop();
    }
    const options = await createCompanion({
      dataDirectory,
      upstream: 'https://options.example.test',
      port: 0,
    });
    try {
      const result = await options.app.inject({
        method: 'GET',
        url: '/v1/browser/upstream',
        headers: { 'x-taskboard-companion-key': options.clientKey, origin: 'tauri://localhost' },
      });
      expect(result.json()).toMatchObject({
        data: { upstream: 'https://options.example.test/', locked: true },
      });
    } finally {
      await options.stop();
    }
  });

  it('keeps account drafts and outbox when an upstream request races a deferred login', async () => {
    const dataDirectory = await directory();
    const store = new CompanionStore(dataDirectory);
    await store.load();
    await store.activate('http://127.0.0.1:47830/', 'user-1');
    await store.saveDraft('00000000-0000-4000-8000-000000000001', { text: 'keep draft' });
    await store.queue({
      path: '/tasks/00000000-0000-4000-8000-000000000001/submit',
      body: { done: true },
      version: 1,
      idempotencyKey: '00000000-0000-4000-8000-000000000002',
    });
    await new SecretStore(join(dataDirectory, 'browser-session.dpapi')).write(
      'tb_session=existing',
    );
    let release!: () => void;
    let fetchStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      fetchStarted = resolve;
    });
    const response = new Promise<Response>((resolve) => {
      release = () =>
        resolve(
          new Response(JSON.stringify({ data: { user: { id: 'user-1' } } }), {
            headers: { 'content-type': 'application/json', 'set-cookie': 'tb_session=new; Path=/' },
          }),
        );
    });
    vi.stubGlobal('fetch', () => {
      fetchStarted();
      return response;
    });
    const runtime = await createCompanion({ dataDirectory, port: 0 });
    let login: Promise<LightMyRequestResponse> | undefined;
    try {
      const headers = {
        'x-taskboard-companion-key': runtime.clientKey,
        origin: 'tauri://localhost',
      };
      login = runtime.app.inject({
        method: 'POST',
        url: '/v1/browser/login',
        headers,
        payload: { email: 'user@example.test', password: 'long-enough-secret', deviceName: 'test' },
      });
      await started;
      const transitioning = await runtime.app.inject({
        method: 'POST',
        url: '/v1/browser/upstream',
        headers,
        payload: { upstream: 'https://other.example.test' },
      });
      expect(transitioning.json()).toMatchObject({ error: { code: 'AUTH_TRANSITION' } });
      release();
      expect((await login).statusCode).toBe(200);
      const inUse = await runtime.app.inject({
        method: 'POST',
        url: '/v1/browser/upstream',
        headers,
        payload: { upstream: 'https://other.example.test' },
      });
      expect(inUse.json()).toMatchObject({ error: { code: 'UPSTREAM_IN_USE' } });
      const restored = new CompanionStore(dataDirectory);
      await restored.load();
      expect(restored.activeIdentity()).toMatchObject({ userId: 'user-1' });
      expect(restored.drafts()).toMatchObject([{ body: { text: 'keep draft' } }]);
      expect(restored.outbox()).toMatchObject([{ body: { done: true } }]);
    } finally {
      release();
      await Promise.allSettled(login ? [login] : []);
      await runtime.stop();
    }
  });
});
