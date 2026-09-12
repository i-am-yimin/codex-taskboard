import { fetchCdpVersion, SUPPORTED_CODEX_VERSIONS } from '../packages/adapter-codex/src/index.ts';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function launcherDiagnostic(): Promise<string | undefined> {
  const appData = process.env.APPDATA;
  if (!appData) return undefined;
  try {
    return (
      await readFile(join(appData, 'CodexTaskboard', 'launcher-diagnostic.txt'), 'utf8')
    ).trim();
  } catch {
    return undefined;
  }
}

async function main(): Promise<void> {
  const endpoint = process.env.TASKBOARD_CDP_ENDPOINT ?? 'http://127.0.0.1:9222';
  const report: Record<string, unknown> = {
    supportedVersions: SUPPORTED_CODEX_VERSIONS,
    endpoint,
    injected: false,
    actualDesktopVerified: false,
  };
  const launcher = await launcherDiagnostic();
  if (launcher) report.launcher = { status: 'failed', message: launcher };
  try {
    report.cdp = await fetchCdpVersion(endpoint);
    report.status = 'probe-only';
    report.message = '检测到回环 CDP，但未对用户 Codex 执行注入，也未验证实际 DOM 标记。';
  } catch (error) {
    report.status = 'unavailable';
    report.message = error instanceof Error ? error.message : 'CDP probe failed';
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status === 'unavailable') process.exitCode = 2;
}
void main();
