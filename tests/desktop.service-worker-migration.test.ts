import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';

const oldShell = '<!doctype html><title>Taskboard</title><main>old shell</main><script>navigator.serviceWorker.register("/sw.js")</script>';
const newShell = '<!doctype html><title>Taskboard</title><main>current shell</main>';
const oldWorker = `
  self.addEventListener('install', event => event.waitUntil((async () => {
    const cache = await caches.open('taskboard-shell-v1');
    await cache.put('/', new Response(${JSON.stringify(oldShell)}, { headers: { 'content-type': 'text/html' } }));
    await self.skipWaiting();
  })()));
  self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
  self.addEventListener('fetch', event => {
    if (event.request.mode === 'navigate')
      event.respondWith(caches.open('taskboard-shell-v1').then(cache => cache.match('/')));
  });`;

let browser: Browser;
let server: Server;
let origin: string;
let currentWorker: string;
let upgraded = false;

beforeAll(async () => {
  currentWorker = await readFile('apps/web/public/sw.js', 'utf8');
  server = createServer((request, response) => {
    response.setHeader('content-type', request.url === '/sw.js' ? 'text/javascript' : 'text/html');
    response.end(request.url === '/sw.js' ? (upgraded ? currentWorker : oldWorker) : upgraded ? newShell : oldShell);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server address');
  origin = `http://tauri.localhost:${address.port}`;
  browser = await chromium.launch({
    headless: true,
    args: ['--host-resolver-rules=MAP tauri.localhost 127.0.0.1', '--no-proxy-server'],
  });
});

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve) => {
    server?.close(() => resolve());
    server?.closeAllConnections();
  });
});

describe('desktop service worker upgrade', () => {
  it('retires a stale shell cache while retaining local drafts', async () => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto(origin);
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
      await page.reload();
      expect(await page.locator('main').textContent()).toBe('old shell');
      await page.evaluate(() => localStorage.setItem('tb:draft:test', 'preserved draft'));

      upgraded = true;
      await page.reload();
      await page.waitForFunction(async () =>
        document.querySelector('main')?.textContent === 'current shell' &&
        (await navigator.serviceWorker.getRegistrations()).length === 0,
      );
      expect(await page.evaluate(() => localStorage.getItem('tb:draft:test'))).toBe('preserved draft');
    } finally {
      await context.close();
    }
  });
});
