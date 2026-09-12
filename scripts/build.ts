import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
await mkdir('dist', { recursive: true });
await build({
  entryPoints: {
    server: 'apps/server/src/main.ts',
    admin: 'apps/server/src/admin-entry.ts',
    migrate: 'apps/server/src/migrate-entry.ts',
    companion: 'apps/companion/src/main.ts',
    taskctl: 'packages/cli/src/main.ts',
  },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external',
  sourcemap: true,
  alias: {
    '@taskboard/companion/secret': resolve('apps/companion/src/secret.ts'),
    '@taskboard/companion/store': resolve('apps/companion/src/store.ts'),
    '@taskboard/core': resolve('packages/core/src/index.ts'),
    '@taskboard/adapter-codex': resolve('packages/adapter-codex/src/index.ts'),
  },
});
await cp('skills', 'dist/skills', { recursive: true });
