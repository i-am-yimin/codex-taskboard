/** Optional synthetic MCP UI probe. Never imports task storage, auth or runners.
 * References: https://developers.openai.com/plugins/build/extensions and
 * https://developers.openai.com/plugins/build/app-quickstart */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { pathToFileURL } from 'node:url';

export const probePluginVersion = '0.0.2';
export const probeUiUri = 'ui://taskboard-compatibility/v2/synthetic.html';
export const probeUiHtml = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Taskboard 合成界面探针</title></head><body><main>
<h1>Taskboard 合成界面探针</h1>
<p>此面板仅检查宿主 UI 入口，无账号或真实任务。</p>
<p id="bridge-status" role="status">等待宿主初始化</p>
<details><summary>多人共建合成任务 · 待验收</summary>
<p>合成负责人 A；合成开发者 B；合成验收人 C。</p>
<p>展开成功只证明此界面可交互，不代表生产协作功能。</p></details>
</main><script>
(() => {
  const status = document.getElementById('bridge-status');
  if (window.parent === window) {
    status.textContent = '未连接 MCP Apps 宿主';
    return;
  }
  const protocolVersion = '2026-01-26';
  let timeout;
  const cleanup = () => {
    clearTimeout(timeout);
    window.removeEventListener('message', receive);
    window.removeEventListener('pagehide', cleanup);
  };
  const receive = event => {
    if (event.source !== window.parent) return;
    const message = event.data;
    if (!message || message.jsonrpc !== '2.0' || message.id !== 1) return;
    if (message.error || !message.result || message.result.protocolVersion !== protocolVersion) {
      status.textContent = '宿主初始化失败';
      cleanup();
      return;
    }
    // Sandboxed hosts may use an opaque origin. These messages contain only
    // synthetic capability metadata, and inbound messages require our parent.
    window.parent.postMessage({jsonrpc:'2.0', method:'ui/notifications/initialized', params:{}}, '*');
    status.textContent = '宿主桥接已就绪（合成）';
    cleanup();
  };
  window.addEventListener('message', receive);
  window.addEventListener('pagehide', cleanup);
  timeout = setTimeout(() => {
    status.textContent = '宿主初始化超时';
    cleanup();
  }, 8000);
  window.parent.postMessage({jsonrpc:'2.0', id:1, method:'ui/initialize', params:{
    appInfo:{name:'taskboard-synthetic-ui-probe',version:'${probePluginVersion}'},
    appCapabilities:{}, protocolVersion
  }}, '*');
})();
</script></body></html>`;
export function createPluginUiProbe(): McpServer {
  const server = new McpServer({
    name: 'taskboard-synthetic-ui-probe',
    version: probePluginVersion,
  });
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
          text: probeUiHtml,
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
  void server
    .connect(new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 65536 }))
    .catch(() => {
      process.stderr.write('Synthetic MCP probe failed to start\n');
      process.exitCode = 1;
    });
  process.stdin.once('end', () => {
    void server.close();
  });
}
