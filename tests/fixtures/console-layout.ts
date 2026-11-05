import type { Page } from '@playwright/test';
import { demoUser, makeDemoBoard } from '../../apps/web/src/demo';
import { defaultAppearance } from '../../packages/core/src/index';

export async function consoleFixture(
  page: Page,
  origin: string,
  options: { desktop?: boolean; theme?: string; mode?: string } = {},
) {
  const user = {
    ...demoUser,
    name: '用于验证多端显示效果的很长中文账号名称',
    email: 'long-account-name-for-layout@example.test',
  };
  const board = makeDemoBoard();
  board.members = board.members.map((m) => (m.id === user.id ? { ...m, ...user } : m));
  // Plain JS keeps tsx's name-preservation helpers out of the browser realm.
  await page.addInitScript(`
    if (${Boolean(options.desktop)}) {
      window.__TAURI__ = { core: { invoke: async (command) =>
        command === 'bridge_capability' ? 'synthetic-layout-key' :
        { state: 'not-running', reason: '合成验收环境未启动 Codex' } } };
    }
    class LayoutEvents extends EventTarget {
      readyState = 1;
      onerror = null;
      constructor() {
        super();
        setTimeout(() => this.dispatchEvent(new Event('ready')), 0);
      }
      close() { this.readyState = 2; }
    }
    Object.defineProperty(window, 'EventSource', { value: LayoutEvents });
  `);
  const profile = {
    ...user,
    version: 1,
    avatarVersion: 0,
    hasAvatar: false,
    emailVerified: false,
    contacts: Object.fromEntries(
      ['phone', 'wechat', 'qq'].map((k) => [k, { value: '', visibility: 'private' }]),
    ),
  };
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
    if (url.origin !== origin && url.origin !== 'http://127.0.0.1:47831') return route.abort();
    const path = url.pathname.replace(/^\/api\/v1/, '');
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-headers':
            route.request().headers()['access-control-request-headers'] ?? '*',
          'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
        },
      });
    let data: unknown = [];
    if (path === '/v1/browser/identity') data = { upstream: origin, accountId: user.id };
    else if (path === '/v1/browser/me' || path === '/me') data = user;
    else if (path === '/setup') data = { required: false };
    else if (path === '/health')
      data = {
        status: 'ok',
        database: 'ok',
        serverVersion: '0.1.5-preview.1',
        apiVersion: 1,
        capabilities: { collaborativeWorkflows: 1, accountCenter: 1 },
        migrationRequired: false,
      };
    else if (path === '/spaces') data = [board.space];
    else if (path.endsWith('/board')) data = board;
    else if (path === '/devices')
      data = [
        {
          id: 'layout-device',
          name: '布局验收浏览器',
          current: true,
          createdAt: '2026-11-02T00:00:00.000Z',
          lastActiveAt: '2026-11-02T00:00:00.000Z',
        },
      ];
    else if (path === '/me/profile') data = profile;
    else if (path === '/me/appearance')
      data = {
        ...defaultAppearance,
        themeId: options.theme ?? 'glass',
        mode: options.mode ?? 'light',
        version: 1,
      };
    else if (path === '/me/notifications' || path === '/me/tasks')
      data = { items: [], nextCursor: null };
    else if (path === '/admin/instance')
      data = {
        publicOrigin: origin,
        logLevel: 'info',
        originLocked: false,
        version: '0.1.5-preview.1',
        uptimeSeconds: 86400,
        sessionKeyConfigured: true,
        database: {
          host: 'db',
          port: 5432,
          name: 'taskboard',
          user: 'taskboard',
          managed: true,
          passwordConfigured: true,
          status: 'ok',
        },
      };
    else if (path === '/admin/logs') data = { entries: [] };
    else if (path === '/admin/smtp') data = { configured: false, locked: false, keyReady: true };
    else if (path === '/admin/secrets/reveal')
      data = { databasePassword: 'synthetic-db-secret', sessionKey: 'synthetic-session-secret' };
    else if (path.endsWith('/avatar'))
      return route.fulfill({
        status: 404,
        json: { error: { code: 'NOT_FOUND', message: 'Synthetic avatar absent' } },
      });
    return route.fulfill({
      json: { data },
      headers: {
        'cache-control': 'no-store',
        'access-control-allow-origin': origin,
        'access-control-allow-headers': '*',
      },
    });
  });
  return { user, board, origin };
}
