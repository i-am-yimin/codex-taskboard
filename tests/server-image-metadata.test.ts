import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve('scripts/server-image-metadata.mjs');
const sha = 'a'.repeat(40);
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function run(version: string, tag = `vserver-${version}`, commit = sha) {
  const cwd = mkdtempSync(join(tmpdir(), 'taskboard-image-version-'));
  directories.push(cwd);
  mkdirSync(join(cwd, 'apps', 'server'), { recursive: true });
  writeFileSync(join(cwd, 'package.json'), JSON.stringify({ version: '9.9.9' }));
  writeFileSync(join(cwd, 'apps', 'server', 'package.json'), JSON.stringify({ version }));
  const output = join(cwd, 'github-output');
  return {
    ...spawnSync(process.execPath, [script, tag, commit], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: output },
      windowsHide: true,
    }),
    output,
  };
}
describe('independent server image publication', () => {
  it.each(['0.1.2-preview.1', '1.2.3'])(
    'publishes server version %s independently of the client',
    (version) => {
      const result = run(version);
      expect(result.status, result.stderr).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        version,
        tag: `server-${version}`,
        'commit-tag': 'server-aaaaaaaaaaaa',
      });
      expect(readFileSync(result.output, 'utf8')).toContain(`tag=server-${version}\n`);
    },
  );
  it.each(['v0.1.2-preview.1', 'vserver-0.1.1', 'vserver-preview-20261020'])(
    'rejects mismatched source tag %s',
    (tag) => {
      const result = run('0.1.2-preview.1', tag);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Release tag must match the server package version');
    },
  );
  it.each(['01.2.3', '1.2.3-preview.01', '1.2.3+build.1', 'latest', '1.2.3\nother=value'])(
    'rejects invalid image version %s',
    (version) => {
      const result = run(version);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('Docker-compatible semantic version');
    },
  );
  it('rejects an invalid source revision', () => {
    expect(run('1.2.3', 'vserver-1.2.3', 'abc123').status).not.toBe(0);
  });
});
