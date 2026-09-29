import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { connect } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

describe.skipIf(process.platform !== 'win32')('desktop companion parent lifetime', () => {
  it('closes its listener when the launcher process disappears', async () => {
    const parent = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      stdio: 'ignore',
    });
    const moduleUrl = pathToFileURL(resolve('apps/companion/src/parent-lifetime.ts')).href;
    const companion = spawn(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        `import { createServer } from 'node:net';
         import { watchDesktopParent } from ${JSON.stringify(moduleUrl)};
         const server = createServer();
         server.listen(0, '127.0.0.1', () => console.log(server.address().port));
         watchDesktopParent(process.env.TEST_PARENT_PID, () => server.close(() => process.exit(0)), 50);`,
      ],
      {
        env: { ...process.env, TEST_PARENT_PID: String(parent.pid) },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    try {
      const [chunk] = await Promise.race([
        once(companion.stdout!, 'data'),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('companion listener did not start')), 5000),
        ),
      ]);
      const port = Number(String(chunk).trim());
      expect(port).toBeGreaterThan(0);
      parent.kill();
      const [code] = await Promise.race([
        once(companion, 'exit'),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('orphan companion did not exit')), 5000),
        ),
      ]);
      expect(code).toBe(0);
      const error = await new Promise<NodeJS.ErrnoException | undefined>((resolveError) => {
        const socket = connect(port, '127.0.0.1');
        socket.once('connect', () => {
          socket.destroy();
          resolveError(undefined);
        });
        socket.once('error', resolveError);
      });
      expect(error?.code).toBe('ECONNREFUSED');
    } finally {
      parent.kill();
      companion.kill();
    }
  }, 12_000);
});
