import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LightMyRequestResponse } from 'fastify';
import { createCompanion } from '../apps/companion/src/main.ts';
import { SecretStore } from '../apps/companion/src/secret.ts';
import { CompanionStore } from '../apps/companion/src/store.ts';

const directory = () => mkdtemp(join(tmpdir(), 'taskboard-upstream-'));

describe('desktop upstream setup', () => {
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
    secrets.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('persists an unauthenticated browser upstream across restart', async () => {
    const dataDirectory = await directory();
    const first = await createCompanion({ dataDirectory, port: 0 });
    try {
      const headers = { 'x-taskboard-companion-key': first.clientKey, origin: 'tauri://localhost' };
      const set = await first.app.inject({
        method: 'POST',
        url: '/v1/browser/upstream',
        headers,
        payload: { upstream: 'https://taskboard.example.test' },
      });
      expect(set.statusCode).toBe(200);
      expect(set.json()).toMatchObject({ data: { upstream: 'https://taskboard.example.test/' } });
      const unsafe = await first.app.inject({
        method: 'POST',
        url: '/v1/browser/upstream',
        headers,
        payload: { upstream: 'https://user:password@taskboard.example.test/?secret=1' },
      });
      expect(unsafe.json()).toMatchObject({ error: { code: 'UNSAFE_UPSTREAM' } });
    } finally {
      await first.stop();
    }
    const second = await createCompanion({ dataDirectory, port: 0 });
    try {
      const result = await second.app.inject({
        method: 'GET',
        url: '/v1/browser/upstream',
        headers: { 'x-taskboard-companion-key': second.clientKey, origin: 'tauri://localhost' },
      });
      expect(result.json()).toMatchObject({
        data: { upstream: 'https://taskboard.example.test/' },
      });
    } finally {
      await second.stop();
    }
  });

  it('reports invalid login input and an unreachable server without an opaque 500', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('connect failed');
    });
    const runtime = await createCompanion({ dataDirectory: await directory(), port: 0 });
    try {
      const headers = {
        'x-taskboard-companion-key': runtime.clientKey,
        origin: 'tauri://localhost',
      };
      const invalid = await runtime.app.inject({
        method: 'POST',
        url: '/v1/browser/login',
        headers,
        payload: { email: 'user@example.test', password: 'short', deviceName: 'test' },
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });

      const unreachable = await runtime.app.inject({
        method: 'POST',
        url: '/v1/browser/login',
        headers,
        payload: { email: 'user@example.test', password: 'long-enough-secret', deviceName: 'test' },
      });
      expect(unreachable.statusCode).toBe(502);
      expect(unreachable.json()).toMatchObject({ error: { code: 'UPSTREAM_UNAVAILABLE' } });
    } finally {
      await runtime.stop();
    }
  });

  it('reports a local failure to save the server address', async () => {
    vi.spyOn(CompanionStore.prototype, 'setUpstream').mockRejectedValue(new Error('write failed'));
    const runtime = await createCompanion({ dataDirectory: await directory(), port: 0 });
    try {
      const result = await runtime.app.inject({
        method: 'POST',
        url: '/v1/browser/upstream',
        headers: { 'x-taskboard-companion-key': runtime.clientKey, origin: 'tauri://localhost' },
        payload: { upstream: 'https://taskboard.example.test' },
      });
      expect(result.statusCode).toBe(500);
      expect(result.json()).toMatchObject({ error: { code: 'UPSTREAM_SAVE_FAILED' } });
    } finally {
      await runtime.stop();
    }
  });

  it('rejects CLI access, locked values, and unsafe input', async () => {
    const dataDirectory = await directory();
    const runtime = await createCompanion({
      dataDirectory,
      upstream: 'https://locked.example.test',
      port: 0,
    });
    try {
      const cliKey = await new SecretStore(join(dataDirectory, 'cli-key.dpapi')).read();
      const cli = await runtime.app.inject({
        method: 'GET',
        url: '/v1/browser/upstream',
        headers: { 'x-taskboard-companion-key': cliKey! },
      });
      expect(cli.statusCode).toBe(403);
      const missingOrigin = await runtime.app.inject({
        method: 'GET',
        url: '/v1/browser/upstream',
        headers: { 'x-taskboard-companion-key': runtime.clientKey },
      });
      expect(missingOrigin.statusCode).toBe(403);
      const headers = {
        'x-taskboard-companion-key': runtime.clientKey,
        origin: 'tauri://localhost',
      };
      const locked = await runtime.app.inject({
        method: 'POST',
        url: '/v1/browser/upstream',
        headers,
        payload: { upstream: 'https://other.example.test' },
      });
      expect(locked.json()).toMatchObject({ error: { code: 'UPSTREAM_LOCKED' } });
      const current = await runtime.app.inject({
        method: 'GET',
        url: '/v1/browser/upstream',
        headers,
      });
      expect(current.json()).toMatchObject({
        data: { locked: true, upstream: 'https://locked.example.test/' },
      });
    } finally {
      await runtime.stop();
    }
  });

  it('does not change an authenticated upstream or its account data', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(JSON.stringify({ data: { user: { id: 'user-1' } } }), {
          headers: {
            'content-type': 'application/json',
            'set-cookie': 'tb_session=session; Path=/',
          },
        }),
    );
    const runtime = await createCompanion({ dataDirectory: await directory(), port: 0 });
    try {
      const headers = {
        'x-taskboard-companion-key': runtime.clientKey,
        origin: 'tauri://localhost',
      };
      await runtime.app.inject({
        method: 'POST',
        url: '/v1/browser/login',
        headers,
        payload: { email: 'user@example.test', password: 'long-enough-secret', deviceName: 'test' },
      });
      await runtime.app.inject({
        method: 'POST',
        url: '/v1/drafts',
        headers,
        payload: { taskId: '00000000-0000-4000-8000-000000000001', body: { text: 'keep me' } },
      });
      const denied = await runtime.app.inject({
        method: 'POST',
        url: '/v1/browser/upstream',
        headers,
        payload: { upstream: 'https://other.example.test' },
      });
      expect(denied.json()).toMatchObject({ error: { code: 'UPSTREAM_IN_USE' } });
      const current = await runtime.app.inject({
        method: 'GET',
        url: '/v1/browser/upstream',
        headers,
      });
      expect(current.json()).toMatchObject({
        data: { upstream: 'http://127.0.0.1:47830/', authenticated: true },
      });
      const drafts = await runtime.app.inject({ method: 'GET', url: '/v1/drafts', headers });
      expect(drafts.json()).toMatchObject({ data: [{ body: { text: 'keep me' } }] });
    } finally {
      await runtime.stop();
    }
  });

  it('queues browser login until the new upstream is persisted', async () => {
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const startedGate = new Promise<void>((resolve) => {
      started = resolve;
    });
    const original = CompanionStore.prototype.setUpstream;
    vi.spyOn(CompanionStore.prototype, 'setUpstream').mockImplementation(async function (
      this: CompanionStore,
      value: string,
    ) {
      started();
      await gate;
      await original.call(this, value);
    });
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ data: { user: { id: 'user-1' } } }), {
        headers: { 'content-type': 'application/json', 'set-cookie': 'tb_session=session; Path=/' },
      });
    });
    const runtime = await createCompanion({ dataDirectory: await directory(), port: 0 });
    let change: Promise<LightMyRequestResponse> | undefined;
    let login: Promise<LightMyRequestResponse> | undefined;
    try {
      const headers = {
        'x-taskboard-companion-key': runtime.clientKey,
        origin: 'tauri://localhost',
      };
      change = runtime.app.inject({
        method: 'POST',
        url: '/v1/browser/upstream',
        headers,
        payload: { upstream: 'https://new.example.test' },
      });
      await startedGate;
      login = runtime.app.inject({
        method: 'POST',
        url: '/v1/browser/login',
        headers,
        payload: { email: 'user@example.test', password: 'long-enough-secret', deviceName: 'test' },
      });
      expect(calls).toHaveLength(0);
      release();
      expect((await change).statusCode).toBe(200);
      expect((await login).statusCode).toBe(200);
      expect(calls).toEqual(['https://new.example.test/api/v1/auth/login']);
    } finally {
      release();
      await Promise.allSettled([...(change ? [change] : []), ...(login ? [login] : [])]);
      await runtime.stop();
    }
  });
});
