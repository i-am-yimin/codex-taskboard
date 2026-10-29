import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { mkdtemp, readFile, rename, rm, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createPluginUiProbe,
  probeUiHtml,
  probeUiUri,
} from '../scripts/prototypes/codex-plugin-ui.ts';
import { packagePluginUiProbe } from '../scripts/prototypes/package-codex-plugin-ui.ts';

describe('optional synthetic official UI route', () => {
  it('runs a moved installed-copy layout without repository modules and refuses overwriting it', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'taskboard-plugin-package-'));
    const output = join(directory, 'source-marketplace');
    const relocated = join(directory, '模拟插件缓存 中文路径');
    const client = new Client({ name: 'relocated-probe-client', version: '0.0.1' });
    try {
      const result = await packagePluginUiProbe(output);
      await expect(packagePluginUiProbe(output)).rejects.toThrow();
      const sourcePlugin = result.pluginRoot;
      await rename(sourcePlugin, relocated);
      const config = JSON.parse(await readFile(join(relocated, 'mcp.json'), 'utf8'));
      const server = config.mcpServers.taskboard_synthetic_ui;
      const outside = join(directory, 'unrelated-working-directory');
      await mkdir(outside);
      const transport = new StdioClientTransport({
        command: resolve(relocated, server.command),
        args: server.args.map((argument: string) =>
          argument.replaceAll('${PLUGIN_ROOT}', relocated),
        ),
        cwd: outside,
        stderr: 'pipe',
      });
      await client.connect(transport);
      expect((await client.listTools()).tools[0]._meta).toMatchObject({
        ui: { resourceUri: probeUiUri },
        'openai/ui': { entrypoints: [{ type: 'global' }, { type: 'thread' }] },
      });
      expect(
        (await client.callTool({ name: 'taskboard_synthetic_ui', arguments: {} }))
          .structuredContent,
      ).toMatchObject({ synthetic: true });
      expect((await client.readResource({ uri: probeUiUri })).contents[0]).toMatchObject({
        text: expect.stringContaining('Taskboard 合成界面探针'),
      });
    } finally {
      await client.close();
      await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  });
  it('starts as a bounded stdio MCP process without real credentials or storage', async () => {
    const client = new Client({ name: 'synthetic-stdio-client', version: '0.0.1' });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', 'scripts/prototypes/codex-plugin-ui.ts'],
      stderr: 'pipe',
    });
    try {
      await client.connect(transport);
      expect((await client.listTools()).tools).toHaveLength(1);
      expect((await client.readResource({ uri: probeUiUri })).contents[0]).toMatchObject({
        mimeType: 'text/html;profile=mcp-app',
      });
    } finally {
      await client.close();
    }
  });
  it('advertises global/thread entries and a usable resource without claiming host UI support', async () => {
    const server = createPluginUiProbe();
    const client = new Client({ name: 'synthetic-contract-client', version: '0.0.1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const result = await client.listTools();
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0]).toMatchObject({
        annotations: { readOnlyHint: true, destructiveHint: false },
        _meta: {
          ui: { resourceUri: probeUiUri },
          'openai/ui': { entrypoints: [{ type: 'global' }, { type: 'thread' }] },
        },
      });
      const resource = await client.readResource({ uri: probeUiUri });
      expect(resource.contents[0]).toMatchObject({
        mimeType: 'text/html;profile=mcp-app',
        text: expect.stringContaining('<details>'),
      });
      const call = await client.callTool({ name: 'taskboard_synthetic_ui', arguments: {} });
      expect(call.structuredContent).toMatchObject({ synthetic: true });
      expect(call.content).toContainEqual({
        type: 'text',
        text: expect.stringContaining('does not prove sidebar'),
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});

describe('synthetic MCP Apps browser handshake', () => {
  let browser: Browser;
  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });
  afterAll(async () => {
    await browser?.close();
  });

  async function mountProbe(page: Page) {
    await page.setContent('<iframe title="Synthetic MCP App"></iframe>');
    await page.evaluate((html) => {
      const frame = document.querySelector('iframe')!;
      const messages: unknown[] = [];
      window.addEventListener('message', (event) => {
        if (event.source !== frame.contentWindow) return;
        messages.push(event.data);
        document.documentElement.dataset.rpc = JSON.stringify(messages);
      });
      frame.srcdoc = html;
    }, probeUiHtml);
    await page.waitForFunction(() =>
      JSON.parse(document.documentElement.dataset.rpc ?? '[]').some(
        (message: { method?: string }) => message.method === 'ui/initialize',
      ),
    );
    return page.frameLocator('iframe');
  }

  async function reply(page: Page, result: Record<string, unknown>) {
    await page.evaluate(
      (message) => {
        document.querySelector('iframe')!.contentWindow!.postMessage(message, '*');
      },
      { jsonrpc: '2.0', id: 1, ...result },
    );
  }

  async function initializedCount(page: Page) {
    return page.evaluate(
      () =>
        JSON.parse(document.documentElement.dataset.rpc ?? '[]').filter(
          (message: { method?: string }) => message.method === 'ui/notifications/initialized',
        ).length as number,
    );
  }

  it('waits for its parent, acknowledges once, and allows the synthetic task to expand', async () => {
    const page = await browser.newPage();
    const requests: string[] = [];
    await page.route('**/*', (route) => {
      requests.push(route.request().url());
      return route.abort();
    });
    try {
      const frame = await mountProbe(page);
      const application = page.frames()[1];
      await application.evaluate(() => {
        window.postMessage(
          { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2026-01-26' } },
          '*',
        );
      });
      await page.evaluate(() => {
        document
          .querySelector('iframe')!
          .contentWindow!.postMessage(
            { jsonrpc: '2.0', id: 2, result: { protocolVersion: '2026-01-26' } },
            '*',
          );
      });
      expect(await frame.getByRole('status').textContent()).toBe('等待宿主初始化');
      expect(await initializedCount(page)).toBe(0);
      await reply(page, { result: { protocolVersion: '2026-01-26' } });
      await frame.getByRole('status').filter({ hasText: '宿主桥接已就绪（合成）' }).waitFor();
      await page.waitForFunction(() =>
        JSON.parse(document.documentElement.dataset.rpc ?? '[]').some(
          (message: { method?: string }) => message.method === 'ui/notifications/initialized',
        ),
      );
      await reply(page, { result: { protocolVersion: '2026-01-26' } });
      expect(await initializedCount(page)).toBe(1);
      await frame.locator('summary').click();
      expect(
        await frame.locator('details').evaluate((element) => (element as HTMLDetailsElement).open),
      ).toBe(true);
      expect(requests).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it.each(['rejection', 'timeout'] as const)('does not claim readiness after %s', async (mode) => {
    const page = await browser.newPage();
    try {
      await page.clock.install();
      const frame = await mountProbe(page);
      if (mode === 'rejection') {
        await reply(page, {
          error: { code: -32603, message: 'Synthetic host rejected initialization' },
        });
      } else {
        await page.clock.fastForward(8100);
      }
      const terminal = mode === 'rejection' ? '宿主初始化失败' : '宿主初始化超时';
      await frame.getByRole('status').filter({ hasText: terminal }).waitFor();
      await reply(page, { result: { protocolVersion: '2026-01-26' } });
      expect(await frame.getByRole('status').textContent()).toBe(terminal);
      expect(await initializedCount(page)).toBe(0);
    } finally {
      await page.close();
    }
  });
});
