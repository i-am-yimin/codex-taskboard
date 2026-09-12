import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const dir = resolve(process.argv[2] ?? '.artifacts/release');
const files = (await readdir(dir, { withFileTypes: true }))
  .filter((f) => f.isFile() && f.name !== 'SHA256SUMS')
  .map((f) => f.name)
  .sort();
if (!files.length) throw new Error('No release artifacts found');
const lines = await Promise.all(
  files.map(
    async (file) =>
      `${createHash('sha256')
        .update(await readFile(join(dir, file)))
        .digest('hex')}  ${file}`,
  ),
);
await writeFile(join(dir, 'SHA256SUMS'), lines.join('\n') + '\n');
console.log(`Checksums generated for ${files.length} artifacts`);
