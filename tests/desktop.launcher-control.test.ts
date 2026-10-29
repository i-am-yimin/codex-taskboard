import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanion } from '../apps/companion/src/main.ts';
import { LauncherControl, type LauncherSession } from '../apps/companion/src/launcher-control.ts';
import { CodexDesktopAdapter } from '../packages/adapter-codex/src/index.ts';

const key = 'K'.repeat(48);
const targetId = 'A'.repeat(32);
const original: LauncherSession = {
  id: 'S'.repeat(48),
  version: '26.917.9434.0',
  pid: 4242,
  createdTicks: '123456789',
  codexHome: 'C:\\isolated-codex-home',
  endpoint: 'http://127.0.0.1:9223',
  targetId,
  exactPageUrl: 'app://-/index.html',
  pageWebSocketUrl: `ws://127.0.0.1:9223/devtools/page/${targetId}`,
};

describe('private launcher control', () => {
  let server: Server | undefined;
  afterEach(async () => {
    vi.restoreAllMocks();
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  });

  it('accepts a native daily session without guessing a home directory or enabling automatic drafts', async () => {
    const { codexHome: _home, ...withoutHome } = original;
    void _home;
    const daily = { ...withoutHome, mode: 'daily' as const };
    server = createServer((request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(request.url === '/session' ? { session: daily } : { valid: true }));
    });
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing test port');
    const control = new LauncherControl(address.port, key);
    expect(await control.session()).toEqual(daily);
    const probe = vi.spyOn(CodexDesktopAdapter.prototype, 'probe').mockImplementation(async function (this: CodexDesktopAdapter) {
      const config = (this as unknown as { config: { codexHome?: string } }).config;
      expect(config.codexHome).toBeUndefined();
      return { embedded: false, projects: false, draft: false, thread: false };
    });
    const runtime = await createCompanion({ dataDirectory: await mkdtemp(join(tmpdir(), 'taskboard-daily-')), port: 0, launcherControl: control });
    try {
      const response = await runtime.app.inject({ method: 'GET', url: '/v1/codex/probe', headers: { 'x-taskboard-companion-key': runtime.clientKey } });
      expect(response.json().data.draft).toBe(false);
      expect(probe).toHaveBeenCalledOnce();
    } finally { await runtime.stop(); }
  });

  it('rejects a daily session claiming a home directory and a managed session missing its home', async () => {
    let session: unknown = { ...original, mode: 'daily' };
    server = createServer((_request, response) => response.end(JSON.stringify({ session })));
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing test port');
    const control = new LauncherControl(address.port, key);
    await expect(control.session()).rejects.toThrow();
    const { codexHome: _home, ...withoutHome } = original;
    void _home;
    session = withoutHome;
    await expect(control.session()).rejects.toThrow();
  });

  it('reuses an already installed sidebar when the connection shortcut is opened again', async () => {
    const control = new LauncherControl(9, key);
    vi.spyOn(control, 'session').mockResolvedValue(original);
    vi.spyOn(CodexDesktopAdapter.prototype, 'probe').mockResolvedValue({
      embedded: true, projects: false, draft: true, thread: false,
    });
    const install = vi.spyOn(CodexDesktopAdapter.prototype, 'install');
    const runtime = await createCompanion({
      dataDirectory: await mkdtemp(join(tmpdir(), 'taskboard-sidebar-reuse-')),
      port: 0, launcherControl: control,
    });
    try {
      const response = await runtime.app.inject({ method: 'POST', url: '/v1/codex/install', headers: { 'x-taskboard-companion-key': runtime.clientKey } });
      expect(response.statusCode).toBe(200);
      expect(response.json().data.embedded).toBe(true);
      expect(install).not.toHaveBeenCalled();
    } finally { await runtime.stop(); }
  });

  it.each([false, true])('shares overlapping sidebar installation and releases a failed attempt (%s)', async (fail) => {
    const control = new LauncherControl(9, key);
    vi.spyOn(control, 'session').mockResolvedValue(original);
    let installed = false;
    vi.spyOn(CodexDesktopAdapter.prototype, 'probe').mockImplementation(async () => ({
      embedded: installed, projects: false, draft: true, thread: false,
    }));
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const install = vi.spyOn(CodexDesktopAdapter.prototype, 'install').mockImplementation(async () => {
      await pending;
      if (fail && install.mock.calls.length === 1) throw new Error('Workspace refused');
      installed = true;
    });
    const runtime = await createCompanion({
      dataDirectory: await mkdtemp(join(tmpdir(), 'taskboard-shared-install-')),
      port: 0, launcherControl: control,
    });
    const request = () => runtime.app.inject({ method: 'POST', url: '/v1/codex/install', headers: { 'x-taskboard-companion-key': runtime.clientKey } });
    try {
      const first = request();
      await vi.waitFor(() => expect(install).toHaveBeenCalledOnce());
      const second = request();
      await new Promise(resolve => setTimeout(resolve, 20));
      expect(install).toHaveBeenCalledOnce();
      finish();
      const responses = await Promise.all([first, second]);
      expect(responses.map(r => r.statusCode)).toEqual(fail ? [409, 409] : [200, 200]);
      expect(responses[0].json()).toEqual(responses[1].json());
      const retry = await request();
      expect(retry.statusCode).toBe(200);
      expect(retry.json().data.embedded).toBe(true);
      expect(install).toHaveBeenCalledTimes(fail ? 2 : 1);
    } finally { finish(); await runtime.stop(); }
  });

  it('revokes ownership on exit, port switch, page drift and launcher loss', async () => {
    let session: LauncherSession | null = { ...original };
    let valid = true;
    server = createServer((request, response) => {
      if (request.headers['x-taskboard-control-key'] !== key) {
        response.writeHead(403).end();
        return;
      }
      response.setHeader('content-type', 'application/json');
      if (request.url === '/session')
        response.end(JSON.stringify({ session: valid ? session : null }));
      else if (request.url === `/verify/${original.id}`)
        response.end(JSON.stringify({ valid: valid && session?.id === original.id }));
      else response.writeHead(404).end();
    });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing test port');
    const control = new LauncherControl(address.port, key);
    expect(await control.session()).toEqual(original);
    expect(await control.verify(original)).toBe(true);
    valid = false;
    expect(await control.verify(original)).toBe(false);
    valid = true;
    session = {
      ...original,
      endpoint: 'http://127.0.0.1:9224',
      pageWebSocketUrl: `ws://127.0.0.1:9224/devtools/page/${targetId}`,
    };
    expect(await control.verify(original)).toBe(false);
    session = {
      ...original,
      targetId: 'B'.repeat(32),
      pageWebSocketUrl: `ws://127.0.0.1:9223/devtools/page/${'B'.repeat(32)}`,
    };
    expect(await control.verify(original)).toBe(false);
    session = null;
    expect(await control.verify(original)).toBe(false);
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
    expect(await control.verify(original)).toBe(false);
  });

  it('accepts only an authenticated exact-process exit receipt and fails closed on missing or malformed proof', async () => {
    const expectedPath = '/exited/' + original.id + '/' + original.pid + '/' + original.createdTicks;
    let receipt: unknown = { exited: true };
    server = createServer((request, response) => {
      if (request.headers['x-taskboard-control-key'] !== key) {
        response.writeHead(403).end(); return;
      }
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(request.url === expectedPath ? receipt : { exited: false }));
    });
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing test port');
    const control = new LauncherControl(address.port, key);
    expect(await control.hasExited(original)).toBe(true);
    expect(await control.hasExited({ ...original, pid: original.pid + 1 })).toBe(false);
    expect(await control.hasExited({ ...original, createdTicks: '987654321' })).toBe(false);
    expect(await control.hasExited({ ...original, id: 'X'.repeat(48) })).toBe(false);
    for (const value of [null, {}, { exited: false }, { exited: 'true' }, { exited: true, extra: true }]) {
      receipt = value;
      expect(await control.hasExited(original)).toBe(false);
    }
    expect(await new LauncherControl(address.port, 'W'.repeat(48)).hasExited(original)).toBe(false);
    await new Promise<void>(resolve => server!.close(() => resolve()));
    server = undefined;
    expect(await control.hasExited(original)).toBe(false);
  });

  it('passes only the private session to the adapter and rejects an unavailable host', async () => {
    server = createServer((request, response) => {
      if (request.headers['x-taskboard-control-key'] !== key) {
        response.writeHead(403).end();
        return;
      }
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify(request.url === '/session' ? { session: original } : { valid: true }),
      );
    });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing test port');
    const runtime = await createCompanion({
      dataDirectory: await mkdtemp(join(tmpdir(), 'taskboard-control-')),
      port: 0,
      launcherControl: new LauncherControl(address.port, key),
    });
    try {
      const headers = { 'x-taskboard-companion-key': runtime.clientKey };
      const probe = await runtime.app.inject({ method: 'GET', url: '/v1/codex/probe', headers });
      expect(probe.statusCode).toBe(200);
      expect(probe.json().data.embedded).toBe(false);
      expect(JSON.stringify(probe.json())).not.toContain(key);
      const install = await runtime.app.inject({
        method: 'POST',
        url: '/v1/codex/install',
        headers,
      });
      expect(install.statusCode).toBe(409);
      expect(install.json().error.code).toBe('CODEX_INSTALL_REFUSED');
    } finally {
      await runtime.stop();
    }
  });

  it('does not reject an unlisted version before its actual transport and structure check', async () => {
    server = createServer((request, response) => {
      if (request.headers['x-taskboard-control-key'] !== key) {
        response.writeHead(403).end();
        return;
      }
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(request.url === '/session'
        ? { session: { ...original, version: '26.924.9999.0' } }
        : { valid: true }));
    });
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing test port');
    const runtime = await createCompanion({
      dataDirectory: await mkdtemp(join(tmpdir(), 'taskboard-control-')),
      port: 0,
      launcherControl: new LauncherControl(address.port, key),
    });
    try {
      const headers = { 'x-taskboard-companion-key': runtime.clientKey };
      const probe = await runtime.app.inject({ method: 'GET', url: '/v1/codex/probe', headers });
      expect(probe.statusCode).toBe(200);
      expect(probe.json().data).toMatchObject({
        embedded: false,
        draft: false,
        sidebar: { state: 'transport-unavailable', appVersion: '26.924.9999.0' },
      });
      const install = await runtime.app.inject({ method: 'POST', url: '/v1/codex/install', headers });
      expect(install.statusCode).toBe(409);
      expect(install.json().error.code).toBe('CODEX_INSTALL_REFUSED');
    } finally {
      await runtime.stop();
    }
  });

  it('serves bundled board assets through a separate scoped capability', async () => {
    const root = await mkdtemp(join(tmpdir(), 'taskboard-embedded-'));
    const web = join(root, 'web');
    await mkdir(join(web, 'assets'), { recursive: true });
    await writeFile(join(web, 'index.html'), '<script src="/assets/app.js"></script>');
    await writeFile(join(web, 'assets', 'app.js'), 'window.boardLoaded = true;');
    const runtime = await createCompanion({ dataDirectory: root, port: 0, embeddedWebRoot: web });
    try {
      const url = new URL(runtime.embeddedUrl);
      const token = /^\/embedded\/([A-Za-z0-9_-]{43})\/$/.exec(url.pathname)?.[1];
      expect(token).toBeTruthy();
      const page = await runtime.app.inject({ method: 'GET', url: url.pathname });
      expect(page.statusCode).toBe(200);
      expect(page.body).toContain(`${url.pathname}assets/app.js`);
      expect(page.headers['referrer-policy']).toBe('no-referrer');
      const asset = await runtime.app.inject({
        method: 'GET',
        url: `${url.pathname}assets/app.js`,
      });
      expect(asset.statusCode).toBe(200);
      expect(asset.body).toContain('boardLoaded');
      const browser = await runtime.app.inject({
        method: 'GET',
        url: '/v1/browser/upstream',
        headers: { origin: 'http://127.0.0.1:47831', 'x-taskboard-companion-key': token! },
      });
      expect(browser.statusCode).toBe(200);
      const localPaths = await runtime.app.inject({
        method: 'GET',
        url: '/v1/mappings/repository',
        headers: { 'x-taskboard-companion-key': token! },
      });
      expect(localPaths.statusCode).toBe(401);
      const denied = await runtime.app.inject({ method: 'GET', url: '/embedded/wrong/' });
      expect(denied.statusCode).toBe(401);
    } finally {
      await runtime.stop();
    }
  });
});
