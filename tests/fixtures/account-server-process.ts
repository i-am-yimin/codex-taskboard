import { buildApp } from '../../apps/server/src/app.ts';
import { createDatabase } from '../../apps/server/src/db.ts';
import { RuntimeLogs } from '../../apps/server/src/runtime.ts';

// This executable is reachable only through the test runner's private IPC pipe.
// It never exposes mail-worker controls or synthetic setup options over HTTP.
if (!process.send) throw new Error('Account test server requires private IPC');
const options = JSON.parse(process.env.ACCOUNT_TEST_SERVER_OPTIONS ?? '{}') as {
  databaseUrl: string;
  sessionSecret: string;
  encryptionKey?: string;
  setupToken?: string;
  managedSecrets?: boolean;
  smtpTransport?: boolean;
};
if (!new URL(options.databaseUrl).pathname.endsWith('_test'))
  throw new Error('Account test server requires an isolated *_test database');
const db = createDatabase(options.databaseUrl);
const app = buildApp({
  db,
  databaseUrl: options.databaseUrl,
  sessionSecret: options.sessionSecret,
  setupToken: options.setupToken,
  managedSecrets: options.managedSecrets,
  runtimeLogs: new RuntimeLogs(
    [options.sessionSecret, options.setupToken ?? ''].filter(Boolean),
    false,
  ),
  logger: true,
  automation: { enabled: false },
  mail: {
    encryptionKey: options.encryptionKey,
    worker: false,
    ...(options.smtpTransport
      ? {}
      : {
          send: async (message: import('../../apps/server/src/account-mail.ts').MailMessage) => {
            process.send!({ type: 'mail', message });
          },
        }),
  },
});
const base = await app.listen({ host: '127.0.0.1', port: 0 });
process.send({ type: 'ready', base });
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await app.close();
  await db.end();
}
process.on('message', (message: { id: string; command: string }) => {
  void (async () => {
    try {
      if (message.command === 'mail') await app.runAccountMail();
      else if (message.command === 'close') await close();
      else throw new Error('Unknown account test server command');
      process.send!({ type: 'result', id: message.id });
      if (message.command === 'close') process.disconnect();
    } catch {
      process.send!({
        type: 'result',
        id: message.id,
        error: 'Account test server command failed',
      });
    }
  })();
});
process.on('disconnect', () => {
  void close().then(() => process.exit(0));
});
