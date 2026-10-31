import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import type { MailMessage } from '../../apps/server/src/account-mail.ts';

type Options = {
  databaseUrl: string;
  sessionSecret: string;
  encryptionKey?: string;
  setupToken?: string;
  managedSecrets?: boolean;
};
export async function startAccountTestServer(options: Options, messages: MailMessage[] = []) {
  const env: NodeJS.ProcessEnv = {};
  for (const key of [
    'PATH',
    'Path',
    'SystemRoot',
    'TEMP',
    'TMP',
    'USERPROFILE',
    'APPDATA',
    'LOCALAPPDATA',
  ])
    if (process.env[key]) env[key] = process.env[key];
  env.NODE_ENV = 'test';
  env.ACCOUNT_TEST_SERVER_OPTIONS = JSON.stringify(options);
  const child = spawn(
    process.execPath,
    ['--import', 'tsx', resolve('tests/fixtures/account-server-process.ts')],
    {
      env,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    },
  );
  let errorOutput = '';
  child.stderr!.on('data', (chunk: Buffer) => {
    errorOutput = (errorOutput + chunk.toString()).slice(-1500);
  });
  const exited = new Promise<void>((resolve) => child.once('exit', () => resolve()));
  const pending = new Map<string, { resolve: () => void; reject: (error: Error) => void }>();
  const base = await new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`Account test server startup timed out: ${errorOutput}`));
    }, 20000);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', () => {
      clearTimeout(timer);
      reject(new Error(`Account test server exited: ${errorOutput}`));
    });
    child.on(
      'message',
      (message: {
        type: string;
        base: string;
        id: string;
        error?: string;
        message: MailMessage;
      }) => {
        if (message.type === 'ready') {
          clearTimeout(timer);
          resolve(message.base);
        } else if (message.type === 'mail') messages.push(message.message);
        else if (message.type === 'result') {
          const waiting = pending.get(message.id);
          pending.delete(message.id);
          if (message.error) waiting?.reject(new Error(message.error));
          else waiting?.resolve();
        }
      },
    );
  });
  const command = (command: string) =>
    new Promise<void>((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Account test server command timed out'));
      }, 15000);
      pending.set(id, {
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      child.send({ id, command });
    });
  return {
    base,
    runAccountMail: () => command('mail'),
    inject: async (request: {
      method?: string;
      url: string;
      headers?: Record<string, string>;
      payload?: unknown;
    }) => {
      const response = await fetch(`${base}${request.url}`, {
        method: request.method ?? 'GET',
        headers: {
          ...request.headers,
          ...(request.payload === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: request.payload === undefined ? undefined : JSON.stringify(request.payload),
        signal: AbortSignal.timeout(12000),
      });
      const text = await response.text();
      return {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers),
        json: () => JSON.parse(text),
      };
    },
    close: async () => {
      try {
        if (child.exitCode === null && child.connected) await command('close');
      } finally {
        if (child.exitCode === null) child.kill();
        await exited;
      }
    },
  };
}
