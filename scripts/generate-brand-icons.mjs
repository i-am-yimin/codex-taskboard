import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

// Independent browser; no user profile or running Codex is accessed.
const source = new URL('../apps/desktop/src-tauri/icons/taskboard.svg', import.meta.url);
const svg = await readFile(source, 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  const images = [];
  for (const size of [16, 20, 24, 32, 48, 64, 128, 256]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%;background:transparent}svg{display:block;width:100%;height:100%}</style>${svg}`,
    );
    const png = await page.screenshot({ omitBackground: true });
    images.push({ size, png });
    if (size === 256)
      await writeFile(new URL('../apps/desktop/src-tauri/icons/icon.png', import.meta.url), png);
    await page.close();
  }
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + 16 * index;
    header[entry] = size === 256 ? 0 : size;
    header[entry + 1] = size === 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  await writeFile(
    new URL('../apps/desktop/src-tauri/icons/icon.ico', import.meta.url),
    Buffer.concat([header, ...images.map(({ png }) => png)]),
  );
  console.log('Generated PNG and eight-size ICO from the original relay-card SVG.');
} finally {
  await browser.close();
}
