import { test, expect } from '@playwright/test';
test('demo supports search, task inspection and view changes without server', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?demo=1');
  await expect(page.getByRole('heading', { name: '任务看板', exact: true })).toBeVisible();
  await page.getByPlaceholder('搜索任务、标签…').fill('Codex');
  await expect(page.getByText('完成 Codex 桌面端看板入口', { exact: true })).toBeVisible();
  await expect(page.getByText('登录与邀请链接', { exact: true })).toHaveCount(0);
  await page.getByPlaceholder('搜索任务、标签…').fill('');
  await page.getByRole('button', { name: '列表', exact: true }).click();
  await expect(page.getByRole('button', { name: '看板', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('onboarding is reachable and demonstration is explicitly labelled', async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page.getByText('演示模式', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '设置', exact: true }).click();
  await expect(page.getByText('空间设置', { exact: true })).toBeVisible();
});

test('embedded board reflows without horizontal scrolling as its host resizes', async ({
  page,
}) => {
  await page.goto('/?demo=1&embedded=1');
  await expect(page.locator('.board .column')).toHaveCount(4);

  for (const [width, minimumRows] of [
    [1575, 1],
    [935, 2],
    [640, 2],
    [420, 4],
    [185, 4],
  ]) {
    await page.setViewportSize({ width, height: 820 });
    const layout = await page.locator('.board').evaluate((board) => {
      const rect = board.getBoundingClientRect();
      const columns = [...board.querySelectorAll('.column')].map((column) =>
        column.getBoundingClientRect(),
      );
      return {
        clientWidth: board.clientWidth,
        scrollWidth: board.scrollWidth,
        rows: new Set(columns.map((column) => Math.round(column.y))).size,
        columnsInside: columns.every(
          (column) => column.x >= rect.x - 1 && column.right <= rect.right + 1,
        ),
      };
    });
    expect(layout.scrollWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(
      layout.clientWidth + 1,
    );
    expect(layout.columnsInside, `clipped status column at ${width}px`).toBe(true);
    expect(layout.rows, `status columns did not wrap at ${width}px`).toBeGreaterThanOrEqual(
      minimumRows,
    );
    if (width <= 420) {
      const filterWidths = await page
        .locator('.toolbar select')
        .evaluateAll((filters) => filters.map((filter) => filter.getBoundingClientRect().width));
      expect(filterWidths.every((filterWidth) => filterWidth >= Math.min(120, width - 20))).toBe(
        true,
      );
    }
    if (width === 185) {
      const compact = await page.evaluate(() => {
        const title = document.querySelector('.page-head h1')!;
        const actions = [...document.querySelectorAll('.head-actions .button')];
        return {
          documentWidth: document.documentElement.scrollWidth,
          titleLines: Math.round(
            title.getBoundingClientRect().height / parseFloat(getComputedStyle(title).lineHeight),
          ),
          actionLines: actions.map((action) => {
            const label = [...action.childNodes].find(
              (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
            );
            if (!label) return 0;
            const range = document.createRange();
            range.selectNodeContents(label);
            return range.getClientRects().length;
          }),
        };
      });
      expect(compact.documentWidth).toBeLessThanOrEqual(width);
      expect(compact.titleLines).toBe(1);
      expect(compact.actionLines.every((lines) => lines === 1)).toBe(true);
    }
  }

  await page.getByRole('button', { name: '列表', exact: true }).click();
  const list = await page.locator('.list-view').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth + 1);
});
