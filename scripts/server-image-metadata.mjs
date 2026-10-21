import { appendFileSync, readFileSync } from 'node:fs';
import process from 'node:process';

const [releaseTag, sha] = process.argv.slice(2);
const { version } = JSON.parse(readFileSync('apps/server/package.json', 'utf8'));
const number = '(?:0|[1-9][0-9]*)';
const identifier = '(?:0|[1-9][0-9]*|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*)';
const semver = new RegExp(
  `^${number}\\.${number}\\.${number}(?:-${identifier}(?:\\.${identifier})*)?$`,
);
if (
  typeof version !== 'string' ||
  version !== version.trim() ||
  !semver.test(version) ||
  `server-${version}`.length > 128
)
  throw new Error(
    'Server version must be a Docker-compatible semantic version without build metadata',
  );
if (releaseTag !== `vserver-${version}`)
  throw new Error(`Release tag must match the server package version: vserver-${version}`);
if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error('Expected a full source commit SHA');

const metadata = { version, tag: `server-${version}`, 'commit-tag': `server-${sha.slice(0, 12)}` };
if (process.env.GITHUB_OUTPUT)
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    Object.entries(metadata)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(''),
  );
process.stdout.write(`${JSON.stringify(metadata)}\n`);
