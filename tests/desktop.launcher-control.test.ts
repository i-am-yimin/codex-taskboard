import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanion } from '../apps/companion/src/main.ts';
import { LauncherControl, type LauncherSession } from '../apps/companion/src/launcher-control.ts';

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
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
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

  it('allows an isolated launch to report its unverified host without enabling injection', async () => {
    server = createServer((request, response) => {
      if (request.headers['x-taskboard-control-key'] !== key) {
        response.writeHead(403).end();
        return;
      }
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify(request.url === '/session'
        ? { session: { ...original, version: '26.924.2738.0' } }
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
        reason: 'Codex 26.924.2738.0 尚未完成页面验收，仅可隔离启动',
      });
      const install = await runtime.app.inject({ method: 'POST', url: '/v1/codex/install', headers });
      expect(install.statusCode).toBe(409);
      expect(install.json().error.code).toBe('ADAPTER_UNAVAILABLE');
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
