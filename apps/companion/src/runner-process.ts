import { spawn } from 'node:child_process';
import { join } from 'node:path';

export interface WindowsProcessIdentity {
  pid: number;
  createdTicks: string;
  executable: string;
}
const inspect = `$i=([Console]::In.ReadToEnd()|ConvertFrom-Json); try {$p=Get-Process -Id $i.pid -ErrorAction Stop; $ticks=$p.StartTime.ToUniversalTime().Ticks.ToString(); $path=$p.Path; if (!$path) {exit 2}; if ($i.createdTicks -and ($ticks -ne $i.createdTicks -or $path -ine $i.executable)) {exit 3}; if ($i.cancel) { & (Join-Path $env:SystemRoot 'System32\\taskkill.exe') /PID $p.Id /T /F | Out-Null; $result=$LASTEXITCODE; if ($result -eq 0) { [Console]::Out.WriteLine('TASKBOARD_TREE_TERMINATED') }; exit $result }; @{pid=$p.Id;createdTicks=$ticks;executable=$path}|ConvertTo-Json -Compress} catch {exit 4}`;
async function invoke(input: {
  pid: number;
  createdTicks?: string;
  executable?: string;
  cancel?: boolean;
}): Promise<string | undefined> {
  return new Promise((resolve) => {
    const child = spawn(
      join(
        process.env.SystemRoot ?? 'C:\\Windows',
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe',
      ),
      [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(inspect, 'utf16le').toString('base64'),
      ],
      { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] },
    );
    let output = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve(undefined);
    }, 15000);
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
      if (input.cancel && output.includes('TASKBOARD_TREE_TERMINATED')) {
        clearTimeout(timer);
        resolve(output);
      }
    });
    child.once('error', () => {
      clearTimeout(timer);
      resolve(undefined);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? output : undefined);
    });
    child.stdin.on('error', () => undefined);
    child.stdin.end(JSON.stringify(input));
  });
}
export async function inspectOwnedWindowsProcess(
  pid: number,
  executable: string,
): Promise<WindowsProcessIdentity | undefined> {
  const output = await invoke({ pid });
  if (!output) return;
  try {
    const value = JSON.parse(output) as Partial<WindowsProcessIdentity>;
    if (
      value.pid !== pid ||
      typeof value.createdTicks !== 'string' ||
      !/^\d+$/.test(value.createdTicks) ||
      typeof value.executable !== 'string' ||
      value.executable.toLowerCase() !== executable.toLowerCase()
    )
      return;
    return { pid, createdTicks: value.createdTicks, executable: value.executable };
  } catch {
    return;
  }
}
export async function terminateOwnedWindowsTree(
  identity: WindowsProcessIdentity,
): Promise<boolean> {
  return (await invoke({ ...identity, cancel: true })) !== undefined;
}
