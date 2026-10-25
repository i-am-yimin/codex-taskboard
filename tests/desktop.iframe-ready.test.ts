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
      contents: `import React from 'react';
        import {createRoot} from 'react-dom/client';
        import {useEmbeddedReadyResponder} from './apps/web/src/embeddedReady';
        function Board() { useEmbeddedReadyResponder();
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
        response.end(request.url === '/native'
          ? '<div id="shell"><nav id="sidebar"></nav><main id="content"></main></div>'
          : '<main id="shell"></main>');
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
async function installNativeBoard(page: Page) {
  await page.evaluate(() => {
    document.querySelector('#sidebar')!.innerHTML = `
      <button id="new-chat">新聊天</button>
      <button id="project" data-app-action-sidebar-project-id="test-project">项目</button>
      <a id="chat" href="#chat" aria-current="page"><span>已有会话</span></a>
      <button id="other-chat">其他会话</button>`;
    document.querySelector('#content')!.innerHTML = '<input id="chat-draft" value="未发送草稿">';
    document.querySelector<HTMLInputElement>('#chat-draft')!.focus();
    document.querySelector('#chat')!.addEventListener('click', (event) => event.preventDefault());
  });
  expect(await page.evaluate(boardEmbedScript(
    `${boardOrigin}/react`, '#shell', 9, `${hostOrigin}/native`,
    boardOrigin, nonce, 5000, '#sidebar', '#content',
  ))).toEqual({ installed: true });
  return {
    entry: page.locator('[data-taskboard-entry="9"]'),
    overlay: page.locator('[data-taskboard-owned="9"]'),
  };
}
async function installPeerBoard(page: Page, workspaceMarker = '#workspace') {
  await page.evaluate(() => {
    document.querySelector('#shell')!.innerHTML = `
      <div id="window-controls">窗口操作</div>
      <div id="peer-root" style="display:flex;width:900px;height:600px;position:relative">
        <nav id="sidebar" style="width:220px;flex:none">
          <button id="new-chat">新聊天</button>
          <button id="chat" aria-current="page" aria-selected="true"
            data-app-action-sidebar-thread-active="true" style="background:rgb(100,100,100)">已有会话</button>
        </nav>
        <section id="workspace" style="display:contents" aria-hidden="false">
          <header id="thread-toolbar" style="position:fixed;left:228px;top:26px;width:680px;height:52px;z-index:30">
            <h1>原会话标题</h1><button>会话操作</button>
          </header>
          <main id="content" style="display:flex;flex:1;min-width:0;position:relative;isolation:isolate">
            <input id="chat-draft" value="保留的会话草稿">
          </main>
        </section>
      </div>`;
    document.querySelector<HTMLInputElement>('#chat-draft')!.focus();
  });
  const expression = boardEmbedScript(
    `${boardOrigin}/react`, '#peer-root', 17, `${hostOrigin}/native`,
    boardOrigin, nonce, 5000, '#sidebar', '#content', workspaceMarker,
  );
  const installed = await page.evaluate(expression);
  return { installed, entry: page.locator('[data-taskboard-entry="17"]'),
    board: page.locator('[data-taskboard-owned="17"]') };
}
const sendResponse = (value: string, target: string) =>
  `parent.postMessage({type:'taskboard:ready-response',nonce:${JSON.stringify(value)}},${JSON.stringify(target)})`;

describe('iframe readiness in real Chromium', () => {
  it('switches the complete conversation workspace and board as peers with one current navigation item', async () => {
    await isolated(async (page) => {
      const { installed, entry, board } = await installPeerBoard(page);
      expect(installed).toEqual({ installed: true });
      const originalWorkspace = await page.locator('#workspace').elementHandle();
      const originalEditor = await page.locator('#chat-draft').elementHandle();
      const originalFrame = await board.locator('iframe').elementHandle();
      if (!originalWorkspace || !originalEditor || !originalFrame) throw new Error('Missing peer fixtures');
      await entry.click();
      expect(await page.locator('#thread-toolbar').isVisible()).toBe(false);
      expect(await page.locator('#content').isVisible()).toBe(false);
      expect(await page.locator('#workspace').getAttribute('aria-hidden')).toBe('true');
      expect(await page.locator('#workspace').evaluate((node) => (node as HTMLElement).inert)).toBe(true);
      expect(await board.evaluate((node) => node.parentElement?.id)).toBe('peer-root');
      expect(await board.isVisible()).toBe(true);
      expect(await page.locator('#window-controls').isVisible()).toBe(true);
      expect(await entry.getAttribute('aria-current')).toBe('page');
      expect(await page.locator('#sidebar [aria-current="page"]').count()).toBe(1);
      expect(await page.locator('#chat').getAttribute('aria-selected')).toBe('false');
      expect(await page.locator('#chat').getAttribute('data-app-action-sidebar-thread-active')).toBe('true');
      expect(await page.locator('#chat').evaluate((node) => getComputedStyle(node).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
      const boardBox = await board.boundingBox();
      const navBox = await page.locator('#sidebar').boundingBox();
      expect(boardBox!.x).toBeGreaterThanOrEqual(navBox!.x + navBox!.width);
      expect(boardBox!.width).toBe(680);
      expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.tagName,
        { x: boardBox!.x + 100, y: boardBox!.y + 15 })).toBe('IFRAME');
      // Re-selecting a current page does not turn navigation into a toggle.
      await entry.click();
      expect(await board.isVisible()).toBe(true);
      await page.locator('#chat').click();
      expect(await board.isVisible()).toBe(false);
      expect(await page.locator('#thread-toolbar').isVisible()).toBe(true);
      expect(await entry.getAttribute('aria-current')).toBeNull();
      expect(await page.locator('#chat').getAttribute('aria-current')).toBe('page');
      expect(await page.locator('#chat').getAttribute('aria-selected')).toBe('true');
      expect(await page.locator('#workspace').getAttribute('aria-hidden')).toBe('false');
      expect(await page.locator('#workspace').evaluate((node) => (node as HTMLElement).inert)).toBe(false);
      expect(await originalWorkspace.evaluate((node) => node === document.querySelector('#workspace'))).toBe(true);
      expect(await originalEditor.evaluate((node) => node === document.querySelector('#chat-draft'))).toBe(true);
      expect(await originalFrame.evaluate((node) => node.isConnected)).toBe(true);
      expect(await page.locator('#chat-draft').inputValue()).toBe('保留的会话草稿');
      await entry.click();
      await page.evaluate('window.__taskboardEmbedCleanup_17()');
      expect(await page.locator('#workspace').getAttribute('style')).toBe('display: contents;');
      expect(await page.locator('#workspace').getAttribute('aria-hidden')).toBe('false');
      expect(await page.locator('#workspace').evaluate((node) => (node as HTMLElement).inert)).toBe(false);
      expect(await page.locator('[data-taskboard-suspended-current]').count()).toBe(0);
      expect(await page.locator('[data-taskboard-style]').count()).toBe(0);
      expect(await page.locator('#chat').getAttribute('aria-current')).toBe('page');
      expect(await page.locator('#chat').evaluate((node) => getComputedStyle(node).backgroundColor)).toBe('rgb(100, 100, 100)');
    }, '/native');
  });

  it('does not expose a background workspace when it streams new fixed toolbars or refreshes the same current item', async () => {
    await isolated(async (page) => {
      const { entry, board } = await installPeerBoard(page);
      await entry.click();
      await page.evaluate(() => {
        const toolbar = document.createElement('header');toolbar.id = 'streamed-toolbar';
        toolbar.style.cssText = 'position:fixed;inset:0;background:red';
        document.querySelector('#workspace')!.append(toolbar);
        document.querySelector('#chat')!.setAttribute('aria-current', 'page');
        document.querySelector('#chat')!.setAttribute('aria-selected', 'true');
      });
      await page.waitForFunction(() => document.querySelector('#chat')!.getAttribute('aria-current') === 'false');
      expect(await board.isVisible()).toBe(true);
      expect(await page.locator('#streamed-toolbar').isVisible()).toBe(false);
      expect(await page.locator('#sidebar [aria-current="page"]').count()).toBe(1);
      await page.evaluate(() => {
        document.querySelector('#chat')!.removeAttribute('aria-current');
        document.querySelector('#chat')!.setAttribute('aria-selected', 'false');
        document.querySelector('#chat')!.setAttribute('data-app-action-sidebar-thread-active', 'false');
        const next = document.createElement('button');next.id='next-chat';
        next.setAttribute('aria-current','page');document.querySelector('#sidebar')!.append(next);
      });
      await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-taskboard-owned]')!.style.display === 'none');
      expect(await page.locator('#chat').getAttribute('aria-current')).toBeNull();
      expect(await page.locator('#chat').getAttribute('aria-selected')).toBe('false');
      expect(await page.locator('#next-chat').getAttribute('aria-current')).toBe('page');
      expect(await page.locator('#workspace').evaluate((node) => (node as HTMLElement).inert)).toBe(false);
    }, '/native');
  });

  it('restores suspended native state if the workspace is removed while the board is active', async () => {
    await isolated(async (page) => {
      const { entry, board } = await installPeerBoard(page);
      const workspace = await page.locator('#workspace').elementHandle();
      if (!workspace) throw new Error('Missing workspace');
      await entry.click();
      await workspace.evaluate((node) => node.remove());
      await page.waitForFunction(() => !document.querySelector('[data-taskboard-owned]'));
      expect(await board.count()).toBe(0);
      expect(await entry.count()).toBe(0);
      expect(await workspace.evaluate((node) => ({display:node.style.display,inert:(node as HTMLElement).inert,hidden:node.getAttribute('aria-hidden')}))).toEqual({display:'contents',inert:false,hidden:'false'});
      expect(await page.locator('#chat').getAttribute('aria-current')).toBe('page');
      expect(await page.locator('[data-taskboard-style]').count()).toBe(0);
    }, '/native');
  });

  it('preserves newer native visibility changes when returning from the board', async () => {
    await isolated(async (page) => {
      const { entry, board } = await installPeerBoard(page);
      await entry.click();
      await page.locator('#workspace').evaluate((node) => node.style.setProperty('display', 'grid', 'important'));
      await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-taskboard-owned]')!.style.display === 'none');
      expect(await board.isVisible()).toBe(false);
      await page.evaluate('window.__taskboardEmbedCleanup_17()');
      expect(await page.locator('#workspace').evaluate((node) => [node.style.display, node.style.getPropertyPriority('display')])).toEqual(['grid', 'important']);
      expect(await page.locator('#workspace').getAttribute('aria-hidden')).toBe('false');
      expect(await page.locator('#workspace').evaluate((node) => (node as HTMLElement).inert)).toBe(false);
      expect(await page.locator('#chat').getAttribute('aria-current')).toBe('page');
    }, '/native');
  });

  it.each(['#missing-workspace', '#workspace, #content', '#peer-root', '#sidebar'])(
    'refuses an unverified complete workspace %s before altering native state', async (workspaceMarker) => {
      await isolated(async (page) => {
        const { installed } = await installPeerBoard(page, workspaceMarker);
        expect(installed).toMatchObject({ installed: false });
        expect(await page.locator('[data-taskboard-owned]').count()).toBe(0);
        expect(await page.locator('#workspace').getAttribute('aria-hidden')).toBe('false');
        expect(await page.locator('#chat').getAttribute('aria-current')).toBe('page');
      }, '/native');
    },
  );

  it('dismisses the board for native chat/project clicks and keyboard activation without stealing focus', async () => {
    await isolated(async (page) => {
      const { entry, overlay } = await installNativeBoard(page);
      const child = page.frames().find((item) => item.url() === `${boardOrigin}/react`)!;
      await child.locator('main').evaluate((node) => {
        const input = document.createElement('input');
        input.id = 'board-draft';
        input.value = '未保存的任务';
        node.append(input);
      });
      for (const target of ['#chat span', '#other-chat', '#new-chat', '#project']) {
        await entry.click();
        expect(await overlay.isVisible()).toBe(true);
        await child.locator('#board-draft').focus();
        expect(await overlay.isVisible()).toBe(true);
        await page.locator(target).click();
        expect(await overlay.isVisible()).toBe(false);
        expect(await entry.getAttribute('aria-pressed')).toBe('false');
        expect(await entry.getAttribute('title')).toBe('打开任务看板');
        expect(await entry.evaluate((node) => node === document.activeElement)).toBe(false);
        expect(await page.locator('#chat-draft').inputValue()).toBe('未发送草稿');
        expect(await child.locator('#board-draft').inputValue()).toBe('未保存的任务');
      }
      await entry.click();
      await page.locator('#other-chat').focus();
      await page.keyboard.press('Enter');
      expect(await overlay.isVisible()).toBe(false);
      expect(await page.locator('#other-chat').evaluate(
        (node) => node === document.activeElement,
      )).toBe(true);
      await entry.click();
      await page.locator('#new-chat').focus();
      await page.keyboard.press('Space');
      expect(await overlay.isVisible()).toBe(false);
      expect(await page.locator('#new-chat').evaluate(
        (node) => node === document.activeElement,
      )).toBe(true);
      expect(await page.locator('iframe').count()).toBe(1);
    }, '/native');
  });

  it('dismisses for host selection changes without a URL change, while ignoring unrelated sidebar updates', async () => {
    await isolated(async (page) => {
      const { entry, overlay } = await installNativeBoard(page);
      await entry.click();
      await page.evaluate(() => {
        document.querySelector('#project')!.setAttribute('aria-expanded', 'true');
        document.querySelector('#chat span')!.textContent = '会话标题更新';
        document.querySelector('#chat')!.setAttribute('aria-current', 'page');
      });
      expect(await overlay.isVisible()).toBe(true);
      await page.evaluate(() => {
        document.querySelector('#chat')!.removeAttribute('aria-current');
        document.querySelector('#other-chat')!.setAttribute('aria-current', 'page');
        (document.querySelector('#chat-draft') as HTMLInputElement).focus();
      });
      await page.waitForFunction(() =>
        document.querySelector<HTMLElement>('[data-taskboard-owned]')!.style.display === 'none');
      expect(await entry.getAttribute('aria-pressed')).toBe('false');
      expect(await page.locator('#chat-draft').evaluate(
        (node) => node === document.activeElement,
      )).toBe(true);
      expect(page.url()).toBe(`${hostOrigin}/native`);
      await entry.click();
      await page.evaluate(() => {
        const chat = document.createElement('button');
        chat.id = 'added-chat';
        chat.setAttribute('aria-selected', 'true');
        chat.textContent = '新增的会话';
        document.querySelector('#sidebar')!.append(chat);
      });
      await page.waitForFunction(() =>
        document.querySelector<HTMLElement>('[data-taskboard-owned]')!.style.display === 'none');
      await entry.click();
      await page.locator('#added-chat').click();
      expect(await overlay.isVisible()).toBe(false);
    }, '/native');
  });

  it('dismisses for same-document host navigation and removes navigation hooks on cleanup', async () => {
    await isolated(async (page) => {
      const { entry, overlay } = await installNativeBoard(page);
      for (const method of ['pushState', 'replaceState'] as const) {
        await entry.click();
        await page.evaluate((method) => history[method]({}, '', `#${method}`), method);
        expect(await overlay.isVisible()).toBe(false);
      }
      for (const event of ['popstate', 'hashchange']) {
        await entry.click();
        await page.evaluate((event) => window.dispatchEvent(new Event(event)), event);
        expect(await overlay.isVisible()).toBe(false);
      }
      const removedHost = await overlay.elementHandle();
      const removedEntry = await entry.elementHandle();
      if (!removedHost || !removedEntry) throw new Error('Expected installed native board');
      await page.evaluate('window.__taskboardEmbedCleanup_9()');
      expect(await entry.count()).toBe(0);
      expect(await overlay.count()).toBe(0);
      expect(await page.locator('#content').evaluate((node) => node.style.position)).toBe('');
      // Retain detached nodes so leaked listeners/observers remain observable.
      await removedHost.evaluate((node) => { node.style.display = 'flex'; });
      await removedEntry.evaluate((node) =>
        node.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      expect(await removedHost.evaluate((node) => node.style.display)).toBe('flex');
      await page.evaluate(() => {
        history.replaceState({}, '', '/native');
        document.querySelector('#other-chat')!.setAttribute('aria-selected', 'true');
        window.dispatchEvent(new Event('popstate'));
        window.dispatchEvent(new Event('hashchange'));
      });
      await page.locator('#other-chat').click();
      expect(await removedHost.evaluate((node) => node.style.display)).toBe('flex');
      const installed = await installNativeBoard(page);
      await installed.entry.click();
      expect(await installed.overlay.isVisible()).toBe(true);
      await page.locator('#other-chat').click();
      expect(await installed.overlay.isVisible()).toBe(false);
      expect(await page.locator('iframe').count()).toBe(1);
    }, '/native');
  });

  it.each(['active', 'selected'])(
    'dismisses when the observed native thread %s marker changes without a click or URL change',
    async (state) => {
      await isolated(async (page) => {
        const { entry, overlay } = await installNativeBoard(page);
        const marker = `data-app-action-sidebar-thread-${state}`;
        await page.locator('#other-chat').evaluate((node, marker) => {
          node.setAttribute(marker, 'false');
        }, marker);
        await entry.click();
        await page.locator('#other-chat').evaluate((node, marker) => {
          node.setAttribute(marker, 'false');
        }, marker);
        expect(await overlay.isVisible()).toBe(true);
        await page.locator('#other-chat').evaluate((node, marker) => {
          node.setAttribute(marker, 'true');
        }, marker);
        await page.waitForFunction(() =>
          document.querySelector<HTMLElement>('[data-taskboard-owned]')!.style.display === 'none',
        undefined, { timeout: 2000 });
        expect(await entry.getAttribute('aria-pressed')).toBe('false');
        expect(page.url()).toBe(`${hostOrigin}/native`);
        await entry.click();
        await page.evaluate((marker) => {
          const selected = document.createElement('div');
          selected.setAttribute('role', 'button');
          selected.setAttribute(marker, 'true');
          document.querySelector('#sidebar')!.append(selected);
        }, marker);
        await page.waitForFunction(() =>
          document.querySelector<HTMLElement>('[data-taskboard-owned]')!.style.display === 'none',
        undefined, { timeout: 2000 });
      }, '/native');
    },
  );

  it('commits readiness in a hidden native sidebar before first paint and again after reload', async () => {
    await isolated(async (page) => {
      for (let round = 0; round < 2; round += 1) {
        if (round) await page.reload();
        const expression = boardEmbedScript(`${boardOrigin}/react`, '#shell', 1,
          `${hostOrigin}/native`, boardOrigin, nonce, 5000, '#sidebar', '#content');
        expect(await page.evaluate(expression)).toEqual({ installed: true });
        expect(await page.locator('[data-taskboard-owned]').isVisible()).toBe(false);
        expect(await page.locator('[data-taskboard-entry]').getAttribute('aria-pressed')).toBe('false');
        const board = page.frames().find(frame => frame.url() === `${boardOrigin}/react`);
        expect(await board?.locator('[data-react-board]').count()).toBe(1);
      }
    }, '/native');
  });

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
      const contentBox = await page.locator('#native-content').boundingBox();
      await page.locator('[data-taskboard-entry="7"]').click();
      const navBox = await page.locator('#native-nav').boundingBox();
      const overlayBox = await page.locator('[data-taskboard-owned="7"]').boundingBox();
      expect(overlayBox!.x).toBeGreaterThanOrEqual(navBox!.x + navBox!.width);
      expect(overlayBox!.x + overlayBox!.width).toBeLessThanOrEqual(
        contentBox!.x + contentBox!.width,
      );
      expect(
        await page.locator('[data-taskboard-owned="7"]').evaluate((node) => node.style.display),
      ).toBe('flex');
      const frameBox = await page.locator('[data-taskboard-owned="7"] iframe').boundingBox();
      expect(frameBox!.y).toBe(overlayBox!.y);
      expect(await page.locator('[data-taskboard-entry="7"]').getAttribute('aria-pressed')).toBe(
        'true',
      );
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
      // leave the native view's original layout intact after cleanup.
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
      await page.locator('[data-taskboard-entry="7"]').click();
      expect(await page.locator('[data-taskboard-owned="7"]').isVisible()).toBe(true);
      await page.locator('#native-header button').first().click();
      expect(await page.locator('[data-taskboard-owned="7"]').isVisible()).toBe(false);
      expect(await page.locator('[data-taskboard-entry="7"]').getAttribute('aria-pressed')).toBe(
        'false',
      );
      expect(await page.locator('#native-header button').first().evaluate((node) => node === document.activeElement)).toBe(true);
      await page.locator('[data-taskboard-entry="7"]').focus();
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
