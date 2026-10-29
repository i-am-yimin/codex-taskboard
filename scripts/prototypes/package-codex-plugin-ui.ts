/** Builds a synthetic, relocatable local plugin, without installing it or
 * changing any Codex home. See docs/codex-plugin-ui-probe.md. */
import { build } from 'esbuild';
import { chmod, copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const probePluginName = 'taskboard-synthetic-ui-probe';
export const probeMarketplaceName = 'taskboard-synthetic-ui';

export async function packagePluginUiProbe(outputDirectory: string, nodePath = process.execPath) {
  if (!isAbsolute(outputDirectory) || !isAbsolute(nodePath))
    throw new Error('Use absolute output and Node runtime paths for the local probe');
  const output = resolve(outputDirectory);
  // Exclusive creation prevents accidental replacement of a marketplace/cache.
  await mkdir(output);
  const pluginRoot = join(output, 'plugins', probePluginName);
  await mkdir(join(pluginRoot, 'server'), { recursive: true });
  await mkdir(join(pluginRoot, 'runtime'));
  const runtimeName = process.platform === 'win32' ? 'node.exe' : 'node';
  await copyFile(nodePath, join(pluginRoot, 'runtime', runtimeName));
  await chmod(join(pluginRoot, 'runtime', runtimeName), (await stat(nodePath)).mode & 0o777);
  await mkdir(join(output, '.agents', 'plugins'), { recursive: true });
  const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
  await build({
    stdin: {
      contents: `import { createPluginUiProbe } from './scripts/prototypes/codex-plugin-ui.ts';
        import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
        const server = createPluginUiProbe();
        server.connect(new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 65536 }))
          .catch(() => { process.stderr.write('Synthetic MCP probe failed to start\\n'); process.exitCode = 1; });
        process.stdin.once('end', () => { void server.close(); });`,
      resolveDir: repositoryRoot,
      sourcefile: 'synthetic-plugin-entry.ts',
      loader: 'ts',
    },
    outfile: join(pluginRoot, 'server', 'index.cjs'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    legalComments: 'none',
    logLevel: 'silent',
  });
  const manifest = {
    $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
    name: probePluginName,
    version: '0.0.1',
    description:
      'Synthetic read-only Taskboard global/thread UI compatibility probe. No real data.',
    license: 'MIT',
    extensions: {
      'com.openai': {
        requires_local_executor: true,
        interface: {
          displayName: 'Taskboard 合成 UI 探针',
          shortDescription: '仅验证全局与会话 UI 入口，无真实任务',
          developerName: 'Codex Taskboard',
          category: 'Productivity',
          capabilities: ['Read'],
        },
      },
    },
  };
  const mcp = {
    $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
    mcpServers: {
      taskboard_synthetic_ui: {
        type: 'stdio',
        command: `./runtime/${runtimeName}`,
        args: ['${PLUGIN_ROOT}/server/index.cjs'],
        cwd: '${PLUGIN_ROOT}',
      },
    },
  };
  const marketplace = {
    name: probeMarketplaceName,
    interface: { displayName: 'Taskboard 合成验收' },
    plugins: [
      {
        name: probePluginName,
        source: { source: 'local', path: `./plugins/${probePluginName}` },
        policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
        category: 'Productivity',
      },
    ],
  };
  for (const [path, value] of [
    [join(pluginRoot, 'plugin.json'), manifest],
    [join(pluginRoot, 'mcp.json'), mcp],
    [join(output, '.agents', 'plugins', 'marketplace.json'), marketplace],
  ] as const)
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  return {
    outputDirectory: output,
    pluginRoot,
    pluginName: probePluginName,
    marketplaceName: probeMarketplaceName,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2])
    throw new Error('Usage: package-codex-plugin-ui.ts <new absolute output directory>');
  console.log(JSON.stringify(await packagePluginUiProbe(process.argv[2])));
}
