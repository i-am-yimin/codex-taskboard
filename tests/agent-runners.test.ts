import { afterEach, describe, expect, it } from 'vitest';
import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { TaskRun } from '../packages/core/src/index.ts';
import {
  LocalAgentRunner,
  configureRunner,
  type SpawnProcess,
} from '../apps/companion/src/runners.ts';

const directories: string[] = [];
const runners: LocalAgentRunner[] = [];
const fixtureChildren: ChildProcess[] = [];
afterEach(async () => {
  try {
    await Promise.all(runners.splice(0).map((runner) => runner.shutdown()));
  } finally {
    await Promise.all(
      fixtureChildren.splice(0).map(async (child) => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
        child.kill();
        await closed;
      }),
    );
  }
  await Promise.all(
    directories
      .splice(0)
      .map((directory) =>
        rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }),
      ),
  );
});
const repository = 'https://example.test/synthetic/repository';
function run(runner: TaskRun['runner'] = 'codex-cli'): TaskRun {
  return {
    id: randomUUID(),
    taskId: randomUUID(),
    claimId: randomUUID(),
    actorId: randomUUID(),
    deviceId: randomUUID(),
    runner,
    phase: 'starting',
    externalSessionId: null,
    startedAt: null,
    finishedAt: null,
    lastHeartbeatAt: null,
    failureReason: '',
  };
}
async function setup(
  script: string,
  kind: 'codex-cli' | 'claude-code' = 'codex-cli',
  authorize = () => undefined,
  report: (run: TaskRun) => Promise<void> = async () => undefined,
) {
  const directory = await mkdtemp(join(tmpdir(), 'taskboard-runner-test-'));
  directories.push(directory);
  await promisify(execFile)('git', ['init', directory]);
  await promisify(execFile)('git', ['-C', directory, 'remote', 'add', 'origin', repository]);
  await configureRunner(directory, kind, process.execPath, join(directory, 'isolated-home'));
  const fixture = join(directory, 'fixture.cjs');
  await writeFile(fixture, script);
  let launches = 0;
  const argv: string[][] = [];
  const spawnProcess: SpawnProcess = (_file, args, options) => {
    const values = Array.isArray(args) ? args : [];
    if (values.includes('--version'))
      return spawn(
        process.execPath,
        [
          '-e',
          `console.log(${JSON.stringify(kind === 'codex-cli' ? 'codex-cli 0.164.0' : '2.1.310 (Claude Code)')})`,
        ],
        options,
      );
    if (values.includes('status'))
      return spawn(process.execPath, ['-e', 'process.exit(0)'], options);
    launches++;
    argv.push(values as string[]);
    const child = spawn(process.execPath, [fixture], options);
    fixtureChildren.push(child);
    return child;
  };
  const runner = new LocalAgentRunner(directory, () => directory, report, spawnProcess, authorize);
  runners.push(runner);
  await runner.load();
  return { runner, directory, launches: () => launches, argv };
}
async function terminal(runner: LocalAgentRunner, id: string) {
  for (let index = 0; index < 500; index++) {
    const value = await runner.status(id);
    if (['failed', 'succeeded', 'cancelled'].includes(value.phase)) return value;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  throw new Error('independent subprocess did not finish');
}
describe('real owned subprocess supervisor with synthetic protocol fixtures', () => {
  it('terminates an owned subprocess while its remote report is blocked', async () => {
    let release!: () => void;
    let reporting!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      reporting = resolve;
    });
    const fixture = await setup(
      'console.log(JSON.stringify({type:"thread.started",thread_id:"blocked-report"}));setInterval(()=>{},1000);',
      'codex-cli',
      () => undefined,
      async () => {
        reporting();
        await gate;
      },
    );
    const value = run();
    const starting = fixture.runner.start(value, 'synthetic', repository);
    await entered;
    const cancelling = fixture.runner.cancel(value.id);
    try {
      const deadline = Date.now() + 35000;
      while (Date.now() < deadline && (await fixture.runner.status(value.id)).phase !== 'cancelled')
        await new Promise((resolve) => setTimeout(resolve, 50));
      expect((await fixture.runner.status(value.id)).phase).toBe('cancelled');
      await fixture.runner.shutdown();
      const restarted = new LocalAgentRunner(fixture.directory, () => fixture.directory);
      await restarted.load();
      expect((await restarted.status(value.id)).phase).toBe('cancelled');
    } finally {
      release();
      await starting;
      await cancelling;
    }
  }, 60000);
  it('starts once for concurrent identical run IDs and requires both Codex completion and exit zero', async () => {
    const fixture = await setup(
      `process.stdin.resume(); process.stdin.on('end',()=>{console.log(JSON.stringify({type:'thread.started',thread_id:'synthetic-session'}));console.log(JSON.stringify({type:'turn.completed'}));});`,
    );
    const value = run();
    value.permissionMode = 'workspace-write';
    await Promise.all([
      fixture.runner.start(value, 'synthetic', repository),
      fixture.runner.start(value, 'synthetic', repository),
    ]);
    expect(fixture.launches()).toBe(1);
    expect(fixture.argv[0]).toEqual(['exec', '--sandbox', 'workspace-write', '--json', '-']);
    expect((await terminal(fixture.runner, value.id)).phase).toBe('succeeded');
    expect((await fixture.runner.status(value.id)).externalSessionId).toBe('synthetic-session');
    expect(await readFile(join(fixture.directory, 'runs.json'), 'utf8')).not.toContain('pid');
  });
  it.each([
    ['console.log(JSON.stringify({type:"turn.completed"}));process.exitCode=2;', 'codex-cli'],
    [
      'console.log(JSON.stringify({type:"result",is_error:true,session_id:"synthetic"}));',
      'claude-code',
    ],
    ['console.log("not a result");', 'codex-cli'],
  ] as const)('rejects failure result or exit mismatch: %s', async (script, kind) => {
    const fixture = await setup(script, kind);
    const value = run(kind);
    await fixture.runner.start(value, 'synthetic', repository);
    expect((await terminal(fixture.runner, value.id)).phase).toBe('failed');
  });
  it('cancels only the retained process tree and waits for real exit', async () => {
    const fixture = await setup(
      `const child=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});require('node:fs').writeFileSync('child.pid',String(child.pid));console.log(JSON.stringify({type:'thread.started',thread_id:'synthetic'}));setInterval(()=>{},1000);`,
    );
    const value = run();
    await fixture.runner.start(value, 'synthetic', repository);
    // The synthetic event is emitted after the descendant PID is written.
    // start() proves the owned root was spawned, not that its script has run.
    await expect
      .poll(async () => (await fixture.runner.status(value.id)).externalSessionId, { timeout: 10000 })
      .toBe('synthetic');
    const childPid = Number(await readFile(join(fixture.directory, 'child.pid'), 'utf8'));
    expect(() => process.kill(childPid, 0)).not.toThrow();
    await fixture.runner.cancel(value.id);
    const cancelled = await terminal(fixture.runner, value.id);
    expect(cancelled.phase, JSON.stringify(cancelled)).toBe('cancelled');
    expect(cancelled.finishedAt).not.toBeNull();
    expect(() => process.kill(childPid, 0)).toThrow();
  }, 45000);
  it('passes explicit Claude edit mode with no bypass and checks the official result event', async () => {
    const fixture = await setup(
      'console.log(JSON.stringify({type:"result",is_error:false,session_id:"synthetic"}));',
      'claude-code',
    );
    const value = run('claude-code');
    value.permissionMode = 'workspace-write';
    await fixture.runner.start(value, 'synthetic', repository);
    expect((await terminal(fixture.runner, value.id)).phase).toBe('succeeded');
    expect(fixture.argv[0]).toContain('acceptEdits');
    expect(fixture.argv[0]).not.toContain('--bare');
    expect(fixture.argv[0].join(' ')).not.toMatch(/bypass|skip-permissions|danger/);
  });
  it('restores an active record as unknown without probing or killing a disk PID', async () => {
    const fixture = await setup('');
    const value = run();
    value.phase = 'running';
    await writeFile(join(fixture.directory, 'runs.json'), JSON.stringify([value]));
    const restarted = new LocalAgentRunner(fixture.directory, () => fixture.directory);
    await restarted.load();
    expect((await restarted.status(value.id)).phase).toBe('unknown');
    await expect(restarted.cancel(value.id)).rejects.toMatchObject({
      code: 'RUN_STATE_UNCONFIRMED',
    });
  });
  it('rejects corrupt persisted records instead of trusting an id-only cast', async () => {
    const fixture = await setup('');
    await writeFile(
      join(fixture.directory, 'runs.json'),
      JSON.stringify([{ id: randomUUID(), phase: 'running' }]),
    );
    await expect(
      new LocalAgentRunner(fixture.directory, () => fixture.directory).load(),
    ).rejects.toThrow();
  });
  it('rechecks session authorization immediately before spawn', async () => {
    const fixture = await setup('', 'codex-cli', () => {
      throw new Error('AUTH_SUPERSEDED');
    });
    await expect(fixture.runner.start(run(), 'synthetic', repository)).rejects.toThrow(
      'AUTH_SUPERSEDED',
    );
    expect(fixture.launches()).toBe(0);
  });
  it('resumes a new run only with an observed official session and known terminal predecessor', async () => {
    const fixture = await setup(
      `console.log(JSON.stringify({type:'thread.started',thread_id:'synthetic-session'}));console.log(JSON.stringify({type:'turn.completed'}));`,
    );
    const original = run();
    await fixture.runner.start(original, 'synthetic', repository);
    await terminal(fixture.runner, original.id);
    const next = { ...original, id: randomUUID(), externalSessionId: 'synthetic-session' };
    await fixture.runner.resume(next, 'continue synthetic', repository);
    await terminal(fixture.runner, next.id);
    expect(fixture.argv[1]).toEqual([
      'exec',
      'resume',
      'synthetic-session',
      '-c',
      'sandbox_mode="read-only"',
      '--json',
      '-',
    ]);
    await expect(
      fixture.runner.resume({ ...next, id: randomUUID(), externalSessionId: null }, '', repository),
    ).rejects.toMatchObject({ code: 'RUNNER_UNSUPPORTED' });
  });
});
