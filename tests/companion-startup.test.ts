import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCompanion } from '../apps/companion/src/main.ts';
import { SecretStore } from '../apps/companion/src/secret.ts';
afterEach(() => vi.restoreAllMocks());
describe('bounded companion credential initialization', () => {
  it('creates a missing CLI key before the other credential reads finish', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'taskboard-startup-test-'));
    let release!: () => void;
    const delayedCredentials = new Promise<void>((resolve) => {
      release = resolve;
    });
    let writing!: () => void;
    const keyStarted = new Promise<void>((resolve) => {
      writing = resolve;
    });
    let reads = 0;
    vi.spyOn(SecretStore.prototype, 'read').mockImplementation(async () => {
      reads++;
      if (reads <= 2) await delayedCredentials;
      return undefined;
    });
    const write = vi.spyOn(SecretStore.prototype, 'write').mockImplementation(async () => {
      writing();
    });
    const starting = createCompanion({ port: 0, dataDirectory: directory });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        keyStarted,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error('CLI key creation waited behind blocked credential reads')),
            3000,
          );
        }),
      ]);
      expect(write).toHaveBeenCalledOnce();
    } finally {
      clearTimeout(timer);
      release();
      const runtime = await starting;
      await runtime.stop();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
