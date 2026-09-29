import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';
import { boardEmbedScript } from '../packages/adapter-codex/src/index.ts';

let browser: Browser;
let hostOrigin: string;
let boardOrigin: string;
const servers: Server[] = [];
const nonce = 'test-nonce-32-characters-abcdefgh';

beforeAll(async () => {
  const bundle = await build({
    stdin: {
      contents: `import React, {useEffect} from 'react';
        import {createRoot} from 'react-dom/client';
        import {installEmbeddedReadyResponder} from './apps/web/src/embeddedReady';
        function Board() { useEffect(() => installEmbeddedReadyResponder(), []);
          return React.createElement('main', {'data-react-board':true}, 'Board ready'); }
        setTimeout(() => createRoot(document.getElementById('root')).render(React.createElement(Board)), 100);`,
      resolveDir: process.cwd(),
      loader: 'js',
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const serve = async () => {
    const server = createServer((request, response) => {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      if (request.url === '/react') {
        response.end(`<div id="root"></div><script>${bundle.outputFiles[0].text}</script>`);
      } else {
        if (request.url === '/csp')
          response.setHeader('Content-Security-Policy', "frame-src 'none'");
        response.end('<main id="shell"></main>');
      }
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing loopback server');
    return `http://127.0.0.1:${address.port}`;
  };
  hostOrigin = await serve();
  boardOrigin = await serve();
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser?.close();
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeAllConnections();
        }),
    ),
  );
});

async function isolated(run: (page: Page) => Promise<void>, route = '/host') {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto(`${hostOrigin}${route}`);
    await run(page);
  } finally {
    await context.close();
  }
}

async function begin(page: Page, timeout = 2500, boardPath = '/silent', route = '/host') {
  const expression = boardEmbedScript(
    `${boardOrigin}${boardPath}`,
    '#shell',
    1,
    `${hostOrigin}${route}`,
    boardOrigin,
    nonce,
    timeout,
  );
  // Do not await the promise here: later steps exercise in-flight state changes.
  await page.evaluate(`window.__readyResult = undefined;
    window.__readyPromise = (${expression}).then(value => { window.__readyResult = value; return value; }); void 0`);
  if (route !== '/csp') {
    await page.waitForFunction(
      (url) => Array.from(document.querySelectorAll('iframe')).some((frame) => frame.src === url),
      `${boardOrigin}${boardPath}`,
    );
  }
}
const result = (page: Page) => page.evaluate('window.__readyPromise');
const pending = async (page: Page) =>
  expect(await page.evaluate('window.__readyResult')).toBeUndefined();
const frame = (page: Page) => {
  const child = page.frames().find((item) => item.url() === `${boardOrigin}/silent`);
  if (!child) throw new Error('Expected board frame was not loaded');
  return child;
};
async function loadSilent(page: Page) {
  await begin(page);
  await page.waitForFunction(() => document.querySelector('iframe')?.contentWindow !== null);
  const child = await page.locator('iframe').elementHandle();
  const childFrame = await child?.contentFrame();
  if (!childFrame) throw new Error('No board browsing context');
  await childFrame.waitForURL(`${boardOrigin}/silent`);
  return childFrame;
}
const sendResponse = (value: string, target: string) =>
  `parent.postMessage({type:'taskboard:ready-response',nonce:${JSON.stringify(value)}},${JSON.stringify(target)})`;

describe('iframe readiness in real Chromium', () => {
  it('loads a cross-origin React board and waits for its committed effect', async () => {
    await isolated(async (page) => {
      await begin(page, 5000, '/react');
      expect(await result(page)).toEqual({ installed: true });
      const board = page.frames().find((item) => item.url() === `${boardOrigin}/react`);
      expect(await board?.locator('[data-react-board]').count()).toBe(1);
      expect(await page.evaluate('typeof window.__taskboardEmbedCleanup_1')).toBe('function');
    });
  });

  it('rejects real frame-src CSP blocking and removes the unusable host', async () => {
    await isolated(async (page) => {
      await page.evaluate(
        `window.__cspBlocked=false; document.addEventListener('securitypolicyviolation', e => { if(e.violatedDirective==='frame-src') window.__cspBlocked=true; });`,
      );
      await begin(page, 700, '/react', '/csp');
      expect(await result(page)).toEqual({ installed: false, reason: 'board-ready-timeout' });
      expect(await page.evaluate('window.__cspBlocked')).toBe(true);
      expect(await page.locator('[data-taskboard-owned]').count()).toBe(0);
    }, '/csp');
  });

  it('rejects a valid nonce sent from a different frame at the correct origin', async () => {
    await isolated(async (page) => {
      await loadSilent(page);
      await page.evaluate((url) => {
        const sibling = document.createElement('iframe');
        sibling.id = 'sibling';
        sibling.src = url;
        document.body.append(sibling);
      }, `${boardOrigin}/other`);
      const element = await page.locator('#sibling').elementHandle();
      const sibling = await element?.contentFrame();
      if (!sibling) throw new Error('Missing sibling');
      await sibling.waitForURL(`${boardOrigin}/other`);
      await sibling.evaluate(sendResponse(nonce, hostOrigin));
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));
      await pending(page);
      await frame(page).evaluate(sendResponse(nonce, hostOrigin));
      expect(await result(page)).toEqual({ installed: true });
    });
  });

  it('rejects the expected frame with a wrong nonce or a changed origin', async () => {
    await isolated(async (page) => {
      const child = await loadSilent(page);
      await child.evaluate(sendResponse('wrong-nonce', hostOrigin));
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));
      await pending(page);
      await child.goto(`${hostOrigin}/silent`);
      await child.evaluate(sendResponse(nonce, hostOrigin));
      await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 50)));
      await pending(page);
      await child.goto(`${boardOrigin}/silent`);
      await child.evaluate(sendResponse(nonce, hostOrigin));
      expect(await result(page)).toEqual({ installed: true });
    });
  });

  it('cancels a pending handshake and removes its cleanup hook and DOM', async () => {
    await isolated(async (page) => {
      await loadSilent(page);
      await page.evaluate('window.__taskboardEmbedCleanup_1()');
      expect(await result(page)).toEqual({ installed: false, reason: 'unloaded' });
      expect(await page.evaluate('window.__taskboardEmbedCleanup_1')).toBeUndefined();
      expect(await page.locator('[data-taskboard-owned]').count()).toBe(0);
    });
  });

  it('rejects a late valid response after same-document host navigation', async () => {
    await isolated(async (page) => {
      const child = await loadSilent(page);
      await page.evaluate(() => history.pushState({}, '', '/changed'));
      await child.evaluate(sendResponse(nonce, hostOrigin));
      expect(await result(page)).toEqual({ installed: false, reason: 'board-context-changed' });
      expect(await page.locator('[data-taskboard-owned]').count()).toBe(0);
    });
  });

  it('cannot succeed when a response is queued and its host is removed', async () => {
    await isolated(async (page) => {
      await page.evaluate(
        ({ origin, value }) => {
          // Registered before the adapter listener, this removes the host during
          // delivery of a genuine response from the expected board window.
          window.addEventListener('message', (event) => {
            if (event.origin === origin && event.data?.nonce === value)
              document.querySelector('[data-taskboard-owned]')?.remove();
          });
        },
        { origin: boardOrigin, value: nonce },
      );
      const child = await loadSilent(page);
      await child.evaluate(sendResponse(nonce, hostOrigin));
      expect(await result(page)).toMatchObject({ installed: false });
      expect(await page.locator('[data-taskboard-owned]').count()).toBe(0);
    });
  });

  it('uses explicit native entry and content markers without covering the sidebar', async () => {
    await isolated(async (page) => {
      await page.evaluate(() => {
        document.querySelector('#shell')!.innerHTML =
          '<div id="native-root" style="display:flex;width:900px;height:600px;position:relative"><nav id="native-nav" style="width:220px;display:flex;flex-direction:column"><div id="native-header" style="flex-shrink:0;padding:0 8px"><button>新聊天</button></div><div id="native-scroll" style="flex:1;min-height:0"></div></nav><section id="native-content" style="position:static;flex:1;min-width:0"><input id="native-editor"></section></div>';
      });
      await page.locator('#native-editor').focus();
      const expression = boardEmbedScript(
        `${boardOrigin}/react`,
        '#native-root',
        7,
        `${hostOrigin}/host`,
        boardOrigin,
        nonce,
        5_000,
        '#native-nav',
        '#native-content',
      );
      await page.evaluate(`window.__nativeReady = (${expression})`);
      expect(await page.locator('[data-taskboard-entry="7"]').count()).toBe(1);
      expect(await page.evaluate('window.__nativeReady')).toEqual({ installed: true });
      expect(await page.locator('#native-header [data-taskboard-entry="7"]').count()).toBe(1);
      expect(await page.locator('[data-taskboard-entry="7"]').getAttribute('aria-label')).toBe('任务看板');
      await page.locator('[data-taskboard-entry="7"]').click();
      const navBox = await page.locator('#native-nav').boundingBox();
      const contentBox = await page.locator('#native-content').boundingBox();
      const overlayBox = await page.locator('[data-taskboard-owned="7"]').boundingBox();
      expect(overlayBox!.x).toBeGreaterThanOrEqual(navBox!.x + navBox!.width);
      expect(overlayBox!.x + overlayBox!.width).toBeLessThanOrEqual(
        contentBox!.x + contentBox!.width,
      );
      expect(
        await page.locator('[data-taskboard-owned="7"]').evaluate((node) => node.style.display),
      ).toBe('flex');
      const toolbarBox = await page.locator('[data-taskboard-toolbar="7"]').boundingBox();
      const frameBox = await page.locator('[data-taskboard-owned="7"] iframe').boundingBox();
      expect(toolbarBox!.y + toolbarBox!.height).toBeLessThanOrEqual(frameBox!.y);
      await page.keyboard.press('Escape');
      expect(
        await page.locator('[data-taskboard-owned="7"]').evaluate((node) => node.style.display),
      ).toBe('none');
      await page.evaluate('window.__taskboardEmbedCleanup_7()');
      expect(await page.locator('[data-taskboard-entry="7"]').count()).toBe(0);
      expect(await page.locator('[data-taskboard-owned="7"]').count()).toBe(0);
      expect(await page.locator('#native-content').evaluate((node) => node.style.position)).toBe(
        'static',
      );
      expect(await page.evaluate('document.activeElement?.id')).toBe('native-editor');

      // Replacing an existing successful injection must keep one entry and
      // retain the original positioning value for the final cleanup.
      expect(await page.evaluate(expression)).toEqual({ installed: true });
      expect(await page.evaluate(expression)).toEqual({ installed: true });
      expect(await page.locator('[data-taskboard-entry="7"]').count()).toBe(1);
      expect(await page.locator('[data-taskboard-owned="7"]').count()).toBe(1);
      await page.locator('[data-taskboard-entry="7"]').click();
      const embeddedBoard = page.frames().find((item) => item.url() === `${boardOrigin}/react`);
      if (!embeddedBoard) throw new Error('Ready board frame disappeared');
      await embeddedBoard.locator('main').evaluate((node) => {
        node.setAttribute('tabindex', '0');
        node.focus();
      });
      expect(await page.evaluate('document.activeElement?.tagName')).toBe('IFRAME');
      await page.getByRole('button', { name: '返回 Codex', exact: true }).click();
      expect(await page.locator('[data-taskboard-owned="7"]').isVisible()).toBe(false);
      expect(
        await page.evaluate('document.activeElement?.getAttribute("data-taskboard-entry")'),
      ).toBe('7');
      await page.evaluate('window.__taskboardEmbedCleanup_7()');
      expect(await page.evaluate('document.activeElement?.id')).toBe('native-editor');
      expect(await page.locator('#native-content').evaluate((node) => node.style.position)).toBe(
        'static',
      );

      // A missing or ambiguous host marker must fail before style/DOM writes.
      for (const marker of ['#missing-root', '.duplicate-root']) {
        await page.evaluate(() => {
          document.querySelector('#native-root')?.classList.add('duplicate-root');
          const duplicate = document.createElement('div');
          duplicate.className = 'duplicate-root';
          document.body.append(duplicate);
        });
        const refused = boardEmbedScript(
          `${boardOrigin}/react`,
          marker,
          8,
          `${hostOrigin}/host`,
          boardOrigin,
          nonce,
          5000,
          '#native-nav',
          '#native-content',
        );
        expect(await page.evaluate(refused)).toMatchObject({ installed: false });
        expect(await page.locator('[data-taskboard-entry]').count()).toBe(0);
        expect(await page.locator('[data-taskboard-owned]').count()).toBe(0);
        expect(await page.locator('#native-content').evaluate((node) => node.style.position)).toBe(
          'static',
        );
      }
    });
  });
});
