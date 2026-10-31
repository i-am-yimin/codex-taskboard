import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { BoardError, smtpInputSchema, type SmtpInput } from '@taskboard/core';
import { withTransaction, type Database } from './db.ts';

export type MailMessage = { to: string; subject: string; text: string };
export type MailOptions = {
  encryptionKey?: string;
  send?: (message: MailMessage, config: SmtpInput) => Promise<void>;
  worker?: boolean;
};
export function createAccountMail(db: Database, options: MailOptions = {}) {
  const key = options.encryptionKey ?? process.env.TASKBOARD_ENCRYPTION_KEY;
  const keyReady = Boolean(key && /^[a-f\d]{64}$/i.test(key));
  const encrypt = (value: unknown) => {
    if (!keyReady) throw new BoardError('MAIL_KEY_REQUIRED', '请先配置邮件加密密钥', 503);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', Buffer.from(key!, 'hex'), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return [
      'v1',
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      encrypted.toString('base64'),
    ].join('.');
  };
  const decrypt = (value: string): unknown => {
    if (!keyReady) throw new BoardError('MAIL_KEY_REQUIRED', '邮件加密密钥不可用', 503);
    const [version, iv, tag, data] = value.split('.');
    if (version !== 'v1' || !iv || !tag || !data) throw new Error('Invalid encrypted mail payload');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      Buffer.from(key!, 'hex'),
      Buffer.from(iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return JSON.parse(
      Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString(
        'utf8',
      ),
    );
  };
  const environmentLocked = () => Boolean(process.env.SMTP_HOST);
  const config = async (): Promise<SmtpInput | null> => {
    if (environmentLocked()) {
      const parsed = smtpInputSchema.safeParse({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        security: process.env.SMTP_SECURITY ?? 'starttls',
        username: process.env.SMTP_USERNAME ?? '',
        password: process.env.SMTP_PASSWORD ?? '',
        fromAddress: process.env.SMTP_FROM_ADDRESS,
        fromName: process.env.SMTP_FROM_NAME ?? 'Taskboard',
      });
      if (!parsed.success) throw new BoardError('SMTP_CONFIG_INVALID', '邮件环境变量配置无效', 503);
      return parsed.data;
    }
    const result = await db.query('SELECT config,password_encrypted FROM smtp_settings WHERE id=1');
    if (!result.rowCount) return null;
    return smtpInputSchema.parse({
      ...result.rows[0].config,
      password: result.rows[0].password_encrypted ? decrypt(result.rows[0].password_encrypted) : '',
    });
  };
  const ready = async () => {
    if (!keyReady)
      throw new BoardError(
        'MAIL_KEY_REQUIRED',
        '邮件服务尚未配置加密密钥，请联系服务器管理员',
        503,
      );
    const value = await config();
    if (!value)
      throw new BoardError('SMTP_NOT_CONFIGURED', '邮件服务尚未配置，请联系服务器管理员', 503);
    return value;
  };
  const status = async () => {
    if (!environmentLocked()) {
      const found = await db.query(
        'SELECT config,password_encrypted FROM smtp_settings WHERE id=1',
      );
      return found.rowCount
        ? {
            ...found.rows[0].config,
            configured: true,
            locked: false,
            keyReady,
            passwordConfigured: Boolean(found.rows[0].password_encrypted),
          }
        : { configured: false, locked: false, keyReady };
    }
    const value = await config();
    if (!value) return { configured: false, locked: environmentLocked(), keyReady };
    const { password, clearPassword, ...safe } = value;
    void clearPassword;
    return {
      ...safe,
      configured: true,
      passwordConfigured: Boolean(password),
      locked: environmentLocked(),
      keyReady,
    };
  };
  const save = async (input: SmtpInput) => {
    if (environmentLocked()) throw new BoardError('SMTP_LOCKED', '邮件配置由环境变量固定', 409);
    if (!keyReady) throw new BoardError('MAIL_KEY_REQUIRED', '请先配置邮件加密密钥', 503);
    // Replacing/clearing a credential must also work after explicit key recovery;
    // only preserving the old credential requires decrypting it.
    const password = input.clearPassword ? '' : input.password || (await config())?.password || '';
    const { password: ignored, clearPassword, ...safe } = input;
    void ignored;
    void clearPassword;
    await db.query(
      'INSERT INTO smtp_settings(id,config,password_encrypted) VALUES(1,$1,$2) ON CONFLICT(id) DO UPDATE SET config=$1,password_encrypted=$2',
      [safe, password ? encrypt(password) : null],
    );
  };
  const enqueue = async (message: MailMessage, kind: string, userId: string | null) => {
    await ready();
    const id = randomUUID();
    await db.query(
      'INSERT INTO mail_outbox(id,payload_encrypted,kind,user_id) VALUES($1,$2,$3,$4)',
      [id, encrypt(message), kind, userId],
    );
    return id;
  };
  let running: Promise<void> | null = null;
  const run = () => {
    if (running) return running;
    running = (async () => {
      for (let n = 0; n < 10; n++) {
        const processed = await withTransaction(db, async (client) => {
          const found = await client.query(
            "SELECT * FROM mail_outbox WHERE status='pending' AND next_attempt_at<=clock_timestamp() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
          );
          if (!found.rowCount) return false;
          const row = found.rows[0];
          try {
            const settings = await ready();
            const message = decrypt(row.payload_encrypted) as MailMessage;
            if (options.send) await options.send(message, settings);
            else {
              const transport = nodemailer.createTransport({
                host: settings.host,
                port: settings.port,
                secure: settings.security === 'tls',
                requireTLS: settings.security === 'starttls',
                connectionTimeout: 5000,
                greetingTimeout: 5000,
                socketTimeout: 10000,
                auth: settings.username
                  ? { user: settings.username, pass: settings.password }
                  : undefined,
              });
              try {
                await transport.sendMail({
                  ...message,
                  from: { name: settings.fromName, address: settings.fromAddress },
                });
              } finally {
                transport.close();
              }
            }
            await client.query(
              "UPDATE mail_outbox SET status='accepted',attempts=attempts+1,accepted_at=now(),payload_encrypted=NULL,last_error=NULL WHERE id=$1",
              [row.id],
            );
          } catch {
            await client.query(
              "UPDATE mail_outbox SET attempts=attempts+1,status=CASE WHEN attempts>=2 THEN 'failed' ELSE 'pending' END,next_attempt_at=now()+CASE WHEN attempts=0 THEN interval '1 minute' ELSE interval '5 minutes' END,last_error='SMTP_DELIVERY_FAILED' WHERE id=$1",
              [row.id],
            );
          }
          return true;
        });
        if (!processed) break;
      }
    })().finally(() => {
      running = null;
    });
    return running;
  };
  return {
    status,
    save,
    enqueue,
    run,
    ready,
    enabled: options.worker !== false,
    settled: () => running,
  };
}
