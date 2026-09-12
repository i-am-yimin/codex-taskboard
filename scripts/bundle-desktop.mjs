import { spawnSync } from 'node:child_process';
import { accessSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '..');
const cli = resolve(root, 'node_modules/@tauri-apps/cli/tauri.js');
const desktop = resolve(root, 'apps/desktop');
accessSync(cli);
const result = spawnSync(process.execPath, [cli, 'build', '--', '--locked'], {
  cwd: desktop,
  stdio: 'inherit',
  windowsHide: true,
  shell: false,
});
if (result.error) throw result.error;
if (result.signal) process.exitCode = 1;
else process.exitCode = result.status ?? 1;
