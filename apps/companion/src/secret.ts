import { spawn } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const protect =
  'Add-Type -AssemblyName System.Security; [Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($x),$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser))';
const unprotect =
  'Add-Type -AssemblyName System.Security; [Text.Encoding]::UTF8.GetString([System.Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($x),$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser))';

async function dpapi(script: string, input: string): Promise<string> {
  // The command and script are fixed constants; the secret is provided over stdin,
  // never concatenated into a shell command or process arguments.
  const encoded = Buffer.from(`$x=[Console]::In.ReadToEnd(); ${script}`, 'utf16le').toString(
    'base64',
  );
  return new Promise<string>((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
      { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding('utf8').on('data', (chunk) => {
      stderr += chunk;
    });
    child
      .once('error', reject)
      .once('close', (code) =>
        code === 0
          ? resolve(stdout.trim())
          : reject(new Error(`DPAPI failed: ${stderr.trim() || code}`)),
      );
    child.stdin.end(input);
  });
}

export class SecretStore {
  constructor(private readonly path: string) {}
  async write(value: string): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const protectedValue =
      process.platform === 'win32'
        ? await dpapi(protect, value)
        : Buffer.from(value, 'utf8').toString('base64');
    const temporary = `${this.path}.${process.pid}.tmp`;
    await writeFile(temporary, protectedValue, { mode: 0o600 });
    await rename(temporary, this.path);
  }
  async read(): Promise<string | undefined> {
    try {
      const value = (await readFile(this.path, 'utf8')).trim();
      return process.platform === 'win32'
        ? await dpapi(unprotect, value)
        : Buffer.from(value, 'base64').toString('utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  }
  async clear(): Promise<void> {
    await rm(this.path, { force: true });
  }
}
