import { randomUUID, createHash } from 'node:crypto';
import { hash, Algorithm } from '@node-rs/argon2';
import { z } from 'zod';
import { createDatabase, type Database, withTransaction } from './db.ts';
import { migrate } from './migrate.ts';

const emailSchema = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const nameSchema = z.string().trim().min(1).max(80);
function flag(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length && !args[index + 1].startsWith('--')
    ? args[index + 1]
    : undefined;
}
async function readPassword(): Promise<string> {
  if (process.env.TASKBOARD_ADMIN_PASSWORD) return process.env.TASKBOARD_ADMIN_PASSWORD;
  if (process.stdin.isTTY)
    throw new Error('Set TASKBOARD_ADMIN_PASSWORD or pipe the password on stdin');
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8').trim();
}

export async function runAdmin(
  args: string[],
  db: Database,
  passwordReader = readPassword,
): Promise<string> {
  const email = emailSchema.safeParse(flag(args, '--email'));
  if (!email.success) throw new Error('A valid --email is required');
  if (args[0] === 'bootstrap') {
    const name = nameSchema.safeParse(flag(args, '--name') ?? 'Administrator');
    const password = await passwordReader();
    if (!name.success || password.length < 12)
      throw new Error('A name and a password of at least 12 characters are required');
    await withTransaction(db, async (client) => {
      await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const existing = await client.query('SELECT 1 FROM users WHERE instance_admin=true LIMIT 1');
      if (existing.rowCount)
        throw new Error('An instance administrator already exists; use recovery instead');
      await client.query(
        'INSERT INTO users (id,email,name,password_hash,instance_admin) VALUES ($1,$2,$3,$4,true)',
        [
          randomUUID(),
          email.data,
          name.data,
          await hash(password, { algorithm: Algorithm.Argon2id }),
        ],
      );
    });
    return `Created instance administrator ${email.data}`;
  }
  if (args[0] === 'recovery') {
    const user = await db.query('SELECT id FROM users WHERE email=$1 AND archived_at IS NULL', [
      email.data,
    ]);
    if (!user.rowCount) throw new Error('User not found');
    const token = `tb_recovery_${randomUUID()}${randomUUID()}`;
    await db.query(
      "INSERT INTO recovery_links (id,user_id,token_hash,expires_at) VALUES ($1,$2,$3,now()+interval '24 hours')",
      [randomUUID(), user.rows[0].id, createHash('sha256').update(token).digest('hex')],
    );
    const origin = (process.env.PUBLIC_ORIGIN ?? 'http://127.0.0.1:47830').replace(/\/$/, '');
    return `${origin}/#recovery=${encodeURIComponent(token)}`;
  }
  throw new Error(
    'Usage: admin bootstrap --email user@example.com [--name Name] | recovery --email user@example.com',
  );
}
export async function main() {
  const db = createDatabase();
  try {
    await migrate(db);
    console.log(await runAdmin(process.argv.slice(2), db));
  } finally {
    await db.end();
  }
}
