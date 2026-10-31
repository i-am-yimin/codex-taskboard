import net from 'node:net';
import tls from 'node:tls';

/** Isolated loopback SMTP receiver. Authentication is accepted only inside TLS. */
export async function startSmtpFixture(options: {
  key: string;
  cert: string;
  starttls?: boolean;
  username: string;
  password: string;
}) {
  const messages: string[] = [];
  const connections = new Set<net.Socket>();
  let authentications = 0;
  let upgrades = 0;
  const secureContext = tls.createSecureContext({ key: options.key, cert: options.cert });
  const bind = (socket: net.Socket, secure: boolean, greeting = true) => {
    connections.add(socket);
    socket.on('error', () => {}); // Untrusted-certificate rejection is an expected test case.
    socket.once('close', () => connections.delete(socket));
    socket.setTimeout(10000, () => socket.destroy());
    let buffer = '',
      data: string[] | null = null,
      authenticated = false;
    const write = (line: string) => socket.write(line + '\r\n');
    const receive = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      while (buffer.includes('\r\n')) {
        const end = buffer.indexOf('\r\n');
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (data) {
          if (line === '.') {
            messages.push(data.join('\r\n'));
            data = null;
            write('250 Message accepted');
          } else data.push(line.replace(/^\.\./, '.'));
          continue;
        }
        const [command, ...args] = line.split(' ');
        switch (command.toUpperCase()) {
          case 'EHLO':
          case 'HELO':
            write('250-localhost');
            if (!secure) write('250-STARTTLS');
            write('250 AUTH PLAIN');
            break;
          case 'STARTTLS': {
            if (secure) {
              write('503 Already secured');
              break;
            }
            write('220 Start TLS');
            socket.off('data', receive);
            const encrypted = new tls.TLSSocket(socket, { isServer: true, secureContext });
            encrypted.on('error', () => {});
            upgrades++;
            bind(encrypted, true, false);
            return;
          }
          case 'AUTH': {
            if (!secure) {
              write('538 Encryption required');
              break;
            }
            const [kind, encoded] = args;
            const parts = Buffer.from(encoded ?? '', 'base64')
              .toString('utf8')
              .split('\0');
            authenticated =
              kind === 'PLAIN' && parts[1] === options.username && parts[2] === options.password;
            if (authenticated) authentications++;
            write(authenticated ? '235 Authenticated' : '535 Authentication failed');
            break;
          }
          case 'MAIL':
          case 'RCPT':
            write(authenticated ? '250 Ok' : '530 Authenticate first');
            break;
          case 'DATA':
            if (!authenticated) write('530 Authenticate first');
            else {
              data = [];
              write('354 End with a single dot');
            }
            break;
          case 'RSET':
            data = null;
            write('250 Ok');
            break;
          case 'QUIT':
            write('221 Bye');
            socket.end();
            break;
          default:
            write('500 Unsupported command');
        }
      }
    };
    socket.on('data', receive);
    if (greeting) write('220 localhost test SMTP');
  };
  const server = options.starttls
    ? net.createServer((socket) => bind(socket, false))
    : tls.createServer({ key: options.key, cert: options.cert }, (socket) => bind(socket, true));
  server.on('tlsClientError', () => {});
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('SMTP fixture address unavailable');
  return {
    port: address.port,
    messages,
    authentications: () => authentications,
    upgrades: () => upgrades,
    close: async () => {
      for (const socket of connections) socket.destroy();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

export function mailText(message: string) {
  const split = message.indexOf('\r\n\r\n');
  const headers = message.slice(0, split),
    body = message.slice(split + 4);
  if (/content-transfer-encoding: base64/i.test(headers))
    return Buffer.from(body, 'base64').toString('utf8');
  if (/content-transfer-encoding: quoted-printable/i.test(headers))
    return Buffer.from(
      body
        .replace(/=\r\n/g, '')
        .replace(/=([A-F\d]{2})/gi, (_m, hex: string) => String.fromCharCode(parseInt(hex, 16))),
      'latin1',
    ).toString('utf8');
  return body;
}
