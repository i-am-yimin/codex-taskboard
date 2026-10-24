import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

if (process.platform !== 'win32') throw new Error('This check requires the staged Windows runtime.');
const artifacts = resolve('.artifacts');
await mkdir(artifacts, { recursive: true });
const fixture = join(artifacts, `desktop-runtime-${randomUUID()}`);
assert.equal(dirname(fixture), artifacts);
await mkdir(fixture);
const parent = join(fixture, '较长中文目录与空格 用于验证桌面运行时模块格式');
const runtime = join(parent, 'runtime');
await mkdir(runtime, { recursive: true });
await writeFile(join(parent, 'package.json'), '{"type":"module"}\n');
// Deliberately omit runtime/package.json: the executable entries must identify
// their CommonJS format even when Node cannot read the nearest package scope.
for (const name of ['node.exe', 'companion.cjs', 'taskctl.cjs'])
  await copyFile(resolve('apps/desktop/runtime', name), join(runtime, name));
const probe = join(parent, 'factory-probe.cjs');
await writeFile(probe, `
const assert = require('node:assert/strict');
const { createCompanion } = require(process.argv[2]);
(async () => {
  const runtime = await createCompanion({ dataDirectory: process.argv[3], port: 0 });
  try {
    const response = await fetch('http://127.0.0.1:' + runtime.port + '/health', {
      headers: { 'x-taskboard-companion-key': runtime.clientKey },
      signal: AbortSignal.timeout(5000), redirect: 'error'
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.version, 1);
  } finally { await runtime.stop(); }
  process.stdout.write('Factory started and stopped normally\\n');
})().catch(error => { console.error(error); process.exitCode = 1; });
`);
const env = { ...process.env };
for (const key of Object.keys(env))
  if (key.startsWith('TASKBOARD_') || key === 'NODE_OPTIONS') delete env[key];
const options = {
  env,
  windowsHide: true,
  encoding: 'utf8' as const,
  timeout: 60_000,
  maxBuffer: 1024 * 1024,
};
let passed = false;
try {
  const node = join(runtime, 'node.exe');
  const output = execFileSync(node, [probe, join(runtime, 'companion.cjs'), join(fixture, 'data')], options);
  assert.ok(output.includes('Factory started and stopped normally'));
  const help = execFileSync(node, [join(runtime, 'taskctl.cjs'), '--help'], options);
  assert.ok(help.includes('taskctl') && help.includes('login'));
  passed = true;
  console.log('Staged Windows companion and CLI execute from a long Chinese path inside an ES module package without a runtime package manifest.');
} finally {
  if (passed) {
    const actual = await realpath(fixture);
    const allowed = await realpath(artifacts);
    assert.ok(actual.startsWith(allowed + sep), 'Refusing cleanup outside the artifact workspace');
    await rm(fixture, { recursive: true, force: true });
  } else {
    console.error(`Failed runtime fixture retained: ${fixture}`);
  }
}
