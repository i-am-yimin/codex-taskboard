import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
if (existsSync('.env')) process.loadEnvFile('.env');
const children = [
  spawn(process.execPath, ['--import', 'tsx', 'apps/server/src/main.ts'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PUBLIC_ORIGIN: process.env.DEV_PUBLIC_ORIGIN ?? 'http://127.0.0.1:4173',
    },
  }),
  spawn(
    process.execPath,
    [resolve('node_modules/vite/bin/vite.js'), '--config', 'apps/web/vite.config.ts'],
    { stdio: 'inherit', env: process.env },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill());
  process.exitCode = code;
}
children.forEach((child) => child.on('exit', (code) => stop(code ?? 1)));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
