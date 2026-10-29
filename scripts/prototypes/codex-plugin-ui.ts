/** Optional synthetic MCP UI probe. Never imports task storage, auth or runners.
 * References: https://developers.openai.com/plugins/build/extensions and
 * https://developers.openai.com/plugins/build/app-quickstart */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { pathToFileURL } from 'node:url';

export const probeUiUri = 'ui://taskboard-compatibility/synthetic.html';
export function createPluginUiProbe(): McpServer {
  const server = new McpServer({ name: 'taskboard-synthetic-ui-probe', version: '0.0.1' });
  server.registerResource(
    'taskboard-synthetic-ui',
    probeUiUri,
    {
      title: 'Taskboard UI compatibility probe (synthetic)',
      mimeType: 'text/html;profile=mcp-app',
    },
    async () => ({
      contents: [
        {
          uri: probeUiUri,
          mimeType: 'text/html;profile=mcp-app',
          text: `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Taskboard 合成界面探针</title><main><h1>Taskboard 合成界面探针</h1><p>此面板仅检查宿主 UI 入口，无账号或真实任务。</p><details><summary>多人共建合成任务 · 待验收</summary><p>合成负责人 A；合成开发者 B；合成验收人 C。</p><p>展开成功只证明此界面可交互，不代表生产协作功能。</p></details></main></html>`,
        },
      ],
    }),
  );
  server.registerTool(
    'taskboard_synthetic_ui',
    {
      title: 'Taskboard synthetic UI probe',
      description:
        'Open a synthetic read-only Taskboard UI compatibility probe. No real account or tasks.',
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: probeUiUri },
        'openai/ui': { entrypoints: [{ type: 'global' }, { type: 'thread' }] },
      },
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: 'Synthetic UI probe only. Tool discovery does not prove sidebar or panel support.',
        },
      ],
      structuredContent: {
        synthetic: true,
        tasks: [{ id: 'synthetic-1', title: '多人共建合成任务', status: 'in_review' }],
      },
    }),
  );
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const server = createPluginUiProbe();
  await server.connect(
    new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 65536 }),
  );
  process.stdin.once('end', () => {
    void server.close();
  });
}
