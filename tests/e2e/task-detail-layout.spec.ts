import { test, expect } from '@playwright/test';
import { demoUser, makeDemoBoard, makeDemoDetail } from '../../apps/web/src/demo';

for (const embedded of [false, true]) {
  test(`long execution records stay inside the ${embedded ? 'embedded' : 'desktop'} task drawer`, async ({
    page,
  }) => {
    const board = makeDemoBoard();
    const task = { ...board.tasks[0], statusId: 's-review', title: '长记录布局回归' };
    board.tasks = [task];
    const verification = `第一行：保留验证记录的换行\nSHA256=${'0123456789abcdef'.repeat(24)}\n${'并发领取只成功一次，原任务与本地草稿保持完整。'.repeat(12)}`;
    const summary = '安装版执行结果：' + 'https://example.test/verification/'.repeat(12);
    const threadId = 'thread-' + 'a'.repeat(240);
    const detail = {
      ...makeDemoDetail(task.id),
      task,
      activities: [
        {
          id: 'layout-comment',
          taskId: task.id,
          actorId: demoUser.id,
          actorName: '布局测试',
          kind: 'comment',
          body: 'comment-' + 'b'.repeat(240),
          createdAt: '2026-10-07T00:00:00.000Z',
        },
      ],
      executions: [
        {
          id: 'layout-execution',
          taskId: task.id,
          actorId: demoUser.id,
          deviceId: 'layout-device',
          threadId,
          phase: 'submitted',
          summary,
          verification,
          createdAt: '2026-10-07T00:00:00.000Z',
        },
      ],
    };
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const data = path.endsWith('/me')
        ? demoUser
        : path.endsWith('/spaces')
          ? [board.space]
          : path.endsWith('/board')
            ? board
            : path.endsWith('/detail')
              ? detail
              : undefined;
      if (data === undefined) return route.abort();
      return route.fulfill({ status: 200, json: { data } });
    });
    await page.goto(embedded ? '/?embedded=1' : '/');
    await page.locator('.task-card').getByText(task.title, { exact: true }).click();
    const drawer = page.getByRole('complementary', { name: '任务详情' });
    await expect(drawer.locator('.activity pre')).toHaveText(verification);
    await expect(drawer.getByText(summary, { exact: true })).toBeVisible();
    for (const width of [1320, 935, 424, 185]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await drawer.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const records = [...element.querySelectorAll('.activity')].map((record) => ({
          width: record.clientWidth,
          scrollWidth: record.scrollWidth,
        }));
        return {
          width: element.clientWidth,
          scrollWidth: element.scrollWidth,
          insideWindow: box.left >= 0 && box.right <= window.innerWidth + 1,
          records,
        };
      });
      expect(layout.insideWindow, `drawer outside ${width}px window`).toBe(true);
      expect(layout.scrollWidth, `detail overflow at ${width}px`).toBeLessThanOrEqual(
        layout.width + 1,
      );
      for (const record of layout.records) {
        expect(record.scrollWidth, `execution/comment overflow at ${width}px`).toBeLessThanOrEqual(
          record.width + 1,
        );
      }
      await expect(drawer.locator('.activity pre')).toHaveText(verification);
      await expect(drawer.getByRole('button', { name: '验收并完成', exact: true })).toBeVisible();
    }
  });
}
