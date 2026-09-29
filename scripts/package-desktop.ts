import { access, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, relative } from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();
const runtime = join(root, 'apps', 'desktop', 'runtime');
const companion = join(root, 'dist', 'companion.js');
const taskctl = join(root, 'dist', 'taskctl.js');
const node = process.env.TASKBOARD_BUNDLED_NODE ?? join(dirname(process.execPath), 'node.exe');

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
function withinWorkspace(path: string): boolean {
  const value = relative(resolve(root), resolve(path));
  return Boolean(value) && !value.startsWith('..') && !value.includes(':');
}
async function main(): Promise<void> {
  if (!(await exists(companion)) || !(await exists(taskctl)))
    throw new Error('缺少 dist/companion.js 或 dist/taskctl.js。先运行 pnpm build。');
  if (!(await exists(join(root, 'dist', 'web', 'index.html'))))
    throw new Error('缺少 dist/web/index.html。先运行 pnpm build。');
  if (!(await exists(node)))
    throw new Error(
      '缺少用于 Windows 安装包的 node.exe。设置 TASKBOARD_BUNDLED_NODE 为已审核的 Node 22 runtime。',
    );
  if (!withinWorkspace(runtime))
    throw new Error('Refusing to stage desktop files outside the workspace.');
  await rm(runtime, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  await mkdir(runtime, { recursive: true });
  await cp(node, join(runtime, 'node.exe'));
  await cp(join(root, 'dist', 'web'), join(runtime, 'web'), { recursive: true });
  // Build a self-contained Node runtime: source workspace imports must not point
  // to TypeScript files or developer pnpm links after this installer is copied.
  await writeFile(join(runtime, 'package.json'), '{"type":"commonjs"}\n', 'utf8');
  await build({
    entryPoints: [companion],
    outfile: join(runtime, 'companion.js'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    legalComments: 'none',
  });
  await build({
    entryPoints: [taskctl],
    outfile: join(runtime, 'taskctl.js'),
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    legalComments: 'none',
  });
  await writeFile(
    join(runtime, 'taskctl.cmd'),
    '@echo off\r\nset "TASKBOARD_DATA_DIR=%APPDATA%\\CodexTaskboard"\r\nset "TASKBOARD_RUNTIME_TASKCTL=1"\r\n"%~dp0node.exe" "%~dp0taskctl.js" %*\r\n',
    'utf8',
  );
  await cp(join(root, 'skills'), join(runtime, 'skills'), { recursive: true });
  await writeFile(
    join(runtime, 'install-taskboard-skill.ps1'),
    "$ErrorActionPreference = 'Stop'\n$runtime = Split-Path -Parent $PSCommandPath\n$source = Join-Path $runtime 'skills\\taskboard'\n$skillRoot = Join-Path $env:USERPROFILE '.codex\\skills'\n$destination = Join-Path $skillRoot 'taskboard'\nif (-not (Test-Path -LiteralPath (Join-Path $source 'SKILL.md') -PathType Leaf)) { throw 'Bundled Taskboard skill is missing.' }\nif (Test-Path -LiteralPath $destination) { throw 'Existing Taskboard skill was not changed.' }\n[IO.Directory]::CreateDirectory($skillRoot) | Out-Null\nCopy-Item -LiteralPath $source -Destination $destination -Recurse -ErrorAction Stop\nif (-not (Test-Path -LiteralPath (Join-Path $destination 'SKILL.md') -PathType Leaf)) { throw 'Skill copy was incomplete.' }\n[Environment]::SetEnvironmentVariable('TASKBOARD_TASKBOARD_RUNTIME', $runtime, 'User')\nWrite-Output 'Taskboard skill installed. Restart Codex before using it.'\n",
    'utf8',
  );
  await writeFile(
    join(runtime, 'install-taskboard-skill.cmd'),
    '@echo off\r\npowershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-taskboard-skill.ps1"\r\nexit /b %ERRORLEVEL%\r\n',
    'utf8',
  );
  process.stdout.write(
    'Desktop staging is ready. The installer is per-user and bundles Node; no system Node is required.\n',
  );
}
void main();
