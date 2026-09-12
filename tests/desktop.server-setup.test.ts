import { afterAll, beforeAll, describe, it } from 'vitest';
import { chromium, expect as playwrightExpect, type Browser, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';

let browser: Browser;
let server: Server;
let origin: string;
let bundle = '';

type Upstream = { upstream: string; locked: boolean; authenticated: boolean };

beforeAll(async () => {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'tsx',
      contents: `
        import React, {useState} from 'react';
        import {createRoot} from 'react-dom/client';
        import {DesktopServerSetup} from './apps/web/src/DesktopServerSetup.tsx';
        function Fixture() {
          const [ready, setReady] = useState(false);
          const [password, setPassword] = useState('secret-password');
          const [busy, setBusy] = useState(false);
          const [logins, setLogins] = useState(0);
          return <main>
            <DesktopServerSetup disabled={busy} onReadyChange={setReady} onSaved={() => setPassword('')} />
            <form onSubmit={(event) => { event.preventDefault(); if (!ready) return; setLogins((value) => value + 1); }}>
              <label>密码<input aria-label="密码" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <button type="submit">登录</button>
            </form>
            <button type="button" onClick={() => setBusy((value) => !value)}>切换忙碌</button>
            <output aria-label="登录次数">{logins}</output>
          </main>;
        }
        createRoot(document.getElementById('root')).render(<Fixture />);`,
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  bundle = result.outputFiles[0].text;
  server = createServer((_request, response) => {
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end(`<div id="root"></div><script>${bundle}</script>`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture server has no address');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

async function pageWithBridge(
  initial: Upstream,
  options: { readFails?: boolean; saveFails?: boolean } = {},
): Promise<Page> {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.__TAURI__ = { core: { invoke: async <T>() => 'fixture-capability' as T } };
  });
  let reads = 0;
  await context.route('http://127.0.0.1:47831/v1/browser/upstream', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-headers': 'content-type,x-taskboard-companion-key',
          'access-control-allow-methods': 'GET,POST',
        },
      });
      return;
    }
    if (request.method() === 'GET' && options.readFails && reads++ === 0) {
      await route.fulfill({
        status: 503,
        headers: { 'access-control-allow-origin': origin, 'content-type': 'application/json' },
        body: JSON.stringify({ error: { message: 'bridge unavailable' } }),
      });
      return;
    }
    if (request.method() === 'POST' && options.saveFails) {
      await route.fulfill({
        status: 422,
        headers: { 'access-control-allow-origin': origin, 'content-type': 'application/json' },
        body: JSON.stringify({ error: { message: 'address rejected' } }),
      });
      return;
    }
    const upstream =
      request.method() === 'POST'
        ? ((JSON.parse(request.postData() ?? '{}') as { upstream?: string }).upstream ??
          initial.upstream)
        : initial.upstream;
    await route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': origin, 'content-type': 'application/json' },
      body: JSON.stringify({ data: { ...initial, upstream } }),
    });
  });
  const page = await context.newPage();
  await page.goto(origin);
  await page.locator('#desktop-server-url').waitFor({ state: 'visible' });
  return page;
}

describe('desktop server setup', () => {
  it('blocks login while a server address has unsaved changes and clears the password after save', async () => {
    const page = await pageWithBridge({
      upstream: 'https://saved.example',
      locked: false,
      authenticated: false,
    });
    try {
      await page.locator('#desktop-server-url').fill('https://next.example');
      await page.getByRole('button', { name: '登录' }).click();
      await playwrightExpect(page.getByLabel('登录次数')).toHaveText('0');
      await playwrightExpect(page.getByLabel('密码')).toHaveValue('secret-password');
      await page.getByRole('button', { name: '保存服务器' }).click();
      await playwrightExpect(page.getByText('服务器地址已保存。现在可以登录。')).toBeVisible();
      await playwrightExpect(page.getByLabel('密码')).toHaveValue('');
      await page.getByRole('button', { name: '登录' }).click();
      await playwrightExpect(page.getByLabel('登录次数')).toHaveText('1');
    } finally {
      await page.context().close();
    }
  });

  it('keeps login available when an agent session locks server changes', async () => {
    const page = await pageWithBridge({
      upstream: 'https://saved.example',
      locked: false,
      authenticated: true,
    });
    try {
      await playwrightExpect(
        page.getByText('此设备已有登录会话。退出当前设备后才能更改服务器。'),
      ).toBeVisible();
      await playwrightExpect(page.locator('#desktop-server-url')).toBeDisabled();
      await page.getByRole('button', { name: '登录' }).click();
      await playwrightExpect(page.getByLabel('登录次数')).toHaveText('1');
    } finally {
      await page.context().close();
    }
  });

  it('keeps login ready for whitespace-only address edits but blocks a real address change', async () => {
    const page = await pageWithBridge({
      upstream: 'https://saved.example',
      locked: false,
      authenticated: false,
    });
    try {
      await page.locator('#desktop-server-url').fill('https://saved.example ');
      await page.getByRole('button', { name: '登录' }).click();
      await playwrightExpect(page.getByLabel('登录次数')).toHaveText('1');
      await page.locator('#desktop-server-url').fill('https://changed.example');
      await page.getByRole('button', { name: '登录' }).click();
      await playwrightExpect(page.getByLabel('登录次数')).toHaveText('1');
    } finally {
      await page.context().close();
    }
  });

  it('offers a retry after bridge read failure and preserves an address after save failure', async () => {
    const page = await pageWithBridge(
      { upstream: 'https://saved.example', locked: false, authenticated: false },
      { readFails: true, saveFails: true },
    );
    try {
      await playwrightExpect(page.getByText('bridge unavailable')).toBeVisible();
      await page.getByRole('button', { name: '重试' }).click();
      await page.locator('#desktop-server-url').fill('https://rejected.example');
      await page.getByRole('button', { name: '保存服务器' }).click();
      await playwrightExpect(page.getByText('address rejected')).toBeVisible();
      await playwrightExpect(page.locator('#desktop-server-url')).toHaveValue(
        'https://rejected.example',
      );
    } finally {
      await page.context().close();
    }
  });

  it('disables server editing while its parent login flow is busy', async () => {
    const page = await pageWithBridge({
      upstream: 'https://saved.example',
      locked: false,
      authenticated: false,
    });
    try {
      await page.locator('#desktop-server-url').fill('https://next.example');
      await page.getByRole('button', { name: '切换忙碌' }).click();
      await playwrightExpect(page.locator('#desktop-server-url')).toBeDisabled();
      await playwrightExpect(page.getByRole('button', { name: '保存服务器' })).toBeDisabled();
    } finally {
      await page.context().close();
    }
  });
});
