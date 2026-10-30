import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const protect =
  'Add-Type -AssemblyName System.Security; [Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($x),$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser))';
const unprotect =
  'Add-Type -AssemblyName System.Security; [Text.Encoding]::UTF8.GetString([System.Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($x),$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser))';

/** Collect only an already-owned helper. Errors never include secret input/output. */
export async function collectSecretHelper(
  child: ChildProcessWithoutNullStreams,
  input: string,
  timeoutMs = 20000,
  maxOutputBytes = 65536,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let stdout = '';
    let size = 0;
    let settled = false;
    const fail = (code: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stdout = '';
      if (child.exitCode === null && child.signalCode === null) child.kill();
      reject(new Error(code));
    };
    const timer = setTimeout(() => fail('SECRET_HELPER_TIMEOUT'), timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.byteLength;
      if (size > maxOutputBytes) {
        fail('SECRET_HELPER_OUTPUT_LIMIT');
        return;
      }
      if (!settled) stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      size += chunk.byteLength;
      if (size > maxOutputBytes) fail('SECRET_HELPER_OUTPUT_LIMIT');
    });
    child.once('error', () => fail('SECRET_HELPER_FAILED'));
    child.stdin.on('error', () => fail('SECRET_HELPER_INPUT_FAILED'));
    child.once('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        fail('SECRET_HELPER_FAILED');
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(stdout.trim());
      stdout = '';
    });
    child.stdin.end(input);
  });
}

async function dpapi(script: string, input: string): Promise<string> {
  // The command and script are fixed constants; the secret is provided over stdin,
  // never concatenated into a shell command or process arguments.
  const encoded = Buffer.from(`$x=[Console]::In.ReadToEnd(); ${script}`, 'utf16le').toString(
    'base64',
  );
  const child = spawn(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
    { shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  return collectSecretHelper(child, input);
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
