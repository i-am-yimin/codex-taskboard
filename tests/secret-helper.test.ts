import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { collectSecretHelper } from '../apps/companion/src/secret.ts';
describe('bounded owned secret helper', () => {
  it('times out and terminates only the retained helper without exposing input', async () => {
    const child = spawn(
      process.execPath,
      ['-e', 'process.stdin.resume();setInterval(()=>{},1000)'],
      { stdio: 'pipe', windowsHide: true },
    );
    const closed = once(child, 'close');
    await expect(collectSecretHelper(child, 'synthetic-secret-never-log', 100)).rejects.toThrow(
      'SECRET_HELPER_TIMEOUT',
    );
    await closed;
    expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
  });
  it.each(['stdout', 'stderr'] as const)(
    'limits %s and does not include helper stderr in errors',
    async (channel) => {
      const child = spawn(
        process.execPath,
        [
          '-e',
          `process.stdin.resume();process.stdin.on("end",()=>{console.error("synthetic-private-secret");process.${channel}.write("x".repeat(4096));setInterval(()=>{},1000)});`,
        ],
        { stdio: 'pipe', windowsHide: true },
      );
      const closed = once(child, 'close');
      await expect(
        collectSecretHelper(child, 'synthetic-private-input', 5000, 100),
      ).rejects.toThrow('SECRET_HELPER_OUTPUT_LIMIT');
      await closed;
    },
  );
  it('preserves a successful helper result over stdin without a shell', async () => {
    const child = spawn(
      process.execPath,
      [
        '-e',
        'let value="";process.stdin.on("data",c=>value+=c);process.stdin.on("end",()=>process.stdout.write(value));',
      ],
      { stdio: 'pipe', windowsHide: true },
    );
    await expect(collectSecretHelper(child, 'synthetic payload', 5000)).resolves.toBe(
      'synthetic payload',
    );
  });
});
