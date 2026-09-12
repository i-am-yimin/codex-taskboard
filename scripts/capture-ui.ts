import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const output = resolve('docs/screenshots');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.CI ? undefined : 'chrome',
});
try {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    colorScheme: 'light',
  });
  await page.goto('http://127.0.0.1:4173/?demo=1');
  await page.getByRole('heading', { name: '任务看板', exact: true }).waitFor();
  await page.screenshot({ path: resolve(output, 'board-light.png') });
  await page.getByText('完成 Codex 桌面端看板入口', { exact: true }).click();
  await page.getByRole('textbox', { name: '任务标题' }).waitFor();
  await page.screenshot({ path: resolve(output, 'task-detail.png') });
  await page.getByTitle('关闭', { exact: true }).click();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await page.getByText('空间设置', { exact: true }).waitFor();
  await page.screenshot({ path: resolve(output, 'space-settings.png') });
  await page.getByRole('button', { name: '关闭', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.screenshot({ path: resolve(output, 'board-dark.png') });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: resolve(output, 'board-compact-dark.png') });
  await page.goto('http://127.0.0.1:4173/');
  await page.getByRole('button', { name: '登录并继续' }).waitFor();
  await page.screenshot({ path: resolve(output, 'first-connection.png') });
  console.log(`UI screenshots saved to ${output}`);
} finally {
  await browser.close();
}
