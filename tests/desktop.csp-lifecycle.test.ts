import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer as createNetServer } from 'node:net';
import {
  CodexDesktopAdapter,
  connectCdp,
  type CdpConnection,
  type CdpConnector,
} from '../packages/adapter-codex/src/index.ts';

type CdpPage = {
  id: string;
  type: string;
  url: string;
  webSocketDebuggerUrl: string;
};

let context: BrowserContext;
let page: Page;
let host: Server;
let board: Server;
let hostOrigin: string;
let boardOrigin: string;
let cdpEndpoint: string;
let profileDirectory: string;
let activeAdapter: CodexDesktopAdapter | undefined;
let delayComposerOnNextLoad = false;
const pageErrors: string[] = [];

function listen(server: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address();
      if (!address || typeof address === 'string')
        return reject(new Error('Missing server address'));
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function unusedPort(): Promise<number> {
  const server = createNetServer();
  await new Promise<void>((resolve, reject) =>
    server.listen(0, '127.0.0.1', resolve).once('error', reject),
  );
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing temporary TCP port');
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function json<T>(path: string): Promise<T> {
  const response = await fetch(`${cdpEndpoint}${path}`);
  if (!response.ok) throw new Error(`CDP ${path} returned ${response.status}`);
  return (await response.json()) as T;
}

async function waitForCdp(): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      await json<{ webSocketDebuggerUrl?: string }>('/json/version');
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error('The independent Chromium CDP endpoint did not start');
}

async function boundPage(): Promise<CdpPage> {
  const pages = await json<CdpPage[]>('/json/list');
  const target = pages.filter(
    (candidate) => candidate.type === 'page' && candidate.url === `${hostOrigin}/`,
  );
  if (target.length !== 1 || !target[0].webSocketDebuggerUrl)
    throw new Error('Independent Chromium page binding is not unique');
  return target[0];
}

function adapter(
  target: CdpPage,
  connector: CdpConnector = (webSocketDebuggerUrl) => connectCdp(webSocketDebuggerUrl, 5_000),
): CodexDesktopAdapter {
  activeAdapter = new CodexDesktopAdapter(
    {
      managedProcess: true,
      appVersion: '26.901.5280.0',
      endpoint: cdpEndpoint,
      boardUrl: `${boardOrigin}/board`,
      targetBinding: {
        targetId: target.id,
        exactPageUrl: `${hostOrigin}/`,
        pageWebSocketUrl: target.webSocketDebuggerUrl,
      },
      shellMarker: '#codex-shell',
      sidebarMarker: '#codex-sidebar',
      contentMarker: '#codex-content',
      composerMarker: '#codex-composer',
      modalMarker: '[role="dialog"]',
      allowCspBypass: true,
      allowCspReload: true,
      cdpTimeoutMs: 5_000,
    },
    connector,
  );
  return activeAdapter;
}

async function cspBlocksBoard(): Promise<boolean> {
  return page.evaluate(async (url) => {
    let blocked = false;
    const violated = (event: SecurityPolicyViolationEvent) => {
      if (event.violatedDirective === 'frame-src') blocked = true;
    };
    document.addEventListener('securitypolicyviolation', violated);
    const probe = document.createElement('iframe');
    probe.id = 'csp-lifecycle-probe';
    probe.src = url;
    document.body.append(probe);
    await new Promise((resolve) => setTimeout(resolve, 250));
    probe.remove();
    document.removeEventListener('securitypolicyviolation', violated);
    return blocked;
  }, `${boardOrigin}/board`);
}

async function documentOrigin(): Promise<number> {
  return page.evaluate(() => performance.timeOrigin);
}

async function waitForDocumentAfter(before: number): Promise<void> {
  await expect.poll(documentOrigin, { timeout: 10_000 }).not.toBe(before);
}

async function waitForShell(): Promise<void> {
  await page.locator('#codex-shell').waitFor({ state: 'attached', timeout: 5_000 });
}

beforeAll(async () => {
  host = createServer((_request, response) => {
    const delayComposer = delayComposerOnNextLoad;
    delayComposerOnNextLoad = false;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Content-Security-Policy', "frame-src 'self'");
    response.end(`<!doctype html><html><body><script>
      const mount = () => {
        document.body.innerHTML = '<main id="codex-shell"><nav id="codex-sidebar"></nav><section id="codex-content"></section></main>';
        const composer = () => document.querySelector('#codex-content').innerHTML = '<div id="codex-composer" contenteditable="true" role="textbox"></div>';
        ${delayComposer ? 'setTimeout(composer, 450);' : 'composer();'}
      };
      setTimeout(mount, ${delayComposer ? 0 : 250});
    </script></body></html>`);
  });
  board = createServer((_request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<!doctype html><main data-board-ready>Board ready</main><script>
      addEventListener('message', (event) => {
        if (event.data?.type === 'taskboard:ready-challenge' && typeof event.data.nonce === 'string')
          event.source?.postMessage({type: 'taskboard:ready-response', nonce: event.data.nonce}, event.origin);
      });
    </script>`);
  });
  hostOrigin = await listen(host);
  boardOrigin = await listen(board);
  profileDirectory = await mkdtemp(join(tmpdir(), 'codex-taskboard-csp-'));
  const port = await unusedPort();
  cdpEndpoint = `http://127.0.0.1:${port}`;
  context = await chromium.launchPersistentContext(profileDirectory, {
    headless: true,
    args: [`--remote-debugging-address=127.0.0.1`, `--remote-debugging-port=${port}`],
  });
  await waitForCdp();
  page = await context.newPage();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`${hostOrigin}/`);
  await waitForShell();
});

afterEach(async () => {
  try {
    await activeAdapter?.dispose().catch(() => undefined);
  } finally {
    activeAdapter = undefined;
    await page.goto(`${hostOrigin}/`);
    await waitForShell();
  }
});

afterAll(async () => {
  await context?.close();
  await Promise.all(
    [host, board].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.closeAllConnections();
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
  await rm(profileDirectory, { recursive: true, force: true });
});

describe.sequential('Codex adapter CSP lifecycle in independent Chromium', () => {
  it('applies bypass only through a guarded reload, restores CSP after disposal, and recovers on external reload', async () => {
    expect(await cspBlocksBoard()).toBe(true);
    const beforeInstall = await documentOrigin();
    const target = await boundPage();
    const instance = adapter(target);

    await instance.install();
    await waitForDocumentAfter(beforeInstall);
    await expect(page.locator('[data-taskboard-owned]').count()).resolves.toBe(1);
    await expect
      .poll(() => page.frames().some((frame) => frame.url() === `${boardOrigin}/board`))
      .toBe(true);
    expect(await cspBlocksBoard()).toBe(false);

    const beforeExternalReload = await documentOrigin();
    await page.reload();
    await waitForDocumentAfter(beforeExternalReload);
    await expect
      .poll(() => page.locator('[data-taskboard-owned]').count(), { timeout: 10_000 })
      .toBe(1);
    await expect
      .poll(() => page.frames().some((frame) => frame.url() === `${boardOrigin}/board`))
      .toBe(true);
    await expect
      .poll(async () => (await instance.probe()).embedded, { timeout: 10_000 })
      .toBe(true);

    const beforeDispose = await documentOrigin();
    await instance.dispose();
    activeAdapter = undefined;
    await waitForDocumentAfter(beforeDispose);
    expect(await page.locator('[data-taskboard-owned]').count()).toBe(0);
    expect(await page.locator('[data-taskboard-entry]').count()).toBe(0);
    expect(
      await page.evaluate(
        () =>
          Object.keys(window).filter((key) => key.startsWith('__taskboardEmbedCleanup_')).length,
      ),
    ).toBe(0);
    expect(await cspBlocksBoard()).toBe(true);
  });

  it('waits for a delayed composer after the reloaded shell appears', async () => {
    const target = await boundPage();
    delayComposerOnNextLoad = true;
    const reloadSamples: Array<{ shell?: number; composer?: number }> = [];
    const pageErrorCount = pageErrors.length;
    const connector: CdpConnector = async (webSocketDebuggerUrl) => {
      const connection = await connectCdp(webSocketDebuggerUrl, 5_000);
      return {
        send: async <T = unknown>(
          method: string,
          params?: Record<string, unknown>,
          timeoutMs?: number,
        ): Promise<T> => {
          const result = await connection.send<T>(method, params, timeoutMs);
          if (
            method === 'Runtime.evaluate' &&
            String(params?.expression).startsWith('({ origin:')
          ) {
            const value = (result as { result?: { value?: { shell?: number; composer?: number } } })
              .result?.value;
            if (value) reloadSamples.push(value);
          }
          return result;
        },
        onEvent: connection.onEvent?.bind(connection),
        close: () => connection.close(),
      } satisfies CdpConnection;
    };
    const instance = adapter(target, connector);

    await instance.install();

    expect(reloadSamples.some((sample) => sample.shell === 1 && sample.composer === 0)).toBe(true);
    expect(pageErrors.slice(pageErrorCount)).toEqual([]);
    expect(await page.locator('[data-taskboard-owned]').count()).toBe(1);
    expect(await page.locator('#codex-composer').count()).toBe(1);
  });

  it('refuses the guarded CSP reload when the editor contains an unsent draft', async () => {
    await page.locator('#codex-composer').fill('do not discard this draft');
    const target = await boundPage();
    const instance = adapter(target);

    await expect(instance.install()).rejects.toThrow('CSP reload refused');
    expect(await page.locator('#codex-composer').textContent()).toBe('do not discard this draft');
    expect(await page.locator('[data-taskboard-owned]').count()).toBe(0);
  });

  it('does not discard a draft when CSP restoration would require a reload', async () => {
    const target = await boundPage();
    const instance = adapter(target);
    await instance.install();
    await page.locator('#codex-composer').fill('keep this new draft');
    const beforeDispose = await documentOrigin();

    await expect(instance.dispose()).rejects.toThrow('CSP restoration unconfirmed');
    expect(await documentOrigin()).toBe(beforeDispose);
    expect(await page.locator('#codex-composer').textContent()).toBe('keep this new draft');

    await page.locator('#codex-composer').fill('');
    await page.reload();
    expect(await cspBlocksBoard()).toBe(true);
  });

  it('refuses the guarded CSP reload while a host modal is open', async () => {
    await page.evaluate(() => {
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      document.body.append(modal);
    });
    const target = await boundPage();
    const instance = adapter(target);

    await expect(instance.install()).rejects.toThrow('CSP reload refused');
    expect(await page.locator('[role="dialog"]').count()).toBe(1);
    expect(await page.locator('[data-taskboard-owned]').count()).toBe(0);
  });
});
